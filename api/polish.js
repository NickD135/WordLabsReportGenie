// /api/polish.js
//
// Receives placeholdered text from the browser and returns a polished comment.
// Never sees a student's real name — the browser substitutes {first_name} before
// calling this endpoint and re-substitutes after receiving the response.
//
// Request body:
//   {
//     subject: 'English' | 'Maths' | 'General',
//     rawText: string,             // collated tick-box statements, with {first_name} placeholders
//     teacherFeedback: string,     // optional extra context from teacher (also placeholdered)
//     gender: 'boy' | 'girl' | 'they',
//     archetype: string,           // for exemplar selection
//     stage: number,               // for stage-specific exemplar
//     accessToken: string          // Supabase access token (for auth check)
//   }
//
// Response: { polished: string, exemplarUsed: string | null }

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function buildSupabaseClient(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

function pronounsFor(gender) {
  switch (gender) {
    case 'boy':  return 'he/him/his';
    case 'girl': return 'she/her/her';
    default:     return 'they/them/their';
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      subject,
      rawText,
      teacherFeedback = '',
      gender = 'they',
      archetype = 'solid_at_grade',
      stage = null,
      accessToken,
    } = req.body || {};

    // Basic validation
    if (!['English', 'Maths', 'General'].includes(subject)) {
      return res.status(400).json({ error: 'Invalid subject' });
    }
    if (!rawText || rawText.length < 10) {
      return res.status(400).json({ error: 'rawText too short' });
    }
    if (!accessToken) {
      return res.status(401).json({ error: 'Missing access token' });
    }

    // Hard guard: refuse if rawText contains anything that looks like a name.
    // Browser is supposed to placeholder before sending. This is belt-and-braces.
    if (!rawText.includes('{first_name}') && rawText.split(/\s+/).length > 5) {
      // No placeholder present in a substantive block — likely a bug. Don't send.
      return res.status(400).json({
        error: 'Placeholder missing. Browser must substitute {first_name} before calling.',
      });
    }

    // Structural guard: the collate step must produce a labelled block so
    // Claude can keep strengths and goals apart. If the labels are missing
    // the browser-side collation is broken and sending the blob anyway
    // would reproduce the goal-bleed bug. Refuse rather than degrade.
    const hasStrengths = rawText.includes('STRENGTHS');
    const hasGoals = rawText.includes('GOALS');
    const hasContent = rawText.includes('CONTENT');
    const labelsOk = subject === 'General' ? hasContent : (hasStrengths && hasGoals);
    if (!labelsOk) {
      return res.status(400).json({
        error: 'Malformed collation',
        detail: subject === 'General'
          ? 'Expected a CONTENT label in the collated text.'
          : 'Expected both STRENGTHS and GOALS labels in the collated text.',
      });
    }

    // Auth: verify the user via the supplied token
    const supabase = buildSupabaseClient(accessToken);
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult?.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    // Pull the prompt, style guide, exemplar
    const [promptRow, styleRow, exemplarRow] = await Promise.all([
      supabase.from('prompts').select('content, word_count_min, word_count_max').eq('subject', subject).single(),
      supabase.from('style_guides').select('content').eq('subject', subject).single(),
      fetchExemplar(supabase, subject, archetype, stage),
    ]);

    if (promptRow.error || styleRow.error) {
      return res.status(500).json({ error: 'Failed to load prompt configuration' });
    }

    let systemPrompt = promptRow.data.content
      .replace('{style_guide}', styleRow.data?.content || '')
      .replace('{exemplar}', exemplarRow?.content || '(no exemplar provided)');

    // Append pronoun reminder
    systemPrompt += `\n\nPronouns to use for this student: ${pronounsFor(gender)}.`;

    // Build user message
    const userContent = teacherFeedback.trim()
      ? `${rawText}\n\nAdditional context from teacher: ${teacherFeedback}`
      : rawText;

    // Call Anthropic
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.5,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const polished = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    return res.status(200).json({
      polished,
      exemplarUsed: exemplarRow?.archetype || null,
      model: MODEL,
    });
  } catch (err) {
    console.error('polish error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}

// Try to fetch the most specific exemplar available, falling back gracefully:
//   1. Subject + archetype + exact stage
//   2. Subject + archetype + null stage (applies to all)
//   3. Subject + 'solid_at_grade' + null stage (final fallback)
async function fetchExemplar(supabase, subject, archetype, stage) {
  const tries = [
    { subject, archetype, stage },
    { subject, archetype, stage: null },
    { subject, archetype: 'solid_at_grade', stage: null },
  ];
  for (const t of tries) {
    let q = supabase.from('exemplars').select('content, archetype').eq('subject', t.subject).eq('archetype', t.archetype);
    q = t.stage === null ? q.is('stage', null) : q.eq('stage', t.stage);
    const { data, error } = await q.maybeSingle();
    if (!error && data?.content) return data;
  }
  return null;
}
