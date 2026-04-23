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
    const cfg = window.RG.config.categoryOrder;
    const sections = cfg.tabsForSubject(subject, allStatements);
    const activeKey = currentSection && sections.includes(currentSection)
      ? currentSection
      : sections[0];

    if (!activeKey) {
      container.innerHTML = `<p class="work-empty">No ${escapeHtml(subject)} statements available for Stage ${stage ?? '?'}.</p>`;
      return;
    }

    const sectionStatements = cfg.sortStatements(
      subject,
      allStatements.filter(s => cfg.tabKeyFor(subject, s) === activeKey)
    );

    // Pre-load ticks for every student up front so we can compute class
    // wide tick counts per tab.
    const tickMap = new Map();
    for (const stu of students) {
      const ticks = await window.RG.db.getTicks(stu.id, subject);
      tickMap.set(stu.id, new Set(ticks.map(t => t.statement_id)));
    }

    // Count ticks across the class for each tab. The indicator shows
    // "X / Y" where Y is (statements in section) * (students in class)
    // and X is how many of those cells are ticked.
    const tabCounts = {};
    for (const tabKey of sections) {
      const tabStmts = allStatements.filter(s => cfg.tabKeyFor(subject, s) === tabKey);
      const total = tabStmts.length * students.length;
      let ticked = 0;
      for (const stu of students) {
        const set = tickMap.get(stu.id);
        for (const stmt of tabStmts) {
          if (set.has(stmt.id)) ticked++;
        }
      }
      tabCounts[tabKey] = { total, ticked };
    }

    // Tab bar. Clicking a tab re-renders the view with that section active;
    // the table shape depends on the tab so a re-render is the simplest path.
    const tabBar = document.createElement('div');
    tabBar.className = 'section-tabs';
    const tabButtons = {};
    for (const tabKey of sections) {
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
      if (tabKey === activeKey) btn.classList.add('active');
      btn.addEventListener('click', () => {
        if (tabKey === activeKey) return;
        render(container, { classId, subject, currentSection: tabKey, onChange });
      });
      tabButtons[tabKey] = btn;
      tabBar.appendChild(btn);
    }
    container.appendChild(tabBar);

    function bumpActiveCount(delta) {
      tabCounts[activeKey].ticked += delta;
      tabButtons[activeKey].querySelector('.count').textContent =
        `${tabCounts[activeKey].ticked} / ${tabCounts[activeKey].total}`;
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
        let changed = 0;
        for (const stu of students) {
          const had = tickMap.get(stu.id).has(stmt.id);
          if (had !== target) changed++;
          await window.RG.db.setTick(stu.id, subject, stmt.id, target);
          if (target) tickMap.get(stu.id).add(stmt.id); else tickMap.get(stu.id).delete(stmt.id);
        }
        document.querySelectorAll(`input[data-stmt="${stmt.id}"][data-cell]`).forEach(cb => { cb.checked = target; });
        bumpActiveCount(target ? changed : -changed);
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
          bumpActiveCount(e.target.checked ? 1 : -1);
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

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.RG = window.RG || {};
  window.RG.views = window.RG.views || {};
  window.RG.views.byStatement = { render };
})();
