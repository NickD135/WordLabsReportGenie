// /js/polish/repetitionConfig.js
//
// Lists of words we flag for over-use in polished comments, plus the
// threshold. Edited frequently as calibration reveals which words are
// useful flags and which aren't — keep the structure flat and obvious.
//
// Australian English spellings only.

(function () {
  window.RG = window.RG || {};
  window.RG.repetitionConfig = {
    conceptWords: [
      'supportive', 'collaborative', 'positive', 'enthusiastic',
      'thoughtful', 'respectful', 'confident', 'motivated',
      'focused', 'organised', 'curious', 'creative',
      'engaged', 'diligent', 'attentive',
    ],
    nouns: [
      'classroom', 'class', 'learning', 'lessons',
      'peers', 'classmates', 'students',
    ],
    threshold: 2, // more than this count = flag
    caseSensitive: false,
  };
})();
