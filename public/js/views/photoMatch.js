// /js/views/photoMatch.js
//
// Prototype: photo-to-statements matching for English Stage 3.
//
// Renders a small "Match from photo" button above the statement tabs in the
// By Student view. Clicking it opens a modal where the teacher picks a single
// image of student work, previews it (with a privacy warning), then sends it
// to /api/photo-match. The endpoint returns suggested strengths and goals as
// statement IDs with confidence levels. The teacher reviews, ticks the ones
// to keep (high confidence pre-ticked), and applies them — which writes
// straight into the student's IndexedDB tick state for that subject.
//
// Privacy chain: the image is forwarded once to Anthropic via the serverless
// function and not stored anywhere. The teacher is warned to ensure no
// student names are visible in the photo before sending.

(function () {
  let modalEl = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'modal photo-modal';
    modalEl.innerHTML = `
      <div class="modal-card photo-modal-card">
        <div class="modal-head">
          <h2>Match from photo</h2>
          <button class="close" type="button" aria-label="Close">×</button>
        </div>
        <div class="modal-body" id="photoModalBody"></div>
      </div>
    `;
    document.body.appendChild(modalEl);
    modalEl.querySelector('.close').addEventListener('click', closeModal);
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });
    return modalEl;
  }

  function closeModal() {
    if (modalEl) modalEl.classList.remove('open');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Read the file straight to base64 + record its media type. Task 4 swaps
  // this for canvas-based resize + EXIF-strip via window.RG.imagePrep.
  async function prepareImage(file) {
    if (window.RG?.imagePrep?.process) {
      return window.RG.imagePrep.process(file);
    }
    return readFileAsBase64(file);
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const dataUrl = String(r.result || '');
        const idx = dataUrl.indexOf('base64,');
        if (idx < 0) {
          reject(new Error('That file could not be read as an image.'));
          return;
        }
        resolve({
          base64: dataUrl.slice(idx + 'base64,'.length),
          mediaType: file.type || 'image/jpeg',
          dataUrl,
        });
      };
      r.onerror = () => reject(new Error('Could not read that file.'));
      r.readAsDataURL(file);
    });
  }

  async function open({ student, subject, stage, statements, onApplied }) {
    if (subject !== 'English' || Number(stage) !== 3) {
      // Defence in depth — the button is only mounted in this configuration,
      // but make the failure mode loud rather than silent if it ever isn't.
      alert('Photo-matching is currently English Stage 3 only.');
      return;
    }

    const root = ensureModal();
    const body = root.querySelector('#photoModalBody');
    let preparedImage = null;

    function renderPick() {
      preparedImage = null;
      body.innerHTML = `
        <p class="help-text">Upload a single photo of ${escapeHtml(student.first_name)}'s English work. The image is sent to Anthropic for analysis and is not stored.</p>
        <div class="photo-pick">
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" id="photoFileInput" />
          <p class="photo-pick-hint">JPG, PNG, WEBP or HEIC. Maximum 5 MB.</p>
        </div>
      `;
      const input = body.querySelector('#photoFileInput');
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          renderError(`That file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Please choose one under 5 MB.`);
          return;
        }
        try {
          preparedImage = await prepareImage(file);
          renderPreview();
        } catch (err) {
          renderError(err.message || 'Could not read that image.');
        }
      });
    }

    function renderPreview() {
      body.innerHTML = `
        <div class="privacy-callout">
          <strong>Check first.</strong> Make sure no student names are visible in this image. The photo will be sent to Anthropic for analysis. It is not stored.
        </div>
        <div class="photo-preview">
          <img alt="Preview of work sample" />
        </div>
        <div class="photo-actions">
          <button class="ghost-btn" data-act="cancel" type="button">Cancel</button>
          <button class="polish-btn" data-act="analyse" type="button">Analyse this work sample</button>
        </div>
      `;
      body.querySelector('img').src = preparedImage.dataUrl;
      body.querySelector('[data-act="cancel"]').addEventListener('click', closeModal);
      body.querySelector('[data-act="analyse"]').addEventListener('click', runAnalyse);
    }

    function renderError(msg) {
      body.innerHTML = `
        <p class="photo-status photo-status-err">${escapeHtml(msg)}</p>
        <div class="photo-actions">
          <button class="ghost-btn" data-act="back" type="button">Try another photo</button>
          <button class="ghost-btn" data-act="close" type="button">Close</button>
        </div>
      `;
      body.querySelector('[data-act="back"]').addEventListener('click', renderPick);
      body.querySelector('[data-act="close"]').addEventListener('click', closeModal);
    }

    function renderLoading() {
      body.innerHTML = `<p class="photo-status">Reading the work sample…</p>`;
    }

    async function runAnalyse() {
      renderLoading();
      const accessToken = window.RG.auth.getAccessToken();
      if (!accessToken) {
        renderError('You are not signed in. Sign in again and try once more.');
        return;
      }
      try {
        const res = await fetch('/api/photo-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: preparedImage.base64,
            mediaType: preparedImage.mediaType,
            subject,
            stage,
            accessToken,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          renderError(err.error || `Analysis failed (${res.status}).`);
          return;
        }
        const data = await res.json();
        renderResults(data);
      } catch (err) {
        renderError(err.message || 'Network error while analysing.');
      }
    }

    function renderResults(data) {
      const allById = new Map(statements.map(s => [s.id, s]));
      const decorate = (matches) => (matches || [])
        .map(m => ({ ...m, stmt: allById.get(m.id) }))
        .filter(m => m.stmt);

      const strengths = decorate(data.strengths_matched);
      const goals = decorate(data.goals_matched);
      const total = strengths.length + goals.length;

      if (!total) {
        body.innerHTML = `
          <p class="photo-status">No strong matches found in that work sample. You can try a different photo, or tick statements manually.</p>
          <div class="photo-actions">
            <button class="ghost-btn" data-act="back" type="button">Try another photo</button>
            <button class="ghost-btn" data-act="close" type="button">Close</button>
          </div>
        `;
        body.querySelector('[data-act="back"]').addEventListener('click', renderPick);
        body.querySelector('[data-act="close"]').addEventListener('click', closeModal);
        return;
      }

      const renderGroup = (label, items) => {
        if (!items.length) return '';
        return `
          <div class="suggestion-group">
            <div class="subhead">${escapeHtml(label)}</div>
            <ul class="suggestion-list">
              ${items.map(m => {
                const id = escapeHtml(m.id);
                const conf = ['high', 'medium', 'low'].includes(m.confidence) ? m.confidence : 'low';
                const checked = conf === 'high' ? 'checked' : '';
                const text = escapeHtml(m.stmt.content.replace(/\{first_name\}/g, student.first_name));
                const cat = escapeHtml(m.stmt.category || '');
                const confLabel = conf === 'medium' ? 'med' : conf;
                return `
                  <li class="suggestion-row${checked ? ' ticked' : ''}" data-id="${id}">
                    <input type="checkbox" ${checked} />
                    <span class="check"></span>
                    <span class="suggestion-text">
                      <span class="suggestion-cat">${cat}</span>
                      <span class="suggestion-body">${text}</span>
                    </span>
                    <span class="confidence confidence-${conf}">${escapeHtml(confLabel)}</span>
                  </li>
                `;
              }).join('')}
            </ul>
          </div>
        `;
      };

      body.innerHTML = `
        <p class="help-text">${total} possible match${total === 1 ? '' : 'es'}. High-confidence items are pre-selected. Untick anything that does not fit, then apply.</p>
        ${renderGroup('Strengths', strengths)}
        ${renderGroup('Goals', goals)}
        <div class="photo-actions">
          <button class="ghost-btn" data-act="cancel" type="button">Cancel</button>
          <button class="polish-btn" data-act="apply" type="button">Apply selected</button>
        </div>
      `;

      body.querySelectorAll('.suggestion-row').forEach(row => {
        const cb = row.querySelector('input');
        row.addEventListener('click', () => {
          const newState = !row.classList.contains('ticked');
          row.classList.toggle('ticked', newState);
          cb.checked = newState;
        });
      });

      body.querySelector('[data-act="cancel"]').addEventListener('click', closeModal);
      body.querySelector('[data-act="apply"]').addEventListener('click', async (e) => {
        const ids = [...body.querySelectorAll('.suggestion-row.ticked')].map(r => r.dataset.id);
        const applyBtn = e.currentTarget;
        if (!ids.length) {
          closeModal();
          return;
        }
        applyBtn.disabled = true;
        applyBtn.textContent = 'Applying…';
        try {
          const result = await applyTicks(student.id, subject, ids);
          closeModal();
          onApplied?.(result?.added ?? ids.length);
        } catch (err) {
          applyBtn.disabled = false;
          applyBtn.textContent = 'Apply selected';
          renderError(err.message || 'Could not apply the selections.');
        }
      });
    }

    renderPick();
    root.classList.add('open');
  }

  // Read existing ticks, dedupe, write only the new ones, all in one
  // transaction. Returns { added, alreadyTicked } from the db layer.
  async function applyTicks(studentId, subject, statementIds) {
    return window.RG.db.addTicks(studentId, subject, statementIds);
  }

  function mountButton(container, ctx) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost-btn photo-match-btn';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="1"/>
        <circle cx="12" cy="12" r="3.5"/>
      </svg>
      <span>Match from photo</span>
    `;
    btn.addEventListener('click', () => open(ctx));
    container.appendChild(btn);
    return btn;
  }

  window.RG = window.RG || {};
  window.RG.views = window.RG.views || {};
  window.RG.views.photoMatch = { mountButton, open };
})();
