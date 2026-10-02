# Focused workspaces

The overview is approved and must keep its markup, styles and visual baseline. The user identifies excessive panels, crowded pages and an obscured light curtain as the remaining problem in papers, courses and projects.

Use the existing white material and blue controls. Keep the root canvas and shared navigation untouched. Scope all new styles with a CSS module on the three page roots.

- Courses: a compact course index beside the selected course and its material editor. Show generated exercises only after generation, with AI provenance.
- Projects: an open project index and title on the global background; separate working surfaces for tasks and notes. Remove duplicated task rollups and decorative progress slabs.
- Papers: default to the bounded reader with an open library and note margin. Switch to AI or search when requested, retaining mounted state and all import, translation, sync and privacy contracts. Rule-based reading hints become an optional disclosure.

Validation: long-reader containment, mode switching with retained notes, course switching and generation validation, existing project persistence/modal tests, desktop/mobile rendered review, accessibility and overflow tests. Verify the approved dashboard baseline without replacing it. Publish only after lint, typecheck, build, unit and browser checks, followed by CI and production version verification.

## Local verification

- Typecheck, full lint, production build and 28 unit/source checks passed.
- Full browser suite: 49 passed. It includes account/sync regressions, motion, project persistence and the new course/mode-switch cases.
- Render review found a clipped mobile paragraph toolbar that document-width checks missed. A containment assertion reproduced the failure; a page-scoped row-wrap rule fixed it. The final build and 18 relevant browser checks (all nine visual baselines, five responsive widths, both accessibility smokes and course/mobile mode behavior) passed afterward. Changed TypeScript and tests also passed lint.
- Only courses, papers and projects visual baselines were replaced and inspected. The dashboard baseline remains byte-identical: SHA256 `313636c43d02e1d96bfdd27a4e68693fb1777f4e11ddeda19ad7d9a3c24676e4`.
- Reviewed actual desktop and 375px mobile renders. Authentication, synchronization and paid AI behavior use deterministic mocks; no paid provider request or real-account production smoke was performed.
