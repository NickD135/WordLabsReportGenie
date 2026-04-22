// /js/settings/prompts.js
//
// Edit the system prompts and word count constraints for each subject.
// Saves as a teacher_overrides record.

(function () {
  const SUBJECTS = ['English', 'Maths', 'General'];

  async function render(container) {
    container.innerHTML = '';

    for (const subject of SUBJECTS) {
      const wrap = document.createElement('section');
      wrap.className = 'border border-slate-200 rounded mb-3';
      wrap.innerHTML = `
        <div class="px-3 py-2 bg-slate-100 font-semibold text-sm">${subject} prompt</div>
        <div class="p-3 space-y-2">
          <p class="text-xs text-slate-500">
            Use <code>{style_guide}</code> and <code>{exemplar}</code> as injection points.
            The endpoint replaces these at request time.
          </p>
          <textarea class="w-full border border-slate-300 rounded px-2 py-1 text-sm font-mono" rows="14"></textarea>
          <div class="flex items-center gap-3">
            <label class="text-xs">Min words <input type="number" class="w-16 border border-slate-300 rounded px-1 ml-1 wcMin" /></label>
            <label class="text-xs">Max words <input type="number" class="w-16 border border-slate-300 rounded px-1 ml-1 wcMax" /></label>
            <button class="ml-auto text-xs px-3 py-1 border border-slate-300 rounded hover:bg-slate-100">Save</button>
          </div>
        </div>
      `;
      const ta = wrap.querySelector('textarea');
      const wcMin = wrap.querySelector('.wcMin');
      const wcMax = wrap.querySelector('.wcMax');
      const saveBtn = wrap.querySelector('button');

      const promptCfg = await window.RG.bank.getPrompt(subject);
      ta.value = promptCfg.content;
      wcMin.value = promptCfg.word_count_min;
      wcMax.value = promptCfg.word_count_max;

      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
          await window.RG.bank.saveOverride({
            table_name: 'prompts',
            record_id: promptCfg.id,
            override_content: ta.value,
          });
          // Note: word counts not yet stored as override — extend schema to support if needed.
          saveBtn.textContent = '✓ Saved';
          setTimeout(() => { saveBtn.textContent = 'Save'; saveBtn.disabled = false; }, 1500);
        } catch (e) {
          saveBtn.textContent = 'Error';
          saveBtn.disabled = false;
          console.error(e);
        }
      });

      container.appendChild(wrap);
    }
  }

  window.RG = window.RG || {};
  window.RG.settings = window.RG.settings || {};
  window.RG.settings.prompts = { render };
})();
