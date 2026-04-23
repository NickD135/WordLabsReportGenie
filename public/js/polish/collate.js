// /js/polish/collate.js
//
// Assembles the raw text from ticked statements and orchestrates the polish call.
//
// The collate step groups ticked statements into a structured object
// (strengths vs goals for English/Maths; a single content bucket for
// General, plus openings/closings) so the downstream serialiser can
// produce a labelled prompt block. Keeping the split explicit at
// collation time stops Claude from reshuffling goals into achievements.

(function () {
  const { getTicks, getTeacherFeedback, saveOutput } = window.RG.db;
  const { getStatements } = window.RG.bank;
  const { depersonalise, repersonalise, isDepersonalised } = window.RG.placeholder;
  const { tabKeyFor, innerSubcategoryFor, sortStatements } = window.RG.config.categoryOrder;

  // Build a structured collation for one student/subject. Returns
  // null if there are no ticked statements. Shape:
  //   English / Maths:
  //     { subject, openings: [str], strengths: { tab: [str] }, goals: { tab: [str] } }
  //   General:
  //     { subject, openings: [str], content: { category: [str] }, closings: [str] }
  async function collate(student, subject) {
    const stage = stageForYearGroup(student._yearGroup);
    const allStatements = await getStatements({ subject, stage });
    const ticks = await getTicks(student.id, subject);
    const tickedIds = new Set(ticks.map(t => t.statement_id));

    const tickedRaw = allStatements.filter(s => tickedIds.has(s.id));
    if (!tickedRaw.length) return null;

    const ticked = sortStatements(subject, tickedRaw);

    if (subject === 'General') {
      return bucketGeneral(ticked);
    }
    return bucketEnglishOrMaths(subject, ticked);
  }

  function bucketEnglishOrMaths(subject, ticked) {
    const out = { subject, openings: [], strengths: {}, goals: {} };
    for (const s of ticked) {
      const tab = tabKeyFor(subject, s);
      if ((s.category || '') === 'Opening') {
        out.openings.push(s.content);
        continue;
      }
      const inner = innerSubcategoryFor(subject, s) || '';
      if (inner.includes('Strengths')) {
        out.strengths[tab] = out.strengths[tab] || [];
        out.strengths[tab].push(s.content);
      } else if (inner.includes('Goals')) {
        out.goals[tab] = out.goals[tab] || [];
        out.goals[tab].push(s.content);
      }
      // Statements with no recognisable inner label are dropped from the
      // prompt rather than mis-filed — the collate step must not guess.
    }
    return out;
  }

  function bucketGeneral(ticked) {
    const out = { subject: 'General', openings: [], content: {}, closings: [] };
    for (const s of ticked) {
      const cat = s.category || '';
      if (cat === 'Opening Statements') { out.openings.push(s.content); continue; }
      if (cat === 'Closing Statements') { out.closings.push(s.content); continue; }
      out.content[cat] = out.content[cat] || [];
      out.content[cat].push(s.content);
    }
    return out;
  }

  // Turn the structured object into a labelled text block suitable for
  // the user message to Claude. The labels (OPENING / STRENGTHS / GOALS /
  // CONTENT / CLOSING) are the anchors the prompt relies on to keep
  // strengths and goals apart in the final comment.
  function serialiseCollation(structured, subject) {
    if (!structured) return '';

    const lines = [];
    // Preamble names the placeholder explicitly. Guarantees {first_name}
    // appears in the serialised text even when none of the ticked
    // statements reference the student by name (common for General,
    // which often uses statements like "shows strong collaboration"),
    // so the server-side placeholder guard does not false-fire.
    lines.push('Notes to polish into a report comment for {first_name}:');
    lines.push('');

    const pushOpenings = () => {
      if (!structured.openings || !structured.openings.length) return;
      lines.push('OPENING STATEMENT (use this as the opener):');
      for (const t of structured.openings) lines.push(t);
      lines.push('');
    };

    if (subject === 'General') {
      pushOpenings();
      lines.push("CONTENT — these statements describe the student's work habits, dispositions and KLA achievements. Preserve their intent when rephrasing.");
      lines.push('');
      const cats = Object.keys(structured.content || {});
      if (cats.length) {
        for (const cat of cats) {
          lines.push(`${cat}:`);
          for (const t of structured.content[cat]) lines.push(`- ${t}`);
          lines.push('');
        }
      } else {
        lines.push('(None selected for this comment.)');
        lines.push('');
      }
      if (structured.closings && structured.closings.length) {
        lines.push('CLOSING STATEMENT (use this as the closer):');
        for (const t of structured.closings) lines.push(t);
        lines.push('');
      }
      return lines.join('\n').trim();
    }

    // English / Maths — always emit STRENGTHS and GOALS headers so the
    // downstream prompt and the server-side label check see a consistent
    // structure even when the teacher has ticked an asymmetric set.
    pushOpenings();

    lines.push('STRENGTHS — these describe what the student CAN DO. They MUST appear in the achievement paragraph.');
    lines.push('');
    const strengthTabs = Object.keys(structured.strengths || {});
    if (strengthTabs.length) {
      for (const tab of strengthTabs) {
        lines.push(`${tab}:`);
        for (const t of structured.strengths[tab]) lines.push(`- ${t}`);
        lines.push('');
      }
    } else {
      lines.push('(None selected for this comment — omit the achievement paragraph.)');
      lines.push('');
    }

    lines.push('GOALS — these describe what the student is WORKING ON. They MUST appear in the growth paragraph. Under no circumstances may a goal be rephrased as an achievement.');
    lines.push('');
    const goalTabs = Object.keys(structured.goals || {});
    if (goalTabs.length) {
      for (const tab of goalTabs) {
        lines.push(`${tab}:`);
        for (const t of structured.goals[tab]) lines.push(`- ${t}`);
        lines.push('');
      }
    } else {
      lines.push('(None selected for this comment — omit the growth paragraph.)');
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  // Convenience wrapper used by the output panel preview.
  async function collateText(student, subject) {
    const structured = await collate(student, subject);
    return serialiseCollation(structured, subject);
  }

  // Full polish flow: collate, serialise, depersonalise (defence in depth),
  // call /api/polish, re-personalise, store.
  async function polish(student, subject, archetype = 'solid_at_grade') {
    const structured = await collate(student, subject);
    const rawCollated = serialiseCollation(structured, subject);
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

    const personalised = repersonalise(polished, student.first_name);

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
  window.RG.polish = { collate, collateText, serialiseCollation, polish, stageForYearGroup };
})();
