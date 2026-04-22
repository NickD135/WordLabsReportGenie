// /js/db/supabase.js
//
// Reads from the central statement bank, prompts, style guides, and exemplars.
// Applies any teacher overrides on top.
// Reads only — writes for overrides happen in the Settings UI modules.

(function () {
  function client() {
    return window.RG.auth.getClient();
  }

  function teacherId() {
    return window.RG.auth.getUser()?.id;
  }

  // Apply overrides: any record in teacher_overrides with matching record_id
  // replaces the master record's content.
  function applyOverrides(masters, overrides, contentField = 'content') {
    if (!overrides?.length) return masters;
    const overrideMap = new Map(overrides.map(o => [o.record_id, o.override_content]));
    return masters.map(m => overrideMap.has(m.id) ? { ...m, [contentField]: overrideMap.get(m.id) } : m);
  }

  // ---------- Statements ----------

  async function getStatements({ subject, stage = null }) {
    const sb = client();
    const tid = teacherId();

    let q = sb.from('statements').select('*').eq('subject', subject).order('category').order('subcategory').order('position');
    if (stage !== null) q = q.contains('stages', [stage]);

    const [mastersRes, overridesRes, customsRes] = await Promise.all([
      q,
      tid ? sb.from('teacher_overrides').select('*').eq('teacher_id', tid).eq('table_name', 'statements').eq('is_custom', false) : { data: [] },
      tid ? sb.from('teacher_overrides').select('*').eq('teacher_id', tid).eq('table_name', 'statements').eq('is_custom', true).eq('custom_subject', subject) : { data: [] },
    ]);

    if (mastersRes.error) throw mastersRes.error;

    let combined = applyOverrides(mastersRes.data || [], overridesRes.data || []);

    // Append custom statements added by this teacher
    for (const c of customsRes.data || []) {
      combined.push({
        id: c.id,
        subject: c.custom_subject,
        category: c.custom_category,
        subcategory: c.custom_subcategory,
        stages: c.custom_stages || [],
        content: c.override_content,
        position: c.custom_position || 999,
        is_custom: true,
      });
    }

    if (stage !== null) {
      combined = combined.filter(s => !s.stages || s.stages.length === 0 || s.stages.includes(stage));
    }

    return combined;
  }

  // ---------- Prompts ----------

  async function getPrompt(subject) {
    const sb = client();
    const tid = teacherId();
    const [masterRes, overrideRes] = await Promise.all([
      sb.from('prompts').select('*').eq('subject', subject).single(),
      tid ? sb.from('teacher_overrides').select('override_content').eq('teacher_id', tid).eq('table_name', 'prompts').eq('record_id', null).maybeSingle() : { data: null },
    ]);
    if (masterRes.error) throw masterRes.error;
    const master = masterRes.data;
    if (overrideRes.data) master.content = overrideRes.data.override_content;
    return master;
  }

  // ---------- Style guides ----------

  async function getStyleGuide(subject) {
    const sb = client();
    const tid = teacherId();
    const [masterRes, overrideRes] = await Promise.all([
      sb.from('style_guides').select('*').eq('subject', subject).single(),
      tid ? sb.from('teacher_overrides').select('override_content').eq('teacher_id', tid).eq('table_name', 'style_guides').maybeSingle() : { data: null },
    ]);
    if (masterRes.error) throw masterRes.error;
    const master = masterRes.data;
    if (overrideRes.data) master.content = overrideRes.data.override_content;
    return master;
  }

  // ---------- Exemplars ----------

  async function getExemplars(subject) {
    const sb = client();
    const tid = teacherId();
    const [mastersRes, overridesRes] = await Promise.all([
      sb.from('exemplars').select('*').eq('subject', subject),
      tid ? sb.from('teacher_overrides').select('*').eq('teacher_id', tid).eq('table_name', 'exemplars') : { data: [] },
    ]);
    if (mastersRes.error) throw mastersRes.error;
    return applyOverrides(mastersRes.data || [], overridesRes.data || []);
  }

  // ---------- Override writes ----------

  async function saveOverride({ table_name, record_id, override_content, custom = null }) {
    const sb = client();
    const tid = teacherId();
    const row = {
      teacher_id: tid,
      table_name,
      record_id,
      override_content,
      is_custom: !!custom,
      ...(custom ? {
        custom_subject: custom.subject,
        custom_category: custom.category,
        custom_subcategory: custom.subcategory,
        custom_stages: custom.stages,
        custom_position: custom.position,
      } : {}),
    };
    const { data, error } = await sb.from('teacher_overrides').upsert(row, { onConflict: 'teacher_id,table_name,record_id' }).select().single();
    if (error) throw error;
    return data;
  }

  async function deleteOverride(id) {
    const sb = client();
    const { error } = await sb.from('teacher_overrides').delete().eq('id', id);
    if (error) throw error;
  }

  window.RG = window.RG || {};
  window.RG.bank = {
    getStatements, getPrompt, getStyleGuide, getExemplars,
    saveOverride, deleteOverride,
  };
})();
