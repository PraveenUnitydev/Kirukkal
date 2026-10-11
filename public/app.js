// கிறுக்கல் client
(() => {
  const $ = (s) => document.querySelector(s);
  const AVATARS = ['🐯', '🐘', '🦚', '🐒', '🐄', '🐓', '🦜', '🐍', '🐢', '🐟', '🦋', '🐱', '🐶', '🦁', '🐰', '🐻'];
  const COLORS = ['#ffffff', '#c1c1c1', '#6b6b6b', '#1f1f2e', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7',
    '#f9a8d4', '#fde68a', '#a16207', '#7c2d12', '#166534', '#0e7490', '#1e3a8a', '#6d28d9', '#be185d', '#fcd5b5', '#000000'];
  const SIZES = [3, 6, 12, 22];
  const W = 800, H = 600;

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
      host: (n) => `${n} is now the host`,
      correct: (n) => `${n} guessed the word! 🎉`,
      close: () => 'So close! 🔥',
    },
  };

  // English copy for the landing page and lobby (the in-game screen stays Tamil).
  const EN = {
    errors: {
      name: 'Please enter your name', no_room: 'Room not found', full: 'This room is full',
      need_players: 'Need at least 2 players to start', conn: 'Connection lost. Please try again.',
    },
    host: 'Host', you: '(you)',
    waitHost: 'Waiting for the host to start the game…',
    needTwo: 'Need at least 2 players to start',
    rounds: (n) => `${n} round${n > 1 ? 's' : ''}`,
    secs: (n) => `${n} sec`,
    copied: 'Invite link copied!',
  };

  // ---------- state ----------
  let ws = null, myId = null, room = null, left = 0, hint = [], hintFull = false;
  let history = [];
  let tool = 'pen', color = '#1f1f2e', size = SIZES[1];
  let avatar = Number(localStorage.getItem('k_avatar') || 0) % AVATARS.length;
  let pendingWords = null;
  let lastState = null, timerMax = 0;

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
    ws.onopen = () => send({ ...first, name, avatar });
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
  const sendSettings = () => send({ type: 'settings', rounds: +selRounds.value, drawTime: +selTime.value });
  selRounds.onchange = sendSettings; selTime.onchange = sendSettings;
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
      if (p.id === room.hostId) li.append(el('span', 'badge', EN.host));
      ul.append(li);
    }
    const host = room.hostId === myId;
    selRounds.value = room.settings.rounds; selTime.value = room.settings.drawTime;
    selRounds.disabled = selTime.disabled = !host;
    $('#btn-start').classList.toggle('hidden', !host);
    $('#btn-start').disabled = room.players.length < 2;
    $('#lobby-hint').textContent = !host ? EN.waitHost : room.players.length < 2 ? EN.needTwo : '';
  }

  // ---------- game UI ----------
  function renderPlayers() {
    const ul = $('#players'); ul.textContent = '';
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    sorted.forEach((p, i) => {
      const li = el('li', (p.guessed ? 'guessed ' : '') + (p.id === room.drawerId ? 'drawing' : ''));
      const info = el('div', 'info');
      info.append(el('div', 'nm', p.name + (p.id === myId ? ' ' + TXT.you : '')), el('div', 'sc', p.score + ' pts'));
      li.append(el('span', 'rk', '#' + (i + 1)), el('span', 'av', AVATARS[p.avatar] || '🙂'), info);
      if (p.id === room.drawerId && room.state !== 'over') li.append(el('span', 'mark', '✏️'));
      else if (p.guessed) li.append(el('span', 'mark', '✅'));
      ul.append(li);
    });
  }

  function renderWord() {
    const w = $('#word'), label = $('#word-label');
    w.textContent = '';
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
      const s = el('span', 'g' + (g === '_' ? ' hid' : ''), g === '_' ? 'ம' : g);
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
  }

  function setOverlay(html, full) {
    const o = $('#overlay');
    o.classList.toggle('full', !!full);
    if (!html) { o.classList.add('hidden'); o.textContent = ''; return; }
    o.textContent = ''; o.append(html); o.classList.remove('hidden');
  }

  function renderGame() {
    $('#round-chip').textContent = TXT.round(Math.min(room.round, room.settings.rounds), room.settings.rounds);
    renderPlayers(); renderWord(); renderTimer();
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
        const box = el('div'); box.append(el('h2', '', TXT.choosing(drawerName)));
        setOverlay(box);
      }
    } else if (room.state === 'drawing') {
      setOverlay(null);
    } else if (room.state === 'over') {
      showGameOver();
    }
  }

  function showChoose(words) {
    const box = el('div');
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
    const box = el('div');
    box.append(el('div', '', TXT.answer), el('div', 'big', m.word));
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
    const box = el('div');
    box.append(el('h2', '', TXT.over));
    const pod = el('div', 'podium');
    const order = [sorted[1], sorted[0], sorted[2]];
    const cls = ['p2', 'p1', 'p3'], medal = ['🥈', '🥇', '🥉'];
    order.forEach((p, i) => {
      if (!p) return;
      const s = el('div', 'step ' + cls[i]);
      s.append(el('div', '', medal[i]), el('div', 'av', AVATARS[p.avatar] || ''), el('div', 'nm', p.name), el('div', '', p.score));
      pod.append(s);
    });
    box.append(pod);
    if (sorted.length > 3) box.append(el('div', 'rest', sorted.slice(3).map((p) => `${p.name} ${p.score}`).join(' · ')));
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

  function guessPlaceholder() { return tOn ? 'Type e.g. maram → மரம்' : TXT.typeHere; }
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
  chatInput.addEventListener('input', (e) => { if (tOn && !e.isComposing) syncInput(); });
  chatInput.addEventListener('compositionend', () => { if (tOn) syncInput(); });
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
      if (tOn && tState.raw && tState.raw !== t) msg.raw = tState.raw;
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
  $('#btn-clear').onclick = () => { if (!isDrawer()) return; history = []; redraw(); send({ type: 'clear' }); };
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && isDrawer()) { e.preventDefault(); $('#btn-undo').click(); }
  });

  // ---------- messages ----------
  function onMsg(m) {
    switch (m.type) {
      case 'welcome': myId = m.id; break;
      case 'room': {
        const prev = lastState;
        room = m.room; lastState = room.state;
        if (room.state !== prev) timerMax = 0;
        if (room.state === 'lobby') { show('lobby'); renderLobby(); setOverlay(null); hint = []; }
        else {
          show('game');
          if (prev === 'lobby' || prev === 'over' || prev == null) $('#chat').textContent = '';
          if (room.state === 'choosing') { hint = []; hintFull = false; if (room.drawerId !== myId) pendingWords = null; }
          if (room.state !== 'turn_end') renderGame();
          else { renderPlayers(); renderWord(); $('#toolbar').classList.add('hidden'); canvas.classList.remove('drawable'); }
        }
        break;
      }
      case 'tick': left = m.left; if (room) renderTimer(); break;
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
        addChat(m.kind === 'correct' ? 'good' : m.kind === 'close' ? 'warn' : 'sys', [document.createTextNode(f(m.name))]);
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
