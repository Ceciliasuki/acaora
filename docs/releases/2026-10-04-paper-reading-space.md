# Wider continuous paper reader release

Historical release evidence from 2026-10-04, consolidated into the primary workspace on 2026-10-05. Raw logs and screenshots remain in `C:\Users\Cecilia\.codex\worktrees\curated-courses\acaora\outputs`; the counts below are historical checks, not a new execution. Current acceptance: [2026-10-05 real use](../acceptance/2026-10-05-real-use.md).

PR: https://github.com/Ceciliasuki/acaora/pull/11
Source base: cb2165aa8ef7bafa2978a7e56731d38e993c7f7b
Reviewed final head: 74b2600720567f303f93edb0cd1c4cf423dbd939
Final CI run: https://github.com/Ceciliasuki/acaora/actions/runs/37186387593

## Behavior

- Desktop defaults to the wider centered continuous reader. Library and notes are independently collapsible from the toolbar; Focus reading collapses both. Closing a panel returns focus to its toggle.
- Panel preferences are optional device-local booleans; storage failure does not prevent reading. Editors stay mounted and paragraph notes remain attached to their original paragraph.
- Mobile tabs remain independent of desktop preferences; tablet panels avoid document overflow.
- Width changes restore the current paragraph into the visible reader. Height-only changes preserve the existing text position.
- No database/schema, authentication, synchronization API, dependencies or shared navigation changes.

## Local proof

- Initial new panel tests failed against the old layout (paper-space-red.log).
- Full 81 local browser checks passed before the final text-width adjustment (paper-space-all.log).
- Final text width and centered position passed; only PaperLab visual baseline updated. All 17 UI/visual/responsive/accessibility checks passed; other page baselines, including Dashboard, unchanged (paper-space-final-ui.log).
- Responsive geometry regression failed before its fix: Results y2474.375 versus reader bottom811.375 (paper-space-resize-geometry.log). The earlier active-state-only probe passed and was insufficient evidence of visibility.
- After the fix all 18 paper checks passed (paper-space-resize-green.log). Final width-only restoration and height-only stability checks passed 2/2 (paper-space-final-layout.log). Scoped lint and production build passed (paper-space-lint.log, paper-space-build.log).
- Read-only independent review approved final head, with no remaining Critical/Important/Minor findings (paper-space-review.md).

## Release proof

- Final PR CI succeeded: 68/68 unit and source checks, 72/72 browser checks, typecheck, lint, production build and clean tracked-files check. No browser failures, retries or flaky results. Raw log: paper-space-ci.log. CI tested the PR merge tree 0366556adb3b00b579b710be7ee525206dadf097.
- PR11 merged as f873000fb4c25d0ea995cf1d8ba84b45e7c4e1f7. Fetched origin/main matches that SHA; git diff from reviewed head74b2600 to origin/main is empty.
- EdgeOne production deployment dpi7231vp37z succeeded in 243s. Its displayed commit and generated build metadata match the exact merged SHA. Initialization, clone, dependency install, build and deploy all succeeded.
- Live https://acaora.cn/api/version returns commit f873000fb4c25d0ea995cf1d8ba84b45e7c4e1f7, buildTime2026-10-04T07:46:15.563Z, environment production.
- Isolated live browser verification passed 14 checks with no API mocks: exact release identity, collapsed defaults, centered width, both viewport directions, actual PDF text extraction/import, real IndexedDB note durability, both-panel width reduction, Focus reading, reload/preferences/note restoration, close-button focus, mobile/tablet operation and overflow, zero raw-PDF uploads. Captured reader width1105px and text width741.75px at1440px viewport (paper-space-live.log, verify-paper-space.mjs).
- Visually inspected actual production screenshots: paper-space-live-wide.png and paper-space-live-mobile.png. All fixture state lived in an ephemeral anonymous browser context closed by the script.

Production verification uses synthetic material and an ephemeral anonymous browser context; no user paper, account credential or production test account is used. Existing authenticated continuous-reading release evidence is in [the continuous-reader release](2026-10-04-continuous-reader.md).
