// கிறுக்கல் client
(() => {
  const $ = (s) => document.querySelector(s);
  const AVATARS = ['🐯', '🐘', '🦚', '🐒', '🐄', '🐓', '🦜', '🐍', '🐢', '🐟', '🦋', '🐱', '🐶', '🦁', '🐰', '🐻'];
  const COLORS = ['#ffffff', '#c1c1c1', '#6b6b6b', '#1f1f2e', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7',
    '#f9a8d4', '#fde68a', '#a16207', '#7c2d12', '#166534', '#0e7490', '#1e3a8a', '#6d28d9', '#be185d', '#fcd5b5', '#000000'];
  const SIZES = [3, 6, 12, 22];
  const W = 800, H = 600;

  // category clue shown to guessers (the drawer taps 💡)
  const clueText = (cat) => {
    const en = room && room.settings.lang === 'en';
    if (cat === 'movies') return 'a Tamil movie';
    if (cat === 'characters') return 'a Tamil movie character';
    return en ? 'a normal English word' : 'a Tamil word';
  };
  const TXT = {
    round: (r, n) => `Round ${r}/${n}`,
    drawing: (n) => `${n} is drawing…`,
    choosing: (n) => `${n} is choosing a word…`,
    yourWord: 'DRAW THIS',
    guessIt: 'GUESS THE WORD',
    youKnow: 'THE WORD',
    pick: 'Choose a word to draw',
    answer: 'The word was',
    over: 'Game over! 🏆',
    again: 'Play again',
    waitHost: 'Waiting for the host…',
    you: '(you)',
    typeHere: 'Type your guess…',
    drawingNow: "You're drawing!",
    sys: {
      join: (n) => `${n} joined 👋`,
      leave: (n) => `${n} left`,
      host: (n) => `${n} is now the host 👑`,
      kicked: (n) => `${n} was removed from the room`,
      like: (n) => `${n} liked the drawing 👍`,
      dislike: (n) => `${n} disliked the drawing 👎`,
      correct: (n) => `${n} guessed the word! 🎉`,
      close: () => 'So close! 🔥',
      clue: (n, cat) => `💡 Clue from ${n}: it's ${clueText(cat)}`,
    },
  };

  // English copy for the landing page and lobby (the in-game screen stays Tamil).
  const EN = {
    errors: {
      name: 'Please enter your name', name_taken: 'That name is already taken in this room. Pick another one.', no_room: 'Room not found', full: 'This room is full',
      need_players: 'Need at least 2 players to start', conn: 'Connection lost. Please try again.',
      banned: 'The host removed you from this room', kicked: 'The host removed you from the room',
    },
    host: 'Host', you: '(you)',
    waitHost: 'Waiting for the host to start the game…',
    needTwo: 'Need at least 2 players to start',
    rounds: (n) => `${n} round${n > 1 ? 's' : ''}`,
    secs: (n) => `${n} sec`,
    copied: 'Invite link copied!',
    langs: { ta: 'தமிழ் (Tamil)', en: 'English' },
    diffs: { mixed: 'Mixed', easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    cats: { words: '🍎 Everyday words', movies: '🎬 Tamil movies', characters: '🦸 Characters' },
    makeHost: '👑 Make host', kick: '🚫 Kick from room',
  };

  // ---------- state ----------
  let ws = null, myId = null, room = null, left = 0, hint = [], hintFull = false;
  let history = [];
  let tool = 'pen', color = '#1f1f2e', size = SIZES[1];
  let avatar = Number(localStorage.getItem('k_avatar') || 0) % AVATARS.length;
  let pendingWords = null;
  let lastState = null, timerMax = 0, myVote = 0;
  const J = window.Juice || { play() {}, confetti() {}, rain() {}, floatText() {}, fling() {}, shake() {}, playFile() {}, preload() {}, pick: (a) => a[0] };
  const wrapEl = document.querySelector('.canvas-wrap');
  const prevScores = new Map(), prevGuessed = new Set();
  const seg = new Intl.Segmenter('ta', { granularity: 'grapheme' });

  const ctx = $('#canvas').getContext('2d', { willReadFrequently: true });
  const canvas = $('#canvas');

  // ---------- helpers ----------
  const show = (id) => {
    for (const s of ['landing', 'lobby', 'game']) $('#screen-' + s).classList.toggle('hidden', s !== id);
    document.body.classList.toggle('in-game', id === 'game');
    setAppHeight(); keepAwake(id === 'game');
  };
  // Phones: size the game screen to the *visible* viewport so the on-screen keyboard never covers the guess box.
  function setAppHeight() {
    const vv = window.visualViewport, root = document.documentElement;
    root.style.setProperty('--app-h', (vv ? vv.height : window.innerHeight) + 'px');
    root.style.setProperty('--vv-top', (vv ? vv.offsetTop : 0) + 'px');
  }
  if (window.visualViewport) { visualViewport.addEventListener('resize', setAppHeight); visualViewport.addEventListener('scroll', setAppHeight); }
  window.addEventListener('resize', setAppHeight);
  window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 150));
  setAppHeight();
  // keep the screen on while playing
  let wakeLock = null, wantAwake = false;
  async function keepAwake(on) {
    wantAwake = on;
    try {
      if (on && !wakeLock && navigator.wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch { /* not allowed – ignore */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantAwake) keepAwake(true); });
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2200);
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const me = () => room && room.players.find((p) => p.id === myId);
  const isEn = () => !!room && room.settings.lang === 'en';
  const cid = (() => { try { let c = localStorage.getItem('k_cid'); if (!c) { c = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('k_cid', c); } return c; } catch { return ''; } })();
  const isDrawer = () => room && room.state === 'drawing' && room.drawerId === myId;

  // ---------- landing ----------
  const avBox = $('#avatars');
  AVATARS.forEach((a, i) => {
    const b = el('button', 'avatar-opt' + (i === avatar ? ' selected' : ''), a);
    b.type = 'button';
    b.onclick = () => {
      avatar = i; localStorage.setItem('k_avatar', i);
      avBox.querySelectorAll('.avatar-opt').forEach((x, j) => x.classList.toggle('selected', j === i));
    };
    avBox.appendChild(b);
  });
  $('#name').value = localStorage.getItem('k_name') || '';
  const urlCode = new URLSearchParams(location.search).get('room');
  if (urlCode) $('#code').value = urlCode.toUpperCase().slice(0, 4);

  function connect(first) {
    const name = $('#name').value.trim();
    if (!name) { $('#landing-error').textContent = EN.errors.name; $('#name').focus(); return; }
    localStorage.setItem('k_name', name);
    $('#landing-error').textContent = '';
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => send({ ...first, name, avatar, cid });
    ws.onmessage = (e) => onMsg(JSON.parse(e.data));
    ws.onclose = () => {
      if (room) { room = null; myId = null; show('landing'); $('#landing-error').textContent = EN.errors.conn; }
    };
  }
  $('#btn-create').onclick = () => connect({ type: 'create' });
  $('#btn-join').onclick = () => {
    const code = $('#code').value.trim();
    if (!code) { $('#landing-error').textContent = EN.errors.no_room; return; }
    connect({ type: 'join', code });
  };
  $('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });
  $('#name').addEventListener('keydown', (e) => { if (e.key === 'Enter') ($('#code').value ? $('#btn-join') : $('#btn-create')).click(); });

  // ---------- lobby ----------
  const selRounds = $('#set-rounds'), selTime = $('#set-time');
  [1, 2, 3, 4, 5, 6, 8, 10].forEach((n) => selRounds.add(new Option(EN.rounds(n), n)));
  [30, 45, 60, 80, 100, 120, 180].forEach((n) => selTime.add(new Option(EN.secs(n), n)));
  const selLang = $('#set-lang'), selDiff = $('#set-diff'), catsBox = $('#set-cats');
  Object.entries(EN.langs).forEach(([v, t]) => selLang.add(new Option(t, v)));
  Object.entries(EN.diffs).forEach(([v, t]) => selDiff.add(new Option(t, v)));
  Object.entries(EN.cats).forEach(([v, t]) => {
    const b = el('button', 'cat', t); b.type = 'button'; b.dataset.cat = v; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => {
      const on = b.getAttribute('aria-pressed') === 'true';
      if (on && catsBox.querySelectorAll('[aria-pressed="true"]').length === 1) return; // keep at least one
      b.setAttribute('aria-pressed', String(!on)); sendSettings();
    };
    catsBox.append(b);
  });
  const sendSettings = () => send({
    type: 'settings', rounds: +selRounds.value, drawTime: +selTime.value, lang: selLang.value, difficulty: selDiff.value,
    cats: [...catsBox.querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.cat),
  });
  for (const x of [selRounds, selTime, selLang, selDiff]) x.onchange = sendSettings;

  // host actions on a player (make host / kick)
  const menu = $('#player-menu');
  let menuTarget = null;
  function openMenu(p) {
    if (!room || room.hostId !== myId || p.id === myId) return;
    menuTarget = p.id;
    $('#pm-title').textContent = `${AVATARS[p.avatar] || '🙂'} ${p.name}`;
    menu.classList.remove('hidden');
  }
  const closeMenu = () => { menu.classList.add('hidden'); menuTarget = null; };
  $('#pm-cancel').onclick = closeMenu;
  menu.addEventListener('click', (e) => { if (e.target === menu) closeMenu(); });
  $('#pm-host').onclick = () => { if (menuTarget) send({ type: 'host', id: menuTarget }); closeMenu(); };
  $('#pm-kick').onclick = () => { if (menuTarget) send({ type: 'kick', id: menuTarget }); closeMenu(); };
  $('#btn-start').onclick = () => send({ type: 'start' });
  $('#btn-copy').onclick = async () => {
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
    toast(EN.copied);
  };

  function renderLobby() {
    $('#lobby-code').textContent = room.code;
    $('#lobby-count').textContent = room.players.length;
    const ul = $('#lobby-players'); ul.textContent = '';
    for (const p of room.players) {
      const li = el('li');
      li.append(el('span', 'av', AVATARS[p.avatar] || '🙂'), el('span', 'nm', p.name + (p.id === myId ? ' ' + EN.you : '')));
      if (p.id === room.hostId) li.append(el('span', 'badge', '👑 ' + EN.host));
      if (room.hostId === myId && p.id !== myId) {
        li.classList.add('tappable'); li.onclick = () => openMenu(p);
        li.append(el('span', 'more', '⋯'));
      }
      ul.append(li);
    }
    const host = room.hostId === myId;
    selRounds.value = room.settings.rounds; selTime.value = room.settings.drawTime;
    selLang.value = room.settings.lang; selDiff.value = room.settings.difficulty;
    catsBox.querySelectorAll('.cat').forEach((b) => b.setAttribute('aria-pressed', String(room.settings.cats.includes(b.dataset.cat))));
    selRounds.disabled = selTime.disabled = selLang.disabled = selDiff.disabled = !host;
    catsBox.classList.toggle('locked', !host);
    $('#btn-start').classList.toggle('hidden', !host);
    $('#btn-start').disabled = room.players.length < 2;
    $('#lobby-hint').textContent = !host ? EN.waitHost : room.players.length < 2 ? EN.needTwo : '';
  }

  // ---------- game UI ----------
  function renderPlayers() {
    const ul = $('#players'); ul.textContent = '';
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    sorted.forEach((p, i) => {
      const li = el('li', (p.guessed && !prevGuessed.has(p.id) ? 'hop ' : '') + (p.guessed ? 'guessed ' : '') + (p.id === room.drawerId ? 'drawing ' : '') + (room.hostId === myId && p.id !== myId ? 'tappable' : ''));
      li.dataset.id = p.id;
      if (room.hostId === myId && p.id !== myId) li.onclick = () => openMenu(p);
      const info = el('div', 'info');
      info.append(el('div', 'nm', (p.id === room.hostId ? '👑 ' : '') + p.name + (p.id === myId ? ' ' + TXT.you : '')), el('div', 'sc', p.score + ' pts'));
      li.append(el('span', 'rk', '#' + (i + 1)), el('span', 'av', AVATARS[p.avatar] || '🙂'), info);
      if (p.id === room.drawerId && room.state !== 'over') li.append(el('span', 'mark', '✏️'));
      else if (p.guessed) li.append(el('span', 'mark', '✅'));
      ul.append(li);
    });
    // floating "+120" over whoever just scored
    if (room.state === 'drawing' || room.state === 'turn_end') {
      for (const p of room.players) {
        const before = prevScores.get(p.id);
        if (before != null && p.score > before) { const li = ul.querySelector(`li[data-id="${p.id}"]`); J.floatText(li, '+' + (p.score - before), 'plus'); }
      }
    }
    prevScores.clear(); prevGuessed.clear();
    for (const p of room.players) { prevScores.set(p.id, p.score); if (p.guessed) prevGuessed.add(p.id); }
  }

  function renderClue() {
    const c = $('#clue'), on = !!room.clue && (room.state === 'drawing' || room.state === 'turn_end');
    c.classList.toggle('hidden', !on);
    c.textContent = on ? '💡 ' + clueText(room.clue).replace(/^a /, 'A ') : '';
    const b = $('#btn-clue'); b.disabled = !!room.clue; b.classList.toggle('used', !!room.clue);
  }
  function renderWord() {
    renderClue();
    const w = $('#word'), label = $('#word-label');
    w.textContent = ''; w.lang = isEn() ? 'en' : 'ta';
    const drawerName = (room.players.find((p) => p.id === room.drawerId) || {}).name || '';
    if (room.state === 'choosing') {
      label.textContent = ''; w.textContent = '…';
      return;
    }
    if (room.state !== 'drawing' && room.state !== 'turn_end') { label.textContent = ''; return; }
    if (!hint.length) return;
    label.textContent = isDrawer() ? TXT.yourWord : hintFull ? TXT.youKnow : TXT.guessIt;
    for (const g of hint) {
      if (/\s/.test(g)) { w.append(document.createTextNode('  ')); continue; }
      const s = el('span', 'g' + (g === '_' ? ' hid' : ''), g === '_' ? (isEn() ? 'W' : 'ம') : g);
      w.append(s);
    }
    if (!isDrawer() && !hintFull) w.append(el('span', 'len', `(${hint.filter((g) => !/\s/.test(g)).length})`));
    void drawerName;
  }

  function renderTimer() {
    const t = $('#timer');
    if (left > timerMax) timerMax = left;
    $('#timer-num').textContent = left;
    t.style.setProperty('--p', timerMax ? Math.max(0, Math.min(100, (left / timerMax) * 100)) : 100);
    t.classList.toggle('low', !!room && room.state === 'drawing' && left <= 10);
    wrapEl.classList.toggle('panic', !!room && room.state === 'drawing' && left <= 10 && left > 0);
  }

  function setOverlay(html, full) {
    const o = $('#overlay');
    o.classList.toggle('full', !!full);
    if (!html) { o.classList.add('hidden'); o.textContent = ''; return; }
    o.textContent = ''; o.append(html); o.classList.remove('hidden');
  }

  function renderVotes() {
    const v = $('#votes');
    const on = !!room && (room.state === 'drawing' || room.state === 'turn_end') && !!room.drawerId;
    v.classList.toggle('hidden', !on);
    if (!on) return;
    $('#up-n').textContent = room.up; $('#down-n').textContent = room.down;
    const mine = room.drawerId === myId;
    $('#vote-up').disabled = $('#vote-down').disabled = mine || myVote !== 0; // one final vote per drawing
    $('#vote-up').classList.toggle('on', myVote === 1); $('#vote-down').classList.toggle('on', myVote === -1);
  }
  const castVote = (v) => { if (myVote) return; myVote = v; send({ type: 'vote', v }); renderVotes(); };
  $('#vote-up').onclick = () => castVote(1);
  $('#vote-down').onclick = () => castVote(-1);

  function renderGame() {
    renderVotes();
    $('#round-chip').textContent = TXT.round(Math.min(room.round, room.settings.rounds), room.settings.rounds);
    renderPlayers(); renderWord(); renderTimer();
    tBtn.classList.toggle('hidden', isEn());
    const drawing = isDrawer();
    $('#toolbar').classList.toggle('hidden', !drawing);
    canvas.classList.toggle('drawable', drawing);
    document.body.classList.toggle('is-drawer', drawing);
    const input = $('#chat-input');
    input.disabled = drawing && !room.players.some((p) => p.guessed);
    input.placeholder = drawing ? TXT.drawingNow : guessPlaceholder();

    const drawerName = (room.players.find((p) => p.id === room.drawerId) || {}).name || '';
    if (room.state === 'choosing') {
      if (room.drawerId === myId && pendingWords) showChoose(pendingWords);
      else if (room.drawerId !== myId) {
        const box = el('div', 'ov-box'); box.append(el('h2', '', TXT.choosing(drawerName)));
        setOverlay(box);
      }
    } else if (room.state === 'drawing') {
      setOverlay(null);
    } else if (room.state === 'over') {
      showGameOver();
    }
  }

  function showChoose(words) {
    const box = el('div', 'ov-box');
    box.append(el('h2', '', TXT.pick));
    const c = el('div', 'choices');
    words.forEach((w, i) => {
      const b = el('button', 'choice', w);
      b.onclick = () => { send({ type: 'choose', index: i }); pendingWords = null; setOverlay(null); };
      c.append(b);
    });
    box.append(c);
    setOverlay(box);
  }

  function showTurnEnd(m) {
    const box = el('div', 'ov-box');
    const big = el('div', 'big');
    [...seg.segment(m.word)].forEach((x, i) => { const sp = el('span', 'ltr', x.segment); sp.style.setProperty('--i', i); big.append(sp); });
    box.append(el('div', '', TXT.answer), big);
    const got = m.gains.some((g) => g.gain > 0 && g.id !== room.drawerId);
    J.play(got ? 'end' : 'sad');
    const ul = el('ul', 'gains');
    for (const g of [...m.gains].sort((a, b) => b.gain - a.gain)) {
      const li = el('li');
      li.append(el('span', '', `${AVATARS[g.avatar] || ''} ${g.name}`), el('span', g.gain ? 'plus' : '', g.gain ? '+' + g.gain : '0'));
      ul.append(li);
    }
    box.append(ul);
    setOverlay(box);
  }

  function showGameOver() {
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const box = el('div', 'ov-box over');
    box.append(el('h2', '', TXT.over));
    const pod = el('div', 'podium');
    const order = [sorted[1], sorted[0], sorted[2]];
    const cls = ['p2', 'p1', 'p3'], medal = ['🥈', '🥇', '🥉'];
    order.forEach((p, i) => {
      if (!p) return;
      const st = el('div', 'step ' + cls[i]);
      if (i === 1) st.classList.add('champ');
      st.append(el('div', 'medal', medal[i]), el('div', 'av', AVATARS[p.avatar] || ''), el('div', 'nm', p.name), el('div', 'pts', p.score));
      pod.append(st);
    });
    box.append(pod);
    if (sorted.length > 3) {
      const ul = el('ul', 'rank-list');
      sorted.slice(3).forEach((p, i) => {
        const li = el('li');
        li.append(el('span', 'rk', '#' + (i + 4)), el('span', 'av', AVATARS[p.avatar] || ''), el('span', 'nm', p.name), el('span', 'pts', p.score));
        ul.append(li);
      });
      box.append(ul);
    }
    if (room.hostId === myId) {
      const b = el('button', 'btn btn-primary', TXT.again);
      b.onclick = () => send({ type: 'lobby' });
      box.append(b);
    } else box.append(el('div', 'rest', TXT.waitHost));
    setOverlay(box, true);
  }

  // ---------- chat ----------
  function addChat(cls, parts) {
    const chat = $('#chat');
    const d = el('div', 'msg ' + cls);
    parts.forEach((p) => d.append(p));
    chat.append(d);
    while (chat.children.length > 120) chat.firstChild.remove();
    chat.scrollTop = chat.scrollHeight;
  }
  // Live Tanglish -> Tamil: the box shows Tamil while English letters are typed (maram -> மரம்).
  // The raw English letters are sent along, so the server can still judge phonetically.
  const chatInput = $('#chat-input');
  const tBtn = $('#btn-translit');
  const tState = { raw: '', shown: '' };
  let tOn = localStorage.getItem('k_translit') !== '0';

  const useTr = () => tOn && !isEn();
  function guessPlaceholder() { return useTr() ? 'Type e.g. maram → மரம்' : TXT.typeHere; }
  function paintToggle() {
    tBtn.textContent = tOn ? 'த' : 'A';
    tBtn.setAttribute('aria-pressed', String(tOn));
    tBtn.title = tOn ? 'English letters turn into Tamil as you type. Click for plain English.'
      : 'Plain English typing. Click to turn English letters into Tamil.';
    if (room && !chatInput.disabled && !isDrawer()) chatInput.placeholder = guessPlaceholder();
  }
  function syncInput() {
    Translit.sync(tState, chatInput.value);
    if (chatInput.value !== tState.shown) chatInput.value = tState.shown;
    const end = chatInput.value.length;
    chatInput.setSelectionRange(end, end);
  }
  chatInput.addEventListener('input', (e) => { if (useTr() && !e.isComposing) syncInput(); });
  chatInput.addEventListener('compositionend', () => { if (useTr()) syncInput(); });
  tBtn.onclick = () => {
    tOn = !tOn;
    try { localStorage.setItem('k_translit', tOn ? '1' : '0'); } catch { /* ignore */ }
    tState.raw = chatInput.value;
    tState.shown = tOn ? Translit.convert(chatInput.value) : chatInput.value;
    if (tOn) chatInput.value = tState.shown;
    paintToggle(); chatInput.focus();
  };
  paintToggle();

  // tapping Send / the toggle must not steal focus, or the phone keyboard closes after every guess
  for (const b of [$('.btn-send'), tBtn]) b.addEventListener('pointerdown', (e) => e.preventDefault());
  chatInput.addEventListener('focus', () => { document.body.classList.add('typing'); setTimeout(() => window.scrollTo(0, 0), 60); });
  chatInput.addEventListener('blur', () => document.body.classList.remove('typing'));

  $('#chat-form').onsubmit = (e) => {
    e.preventDefault();
    const t = chatInput.value.trim();
    if (t) {
      const msg = { type: 'chat', text: t };
      if (useTr() && tState.raw && tState.raw !== t) msg.raw = tState.raw;
      send(msg);
    }
    chatInput.value = ''; tState.raw = ''; tState.shown = '';
  };

  // ---------- canvas ----------
  function clearCanvas() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
  function strokePath(s) {
    ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const p = s.p;
    if (p.length <= 2) { ctx.beginPath(); ctx.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2); ctx.fill(); return; }
    ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  }
  function segment(c, w, x1, y1, x2, y2) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function floodFill(x, y, hex) {
    x = Math.floor(x); y = Math.floor(y);
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    const i0 = (y * W + x) * 4;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    const [fr, fg, fb] = hexRgb(hex);
    if (Math.abs(tr - fr) < 4 && Math.abs(tg - fg) < 4 && Math.abs(tb - fb) < 4) return;
    const TOL = 40;
    const near = (i) => Math.abs(d[i] - tr) <= TOL && Math.abs(d[i + 1] - tg) <= TOL && Math.abs(d[i + 2] - tb) <= TOL;
    const seen = new Uint8Array(W * H);
    const stack = [x, y];
    while (stack.length) {
      let cy = stack.pop(), cx = stack.pop();
      let idx = cy * W + cx;
      while (cx >= 0 && !seen[idx] && near(idx * 4)) { cx--; idx--; }
      cx++; idx++;
      let up = false, down = false;
      while (cx < W && !seen[idx] && near(idx * 4)) {
        seen[idx] = 1;
        const o = idx * 4; d[o] = fr; d[o + 1] = fg; d[o + 2] = fb; d[o + 3] = 255;
        if (cy > 0) { const ok = !seen[idx - W] && near((idx - W) * 4); if (ok && !up) { stack.push(cx, cy - 1); up = true; } else if (!ok) up = false; }
        if (cy < H - 1) { const ok = !seen[idx + W] && near((idx + W) * 4); if (ok && !down) { stack.push(cx, cy + 1); down = true; } else if (!ok) down = false; }
        cx++; idx++;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function redraw() {
    clearCanvas();
    for (const op of history) {
      if (op.t === 's') strokePath(op);
      else if (op.t === 'f') floodFill(op.x, op.y, op.c);
    }
  }
  // remote ops
  let remoteStroke = null;
  function applyOp(op) {
    if (op.t === 'ss') {
      remoteStroke = { t: 's', c: op.c, w: op.w, p: [op.x, op.y] };
      history.push(remoteStroke);
      strokePath(remoteStroke);
    } else if (op.t === 'sp' && remoteStroke) {
      let px = remoteStroke.p[remoteStroke.p.length - 2], py = remoteStroke.p[remoteStroke.p.length - 1];
      for (let i = 0; i < op.p.length; i += 2) {
        segment(remoteStroke.c, remoteStroke.w, px, py, op.p[i], op.p[i + 1]);
        px = op.p[i]; py = op.p[i + 1];
      }
      remoteStroke.p.push(...op.p);
    } else if (op.t === 'f') {
      history.push(op); floodFill(op.x, op.y, op.c);
    }
  }

  // local drawing
  let drawing = false, buf = [], flushT = null, last = null;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * W * 10) / 10, Math.round(((e.clientY - r.top) / r.height) * H * 10) / 10];
  };
  const curColor = () => (tool === 'eraser' ? '#ffffff' : color);
  function flush() {
    if (buf.length) { send({ type: 'stroke_pts', p: buf.slice(0, 200) }); buf = buf.slice(200); }
    if (buf.length) flush();
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!isDrawer() || drawing) return;
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    e.preventDefault();
    const [x, y] = pos(e);
    if (tool === 'fill') {
      const op = { t: 'f', x: Math.min(x, W - 1), y: Math.min(y, H - 1), c: color };
      history.push(op); floodFill(op.x, op.y, op.c);
      send({ type: 'fill', x: op.x, y: op.y, c: op.c });
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    drawing = true; last = [x, y]; buf = [];
    const s = { t: 's', c: curColor(), w: size, p: [x, y] };
    history.push(s); strokePath(s);
    send({ type: 'stroke_start', c: s.c, w: s.w, x, y });
    flushT = setInterval(flush, 40);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const s = history[history.length - 1];
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of evs.length ? evs : [e]) {
      const [x, y] = pos(ev);
      segment(s.c, s.w, last[0], last[1], x, y);
      s.p.push(x, y); buf.push(x, y); last = [x, y];
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const endDraw = () => {
    if (!drawing) return;
    drawing = false; clearInterval(flushT); flush();
  };
  canvas.addEventListener('pointerup', endDraw);
  canvas.addEventListener('pointercancel', endDraw);

  // toolbar
  const pal = $('#palette');
  COLORS.forEach((c) => {
    const b = el('button', 'swatch' + (c === color ? ' active' : '')); b.style.background = c; b.setAttribute('aria-label', c);
    b.onclick = () => {
      color = c; if (tool === 'eraser') setTool('pen');
      pal.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === b));
    };
    pal.append(b);
  });
  const sizesBox = $('#sizes');
  SIZES.forEach((s) => {
    const b = el('button', 'size-btn' + (s === size ? ' active' : '')); const i = el('i');
    i.style.width = i.style.height = Math.min(26, s + 4) + 'px'; b.append(i);
    b.onclick = () => { size = s; sizesBox.querySelectorAll('.size-btn').forEach((x) => x.classList.toggle('active', x === b)); };
    sizesBox.append(b);
  });
  function setTool(t) {
    tool = t;
    $('#tools').querySelectorAll('.tool').forEach((x) => x.classList.toggle('active', x.dataset.tool === t));
  }
  $('#tools').querySelectorAll('.tool').forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
  $('#btn-undo').onclick = () => { if (!isDrawer()) return; history.pop(); redraw(); send({ type: 'undo' }); };
  $('#btn-clue').onclick = () => { if (isDrawer() && !room.clue) send({ type: 'clue' }); };
  $('#btn-clear').onclick = () => { if (!isDrawer()) return; history = []; redraw(); send({ type: 'clear' }); };
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && isDrawer()) { e.preventDefault(); $('#btn-undo').click(); }
  });

  // ---------- quick dialogues (configured in dialogues.json on the server) ----------
  let dialogues = [], quickCooldown = 2000, quickReadyAt = 0;
  const quickBtn = $('#btn-quick'), quickPanel = $('#quick-panel'), quickList = $('#quick-list');
  async function loadDialogues() {
    try {
      const r = await fetch('/api/dialogues', { cache: 'no-store' }); if (!r.ok) return;
      const d = await r.json();
      dialogues = Array.isArray(d.dialogues) ? d.dialogues : []; quickCooldown = d.cooldownMs || 2000;
      for (const q of dialogues) if (q.sound) J.preload('/' + q.sound);
    } catch { /* offline: no quick chat */ }
    paintQuick();
  }
  function paintQuick() {
    quickBtn.classList.toggle('hidden', !dialogues.length || !room || room.state === 'lobby');
    quickList.textContent = '';
    if (!dialogues.length) { quickList.append(el('div', 'quick-empty', 'No dialogues yet')); return; }
    for (const q of dialogues) {
      const b = el('button', 'quick-item'); b.type = 'button';
      b.append(el('span', 'qe', q.emoji || '🎬'), el('span', 'qt', q.text));
      if (q.sound) b.append(el('span', 'qs', '🔊'));
      b.onclick = () => fireQuick(q);
      quickList.append(b);
    }
  }
  function fireQuick(q) {
    if (Date.now() < quickReadyAt) { toast('Easy da — wait a moment'); return; }
    quickReadyAt = Date.now() + quickCooldown;
    send({ type: 'quick', id: q.id });
    closeQuick();
  }
  const openQuick = () => { if (!dialogues.length) return; quickPanel.classList.remove('hidden'); };
  const closeQuick = () => quickPanel.classList.add('hidden');
  quickBtn.onclick = openQuick;
  $('#quick-close').onclick = closeQuick;
  quickPanel.addEventListener('click', (e) => { if (e.target === quickPanel) closeQuick(); });
  // keep the keyboard / input focus when tapping the button
  quickBtn.addEventListener('pointerdown', (e) => e.preventDefault());
  let capT = 0;
  function showQuick(m) {
    const q = dialogues.find((x) => x.id === m.id); if (!q) return;
    addChat('quick', [el('b', '', (AVATARS[m.avatar] || '') + ' ' + m.name), el('span', 'qline', (q.emoji || '🎬') + ' ' + q.text)]);
    const cap = $('#caption'); cap.textContent = '';
    cap.append(el('span', 'cn', (AVATARS[m.avatar] || '') + ' ' + m.name), el('span', 'cl', (q.emoji || '🎬') + ' ' + q.text));
    cap.classList.remove('hidden', 'show'); void cap.offsetWidth; cap.classList.add('show');
    clearTimeout(capT); capT = setTimeout(() => cap.classList.add('hidden'), 3000);
    if (q.sound) J.playFile('/' + q.sound);
  }

  // ---------- juice ----------
  function sysFx(m) {
    switch (m.kind) {
      case 'correct':
        if (me() && me().name === m.name) { J.play('win'); J.confetti(wrapEl, 70, '⭐'); }
        else J.play('ding');
        break;
      case 'close': J.play('close'); J.shake(chatInput); break;
      case 'like': J.play('like'); J.fling('like', wrapEl); break;
      case 'dislike': if (isDrawer()) J.play('sad'); break;
      case 'join': J.play('join'); break;
      case 'leave': J.play('leave'); break;
      case 'kicked': J.play('boing'); break;
      case 'host': J.play('ding'); break;
      case 'clue': J.play('ding'); break;
    }
  }
  function onState(prev) {
    if (room.state === 'choosing' && room.drawerId === myId) J.play('whoosh');
    else if (room.state === 'drawing') J.play('start');
    else if (room.state === 'over') { J.play('fanfare'); J.rain(4000, '🎉'); }
  }
  // every button gets a little click
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b && !b.classList.contains('snd') && !b.classList.contains('vote')) J.play('click'); });

  // ---------- messages ----------
  function onMsg(m) {
    switch (m.type) {
      case 'welcome': myId = m.id; loadDialogues(); break;
      case 'quick': showQuick(m); break;
      case 'kicked':
        room = null; myId = null; lastState = null; closeMenu(); closeQuick();
        if (ws) ws.close();
        show('landing'); $('#landing-error').textContent = EN.errors.kicked; break;
      case 'room': {
        const prev = lastState;
        room = m.room; lastState = room.state;
        if (room.state !== prev) { onState(prev); paintQuick(); }
        if (menuTarget && (room.hostId !== myId || !room.players.some((q) => q.id === menuTarget))) closeMenu();
        if (room.state !== prev) timerMax = 0;
        if (room.state === 'lobby') { show('lobby'); renderLobby(); setOverlay(null); hint = []; }
        else {
          show('game');
          if (prev === 'lobby' || prev === 'over' || prev == null) $('#chat').textContent = '';
          if (room.state === 'choosing') { hint = []; hintFull = false; myVote = 0; if (room.drawerId !== myId) pendingWords = null; }
          if (room.state !== 'turn_end') renderGame();
          else { renderPlayers(); renderWord(); renderVotes(); $('#toolbar').classList.add('hidden'); canvas.classList.remove('drawable'); }
        }
        break;
      }
      case 'tick':
        left = m.left; if (room) renderTimer();
        if (room && room.state === 'drawing' && left > 0 && left <= 5) J.play('tick');
        break;
      case 'choose_words':
        pendingWords = m.words;
        if (room && room.state === 'choosing') showChoose(m.words);
        break;
      case 'hint': hint = m.hint; hintFull = m.full; if (room) renderWord(); break;
      case 'draw': applyOp(m.op); break;
      case 'redraw': history = m.history; redraw(); break;
      case 'turn_end': showTurnEnd(m); break;
      case 'chat': {
        const parts = [el('b', '', (AVATARS[m.avatar] || '') + ' ' + m.name), document.createTextNode(m.text)];
        addChat(m.private ? 'priv' : '', parts); break;
      }
      case 'system': {
        const f = TXT.sys[m.kind]; if (!f) break;
        addChat(m.kind === 'clue' ? 'cluemsg' : m.kind === 'correct' ? 'good' : m.kind === 'close' ? 'warn' : m.kind === 'like' ? 'like' : m.kind === 'dislike' ? 'dislike' : 'sys', [document.createTextNode(f(m.name, m.cat))]);
        sysFx(m);
        break;
      }
      case 'error': {
        const msg = EN.errors[m.code] || m.code;
        if (room) { $('#lobby-error').textContent = msg; toast(msg); } else { $('#landing-error').textContent = msg; if (ws) ws.close(); }
        break;
      }
    }
  }

  clearCanvas();
  show('landing');
})();
