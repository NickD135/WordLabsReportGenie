# Claude Code task list — Week 1

Read `CLAUDE.md` first, then work through these tasks in order. Each task is a discrete, verifiable step. After each task, confirm it works before moving to the next.

## Setup tasks

1. Initialise the repo locally and commit the current scaffolding to a new GitHub repo. Use `gh repo create` if available.

2. Open the repo in a GitHub Codespace.

3. Run `npm install` and confirm there are no errors.

4. Create a Supabase project in the `ap-southeast-2` (Sydney) region. Capture the project URL, anon key, and service role key.

5. In the Supabase SQL editor, run `supabase/schema.sql` in full. Confirm all tables and policies exist.

6. In the Supabase SQL editor, run `supabase/seed.sql`. Confirm the prompts, style guides, and exemplar slot rows are present.

7. In the Supabase SQL editor, insert the user's email into the `email_allowlist` table:
   ```sql
   INSERT INTO email_allowlist (email) VALUES ('REPLACE_WITH_USER_EMAIL');
   ```

8. Get an Anthropic API key from console.anthropic.com. Email Anthropic support to request Zero Data Retention be enabled on the API key, citing K-12 education use case.

9. Create a Vercel project linked to the GitHub repo.

10. Add the env vars from `.env.example` to the Vercel project settings: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_MODEL`.

11. Update `public/js/config.js` to set `supabaseUrl` and `supabaseAnonKey` to the real values from step 4.

12. Run `vercel dev` and confirm the app loads at `http://localhost:3000`.

## Magic link auth gating

13. In Supabase Auth settings, restrict signups by adding a Postgres function that checks the `email_allowlist` table on signup. Hook it as a trigger on `auth.users` insert. Reject if email is not in the allowlist.

14. Test: try signing in with an email NOT on the allowlist. Confirm the magic link email is not sent (or is sent but cannot complete signup).

15. Test: sign in with an allowlisted email. Confirm magic link arrives, click it, and confirm landing on the main app at `/`.

## First end-to-end run

16. In the app, click the class switcher and choose "+ New class". Create a class called "Test Class" for Year 6.

17. Click "+ Add" and add three test students with placeholder names.

18. Select a student. The By Student view should appear in the middle pane showing all the English statement categories. Tick a few statements.

19. Confirm ticks persist across page refresh (they're stored in IndexedDB).

20. In the right pane, click "Polish".

21. Verify the polished comment appears, contains the student's name, and is roughly 100-150 words. Verify the quality flag area shows feedback.

22. Verify in the browser dev tools (Network tab) that the request to `/api/polish` does NOT contain the student's name in the `rawText` payload — only `{first_name}` placeholders.

## Statement bank import

23. Read `docs/statement-bank-import.md`.

24. Get the CommentBank CSV from the user (export from the existing Google Sheet).

25. Write `scripts/import-bank.js` that reads the CSV, normalises categories, and produces `INSERT INTO statements (...)` SQL statements. Save the output to `supabase/statements-import.sql`.

26. Run the SQL in Supabase. Verify a few statements appear correctly in Settings → Statement Bank in the app.

## End of Week 1

By this point the user should be able to: sign in, create a class, add students, tick English statements, polish a comment, and see the polished output. The other two subjects (Maths, General) and the By Statement view are next week.

Report back any errors, missing files, or design decisions that need user input.
