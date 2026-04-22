# Importing the statement bank

The Sheets-based Report Genie ships with a CommentBank tab containing roughly 2,000 statements organised by Stage, Subject, Category, and Subcategory. This document explains how to bring that data into the new Supabase-backed bank.

## Source format

Export the CommentBank tab from Google Sheets as CSV. Expected columns:

- A: Stage (1, 2, or 3)
- B: Subject (English, Maths, or General)
- C: Category (e.g. Opening, Writing, Number and Algebra, Disposition)
- D: Subcategory (e.g. Strengths, Goals, Resilience) — may be blank
- E: Comment (the statement text)

## Target schema

The `statements` table in Supabase:

```
id          uuid    (auto-generated)
stages      int[]   (e.g. {1} for Stage 1, {1,2} for spans)
subject     text    ('English' | 'Maths' | 'General')
category    text
subcategory text    (nullable)
content     text    (use {first_name} for the student's name)
position    int     (default 0)
```

## Import process

The import is a one-time job for v1. You can either:

### Option A: Direct SQL import via Supabase SQL editor

1. Open the CSV in a text editor and quickly scan for any obvious junk rows (the original sheet has a few duplicate categories like 'Opening' / 'Opening Statement' / 'Opening Statements' that should be normalised before import).
2. Convert the CSV to a series of `INSERT INTO statements (stages, subject, category, subcategory, content) VALUES (ARRAY[...], '...', '...', '...', '...');` statements. Excel/Sheets can do this with a formula, or use a tiny Python script.
3. Replace any literal first names in the comment text with `{first_name}`.
4. Paste into the Supabase SQL editor and run.

### Option B: Import script (recommended for repeat imports)

A short Node script (not yet written — see `/scripts/import-bank.js` placeholder) that:

1. Reads the CSV
2. Normalises category names (resolves the Opening/Opening Statement/Opening Statements duplication)
3. Replaces literal names with `{first_name}` placeholders
4. Inserts via the Supabase service role key

## Cleanup checklist before import

These are the issues identified in the original CommentBank that should be resolved before bulk import:

- Normalise category names: `Opening` / `Opening Statement` / `Opening Statements` → pick one
- Normalise subcategory whitespace: `Multiplication/Division -Strengths` → `Multiplication/Division - Strengths`
- Spell-check pass: e.g. `Resillience` → `Resilience`
- Remove placeholder rows ("Statement 4", "Goal 2", etc.) — these existed because the Sheets tool needed empty slots
- Replace any literal student names with `{first_name}`
- Decide on stage spans: most Stage 1 statements probably also work for K (Early Stage 1), so consider `{1}` vs `{1}` with a separate K bank

## After import

1. Open the app, sign in, go to Settings → Statement Bank.
2. Browse each subject and spot-check.
3. Edit any statements that need rewording — these become teacher overrides and don't change the master.
4. Add new statements as needed using the "Add new" button.
