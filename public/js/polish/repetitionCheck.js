// /js/polish/repetitionCheck.js
//
// Flags likely over-use of concept words and nouns in a polished comment.
// String-matching only — not a semantic analyser. Plural and singular
// forms are counted separately by design; if we want both flagged, they
// get added to the config separately.

(function () {
  function check(text) {
    const cfg = window.RG.repetitionConfig;
    if (!text || !cfg) return [];

    // Strip placeholders so the check doesn't light up on {first_name}.
    // Real student names are a known edge case for a later pass.
    const cleaned = String(text).replace(/\{first_name\}/g, ' ');

    const caseSensitive = !!cfg.caseSensitive;
    const prepared = caseSensitive ? cleaned : cleaned.toLowerCase();
    const tokenRe = caseSensitive ? /\b[A-Za-z']+\b/g : /\b[a-z']+\b/g;

    const counts = Object.create(null);
    let m;
    while ((m = tokenRe.exec(prepared)) !== null) {
      const t = m[0];
      counts[t] = (counts[t] || 0) + 1;
    }

    const threshold = cfg.threshold;
    const flags = [];
    const scan = (list, category) => {
      for (const word of list || []) {
        const key = caseSensitive ? word : word.toLowerCase();
        const count = counts[key] || 0;
        if (count > threshold) flags.push({ word, count, category });
      }
    };
    scan(cfg.conceptWords, 'concept');
    scan(cfg.nouns, 'noun');

    flags.sort((a, b) => b.count - a.count);
    return flags;
  }

  window.RG = window.RG || {};
  window.RG.repetitionCheck = { check };
})();
