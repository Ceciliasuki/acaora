---
name: Acaora 学曦
description: The Study Workbench. Existing light workspace, blue product actions, task-specific white fields, and teal reserved for AI semantics.
colors:
  brand-blue: "#305fce"
  brand-blue-hover: "#244dae"
  brand-tint: "#edf2fc"
  brand-ink-on-tint: "#284fa4"
  brand-on-dark: "#93b1fb"
  ai-ink: "#0b6f66"
  ai-tint: "#e4f6f3"
  ai-teal: "#14b8a6"
  ai-on-dark: "#5fe3cd"
  ai-ink-on-teal: "#0c2f2b"
  app-background: "#ecf1f7"
  surface-white: "#ffffff"
  surface-subtle: "#f6f7f9"
  paper-surface: "#fff"
  deep-navy: "#121828"
  deep-navy-raised: "#1b2334"
  ink-primary: "#242832"
  ink-secondary: "#626975"
  ink-faint: "#69717d"
  workspace-muted: "#5e6877"
  ink-inverse: "#eef1f6"
  ink-inverse-secondary: "#96a0b3"
  line-soft: "#dce3ed"
  line-strong: "#d5d8e0"
  line-control: "#858d9a"
  line-inverse: "#2b3448"
  success: "#1a7a5a"
  success-tint: "#e6f5ef"
  warning: "#7a4e0f"
  warning-tint: "#fdf4e4"
  danger: "#b3352b"
  danger-tint: "#fdecea"
typography:
  action-label:
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1
  workspace-heading:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, Arial, sans-serif"
    fontSize: "clamp(32px, 3vw, 42px)"
    fontWeight: 600
    lineHeight: 1.22
    letterSpacing: "-0.035em"
  display:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.02em"
  headline:
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.015em"
  title:
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "26px"
  body:
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontSize: "12px"
    fontWeight: 700
    lineHeight: "16px"
    letterSpacing: "0.06em"
  academic-display:
    fontSize: "34px"
    fontWeight: 600
    lineHeight: "40px"
    letterSpacing: "-0.025em"
  research-record-title:
    fontSize: "17px"
    fontWeight: 500
    lineHeight: "26px"
  contents-title:
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
rounded:
  workspace-sheet: "12px"
  paper-layer: "3px"
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  full: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
  s8: "64px"
components:
  button-primary:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.surface-white}"
    typography: "{typography.action-label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-blue-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    height: "44px"
  button-ghost:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.ink-inverse}"
    rounded: "{rounded.md}"
    height: "44px"
  field-default:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    padding: "11px 13px"
    height: "48px"
  card:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
  badge-info:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-ink-on-tint}"
  badge-success:
    backgroundColor: "{colors.success-tint}"
    textColor: "{colors.success}"
  badge-warning:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.warning}"
  badge-danger:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger}"
  tab-active:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
  control-band:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
  segmented-filter-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-ink-on-tint}"
    rounded: "{rounded.xs}"
  register-cell:
    textColor: "{colors.ink-primary}"
  ruled-row:
    textColor: "{colors.ink-primary}"
  status-bezel:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-secondary}"
  state-note:
    textColor: "{colors.ink-secondary}"
  paper-field:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.sm}"
  paper-sheet:
    backgroundColor: "{colors.surface-white}"
    rounded: "3px"
  contents-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink-primary}"
    rounded: "0px"
  bibliographic-record:
    textColor: "{colors.ink-primary}"
    rounded: "0px"
---

# Design System: Acaora 学曦

## Overview

**Creative North Star: "The Study Workbench" (学习工作台)**

Approved as the internal design north star. It is taken from the product's own vocabulary (总览 / 论文工作台 / 数据工作台 / 项目工作台) rather than invented for this document. It exists to keep design decisions pointed at one idea, and it is not a marketing slogan, not user-facing copy, and not a line that appears in the interface.

**Current source authority, second owner preview 2026-10-12.** This is an extension of the incumbent world, not a new identity. `app/layout.tsx` imports `globals.css`, then the pre-existing `white-theme.css`, then scoped `workspace-refresh.css`. The later white-theme tokens are authoritative; the frontmatter records their effective values. A light curtain, bounded white navigation rail, blue actions and white task fields define the shipped world. The approved reconstruction covers app navigation, courses, papers, data, projects and settings. Original overview body, public landing and authentication remain outside this reconstruction; PRODUCT.md and product, data, accessibility and semantic contracts remain unchanged. See `docs/releases/2026-10-12-workspace-redesign.md` for scope and recoverable original code.

**Preserved design history.** The following earlier dark-rail, working-band and warm-paper descriptions explain past decisions. Their palette, required shell geometry and page composition are superseded where they conflict with the current source authority and the scoped rules below. They are not instructions to restore navy navigation, a warm paper token or forced numeric registers. Historical palette: brand `#2f5ad4`, hover `#2648ab`, wash `#eaefff`, wash ink `#1f3f9e`, app field `#f5f6f9`, paper `#faf9f6`, ink `#131a2b`, secondary `#626978`. Their accessibility and data-truthfulness rationale still applies; old measured contrast ratios do not certify the current palette.

Acaora is a workbench, not a stage. The surface is a cool, near-white working field with one saturated blue reserved for the actions a student actually takes, and a deep navy rail on the left that holds navigation and the paper library. Nothing on screen competes with the material being studied: the paper text, the table, the task list. The interface is designed to be looked at for two hours, not to be looked at once.

The page language is the **working band** (仪表). A surface opens on a rule-separated control band, states its real numbers in a register, arranges its content in ruled rows and columns rather than in cards, and closes on a bezel of the facts that hold everywhere. The two dense tools, PaperLab and DataLab, keep their own three-column workbenches inside that frame: the frame is what unifies the product, not a shared card.

The second, newer page language is the **Scholarly Luxe workspace**, approved after the working bands and implemented first on the dashboard. Where a working band is an instrument panel, a scholarly surface is an editorial page: a running head, a publication object set in paper, numbered sections, an index and a bibliographic record list, held together by typography and rules instead of containers. Its full definition is the **Scholarly Luxe Workspace** section below; the dashboard is its reference implementation. The working bands remain valid for the surfaces that still use them, and both languages share one token layer, one type scale and one focus contract.

The product carries two visual registers that must never blur. Ordinary product surfaces (courses, projects, data, settings, navigation, primary actions) speak in brand blue on cool neutrals. AI-semantic surfaces (the AI studio, AI-generated results, AI processing state) speak in teal on tinted or inverse grounds. Teal is not a second brand colour and must not be used to decorate ordinary business actions.

Density is deliberately uneven between surfaces. A reading tool and a statistics tool are allowed to be far denser than a settings page. What is unified is the design language: the same neutrals, the same type scale, the same radius and elevation logic, the same focus treatment. Page structure is not unified, and forcing it to be would damage the two tools that need density.

**Key Characteristics:**
- Light curtain and cool workspace; bounded white navigation rail and white task fields. Deep navy remains a token for genuinely inverse regions, not a navigation requirement.
- One accent (brand blue) for the whole product; one reserved semantic accent (AI teal).
- Paper now uses the incumbent white `--surface-paper`; the earlier warm-paper material description is retained as superseded history.
- System sans throughout; Georgia has been removed from page-level titles.
- Page structure carries no elevation at all: full-bleed rule-separated bands hold the chrome, and the capped measure sits inside them.
- A scholarly surface holds structure with rules, alignment and paper material instead: two clearly bounded premium surfaces is its guideline ceiling.
- Borders plus the lightest shadow carry structure for controls and genuinely raised content; a page is never a stack of floating cards.
- A numeric register reports the page's real state, and the dense tool surfaces are allowed to look like instruments rather than like marketing panels.
- A surface never prints a number it has not read: unknown is `—`, never `0`.
- Motion is visible at navigation, focus-layout and real result changes; reading remains stable and transitions are interruptible.
- Long-session legibility beats first-impression impact.

## Colors

A tight cool-neutral ramp with a single saturated blue and a single reserved teal; the palette is intentionally narrow so that the one accent that appears always means something.

