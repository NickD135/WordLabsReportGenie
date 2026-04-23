// /js/config/categoryOrder.js
//
// Canonical display order for statement categories (tabs) per subject.
// Supabase holds raw category and subcategory strings that do not always
// map cleanly onto the tab names shown to teachers. This file is the
// single source of truth for how those raw values flatten into a tab
// key and the order the tabs appear in both the By Student and By
// Statement views. Matches the progression of the original Google
// Sheets tool.

(function () {
  const CATEGORY_ORDER = {
    English: [
      'Opening',
      'Writing',
      'Comprehension',
      'Spelling',
      'Reading',
      'Handwriting',
      'Speaking and Listening',
    ],
    Maths: [
      'Opening',
      'Whole number',
      'Addition/Subtraction',
      'Multiplication/Division',
      'Fractions/Decimals',
      '2D Space',
      '3D Objects',
      'Geometric Measure',
      'Non-Spatial Measure',
      'Chance',
      'Data',
    ],
    General: [
      'Opening Statements',
      'Work Habit',
      'Collaboration',
      'Motivation',
      'Accountability',
      'Creativity',
      'Resilience',
      'Creative Arts',
      'HSIE',
      'PDH',
      'PE',
      'Science',
      'Social/Emotional Development',
      'Closing Statements',
    ],
  };

  // Fallback tab key for anything that does not map. Appears last.
  const UNKNOWN_TAB = 'Other';

  // Inner subcategory ordering within a tab. Strengths first so teachers
  // describe what the student can do before what they need to work on.
  // Anything outside this list sorts after both.
  const SUBCATEGORY_ORDER = ['Strengths', 'Goals'];

  // Subjects where the tab key lives in the subcategory prefix rather
  // than the category. In Maths every strand sits under one of three
  // umbrella categories, with the strand name in the subcategory (for
  // example "Whole number - Strengths"). In General the Disposition
  // and Other KLAs umbrellas behave the same way.
  const PREFIX_CATEGORIES = {
    English: [],
    Maths: ['Number and Algebra', 'Measurement and Space', 'Statistics and Probability'],
    General: ['Disposition', 'Other KLAs'],
  };

  // The separator used in the seed between tab prefix and inner label,
  // as in "Whole number - Strengths". Hyphen with a space either side.
  const SEPARATOR = ' - ';

  function splitSubcategory(sub) {
    if (!sub) return { prefix: '', inner: '' };
    const idx = sub.indexOf(SEPARATOR);
    if (idx === -1) return { prefix: sub, inner: '' };
    return { prefix: sub.slice(0, idx), inner: sub.slice(idx + SEPARATOR.length) };
  }

  // Canonical tab key for a given statement. Falls back to UNKNOWN_TAB
  // when category and subcategory are both missing.
  function tabKeyFor(subject, stmt) {
    const cat = stmt.category || '';
    const prefixCats = PREFIX_CATEGORIES[subject] || [];
    if (prefixCats.includes(cat)) {
      const { prefix } = splitSubcategory(stmt.subcategory);
      return prefix || cat || UNKNOWN_TAB;
    }
    return cat || UNKNOWN_TAB;
  }

  // Inner subcategory label used as a subhead within a tab (for example
  // Strengths or Goals). Empty string means no subhead.
  function innerSubcategoryFor(subject, stmt) {
    const cat = stmt.category || '';
    const prefixCats = PREFIX_CATEGORIES[subject] || [];
    if (prefixCats.includes(cat)) {
      const { inner } = splitSubcategory(stmt.subcategory);
      return inner || '';
    }
    return stmt.subcategory || '';
  }

  // Position of a tab in the canonical order. Unknown tabs sort to the
  // end so the display never silently drops anything.
  function tabOrderIndex(subject, tabKey) {
    const order = CATEGORY_ORDER[subject] || [];
    const i = order.indexOf(tabKey);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  }

  // Resolve the tab list to show for a subject given the statements
  // we actually have. Starts from the canonical order, keeps only
  // tabs that have at least one statement, then appends any unknown
  // tabs found in the data in first seen order. That way a seed
  // drift (a new or renamed category) shows up rather than disappearing.
  function tabsForSubject(subject, statements) {
    const canonical = CATEGORY_ORDER[subject] || [];
    const present = new Set(statements.map(s => tabKeyFor(subject, s)));
    const out = canonical.filter(k => present.has(k));
    for (const key of present) {
      if (!canonical.includes(key) && !out.includes(key)) out.push(key);
    }
    return out;
  }

  // Position of an inner subcategory label in the canonical order.
  // Empty labels (tabs with no Strengths/Goals split, such as Opening)
  // sort first. Anything not in SUBCATEGORY_ORDER sorts after both.
  function subcategoryOrderIndex(label) {
    if (!label) return -1;
    const i = SUBCATEGORY_ORDER.indexOf(label);
    return i === -1 ? SUBCATEGORY_ORDER.length : i;
  }

  // Stable canonical sort by tab order, then subcategory order, then
  // the statement's own position field. Leaves the input array alone.
  function sortStatements(subject, statements) {
    return [...statements].sort((a, b) => {
      const ta = tabOrderIndex(subject, tabKeyFor(subject, a));
      const tb = tabOrderIndex(subject, tabKeyFor(subject, b));
      if (ta !== tb) return ta - tb;
      const sa = subcategoryOrderIndex(innerSubcategoryFor(subject, a));
      const sb = subcategoryOrderIndex(innerSubcategoryFor(subject, b));
      if (sa !== sb) return sa - sb;
      return (a.position || 0) - (b.position || 0);
    });
  }

  // Group statements into { tabKey: { innerSubcategory: [stmt, ...] } }.
  // Insertion order reflects the canonical sort so Object.keys walks
  // the groups in display order.
  function groupByTabAndSubcategory(subject, statements) {
    const sorted = sortStatements(subject, statements);
    const out = {};
    for (const s of sorted) {
      const tab = tabKeyFor(subject, s);
      const inner = innerSubcategoryFor(subject, s);
      out[tab] = out[tab] || {};
      out[tab][inner] = out[tab][inner] || [];
      out[tab][inner].push(s);
    }
    return out;
  }

  window.RG = window.RG || {};
  window.RG.config = window.RG.config || {};
  window.RG.config.categoryOrder = {
    CATEGORY_ORDER,
    SUBCATEGORY_ORDER,
    UNKNOWN_TAB,
    tabKeyFor,
    innerSubcategoryFor,
    tabOrderIndex,
    subcategoryOrderIndex,
    tabsForSubject,
    sortStatements,
    groupByTabAndSubcategory,
    splitSubcategory,
  };
})();
