// /js/settings/statementBank.js
//
// Edit the statement bank: edit master statements (creates an override),
// add new statements, reset overrides.

(function () {
  async function render(container) {
    container.innerHTML = '<p class="text-sm text-slate-500">Loading statements...</p>';
    const tabs = ['English', 'Maths', 'General'];
    let active = 'English';

    function rebuild() {
      container.innerHTML = '';
      const tabBar = document.createElement('div');
      tabBar.className = 'flex gap-2 mb-3 border-b border-slate-200';
      for (const t of tabs) {
        const btn = document.createElement('button');
        btn.className = `px-3 py-2 text-sm ${t === active ? 'border-b-2 border-blue-600 font-semibold' : 'text-slate-500'}`;
        btn.textContent = t;
        btn.addEventListener('click', () => { active = t; rebuild(); });
        tabBar.appendChild(btn);
      }
      container.appendChild(tabBar);

      const body = document.createElement('div');
      body.className = 'space-y-3';
      container.appendChild(body);
      renderSubject(body, active);
    }

    rebuild();
  }

  async function renderSubject(container, subject) {
    container.innerHTML = '<p class="text-sm text-slate-500">Loading...</p>';
    const statements = await window.RG.bank.getStatements({ subject });
    container.innerHTML = '';

    // Group by category
    const grouped = {};
    for (const s of statements) {
      const k = s.category;
      grouped[k] = grouped[k] || [];
      grouped[k].push(s);
    }

    for (const [cat, items] of Object.entries(grouped)) {
      const section = document.createElement('section');
      section.className = 'border border-slate-200 rounded';
      const head = document.createElement('div');
      head.className = 'px-3 py-2 bg-slate-100 font-semibold text-sm';
      head.textContent = cat;
      section.appendChild(head);
      const body = document.createElement('div');
      body.className = 'p-2 space-y-1';
      for (const s of items) {
        const wrap = document.createElement('div');
        const row = document.createElement('div');
        row.className = 'flex gap-2 items-start';
        const ta = document.createElement('textarea');
        ta.className = 'flex-1 border border-slate-300 rounded px-2 py-1 text-sm';
        ta.rows = 2;
        ta.value = s.content;
        const saveBtn = document.createElement('button');
        saveBtn.className = 'text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-100';
        saveBtn.textContent = 'Save';
        const errEl = document.createElement('div');
        errEl.className = 'settings-error';
        errEl.hidden = true;
        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          errEl.hidden = true;
          errEl.textContent = '';
          try {
            await window.RG.bank.saveOverride({
              table_name: 'statements',
              record_id: s.id,
              override_content: ta.value,
            });
            saveBtn.textContent = '✓ Saved';
            setTimeout(() => { saveBtn.textContent = 'Save'; saveBtn.disabled = false; }, 1500);
          } catch (e) {
            saveBtn.textContent = 'Save';
            saveBtn.disabled = false;
            errEl.textContent = e?.message || String(e);
            errEl.hidden = false;
            console.error(e);
          }
        });
        row.appendChild(ta);
        row.appendChild(saveBtn);
        wrap.appendChild(row);
        wrap.appendChild(errEl);
        body.appendChild(wrap);
      }
      section.appendChild(body);
      container.appendChild(section);
    }
  }

  window.RG = window.RG || {};
  window.RG.settings = window.RG.settings || {};
  window.RG.settings.statementBank = { render };
})();