### Primary
- **Acaora Blue** (`#305fce`, token `--brand`): the single product accent. Primary button fill, links, active and selected states, progress fill, current navigation marker, focus ring. Measures 5.75:1 on white. Scoped primary actions carry the white label from white-theme.css, also 5.75:1.
- **Acaora Blue Deep** (`#244dae`, `--brand-hover`): hover and pressed state for blue-filled controls only.
- **Acaora Blue Wash** (`#edf2fc`, `--brand-subtle`): the selected background and the soft focus halo behind a focused control.
- **Blue Ink on Wash** (`#284fa4`, `--brand-on-subtle`): text placed on the wash. 6.82:1.
- **Blue on Deep Navy** (`#93b1fb`, `--brand-on-dark`): the retained brand accent for an actual inverse region. Retained for actual inverse regions; it is not the active colour of the light navigation rail.

### Secondary
- **AI Ink** (`#0b6f66`, `--ai`): the AI-semantic ink colour for text and icons in AI regions on light grounds. 6.03:1 on white.
- **AI Wash** (`#e4f6f3`, `--ai-subtle`): the light ground behind AI entry points and AI result panels.
- **AI Teal** (`#14b8a6`, `--ai-vivid`): the solid fill for AI actions, such as the run button in the AI studio. Always paired with AI Ink on Teal as its label colour.
- **AI on Deep Navy** (`#5fe3cd`, `--ai-on-dark`): AI marks and labels inside the navy AI studio panel. 11.25:1 on deep navy.
- **AI Ink on Teal** (`#0c2f2b`, `--ai-ink-on-vivid`): the label colour on a solid teal fill. 5.79:1.

### Neutral
- **App Field** (`#ecf1f7`, `--bg-app`): the token behind the existing light curtain and workspace fields. White task surfaces sit within that light world; this reconstruction does not replace the curtain asset.
- **Surface White** (`#ffffff`, `--surface`): cards, panels, inputs, dialogs.
- **Surface Subtle** (`#f6f7f9`, `--surface-2`): inset areas, table headers, secondary panels, segmented control troughs.
- **Paper Surface** (`#fff`, `--surface-paper`): the current white-theme override for publication material and paper sheets. The warm-paper palette and its one-warm-neutral restriction below are superseded historical rationale, not a current requirement to reintroduce a warm colour.
- **Deep Navy** (`#121828`, `--surface-inverse`): retained inverse-region token. The current rail and paper library are light; no general navigation or library requirement follows from this token. One value, not several near-blacks.
- **Deep Navy Raised** (`#1b2334`, `--surface-inverse-2`): selected rows and secondary blocks inside an inverse surface.
- **Ink Primary** (`#242832`, `--text`): body and headings. 14.74:1 on white.
- **Ink Secondary** (`#626975`, `--text-2`): metadata, captions, secondary prose. 5.53:1 on white, 4.87:1 on the app field.
- **Ink Faint** (`#69717d`, `--text-3`): the current tertiary ink, 4.93:1 on white; hierarchy and contrast must still be checked on its actual ground.
- **Ink Inverse** (`#eef1f6`, `--text-inverse`) and **Ink Inverse Secondary** (`#96a0b3`, `--text-inverse-2`): text on deep navy, at 15.63:1 and 6.72:1.
- **Line Soft** (`#dce3ed`, `--border`) and **Line Strong** (`#d5d8e0`, `--border-strong`): decorative card and divider borders, and their hover/active step.
- **Line Control** (`#858d9a`, `--border-control`): the border of an actual control (input, select, textarea, secondary button). Deliberately darker than Line Soft because a control boundary is a non-text UI element and must reach 3:1: the current value measures 3.35:1 on white and 2.95:1 directly on the app field. The latter is pre-existing drift below the 3:1 control-boundary contract; it is not canonized as an acceptable pair and must not be inherited for a new control placed directly on that ground.
- **Line Inverse** (`#2b3448`, `--border-inverse`): structure inside a navy panel.
- **Success** (`#1a7a5a`), **Warning** (`#7a4e0f`), **Danger** (`#b3352b`) with washes (`#e6f5ef`, `#fdf4e4`, `#fdecea`): sync-complete, waiting/example-data, and delete/error states. There is deliberately no separate information colour; information reuses brand blue.

### Named Rules
**The One Accent Rule.** Brand blue is the only product accent. No second decorative accent may be introduced for cards, emphasis, or decoration, and a single-series chart is blue or neutral, never a rainbow. One explicit exception: a multi-series data visualisation may need several encoding colours to distinguish real data series. Such a palette is not a second brand colour, is not governed by this rule, and must be designed and approved separately during the DataLab phase. AI teal must never be borrowed as an ordinary chart's second series.

**The AI Teal Containment Rule.** Teal appears only where the surface is about AI: the AI studio, AI-generated results, AI processing state. It never fills a normal business action, a course card, a project control, or a chart series. A scholarly surface, its paper material and its research records are not AI-semantic regions either: none of them may borrow teal to look technical, scientific or modern.

**The Paper Containment Rule (historical warm-material rationale).** Paper Surface is a material, not a theme. It belongs to the publication object and the sheets inside it; it never becomes the page ground, never fills a generic card, never marks a warning, and never dresses an ordinary control. A surface that turns warm overall has misused the token, and any deeper paper tone is derived from it rather than added to the palette.

**The Two Blues on Navy Rule.** Against deep navy, use the light inverse accent for text; current main blue is 3.08:1 and does not meet the 4.5:1 body-text contract there. Use Blue on Deep Navy, or AI on Deep Navy inside AI regions.

**The Light-Only Rule.** The product is light-mode only; there is no dark theme and none is planned. `color-scheme: light` is declared so browser chrome, form controls, and scrollbars do not invert on their own.

## Typography

**Current workspace heading.** Approved reconstructed pages use a Chinese-compatible system sans heading at 600, clamp(32px, 3vw, 42px)/1.22, -0.035em, stepping to 32px at 760px and below. Supporting header copy is 14px/1.7. The source scale below remains available for other roles; it does not force the former 18px working-band title onto these pages.

**Display Font:** Segoe UI (with PingFang SC, Microsoft YaHei, Arial, sans-serif fallbacks)
**Body Font:** the same system sans stack
**Label/Mono Font:** ui-monospace, SFMono-Regular, Menlo, Consolas, monospace, reserved for identifiers, counts, and version strings

**Character:** One neutral, highly legible system sans carrying both Chinese and Latin text, so a Chinese heading and an English paper title sit in the same voice. No web font is loaded and no Latin-only serif is used for Chinese headings.

### Hierarchy
- **Display** (600, 30px/36px, -0.02em): the largest step in the UI scale. Reserve for a single moment per screen. It is not the largest step in the system: the academic roles below sit above it on scholarly surfaces.
- **Headline** (600, 24px/32px, -0.015em): the page title.
- **Title** (600, 18px/26px): panel and section titles.
- **Body** (400, 15px/24px): default text. Chinese body copy needs the generous 1.6 line ratio this encodes; long prose should be constrained to roughly 65 characters.
- **Label** (700, 12px/16px, +0.06em): the only role permitted to be uppercase, and the floor for interface text. It shares its size with the caption step and is separated from it by weight, tracking, and case rather than by size.

Supporting steps in the same scale: card title (600, 15px/22px), secondary (400, 13px/20px), caption (400, 12px/16px), metric (600, 28px/32px). Weights available are 400 / 500 / 600 / 700; the old regular-and-bold-only pairing is gone.

**The working-band title step.** A page's own title is set at the section step (600, 18px/26px) inside the control band, not at the page step: the band is chrome, and a 24px title turns it into a masthead. The page step and the display step are then reserved for content-level moments inside the page — an empty-state headline, the record the page is about.

**The academic roles.** Three roles belong to the Scholarly Luxe workspace and sit above the UI scale rather than replacing it. They are typography roles, not dashboard-specific numbers, and a surface uses them only where it actually has the object they name:
- **Academic Display** (600, 34px/40px, -0.025em) — the primary academic object the surface is about: the research subject, the study in hand.
- **Research Record Title** (500, 17px/26px) — the title of one bibliographic entry.
- **Contents Title** (500, 16px/24px) — one entry in a numbered workspace contents list.

On a scholarly surface, which has no control band, the greeting takes the 24px page step and the primary academic object takes the academic display step, so the page's own chrome never competes with the object it is presenting. A surface with no such object has no reason to use these roles.

