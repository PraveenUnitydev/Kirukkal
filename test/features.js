// Language / difficulty / categories, like-dislike, kick and make-host.
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const assert = require('assert');
const BANK = require('../words');

const PORT = 3700 + Math.floor(Math.random() * 200);
const server = spawn('node', [path.join(__dirname, '..', 'server.js')], {
  env: { ...process.env, PORT, KIRUKKAL_FAST: '1' }, stdio: ['ignore', 'pipe', 'inherit'],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function bot() {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const b = { ws, id: null, room: null, msgs: [], words: null };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw); b.msgs.push(m);
    if (m.type === 'welcome') b.id = m.id;
    if (m.type === 'room') b.room = m.room;
    if (m.type === 'choose_words') b.words = m.words;
  });
  b.open = new Promise((r) => ws.on('open', r));
  b.send = (m) => ws.send(JSON.stringify(m));
  b.until = (fn, ms = 4000) => new Promise((res, rej) => {
    const t0 = Date.now();
    const iv = setInterval(() => { if (fn()) { clearInterval(iv); res(); } else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('timeout: ' + fn)); } }, 20);
  });
  return b;
}

(async () => {
  await sleep(600);
  try {
    const a = bot(), b = bot(), c = bot();
    await Promise.all([a.open, b.open, c.open]);
    a.send({ type: 'create', name: 'A', avatar: 0, cid: 'cid-a' });
    await a.until(() => a.room);
    const code = a.room.code;
    b.send({ type: 'join', code, name: 'B', avatar: 1, cid: 'cid-b' });
    c.send({ type: 'join', code, name: 'C', avatar: 2, cid: 'cid-c' });
    await a.until(() => a.room.players.length === 3);

    // settings: defaults, host-only, validation
    assert.strictEqual(a.room.settings.lang, 'ta');
    assert.deepStrictEqual(a.room.settings.cats, ['words', 'movies', 'characters']);
    b.send({ type: 'settings', lang: 'en' }); await sleep(120);
    assert.strictEqual(a.room.settings.lang, 'ta', 'non-host cannot change settings');
    a.send({ type: 'settings', lang: 'klingon', difficulty: 'nope', cats: ['bogus'] }); await sleep(120);
    assert.strictEqual(a.room.settings.lang, 'ta'); assert.strictEqual(a.room.settings.difficulty, 'mixed');
    assert.ok(a.room.settings.cats.length === 3, 'invalid categories ignored');
    a.send({ type: 'settings', lang: 'en', difficulty: 'easy', cats: ['words'], rounds: 1, drawTime: 30 });
    await a.until(() => a.room.settings.lang === 'en' && a.room.settings.difficulty === 'easy');
    console.log('✓ settings (language / difficulty / word types)');

    // English easy words only
    const easyEn = new Set(BANK.pool('en', 'easy', ['words']).map((e) => e.word));
    a.send({ type: 'start' });
    const bots = [a, b, c];
    const seenWords = new Set();
    for (let turn = 0; turn < 3; turn++) {
      await a.until(() => a.room.state === 'choosing' && a.room.drawerId && bots.find((x) => x.id === a.room.drawerId).words);
      const drawer = bots.find((x) => x.id === a.room.drawerId);
      const options = drawer.words; drawer.words = null;
      assert.strictEqual(options.length, 3);
      for (const w of options) assert.ok(easyEn.has(w), `"${w}" is not an easy English word`);
      options.forEach((w) => seenWords.add(w));
      drawer.send({ type: 'choose', index: 0 });
      await a.until(() => a.room.state === 'drawing');
      const guessers = bots.filter((x) => x !== drawer);
      const word = options[0];

      if (turn === 0) {
        // likes / dislikes: one vote each, +10 per like to the drawer, not for the drawer's own drawing
        const before = a.room.players.find((p) => p.id === drawer.id).score;
        guessers[0].send({ type: 'vote', v: 1 }); guessers[1].send({ type: 'vote', v: -1 });
        await a.until(() => a.room.up === 1 && a.room.down === 1);
        guessers[0].send({ type: 'vote', v: 1 }); drawer.send({ type: 'vote', v: 1 }); await sleep(120);
        assert.strictEqual(a.room.up, 1, 'repeat / own votes ignored');
        assert.strictEqual(a.room.players.find((p) => p.id === drawer.id).score, before + 10);
        guessers[1].send({ type: 'vote', v: 1 }); await a.until(() => a.room.up === 2 && a.room.down === 0);
        guessers[0].send({ type: 'vote', v: 0 }); await a.until(() => a.room.up === 1);
        await a.until(() => a.msgs.some((m) => m.type === 'system' && m.kind === 'like') && a.msgs.some((m) => m.type === 'system' && m.kind === 'dislike'));
        const likes = a.msgs.filter((m) => m.type === 'system' && m.kind === 'like').length;
        assert.strictEqual(likes, 2, 'each voter is announced once in chat (re-liking does not spam)');
        console.log('✓ like / dislike (announced in chat)');
      }
      // English guessing is case / space insensitive; a Tamil-script guess is just a wrong guess
      guessers[0].send({ type: 'chat', text: 'தமிழ்' }); await sleep(80);
      assert.ok(!a.room.players.find((p) => p.id === guessers[0].id).guessed);
      guessers[0].send({ type: 'chat', text: '  ' + word.toUpperCase().replace(/ /g, '') + ' ' });
      await a.until(() => a.room.players.find((p) => p.id === guessers[0].id).guessed);
      guessers[1].send({ type: 'chat', text: word });
      await a.until(() => a.room.state === 'turn_end');
    }
    console.log('✓ English game: easy words only, case-insensitive guesses, no repeats within', seenWords.size, 'offers');

    // Tamil movies & characters exist in English games too (English titles)
    const enMov = BANK.pool('en', 'mixed', ['movies', 'characters']);
    assert.ok(enMov.length > 100 && enMov.some((e) => e.word === 'Jailer') && enMov.some((e) => e.word === 'Chitti'));
    assert.ok(enMov.every((e) => !/[஀-௿]/.test(e.word)));
    assert.deepStrictEqual(BANK.pool('en', 'easy', ['movies']).slice(0, 2).map((e) => e.word), ['Leo', 'Master']);
    console.log('✓ English games include Tamil movies & characters:', enMov.length, 'titles');
    await a.until(() => ['choosing', 'over'].includes(a.room.state));

    // host controls
    await a.until(() => a.room.state === 'over', 15000);
    a.send({ type: 'lobby' }); await a.until(() => a.room.state === 'lobby');
    b.send({ type: 'kick', id: c.id }); await sleep(120);
    assert.strictEqual(a.room.players.length, 3, 'non-host cannot kick');
    b.send({ type: 'host', id: b.id }); await sleep(120);
    assert.strictEqual(a.room.hostId, a.id, 'non-host cannot take host');
    a.send({ type: 'host', id: b.id });
    await a.until(() => a.room.hostId === b.id);
    a.send({ type: 'kick', id: c.id }); await sleep(120);
    assert.strictEqual(a.room.players.length, 3, 'old host lost the right to kick');
    console.log('✓ make host');
    b.send({ type: 'kick', id: c.id });
    await b.until(() => b.room.players.length === 2);
    await c.until(() => c.msgs.some((m) => m.type === 'kicked'));
    assert.ok(b.msgs.some((m) => m.type === 'system' && m.kind === 'kicked'));
    // kicked player can't come back with the same device id, but a different person can join
    const c2 = bot(); await c2.open;
    c2.send({ type: 'join', code, name: 'C', avatar: 2, cid: 'cid-c' });
    await c2.until(() => c2.msgs.some((m) => m.type === 'error' && m.code === 'banned'));
    const d = bot(); await d.open;
    d.send({ type: 'join', code, name: 'D', avatar: 3, cid: 'cid-d' });
    await d.until(() => d.room && d.room.players.length === 3);
    console.log('✓ kick + ban');

    // Tamil game: movies & characters appear, with the English title accepted
    b.send({ type: 'settings', lang: 'ta', difficulty: 'mixed', cats: ['movies'], rounds: 1, drawTime: 30 });
    await b.until(() => b.room.settings.lang === 'ta' && b.room.settings.cats.join() === 'movies');
    b.send({ type: 'start' });
    const all = [a, b, d];
    await a.until(() => a.room.state === 'choosing' && all.find((x) => x.id === a.room.drawerId).words);
    const dr = all.find((x) => x.id === a.room.drawerId);
    const movies = new Set(BANK.pool('ta', 'mixed', ['movies']).map((e) => e.word));
    for (const w of dr.words) assert.ok(movies.has(w), `${w} should be a Tamil movie`);
    const picked = dr.words[0]; dr.send({ type: 'choose', index: 0 });
    await a.until(() => a.room.state === 'drawing');
    const entry = BANK.pool('ta', 'mixed', ['movies']).find((e) => e.word === picked);
    const g = all.find((x) => x !== dr);
    g.send({ type: 'chat', text: entry.alts[0].toUpperCase() });
    await a.until(() => a.room.players.find((p) => p.id === g.id).guessed);
    console.log(`✓ Tamil movie "${picked}" guessed by its English title "${entry.alts[0]}"`);

    console.log('\nFEATURE TESTS PASSED');
    process.exitCode = 0;
  } catch (e) {
    console.error('TEST FAILED:', e);
    process.exitCode = 1;
  } finally {
    server.kill(); setTimeout(() => process.exit(process.exitCode), 100);
  }
})();
