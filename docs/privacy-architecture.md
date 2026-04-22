# Privacy architecture

This document describes how Report Genie handles student information. It is the source of truth for the privacy story told to teachers, parents, and any school or DoE personnel who ask.

## Principle

**No student personally identifying information is ever transmitted to or stored on any server controlled by Report Genie or its third-party providers.**

## What lives where

### On the teacher's device only (browser IndexedDB)
- Class names and year groups
- Student first names
- Student gender markers (used for pronoun selection)
- Profile tags (e.g. EALD, working towards)
- Free-text notes about a student
- Tick marks against statements
- Polished comment outputs (all versions)
- Free-text "extra context" the teacher provides per student

This data never leaves the device unless the teacher explicitly exports it.

### On Supabase (Sydney region)
- Teacher email address (for magic link authentication)
- Teacher user ID
- Statement bank content
- System prompt content
- Style guide content
- Exemplar comment content
- Per-teacher overrides to the above

No student information of any kind.

### Sent to Anthropic (per-request, never stored)
- The text of selected (ticked) statement bank items, with `{first_name}` placeholders
- Optional teacher feedback text, with names replaced by `{first_name}` placeholders
- Subject (English / Maths / General)
- Pronoun preference (he/him, she/her, or they/them)
- Year stage (1, 2, or 3) for exemplar selection
- Archetype label for exemplar selection (e.g. solid_at_grade)

The Anthropic API account has Zero Data Retention enabled. Prompts and responses are not logged, are not used for training, and are not retained.

## The depersonalisation chain

1. The teacher ticks statements in their browser. Ticks are stored in IndexedDB only.
2. The teacher clicks Polish for a specific student.
3. The browser pulls the ticked statements and any teacher feedback for that student and subject.
4. The browser runs the depersonalisation pass: any occurrence of the student's first name in any text is replaced with `{first_name}`.
5. The browser runs a sanity check: if the student's name still appears in the assembled payload, the request is aborted before any network call is made.
6. The browser POSTs the placeholdered text to the Vercel serverless function at `/api/polish`.
7. The serverless function authenticates the teacher (via their Supabase access token), pulls the relevant prompt/style guide/exemplar from Supabase, and forwards the request to Anthropic.
8. Anthropic returns a polished comment with `{first_name}` placeholders preserved.
9. The browser receives the response and substitutes the placeholders for the real first name before display.
10. The browser stores the polished comment in IndexedDB.

The serverless function never sees a student name. The Supabase database never sees a student name. Anthropic never sees a student name.

## What this means for compliance

Because no student PII leaves the teacher's device and reaches Report Genie's infrastructure, Report Genie is not a data processor of student information. The teacher remains the sole controller and processor of any student data they enter into the tool.

The teacher's email address and the audit log of when they signed in are personal information about the teacher themselves, processed under standard authentication purposes.

## Defence in depth

Multiple safeguards are layered to prevent accidental PII leakage:

- The statement bank is authored using `{first_name}` placeholders rather than literal names.
- The browser runs a depersonalisation pass on all text before sending, regardless of source.
- The browser runs a final sanity check that aborts if the student's name still appears.
- The serverless function refuses requests where the placeholder is missing from substantive text.
- The Anthropic API account has Zero Data Retention enabled.
- The Supabase Row Level Security policies prevent any teacher from reading another teacher's data.
- The serverless function uses the user's session token to authenticate, not a shared service role.

## What the teacher should still do

- Use a strong, unique password on their email account (which gates magic link access).
- Sign out on shared devices.
- Be aware that exporting the class to CSV or Word produces a file containing student information that they then need to handle appropriately.