**The Academic Display Restraint Rule.** The 34px step is not a page-title step, not a hero and not a marketing device. It appears at most once in a view, only on a genuine primary academic object, and it is never used to make an ordinary page feel important. Everything around it steps down: metadata at 12–13px, records at 17px, contents entries at 16px, so the object is the only thing at document scale.

### Named Rules
**The 12px Floor Rule.** No body or interface text is set below 12px. The 6px to 9px labels inherited from earlier layers are a defect to be removed as each page is redesigned, not a style.

**The Tabular Numbers Rule.** Any number that changes while the user watches (counts, percentages, progress, statistics, timers) uses tabular figures so the layout does not shift.

**The No Serif For Chinese Rule.** Georgia must not return as a product UI heading font. Latin-only serif faces fall back to an unpredictable Chinese serif and change weight and rhythm across platforms.

Known migration gaps, stated rather than hidden so this record does not read as if it already matched the code:

- Some legacy page selectors still set their own clamp-based title sizes (the public landing page and the authentication pages, between 32px and 58px). The token scale above is the target; each page adopts it during its own redesign phase.
- The label step now ships at 12px/16px, matching this record, so the 12px floor holds across the workspace pages that have been redesigned. The shell, the authentication pages and the public landing page still carry 7px to 11px values inherited from earlier layers; each is removed in its own phase, and until then the floor holds per surface rather than product-wide.

## Layout

Second-preview extension: chapter lists use two columns from 1280px; project tasks and notes sit side by side above 1200px and stack below. Settings retains all forms and native hash links; IntersectionObserver tracks the section being read. This responds to the user rejection of the first preview as too timid. Original production and the first preview remain independently retained; v2 aesthetics await owner review.

### Current workspace preview layout (2026-10-13, hover navigation)

The reconstructed workspaces use a shared PageHeader with title, supporting copy and real actions, followed by the topology each task needs. The shell is capped at 1640px with 24px outer margins and a 24px gap (18px at 1200px). Main content uses 16px horizontal padding. All application pages, including the overview, now reserve a stable 72px white icon rail above 760px; it reveals to 232px over the content on fine-pointer hover or keyboard focus. Leaving waits 180ms; Escape closes and returns focus to the toggle. Width motion is isolated to the absolutely positioned sidebar, so content does not reflow. At 760px and below the existing 264px off-canvas drawer, scroll lock and focus trap remain. Public/auth pages and overview body components are unchanged; the overview navigation geometry is explicitly changed by the owner's new global-navigation request.

- Courses (updated 2026-10-22 after owner review): restore the collapsible 56px course/chapter rail above 760px; the persistent 218px directory was rejected for occupying the reading field. Hover or keyboard focus reveals the bounded overlay; click pins it, a second click or outside click closes it, and Escape restores focus. At 760px and below, retain the 48px disclosure and bounded dropdown. Hidden links are inert; learning progress and answers remain mounted. Keep the new underline-free lesson rows, typography and practice alignment. Focus mode hides both navigation fields to center the reading sheet.

Course-only interaction refinement (2026-10-22): the owner rejected underlined links. Syllabus destinations are whole-row links with a pale-blue hover field, a directional arrow and a visible keyboard outline. Selected courses and current lessons use blue tint and font weight. Body references use a tinted inline link with an external-link cue. Do not remove mathematical underlines from KaTeX. A single-lesson chapter with an identical title shows that title once; multi-lesson chapters keep their group heading. Keep existing lesson URLs, anchors, progress, grading and account boundaries. Reader examples use a neutral inset field; practice options keep 44px click targets around 16px radio inputs, isolated from the shared form input minimum height. Reference observations and contextual taste review: `docs/reviews/2026-10-22-course-studio.md`.
- Papers: mode navigation over the original/notes workbench; desktop keeps optional library and note rails, bounded reader height and readable prose (16px/1.9, up to 86ch). Mobile switches panels and lets the reading region flow in the document instead of stacking three constrained desktop columns.
- Data: import and sample inspection precede one analysis field; wide tables retain horizontal scrolling. No conversion of data tables into decorative cards.
- Projects: a 224px project index and task/editor field, narrowing to 210px at 1200px; at mobile width the project list scrolls horizontally above the selected project's actual tasks and notes.
- Settings: a 156px section index beside separate white form sheets (132px at 1200px); mobile turns the index into horizontal links above the forms. No dashboard register is required here.

The shared 4/8/12/16/24/32/48/64 spacing scale remains available. Scoped 28px gaps, 20px mobile sheet padding and 12px sheet radii are repeated source-derived extensions rather than reasons to migrate the styling architecture. Task fields remain distinct; no dashboard layout is cloned across the five workspaces.

### Historical working-band layout (superseded on reconstructed pages)

The following shell widths, required band sequence and migration status are preserved as past design rationale. Current scoped layout above takes precedence; the old tool-width and full-bleed rules are not instructions to undo the approved reconstruction.

The shell is a two-column workspace: a fixed 248px navigation rail and a fluid working column. Below 1100px the rail collapses to an 88px icon rail, and below 760px it becomes an off-canvas drawer with a fixed trigger. The rail is the only persistent navigation; there is no top navigation bar in the workspace.

Content width is capped per surface rather than globally: 1240px for overview-style pages (dashboard, courses, projects, settings) and 1680px for the two tool surfaces, PaperLab and DataLab, which must be allowed to use the full width of a laptop screen. The cap applies to the measure inside the bands; the band chrome itself always spans the full content column. Reading columns inside PaperLab are capped near 72 characters per column so bilingual text does not stretch to unreadable line lengths.

Spacing is a single 8-step scale (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64). Control padding uses the first steps, panel padding uses 24px, section separation uses 32px, and page padding is smaller at the top than at the bottom so content does not appear to float.

A workspace page is assembled from working bands in this order: the control band (page title, the surface's one filter, its one primary action), the numeric register (four or five cells of real state), the content region (ruled rows, a ruled table, or the surface's own workbench), the four-area strip where the surface needs it, and the status bezel. Bands are full-bleed and the measure is capped inside them.

Density is deliberately per-surface, not global: Dashboard 5, Courses 5, Projects 5 to 6, PaperLab 6 to 7, DataLab 6 to 7, Settings 3 to 4, Auth 3.

Responsive behaviour: desktop is the primary environment and must not be compromised for mobile. On tablet the navigation rail may narrow to an icon rail and PaperLab drops from three columns to two. On mobile the three-column workbench must never simply be stacked vertically: PaperLab keeps its panel switcher, DataLab keeps appropriate horizontal scrolling for its tables rather than reflowing them into cards, navigation uses a drawer and progressive disclosure instead of a compressed toolbar, and each surface promotes one primary action rather than presenting its whole toolbar at once. Precise breakpoint values are deliberately not part of this record yet: consolidating them is deferred to the responsive phase, and no existing breakpoint is changed before then.

### Named Rules
**The Uneven Density Rule.** Unified language, not unified structure. Do not raise DataLab or PaperLab to a card-based layout in the name of consistency, and do not push Dashboard density up to tool level.

**The Two Tool Widths Rule.** Tool surfaces may use 1680px; overview surfaces stop at 1240px. A tool that has been narrowed to overview width has been damaged.

**The Full-Bleed Chrome Rule.** The control band and the status bezel span the whole content column and carry the capped measure inside them. A band that itself stops at the measure turns the page back into a floating panel.

**The Product Priority Rule.** On a single-column scholarly layout, the product's own entries may be printed before archive metadata: the dashboard numbers 02 INDEX before 03 WORKSPACES above 900px, and 02 WORKSPACES before 03 INDEX below it. The numbers always follow the visual order, so a reader never meets 03 above 02. This is product priority on a constrained viewport, not a per-page exception.

### Migration status

App navigation and the five workspaces now use the approved light task layout above. The original overview body, public landing and authentication are outside this reconstruction. Their older design history and pre-existing visual/typographic gaps remain; this documentation pass neither re-audits nor repairs those surfaces. Original code remains recoverable through the tag and external bundle/source ZIP described in the release note. No production merge or release is implied by this design record.

#### Earlier migration assessment (historical, not refreshed in this phase)

