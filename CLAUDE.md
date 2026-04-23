# Report Genie — Claude Code Context

## What this is

A small, free, browser-based tool for K-6 NSW primary teachers to generate report comments. Teachers tick statements that apply to each student across English, Maths, and General sections, then an AI polish step turns the ticked statements into a properly-structured report comment in the teacher's voice.

This is the next iteration of an existing Google Sheets tool ("Mr Deeney's Report Genie", sold on TPT). The Sheets version works but has hit its limits. This rebuild is for personal use by Nicholas and a small number of colleagues at CCNPS — no payments, no school admin features, no marketing. Just a tool that works.

This project is **separate from Word Labs** and must not reference Word Labs anywhere in user-facing copy. Same author, same legal entity (Word Labs Education ABN), but different product, different domain, different branding.

## Non-negotiables

- **No student PII ever leaves the browser.** Names, gender, profile tags, ticks, and outputs all live in IndexedDB on the teacher's device. Only placeholdered text (`{first_name}` substituted in) is sent to the AI.
- **Zero Data Retention with Anthropic.** Request ZDR on the API account. Document this in the privacy notice.
- **Australian English everywhere** — UI copy, prompts, error messages, comments. No American spellings, no en-dashes used as hyphens, no AI-style em-dash overuse.
- **Magic link auth only.** No passwords. Email allowlist in Supabase to prevent random signups.
- **Vanilla HTML/JS, no framework.** Same pattern as Word Labs. Custom design system (no Tailwind, no Bootstrap). `vercel dev` should be all that's needed locally.
- **Stay in the design system.** Read `docs/design-system.md` before building any new view or component. Do not introduce new colours, new fonts, or new spacing values without updating that doc.

## Stack

- **Frontend:** vanilla HTML/JS, custom design system in `public/css/styles.css`, hosted on Vercel. **No Tailwind.** See `docs/design-system.md` for the visual rules.
- **Backend:** Vercel serverless functions in `/api/` (one function: `polish.js`)
- **Auth + central data:** Supabase, region `ap-southeast-2` (Sydney)
- **Local data:** IndexedDB (using `idb` library via CDN for ergonomics)
- **AI:** Anthropic API, model `claude-sonnet-4-6` (latest Sonnet; revisit before each deploy)
- **Repo:** GitHub, dev in GitHub Codespaces

## Data model

### In Supabase (no PII)
- `auth.users` — managed by Supabase Auth (magic link)
- `email_allowlist` — emails permitted to sign up
- `statements` — master statement bank (id, stage, subject, category, subcategory, content, created_at, updated_at, version)
- `prompts` — system prompts per subject (id, subject, content, version)
- `style_guides` — style guide text per subject (id, subject, content)
- `exemplars` — exemplar comments (id, subject, archetype, content)
- `teacher_overrides` — per-teacher edits (teacher_id, table_name, record_id, override_content)

### In IndexedDB (all PII)
- `classes` — id, name, year_group, created_at
- `students` — id, class_id, first_name, gender, profile_tags (array), notes
- `ticks` — student_id, statement_id, subject, ticked (boolean)
- `outputs` — id, student_id, subject, version, content, raw_collated, exemplar_used, created_at
- `teacher_feedback` — student_id, subject, content (the free-text "extra context" field)

## Privacy chain (memorise this)

1. Teacher ticks boxes in browser. Ticks stored in IndexedDB only.
2. Teacher hits Polish. Browser pulls ticked statements + teacher feedback for that student/subject.
3. Browser substitutes `{first_name}` for the student's name in any local text.
4. Browser POSTs to `/api/polish` with: subject, raw_text (placeholdered), profile_tags, gender, optional teacher_feedback (placeholdered).
5. `/api/polish` calls Anthropic with the system prompt for that subject + the placeholdered user content. ZDR is on.
6. Polished text comes back, still placeholdered.
7. Browser receives the response, swaps `{first_name}` back to the real name, displays and stores in IndexedDB.

