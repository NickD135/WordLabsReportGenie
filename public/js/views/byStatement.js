// /js/views/byStatement.js
//
// Middle pane in By Statement mode.
// One section at a time, students down the side, statements across the top.
// Tick a column header (whole-class checkbox) to apply to everyone.

(function () {
  async function render(container, { classId, subject, currentSection = null, onChange }) {
    container.innerHTML = '';
    if (!classId) {
      container.innerHTML = '<p class="work-empty">No class selected.</p>';
      return;
    }

    const students = await window.RG.db.listStudents(classId);
    if (!students.length) {
      container.innerHTML = '<p class="work-empty">No students in this class yet. Add some from the rail.</p>';
      return;
    }
    students.sort((a, b) => a.first_name.localeCompare(b.first_name));

    const stage = window.RG.polish.stageForYearGroup(students[0]._yearGroup);
    const allStatements = await window.RG.bank.getStatements({ subject, stage });
    const sections = collectSections(allStatements);
    const activeKey = currentSection && sections.find(s => s.key === currentSection)
      ? currentSection
      : sections[0]?.key;

    if (!activeKey) {
      container.innerHTML = `<p class="work-empty">No ${escapeHtml(subject)} statements available for Stage ${stage ?? '?'}.</p>`;
      return;
    }

    // Section selector
    const toolbar = document.createElement('div');
    toolbar.className = 'bystmt-toolbar';
    toolbar.innerHTML = '<span class="label-mono">Section</span>';
    const sel = document.createElement('select');
    for (const s of sections) {
      const opt = document.createElement('option');
      opt.value = s.key;
      opt.textContent = s.label;
      if (s.key === activeKey) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => render(container, { classId, subject, currentSection: sel.value, onChange }));
    toolbar.appendChild(sel);
    container.appendChild(toolbar);

    const sectionStatements = allStatements.filter(s => sectionKey(s) === activeKey);

    // Pre-load ticks
    const tickMap = new Map();
    for (const stu of students) {
      const ticks = await window.RG.db.getTicks(stu.id, subject);
      tickMap.set(stu.id, new Set(ticks.map(t => t.statement_id)));
    }

    const wrap = document.createElement('div');
    wrap.className = 'bystmt-table-wrap';
    const table = document.createElement('table');
    table.className = 'bystmt-table';

    // Header
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.textContent = 'Student';
    headRow.appendChild(corner);

    for (const stmt of sectionStatements) {
      const th = document.createElement('th');
      const allCb = document.createElement('input');
      allCb.type = 'checkbox';
      allCb.title = 'Tick for all students';
      allCb.checked = students.every(s => tickMap.get(s.id).has(stmt.id));
      allCb.addEventListener('change', async (e) => {
        const target = e.target.checked;
        for (const stu of students) {
          await window.RG.db.setTick(stu.id, subject, stmt.id, target);
          if (target) tickMap.get(stu.id).add(stmt.id); else tickMap.get(stu.id).delete(stmt.id);
        }
        document.querySelectorAll(`input[data-stmt="${stmt.id}"][data-cell]`).forEach(cb => { cb.checked = target; });
        onChange?.();
      });
      th.appendChild(allCb);
      const txt = document.createElement('span');
      txt.className = 'col-stmt';
      txt.textContent = stmt.content;
      th.appendChild(txt);
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const stu of students) {
      const tr = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.textContent = stu.first_name;
      tr.appendChild(nameCell);
      for (const stmt of sectionStatements) {
        const td = document.createElement('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.stmt = stmt.id;
        cb.dataset.cell = '1';
        cb.checked = tickMap.get(stu.id).has(stmt.id);
        cb.addEventListener('change', async (e) => {
          await window.RG.db.setTick(stu.id, subject, stmt.id, e.target.checked);
          if (e.target.checked) tickMap.get(stu.id).add(stmt.id); else tickMap.get(stu.id).delete(stmt.id);
          onChange?.();
        });
        td.appendChild(cb);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  function sectionKey(s) {
    return `${s.category}::${s.subcategory || ''}`;
  }

  function collectSections(statements) {
    const seen = new Map();
    for (const s of statements) {
      const key = sectionKey(s);
      if (!seen.has(key)) {
        const label = s.subcategory ? `${s.category} — ${s.subcategory}` : s.category;
        seen.set(key, { key, label });
      }
    }
    return [...seen.values()];
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.RG = window.RG || {};
  window.RG.views = window.RG.views || {};
  window.RG.views.byStatement = { render };
})();
