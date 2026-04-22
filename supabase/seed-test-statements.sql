-- Temporary English Stage 3 seed statements for Week 1 end-to-end testing.
-- Replace (or augment) with the real CommentBank import in Task 26.
--
-- Safe to re-run: delete existing Stage 3 English rows first if you want a clean reset.

insert into statements (stages, subject, category, subcategory, content, position) values
  -- Opening
  (array[3], 'English', 'Opening', null, '{first_name} approaches English lessons with curiosity and a willingness to engage with challenging texts.', 0),
  (array[3], 'English', 'Opening', null, '{first_name} has demonstrated a steady commitment to their English learning across the semester.', 1),

  -- Writing — Strengths
  (array[3], 'English', 'Writing', 'Strengths', '{first_name} crafts narratives with a clear structure, drawing the reader in through vivid description and a distinctive voice.', 0),
  (array[3], 'English', 'Writing', 'Strengths', '{first_name} uses a range of sentence types and a growing vocabulary to add precision and interest to their writing.', 1),

  -- Writing — Goals
  (array[3], 'English', 'Writing', 'Goals', '{first_name} is encouraged to revise drafts more carefully, paying particular attention to paragraph structure and the use of cohesive devices.', 0),
  (array[3], 'English', 'Writing', 'Goals', '{first_name} will benefit from experimenting with different text types, including persuasive and informative writing, to broaden their range.', 1),

  -- Reading — Strengths
  (array[3], 'English', 'Reading', 'Strengths', '{first_name} reads a range of texts with fluency and expression, showing clear enjoyment of the reading process.', 0),
  (array[3], 'English', 'Reading', 'Strengths', '{first_name} makes thoughtful connections between texts and can discuss author craft with growing sophistication.', 1),

  -- Reading — Goals
  (array[3], 'English', 'Reading', 'Goals', '{first_name} is encouraged to broaden their reading diet by exploring unfamiliar genres and authors over the coming term.', 0),
  (array[3], 'English', 'Reading', 'Goals', '{first_name} would benefit from keeping a reading journal to track responses to texts and support deeper reflection.', 1),

  -- Comprehension — Strengths
  (array[3], 'English', 'Comprehension', 'Strengths', '{first_name} responds to literal and inferential questions with accuracy, drawing evidence from the text to support their answers.', 0),
  (array[3], 'English', 'Comprehension', 'Strengths', '{first_name} shows strong understanding of how authors use language features to shape meaning for the reader.', 1),

  -- Comprehension — Goals
  (array[3], 'English', 'Comprehension', 'Goals', '{first_name} is encouraged to explain their reasoning more fully when answering inferential questions, going beyond the surface of the text.', 0),

  -- Spelling — Strengths
  (array[3], 'English', 'Spelling', 'Strengths', '{first_name} applies a range of spelling strategies with accuracy, including etymology and morphology, across most written tasks.', 0),

  -- Spelling — Goals
  (array[3], 'English', 'Spelling', 'Goals', '{first_name} would benefit from proofreading written work more carefully, particularly for high-frequency words and homophones.', 0);