The token layer is product-wide. The page language is not yet unified: the dashboard is now built in the Scholarly Luxe workspace language and is that language's reference implementation, while the course centre, the project workspace, settings, DataLab and PaperLab still use the working bands described above. Both are approved, and both are recorded here so neither reads as a leftover. The shell, the authentication pages and the public landing page are on neither list and still read as an earlier era; the App Shell review is deferred deliberately (see Scholarly Luxe Workspace below). The landing page additionally ships three things this record's own Don'ts forbid — a mock product preview standing in for a screenshot, a decorative command-key control that performs nothing, and a fabricated progress figure with a sparkline — and its hero is to be replaced by a real product screenshot once the owner selects one. These gaps are recorded so they are not mistaken for decisions.

## Elevation & Depth

**Current scoped application.** Reconstructed task fields are white and flat: separation uses tone, spacing and rules, with no floating-card shadow on the main course sheet, paper workbench, analysis field or project workbench. The second preview bounds the white navigation rail with 12px corners and existing shadow-1, without an additional border. Dialogs retain real overlay elevation. The original border-led rationale and publication-object rules below remain historical guidance where the object exists; they do not require adding shadows to the reconstructed fields.

The system is hybrid but border-led: structure comes from a 1px border, and shadow is a supporting cue rather than the primary signal. Surfaces are not floating cards. Panels sit flat at rest with a border and the lightest shadow; shadow increases only with real elevation, so the appearance of depth always corresponds to something actually being above the page. All three shadow values are tinted cool (towards the navy ink) rather than neutral black. The violet-tinted shadow family inherited from an earlier layer is retired and must not return.

### Shadow Vocabulary
- **Resting structure** (`--shadow-1`, `0 1px 2px rgba(19, 26, 43, .05)`): controls, cards, and panels at rest, always alongside a border.
- **Raised** (`--shadow-2`, `0 2px 6px rgb(24 32 48 / 3%), 0 16px 50px rgb(24 32 48 / 5%)`): genuinely floating elements such as menus, popovers, and a selected card.
- **Overlay** (`--shadow-3`, `0 24px 70px rgba(10, 16, 32, .18)`): dialogs, drawers, and toasts only.

### Named Rules
**The Border First Rule.** A surface earns separation from a border and spacing before it earns a shadow. If removing a shadow would make the element unreadable, the border is wrong.

**The Inverse Border Rule.** Inside deep navy, depth is carried by a low-opacity light border, not by a shadow. Shadows on inverse surfaces are not used.

**The Structural Elevation Rule.** Page structure carries no elevation. Bands, registers, ruled rows, strips and the bezel are separated by a 1px border and by spacing alone; a shadow is reserved for a control at rest, a genuinely floating element, and an overlay. A page whose every section sits on a raised card has mixed the two vocabularies and lost the distinction the shadow was there to make.

**The Two Shadow Surfaces Rule.** A scholarly surface may raise at most two things, and they are always parts of one publication object: the paper field and the top sheet, both at the resting `--shadow-1`. Everything else on the surface is separated by tone, rules and spacing. This is a budget, not a licence: a third shadowed surface on a scholarly page is a defect, and glow or glass is never a substitute for depth.

## Shapes

**Current scoped sheets.** Main white task fields use 12px corners; PaperLab becomes 10px on mobile. The white rail uses 12px corners; structural regions stay unbounded; local reader controls use 6–8px corners. The earlier generic 14/18px container defaults and Scholarly Radius Rule below do not override these approved task-specific sheets.

Form language is soft-rectangular and consistent. Controls use the tighter radii and containers the softer ones: 6px for small marks, 8px for inputs and list rows, 10px for standard buttons and segmented controls, 14px for cards and panels, 18px for large workbench containers and dialogs. The rail and the workbench are the only large-radius containers; nested elements inside a panel step down rather than repeating the container radius.

The full radius (999px) is restricted to avatars, status dots, progress tracks, and status pills. It is not used for primary buttons: pill-shaped actions read as consumer marketing and conflict with the restrained interaction language.

Borders are 1px and single-sided where possible. Table rows use a bottom border only; a table with rules above and below every row is not part of this system.

### Named Rules
**The Nested Radius Rule.** An inner element's radius is smaller than its container's. Repeating the outer radius on a nested element is a defect.

**The No Pill Buttons Rule.** Full rounding is reserved for avatars, dots, progress, and status pills. Primary and secondary buttons use the 10px control radius.

**The Rule-Only Surface Rule.** A surface may be built from rules alone, with no corner radius and no container: a ruled table, a ruled row list, a register cell and a full-width band are each a complete surface. Radius belongs to controls and to genuinely raised panels, not to page structure.

**The Scholarly Radius Rule.** On a Scholarly Luxe surface the radius budget is tighter than the UI default: the publication object takes 6–8px, paper layers take 2–4px, that surface's own controls take 6–8px, and structural regions — rules, registers, contents rows, record rows — take 0px. Nothing on such a surface exceeds 10px, and a large soft radius is never the default language of a page. The shared control radius above stays 10px for the product's ordinary surfaces; a scholarly surface that narrows it does so deliberately and page-locally, and that narrowing is recorded rather than assumed.

## Components

### Buttons

Scoped workspace primary actions use the solid current brand token and white text, without the pre-existing button shimmer, hover lift or added hover shadow. Press is a short `scale(.985)` feedback only; reduced-motion mode removes it.
- **Shape:** 10px radius (`--r-md`), 44px minimum height, 16px horizontal padding.
- **Primary:** Acaora Blue fill with white label on reconstructed primary actions (measured 5.75:1). Avoid placing two competing primary actions in the same action group or local context. A larger workspace may legitimately carry different primary actions in separate functional regions, and that is not a violation.
- **Secondary:** Surface White fill, Line Control border, Ink Primary label. The standard button in a workspace toolbar.
- **Ghost:** no fill, Ink Secondary label, used for low-emphasis and icon-only actions.
- **Danger:** Danger red fill, reserved for destructive confirmation.
- **Hover / Focus:** background, border, and colour transitions at 160ms with an ease-out curve. Pressed state compresses to `scale(.985)`, a deliberately restrained value chosen for a desktop productivity tool rather than the stronger compression used in consumer UI. Keyboard focus always shows a visible ring in brand blue.
- **Disabled:** reduced opacity with the native disabled attribute, never a look-alike button that still responds.

### Chips
- **Style:** used for section navigation, filters, knowledge tags, and interest tags. Line Soft border on transparent for navigation chips; brand wash with Blue Ink on Wash for a selected filter; small dark tokens for term tags.
- **State:** selected state is always a fill change plus a text/weight change, never colour alone.

### Cards / Containers

**Scope note:** reconstructed task fields use the flat 12px white sheet described in Shapes; the retained generic container defaults below are not their layout prescription. Deep Navy is no longer a rail or paper-library ground.
- **Corner Style:** 14px (`--r-lg`) for cards and panels, 18px (`--r-xl`) for workbench containers and dialogs.
- **Background:** Surface White on the app field; Surface Subtle for inset rows and table headers. The former Deep Navy rail/library prescription is superseded; retained inverse tokens apply only where an actual inverse region exists.
- **Shadow Strategy:** resting structure plus border (see Elevation).
- **Border:** Line Soft, tested against a cool background. Border colour is always cool-tinted; a warm or pure-black border is not part of this system.
- **Internal Padding:** 24px as the default panel padding, 16px for dense data panels. (The card primitive currently ships 22px; that value is neither on the spacing scale nor part of this record, and must be aligned to 24px during the phase that next touches it.)

