// /js/views/outputPanel.js
//
// Right pane: the polished comment as a published artefact.
// Composition card with raw collated text (collapsed), polish button,
// editable polished comment, version picker in the meta strip,
// quality flags below.

(function () {
  const ARCHETYPES = [
    { value: 'strong_all_rounder',    label: 'Strong all-rounder' },
    { value: 'solid_at_grade',        label: 'Solid at-grade' },
    { value: 'working_towards',       label: 'Working towards' },
    { value: 'inconsistent_capable',  label: 'Inconsistent / capable' },
    { value: 'quiet_achiever',        label: 'Quiet achiever' },
  ];

  async function render(container, { student, subject }) {
    container.innerHTML = '';
    if (!student) {
      container.innerHTML = '<p class="work-empty" style="margin: 0; font-size: 14px;">The polished comment will appear here once a student is selected.</p>';
      return;
    }

    // Archetype picker
    const archWrap = document.createElement('div');
    archWrap.className = 'archetype-pick';
    archWrap.innerHTML = '<label>Archetype for exemplar</label>';
    const archSelect = document.createElement('select');
    for (const a of ARCHETYPES) {
      const opt = document.createElement('option');
      opt.value = a.value;
      opt.textContent = a.label;
      archSelect.appendChild(opt);
    }
    archWrap.appendChild(archSelect);
    container.appendChild(archWrap);

    // Raw collated preview (collapsed by default)
    const raw = document.createElement('details');
    raw.className = 'raw-collapsed';
    const rawSummary = document.createElement('summary');
    rawSummary.textContent = 'Raw collated text';
    raw.appendChild(rawSummary);
    const rawBody = document.createElement('div');
    rawBody.className = 'raw-body';
    rawBody.textContent = await window.RG.polish.collateText(student, subject) || '(no statements ticked yet)';
    raw.appendChild(rawBody);
    container.appendChild(raw);

    // Polish button
    const polishBtn = document.createElement('button');
    polishBtn.className = 'polish-btn';
    polishBtn.innerHTML = '<span class="glyph">~</span> Polish';
    container.appendChild(polishBtn);

    // Status line (errors)
    const statusEl = document.createElement('p');
    statusEl.className = 'status-line';
    statusEl.style.display = 'none';
    container.appendChild(statusEl);

    // Composition card
    const composition = document.createElement('div');
    composition.className = 'composition';
    composition.style.display = 'none';
    composition.innerHTML = `
      <div class="composition-meta">
        <span class="label">Polished comment</span>
        <select class="versionPicker"></select>
      </div>
      <textarea class="composition-textarea" placeholder="Tick some statements and press Polish to draft a comment."></textarea>
      <div class="quality"></div>
    `;
    container.appendChild(composition);

    const metaSelect = composition.querySelector('.versionPicker');
    const ta = composition.querySelector('.composition-textarea');
    const qualityEl = composition.querySelector('.quality');

    const outputs = await window.RG.db.listOutputs(student.id, subject);
    let activeOutput = outputs[0] || null;

    function renderVersionPicker() {
      metaSelect.innerHTML = '';
      if (outputs.length === 0) { metaSelect.style.display = 'none'; return; }
      metaSelect.style.display = '';
      for (const o of outputs) {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = `v${o.version} · ${formatTime(o.created_at)}`;
        if (o.id === activeOutput?.id) opt.selected = true;
        metaSelect.appendChild(opt);
      }
    }

    metaSelect.addEventListener('change', () => {
      activeOutput = outputs.find(o => o.id === metaSelect.value) || null;
      paint();
    });

    function paint() {
      ta.value = activeOutput?.content || '';
      runQuality();
    }

    async function runQuality() {
      qualityEl.innerHTML = '';
      if (!ta.value.trim()) return;
      const promptCfg = await window.RG.bank.getPrompt(subject);
      const issues = window.RG.quality.check(ta.value, {
        firstName: student.first_name,
        wordCountMin: promptCfg.word_count_min,
        wordCountMax: promptCfg.word_count_max,
      });
      const wc = ta.value.trim().split(/\s+/).length;
      const wcLine = document.createElement('div');
      const inRange = wc >= promptCfg.word_count_min && wc <= promptCfg.word_count_max;
      wcLine.className = 'quality-line' + (inRange ? '' : ' warn');
      wcLine.innerHTML = `<span class="glyph">${inRange ? '✓' : '~'}</span><span>${wc} WORDS · ${inRange ? 'WITHIN RANGE' : `TARGET ${promptCfg.word_count_min}–${promptCfg.word_count_max}`}</span>`;
      qualityEl.appendChild(wcLine);

      if (!issues.length) {
        const ok = document.createElement('div');
        ok.className = 'quality-line';
        ok.innerHTML = '<span class="glyph">✓</span><span>NO OTHER FLAGS</span>';
        qualityEl.appendChild(ok);
      } else {
        for (const issue of issues) {
          // Skip the word-count one we already showed
          if (/words/i.test(issue) && /short|long/i.test(issue)) continue;
          const line = document.createElement('div');
          line.className = 'quality-line warn';
          line.innerHTML = `<span class="glyph">~</span><span>${issue.toUpperCase()}</span>`;
          qualityEl.appendChild(line);
        }
      }

      // Repetition advisory (silent when no flags)
      const repFlags = window.RG.repetitionCheck?.check(ta.value) || [];
      if (repFlags.length) {
        const line = document.createElement('div');
        line.className = 'quality-line warn repetition';
        const words = repFlags
          .map(f => `<em>${escapeHtml(f.word)}</em> (${f.count})`)
          .join(', ');
        line.innerHTML = `<span class="glyph">⚠</span><span class="rep-label">Possible repetition:</span><span class="rep-words">${words}</span>`;
        qualityEl.appendChild(line);
      }
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    let saveTimer;
    ta.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        if (activeOutput) await window.RG.db.updateOutput(activeOutput.id, ta.value);
        runQuality();
      }, 500);
    });

    polishBtn.addEventListener('click', async () => {
      polishBtn.disabled = true;
      polishBtn.innerHTML = '<span class="glyph">~</span> Polishing...';
      statusEl.style.display = 'none';
      try {
        const saved = await window.RG.polish.polish(student, subject, archSelect.value);
        outputs.unshift(saved);
        activeOutput = saved;
        composition.style.display = '';
        renderVersionPicker();
        paint();
        rawBody.textContent = saved.raw_collated || rawBody.textContent;
      } catch (err) {
        statusEl.textContent = err.message;
        statusEl.className = 'status-line error';
        statusEl.style.display = '';
      } finally {
        polishBtn.disabled = false;
        polishBtn.innerHTML = `<span class="glyph">~</span> ${activeOutput ? 'Regenerate' : 'Polish'}`;
      }
    });

    if (activeOutput) {
      composition.style.display = '';
      polishBtn.innerHTML = '<span class="glyph">~</span> Regenerate';
      renderVersionPicker();
      paint();
    }
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-AU', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' });
  }

  window.RG = window.RG || {};
  window.RG.views = window.RG.views || {};
  window.RG.views.outputPanel = { render };
})();
