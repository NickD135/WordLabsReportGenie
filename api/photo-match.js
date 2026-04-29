// /api/photo-match.js
//
// Prototype: takes a base64-encoded photo of student work, asks Claude to
// match it against the English Stage 3 statement bank, and returns ranked
// suggested strengths and goals (with statement IDs) for the teacher to
// approve back into the student's tick state.
//
// Request body:
//   {
//     image: string,        // base64-encoded image data (no data: prefix)
//     mediaType: string,    // e.g. 'image/jpeg', 'image/png', 'image/webp'
//     subject: 'English',   // prototype: English only
//     stage: 3,             // prototype: Stage 3 only
//     accessToken: string   // Supabase access token (auth check)
//   }
//
// Response:
//   {
//     strengths_matched: [{ id, confidence }],
//     goals_matched:     [{ id, confidence }],
//     model: string
//   }
//
// Privacy: this endpoint receives the raw image, so the teacher is warned
// in-browser to ensure no student names are visible. The image is forwarded
// once to Anthropic and not persisted.

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// 5 MB cap on the decoded image. base64 encodes ~4 chars per 3 bytes,
// so a base64 string longer than this implies a binary larger than the cap.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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

function base64ByteLength(b64) {
  if (!b64) return 0;
  const padding = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  return Math.floor((b64.length * 3) / 4) - padding;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      image,
      mediaType = 'image/jpeg',
      subject,
      stage,
      accessToken,
    } = req.body || {};

    if (subject !== 'English') {
      return res.status(400).json({ error: 'Prototype supports English only.' });
    }
    if (Number(stage) !== 3) {
      return res.status(400).json({ error: 'Prototype supports Stage 3 only.' });
    }
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Missing image data.' });
    }
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return res.status(400).json({ error: 'Unsupported image type.' });
    }
    if (base64ByteLength(image) > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: 'Image is larger than 5 MB.' });
    }
    if (!accessToken) {
      return res.status(401).json({ error: 'Missing access token.' });
    }

    // Auth check
    const supabase = buildSupabaseClient(accessToken);
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult?.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    // Pull all English statements that apply to Stage 3, filter to
    // Strengths/Goals (Opening statements are not work-evidence based).
    const { data: stmts, error: stmtsError } = await supabase
      .from('statements')
      .select('id, category, subcategory, content')
      .eq('subject', 'English')
      .contains('stages', [3]);

    if (stmtsError) {
      return res.status(500).json({ error: 'Failed to load statement bank.' });
    }

    const strengths = (stmts || []).filter(s => s.subcategory === 'Strengths');
    const goals = (stmts || []).filter(s => s.subcategory === 'Goals');

    if (!strengths.length && !goals.length) {
      return res.status(500).json({ error: 'No Stage 3 English strengths or goals available.' });
    }

    // Build the statement lists for the prompt. Strip the {first_name}
    // placeholder so Claude reads the statement as a generic descriptor.
    const formatList = (items) => items
      .map(s => `- [${s.id}] (${s.category}) ${s.content.replace(/\{first_name\}/g, 'The student')}`)
      .join('\n');

    const strengthsBlock = formatList(strengths) || '(none available)';
    const goalsBlock = formatList(goals) || '(none available)';

    const validStrengthIds = new Set(strengths.map(s => s.id));
    const validGoalIds = new Set(goals.map(s => s.id));

    const systemPrompt = [
      'You are an experienced NSW primary school teacher reviewing a single sample of a Stage 3 student\'s English work.',
      'Your task is to match the work sample against a fixed bank of report-comment statements and return only those statements that the work clearly demonstrates.',
      '',
      'Be conservative. Only suggest a statement when the visible evidence in the image directly supports it. Do not speculate. Do not match a statement just because it could plausibly apply to a Stage 3 student in general.',
      '',
      'Use Australian English in any prose you produce. Use the statement IDs exactly as supplied.',
      '',
      'Confidence levels:',
      '- "high"   = the work clearly and unambiguously demonstrates this statement',
      '- "medium" = there is reasonable evidence but it is partial or could be read other ways',
      '- "low"    = there is a hint of evidence but you would want to see more before claiming it',
      '',
      'Return at most 8 strengths and at most 5 goals. If nothing in the work supports a category, return an empty array for it. Do not invent statement IDs.',
      '',
      'Respond with ONLY a single JSON object, no preamble or commentary, in this exact shape:',
      '{',
      '  "strengths_matched": [{"id": "<uuid>", "confidence": "high|medium|low"}],',
      '  "goals_matched":     [{"id": "<uuid>", "confidence": "high|medium|low"}]',
      '}',
    ].join('\n');

    const userText = [
      'Available STRENGTHS (each line: [id] (category) statement text):',
      strengthsBlock,
      '',
      'Available GOALS:',
      goalsBlock,
      '',
      'Analyse the attached work sample and return the JSON object as instructed.',
    ].join('\n');

    let response;
    try {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: image },
            },
            { type: 'text', text: userText },
          ],
        }],
      });
    } catch (err) {
      console.error('photo-match anthropic error:', err);
      return res.status(502).json({
        error: 'The work-sample analyser is unavailable. Try again in a minute.',
      });
    }

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    let parsed;
    try {
      // Trim any accidental fenced-code wrapper
      const stripped = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      parsed = JSON.parse(stripped);
    } catch (err) {
      console.error('photo-match parse error. Raw:', rawText);
      return res.status(502).json({ error: 'Could not read the analyser response.' });
    }

    const cleanList = (arr, validIds) => {
      if (!Array.isArray(arr)) return [];
      const seen = new Set();
      const out = [];
      for (const item of arr) {
        if (!item || typeof item.id !== 'string') continue;
        if (!validIds.has(item.id)) continue;
        if (seen.has(item.id)) continue;
        const conf = (item.confidence || '').toLowerCase();
        if (!['high', 'medium', 'low'].includes(conf)) continue;
        seen.add(item.id);
        out.push({ id: item.id, confidence: conf });
      }
      return out;
    };

    return res.status(200).json({
      strengths_matched: cleanList(parsed.strengths_matched, validStrengthIds).slice(0, 8),
      goals_matched: cleanList(parsed.goals_matched, validGoalIds).slice(0, 5),
      model: MODEL,
    });
  } catch (err) {
    console.error('photo-match error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
};