The serverless function never sees a student name. The database never sees a student name. Anthropic never sees a student name.

## UI structure

Three-pane layout, all panes collapsible:

- **Left pane:** Class list. Each student shows progress dots per subject (empty / ticked / polished).
- **Middle pane:** Work area. Switches between modes via top toolbar:
  - **By Student:** one student, all sections (Opening, Strengths, Goals, etc.) shown as collapsible groups with tick boxes.
  - **By Statement:** one section at a time, whole class down the left, statements across the top. Tick a column to apply to all, untick to remove. This mirrors the existing Sheets workflow.
- **Right pane:** Polished output for the currently selected student/subject. Shows raw collated text and polished comment side-by-side. Edit and regenerate buttons. Version history dropdown (last 3 versions).

Top toolbar: subject switcher (English / Maths / General), view mode toggle, class switcher, settings, export.

## Workflow phases (build order)

### Week 1 — minimum viable
- Vercel + Supabase set up
- Magic link auth working with allowlist check
- Class creation + student creation in IndexedDB
- By-Student view for **English only**
- Tick boxes persist
- `/api/polish` endpoint working with Sonnet
- Polished output displays

### Week 2 — expand
- Maths and General subjects
- By-Statement view
- Output editing in right pane
- Version history (last 3)
- Profile tags on students
- Exemplar selection based on profile tags

### Week 3 — polish
- Statement bank editor (Settings)
- Prompt editor (Settings)
- Exemplar editor (Settings)
- Export to Word (.docx) and CSV
- Quality check on output
- Reset-to-default for all customisations

## Subject structure (matches the existing Sheets tool, will evolve)

### English sections
Positive Opening Sentences, Writing Strengths, Writing Goals, Comprehension Strengths, Comprehension Goals, Spelling Strengths, Spelling Goals, Reading Strengths, Reading Goals.

### Maths sections
Positive Opening Sentences, Strengths (per strand: Number & Algebra, Measurement & Space, Statistics & Probability), Goals (same strands).

### General sections
Opening Statements, Work Habits, Dispositions (Collaborative, Motivated, Resilience, Accountable, Creative), Learning in other KLAs, Social/Emotional Development, Closing Statements.

## Stages and year groups

NSW stage mapping (the master bank uses Stage 1/2/3):
- Stage 1 → K, 1, 2 (note: the existing CommentBank conflates Early Stage 1 with Stage 1)
- Stage 2 → 3, 4
- Stage 3 → 5, 6

Statements are tagged by stage. When a teacher creates a class with a year group, the tick views filter to the matching stage's statements. Statements can be tagged for multiple stages.

## Polish prompt structure

The prompts are stored in Supabase so they can be edited without code changes. Each subject has a system prompt with this structure (already drafted from the Sheets version, needs tightening):

1. Role and tone setup (primary teacher, formal, Aus English, third person, present tense)
2. Structural requirements (opener, achievement, area for improvement)
3. Avoid list (vague claims, future promises, contractions, American spellings, AI tells)
4. Do list (distinguish student from work, plain English)
5. Style guide injection point
6. Exemplar injection point
7. Word count constraints (English/Maths: 100-150, General: 150-200)

The `polish.js` endpoint pulls the prompt, style guide, and exemplar from Supabase based on subject and (for exemplar) student archetype derived from profile tags.

## Quality check rules

Run on every polished output:
- Word count within target range for subject
- `{first_name}` placeholder still present (or: name actually appears once re-substituted)
- No contractions (won't, doesn't, etc.)
- No future-tense promises ("will improve", "will be able to")
- No American spellings (color, behavior, organize, etc.) — list in `polish/quality.js`
- No sentences starting with "And" or "But"
- No vague praise without evidence ("is a great learner" with nothing specific)
- No repeated content words (>2 occurrences of any non-stopword)

