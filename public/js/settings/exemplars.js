// /js/settings/exemplars.js
//
// Edit the exemplar bank. One exemplar per (subject, archetype, stage).

(function () {
  const SUBJECTS = ['English', 'Maths', 'General'];

  async function render(container) {
    container.innerHTML = '';
    let activeSubject = 'English';

    function rebuild() {
      container.innerHTML = '';
      const tabBar = document.createElement('div');
      tabBar.className = 'flex gap-2 mb-3 border-b border-slate-200';
      for (const s of SUBJECTS) {
        const btn = document.createElement('button');
        btn.className = `px-3 py-2 text-sm ${s === activeSubject ? 'border-b-2 border-blue-600 font-semibold' : 'text-slate-500'}`;
        btn.textContent = s;
        btn.addEventListener('click', () => { activeSubject = s; rebuild(); });
        tabBar.appendChild(btn);
      }
      container.appendChild(tabBar);

      const body = document.createElement('div');
      body.className = 'space-y-3';
      container.appendChild(body);
      renderSubject(body, activeSubject);
    }

    rebuild();
  }

  async function renderSubject(container, subject) {
    container.innerHTML = '<p class="text-sm text-slate-500">Loading exemplars...</p>';
    const exemplars = await window.RG.bank.getExemplars(subject);
    container.innerHTML = '';

    for (const ex of exemplars) {
      const card = document.createElement('section');
      card.className = 'border border-slate-200 rounded';
      const stageLabel = ex.stage ? `Stage ${ex.stage}` : 'All stages';
      card.innerHTML = `
        <div class="px-3 py-2 bg-slate-100 text-sm font-semibold flex items-center justify-between">
          <span>${ex.archetype.replace(/_/g, ' ')} <span class="text-xs text-slate-500 ml-2">${stageLabel}</span></span>
        </div>
        <div class="p-3 space-y-2">
          ${ex.notes ? `<p class="text-xs text-slate-500">${escapeHtml(ex.notes)}</p>` : ''}
          <textarea class="w-full border border-slate-300 rounded px-2 py-1 text-sm" rows="6" placeholder="Paste an exemplar comment with {first_name} placeholders..."></textarea>
          <div class="flex justify-end">
            <button class="text-xs px-3 py-1 border border-slate-300 rounded hover:bg-slate-100">Save</button>
          </div>
        </div>
      `;
      const ta = card.querySelector('textarea');
      const btn = card.querySelector('button');
      ta.value = ex.content || '';

      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
          await window.RG.bank.saveOverride({
            table_name: 'exemplars',
            record_id: ex.id,
            override_content: ta.value,
          });
          btn.textContent = '✓ Saved';
          setTimeout(() => { btn.textContent = 'Save'; btn.disabled = false; }, 1500);
        } catch (e) {
          btn.textContent = 'Error';
          btn.disabled = false;
          console.error(e);
        }
      });

      container.appendChild(card);
    }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.RG = window.RG || {};
  window.RG.settings = window.RG.settings || {};
  window.RG.settings.exemplars = { render };
})();