### Working bands (historical, superseded on reconstructed pages)
- **Control band:** Surface White ground closed by a 1px Line Soft border, 56px minimum height, its contents capped to the surface's measure. The page title, the surface's single filter and its single primary action live here. Nothing sits above it.
- **Segmented filter:** a Surface Subtle trough at the 6px radius; the pressed segment is Brand Wash with Blue Ink on Wash and a semibold label. A filter that narrows a list is a labelled group of `aria-pressed` buttons, not a tablist — it switches no panel, and calling it one misleads assistive technology.
- **Numeric register:** four or five equal cells divided by 1px vertical rules, each a 12px Line Soft label, a 28px tabular value and a one-line caption. A cell that reports a fact rather than a number drops to the card step (15px), so a phrase never has to pretend to be a metric. Every value is a real array length, a real stored status, or an honest absence.
- **Ruled table and ruled row list:** a Surface Subtle header row over 1px Line Soft row rules, with tabular figures in the numeric columns. Where the rows are actions they stay real buttons carrying their own hover, focus and current state.
- **Four-area strip:** the product's four areas as one full-width four-cell ruled band, each cell carrying the same mark the rail uses for that destination. A cell reports a count only where a count exists. On a scholarly surface this strip is replaced by the workspace contents pattern (see Scholarly Luxe Workspace), which carries the same information as a numbered list rather than as a band.
- **Status bezel:** a 34px band that closes the page with the facts that hold everywhere — local-first, what is not uploaded, the account or surface state. It holds the bottom of a short page, which is what a dense surface uses where an airy one would leave the space empty.
- **State note:** the empty and guest message lives in the content region as a heading, one paragraph, and buttons where the surface has real actions. It is never a dashed dropzone, and it never states a fact that a failed request did not establish — an unread list is unknown, not zero.

### Inputs / Fields
- **Style:** Surface White fill, Line Control border at 3.35:1 against white, 8px radius, 48px minimum height, 15px label-sized text inside.
- **Focus:** border turns brand blue, a soft brand wash halo appears, and a 2px brand ring is drawn just outside the control. Because a shared control's own focus treatment must survive page-scoped styling, the primitive declares this ring itself rather than relying on a global outline rule.
- **Error / Disabled:** invalid fields keep the Danger border and pair it with inline error text below the field; the error state is never signalled by colour alone. Disabled fields use a muted surface and reduced text emphasis. Labels sit above the field, and helper or error text sits below it; a placeholder is never used as the label.

### Navigation
- **Style:** bounded white rail beside the task field; six existing destinations and the account block retain their real routes and semantics. Scoped items are at least 48px high, 14px labels and 18px Lucide icons. Rail widths and drawer behaviour are in Layout.
- **States:** muted inactive labels; selected items use a solid brand-blue plate with white labels and icons. Hover uses the white surface. The current route retains `aria-current="page"`; state is not colour-only.
- **Mobile treatment:** off-canvas light drawer with fixed trigger, backdrop, focus management and released body scroll lock on close.
- **Mode selection:** MotionNavigation is a purely visual, two-dimensional sliding plate behind the original controls. Buttons own labels, state and focus; the marker is `aria-hidden`, never a second interactive control. Without the script the selected control keeps its static blue fill.

#### Historical navigation specification (superseded)

The original rail specification is retained below for traceability; current Navigation and Layout above take precedence.

- **Style:** the left rail is a single 248px deep-navy column with a 44px brand mark, six destinations (总览, 课程中心, 论文研究, 数据分析, 项目空间, 设置与隐私), and an account block pinned to the bottom. Items are 48px tall with a 20px icon and a 14px label.
- **States:** inactive text is Ink Inverse Secondary; hover and current use the raised navy with Ink Inverse text; the current item is additionally marked by a brand-on-navy icon. The current item is exposed through `aria-current="page"`, so the state is not colour-only.
- **Mobile treatment:** off-canvas drawer with a fixed trigger, a backdrop, and a body scroll lock that is released on close.

### Purposeful workspace motion

Paper reader refinement (2026-10-13): compact running header and one combined mode/tool row, with secondary library and notes panels remaining closed by default. The reading surface carries a single desktop title/tool line, quiet chapter navigation, a centered prose measure and no full-paragraph active stripe. Selection exposes a 160ms floating highlighter/comment toolbar; a 200ms editor reveals in the notes pane, without moving original text. Yellow `#f7e9b8`, blue `#dce8fa` and green `#deeddf` are semantic annotation washes only, with the normal text foreground; they do not extend the product accent palette. Color is named and selectable with native radio controls. Comments retain exact paragraph IDs, original-text offsets and quotes; old notes and reading records stay compatible. Native reduced-motion preferences suppress these two entrances.

Literature search is a separate mode: query field, publication filters, bibliography rows with source links, and RIS export. Crossref bibliographic matching, author and journal queries, publication date/type filters, provider sorting and bounded pagination are used. A fallback cannot silently discard advanced filters. Unavailable metadata remains unknown, and published-record counts do not mean full-text availability or research quality. Imported text and annotations are not automatically transmitted as search queries.

Selection plates use cancellable 280ms cubic-bezier(.16,1,.3,1), with ResizeObserver tracking root and controls. The authored course-sheet opening is a 360ms bounded clip reveal from its index. Projects use 220ms continuity; analysis and paper tools use 240ms; paper side panels and dialogs use 200ms. During travel, brand tint and brand ink keep labels readable. Sidebar continuity remembers geometry only in module memory. Reduced motion cancels live animation and removes spatial transitions and smooth scrolling. No route delays, recurring loops, paragraph entrances, new curtain animation or account-storage changes.

The advanced interaction extension adds a separate 200ms pointer-follow plate without changing selection. Native quick navigation opens in 280ms and searches only the six real workspace destinations; Ctrl/Meta+K, arrows, Enter, Escape and focus return work, and an existing modal prevents nesting. Course focus mode keeps lessons and answers mounted, hides chrome, and explains the layout switch with a 380ms position transition without scaling text. Histogram bars and scatter points interpolate real geometry in 420ms; labels and statistics show their current values immediately. Task-count feedback lasts 600ms. Reduced motion keeps all final states and removes these transitions; idle surfaces do not loop.

### Icons
- **Library:** Lucide, one family across the whole product. Do not migrate to another icon library, and do not mix families on one surface.
- **Stroke:** approximately 1.75 to 2, chosen per icon from its rendered size, the optical weight of the text beside it, and balance, rather than one global number applied everywhere.
- **States:** one icon recoloured per state through `currentColor`; outline is the default and fill marks an active state. Decorative icons beside visible text are hidden from assistive technology, and a meaningful standalone icon carries a text alternative.
- **Legacy glyphs:** text characters used as icons in the older layers are a defect. They are replaced with the icon family as each page is redesigned, not left in place for consistency.

### Feedback and Dialogs
- **Shape:** status messages are 10px-radius tinted bands; modals are 18px radius with the overlay shadow and a dimmed backdrop.
- **Colour:** the four tones map to success, warning, danger, and information (which reuses brand blue). Each carries an icon in addition to its tint.
- **Behaviour contract:** any modal must contain focus while it is open, place initial focus somewhere sensible, close on Escape where that is appropriate to the context, restore focus to the control that opened it on close, and expose a correct accessible name and description. Opening or closing must never silently change important state. Status and error regions announce themselves to assistive technology rather than repainting silently. What is fixed here is the contract, not a particular element or API: a native modal dialog satisfies it today, but this document does not lock the implementation.

## Scholarly Luxe Workspace

**History status:** the language and data-truthfulness principles remain available; the warm-paper palette and dashboard-specific measured geometry in this preserved section describe its earlier reference implementation. They do not override the current white-theme tokens or prescribe reconstructed task layouts. The original overview body is excluded from this phase.

Approved as the workspace language for the product's research surfaces, and implemented first on the dashboard. What carries across surfaces is the language, not the dashboard's layout.

### Principles
A scholarly surface prefers publication hierarchy, editorial rhythm, research metadata, rules, paper material, typography and intentional whitespace. It does not reach for generic cards, KPI panels, a SaaS hero or rounded containers everywhere; structure is carried by type, alignment, rules, spacing and material before any container is drawn. Whitespace on such a surface is either deliberate breathing room or a mistake — never a gap waiting for a panel.

### Paper material
- **Paper Surface** (`--surface-paper`) is the publication object's material: paper sheets, document edges, academic archival surfaces. Its containment rule is stated in Colors above.
- Three material steps are enough to read as paper, and the dashboard measures them as `#f5f6f9` (cool app field) → `#faf9f6` (paper field) → `#ffffff` (top sheet). Deeper steps inside the object are mixed from the paper token with the ink ramp, and the visible block edge of a stack is one of those steps rather than a border colour of its own.
- The object is built from geometry that carries no invented content: page edges, a binding margin, a ruled measure, a figure block, a page marker and crop marks. It never contains a fabricated author, journal, abstract, DOI, citation or chart.

