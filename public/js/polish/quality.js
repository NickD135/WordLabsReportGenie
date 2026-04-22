// /js/polish/quality.js
//
// Quality check rules for polished comments.
// Returns an array of issues (strings). Empty array = clean.
//
// Rules from CLAUDE.md:
//   - Word count within target range
//   - {first_name} placeholder still present (or name appears once re-substituted)
//   - No contractions
//   - No future-tense promises
//   - No American spellings
//   - No sentences starting with "And" or "But"
//   - No vague praise without evidence
//   - No repeated content words (>2 occurrences of any non-stopword)

(function () {
  const CONTRACTIONS = [
    "won't", "can't", "don't", "doesn't", "didn't", "isn't", "wasn't", "weren't",
    "hasn't", "haven't", "hadn't", "wouldn't", "shouldn't", "couldn't", "mustn't",
    "i'm", "you're", "we're", "they're", "it's", "he's", "she's", "that's",
    "i've", "you've", "we've", "they've", "i'll", "you'll", "we'll", "they'll",
    "i'd", "you'd", "we'd", "they'd", "let's", "there's", "here's", "what's",
  ];

  const FUTURE_PROMISES = [
    /\bwill (improve|achieve|be able to|develop|grow|succeed|master|excel)\b/i,
    /\bwill continue to\b/i,
    /\bin the future\b/i,
    /\bnext (year|term|semester) .{0,30}\b(will|should)\b/i,
  ];

  const AMERICAN_SPELLINGS = [
    'color', 'colors', 'colored', 'coloring',
    'behavior', 'behaviors',
    'organize', 'organizes', 'organized', 'organizing', 'organization',
    'recognize', 'recognizes', 'recognized', 'recognizing',
    'analyze', 'analyzes', 'analyzed', 'analyzing',
    'realize', 'realizes', 'realized', 'realizing',
    'favor', 'favors', 'favored', 'favorite',
    'honor', 'honors', 'honored',
    'labor', 'labors',
    'center', 'centers', 'centered',
    'fiber', 'fibers',
    'theater', 'theaters',
    'meter', 'meters',                 // note: "kilometer" too — handled by substring? no, keep word boundary
    'practiced',                       // note: practise (verb) vs practice (noun) is the AusE convention
    'practicing',
    'enrolment',                       // wait — enrolment is AusE, enrollment is US; flip
  ];
  // Trim list of words that would false-positive: enrolment is the correct AusE form,
  // so it should NOT be flagged. Remove it.
  const AMERICAN_SET = new Set(AMERICAN_SPELLINGS.filter(w => w !== 'enrolment').map(w => w.toLowerCase()));
  // Add enrollment as the US form to flag:
  AMERICAN_SET.add('enrollment');

  const VAGUE_PRAISE_PATTERNS = [
    /\bis a (great|wonderful|fantastic|amazing|brilliant) (learner|student|child)\b\.?/i,
    /\bdoes a (great|wonderful|fantastic) job\b/i,
    /\b(always|consistently) does (his|her|their) best\b/i,
  ];

  const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'of', 'is', 'are', 'was', 'were',
    'in', 'on', 'at', 'to', 'for', 'with', 'by', 'as', 'this', 'that', 'these',
    'those', 'it', 'its', 'they', 'their', 'them', 'he', 'his', 'him', 'she',
    'her', 'hers', 'has', 'have', 'had', 'be', 'been', 'being', 'do', 'does',
    'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must',
    'from', 'into', 'about', 'when', 'while', 'than', 'then', 'also', 'such',
  ]);

  function check(comment, { firstName, wordCountMin = 100, wordCountMax = 150 } = {}) {
    const issues = [];
    if (!comment || comment.length < 20) {
      return ['Comment is too short or missing.'];
    }

    // Word count
    const words = comment.trim().split(/\s+/);
    const wc = words.length;
    if (wc < wordCountMin) issues.push(`Too short (${wc} words, target ${wordCountMin}-${wordCountMax}).`);
    if (wc > wordCountMax) issues.push(`Too long (${wc} words, target ${wordCountMin}-${wordCountMax}).`);

    // Name presence
    if (firstName) {
      const nameRe = new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (!nameRe.test(comment)) issues.push("Student's name does not appear.");
    }

    // Contractions
    const lower = comment.toLowerCase();
    const foundContractions = CONTRACTIONS.filter(c => lower.includes(c));
    if (foundContractions.length) {
      issues.push(`Contractions present: ${[...new Set(foundContractions)].join(', ')}.`);
    }

    // Future promises
    for (const re of FUTURE_PROMISES) {
      const m = comment.match(re);
      if (m) { issues.push(`Future-tense promise: "${m[0]}".`); break; }
    }

    // American spellings
    const wordsLower = (lower.match(/\b[a-z']+\b/g) || []);
    const americanFound = wordsLower.filter(w => AMERICAN_SET.has(w));
    if (americanFound.length) {
      issues.push(`American spellings: ${[...new Set(americanFound)].join(', ')}.`);
    }

    // Sentences starting with "And" or "But"
    const sentences = comment.split(/(?<=[.!?])\s+/);
    const badStarts = sentences.filter(s => /^(And|But)\b/.test(s));
    if (badStarts.length) {
      issues.push(`Sentence starts with And/But (${badStarts.length}).`);
    }

    // Vague praise
    for (const re of VAGUE_PRAISE_PATTERNS) {
      if (re.test(comment)) { issues.push('Vague praise without specific evidence.'); break; }
    }

    // Repeated content words
    const freq = {};
    for (const w of wordsLower) {
      if (w.length <= 3) continue;
      if (STOPWORDS.has(w)) continue;
      if (firstName && w === firstName.toLowerCase()) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
    const repeated = Object.entries(freq)
      .filter(([, count]) => count > 2)
      .map(([word, count]) => `${word} (${count}×)`);
    if (repeated.length) {
      issues.push(`Repeated words: ${repeated.join(', ')}.`);
    }

    return issues;
  }

  window.RG = window.RG || {};
  window.RG.quality = { check };
})();
