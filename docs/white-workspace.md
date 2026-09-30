# White workspace — 2026-09-30

This user-approved direction replaces the earlier editorial appearance in DESIGN.md. Existing behavior and data boundaries remain authoritative in PRODUCT.md.

The shell, sidebar and reading panes are white. Silver-blue translucent folds drift slowly around the workspace; the overview's feature card has its own clipped curtain. Paper text uses an opaque white background with no moving decoration beneath it.

Primary buttons use an inset highlight, a single hover sheen and a small press response. Keyboard focus remains visible. Disabled controls stop moving. The system's reduced-motion setting disables curtain animation and button movement; status color and focus cues remain.

Implementation lives in `app/white-theme.css` and `app/components/light-curtain.tsx`. The theme follows the existing stylesheet without introducing a new CSS framework or runtime dependency. Semantic success, warning, danger and AI labels remain distinct from the brand color.

The overview uses fetched account records and retains loading, guest, empty and error states. Record links open the existing paper or project workspaces; they do not imply a new record-specific route. No mockup summaries or fake productivity metrics are shipped.

Copy changes remove repeated English headings, decorative section numbering and implementation details such as storage migration plans. Translation is labeled neutrally because existing paper memory can contain either device translations or AI-enhanced translations.

Button material references Magic UI's MIT-licensed Shimmer Button. See THIRD_PARTY_NOTICES.md for the source and license. The hover-only CSS effect does not import Magic UI, Motion or a shader library.

Home uses a dedicated product-preview image instead of importing a visual-test baseline, so test output no longer changes a shipped page asset.
