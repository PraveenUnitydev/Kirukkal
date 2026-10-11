// Live Tanglish -> Tamil typing. Works in the browser (window.Translit) and in Node (tests).
//
// Type English letters, get Tamil: maram -> மரம், dosai -> தோசை, yaanai -> யானை.
// Conventions: aa/ee/oo = long vowels, zh = ழ, th = த, ng/nj/nd/nth pick the right nasal.
// Capitals mid-word are explicit overrides: N = ண, L = ள, R = ற, O = ோ, E = ே.
// A converter has to pick one spelling, so it will sometimes pick a different letter than the
// "official" one (ட vs த). That's fine: the server still judges guesses phonetically.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Translit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const PULLI = '்';

  // vowel key -> [independent letter, vowel sign after a consonant]
  const V = {
    a: ['அ', ''], aa: ['ஆ', 'ா'], i: ['இ', 'ி'], ii: ['ஈ', 'ீ'], u: ['உ', 'ு'], uu: ['ஊ', 'ூ'],
    e: ['எ', 'ெ'], E: ['ஏ', 'ே'], ai: ['ஐ', 'ை'], o: ['ஒ', 'ொ'], O: ['ஓ', 'ோ'], au: ['ஔ', 'ௌ'],
  };
  const VOWEL_PAIRS = { aa: 'aa', ee: 'ii', ii: 'ii', oo: 'uu', uu: 'uu', ai: 'ai', au: 'au', ou: 'au', ow: 'au', ae: 'E' };
  const DIGRAPHS = {
    zh: ['ழ'], ch: ['ச'], sh: ['ஷ'], th: ['த'], dh: ['த'], kh: ['க'], gh: ['க'], bh: ['ப'], ph: ['ப'], rr: ['ற', 'ற'],
  };
  const H_DIGRAPHS = ['zh', 'th', 'dh', 'ch', 'sh', 'kh', 'gh', 'bh', 'ph'];
  const isVowelCh = (c) => /[aeiouAEIOU]/.test(c);

  // Tamil e/o are long in open syllables (to-sai, ko-zhi) and short in closed ones (thop-pi, pon-gal).
  function longOpen(w, j) {
    if (j >= w.length) return true; // word-final: robo -> ரோபோ
    let k;
    if (H_DIGRAPHS.includes(w.substr(j, 2))) k = j + 2;
    else if (/[A-Za-z]/.test(w[j]) && !isVowelCh(w[j])) k = j + 1;
    else return false;
    if (k >= w.length) return false; // pen -> பென்
    return isVowelCh(w[k]);
  }

  function readVowel(w, i) {
    const pair = VOWEL_PAIRS[w.substr(i, 2)];
    if (pair) return { key: pair, len: 2 };
    const c = w[i];
    if (c === 'a' || c === 'i' || c === 'u' || c === 'E' || c === 'O') return { key: c, len: 1 };
    if (c === 'e') return { key: longOpen(w, i + 1) ? 'E' : 'e', len: 1 };
    if (c === 'o') return { key: longOpen(w, i + 1) ? 'O' : 'o', len: 1 };
    return null;
  }

  function readConsonant(w, i, prevC) {
    const two = w.substr(i, 2);
    if (DIGRAPHS[two]) return { t: DIGRAPHS[two], len: 2 };
    const c = w[i], n = w[i + 1] || '';
    switch (c) {
      case 'k': case 'g': case 'q': return { t: ['க'], len: 1 };
      case 'c': return { t: [/[ei]/.test(n) ? 'ச' : 'க'], len: 1 };
      case 's': return { t: ['ச'], len: 1 };
      case 'j': return { t: [prevC === 'ஞ' ? 'ச' : 'ஜ'], len: 1 }; // nj -> ஞ்ச
      case 'x': return { t: ['க', 'ஸ'], len: 1 };
      case 't': case 'd': return { t: [i === 0 ? 'த' : 'ட'], len: 1 }; // Tamil words never start with ட
      case 'p': case 'b': return { t: ['ப'], len: 1 };
      case 'f': return { t: ['ஃப'], len: 1 };
      case 'm': return { t: ['ம'], len: 1 };
      case 'y': return { t: ['ய'], len: 1 };
      case 'r': return { t: ['ர'], len: 1 };
      case 'R': return { t: ['ற'], len: 1 };
      case 'l': return { t: ['ல'], len: 1 };
      case 'L': return { t: ['ள'], len: 1 };
      case 'v': case 'w': return { t: ['வ'], len: 1 };
      case 'z': return { t: ['ழ'], len: 1 };
      case 'h': return { t: ['ஹ'], len: 1 };
      case 'N': return { t: ['ண'], len: 1 };
      case 'n': {
        const rest = w.substr(i + 1);
        let t = 'ன';
        if (i === 0) t = 'ந';
        else if (/^[kg]/.test(rest)) t = 'ங'; // singam
        else if (/^(ch|j)/.test(rest)) t = 'ஞ'; // manjal
        else if (/^[td](?!h)/.test(rest)) t = 'ண'; // vandi
        else if (/^(th|dh)/.test(rest)) t = 'ந'; // ndha
        return { t: [t], len: 1 };
      }
    }
    return null;
  }

  function convertWord(word) {
    // Normalise case: all-caps (caps lock) and a leading capital are plain letters;
    // only N L R O E in the middle of a word keep their special meaning.
    const allCaps = word.length > 1 && word === word.toUpperCase();
    let w = '';
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      w += !allCaps && i > 0 && 'NLROE'.includes(ch) ? ch : ch.toLowerCase();
    }

    const toks = [];
    let i = 0, prevC = null;
    while (i < w.length) {
      const v = readVowel(w, i);
      if (v) { toks.push({ v: v.key }); i += v.len; prevC = null; continue; }
      const c = readConsonant(w, i, prevC);
      if (c) {
        for (const t of c.t) toks.push({ c: t });
        prevC = c.t[c.t.length - 1];
        i += c.len;
        continue;
      }
      toks.push({ raw: w[i] }); i++; prevC = null;
    }

    let out = '';
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k], prev = toks[k - 1], next = toks[k + 1];
      if (t.raw !== undefined) out += t.raw;
      else if (t.v) out += prev && prev.c !== undefined ? V[t.v][1] : V[t.v][0];
      else out += t.c + (next && next.v ? '' : PULLI); // vowel sign comes from the vowel token
    }
    return out;
  }

  // Convert every run of English letters; anything else (Tamil already typed, digits, spaces) passes through.
  function convert(text) {
    return String(text).replace(/[A-Za-z]+/g, convertWord);
  }

  // Keeps the English letters typed so far (raw) and what the box currently shows (shown).
  // Call with the input's new value after every edit; it works out what the player did.
  function sync(st, v) {
    if (v === st.shown) return st;
    if (v === '') st.raw = '';
    else if (v.startsWith(st.shown)) st.raw += v.slice(st.shown.length); // typed / pasted at the end
    else if (st.shown.startsWith(v)) st.raw = st.raw.slice(0, -1); // backspace: drop one English letter
    else st.raw = v; // edit in the middle, replace-selection, etc.: treat the new text as typed
    st.shown = convert(st.raw);
    return st;
  }

  return { convert, sync };
});
