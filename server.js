// கிறுக்கல் server: static files + WebSocket game rooms.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const WORDS = require('./words');
const tanglish = require('./tanglish');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MAX_PLAYERS = 12;
const CHOOSE_MS = 15000;
const TURN_END_MS = 5000;
const TEST = !!process.env.KIRUKKAL_FAST; // shorter pauses for automated tests

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

// ---------- Tamil text helpers ----------
// Tamil letters are grapheme clusters (e.g. கி = க + ி). We must count/reveal whole clusters.
const segmenter = new Intl.Segmenter('ta', { granularity: 'grapheme' });
const graphemes = (s) => [...segmenter.segment(s)].map((x) => x.segment);
const norm = (s) => s.normalize('NFC').replace(/\s+/g, '').toLowerCase();

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// ---------- Rooms ----------
const rooms = new Map();
const rid = () => crypto.randomBytes(6).toString('hex');
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let code;
  do { code = Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); }
  while (rooms.has(code));
  return code;
}

const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const broadcast = (room, msg, exceptId) => {
  for (const p of room.players.values()) if (p.id !== exceptId) send(p.ws, msg);
};

function publicRoom(room) {
  return {
    code: room.code, state: room.state, hostId: room.hostId, settings: room.settings,
    round: room.round, drawerId: room.drawerId,
    wordLength: room.word ? graphemes(room.word).length : 0,
    players: [...room.players.values()].map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, score: p.score, guessed: p.guessed,
    })),
  };
}
const pushRoom = (room) => broadcast(room, { type: 'room', room: publicRoom(room) });

function hintFor(room, p) {
  const full = p.id === room.drawerId || p.guessed;
  const g = room.wordG;
  return {
    type: 'hint', full,
    hint: g.map((ch, i) => (full || room.revealed.has(i) || /\s/.test(ch) ? ch : '_')),
  };
}

function stopTimers(room) {
  clearTimeout(room.timer); clearInterval(room.ticker);
  room.timer = null; room.ticker = null;
}

function resetToLobby(room) {
  stopTimers(room);
  room.state = 'lobby'; room.round = 0; room.drawerId = null; room.word = null; room.wordG = [];
  room.queue = []; room.history = [];
  for (const p of room.players.values()) { p.score = 0; p.guessed = false; p.gain = 0; }
  pushRoom(room);
}

function startGame(room) {
  room.round = 0; room.queue = []; room.usedWords = new Set();
  for (const p of room.players.values()) { p.score = 0; p.guessed = false; p.gain = 0; }
  nextTurn(room);
}

function pickWords(room, n) {
  const pool = WORDS.filter((w) => !room.usedWords.has(w));
  const src = pool.length >= n ? pool : WORDS;
  const out = [];
  while (out.length < n) {
    const w = src[crypto.randomInt(src.length)];
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

function nextTurn(room) {
  stopTimers(room);
  room.queue = room.queue.filter((id) => room.players.has(id));
  if (!room.queue.length) {
    room.round++;
    if (room.round > room.settings.rounds) return endGame(room);
    room.queue = [...room.players.keys()];
  }
  room.drawerId = room.queue.shift();
  room.state = 'choosing';
  room.word = null; room.wordG = []; room.revealed = new Set(); room.history = [];
  room.guessCount = 0;
  for (const p of room.players.values()) { p.guessed = false; p.gain = 0; }
  const options = pickWords(room, 3);
  room.options = options;
  pushRoom(room);
  broadcast(room, { type: 'redraw', history: [] });
  const drawer = room.players.get(room.drawerId);
  send(drawer.ws, { type: 'choose_words', words: options, ms: CHOOSE_MS });
  room.timer = setTimeout(() => chooseWord(room, options[crypto.randomInt(options.length)]), TEST ? 300 : CHOOSE_MS);
}

function chooseWord(room, word) {
  if (room.state !== 'choosing' || !room.options.includes(word)) return;
  stopTimers(room);
  room.state = 'drawing';
  room.word = word; room.wordG = graphemes(word); room.usedWords.add(word);
  room.cands = tanglish.candidates(word); // accepted Roman-letter (Tanglish) skeletons
  const T = room.settings.drawTime;
  room.endsAt = Date.now() + T * 1000;
  pushRoom(room);
  for (const p of room.players.values()) send(p.ws, hintFor(room, p));
  broadcast(room, { type: 'tick', left: T });
  room.ticker = setInterval(() => tick(room), 1000);
}

function tick(room) {
  const T = room.settings.drawTime;
  const left = Math.max(0, Math.ceil((room.endsAt - Date.now()) / 1000));
  broadcast(room, { type: 'tick', left });
  // reveal hints at 55% and 25% of time left (long words only get the 2nd)
  const len = room.wordG.length;
  const due = (left <= T * 0.55 ? 1 : 0) + (left <= T * 0.25 && len >= 4 ? 1 : 0);
  let changed = false;
  while (room.revealed.size < Math.min(due, Math.floor(len / 2))) {
    const cand = room.wordG.map((_, i) => i).filter((i) => !room.revealed.has(i) && !/\s/.test(room.wordG[i]));
    if (!cand.length) break;
    room.revealed.add(cand[crypto.randomInt(cand.length)]);
    changed = true;
  }
  if (changed) for (const p of room.players.values()) send(p.ws, hintFor(room, p));
  if (left <= 0) endTurn(room);
}

function endTurn(room) {
  if (room.state !== 'drawing') return;
  stopTimers(room);
  room.state = 'turn_end';
  pushRoom(room);
  broadcast(room, {
    type: 'turn_end', word: room.word,
    gains: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, gain: p.gain })),
  });
  room.timer = setTimeout(() => nextTurn(room), TEST ? 300 : TURN_END_MS);
}

