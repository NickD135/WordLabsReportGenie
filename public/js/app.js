// /js/app.js
//
// Main entry. Wires the UI together once auth is confirmed.
// Holds the active state and re-renders panes as it changes.

(function () {
  const state = {
    classId: null,
    className: null,
    yearGroup: null,
    student: null,
    subject: 'English',
    view: 'byStudent',
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const session = await window.RG.auth.requireAuth();
    if (!session) return;

    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('signOutBtn').addEventListener('click', () => window.RG.auth.signOut());

    await loadClasses();
    bindToolbar();
    bindSettings();
    bindExport();
    rerender();
  });

  async function loadClasses() {
    const classes = await window.RG.db.listClasses();
    const select = document.getElementById('classSwitcher');
    select.innerHTML = '';
    if (!classes.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No class yet — create one';
      select.appendChild(opt);
    }
    for (const c of classes) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} · Year ${c.year_group}`;
      select.appendChild(opt);
    }
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ New class…';
    select.appendChild(newOpt);

    select.addEventListener('change', async () => {
      if (select.value === '__new__') {
        const name = prompt('Class name?');
        if (!name) { select.value = state.classId || ''; return; }
        const yg = prompt('Year group? (K, 1, 2, 3, 4, 5, 6)');
        if (!yg) { select.value = state.classId || ''; return; }
        const cls = await window.RG.db.createClass({ name, year_group: yg });
        await loadClasses();
        document.getElementById('classSwitcher').value = cls.id;
        applyClass(cls);
      } else if (select.value) {
        const cls = (await window.RG.db.listClasses()).find(c => c.id === select.value);
        applyClass(cls);
      }
    });

    if (classes.length) {
      applyClass(classes[0], false);
      select.value = classes[0].id;
    }
  }

  function applyClass(cls, render = true) {
    state.classId = cls.id;
    state.className = cls.name;
    state.yearGroup = cls.year_group;
    state.student = null;
    if (render) rerender();
  }

  function bindToolbar() {
    document.getElementById('subjectSwitcher').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      state.subject = btn.dataset.subject;
      document.querySelectorAll('#subjectSwitcher button').forEach(b => b.classList.toggle('active', b === btn));
      rerender();
    });

    document.getElementById('viewSwitcher').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      state.view = btn.dataset.view;
      document.querySelectorAll('#viewSwitcher button').forEach(b => b.classList.toggle('active', b === btn));
      rerender();
    });

    document.getElementById('addStudentBtn').addEventListener('click', async () => {
      if (!state.classId) { alert('Create a class first.'); return; }
      const name = prompt('First name?');
      if (!name) return;
      const gender = (prompt('Pronouns? (boy / girl / they)') || 'they').toLowerCase();
      await window.RG.db.createStudent({ class_id: state.classId, first_name: name, gender });
      rerender();
    });
  }

  function bindSettings() {
    const modal = document.getElementById('settingsModal');
    const body = document.getElementById('settingsBody');
    document.getElementById('settingsBtn').addEventListener('click', () => {
      modal.classList.add('open');
      renderSettings(body);
    });
    document.getElementById('settingsClose').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  function renderSettings(body) {
    body.innerHTML = `
      <div class="tab-bar">
        <button data-tab="bank" class="active">Statement bank</button>
        <button data-tab="prompts">Prompts</button>
        <button data-tab="exemplars">Exemplars</button>
      </div>
      <div id="settingsContent"></div>
    `;
    const content = body.querySelector('#settingsContent');
    const renderers = {
      bank: (c) => window.RG.settings.statementBank.render(c),
      prompts: (c) => window.RG.settings.prompts.render(c),
      exemplars: (c) => window.RG.settings.exemplars.render(c),
    };
    body.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        body.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
        renderers[btn.dataset.tab](content);
      });
    });
    renderers.bank(content);
  }

  function bindExport() {
    document.getElementById('exportBtn').addEventListener('click', async () => {
      if (!state.classId) { alert('No class selected.'); return; }
      const choice = prompt('Export as: csv / doc', 'csv');
      if (!choice) return;
      const { klass, rows } = await window.RG.export.exportClass(state.classId);
      if (choice.toLowerCase() === 'csv') window.RG.export.downloadCsv(klass, rows);
      else window.RG.export.downloadDocxStub(klass, rows);
    });
  }

  async function rerender() {
    await renderLeft();
    await renderMiddle();
    await renderRight();
  }

  async function renderLeft() {
    const el = document.getElementById('classList');
    await window.RG.views.classList.render(el, {
      classId: state.classId,
      className: state.className,
      yearGroup: state.yearGroup,
      selectedStudentId: state.student?.id,
      onSelect: (stu) => {
        attachYearGroup(stu);
        state.student = stu;
        rerender();
      },
    });
  }

  async function renderMiddle() {
    const el = document.getElementById('workArea');
    if (state.view === 'byStudent') {
      attachYearGroup(state.student);
      await window.RG.views.byStudent.render(el, {
        student: state.student,
        subject: state.subject,
        onChange: () => renderLeft().then(renderRight),
      });
    } else {
      await window.RG.views.byStatement.render(el, {
        classId: state.classId,
        subject: state.subject,
        onChange: () => renderLeft(),
      });
    }
  }

  async function renderRight() {
    const el = document.getElementById('outputArea');
    attachYearGroup(state.student);
    await window.RG.views.outputPanel.render(el, {
      student: state.student,
      subject: state.subject,
    });
  }

  function attachYearGroup(stu) {
    if (stu) stu._yearGroup = state.yearGroup;
  }
})();
