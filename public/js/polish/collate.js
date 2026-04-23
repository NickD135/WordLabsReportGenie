// /js/polish/collate.js
//
// Assembles the raw text from ticked statements and orchestrates the polish call.
// Equivalent of the TEXTJOIN formula + polishBySubject() in the Sheets version,
// but cleaner: collation, placeholder swap, API call, and re-personalisation
// all live here.

(function () {
  const { getTicks, getTeacherFeedback, listOutputs, saveOutput } = window.RG.db;
  const { getStatements } = window.RG.bank;
  const { depersonalise, repersonalise, isDepersonalised, PLACEHOLDER } = window.RG.placeholder;

  // Build the raw collated text for one student/subject by concatenating
  // their ticked statements in category/position order.
  async function collate(student, subject) {
    const stage = stageForYearGroup(student._yearGroup);
    const allStatements = await getStatements({ subject, stage });
    const ticks = await getTicks(student.id, subject);
    const tickedIds = new Set(ticks.map(t => t.statement_id));

    const ticked = allStatements.filter(s => tickedIds.has(s.id));
    if (!ticked.length) return '';

    // Order is established by getStatements (category, subcategory, position).
    // Each statement already contains the {first_name} placeholder where appropriate.
    return PLACEHOLDER + ' ' + ticked.map(s => s.content).join(' ');
  }

  // Full polish flow: collate, depersonalise (defence in depth), call /api/polish,
  // re-personalise, store.
  async function polish(student, subject, archetype = 'solid_at_grade') {
    const rawCollated = await collate(student, subject);
    if (!rawCollated || rawCollated.length < 10) {
      throw new Error('Not enough ticks to polish — select more statements.');
    }

    // Depersonalise (defence in depth — content from bank should already use placeholder)
    const safeRaw = depersonalise(rawCollated, student.first_name);
    const teacherFeedbackRaw = await getTeacherFeedback(student.id, subject);
    const safeFeedback = depersonalise(teacherFeedbackRaw, student.first_name);

    // Final guard: if the student's name is still in there, refuse to send.
    if (!isDepersonalised(safeRaw, student.first_name) || !isDepersonalised(safeFeedback, student.first_name)) {
      throw new Error('Refusing to send — student name still present in payload.');
    }

    const accessToken = window.RG.auth.getAccessToken();
    if (!accessToken) throw new Error('Not signed in.');

    const stage = stageForYearGroup(student._yearGroup);

    const res = await fetch('/api/polish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        rawText: safeRaw,
        teacherFeedback: safeFeedback,
        gender: student.gender,
        archetype,
        stage,
        accessToken,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Polish response error:', res.status, err);
      const msg = err.detail ? `${err.error || 'Polish failed'}: ${err.detail}` : (err.error || `Polish failed: ${res.status}`);
      throw new Error(msg);
    }

    const { polished, exemplarUsed } = await res.json();

    // Re-personalise on the way back
    const personalised = repersonalise(polished, student.first_name);

    // Persist locally
    const saved = await saveOutput({
      student_id: student.id,
      subject,
      content: personalised,
      raw_collated: rawCollated,
      exemplar_used: exemplarUsed,
    });

    return saved;
  }

  function stageForYearGroup(yg) {
    if (!yg) return null;
    const n = String(yg).toUpperCase();
    if (['K', '1', '2'].includes(n)) return 1;
    if (['3', '4'].includes(n)) return 2;
    if (['5', '6'].includes(n)) return 3;
    return null;
  }

  window.RG = window.RG || {};
  window.RG.polish = { collate, polish, stageForYearGroup };
})();
