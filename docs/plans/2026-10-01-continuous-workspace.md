# Continuous white workspace

## Brief and audit

The previous redesign did not satisfy the user: its light effect belonged to an overview card, while the other routes repeated metrics, header bands and status footers. The user asked for a global effect and a less templated interface, using taste and UI/UX Pro Max.

Design read: a Chinese research workspace with a continuous silver-white light surface, graphite text and deliberate blue actions. Variance 7, motion 6, density 5. The overview can expose the material; reading text stays on opaque white. This is a web material approximation, not Apple's native Liquid Glass.

The UI/UX Pro Max design-system search and one narrower retry returned marketing patterns and palettes that did not fit this product. They were rejected rather than persisted. The verified style guidance was about separating navigation material from readable content; the Next.js guidance supported an isolated client leaf. The continuous-motion guidance conflicts with the user's explicit request, so motion is available with a pause control, reduced-motion handling and hidden-tab suspension.

## Implementation

- Keep the existing routes, primary navigation names, form field contracts, authentication, storage and synchronization.
- Mount one procedural WebGL curtain in the root layout. The curves themselves deform over time; it is not a moving bitmap. Limit requested draw frequency to 24 fps and render resolution to 1600 pixels wide, with a 1.25 device-pixel ratio ceiling. Pause on hidden tabs; render a still frame under reduced motion. Clean up animation frames, listeners and GL resources. Keep a static material when GL is unavailable or lost.
- Preserve the canvas and its pause state across internal navigation. Offer an accessible pause/resume control. Never put continuous values into React state.
- Remove the shared metrics and status-band template from courses, projects, data and settings. Keep actual data counts where they explain the current file, project or reading state.
- Courses pair selection and course material, with practice beneath. Projects pair a project list with tasks and notes. Settings place categories beside one form. Data separates file import, variable checks and analysis. Paper reading keeps a white workbench under the shared ambient header.
- Make the public page an asymmetric entrance with one actual product image and a useful list of workspaces. Remove decorative section numbers, duplicate actions and unsupported marketing claims.
- Preserve AI provenance, file-transmission boundaries, validation messages, disabled feedback and keyboard focus. Account identity remains in the sidebar instead of the overview greeting.

## Review and evidence

Review real desktop and mobile captures of every public and working route before accepting visual baselines. The normal-motion browser check must observe changing pixels, freeze on pause and retain the same canvas during workspace navigation. Also exercise forced WebGL failure, responsive overflow, contrast, keyboard navigation, long-paper scrolling and the existing auth/sync scenarios. Account and sync checks use mocked services; do not infer live authenticated smoke from them.

The complete browser run passed 47 checks with retries disabled, including both new WebGL checks without skipping. The first run's failures came from stale greeting/model text locators; identity checks now assert the actual email and sign-out control, and the model retains its own visible text element. Nine desktop candidates were inspected. Chrome's stitched full-page capture made the reader header transparent; a viewport capture and the actual Edge view both rendered it normally. The reader baseline now captures its independently scrolling workbench at the intended viewport. Temporary compositor experiments were reverted rather than retained without evidence.

After the final copy and mobile refinements, all 17 UI checks passed again with retries disabled. Eight mobile route captures were reviewed; the translator state now remains readable, and the local-processing label no longer wraps. The final lint and production build passed. The homepage preview was refreshed from the current dashboard baseline (1440 × 900 WebP, 40,530 bytes).