### Publication rule system
- **1px** carries ordinary structure: the rule that closes the running head, a section head rule, group hairlines, and the column rule between two registers.
- **2px cobalt** is the rare editorial or active marker: the folio mark under the running head (64×2), the marker that opens the record list (48×2), and the marker that marks the current row on hover or focus. Nothing else on the surface is 2px.
- A **short rule** (96×1) may close a label where a full-width rule would only repeat the one above it.
- Rhythm is the point. A page mixes full-width rules, short rules, vertical rules, group hairlines and whitespace breaks. **Every section opening with a heading plus a full-width rule is a defect**, not a style, and a page whose rules all match has not been composed yet.

### Bounded surface policy
A scholarly surface reduces bounded containers and lets typography, alignment, rules, spacing and material do the work. **Two clearly bounded premium surfaces is the guideline ceiling** for such a page — on the dashboard they are the publication field and the top sheet. This is a design guideline, not a lint rule, and it is never a reason to remove a boundary the data needs.

Dense tool surfaces (PaperLab, DataLab) may carry more structural boundaries because their workflows require them. They may not fall back to a generic card grid to get there.

### Workspace contents pattern
Workspace navigation on a scholarly surface may be a numbered contents list:
- 01 / 02 / 03 numbering; the whole row is clickable and carries a visible focus ring;
- a paper-light hover tint plus a 2px cobalt active marker on hover and focus;
- the area's own metadata, typography-led, with no icon requirement;
- no feature cards, no icon tiles, no floating panels, no giant chevrons.

It replaces the four-area strip and the feature-card row on scholarly surfaces. It is a pattern, not a requirement that every surface carry four entries.

### Bibliographic record pattern
A research record or activity list may be set as a bibliographic log: number, date, type, title and metadata, separated by hairlines rather than contained in rows. The title is the visual focal point, metadata is secondary, the whole entry may be the target, and a status pill is not required — a plain label carries the state. Activity-feed styling is not the default.

### Depth and radius on a scholarly surface
Depth comes from tone, paper layering, rules and spacing; shadow is rare and its budget is the two surfaces named above. Radius follows the Scholarly Radius Rule in Shapes: publication object 6–8px, paper layers 2–4px, that surface's controls 6–8px, structural regions 0px.

### Data truthfulness
**The Unknown Is Not Zero Rule.** A value the surface has not read is unknown, never zero. Unknown values print `—`, or an explicit unavailable or error state; `0` is reserved for a count confirmed to be zero. The rule covers counts, statistics, workspace summaries and research metadata, and it is why a failed read never renders as an empty account and why an error state is never dressed as an empty state.

### Scope: a language, not a template
The dashboard is the reference implementation of this language; it is not the layout other workspaces must copy.
- **PaperLab** translates it into reader / annotation / research-console language rather than into a page of numbered sections.
- **DataLab** keeps its technical density and may stay instrument-like.
- **Courses** and **Projects** choose whichever scholarly pattern fits their work.

What unifies the product is the language — typography roles, rules, paper material, metadata discipline and truthfulness — not a cloned layout.

### Historical deferral: App Shell and Sidebar

**SUPERSEDED 2026-10-12:** the reconstructed shell now uses the light rail described in Layout and Navigation. The following original deferral is retained solely as past design rationale.

The navigation rail and app shell still speak the earlier dark-navigation language, and the gap between that language and a Scholarly Luxe body is visible on the same screen. Status: **DEFERRED DESIGN REVIEW**. Once the core workspaces have adopted this language, the shell is reviewed on its own for rail proportion, typography, active state, material, and desktop/mobile navigation. No future shell styling is defined here, and the shell is not to be restyled as a side effect of a page phase.

## Do's and Don'ts

### Do:
- **Do** apply the incumbent light system and its approved workspace extension: current blue `#305fce`, light rail, white task fields, system sans and shared focus contract. Retained AI semantic and data constraints still apply; historical dark-rail values do not override the source authority.
- **Do** keep one accent. If a surface seems to need a second colour for emphasis, the hierarchy is wrong, not the palette.
- **Do** gate every control boundary at 3:1 and every body text pair at 4.5:1, and record the measured ratio when adding a pair.
- **Do** keep keyboard focus visible on every interactive element, and keep the shared primitive focus treatment working even where page-scoped styles are more specific.
- **Do** keep `aria-current`, `aria-expanded`, `aria-invalid`, `aria-describedby`, and `aria-live` intact through any visual change, and keep the modal accessibility behaviour intact: focus containment while open, a sensible initial focus, Escape to close where appropriate, focus restoration on close, and a correct accessible name and description.
- **Do** let PaperLab stay a dense three-column research workspace and DataLab stay a dense analytical one. Preserve their structure; the visual language is what unifies them.
- **Do** build a reconstructed workspace from PageHeader and its actual task layout. Working bands remain historical patterns; do not force their numeric register or status bezel onto settings or another task with no such content.
- **Do** build a research surface in the Scholarly Luxe language instead where the content is a study rather than a console: the publication hierarchy, rules, paper material and metadata its content actually calls for, held by rules and typography rather than by containers. The two page languages are both approved; pick the one the surface's work calls for, and do not blend them into a third.
- **Do** keep the contents numbering and the visual order in step, including when a narrow layout promotes the product's own entries above archive metadata.
- **Do** keep every register cell, strip cell and count to something the product actually stores, and let a cell report a fact where no number exists.
- **Do** print `—` for a value the surface has not read, and reserve `0` for a count confirmed to be zero; an unread list, a failed request and an empty account are three different states and must not render as one.
- **Do** use borders and the single lightest shadow for structure, and step shadow up only for real elevation.
- **Do** treat desktop as the primary environment and keep tools at their full width on it.
- **Do** use tabular figures for changing numbers, and keep every value on the type scale with a 12px floor.
- **Do** resolve skill or tooling conflicts in this order: product correctness, data safety, sync and auth correctness, passing tests and accessibility contracts, this design system, the current phase scope, then any skill's advice. When a skill conflicts with a settled decision, the settled decision wins.
- **Do** follow the phase workflow: audit, proposal, approval, implementation, functional tests, visual review, accessibility review, commit. One phase at a time.

### Don't:
- **Don't** introduce purple or violet, or any AI-purple gradient, anywhere. It is the most recognisable AI-slop signature and it was explicitly removed.
- **Don't** use AI teal as a general second accent, and don't colour ordinary business actions with it.
- **Don't** use full-screen glow, blurred background blobs, or heavy glassmorphism.
- **Don't** put every section in a card, nest a card inside a card, or turn a data table into a stack of cards.
- **Don't** make every control pill-shaped, or use a giant marketing hero inside the workspace.
- **Don't** build decorative dots, ambient gradients, or shadows that carry no meaning. A single-colour `background-image` used to draw a partial-width rule (a short rule or a 2px editorial marker) is a rule, not a gradient, and is not covered by this ban; a colour ramp across a surface is. A shadow that marks a real object — the paper field and its top sheet — carries meaning and is inside the two-surface budget.
- **Don't** put a kicker or an eyebrow above a heading. The heading carries its own weight: delete the label and let the heading speak. If a region needs a name, give the region a heading.
- **Don't** number sections (01 / 02 / 03) as decoration. Numbering is legitimate where it names a real structural order the reader needs — the numbered sections of a scholarly surface, or a numbered contents list — and illegitimate where it labels tiles, images or cards the reader can simply count. Publication numbering is structure, not a metric, and the number must match the order the content is actually read in.
- **Don't** use a card container for page structure. Cards are for genuinely raised content; page structure is bands, rules and spacing.
- **Don't** turn a Scholarly Luxe page into the template for every other workspace: copy the language, never the layout. A dashboard cloned onto PaperLab or DataLab would break the two tools whose density the product depends on.
- **Don't** use a Unicode glyph or an emoji as an icon, and don't let one into an accessible name. Icons come from Lucide in one stroke family. One narrow exception: a typographic arrow (`→`) may close a text action that already names its destination, provided it is `aria-hidden` and the action reads correctly without it. It is a typographic mark, not an icon system.
- **Don't** report a count for an area that has none, or present a built-in default as a confirmed value.
- **Don't** move elements on hover. Hover changes colour, border, rule and background; floating and `translateY` lifts are not part of this system, and a card never rises. The one permitted movement is the small marker inside an action or a row — the arrow that names the destination, or the 2px active rule — which may shift a few pixels or fade in at 160ms to confirm the pointer. Nothing gains scale on hover.
- **Don't** add animation that does not explain a state change, and never remove the reduced-motion handling.
- **Don't** fake capability in the interface. No placeholder search box, no decorative command palette, no `⌘K` affordance, no AI input that does not work.
- **Don't** fabricate metrics, testimonials, customer logos, benchmarks, or product screenshots. The repository has no such evidence; see PRODUCT.md.
- **Don't** make any AI surface dominate the ordinary study workflow, and don't let AI output look like original paper text or like the student's own notes.
- **Don't** migrate to Tailwind utilities or introduce a component library during this redesign. The project uses handwritten CSS with semantic tokens, and a styling-architecture migration is a separate engineering task.
- **Don't** introduce a new palette decision without approval. Source-derived current tokens are normative; the historical values and known out-of-scope CSS one-offs retained here are not a licence to reuse them.
- **Don't** create a primitive for a single use. Shared primitives are for genuinely cross-surface patterns only.
- **Don't** update visual baselines to make a test pass. Baselines change only after a human has reviewed the diff and approved the new design.
- **Don't** allow the Impeccable launcher or its hook to execute a downloaded binary in this project, and don't commit platform executables.

