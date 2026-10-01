# White workspace — 2026-10-01

The current direction uses one continuous silver-white light field, graphite text and blue actions. The sidebar, headers and spacing expose the material on every route. Reading panes stay opaque white so motion does not pass under paper text.

The overview gives one real recent record priority and presents other records as a compact list. Empty and guest states collapse the unused record column. The duplicate workspace shortcut panel is removed; the existing sidebar remains the route selector. Account identity and actual record counts remain visible.

`app/components/light-curtain.tsx` renders four procedural folds whose curves deform over time. The root canvas and pause state survive internal navigation. Requested draw frequency is capped at 24 fps; render width is capped at 1600 pixels and device-pixel ratio at 1.25. Hidden tabs suspend the loop. Reduced motion renders a still frame. The visible pause control freezes and resumes the light field. Frames do not update React state, and listeners, animation requests and GL resources are cleaned up.

`public/pearl-curtain.webp` remains a static fallback when WebGL is unavailable or lost. It is generated decorative artwork, not an official Apple material. The web treatment borrows material separation, not Apple's platform-only native Liquid Glass implementation. No animation dependency was added.

The working pages no longer share a metrics register and status footer template. Courses pair selection and material, with practice below. Projects pair a project list with tasks and notes. Settings place category links beside one form. Data separates import, variable checks and analysis. The reader retains independent scroll panes, and AI provenance stays next to the relevant controls.

Buttons retain a single hover sheen, a small press response, keyboard focus and disabled feedback. Frequent reading controls use color changes. Semantic status and AI colors remain separate from the brand accent.

Implementation lives in `app/white-theme.css` and `app/components/light-curtain.tsx`. Account, storage, API and sync behavior remain unchanged. The overview retains loading, guest, empty, ready and error states; record links open the existing workspaces.

Product copy remains direct and retains AI provenance and privacy details. Functional paragraph and page numbers are preserved. The public page uses a single entrance action, an actual product preview and a directory of working routes. Its preview is a 1440 × 900, 40,530-byte WebP refreshed from the reviewed empty-state view and served directly.

Verification covers moving pixels, pause stability, canvas identity during navigation, forced WebGL failure, button feedback, five responsive widths, keyboard focus, critical accessibility checks, local PDF parsing and mocked account/sync scenarios. The reader visual baseline uses its intended viewport: Chrome's stitched full-page WebGL screenshot generated a transparent header region while both viewport capture and the real browser rendered it normally. That capture artifact is not accepted as a design baseline. Mocked authentication does not establish a live signed-in smoke result.

The button highlight retains the MIT-licensed Magic UI reference credited in THIRD_PARTY_NOTICES.md. The generated material is decorative artwork, not an official Apple interface asset or material implementation.
