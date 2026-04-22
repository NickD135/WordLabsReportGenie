# Report Genie

Browser-based report comment generator for K-6 NSW primary teachers.

## Setup

### 1. Prerequisites

- Node.js 20+ (for Vercel CLI)
- A Supabase project in `ap-southeast-2` (Sydney)
- An Anthropic API key with Zero Data Retention enabled
- Vercel account

### 2. Local development

```bash
# Install Vercel CLI globally
npm i -g vercel

# Install project deps
npm install

# Copy env template and fill in values
cp .env.example .env.local

# Run the dev server (serves /public + /api functions)
vercel dev
```

App will be at `http://localhost:3000`.

### 3. Environment variables

See `.env.example`. You'll need:

- `ANTHROPIC_API_KEY` — your Claude API key (with ZDR enabled)
- `SUPABASE_URL` — public Supabase project URL
- `SUPABASE_ANON_KEY` — public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — only used by serverless function for allowlist checks

### 4. Database setup

In your Supabase project SQL editor, run in order:

1. `supabase/schema.sql` — creates tables and RLS policies
2. `supabase/seed.sql` — seeds default prompts, style guides, and exemplar slots
3. Import the statement bank — see `docs/statement-bank-import.md`

### 5. Email allowlist

Add permitted email addresses to the `email_allowlist` table:

```sql
INSERT INTO email_allowlist (email) VALUES
  ('your.email@example.com'),
  ('colleague@example.com');
```

### 6. Deploy

```bash
vercel deploy
```

Add the env vars to your Vercel project settings.

## Architecture

See `CLAUDE.md` for the full architectural context, privacy model, and build phases.

## Privacy

No student information is ever transmitted to or stored on any external server. All student names, ticks, and outputs live exclusively in the teacher's browser (IndexedDB). The AI polish step only ever sees text with `{first_name}` placeholders.

See `docs/privacy-architecture.md` for the full privacy chain.
