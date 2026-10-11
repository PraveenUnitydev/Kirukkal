// Tanglish support: lets players type Tamil words in Roman letters.
//
// Tanglish spelling is not standardised (maram / marram, yaanai / yanai, dosai / thosai),
// so we don't try to match spellings exactly. Instead both the Tamil target and the guess are
// reduced to a phonetic "skeleton" that ignores the distinctions Roman typists blur:
//   - long/short vowels (aa/a, ee/i, oo/u), e/ae, ai/ay/ei
//   - voiced/unvoiced stops (t/d/th/dh, k/g/h, p/b, s/ch/j/sh)
//   - doubled letters (pattam/patam), ழ/ள/ல (zh/l/z), ர/ற (r), ந/ன/ண (n)

const CONS = {
  'க': 'k', 'ங': 'ng', 'ச': 'ch', 'ஞ': 'nj', 'ட': 't', 'ண': 'n', 'த': 'th', 'ந': 'n', 'ப': 'p',
  'ம': 'm', 'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
  'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h',
};
const VOWELS = {
  'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo', 'எ': 'e', 'ஏ': 'e',
  'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au',
};
const SIGNS = {
  'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo', 'ெ': 'e', 'ே': 'e', 'ை': 'ai',
  'ொ': 'o', 'ோ': 'o', 'ௌ': 'au',
};
const PULLI = '்';

// Tamil script -> rough Roman letters (only used to build the skeleton, never shown to players).
function toRoman(tamil) {
  const chars = [...String(tamil).normalize('NFC')];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (CONS[c]) {
      const next = chars[i + 1];
      if (next === PULLI) { out += CONS[c]; i++; }
      else if (next && SIGNS[next]) { out += CONS[c] + SIGNS[next]; i++; }
      else out += CONS[c] + 'a'; // inherent vowel
    } else if (VOWELS[c]) out += VOWELS[c];
    else if (c === 'ஃ') out += 'k';
    else if (/[a-z]/i.test(c)) out += c;
  }
  return out;
}

// Roman letters -> phonetic skeleton.
function skeleton(input) {
  let s = String(input).toLowerCase().replace(/[^a-z]/g, '');
  s = s
    .replace(/zh|lz/g, 'l').replace(/z/g, 'l')
    .replace(/th|dh/g, 't').replace(/bh|ph/g, 'p').replace(/kh|gh/g, 'k')
    .replace(/sh|ch/g, 's')
    .replace(/[jcdbfghqwx]/g, (c) => ({ j: 's', c: 'k', d: 't', b: 'p', f: 'p', g: 'k', h: 'k', q: 'k', w: 'v', x: 'ks' }[c]))
    .replace(/aa+/g, 'a').replace(/ee+|ii+|ea/g, 'i').replace(/oo+|uu+/g, 'u')
    .replace(/ae/g, 'e').replace(/ei/g, 'ai').replace(/ou|ow/g, 'au')
    .replace(/ay(?![aeiou])/g, 'ai')
    .replace(/([^aeiou])y$/, '$1i') // idly -> idli
    .replace(/(.)\1+/g, '$1');
  return s;
}

// Common English loanwords people type the English way (cake, carrot...) rather than phonetically.
const ALIASES = {
  'கேக்': ['cake'], 'சாக்லேட்': ['chocolate'], 'கேரட்': ['carrot'], 'கேமரா': ['camera'],
  'ரோபோ': ['robot'], 'ராக்கெட்': ['rocket'], 'ஆப்பிள்': ['apple'], 'ஐஸ்கிரீம்': ['icecream'],
  'சைக்கிள்': ['cycle', 'bicycle'], 'பென்சில்': ['pencil'], 'பேனா': ['pen'], 'கணினி': ['computer'],
  'தொலைபேசி': ['phone', 'telephone'], 'ரயில்': ['rail', 'train'], 'பேருந்து': ['bus'],
  'தக்காளி': ['tomato'], 'பிரியாணி': ['biryani'],
};

const hasTamil = (s) => /[஀-௿]/.test(s);
const hasLatin = (s) => /[a-z]/i.test(s);

// All skeletons a Roman-letter guess may match for this Tamil word.
function candidates(word, alts = []) {
  const set = new Set([skeleton(toRoman(word))]);
  for (const a of ALIASES[word] || []) set.add(skeleton(a));
  for (const a of alts) set.add(skeleton(a)); // e.g. the English title of a Tamil movie
  return [...set].filter(Boolean);
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// 'correct' | 'close' | 'wrong' for a Roman-letter guess against candidate skeletons.
function judge(guess, cands) {
  const g = skeleton(guess);
  if (!g) return 'wrong';
  if (cands.includes(g)) return 'correct';
  if (cands.some((c) => c.length >= 3 && editDistance([...g], [...c]) === 1)) return 'close';
  return 'wrong';
}

module.exports = { toRoman, skeleton, candidates, judge, hasTamil, hasLatin, ALIASES };
