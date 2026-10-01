# White workspace — 2026-10-01

The current direction uses silver-white material, graphite text and blue for actions and selected states. The sidebar sits beside one opaque working surface. Reading panes stay white, with no animated background under the paper text.

The overview gives one real recent record priority and presents other records as a compact list. Empty and guest states collapse the unused record column. Workspace shortcuts use open spacing instead of four additional bordered cards.

`public/pearl-curtain.webp` is a generated decorative material asset, encoded as a 1536 × 1024 WebP (40,332 bytes). CSS translates and scales the material layer slowly and moves a separate light wash. No canvas loop, per-frame React state or animation dependency is used. Reduced motion disables both layers.

Buttons retain a single hover sheen, a small press response, keyboard focus and disabled feedback. Frequent reading controls use color changes. Semantic status and AI colors remain separate from the brand accent.

Implementation lives in `app/white-theme.css` and `app/components/light-curtain.tsx`. Account, storage, API and sync behavior remain unchanged. The overview retains loading, guest, empty, ready and error states; record links open the existing workspaces.

Product copy remains direct and retains AI provenance and privacy details. Functional paragraph and page numbers are preserved. The home preview is a dedicated 49,680-byte WebP, refreshed from the reviewed empty-state view and served directly to avoid the pending image-optimizer request observed during verification.

The button highlight retains the MIT-licensed Magic UI reference credited in THIRD_PARTY_NOTICES.md. The generated material is decorative artwork, not an official Apple interface asset or material implementation.
