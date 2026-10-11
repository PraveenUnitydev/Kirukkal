// Unit tests: typical Tanglish spellings must match, near-misses must not.
const assert = require('assert');
const BANK = require('../words');
const WORDS = BANK.pool('ta', 'mixed', BANK.CATS);
const { candidates, judge, toRoman, skeleton } = require('../tanglish');

// [tamil word, spellings players might type, spellings that must NOT be accepted]
const CASES = [
  ['மரம்', ['maram', 'Maram', 'MARAM', 'marram', 'ma ram'], ['mara', 'marum', 'maran']],
  ['யானை', ['yaanai', 'yanai', 'yaanay', 'YANAI'], ['yaana', 'yanam']],
  ['பூனை', ['poonai', 'punai', 'poonay', 'puunai'], ['poona', 'pannai']],
  ['நாய்', ['nai', 'naai', 'naay', 'nay'], ['nan', 'nal']],
  ['தோசை', ['dosai', 'thosai', 'dhosai', 'thosay'], ['dosa', 'rosai']],
  ['இட்லி', ['idli', 'idly', 'itli', 'iddli'], ['idi', 'idlis']],
  ['சாம்பார்', ['sambar', 'saambaar', 'sambhar', 'champar'], ['samosa']],
  ['கோழி', ['kozhi', 'koli', 'kozi', 'kolli'], ['kodi', 'kozhis']],
  ['மழை', ['mazhai', 'mazai', 'malai', 'mazhay'], ['marai', 'mazha']],
  ['வீடு', ['veedu', 'vidu', 'veetu', 'viidu'], ['veedi', 'vedu']],
  ['பட்டம்', ['pattam', 'patam', 'battam'], ['pattan', 'pantam']],
  ['கண்', ['kan', 'kann', 'KAN'], ['kal', 'kin']],
  ['பூ', ['poo', 'pu', 'puu'], ['pa']],
  ['குரங்கு', ['kurangu', 'kurangku', 'kurangoo'], ['kuranga']],
  ['நட்சத்திரம்', ['natchathiram', 'natsatiram', 'natchatiram'], ['nakshatram']],
  ['லட்டு', ['laddu', 'lattu', 'ladu'], ['latti']],
  ['ஒட்டகம்', ['ottagam', 'ottakam', 'otagam'], ['ottagan']],
  ['மிளகாய்', ['milagai', 'milagay', 'milakai'], ['milagu']],
  ['மஞ்சள்', ['manjal', 'mansal'], ['manjan']],
  // English loanwords typed the English way
  ['கேக்', ['cake', 'kek'], ['cook']],
  ['கேரட்', ['carrot', 'kerat'], ['carpet']],
  ['சாக்லேட்', ['chocolate'], []],
  ['ஆப்பிள்', ['apple', 'aappil'], ['ample']],
  ['ராக்கெட்', ['rocket', 'raket'], ['ranket']],
  ['தக்காளி', ['tomato', 'thakkali', 'takkali'], ['tomatoes']],
  ['கார்', ['car', 'kaar'], ['cat']],
];

let ok = 0, fail = 0;
for (const [word, accept, reject] of CASES) {
  const cands = candidates(word);
  for (const g of accept) {
    const v = judge(g, cands);
    if (v === 'correct') ok++; else { fail++; console.error(`✗ "${g}" should match ${word} (got ${v}; accepted: ${cands})`); }
  }
  for (const g of reject) {
    const v = judge(g, cands);
    if (v !== 'correct') ok++; else { fail++; console.error(`✗ "${g}" must NOT match ${word} (accepted: ${cands})`); }
  }
}

// one letter off gives the "close" nudge; junk never matches
assert.strictEqual(judge('maran', candidates('மரம்')), 'close');
assert.strictEqual(judge('', candidates('மரம்')), 'wrong');
assert.strictEqual(judge('123 !!', candidates('மரம்')), 'wrong');

// every word in the bank yields a usable skeleton and accepts its own transliteration
const seen = new Map();
const names = new Set();
for (const e of WORDS) {
  const w = e.word;
  assert.ok(!names.has(w), `duplicate word ${w}`); names.add(w);
  const sk = skeleton(toRoman(w));
  assert.ok(sk.length >= 1, `empty skeleton for ${w}`);
  const cands = candidates(w, e.alts);
  assert.strictEqual(judge(toRoman(w), cands), 'correct', `self-match failed for ${w}`);
  for (const a of e.alts) assert.strictEqual(judge(a, cands), 'correct', `English title "${a}" must match ${w}`);
  if (seen.has(sk)) console.warn(`note: "${w}" and "${seen.get(sk)}" share skeleton "${sk}"`);
  seen.set(sk, w);
}
// word bank sanity: enough variety per language / difficulty, no duplicates, no Tamil in the English list
for (const lang of ['ta', 'en']) {
  const all = BANK.pool(lang, 'mixed', BANK.CATS).map((e) => e.word.toLowerCase());
  assert.strictEqual(new Set(all).size, all.length, `${lang} bank has duplicates`);
  for (const t of BANK.TIERS) assert.ok(BANK.pool(lang, t, BANK.CATS).length >= 60, `${lang}/${t} too small`);
}
for (const e of BANK.pool('en', 'mixed', ['words'])) assert.ok(!/[஀-௿]/.test(e.word), `Tamil in English list: ${e.word}`);

console.log(`Tanglish spellings checked: ${ok} ok, ${fail} failed; ${WORDS.length} Tamil bank entries self-match`);
process.exitCode = fail ? 1 : 0;
