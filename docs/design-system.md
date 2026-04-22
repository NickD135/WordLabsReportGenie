# Report Genie — Design System

The visual identity is **editorial / literary**. The metaphor is that teachers are writers and reports are pieces of writing. The interface should feel like a writer's environment — calm, considered, beautifully typeset, with the polished comment treated as the published artefact.

This document is the source of truth. If a new view or component is being added, follow the rules here. If something doesn't fit the rules, either rework it until it does or update this doc with a deliberate exception.

## Audience

The user is a tired teacher writing 30 reports on a Sunday afternoon, possibly with a glass of wine. The visual register must be calm, warm, low-stimulation, professional. They are not a child. Do not patronise.

## Aesthetic anchors

- Closer to a literary magazine's CMS than to dashboard software.
- Closer to Linear or Notion than to admin panels.
- The opposite of Word Labs, which is bright and child-facing.
- Generous whitespace. Restrained palette. Single accent.
- Typography does the heavy lifting; chrome is minimal.

## Type

Three families, used with discipline:

- **Fraunces** — display and the polished comment output. Optical sizing matters; use `font-variation-settings: "opsz" <size>` to match the rendered size. Italic variants are warm and used sparingly for emphasis (the student's name in the headline, the seal-red name in the composition body).
- **DM Sans** — UI chrome. Buttons, labels, navigation, form inputs, helper text.
- **DM Mono** — metadata, version numbers, all-caps labels, profile tags, the privacy ribbon, quality flags. Always with letter-spacing of 0.08em or more, always uppercase.

The **statements being ticked are prose**. They are set in Fraunces because the teacher is reading writing they've curated. Form widgets disappear; the prose remains.

## Palette

CSS variables live in `public/css/styles.css`. Use them; never hardcode hex.

- `--paper` (#F4ECDD) — page background, warm cream like aged paper
- `--paper-soft` (#FAF4E8) — card surfaces, subtle elevation
- `--paper-sunk` (#ECE2CD) — recessed areas, hover states, rail backgrounds
- `--ink` (#1B1410) — primary text, warm black not pure black
- `--ink-soft` (#4A3F36) — secondary text
- `--ink-faint` (#8A7E70) — tertiary text, metadata
- `--rule` (#D9CDB4) — dividers
- `--rule-soft` (#E5DAC1) — lighter dividers (dashed lines, subtle separations)

The single accent is **wax-seal red**. It is used sparingly and always means "this matters":

- `--seal` (#8B2C2C) — wordmark dot, active state markers, primary action hover, the italic name flourish in the composition body, version numbers in composition meta, focus rings, the seal-tagged profile tag
- `--seal-soft` (#A8453E) — borders for seal-tagged elements
- `--seal-faint` (#E8D4D0) — backgrounds for seal-tagged elements

Status colours are muted to stay in keeping:
- `--sage` (#4F6B41) — success, "polished" progress dot, privacy shield icon
- `--mustard` (#97742A) — warning, quality flag warnings, "ticked" progress dot

**Never** introduce a new colour. If a new state needs to be expressed, find a way using these.

## Spatial rules

- The body grain is a subtle SVG noise overlay applied at body level. Don't reapply.
- The three-pane layout is fixed: 260px rail, fluid centre, 420px output. The output column is wider than typical because the composition card needs reading width.
- Rail uses `--paper-soft`. Work area uses the body `--paper` (so the centre feels like the page being written on). Output pane uses `--paper-soft` again. This creates a visual rhythm of "shelf — page — shelf".
- Generous padding: 2.25rem 3rem 4rem on the work area, 1.75rem on the output pane, 1rem 1.5rem on the topbar.

## The composition card

This is the hero. It is set apart visually because the polished comment is the artefact the teacher cares about. The rules:

- White-cream paper background (`--paper`), set against the soft surrounding pane (`--paper-soft`).
- 1px solid `--rule` border, subtle 6px-24px shadow at 6% opacity.
- Top meta strip in `--paper-soft` with a dashed bottom border. Label in mono caps. Version number in seal red.
- Body in Fraunces at 16px with line-height 1.65, opsz 18.
- The student's name appears as `<span class="name-em">` in italic seal red (the polish endpoint output is post-processed to wrap the first occurrence).
- Quality flags below in a separate dashed-bordered footer. Sage for clean, mustard for warnings. All caps, mono, 10px, with a serif-italic glyph as the bullet.

Do not put any other content inside the composition card. It is the published piece.

## Tick boxes

The default browser checkbox is hidden. The custom mark is a 16px hollow square in `--ink-faint` that fills with `--seal` when ticked, with a serif checkmark in `--paper`. The mark sits in the left margin of the statement, which itself is set in Fraunces at 16px.

The intent is that ticking feels like marking up a piece of prose with marginal notation, not like filling out a form.

## Wordmark

"Report *Genie*" — Fraunces 22px display, with a 6px wax-seal dot before the R. "Report" in normal weight, "Genie" in italic of the same family. No icon, no quill, no inkwell — these are too on-the-nose. The wordmark is purely typographic.

The dot gets bigger (8px) on the login page where the wordmark is the focal point.

## Privacy ribbon

A 30px-tall strip directly under the topbar. Soft cream background, sage shield icon, friendly copy: *"On your device. Student names never leave this browser. Polishing sends only placeholder text."* Always visible. The privacy story is part of the visual identity, not buried in fine print.

## Motion

Subtle and purposeful:
- Composition card: `ink-bloom` reveal (4px slide + fade, 0.4s ease-out) when first appearing.
- Student rows: staggered `fade-up` on first paint.
- Tick boxes: 0.15s transition on background and border. No bounce, no scale.
- Polish button: hover fades from `--ink` to `--seal` over 0.15s.

No micro-interactions for their own sake.

## What to avoid

- Tailwind classes — the design system replaces them. Use semantic class names from `styles.css`.
- Solid pure black or pure white. We use `--ink` and `--paper`.
- Bullet lists in UI chrome — the metaphor of "writing" makes them visually intrusive. Use prose or numbered structure where lists are needed.
- Generic system fonts visible to the user. Always fall back through Georgia → serif so the look stays close even if Fraunces fails to load.
- Border-radius above 2px — the editorial look is squared and crisp.
- Drop shadows above 6px-24px at 6% — anything more reads as floaty SaaS.
- Emoji as iconography. SVGs only, restrained.

## Adding new components

Before building, check whether the design system already has a pattern. Most needs are covered by:

- `.ghost-btn` — secondary button
- `.polish-btn` — primary action
- `.pill-group` — segmented control
- `.tag` / `.tag.seal` — chip
- `.label-mono` — form/section label
- `.section` — bordered work block
- `.feedback-box` — sunken input area
- `.composition` — published artefact

If a new pattern is genuinely needed, define the CSS as a new class in `styles.css`, document it here, and use it across the app from then on.
