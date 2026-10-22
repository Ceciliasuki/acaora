# Course centre UI review · 2026-10-22

Scope: course selection, course overview, lesson reading and practice presentation. Local implementation; production publication requires its own release. The shared dashboard, PaperLab, DataLab, curriculum, grading, progress storage and sync endpoints are unchanged.

## Observed problem

The production catalogue hid all seven courses behind a 56px hover rail. The introductory area pushed the syllabus down, and single-lesson chapters repeated the same title as both a heading and an underlined link. The owner explicitly rejected the underlines. During rendered practice review, the shared form rule was also found to give radio inputs a 42px minimum height, moving the circle away from the option text.

Before image: local `outputs/course-ui-2026-10-22/before-catalog.jpg`.

## References actually visited

| Site | Verified recognition | Useful observation and adaptation |
| --- | --- | --- |
| [Rijksmuseum Collection](https://www.rijksmuseum.nl/en/collection) and its Artworks search | [2025 Webby Best User Interface: jury and People's Voice winners](https://winners.webbyawards.com/2025/websites-and-mobile-sites/features-design/best-user-interface/333807/rijksmuseum-collection-online) | Classification and browsing controls remain distinct from the collection itself. Adapt that separation to a visible course directory beside a stable reading/syllabus field. Preserve the academic light theme rather than importing the museum's image-led composition. |
| [Exat](https://exat.hottype.co/) | [CSS Design Awards WOTD, 25 March 2025, and March WOTM](https://www.cssdesignawards.com/sites/exat-typeface/47246/) | Strong separation between display title, navigation and smaller supporting information. Use a restrained 28–36px course title and quieter metadata; keep the project's existing typeface and blue. |
| [Developments](https://developments.media/) | [Minimal Gallery selection](https://minimal.gallery/developments/); gallery inclusion is not an award | Content title leads and surrounding controls remain secondary. Adapt spacing and typographic hierarchy. Its oversized cover typography and hidden INDEX are unsuitable for rapid course selection, so neither is reproduced. |

Native site screenshots, taken in this turn, are saved locally under `outputs/course-ui-2026-10-22/reference-*.jpg`. No external source code, font or artwork was imported. The unsuccessful INDEX click did not establish an expanded directory view; the saved Developments images show its cover.

## Implemented composition

- Owner correction after the first preview: the persistent directory occupied too much of the learning field. Restore the preceding 56px collapsible rail above 760px, including hover/focus reveal, click-to-pin, outside dismissal and Escape. The reading sheet regains the reserved space; all other visual refinements remain.
- At 760px and below: bounded disclosure with existing tap, outside-dismiss and Escape behavior. Hidden links remain inert. Remove the preview's desktop media-query subscription because the shared disclosure owns the open state again.
- Merge identical chapter/lesson titles. Keep grouped headings for multi-lesson chapters, actual level/read status, availability and original destinations.
- Replace link underlines with row hover tint, arrows, selected tint/weight and focus outlines. Inline reference links have a tint plus an external-link cue. Mathematical marks retain their rendering.
- Limit reading measure to 72ch, clarify heading scale, use neutral example insets and consistent practice regions. Keep radio inputs 16px and vertically aligned inside full-row targets of at least 44px.
- Focus mode hides both directories and centers the existing mounted reading/practice field; the exit control and Escape remain available. On desktop, the floating control moves to the lower right so it does not sit over the centre of the answer field.

## Contextual taste-skill review

Skill: `.agents/skills/design-taste-frontend/SKILL.md`. Design read: a light academic course catalogue and lesson reader for research students, preserving the current workspace brand. Dials: DESIGN_VARIANCE 6, MOTION_INTENSITY 2, VISUAL_DENSITY 5.

This is product reading/practice UI, so the skill's marketing hero, image, logo-wall, bento, theme-switching and cinematic-motion prescriptions do not apply. Its audit-first, hierarchy, rhythm, brand-preservation, keyboard/focus, contrast and responsive criteria were applied. Existing academic copy and notation take precedence over the skill's marketing copy restrictions. No external taste score or award is claimed.

Rendered review covered desktop catalogue/reader, 1024px catalogue, 375px catalogue/reader and the practice region. It prompted the radio-height correction above. The field remains intentionally text-led: no decorative artwork, invented learning metrics, cards for every lesson or added motion runtime. Actual course progress is a functional record. Full Core Web Vitals and real-account cross-device synchronization were not rerun for this presentation-only change.

## Verification

- Optimized Next build with TypeScript checking.
- ESLint on changed TypeScript/TSX files.
- Eleven targeted Playwright cases passed: course case destinations across seven courses, catalogue-to-lesson and grading flow, completed/resume behavior, optional exercise/review links, lesson accessibility and overflow at 1440/375px, course directory and shared rail keyboard behavior, 900px chapter navigation, touch dismissal/focus trap, persistent desktop and mobile directory, draft retention through focus mode, and selected navigation marker positioning.
- Axe found no serious or critical violations in the covered reader, open mobile directory and desktop studio states. This is bounded automated evidence, not a complete accessibility certification.
- After correcting radio alignment, the build and three affected studio/reader accessibility cases passed again. Native-browser inspection confirmed 16px radio inputs centered in 44px option targets. Retain the initial evidence for unchanged learning flows.
- After moving the desktop focus control, the final build and affected studio navigation/focus/draft case passed. Native-browser practice inspection confirmed the control sits outside the answer input field.

Local evidence directory: `outputs/course-ui-2026-10-22/` (ignored build/review artifacts). Catalogue and reader captures at 1440px and 375px, plus a 1024px catalogue and native-browser previews, are available there. Runtime build paths in `next-env.d.ts`/`tsconfig.json` are restored after local compilation rather than committed.

Owner-requested sidebar rollback: the final collapsible version passed the build, TypeScript, targeted ESLint and six directory-focused Playwright cases. These covered seven-course selection, hover and keyboard Escape, 900px chapter navigation, touch dismissal, focus/draft retention and selection-marker positioning. The native-browser collapsed view is `outputs/course-ui-2026-10-22/sidebar-collapsed-preview.jpg`. This correction is a local preview, not a production deployment.