Display flags inline next to the polished output. Don't block — let the teacher decide.

## File structure

```
report-genie/
├── CLAUDE.md                        — this file
├── README.md                        — human setup instructions
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
├── api/
│   └── polish.js                    — Anthropic call
├── public/
│   ├── index.html                   — main app shell
│   ├── login.html                   — magic link login
│   ├── css/
│   │   └── styles.css               — custom overrides
│   └── js/
│       ├── config.js                — Supabase URL + anon key (public)
│       ├── auth.js                  — magic link helpers
│       ├── app.js                   — main entry
│       ├── db/
│       │   ├── indexeddb.js         — local data layer
│       │   └── supabase.js          — central data layer
│       ├── views/
│       │   ├── classList.js
│       │   ├── byStudent.js
│       │   ├── byStatement.js
│       │   └── outputPanel.js
│       ├── polish/
│       │   ├── collate.js           — assemble raw text from ticks
│       │   ├── placeholder.js       — name swap in/out
│       │   └── quality.js           — quality check rules
│       ├── settings/
│       │   ├── statementBank.js
│       │   ├── prompts.js
│       │   └── exemplars.js
│       └── export/
│           └── docx.js              — Word export
├── supabase/
│   ├── schema.sql                   — table defs + RLS policies + signup allowlist trigger
│   ├── seed.sql                     — prompts, style guides, exemplar slots
│   └── seed-test-statements.sql     — TEMPORARY English Stage 3 seed for Week 1 testing; replaced by the real CommentBank import (Task 26)
└── docs/
    ├── privacy-architecture.md      — for the audit trail
    └── statement-bank-import.md     — how to import the CSV
```

## Running locally

The dev loop is `vercel dev` on port 3000, with `.env.local` sourced into the shell first:

```bash
set -a && . ./.env.local && set +a && npx vercel dev --listen 3000
```

Why the `set -a` trick: `vercel dev` fetches env vars from the linked Vercel project's *Development* environment at startup. The five app env vars were set only for Production and marked Sensitive, so nothing comes down for Development. Vercel CLI's documented fallback to `.env.local` is unreliable once the cloud pull returns blanks for a variable, so we pre-export `.env.local` into the shell and let `vercel dev` inherit. When time allows, the proper fix is to tick *Development* on each of the 5 env vars in the Vercel dashboard; then `npx vercel dev` alone should work.

Codespaces forwards port 3000 to `https://<codespace-name>-3000.app.github.dev/`. That URL (and `/**` under it) must be in the Supabase Auth **Site URL** / **Redirect URLs** whitelist for magic link auth to work. The URL changes when the Codespace is rebuilt — update Supabase if that happens.

`vercel dev` does not live-reload `.env.local` changes. After editing env, kill and restart the server. Also, editing the `dev` script in `package.json` to call `vercel dev` causes recursive self-invocation — do not add a dev script back.

## Deployment gotchas (learned the hard way)

### The dual-package.json pattern is deliberate

This repo has **two** `package.json` files: root `package.json` and `api/package.json`. Both are needed — don't delete either thinking it's cruft.

- Root `package.json` declares the runtime deps (`@anthropic-ai/sdk`, `@supabase/supabase-js`) so `vercel dev` locally and Vercel's build-time install resolve them.
- `api/package.json` does two things: sets `"type": "commonjs"` so Node treats `api/polish.js` as CJS (the function uses `require()`, not `import`), and **re-declares the same runtime deps** so Vercel installs them at the function level and lands them in `/var/task/api/node_modules/` on the deployed function.

Without the sidecar deps, Vercel's root install silently reports `up to date in NNNms` during build but the function deploys without `node_modules`, and the first Polish hit crashes with `Cannot find module '@anthropic-ai/sdk'`. When bumping SDK versions, **update both files in lockstep** — otherwise the function pins to a stale version.

If you ever need to add another serverless function in `api/`, add its imports to *both* package.json files too.

