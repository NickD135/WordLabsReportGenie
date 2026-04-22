// /js/export/docx.js
//
// Export polished comments for the current class to:
//   - .docx (one student per page, three subject sections)
//   - .csv (one row per student, columns for each subject)
//
// .docx generation uses a minimal docx XML template assembled in-browser.
// For v1 we keep this lightweight — no docx library, just zip + boilerplate.
// If a richer format is needed later, swap in docx.js (the library) via CDN.

(function () {
  async function exportClass(classId) {
    const klass = (await window.RG.db.listClasses()).find(c => c.id === classId);
    if (!klass) throw new Error('Class not found');
    const students = await window.RG.db.listStudents(classId);
    students.sort((a, b) => a.first_name.localeCompare(b.first_name));

    const rows = [];
    for (const stu of students) {
      const row = { name: stu.first_name };
      for (const subject of ['English', 'Maths', 'General']) {
        const outputs = await window.RG.db.listOutputs(stu.id, subject);
        row[subject] = outputs[0]?.content || '';
      }
      rows.push(row);
    }
    return { klass, rows };
  }

  function downloadCsv(klass, rows) {
    const headers = ['Student', 'English', 'Maths', 'General'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push([r.name, r.English, r.Maths, r.General].map(csvEscape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `${slug(klass.name)}-comments.csv`);
  }

  function csvEscape(v) {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // For .docx export: stub for now, recommend pasting CSV into Word via
  // table import for v1. A proper docx generator can be added later.
  function downloadDocxStub(klass, rows) {
    // Build a simple HTML document that Word will open as .doc gracefully.
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${escapeHtml(klass.name)} — Comments</title></head>
      <body>
        <h1>${escapeHtml(klass.name)} — Report comments</h1>
        ${rows.map(r => `
          <h2>${escapeHtml(r.name)}</h2>
          <h3>English</h3><p>${escapeHtml(r.English)}</p>
          <h3>Maths</h3><p>${escapeHtml(r.Maths)}</p>
          <h3>General</h3><p>${escapeHtml(r.General)}</p>
          <hr/>
        `).join('')}
      </body></html>
    `;
    const blob = new Blob([html], { type: 'application/msword' });
    triggerDownload(blob, `${slug(klass.name)}-comments.doc`);
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.RG = window.RG || {};
  window.RG.export = { exportClass, downloadCsv, downloadDocxStub };
})();
