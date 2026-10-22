# Course selection and search clipping · 2026-10-22

Owner request: fix the clipped left edge of the paper search field, and introduce a similar course-selection screen before entering learning. This is a local change, not a production release.

## Behavior

- `/courses` now renders the seven actual curated courses as a list. Search matches course name/code, track, description and prerequisites; track filters compose with search. Clearing restores input focus, and an empty result has a show-all recovery action.
- A row opens the existing `/courses/[courseId]` syllabus. Its unchanged start/resume action enters the lesson. Course-specific headers provide a return to the course list. Deep lesson, assessment and review links remain intact, and the lesson chapter rail remains collapsible.
- Counts come from the curriculum's chapters and non-optional lessons. No fake account progress, favorite, deletion or new persistent schema was introduced. The list mounts no course-progress hook and no longer reads every lesson/assessment solely to build an automatically selected syllabus. Actual content availability is still checked on each existing course route.
- The paper field's 2px outline is now offset inward by 2px, entirely inside its bounds. Its input retains no nested outline. This prevents the scroll container from clipping the left focus edge without widening the field or removing the focus indicator. The same focus geometry is used in course search.

## Design and verification

Applied Impeccable Operate guidance and the craft floor directly from the approved product/design context; the prohibited launcher/hook was not executed. The new course list shares the approved paper list's type hierarchy, ordinary blue, flat rows, search size and clear affordance. The learning workspace's existing styling remains in scope only for its return action.

Two batched visual passes covered desktop and mobile, with automated captures at 1440/1024/375px. The first exposed low contrast caused by a pale marker overriding the shared white selected text, plus redundant mobile clearance/centered heading. The final pass confirmed the corrected brand-blue marker, left-aligned mobile heading, visible search focus, unclipped controls and no page overflow. No visual golden was changed.

- Optimized Next build and TypeScript passed with `ACAORA_NEXT_DIST_DIR=work/course-selection-build`; `/courses` remains prerendered. Metadata from this direct local build is historical and does not prove deployment identity.
- Targeted ESLint passed for the changed application and affected browser tests.
- Five selection cases passed: list-before-learning, keyboard entry, actual read/resume after returning, browser history, search/filter/clear/recovery and direct-route refresh; three widths also passed serious/critical Axe and overflow checks.
- Seven affected existing cases passed: all comprehensive-case links, first learning/practice path, main rail navigation, chapter rail behavior, mobile disclosure/focus trap, course drafts/focus mode, and selection-marker behavior with reduced motion. A test initially reloaded before client navigation completed; it now waits for the destination URL before testing refresh.
- Local browser inspection confirmed the paper input has no inner outline and the parent has a single fully inset 2px indicator. Screenshot: `outputs/paper-library-2026-10-22/search-focus-inset-fixed.jpg`.
- Course screenshots and pre-change evidence: `outputs/course-selection-2026-10-22/`. Preview: `http://127.0.0.1:3217/courses`.

Progress acceptance uses the repository's isolated API mock. No production account records were written; real cross-device sync and production deployment were not claimed. No database/authentication, lesson content, grading, or AI changes were made.

## Owner list refinement

The owner requested hiding the visible internal codes and improving the sparse UI. Codes are removed from list text while route IDs, progress keys and existing search matching stay intact. The header/list share a narrower measure; search sits beside the section heading, and rows now distinguish title/track, real curriculum prerequisites, aligned chapter/core-lesson counts and the course-entry action. Mobile preserves all useful text while moving counts below the course description. Hover/focus and reduced motion remain explicit.

Targeted ESLint and all five course-selection cases passed against the updated dev preview. The final three-width capture/a11y cases also passed after waiting for client hydration before taking screenshots: Playwright's temporary caret styling could otherwise be applied before React hydration and generate a dev-only attribute-mismatch badge. This readiness wait fixes the capture timing, not application behavior. Two batched desktop/mobile image inspections confirmed the final layout, with no visual baseline updates. Local browser text inspection found no visible internal codes. No production build or deployment was repeated for this local copy/CSS refinement.
