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

    // Canonical grouping: tab key > inner subcategory, Strengths before Goals.
    const cfg = window.RG.config.categoryOrder;
    const grouped = cfg.groupByTabAndSubcategory(subject, statements);
    const tabs = cfg.tabsForSubject(subject, statements);

    // Tab bar. One tab per canonical section, with a compact "ticked / total"
    // indicator beside each label so the teacher can see at a glance which
    // sections still need attention. Active tab gets the wax-seal underline.
    const tabBar = document.createElement('div');
    tabBar.className = 'section-tabs';
    const tabButtons = {};
    const sectionEls = {};

    const tabCounts = {};
    for (const tabKey of tabs) {
      const subcats = grouped[tabKey] || {};
      tabCounts[tabKey] = {
        total: countTotal(subcats),
        ticked: countTicked(subcats, tickedIds),
      };
    }

    function setActive(key) {
      for (const [k, btn] of Object.entries(tabButtons)) {
        btn.classList.toggle('active', k === key);
      }
      for (const [k, el] of Object.entries(sectionEls)) {
        el.style.display = k === key ? '' : 'none';
      }
    }

    for (const tabKey of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.tab = tabKey;
      const label = document.createElement('span');
      label.textContent = tabKey;
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = `${tabCounts[tabKey].ticked} / ${tabCounts[tabKey].total}`;
      btn.appendChild(label);
      btn.appendChild(count);
      btn.addEventListener('click', () => setActive(tabKey));
      tabButtons[tabKey] = btn;
      tabBar.appendChild(btn);
    }
    container.appendChild(tabBar);

    for (const tabKey of tabs) {
      const subcats = grouped[tabKey] || {};
      const section = document.createElement('section');
      section.className = 'section';

      const innerKeys = Object.keys(subcats).sort(
        (a, b) => cfg.subcategoryOrderIndex(a) - cfg.subcategoryOrderIndex(b)
      );
      for (const subcat of innerKeys) {
        const items = subcats[subcat];
        if (subcat) {
          const sh = document.createElement('div');
          sh.className = 'subhead';
          sh.textContent = subcat;
          section.appendChild(sh);
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
            if (newState) {
              tickedIds.add(stmt.id);
              tabCounts[tabKey].ticked++;
            } else {
              tickedIds.delete(stmt.id);
              tabCounts[tabKey].ticked--;
            }
            const countEl = tabButtons[tabKey].querySelector('.count');
            countEl.textContent = `${tabCounts[tabKey].ticked} / ${tabCounts[tabKey].total}`;
            onChange?.();
          });

          list.appendChild(li);
        }
        section.appendChild(list);
      }

      sectionEls[tabKey] = section;
      container.appendChild(section);
    }

    // Default to the first tab active.
    setActive(tabs[0]);

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
