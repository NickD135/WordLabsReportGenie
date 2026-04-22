// /js/polish/placeholder.js
//
// PRIVACY CRITICAL.
//
// All text sent to /api/polish must have student names replaced with
// {first_name}. All text received from /api/polish must have {first_name}
// replaced with the real name before display.
//
// This module is the only place where the swap should happen.

(function () {
  const PLACEHOLDER = '{first_name}';

  // Strip a real name out of any text, replacing with the placeholder.
  // Case-insensitive but preserves original casing on first letter where possible.
  function depersonalise(text, firstName) {
    if (!text || !firstName) return text || '';
    const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    return text.replace(re, PLACEHOLDER);
  }

  // Swap placeholders back to the real name.
  function repersonalise(text, firstName) {
    if (!text || !firstName) return text || '';
    return text.replaceAll(PLACEHOLDER, firstName);
  }

  // Sanity check — does this text still contain a real name?
  // Used as a final guard before sending. Returns true if the text
  // appears to NOT contain the student's name in any form.
  function isDepersonalised(text, firstName) {
    if (!text || !firstName) return true;
    const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    return !re.test(text);
  }

  window.RG = window.RG || {};
  window.RG.placeholder = {
    PLACEHOLDER,
    depersonalise,
    repersonalise,
    isDepersonalised,
  };
})();
