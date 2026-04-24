// /js/views/classList.js
//
// Left rail: class meta line + student rows with progress dots per subject.

(function () {
  const SUBJECTS = ['English', 'Maths', 'General'];

  async function render(container, { classId, className, yearGroup, selectedStudentId, onSelect, onDelete }) {
    container.innerHTML = '';
    const meta = document.getElementById('classMeta');

    if (!classId) {
      meta.textContent = '';
      container.innerHTML = '<li class="rail-empty">No class yet. Use the class switcher above to create one.</li>';
      return;
    }

    const students = await window.RG.db.listStudents(classId);
    meta.textContent = `${className || 'Class'} · ${students.length} student${students.length === 1 ? '' : 's'}`;

    if (!students.length) {
      container.innerHTML = '<li class="rail-empty">No students yet. Use the + Add button to enrol them.</li>';
      return;
    }

    students.sort((a, b) => a.first_name.localeCompare(b.first_name));

    for (const stu of students) {
      const li = document.createElement('li');
      li.className = `student-row${stu.id === selectedStudentId ? ' active' : ''}`;
      li.dataset.studentId = stu.id;

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = stu.first_name;

      const dots = document.createElement('span');
      dots.className = 'progress-marks';
      for (const subject of SUBJECTS) {
        const state = await progressFor(stu.id, subject);
        const dot = document.createElement('span');
        dot.className = 'mark' + (state === 'polished' ? ' polished' : state === 'ticked' ? ' ticked' : '');
        dot.title = `${subject}: ${state}`;
        dots.appendChild(dot);
      }

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'student-del';
      del.setAttribute('aria-label', `Remove ${stu.first_name}`);
      del.title = `Remove ${stu.first_name}`;
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`Remove ${stu.first_name}? This deletes their ticks, outputs, and notes for every subject.`)) return;
        if (onDelete) onDelete(stu);
      });

      const trail = document.createElement('span');
      trail.className = 'student-trail';
      trail.appendChild(dots);
      trail.appendChild(del);

      li.appendChild(name);
      li.appendChild(trail);
      li.addEventListener('click', () => onSelect(stu));
      container.appendChild(li);
    }
  }

  async function progressFor(studentId, subject) {
    const outputs = await window.RG.db.listOutputs(studentId, subject);
    if (outputs.length) return 'polished';
    const ticks = await window.RG.db.getTicks(studentId, subject);
    if (ticks.length) return 'ticked';
    return 'empty';
  }

  window.RG = window.RG || {};
  window.RG.views = window.RG.views || {};
  window.RG.views.classList = { render };
})();
