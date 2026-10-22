# Paper selection before research · 2026-10-22

The owner requested a paper-selection screen before the reading workspace, common row actions including favorite/deletion, and ellipsis disclosure for secondary actions. Implementation is local and is not a production release.

## Result

- `/papers` first presents actual saved papers. Search covers titles, filenames, authors and tags; filters show all papers or favorites; sorting uses real import/update timestamps or titles.
- Titles open the existing reading workspace. Returning retains notes, the selected paragraph and the list's filter state. Browser back/forward, refresh and existing project-source links remain supported. Explicit `view=reader` URLs retain direct reader entry, with `paper` and optional `paragraph` identifying a source.
- Each row has a favorite toggle and an accessible ellipsis popover. The latter holds bibliography/citation and deletion. The existing confirmation distinguishes account-wide from guest-device deletion. Cancelling leaves the record intact.
- Empty libraries provide a clearly labelled demo action. Importing a PDF enters its new workspace after the existing local extraction and ownership checks. No demo is counted as a saved paper.
- Loading, failed reads, failed writes, pending sync and offline states remain explicit. Large desktop libraries scroll inside their field; mobile retains document flow and a return action in the reading toolbar.

## Data and ownership

`PaperRecord.favorite` is optional and boolean, distinct from paragraph bookmarks. The server validates it and reads/writes it inside the existing extracted-content JSON field. Old records without the field remain valid; backups retain valid flags and reject invalid ones. Atomic library patches read the latest local record and queue in one transaction; they preserve research content and refuse tombstones or another owner's records. Active-paper drafts are persisted before a library patch. Account changes reset the selection view and transient filters, and stale async actions check owner/epoch before updating the interface.

No database migration, RPC signature, authentication policy, credential exposure or raw-PDF upload changes. Supabase's current changelog and JSON documentation were read; this change adds a field to the existing JSON contract, not a new platform API. Route verification replaces the authenticated REST boundary with an isolated harness; it is not a production database query or real-account cross-device acceptance.

## Design basis and bounded review

Applied local Impeccable Operate/Read guidance and craft floor. Its launcher was not executed because DESIGN.md prohibits the downloaded binary and hook. Existing PRODUCT.md, DESIGN.md, implementation and actual production screenshot were read directly. Preserve the existing white reading room, system controls, type scale and blue. Use rows rather than decorative cards; let titles lead and keep actions beside their own record. Native popovers escape scrolling ancestors and provide outside dismissal. Keyboard support includes first-item focus, arrows, Home/End and Escape return. No new design runtime or dependency.

Two batched visual passes covered 1440, 1024 and 375px lists/menus/workspaces. The first exposed the need for a full-width, bounded desktop list and a mobile return action in the sticky toolbar; both were addressed together. The final pass showed no page overflow and no serious/critical Axe findings in the tested list/popover states. No visual baselines were changed. Existing reading-room regressions now enter the explicit reader URL; separate tests exercise the default library and actual click-through flow.

## Evidence

- Optimized Next build, TypeScript and targeted ESLint passed.
- Thirty related unit/API/sync/backup cases passed, including favorite true/false, legacy records, validation, source content preservation and backup filtering.
- Final browser batch: thirteen cases passed, including all new library flows, desktop/tablet/mobile, a 35-paper scrolling list, reading-position/note restoration, offline favorites/reload/reconnect, account isolation, menu metadata/deletion, source links and existing mobile reading/bibliography layout. Earlier valid affected-flow evidence covers delayed cloud reads, logout during import, deletion precedence, source ownership and closure of stale dialogs.
- The library suite uses a stateful mock cloud store for successful PUT/GET round trips; the shared generic API mock intentionally only acknowledges PUT. No real cloud persistence claim is inferred from those mocks.
- Two final focused cases also passed after adding assertions for removing a favorite from the filtered list and returning from the mobile reading toolbar; no application source changed after the successful build.
- Local screenshots and before evidence: `outputs/paper-library-2026-10-22/`. Captured list rows are synthetic test papers, not the user's research records. Full production regression, real-account writes and deployment have not been performed for this feature.

## Owner typography refinement

Removed the selection-page subtitle and the general PDF/sync explanation from the footer, as requested in the owner's screenshots. List typography now uses 20px section headings, 16px paper/empty-state titles and 14px metadata, status, labels and controls on both desktop and mobile. Reading-workspace typography and behavior remain unchanged. Targeted ESLint and the three existing LIBRARY-06 browser cases (1440/1024/375px) passed against the updated development preview at port 3217, including menu bounds, overflow, accessibility and click-through/return checks. The desktop and mobile captures were visually inspected together. This local refinement has not been deployed; no production rebuild or unrelated regression was necessary for the copy/CSS change.

The owner then requested a better search field. It now has a compact pale background, fixed icon alignment, shorter placeholder and a clear button; mobile filters and sorting share one row. The original matching/filter state logic is retained. Targeted ESLint and the same three affected browser cases passed after this change. Desktop/mobile captures were inspected as one batch; the local browser also confirmed typing, clearing and focus restoration. No production deployment was performed.

The owner's focused-state screenshot exposed an omitted check: the reading-room `input:focus-visible` selector overrode the search input's base outline reset, while the compound search field drew its own border and outer outline. A scoped search-input focus override now leaves the compound field as the sole focus indicator, with its outline overlapping its border. Local browser computed styles confirmed no inner outline/shadow and one 2px outer indicator for both keyboard Tab/Shift+Tab and mouse focus. The screenshot `outputs/paper-library-2026-10-22/search-focus-fixed.jpg` shows the correction. This CSS-only fix did not require repeating the unchanged layout/behavior suite or a production build.
