// Tests for the live Tanglish -> Tamil converter and its typing buffer.
const assert = require('assert');
const { convert, sync } = require('../public/translit.js');

const CASES = {
  // words players will type; expected = the standard Tamil spelling
  maram: 'மரம்', yaanai: 'யானை', poonai: 'பூனை', dosai: 'தோசை', thosai: 'தோசை', veedu: 'வீடு',
  kozhi: 'கோழி', mazhai: 'மழை', pattam: 'பட்டம்', singam: 'சிங்கம்', kurangu: 'குரங்கு',
  thoppi: 'தொப்பி', pongal: 'பொங்கல்', idli: 'இட்லி', ottagam: 'ஒட்டகம்', koyil: 'கோயில்',
  saambaar: 'சாம்பார்', nilaa: 'நிலா', laddu: 'லட்டு', aadu: 'ஆடு', kadal: 'கடல்', thaamarai: 'தாமரை',
  pensil: 'பென்சில்', robo: 'ரோபோ',
  // case handling: leading capital (phone auto-caps) and caps lock are plain letters
  Maram: 'மரம்', MARAM: 'மரம்', Dosai: 'தோசை',
  // explicit overrides in the middle of a word
  paNam: 'பணம்', kaLi: 'களி',
};

let fail = 0;
for (const [roman, tamil] of Object.entries(CASES)) {
  const got = convert(roman);
  if (got !== tamil) { fail++; console.error(`✗ ${roman} -> ${got} (expected ${tamil})`); }
}

// spaces, already-Tamil text and digits pass through untouched
assert.strictEqual(convert('nila maram'), 'நில மரம்');
assert.strictEqual(convert('மரம்'), 'மரம்');
assert.strictEqual(convert('maram 2'), 'மரம் 2');
assert.strictEqual(convert(''), '');

// typing character by character, the way the input box sees it
function type(st, text) { for (const ch of text) sync(st, st.shown + ch); return st; }
{
  const st = type({ raw: '', shown: '' }, 'dosai');
  assert.strictEqual(st.shown, 'தோசை');
  assert.strictEqual(st.raw, 'dosai');
}
{
  // backspace removes one English letter per press (browser removes the last Tamil code point)
  const st = type({ raw: '', shown: '' }, 'maram');
  assert.strictEqual(st.shown, 'மரம்');
  for (let i = 0; i < 6 && st.raw; i++) sync(st, st.shown.slice(0, -1));
  assert.strictEqual(st.raw, '');
  assert.strictEqual(st.shown, '');
}
{
  // select-all + delete clears everything
  const st = type({ raw: '', shown: '' }, 'maram');
  sync(st, '');
  assert.deepStrictEqual(st, { raw: '', shown: '' });
}
{
  // pasting English letters at the end converts them
  const st = { raw: '', shown: '' };
  sync(st, 'veedu');
  assert.strictEqual(st.shown, 'வீடு');
}
{
  // typing Tamil directly (Tamil keyboard) is left alone
  const st = { raw: '', shown: '' };
  sync(st, 'மரம்');
  assert.strictEqual(st.shown, 'மரம்');
  assert.strictEqual(st.raw, 'மரம்');
}
{
  // editing in the middle of the text falls back to treating the new text as typed
  const st = type({ raw: '', shown: '' }, 'maram');
  sync(st, 'மனரம்');
  assert.strictEqual(st.raw, 'மனரம்');
  assert.strictEqual(st.shown, 'மனரம்');
}

console.log(`Converter: ${Object.keys(CASES).length - fail}/${Object.keys(CASES).length} spellings ok, typing buffer ok`);
process.exitCode = fail ? 1 : 0;
