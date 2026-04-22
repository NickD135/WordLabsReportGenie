// /js/db/indexeddb.js
//
// Local data layer. ALL student PII lives here and ONLY here.
// Never sync this to any external server.
//
// Stores:
//   classes         { id, name, year_group, created_at }
//   students        { id, class_id, first_name, gender, profile_tags, notes }
//   ticks           { id, student_id, statement_id, subject } — presence = ticked
//   outputs         { id, student_id, subject, version, content, raw_collated, exemplar_used, created_at }
//   teacher_feedback { id, student_id, subject, content }
//
// Indexes:
//   students by class_id
//   ticks by [student_id, subject]
//   outputs by [student_id, subject]
//   teacher_feedback by [student_id, subject]

(function () {
  const DB_NAME = 'report-genie';
  const DB_VERSION = 1;

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = window.idb.openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('classes')) {
          db.createObjectStore('classes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('students')) {
          const s = db.createObjectStore('students', { keyPath: 'id' });
          s.createIndex('by_class', 'class_id');
        }
        if (!db.objectStoreNames.contains('ticks')) {
          const t = db.createObjectStore('ticks', { keyPath: 'id' });
          t.createIndex('by_student_subject', ['student_id', 'subject']);
          t.createIndex('by_statement', 'statement_id');
        }
        if (!db.objectStoreNames.contains('outputs')) {
          const o = db.createObjectStore('outputs', { keyPath: 'id' });
          o.createIndex('by_student_subject', ['student_id', 'subject']);
        }
        if (!db.objectStoreNames.contains('teacher_feedback')) {
          const f = db.createObjectStore('teacher_feedback', { keyPath: 'id' });
          f.createIndex('by_student_subject', ['student_id', 'subject'], { unique: true });
        }
      },
    });
    return dbPromise;
  }

  function uuid() {
    // Lightweight uuid v4 — sufficient for local-only ids
    return crypto.randomUUID();
  }

  // ---------- Classes ----------

  async function listClasses() {
    return (await open()).getAll('classes');
  }

  async function createClass({ name, year_group }) {
    const db = await open();
    const cls = { id: uuid(), name, year_group, created_at: new Date().toISOString() };
    await db.put('classes', cls);
    return cls;
  }

  async function deleteClass(id) {
    const db = await open();
    // Cascade delete students, ticks, outputs, feedback
    const students = await db.getAllFromIndex('students', 'by_class', id);
    const tx = db.transaction(['classes', 'students', 'ticks', 'outputs', 'teacher_feedback'], 'readwrite');
    await tx.objectStore('classes').delete(id);
    for (const stu of students) {
      await tx.objectStore('students').delete(stu.id);
      const tickKeys = await tx.objectStore('ticks').index('by_student_subject').getAllKeys(IDBKeyRange.bound([stu.id, ''], [stu.id, '\uffff']));
      for (const k of tickKeys) await tx.objectStore('ticks').delete(k);
      const outKeys = await tx.objectStore('outputs').index('by_student_subject').getAllKeys(IDBKeyRange.bound([stu.id, ''], [stu.id, '\uffff']));
      for (const k of outKeys) await tx.objectStore('outputs').delete(k);
      const fbKeys = await tx.objectStore('teacher_feedback').index('by_student_subject').getAllKeys(IDBKeyRange.bound([stu.id, ''], [stu.id, '\uffff']));
      for (const k of fbKeys) await tx.objectStore('teacher_feedback').delete(k);
    }
    await tx.done;
  }

  // ---------- Students ----------

  async function listStudents(class_id) {
    return (await open()).getAllFromIndex('students', 'by_class', class_id);
  }

  async function createStudent({ class_id, first_name, gender = 'they', profile_tags = [], notes = '' }) {
    const db = await open();
    const stu = { id: uuid(), class_id, first_name, gender, profile_tags, notes };
    await db.put('students', stu);
    return stu;
  }

  async function updateStudent(id, patch) {
    const db = await open();
    const cur = await db.get('students', id);
    if (!cur) throw new Error(`No student ${id}`);
    const next = { ...cur, ...patch };
    await db.put('students', next);
    return next;
  }

  async function deleteStudent(id) {
    const db = await open();
    const tx = db.transaction(['students', 'ticks', 'outputs', 'teacher_feedback'], 'readwrite');
    await tx.objectStore('students').delete(id);
    // Best-effort cascade
    const idx = (store) => tx.objectStore(store).index('by_student_subject');
    for (const store of ['ticks', 'outputs', 'teacher_feedback']) {
      const keys = await idx(store).getAllKeys(IDBKeyRange.bound([id, ''], [id, '\uffff']));
      for (const k of keys) await tx.objectStore(store).delete(k);
    }
    await tx.done;
  }

  // ---------- Ticks ----------

  async function getTicks(student_id, subject) {
    return (await open()).getAllFromIndex('ticks', 'by_student_subject', [student_id, subject]);
  }

  async function setTick(student_id, subject, statement_id, ticked) {
    const db = await open();
    const all = await db.getAllFromIndex('ticks', 'by_student_subject', [student_id, subject]);
    const existing = all.find(t => t.statement_id === statement_id);
    if (ticked && !existing) {
      await db.put('ticks', { id: uuid(), student_id, subject, statement_id });
    } else if (!ticked && existing) {
      await db.delete('ticks', existing.id);
    }
  }

  // ---------- Outputs ----------

  async function listOutputs(student_id, subject) {
    const all = await (await open()).getAllFromIndex('outputs', 'by_student_subject', [student_id, subject]);
    return all.sort((a, b) => b.version - a.version);
  }

  async function saveOutput({ student_id, subject, content, raw_collated, exemplar_used }) {
    const db = await open();
    const existing = await listOutputs(student_id, subject);
    const nextVersion = (existing[0]?.version || 0) + 1;
    const out = {
      id: uuid(),
      student_id,
      subject,
      version: nextVersion,
      content,
      raw_collated,
      exemplar_used,
      created_at: new Date().toISOString(),
    };
    await db.put('outputs', out);
    // Trim to last 3 versions
    if (existing.length >= 3) {
      const toDelete = existing.slice(2); // keep newest 2 + the new one = 3
      for (const o of toDelete) await db.delete('outputs', o.id);
    }
    return out;
  }

  async function updateOutput(id, content) {
    const db = await open();
    const cur = await db.get('outputs', id);
    if (!cur) throw new Error(`No output ${id}`);
    cur.content = content;
    await db.put('outputs', cur);
    return cur;
  }

  // ---------- Teacher feedback (extra context) ----------

  async function getTeacherFeedback(student_id, subject) {
    const all = await (await open()).getAllFromIndex('teacher_feedback', 'by_student_subject', [student_id, subject]);
    return all[0]?.content || '';
  }

  async function setTeacherFeedback(student_id, subject, content) {
    const db = await open();
    const all = await db.getAllFromIndex('teacher_feedback', 'by_student_subject', [student_id, subject]);
    if (all[0]) {
      all[0].content = content;
      await db.put('teacher_feedback', all[0]);
    } else {
      await db.put('teacher_feedback', { id: uuid(), student_id, subject, content });
    }
  }

  // ---------- Export / import ----------

  async function exportClass(class_id) {
    const db = await open();
    const cls = await db.get('classes', class_id);
    const students = await listStudents(class_id);
    const ticks = [], outputs = [], feedback = [];
    for (const stu of students) {
      for (const subject of ['English', 'Maths', 'General']) {
        ticks.push(...await getTicks(stu.id, subject));
        outputs.push(...await listOutputs(stu.id, subject));
        const fb = await getTeacherFeedback(stu.id, subject);
        if (fb) feedback.push({ student_id: stu.id, subject, content: fb });
      }
    }
    return { version: 1, class: cls, students, ticks, outputs, feedback };
  }

  window.RG = window.RG || {};
  window.RG.db = {
    listClasses, createClass, deleteClass,
    listStudents, createStudent, updateStudent, deleteStudent,
    getTicks, setTick,
    listOutputs, saveOutput, updateOutput,
    getTeacherFeedback, setTeacherFeedback,
    exportClass,
  };
})();
