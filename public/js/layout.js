// /js/layout.js
//
// Draggable splitters for the three-pane layout. Widths are stored in
// localStorage (per device) so the layout persists across reloads.

(function () {
  const STORAGE_KEY = 'rg.paneWidths';
  const MIN = { rail: 180, middle: 320, output: 280 };
  const DEFAULT = { rail: 260, output: 420 };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT };
      const parsed = JSON.parse(raw);
      return {
        rail: Number.isFinite(parsed.rail) ? parsed.rail : DEFAULT.rail,
        output: Number.isFinite(parsed.output) ? parsed.output : DEFAULT.output,
      };
    } catch {
      return { ...DEFAULT };
    }
  }

  function save(widths) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(widths)); } catch {}
  }

  function clamp(which, px, appMain, widths) {
    const total = appMain.clientWidth - 12; // two 6px splitters
    if (which === 'rail') {
      const maxRail = total - MIN.middle - Math.max(MIN.output, widths.output);
      return Math.min(Math.max(px, MIN.rail), Math.max(MIN.rail, maxRail));
    }
    const maxOut = total - MIN.middle - Math.max(MIN.rail, widths.rail);
    return Math.min(Math.max(px, MIN.output), Math.max(MIN.output, maxOut));
  }

  function apply(appMain, widths) {
    appMain.style.setProperty('--rail-w', widths.rail + 'px');
    appMain.style.setProperty('--output-w', widths.output + 'px');
  }

  function init() {
    const appMain = document.querySelector('.app-main');
    if (!appMain) return;
    const widths = load();
    apply(appMain, widths);

    const splitters = appMain.querySelectorAll('.splitter');
    splitters.forEach(sp => {
      sp.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const which = sp.dataset.split; // 'rail' | 'output'
        sp.setPointerCapture(e.pointerId);
        appMain.classList.add('dragging');

        const rect = appMain.getBoundingClientRect();

        const onMove = (ev) => {
          let next;
          if (which === 'rail') {
            next = ev.clientX - rect.left;
          } else {
            next = rect.right - ev.clientX;
          }
          widths[which] = clamp(which, next, appMain, widths);
          apply(appMain, widths);
        };

        const onUp = () => {
          sp.removeEventListener('pointermove', onMove);
          sp.removeEventListener('pointerup', onUp);
          sp.removeEventListener('pointercancel', onUp);
          appMain.classList.remove('dragging');
          save(widths);
        };

        sp.addEventListener('pointermove', onMove);
        sp.addEventListener('pointerup', onUp);
        sp.addEventListener('pointercancel', onUp);
      });

      sp.addEventListener('keydown', (e) => {
        const which = sp.dataset.split;
        const step = e.shiftKey ? 32 : 8;
        const sign = which === 'rail' ? 1 : -1; // ArrowRight grows the near pane
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const delta = (e.key === 'ArrowRight' ? 1 : -1) * sign * step;
          widths[which] = clamp(which, widths[which] + delta, appMain, widths);
          apply(appMain, widths);
          save(widths);
        }
      });
    });

    window.addEventListener('resize', () => {
      widths.rail = clamp('rail', widths.rail, appMain, widths);
      widths.output = clamp('output', widths.output, appMain, widths);
      apply(appMain, widths);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