## PaperLab paper selection · 2026-10-22

The owner explicitly requested a selection screen before entering the research workspace. `/papers` now opens a full-width paper list, rather than automatically presenting the latest paper. Selecting a title enters the existing reading room; a return action preserves the current paragraph and notes. Direct paper/paragraph source links and explicit reader URLs remain supported. Browser history follows the two views. This supersedes only the previous immediate-reader entry, not the reading-room design below or other workspaces.

The library is an Operate surface in the existing flat, light PaperLab world: one ordered list, system sans, real title/source/progress metadata, ordinary blue actions. Search, all/favorites scope and actual timestamp/title sorting sit above the list. Each row has a star and native top-layer ellipsis menu containing bibliography and deletion actions. Menus support arrow keys, Escape and focus return; deletion retains the existing confirmation. Empty libraries show zero real papers and a separately labelled demo action. Loading/error states never pretend the library is empty. Large desktop libraries scroll within their field; mobile uses the document flow. Mobile reading has a return-to-list action in the sticky reading toolbar.

Paper-level favorites are an optional boolean on the existing research record, separate from paragraph bookmarks. The existing JSON payload, account-scoped queue and backup whitelist preserve it; legacy records remain valid. No new table, permission, provider or PDF upload path is introduced. Atomic library patches read the latest record and refuse deleted records so a stale list row cannot replace notes or recreate a deletion. Reference and verification scope: `docs/reviews/2026-10-22-paper-library.md`.

Owner refinement: omit the selection-page subtitle and the footer's general PDF/sync explanation. Keep list typography consistent across desktop and mobile: 20px section heading, 16px paper/empty-state titles, and 14px metadata, status, labels and controls. Preserve the existing reading workspace typography.

The list search uses a compact 44px pale field with an 18px non-shrinking search icon, a short placeholder and a conditional clear action that returns focus to the input. Keep a single visible keyboard focus outline fully inset by 2px so the list's scroll container cannot clip its left edge. On mobile the search spans the toolbar and filters/sort share the next row.

## Course selection before learning · 2026-10-22

The owner requested the same list-first entry for courses. `/courses` presents all curated courses as flat rows, with search and track filters above the list. It does not automatically select a course or mount a syllabus. Each row links to the existing `/courses/[courseId]` syllabus, where the existing start/resume action opens a lesson. Headers on course-specific pages provide an explicit return-to-list link. Existing lesson URLs, progress/answer storage and the collapsible chapter rail remain authoritative; the course chooser is no longer a rail inside another course's syllabus.

Use the paper-selection family's 20px section heading, 16px row title and 14px metadata/controls, pale 44px search field and inset focus indicator. Show actual curriculum chapters/core-lesson counts, not invented progress. The catalog uses a white field and the existing course track selection marker with brand-blue/white settled colors; moving-state colors follow the shared motion contract. Preserve the learning surface's typography and compact chapter rail. Catalog scope and evidence: `docs/reviews/2026-10-22-course-selection.md`.

Owner refinement: hide internal course codes from list copy, retaining the identifiers in routing/storage and search matching. Align the catalog and running head to a 1100px measure. Put search beside the section heading on desktop and below it on mobile. Flat rows group the course title, track and actual prerequisites; curriculum counts align in a separate desktop column and sit below the title on mobile. A pale book icon and explicit “查看课程” affordance clarify the destination. Hover tint and a small arrow movement support the whole-row link; reduced motion disables the movement. No extra overview panels or promotional copy.

## PaperLab Reading Room — 2026-10-14 replacement

The owner explicitly authorized replacing the interface and broad refactoring. This section supersedes earlier three-column composition prescriptions for `/papers` only. Other routes, the shared navigation, light-only commitment, tokens, AI-only teal semantics, content truth and data contracts keep their existing authority.

PaperLab now uses a reading-room composition: a quiet running head and single mode band, a large Source Serif paper title, a single continuous paper scroll, a temporary source-library drawer, and a paragraph-note margin. The publication itself supplies the focal moment. The title and source record scroll with the text; chapters, translation and original-PDF access share one sticky utility band. Opening the library must not shrink the text measure. Choosing a source closes the drawer. The library starts closed even if an older layout preference requested a persistent column. The note margin docks alongside the text and uses a more compact two-row utility band on narrow desktop screens; mobile presents each working surface through its existing accessible tabs.

The route is a flat white field with typography and hairline divisions. Background animation and its control are absent on this reading surface. There is no decorative hero, invented author information, marketing statistic, card grid, or numbered ornament. Actual filename, paragraph count and chapter count form the source record. Long titles remain fully editable. Shared product cobalt marks ordinary selections; AI results retain their provenance and teal containment.

The route composition is owned by `app/papers/reading-craft.module.css`, independent of `focused-workspaces.module.css`. Keep one motion owner per surface, visible defaults, interruptible 220–280ms transitions, and reduced-motion cancellation. Do not vertically animate or scale the measured paragraph surface. Preserve account boundaries, PDF bytes, paragraph identities, annotations and asynchronous source ownership.

### Desktop interaction extension — 2026-10-14

The owner approved the first interaction stage (source peeks and reading trails) together with the industry-audit refinements. Desktop remains the implementation target; mobile alignment is a release check. A source peek shows actual paragraph text without moving the reading cursor. Explicit chapter/citation/note navigation records a source-scoped, session-only reading anchor; returning restores the paragraph-relative offset and working mode. The peek is a nonmodal native popover with keyboard entry, Escape return, outside dismissal and reduced-motion support. It shares the existing paper surface and tokens.

Desktop titles require explicit editing and confirmation/cancellation. Notes display their source excerpt, retain the editing target while focused, and can be pinned independently of the reading cursor. Device save feedback must reflect the actual write; demo notes explicitly describe their session lifetime. The desktop work area fits the viewport, AI/search inherit the reader's flat visual language, and only the active AI tab enters the tab order. Reader type can be adjusted to 18/20/22px as a local view preference. Advanced translation stays under “更多工具” on desktop. Source identity and paragraph anchors continue to govern all operations; view preferences and navigation trails never enter the cloud data model.


## Desktop operational refinement · 2026-10-14

Extend the existing light Study Workbench on courses, data, projects, settings and account entry. Preserve the approved Dashboard composition and PaperLab reader. Desktop layout is primary; formal mobile alignment remains a pre-deployment gate.

