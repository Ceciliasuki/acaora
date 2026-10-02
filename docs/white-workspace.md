# White workspace — 2026-10-02

The current direction uses one continuous silver-white light field, graphite text and blue actions. The sidebar, headers and spacing expose the material on every route. Reading panes stay opaque white so motion does not pass under paper text.

The overview gives one real recent record priority and presents other records as a compact list. Empty and guest states collapse the unused record column. The duplicate workspace shortcut panel is removed; the existing sidebar remains the route selector. Account identity and actual record counts remain visible.

`app/components/light-curtain.tsx` renders four procedural folds whose curves deform over time. The root canvas and pause state survive internal navigation. Requested draw frequency is capped at 24 fps; render width is capped at 1600 pixels and device-pixel ratio at 1.25. Hidden tabs suspend the loop. Reduced motion renders a still frame. The visible pause control freezes and resumes the light field. Frames do not update React state, and listeners, animation requests and GL resources are cleaned up.

`public/pearl-curtain.webp` remains a static fallback when WebGL is unavailable or lost. It is generated decorative artwork, not an official Apple material. The web treatment borrows material separation, not Apple's platform-only native Liquid Glass implementation. No animation dependency was added.

The approved overview remains unchanged. Courses now expose a compact index and selected-course title on the global field, with one material editor and no idle result panel. Projects expose the index and title, with separate task and note surfaces instead of a full-width white workbench; the duplicate task rollup and progress slab are removed. Settings place category links beside one form. Data separates import, variable checks and analysis.

PaperLab defaults to the bounded reader, an open library margin and notes. AI analysis and scholarly search are separate modes, mounted but hidden while reading so their inputs and results survive switches. Rule-based reading hints are an optional disclosure, visibly distinguished from AI. Mobile mode switching retains the current paragraph and notes. The mobile reader toolbar explicitly wraps in rows so previous/next controls stay inside the sheet.

Buttons retain a single hover sheen, a small press response, keyboard focus and disabled feedback. Frequent reading controls use color changes. Semantic status and AI colors remain separate from the brand accent.

Shared material lives in `app/white-theme.css` and `app/components/light-curtain.tsx`; the three revised workspace compositions are scoped in `app/focused-workspaces.module.css`. Account, storage, API and sync contracts remain unchanged. The overview retains loading, guest, empty, ready and error states; record links open the existing workspaces. Course selection and material input pause during generation to prevent associating a response with a different course.

Product copy remains direct and retains AI provenance and privacy details. Functional paragraph and page numbers are preserved. The public page uses a single entrance action, an actual product preview and a directory of working routes. Its preview is a 1440 × 900, 40,530-byte WebP refreshed from the reviewed empty-state view and served directly.

Verification covers moving pixels, pause stability, canvas identity during navigation, forced WebGL failure, button feedback, five responsive widths, keyboard focus, critical accessibility checks, local PDF parsing and mocked account/sync scenarios. The reader visual baseline uses its intended viewport: Chrome's stitched full-page WebGL screenshot generated a transparent header region while both viewport capture and the real browser rendered it normally. That capture artifact is not accepted as a design baseline. Mocked authentication does not establish a live signed-in smoke result.

The button highlight retains the MIT-licensed Magic UI reference credited in THIRD_PARTY_NOTICES.md. The generated material is decorative artwork, not an official Apple interface asset or material implementation.