function endGame(room) {
  stopTimers(room);
  room.state = 'over'; room.drawerId = null; room.word = null;
  pushRoom(room);
}

function allGuessed(room) {
  const guessers = [...room.players.values()].filter((p) => p.id !== room.drawerId);
  return guessers.length > 0 && guessers.every((p) => p.guessed);
}

function handleGuess(room, p, text, raw) {
  const target = norm(room.word);
  const guess = norm(text);
  // Tamil script is compared letter-by-letter; Roman letters (Tanglish) are compared phonetically.
  const rank = { wrong: 0, close: 1, correct: 2 };
  let verdict = 'wrong';
  const consider = (v) => { if (rank[v] > rank[verdict]) verdict = v; };
  if (tanglish.hasTamil(text)) {
    const a = graphemes(guess), b = graphemes(target);
    consider(guess === target ? 'correct' : (b.length >= 3 && editDistance(a, b) === 1 ? 'close' : 'wrong'));
  } else if (tanglish.hasLatin(text)) {
    consider(tanglish.judge(text, room.cands));
  }
  // The client also sends the English letters the player actually typed (before live conversion to
  // Tamil), so a converter spelling quirk (e.g. த vs ட) can never cost them the point.
  if (raw && !tanglish.hasTamil(raw) && tanglish.hasLatin(raw)) consider(tanglish.judge(raw, room.cands));
  if (verdict === 'correct') {
    const T = room.settings.drawTime;
    const left = Math.max(0, (room.endsAt - Date.now()) / 1000);
    const pts = Math.max(50, Math.round(100 + 300 * (left / T) - room.guessCount * 25));
    room.guessCount++;
    p.guessed = true; p.score += pts; p.gain += pts;
    const drawer = room.players.get(room.drawerId);
    if (drawer) { const bonus = Math.round(pts / 2); drawer.score += bonus; drawer.gain += bonus; }
    broadcast(room, { type: 'system', kind: 'correct', name: p.name });
    pushRoom(room);
    send(p.ws, hintFor(room, p));
    if (allGuessed(room)) endTurn(room);
    return;
  }
  if (verdict === 'close') send(p.ws, { type: 'system', kind: 'close' });
  broadcast(room, { type: 'chat', id: p.id, name: p.name, avatar: p.avatar, text });
}

// ---------- Connections ----------
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);
const okColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

function joinRoom(ws, room, name, avatar) {
  if (room.players.size >= MAX_PLAYERS) return send(ws, { type: 'error', code: 'full' });
  const id = rid();
  const p = { id, ws, name, avatar: Number.isInteger(avatar) ? avatar : 0, score: 0, guessed: false, gain: 0 };
  room.players.set(id, p);
  ws.pid = id; ws.room = room;
  if (!room.hostId) room.hostId = id;
  send(ws, { type: 'welcome', id });
  pushRoom(room);
  broadcast(room, { type: 'system', kind: 'join', name }, id);
  if (room.state === 'drawing' || room.state === 'choosing') {
    send(ws, { type: 'redraw', history: room.history });
    if (room.state === 'drawing') {
      send(ws, hintFor(room, p));
      send(ws, { type: 'tick', left: Math.max(0, Math.ceil((room.endsAt - Date.now()) / 1000)) });
    }
  }
}

function leaveRoom(ws) {
  const room = ws.room; if (!room) return;
  const id = ws.pid;
  const p = room.players.get(id); if (!p) return;
  room.players.delete(id);
  ws.room = null;
  if (!room.players.size) { stopTimers(room); rooms.delete(room.code); return; }
  if (room.hostId === id) {
    room.hostId = room.players.keys().next().value;
    broadcast(room, { type: 'system', kind: 'host', name: room.players.get(room.hostId).name });
  }
  broadcast(room, { type: 'system', kind: 'leave', name: p.name });
  const inGame = ['choosing', 'drawing', 'turn_end'].includes(room.state);
  if (inGame && room.players.size < 2) return resetToLobby(room);
  if (room.drawerId === id) {
    if (room.state === 'drawing') { room.drawerId = null; endTurn(room); return; }
    if (room.state === 'choosing') { nextTurn(room); return; }
  }
  pushRoom(room);
  if (room.state === 'drawing' && allGuessed(room)) endTurn(room);
}

wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => {});
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.type !== 'string') return;
    const room = ws.room;

    if (!room) {
      if (m.type === 'create' || m.type === 'join') {
        const name = cleanName(m.name);
        if (!name) return send(ws, { type: 'error', code: 'name' });
        if (m.type === 'create') {
          const r = {
            code: newCode(), players: new Map(), hostId: null, state: 'lobby',
            settings: { rounds: 3, drawTime: 80 }, round: 0, drawerId: null,
            word: null, wordG: [], revealed: new Set(), queue: [], history: [], usedWords: new Set(),
            options: [], guessCount: 0,
          };
          rooms.set(r.code, r);
          joinRoom(ws, r, name, m.avatar);
        } else {
          const r = rooms.get(String(m.code || '').toUpperCase().trim());
          if (!r) return send(ws, { type: 'error', code: 'no_room' });
          joinRoom(ws, r, name, m.avatar);
        }
      }
      return;
    }

    const p = room.players.get(ws.pid); if (!p) return;
    const isDrawer = room.state === 'drawing' && room.drawerId === p.id;

    switch (m.type) {
      case 'settings': {
        if (p.id !== room.hostId || room.state !== 'lobby') return;
        const rounds = num(m.rounds, 1, 10), drawTime = num(m.drawTime, 20, 240);
        if (rounds) room.settings.rounds = Math.round(rounds);
        if (drawTime) room.settings.drawTime = Math.round(drawTime);
        pushRoom(room); break;
      }
      case 'start':
        if (p.id !== room.hostId || !['lobby', 'over'].includes(room.state)) return;
        if (room.players.size < 2) return send(ws, { type: 'error', code: 'need_players' });
        startGame(room); break;
      case 'lobby':
        if (p.id === room.hostId && room.state === 'over') resetToLobby(room);
        break;
      case 'choose':
        if (room.state === 'choosing' && room.drawerId === p.id && room.options[m.index]) chooseWord(room, room.options[m.index]);
        break;
      case 'chat': {
        const text = String(m.text || '').slice(0, 100).trim(); if (!text) return;
        const raw = typeof m.raw === 'string' ? m.raw.slice(0, 100).trim() : '';
        if (room.state === 'drawing' && p.id !== room.drawerId && !p.guessed) return handleGuess(room, p, text, raw);
        if (room.state === 'drawing' && (p.guessed || p.id === room.drawerId)) {
          // private channel so the answer can't leak
          for (const q of room.players.values())
            if (q.guessed || q.id === room.drawerId) send(q.ws, { type: 'chat', id: p.id, name: p.name, avatar: p.avatar, text, private: true });
          return;
        }
        broadcast(room, { type: 'chat', id: p.id, name: p.name, avatar: p.avatar, text });
        break;
      }
      case 'stroke_start': {
        if (!isDrawer || room.history.length > 600 || !okColor(m.c)) return;
        const w = num(m.w, 1, 60), x = num(m.x, 0, 800), y = num(m.y, 0, 600);
        if (w === null || x === null || y === null) return;
        room.history.push({ t: 's', c: m.c, w, p: [x, y] });
        broadcast(room, { type: 'draw', op: { t: 'ss', c: m.c, w, x, y } }, p.id); break;
      }
      case 'stroke_pts': {
        if (!isDrawer || !Array.isArray(m.p) || m.p.length > 200) return;
        const last = room.history[room.history.length - 1];
        if (!last || last.t !== 's' || last.p.length > 20000) return;
        const pts = m.p.map((v) => num(v, 0, 800)).filter((v) => v !== null);
        if (pts.length % 2) pts.pop();
        last.p.push(...pts);
        broadcast(room, { type: 'draw', op: { t: 'sp', p: pts } }, p.id); break;
      }
      case 'fill': {
        if (!isDrawer || room.history.length > 600 || !okColor(m.c)) return;
        const x = num(m.x, 0, 799), y = num(m.y, 0, 599);
        if (x === null || y === null) return;
        room.history.push({ t: 'f', x, y, c: m.c });
        broadcast(room, { type: 'draw', op: { t: 'f', x, y, c: m.c } }, p.id); break;
      }
      case 'undo':
        if (!isDrawer) return;
        room.history.pop();
        broadcast(room, { type: 'redraw', history: room.history }); break;
      case 'clear':
        if (!isDrawer) return;
        room.history = [];
        broadcast(room, { type: 'redraw', history: [] }); break;
    }
  });
});

// drop dead sockets (proxies often kill idle connections)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`கிறுக்கல் running on http://localhost:${PORT}`));
module.exports = { graphemes, norm };
