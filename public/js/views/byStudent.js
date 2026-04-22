// /js/views/byStudent.js
//
// Middle pane in By Student mode.
// One student, all sections for the subject, custom tick boxes,
// teacher feedback box at the bottom.

(function () {
  const PRONOUN_LABEL = { boy: 'he / him', girl: 'she / her', they: 'they / them' };

  async function render(container, { student, subject, onChange }) {
    container.innerHTML = '';
    if (!student) {
      container.innerHTML = '<p class="work-empty">Select a student from the rail to begin, or add one with the button at the top of the list.</p>';
      return;
    }

    // Header: "Ben's English comment" with italic possessive in seal red
    const header = document.createElement('div');
    header.className = 'student-header';
    const h1 = document.createElement('h1');
    const namePart = document.createTextNode(student.first_name);
    const possessive = document.createElement('em');
    possessive.textContent = "'s";
    h1.appendChild(namePart);
    h1.appendChild(possessive);
    h1.appendChild(document.createTextNode(` ${subject} comment`));
    header.appendChild(h1);
    container.appendChild(header);

    // Meta line
    const yg = student._yearGroup || '?';
    const stage = window.RG.polish.stageForYearGroup(yg);
    const meta = document.createElement('div');
    meta.className = 'student-meta';
    meta.innerHTML = `<span>Year ${escapeHtml(yg)}</span><span>Stage ${escapeHtml(stage ?? '—')}</span><span>${escapeHtml(PRONOUN_LABEL[student.gender] || 'they / them')}</span>`;
    container.appendChild(meta);

    // Profile tags
    if (student.profile_tags?.length) {
      const tags = document.createElement('div');
      tags.className = 'tag-row';
      for (const t of student.profile_tags) {
        const chip = document.createElement('span');
        chip.className = 'tag';
        chip.textContent = t;
        tags.appendChild(chip);
      }
      container.appendChild(tags);
    }

    // Pull statements + ticks
    const [statements, ticks] = await Promise.all([
      window.RG.bank.getStatements({ subject, stage }),
      window.RG.db.getTicks(student.id, subject),
    ]);
    const tickedIds = new Set(ticks.map(t => t.statement_id));

    if (!statements.length) {
      const empty = document.createElement('p');
      empty.className = 'work-empty';
      empty.textContent = `No ${subject} statements available for Stage ${stage ?? '?'}. Add some in Settings.`;
      container.appendChild(empty);
      return;
    }

    // Group by category > subcategory
    const grouped = groupStatements(statements);

    for (const [category, subcats] of Object.entries(grouped)) {
      const section = document.createElement('section');
      section.className = 'section';

      const head = document.createElement('div');
      head.className = 'section-head';
      const total = countTotal(subcats);
      const ticked = countTicked(subcats, tickedIds);
      head.innerHTML = `<h3>${escapeHtml(category)}</h3><span class="count">${ticked} of ${total} ticked</span>`;
      section.appendChild(head);

      const body = document.createElement('div');
      head.addEventListener('click', () => body.style.display = body.style.display === 'none' ? '' : 'none');
      section.appendChild(body);

      for (const [subcat, items] of Object.entries(subcats)) {
        if (subcat) {
          const sh = document.createElement('div');
          sh.className = 'subhead';
          sh.textContent = subcat;
          body.appendChild(sh);
        }
        const list = document.createElement('ul');
        list.className = 'stmt-list';
        for (const stmt of items) {
          const li = document.createElement('li');
          li.className = 'stmt' + (tickedIds.has(stmt.id) ? ' ticked' : '');

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = tickedIds.has(stmt.id);

          const check = document.createElement('span');
          check.className = 'check';

          const text = document.createElement('span');
          text.textContent = stmt.content;

          li.appendChild(cb);
          li.appendChild(check);
          li.appendChild(text);

          li.addEventListener('click', async (e) => {
            e.preventDefault();
            const newState = !li.classList.contains('ticked');
            li.classList.toggle('ticked', newState);
            cb.checked = newState;
            await window.RG.db.setTick(student.id, subject, stmt.id, newState);
            if (newState) tickedIds.add(stmt.id); else tickedIds.delete(stmt.id);
            head.querySelector('.count').textContent = `${countTicked(subcats, tickedIds)} of ${total} ticked`;
            onChange?.();
          });

          list.appendChild(li);
        }
        body.appendChild(list);
      }

      container.appendChild(section);
    }

    // Teacher feedback box
    const fb = document.createElement('div');
    fb.className = 'feedback-box';
    fb.innerHTML = `
      <label>Extra context for the polish</label>
      <p class="help">Free text. Names will be replaced with placeholders before being sent.</p>
      <textarea placeholder="Anything else worth knowing — recent growth, areas of focus this term, things parents should hear..."></textarea>
    `;
    container.appendChild(fb);
    const fbTa = fb.querySelector('textarea');
    fbTa.value = await window.RG.db.getTeacherFeedback(student.id, subject);
    let saveTimer;
    fbTa.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        window.RG.db.setTeacherFeedback(student.id, subject, fbTa.value);
      }, 500);
    });
  }

  function groupStatements(statements) {
    const out = {};
    for (const s of statements) {
      const cat = s.category || 'Uncategorised';
      const sub = s.subcategory || '';
      out[cat] = out[cat] || {};
      out[cat][sub] = out[cat][sub] || [];
      out[cat][sub].push(s);
    }
    return out;
  }

  function countTotal(subcats) {
    let n = 0;
    for (const items of Object.values(subcats)) n += items.length;
    return n;
  }

  function countTicked(subcats, tickedIds) {
    let n = 0;
    for (const items of Object.values(subcats)) {
      for (const s of items) if (tickedIds.has(s.id)) n++;
    }
    return n;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.RG = window.RG || {};
  window.RG.views = window.RG.views || {};
  window.RG.views.byStudent = { render };
})();