- Reduce operational header height and top spacing without introducing a new visual identity.
- DataLab has a sticky section directory for import, variable checks, analysis and source preview; the selected method and variables survive section navigation. Imported analysis is explicitly session-local. More than eight variables have a real expand/collapse action.
- Disclosure rails distinguish hover-open from click-pinned state. A click after hover keeps the directory available; a second click, outside click or Escape closes it. Hover never shifts the task surface.
- Short horizontal tab lists use roving tabIndex, arrow/Home/End activation and labelled panels. No new motion runtime is needed.
- Project task drafts are keyed to their project; clear an input only after a successful write and only when it still contains the submitted text. Pending operations disable competing writes; modal errors remain inside their dialog. Notes have an explicit unsaved state.
- Settings distinguish edited profile fields from their last acknowledged save; operation feedback remains visible in the desktop viewport. Failed metadata or blocked session storage must not imply a confirmed model, version or successful Key save.
- Scope visual refinements through operational-craft.module.css; new palette, public marketing reconstruction and Dashboard body changes are outside this refinement. Correct the public register entry and outdated course capability copy using actual product behavior.


## Desktop flow tools · 2026-10-14

Project search matches actual title and goal. Ordinary project buttons support Up/Down/Home/End; task filters use real state counts, preserve per-project drafts and restore focus after a filtered row leaves. Desktop project and task lists have bounded independent scrolling.

Data result tools capture one current computed result for optional folded comparison and copy its source, method, variables and displayed precision. Keep method/variable context visible, represent absent metrics honestly, expose clipboard errors with a manual-copy fallback. Clear snapshots on every successful dataset replacement, including same-name files. Session-only view snapshots introduce no statistical computation or cloud storage. Preserve the incumbent motion, tokens and Dashboard composition; no additional runtime dependency.

## Balanced overview · 2026-10-15

The owner reopened the previously protected Dashboard body to correct its paper-first emphasis, then rejected the initial four-column directory as visually cluttered. This section supersedes earlier Dashboard-preservation constraints for the overview body only. The owner subsequently confirmed the editorial direction and requested further polish. It is an editorial index on one white sheet: a 46px serif route title with one header rule, four equal 32px typographic workspace links in the primary column, and quieter recent paper/project records in a narrower secondary column. Recent record titles lead at 16px; 12px type/source metadata and tabular dates sit beneath them. Display text uses a self-hosted 7,448-byte Noto Serif SC Medium fixed-label subset with its OFL license; ordinary text keeps the existing UI stack. The shared light field stays outside the sheet; no curtain crosses the working text. No feature cards, repeated CTA captions, record icons or boxed recent list. Preserve the existing cobalt, ink, shell and navigation. Recent record scope remains explicit; do not invent course activity, persistent dataset history or counts to fill gaps. Keep loading, guest, empty and error feedback inside the recent-record section so all workspace entries remain available. Hover/focus changes ink, a small destination arrow and one thin underline via interruptible transitions, with reduced-motion cancellation. This introduces no data endpoints, storage changes or motion runtime. The refined version remains a local preview; the previous four-column preview was not accepted.

The subsequent decorative preview was rejected. The owner explicitly chose the immediately preceding refined editorial version for deployment on 2026-10-15. Remove the paper sculpture, bookmark and their layout changes; preserve the 46/32/16/12 typography, title-first recent records and interaction refinements described above. Generated decoration assets are archived outside the published public directory. Release status belongs to the release PR and public `/api/version` rather than this design decision record.

## Evidence-led shared refinements · 2026-10-15

This supersedes the earlier over-content main rail reveal: the desktop shell now makes room for the 72px → 232px navigation with a synchronized, bounded grid transition. Hover, keyboard disclosure and Escape remain; reduced motion cancels both transitions. The owner-selected overview typography and reader topology remain intact. Primary account/empty-state/course actions use the existing brand tokens; guests see the existing settings login path without an unusable save action. Ambient motion remains off for a first visit, remembers explicit user choices on this device, tolerates unavailable storage, and always yields to system reduced motion. Formula styles belong to the course rendering component rather than every entry route. Rationale, rejected audit prescriptions and verification boundaries are recorded in docs/reviews/2026-10-15-audit-decisions.md. These changes are local until separately released.

The subsequent research-desk redesign was rejected. The owner selected the preceding refinement on 2026-10-15 and authorized deployment: preserve the established overview and workspace compositions, plus the shared fixes in this section. The rejected visual patch and its direction brief remain in ignored local release artifacts. Release status belongs to the PR and public `/api/version`.

## Current role rules · 2026-10-23

This is a refinement of the light workspace, not a replacement visual identity. It resolves roles for the revision batches; the owner-approved editorial Dashboard and reader density stay intact.

| Role | Current rule |
|---|---|
| Page identity | Existing PageHeader, normally 30–38px operational headings; keep the Dashboard's approved 46px title. Safe static document titles name the route, never private records. |
| Current object | Paper/project/dataset title leads its local content, wraps without clipping; keep reader source titles separate from route identity. |
| Content heading | 16–20px UI headings; source reading uses its existing academic typography and adjustable 18/20/22px body. |
| Body and metadata | Existing sans UI body, 14px forms and 12–13px metadata at readable contrast; source prose keeps reader typography. Never enlarge everything to force hierarchy. |
| Primary / secondary actions | Existing cobalt Button for the current committed action; secondary/ghost for edits, comparisons and cancellation. Teal remains reserved for AI. |
| Local navigation | Existing labelled tabs/directories, visible focus and current state. Low-frequency mobile paper controls live in a named native popover. |
| Saved / error state | State the actual location: device draft, account record, current page result, local named snapshot. Text accompanies color; failures preserve input and name a recovery action. |

New rules belong to the touched component's CSS module. Home uses a real, labelled built-in paper example with a mobile source excerpt; no private account capture, fabricated research, extra decorative palette or new motion runtime. Snapshot/project association reuses existing records and makes local-only source availability visible.

### Reference-inspired interaction refinement · 2026-10-23

The home page keeps its current layout and labelled source example. A three-step demonstration explains reading, a source highlight and an independent note. The demonstration is now explicitly played/replayed (autoplay was removed after the owner clarified hover as the intended trigger); manual step selection interrupts it, and reduced-motion or hidden/offscreen state finishes it immediately. Source text, notes and the workspace link stay available throughout. The home title reveals line by line over 1050ms; individual entries reveal over 800ms and desktop scroll gently carries the introduction away. The example separates a serif source sheet from an offset note sheet, with a highlight sweep and bounded 750–800ms sheet transitions. Mobile stacks the sheets. Home sections reveal once through cancellable native animations; default rendering is visible even without JavaScript. Link and arrow feedback uses 160ms, including keyboard focus, and disappears under reduced motion.

Paper navigation and newly added annotations share a temporary 1100ms outline cue on the actual source/annotation nodes. It changes no text geometry, text, persistence or reading anchor. Reduced motion retains a static temporary outline. Existing sidebar/selection/chart transitions and opt-in ambient background are reused. Optional, initially collapsed course and data guides expose three explanatory steps; these are guidance, never calculated progress or analysis results. No animation dependency, scroll interception, full-screen transitions or workbench redesign was added.

Local scope and evidence: docs/reviews/2026-10-23-reference-motion.md. This entry is implementation documentation, not a production release claim.

Home hover refinement: on fine pointers, title lines move and skew slightly, source/note sheets compose individual translate/rotate/scale with their current demo pose, and module rows move title/copy at different distances with a drawing underline. CSS transitions return to the exact current pose on pointer leave; source text remains selectable. Touch and reduced-motion modes omit spatial hover effects.

### Shared hover feedback across routes · 2026-10-23

The owner explicitly extended hover feedback to all interfaces. The root layout loads `interaction-feedback.css` for overview, courses, papers, data, projects, settings, help and account screens. Enabled ordinary controls lift slightly; list hit areas stay still while title/icon children move; tab/navigation selection targets retain fixed geometry and answer through an inset line or existing selection plate. Overview destination links lift 4px. Editable fields only change border color. Source text, read-only/disabled controls, busy actions and home-specific choreography are excluded from the generic movement. Fine-pointer and reduced-motion media queries gate the shared transitions. This supersedes the earlier scoped prohibition on button hover lift for the owner's newly requested cross-route interaction pass; idle layouts and data contracts remain unchanged.

Coverage and limits: `tests/e2e/shared-hover.spec.ts` covers representative controls on eleven route surfaces, plus reading/input stability, disabled state, reduced motion and touch. These checks do not assert that every control in every modal has been independently inspected. Local implementation only; no production deployment.
