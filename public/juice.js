// Game juice: synthesised sound effects (no audio files) + confetti, flying emoji and a chaotic mascot.
(() => {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem('k_sound') === '0'; } catch { /* ignore */ }

  // ---------------- sound ----------------
  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // phones only allow audio after a tap, so unlock on the first touch / click
  addEventListener('pointerdown', () => { if (!muted) ac(); }, { passive: true });

  function tone(f, d, o = {}) {
    if (muted) return; const c = ac(); if (!c) return;
    const t = c.currentTime + (o.at || 0), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.5, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    if (o.vib) {
      const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = f * 0.04;
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + d + 0.05);
    }
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + d + 0.05);
  }
  function noise(d, o = {}) {
    if (muted) return; const c = ac(); if (!c) return;
    const t = c.currentTime + (o.at || 0), n = Math.max(1, Math.floor(c.sampleRate * d)), buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.freq || 800, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + d);
    const g = c.createGain(); g.gain.setValueAtTime(o.vol || 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  const notes = (list, o = {}) => list.forEach((f, i) => tone(f, o.d || 0.14, { type: o.type || 'triangle', vol: o.vol || 0.45, at: i * (o.gap || 0.09) }));
  const C5 = 523, E5 = 659, G5 = 784, C6 = 1047, E6 = 1319;

  const SFX = {
    click: () => tone(520, 0.06, { type: 'triangle', to: 780, vol: 0.3 }),
    join: () => notes([660, 880], { d: 0.1, gap: 0.07, type: 'sine', vol: 0.3 }),
    leave: () => tone(440, 0.18, { type: 'sine', to: 260, vol: 0.25 }),
    whoosh: () => noise(0.35, { freq: 300, to: 3500, vol: 0.35, type: 'bandpass' }),
    start: () => notes([G5, C6], { d: 0.12, gap: 0.08 }),
    ding: () => tone(1175, 0.35, { type: 'sine', vol: 0.3 }),
    win: () => notes([C5, E5, G5, C6, E6], { d: 0.16, gap: 0.07, vol: 0.4 }),
    close: () => { tone(330, 0.16, { type: 'square', to: 200, vol: 0.18 }); tone(300, 0.2, { type: 'square', to: 170, vol: 0.18, at: 0.17 }); },
    tick: () => tone(1500, 0.04, { type: 'square', vol: 0.12 }),
    like: () => { tone(500, 0.12, { type: 'sine', to: 950, vol: 0.35 }); tone(1250, 0.12, { type: 'sine', vol: 0.2, at: 0.1 }); },
    // sad trombone: wah wah wah waaaah
    sad: () => [[392, 0.28], [370, 0.28], [349, 0.28], [311, 0.8]].forEach(([f, d], i) => tone(f, d, { type: 'sawtooth', vol: 0.22, at: i * 0.32, vib: i === 3 ? 7 : 0, to: i === 3 ? 262 : null })),
    splat: () => { noise(0.22, { freq: 1200, to: 120, vol: 0.55 }); tone(140, 0.14, { type: 'sine', to: 55, vol: 0.5 }); },
    boing: () => tone(180, 0.55, { type: 'sine', to: 700, vol: 0.4, vib: 22 }),
    end: () => notes([G5, E5], { d: 0.14, gap: 0.12, type: 'sine', vol: 0.35 }),
    fanfare: () => { notes([C5, C5, C5, G5], { d: 0.16, gap: 0.14, type: 'square', vol: 0.18 }); [C5, E5, G5, C6].forEach((f) => tone(f, 0.9, { type: 'triangle', vol: 0.22, at: 0.62 })); },
  };
  function play(name) { const f = SFX[name]; if (f && !muted) { try { f(); } catch { /* audio blocked */ } } }

  // ---------------- effects ----------------
  const fx = document.getElementById('fx');
  const fctx = fx ? fx.getContext('2d') : null;
  let parts = [], raf = 0, rainUntil = 0;
  function fit() { if (fx) { fx.width = innerWidth; fx.height = innerHeight; } }
  addEventListener('resize', fit); fit();
  const COLORS = ['#ff7a1a', '#6c4df5', '#e0457b', '#facc15', '#22c55e', '#06b6d4'];
  function spawn(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2), v = (o.speed ?? 9) * (0.4 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 4 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: COLORS[(Math.random() * COLORS.length) | 0], life: 90 + Math.random() * 50, e: o.emoji && Math.random() < 0.35 ? o.emoji : null });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop() {
    fctx.clearRect(0, 0, fx.width, fx.height);
    if (rainUntil > performance.now()) spawn(Math.random() * fx.width, -10, 3, { angle: Math.PI / 2, spread: 0.6, speed: 3 });
    parts = parts.filter((p) => p.life > 0 && p.y < fx.height + 30);
    for (const p of parts) {
      p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
      fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot); fctx.globalAlpha = Math.min(1, p.life / 25);
      if (p.e) { fctx.font = '22px serif'; fctx.fillText(p.e, -11, 8); } else { fctx.fillStyle = p.c; fctx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.66); }
      fctx.restore();
    }
    raf = parts.length || rainUntil > performance.now() ? requestAnimationFrame(loop) : 0;
    if (!raf) fctx.clearRect(0, 0, fx.width, fx.height);
  }
  const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r]; };
  function confetti(el, n = 60, emoji) { if (reduce || !fctx) return; const [x, y] = el ? center(el) : [innerWidth / 2, innerHeight / 2]; spawn(x, y, n, { emoji }); }
  function rain(ms = 3500, emoji) { if (reduce || !fctx) return; rainUntil = performance.now() + ms; spawn(innerWidth / 2, -10, 1, { emoji }); }

  function floatText(el, text, cls = '') {
    if (reduce || !el) return;
    const [x, y] = center(el), d = document.createElement('div');
    d.className = 'floaty ' + cls; d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px';
    document.body.append(d);
    d.animate([{ transform: 'translate(-50%,0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-18px) scale(1.25)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%,-70px) scale(1)', opacity: 0 }], { duration: 1300, easing: 'ease-out' }).onfinish = () => d.remove();
  }

  // 👍 float up from the corner, 🍅 get thrown at the drawing and splat
  function fling(kind, wrap) {
    if (reduce || !wrap) return;
    const r = wrap.getBoundingClientRect();
    if (kind === 'like') {
      for (let i = 0; i < 4; i++) {
        const e = document.createElement('div'); e.className = 'flyer'; e.textContent = ['👍', '❤️', '⭐', '🔥'][(Math.random() * 4) | 0];
        e.style.left = r.right - 50 - Math.random() * 90 + 'px'; e.style.top = r.bottom - 30 + 'px'; document.body.append(e);
        const dx = (Math.random() - 0.5) * 80;
        e.animate([{ transform: 'translate(0,0) scale(.5)', opacity: 0 }, { transform: `translate(${dx / 2}px,-40px) scale(1.2)`, opacity: 1, offset: 0.2 },
          { transform: `translate(${dx}px,-${r.height * 0.8}px) scale(1)`, opacity: 0 }], { duration: 1400 + Math.random() * 500, delay: i * 90, easing: 'ease-out', fill: 'backwards' }).onfinish = () => e.remove();
      }
    } else {
      const e = document.createElement('div'); e.className = 'flyer big'; e.textContent = Math.random() < 0.8 ? '🍅' : '🥚';
      const fromLeft = Math.random() < 0.5, tx = r.left + r.width * (0.2 + Math.random() * 0.6), ty = r.top + r.height * (0.2 + Math.random() * 0.6);
      const sx = fromLeft ? r.left - 40 : r.right + 40, sy = r.bottom + 20;
      e.style.left = sx + 'px'; e.style.top = sy + 'px'; document.body.append(e);
      e.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${(tx - sx) / 2}px,${(ty - sy) / 2 - 60}px) rotate(300deg)`, offset: 0.5 },
        { transform: `translate(${tx - sx}px,${ty - sy}px) rotate(640deg) scale(1.3)` }], { duration: 520, easing: 'ease-in' }).onfinish = () => {
        e.remove(); play('splat');
        const s = document.createElement('div'); s.className = 'splat'; s.textContent = e.textContent === '🍅' ? '💥' : '🍳'; s.style.left = tx + 'px'; s.style.top = ty + 'px'; document.body.append(s);
        s.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 1, offset: 0.25 },
          { transform: 'translate(-50%,-30%) scale(1.5)', opacity: 0 }], { duration: 1500, easing: 'ease-out' }).onfinish = () => s.remove();
      };
    }
  }

  // the mascot pops up in the corner of the canvas and says something silly
  const CAST = ['🦜', '🐒', '🐓', '🐘', '🐯', '🦆', '🐢', '🐮'];
  let mascotT = 0, mascotAt = 0;
  function mascot(text, force) {
    const m = document.getElementById('mascot'); if (!m || reduce) return;
    const now = Date.now(); if (!force && now - mascotAt < 1400) return; mascotAt = now;
    m.querySelector('.m-face').textContent = CAST[(Math.random() * CAST.length) | 0];
    m.querySelector('.m-say').textContent = text;
    m.classList.remove('show'); void m.offsetWidth; m.classList.add('show');
    clearTimeout(mascotT); mascotT = setTimeout(() => m.classList.remove('show'), 2300);
  }
  const pick = (a) => a[(Math.random() * a.length) | 0];
  function shake(el) { if (!el || reduce) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 450); }

  // ---------------- mute button(s) ----------------
  function paintMute() { document.querySelectorAll('.snd').forEach((b) => { b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(!muted)); b.title = muted ? 'Sound off' : 'Sound on'; }); }
  function setMuted(v) { muted = v; try { localStorage.setItem('k_sound', v ? '0' : '1'); } catch { /* ignore */ } paintMute(); if (!v) { ac(); play('click'); } }
  document.querySelectorAll('.snd').forEach((b) => b.addEventListener('click', () => setMuted(!muted)));
  paintMute();

  window.Juice = { play, confetti, rain, floatText, fling, mascot, shake, pick, reduce };
})();
