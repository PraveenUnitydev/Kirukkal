// End-to-end smoke test: spawns the server, plays a full 2-round game with 3 bots.
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const assert = require('assert');

const PORT = 3100 + Math.floor(Math.random() * 500);
const server = spawn('node', [path.join(__dirname, '..', 'server.js')], {
  env: { ...process.env, PORT, KIRUKKAL_FAST: '1' }, stdio: ['ignore', 'pipe', 'inherit'],
});

function bot(name) {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const b = { name, ws, id: null, room: null, word: null, hints: [], msgs: [], words: null, drawOps: 0, redraws: 0, close: false };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw); b.msgs.push(m);
    if (m.type === 'welcome') b.id = m.id;
    if (m.type === 'room') b.room = m.room;
    if (m.type === 'choose_words') b.words = m.words;
    if (m.type === 'hint') b.hints.push(m);
    if (m.type === 'draw') b.drawOps++;
    if (m.type === 'redraw') b.redraws++;
    if (m.type === 'system' && m.kind === 'close') b.close = true;
    if (b.onmsg) b.onmsg(m);
  });
  b.open = new Promise((r) => ws.on('open', r));
  b.send = (m) => ws.send(JSON.stringify(m));
  b.until = (fn, ms = 5000) => new Promise((res, rej) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (fn()) { clearInterval(iv); res(); } else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('timeout waiting: ' + fn)); }
    }, 20);
  });
  return b;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await sleep(600);
  try {
    const a = bot('அ'), b = bot('ஆ'), c = bot('இ');
    await Promise.all([a.open, b.open, c.open]);
    a.send({ type: 'create', name: 'அருண்', avatar: 1 });
    await a.until(() => a.room);
    const code = a.room.code;
    assert.strictEqual(code.length, 4);
    b.send({ type: 'join', code, name: 'பாலா', avatar: 2 });
    c.send({ type: 'join', code: code.toLowerCase(), name: 'சேரன்', avatar: 3 });
    await c.until(() => c.room && c.room.players.length === 3);
    console.log('✓ create/join (case-insensitive code)');

    // bad join
    const d = bot('x'); await d.open; d.send({ type: 'join', code: 'ZZZZ', name: 'x' });
    await d.until(() => d.msgs.some((m) => m.type === 'error' && m.code === 'no_room'));
    console.log('✓ unknown room rejected');

    // non-host can't start
    b.send({ type: 'start' }); await sleep(150);
    assert.strictEqual(a.room.state, 'lobby');
    a.send({ type: 'settings', rounds: 1, drawTime: 30 });
    await a.until(() => a.room.settings.rounds === 1);
    a.send({ type: 'start' });
    console.log('✓ host-only start/settings');

    const bots = [a, b, c];
    for (let turn = 0; turn < 3; turn++) {
      await a.until(() => a.room.state === 'choosing' && a.room.drawerId);
      const drawer = bots.find((x) => x.id === a.room.drawerId);
      const guessers = bots.filter((x) => x !== drawer);
      await drawer.until(() => drawer.words && drawer.room.state === 'choosing');
      const word = drawer.words[0]; drawer.words = null;
      drawer.send({ type: 'choose', index: 0 });
      await a.until(() => a.room.state === 'drawing');
      await guessers[0].until(() => guessers[0].hints.length > 0);

      // hints for non-drawers must be hidden; drawer sees word
      const gh = guessers[0].hints.at(-1);
      assert.strictEqual(gh.full, false);
      assert.ok(gh.hint.every((g) => g === '_'), 'guesser sees only blanks at start');
      const dh = drawer.hints.at(-1);
      assert.strictEqual(dh.full, true);
      assert.strictEqual(dh.hint.join(''), word);

      // drawing relay
      const before = guessers[0].drawOps;
      drawer.send({ type: 'stroke_start', c: '#ff0000', w: 6, x: 10, y: 10 });
      drawer.send({ type: 'stroke_pts', p: [20, 20, 30, 30] });
      drawer.send({ type: 'fill', x: 5, y: 5, c: '#00ff00' });
      await guessers[0].until(() => guessers[0].drawOps >= before + 3);
      // guesser can't draw
      const g0 = guessers[1].drawOps;
      guessers[0].send({ type: 'stroke_start', c: '#000000', w: 6, x: 1, y: 1 });
      await sleep(100);
      assert.strictEqual(guessers[1].drawOps, g0, 'non-drawer strokes ignored');
      if (turn === 0) { // undo
        drawer.send({ type: 'undo' });
        const r = guessers[0].redraws;
        await guessers[0].until(() => guessers[0].redraws > r);
        console.log('✓ drawing relay + undo');
      }

      // wrong guess is broadcast, correct guess is not leaked
      guessers[0].send({ type: 'chat', text: 'தவறு' });
      await guessers[1].until(() => guessers[1].msgs.some((m) => m.type === 'chat' && m.text === 'தவறு'));
      // close guess (drop last grapheme cluster base char)
      guessers[0].close = false;
      guessers[0].send({ type: 'chat', text: word.slice(0, -1) });
      await sleep(120);

      // turn 2 guesses in Tanglish (Roman letters, upper-case) to exercise phonetic matching end to end
      // turn 3 mimics live conversion: the box showed (wrong-spelled) Tamil, but the raw English letters were sent too
      const { toRoman } = require('../tanglish');
      const guessMsg = turn === 1 ? { text: toRoman(word).toUpperCase() }
        : turn === 2 ? { text: 'ழழழ', raw: toRoman(word) }
        : { text: ' ' + word + ' ' };
      const guessText = guessMsg.text;
      guessers[0].send({ type: 'chat', ...guessMsg });
      await a.until(() => a.room.players.find((p) => p.id === guessers[0].id).guessed);
      assert.ok(!guessers[1].msgs.some((m) => m.type === 'chat' && m.text.trim().toLowerCase() === guessText.trim().toLowerCase()), 'answer must not leak to chat');
      guessers[1].send({ type: 'chat', text: word });
      await a.until(() => a.room.state === 'turn_end');
      const te = a.msgs.filter((m) => m.type === 'turn_end').at(-1);
      assert.strictEqual(te.word, word);
      assert.ok(te.gains.find((g) => g.id === guessers[0].id).gain >= 50);
      console.log(`✓ turn ${turn + 1}: guessed "${word}", scores ${a.room.players.map((p) => p.score).join('/')}`);
    }
    await a.until(() => a.room.state === 'over', 4000);
    const scores = a.room.players.map((p) => p.score);
    assert.ok(scores.every((s) => s > 0), 'everyone scored');
    console.log('✓ game over, final scores', scores.join('/'));

    // back to lobby, leave handling
    a.send({ type: 'lobby' });
    await a.until(() => a.room.state === 'lobby');
    b.ws.close();
    await a.until(() => a.room.players.length === 2);
    a.ws.close();
    await c.until(() => c.room.hostId === c.id);
    console.log('✓ host migration after leave');

    console.log('\nALL TESTS PASSED');
    process.exitCode = 0;
  } catch (e) {
    console.error('TEST FAILED:', e);
    process.exitCode = 1;
  } finally {
    server.kill();
    setTimeout(() => process.exit(process.exitCode), 100);
  }
})();