### Verify env vars are *complete* on Vercel, not just present

Vercel's env-var UI will happily accept a truncated value (e.g. copy-paste that dropped a character, Enter pressed mid-paste). The deploy won't flag it and neither will our code — `process.env.ANTHROPIC_MODEL` just returns the garbage string, and the downstream Anthropic API returns a misleading `404 not_found_error` as if the model doesn't exist.

Before shipping a model change: go to Vercel → Settings → Environment Variables → click the eye icon on the value and confirm the full string matches `.env.local`. Same goes for the Supabase URL (easy to drop the trailing `.supabase.co`) and the service role key (long, easy to truncate).

## Things Nicholas already decided (don't relitigate)

- No payments, no subscriptions, ever
- Magic link only, no passwords
- He/she pronouns sent to the prompt (gender is not standalone PII, and the workflow benefit is real)
- K-6 scope (not just Year 6)
- Customisable statement bank per teacher
- Exemplar bank with archetype matching
- Browser-only PII storage
- Dual view (by-student and by-statement)
- Anthropic, not OpenAI

## Known issues from the Sheets version that must NOT be repeated

- Typos in seeded content ("englihs", "languague", "languae")
- Bare variable reference for API key (`OPENAI_API_KEY` undefined in `polishWithExtraNote`)
- Single exemplar per subject (need archetype-keyed library)
- Prompts hard-coded in script (need to be editable)

## Known bugs in the current repo (backlog)

Small things found incidentally during Week 1, flagged and not fixed inline per the working pattern below. Pick up when convenient.

- **Silent redirect on auth error.** When Supabase returns `#error=access_denied&error_code=otp_expired...` in the hash fragment (expired or already-used magic link), the app silently bounces the user to `/login` with no explanation — looks indistinguishable from "signed in and then logged out". Detect the error hash in `auth.js`, redirect to `/login?err=...`, and show a clear "that link expired — request a new one" message on the login page. Roughly 10 lines across `auth.js` and `login.html`.

## Working with Claude Code

Nicholas runs Claude Code with `--dangerously-skip-permissions --yes` and prefers numbered prompts. When generating tasks for him, structure as:

```
1. Do this specific thing
2. Then this
3. Then this
```

Not as prose paragraphs. Each numbered item should be a discrete, verifiable step.

### Cadence

Work one numbered task at a time. After each task, report what was done, what was tested, and whether anything is blocking. Do not batch multiple tasks into one message. It is cheap for Nicholas to say "yes, next"; it is expensive for him to disentangle a batch that went wrong three steps ago.

### Who does what

Claude owns code, file edits, and local verification. Nicholas owns cloud-console actions — Supabase dashboard, Vercel dashboard, Anthropic console, email, clicking the magic link in a browser, reading the Codespace Ports panel. When the next task needs a dashboard action, stop and hand Nicholas a precise, copy-pasteable checklist. Do not try to shell out to a CLI when a GUI flow is expected, and do not assume a prior cloud-console step was done — ask for a confirmation quote (error message, row count, success banner) before proceeding.

### Decisions and flags

- For non-trivial design or architectural decisions not covered in this doc or `docs/*.md`, stop and ask. Do not choose unilaterally.
- For bugs or inconsistencies found incidentally while working on something else, flag them as a separate item under *Known bugs in the current repo* above and keep working on the original task. Do not fix inline.
- When multiple paths forward exist, propose 2–3 labelled options (A/B/C) with the trade-off for each, recommend one, and let Nicholas pick with a one-word reply.

### Secrets in conversation

Never ask Nicholas to paste secrets (Anthropic API key, Supabase service role key) into chat. For values that need to live in `.env.local`, populate what can be populated from already-known public values, leave `PASTE_YOUR_X_HERE` sentinels for the sensitive ones, and point Nicholas at the Codespace file editor so secrets never enter the transcript.
