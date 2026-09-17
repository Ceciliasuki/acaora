---
name: Acaora 学曦
description: Modern AI Workspace × Academic Productivity. Cool-neutral light workspace, one brand blue for product actions, one teal reserved for AI.
colors:
  brand-blue: "#2f5ad4"
  brand-blue-hover: "#2648ab"
  brand-tint: "#eaefff"
  brand-ink-on-tint: "#1f3f9e"
  brand-on-dark: "#93b1fb"
  ai-ink: "#0b6f66"
  ai-tint: "#e4f6f3"
  ai-teal: "#14b8a6"
  ai-on-dark: "#5fe3cd"
  ai-ink-on-teal: "#0c2f2b"
  app-background: "#f5f6f9"
  surface-white: "#ffffff"
  surface-subtle: "#f8f9fb"
  paper-surface: "#faf9f6"
  deep-navy: "#121828"
  deep-navy-raised: "#1b2334"
  ink-primary: "#131a2b"
  ink-secondary: "#626978"
  ink-faint: "#8a92a2"
  ink-inverse: "#eef1f6"
  ink-inverse-secondary: "#96a0b3"
  line-soft: "#e3e6ec"
  line-strong: "#ced4e0"
  line-control: "#7d8899"
  line-inverse: "#2b3448"
  success: "#1a7a5a"
  success-tint: "#e6f5ef"
  warning: "#7a4e0f"
  warning-tint: "#fdf4e4"
  danger: "#b3352b"
  danger-tint: "#fdecea"
typography:
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
    textColor: "{colors.ink-inverse}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
    fontSize: "14px"
    fontWeight: 700
  button-primary-hover:
    backgroundColor: "{colors.brand-blue-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    borderColor: "{colors.line-control}"
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
    borderColor: "{colors.line-control}"
    rounded: "{rounded.sm}"
    padding: "11px 13px"
    height: "48px"
    fontSize: "15px"
  field-focus:
    borderColor: "{colors.brand-blue}"
  card:
    backgroundColor: "{colors.surface-white}"
    borderColor: "{colors.line-soft}"
    rounded: "{rounded.lg}"
    padding: "24px"
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
    borderColor: "{colors.line-soft}"
    textColor: "{colors.ink-primary}"
  segmented-filter-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-ink-on-tint}"
    rounded: "{rounded.xs}"
  register-cell:
    borderColor: "{colors.line-soft}"
    textColor: "{colors.ink-primary}"
    fontSize: "28px"
  ruled-row:
    borderColor: "{colors.line-soft}"
    textColor: "{colors.ink-primary}"
  status-bezel:
    backgroundColor: "{colors.surface-white}"
    borderColor: "{colors.line-soft}"
    textColor: "{colors.ink-secondary}"
  state-note:
    textColor: "{colors.ink-secondary}"
  paper-field:
    backgroundColor: "{colors.paper-surface}"
    borderColor: "{colors.line-soft}"
    rounded: "{rounded.sm}"
  paper-sheet:
    backgroundColor: "{colors.surface-white}"
    borderColor: "{colors.line-strong}"
    rounded: "3px"
  contents-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink-primary}"
    rounded: "0px"
  bibliographic-record:
    borderColor: "{colors.line-soft}"
    textColor: "{colors.ink-primary}"
    rounded: "0px"
---

# Design System: Acaora 学曦

## Overview

**Creative North Star: "The Study Workbench" (学习工作台)**

Approved as the internal design north star. It is taken from the product's own vocabulary (总览 / 论文工作台 / 数据工作台 / 项目工作台) rather than invented for this document. It exists to keep design decisions pointed at one idea, and it is not a marketing slogan, not user-facing copy, and not a line that appears in the interface.

Acaora is a workbench, not a stage. The surface is a cool, near-white working field with one saturated blue reserved for the actions a student actually takes, and a deep navy rail on the left that holds navigation and the paper library. Nothing on screen competes with the material being studied: the paper text, the table, the task list. The interface is designed to be looked at for two hours, not to be looked at once.

The page language is the **working band** (仪表). A surface opens on a rule-separated control band, states its real numbers in a register, arranges its content in ruled rows and columns rather than in cards, and closes on a bezel of the facts that hold everywhere. The two dense tools, PaperLab and DataLab, keep their own three-column workbenches inside that frame: the frame is what unifies the product, not a shared card.

The second, newer page language is the **Scholarly Luxe workspace**, approved after the working bands and implemented first on the dashboard. Where a working band is an instrument panel, a scholarly surface is an editorial page: a running head, a publication object set in paper, numbered sections, an index and a bibliographic record list, held together by typography and rules instead of containers. Its full definition is the **Scholarly Luxe Workspace** section below; the dashboard is its reference implementation. The working bands remain valid for the surfaces that still use them, and both languages share one token layer, one type scale and one focus contract.

The product carries two visual registers that must never blur. Ordinary product surfaces (courses, projects, data, settings, navigation, primary actions) speak in brand blue on cool neutrals. AI-semantic surfaces (the AI studio, AI-generated results, AI processing state) speak in teal on tinted or inverse grounds. Teal is not a second brand colour and must not be used to decorate ordinary business actions.

Density is deliberately uneven between surfaces. A reading tool and a statistics tool are allowed to be far denser than a settings page. What is unified is the design language: the same neutrals, the same type scale, the same radius and elevation logic, the same focus treatment. Page structure is not unified, and forcing it to be would damage the two tools that need density.

**Key Characteristics:**
- Light, cool, near-white workspace; deep navy for navigation and inverse panels.
- One accent (brand blue) for the whole product; one reserved semantic accent (AI teal).
- One warm neutral exists, and it is paper (`#faf9f6`, `--surface-paper`): publication objects, paper sheets and document edges only, never a page ground.
- System sans throughout; Georgia has been removed from page-level titles.
- Page structure carries no elevation at all: full-bleed rule-separated bands hold the chrome, and the capped measure sits inside them.
- A scholarly surface holds structure with rules, alignment and paper material instead: two clearly bounded premium surfaces is its guideline ceiling.
- Borders plus the lightest shadow carry structure for controls and genuinely raised content; a page is never a stack of floating cards.
- A numeric register reports the page's real state, and the dense tool surfaces are allowed to look like instruments rather than like marketing panels.
- A surface never prints a number it has not read: unknown is `—`, never `0`.
- Motion is restrained and always explains a state change.
- Long-session legibility beats first-impression impact.

## Colors

A tight cool-neutral ramp with a single saturated blue and a single reserved teal; the palette is intentionally narrow so that the one accent that appears always means something.

### Primary
- **Acaora Blue** (`#2f5ad4`, token `--brand`): the single product accent. Primary button fill, links, active and selected states, progress fill, current navigation marker, focus ring. Measures 5.94:1 as text on white. As a fill it carries the inverse label colour rather than pure white, and that actual pair (Ink Inverse on Acaora Blue) measures 5.25:1, still comfortably above the 4.5:1 body-text requirement.
- **Acaora Blue Deep** (`#2648ab`, `--brand-hover`): hover and pressed state for blue-filled controls only.
- **Acaora Blue Wash** (`#eaefff`, `--brand-subtle`): the selected background and the soft focus halo behind a focused control.
- **Blue Ink on Wash** (`#1f3f9e`, `--brand-on-subtle`): text placed on the wash. 8.08:1.
- **Blue on Deep Navy** (`#93b1fb`, `--brand-on-dark`): the brand accent as it appears inside the navy rail. Required because the main blue measures only 2.98:1 against deep navy and cannot be used there.

### Secondary
- **AI Ink** (`#0b6f66`, `--ai`): the AI-semantic ink colour for text and icons in AI regions on light grounds. 6.03:1 on white.
- **AI Wash** (`#e4f6f3`, `--ai-subtle`): the light ground behind AI entry points and AI result panels.
- **AI Teal** (`#14b8a6`, `--ai-vivid`): the solid fill for AI actions, such as the run button in the AI studio. Always paired with AI Ink on Teal as its label colour.
- **AI on Deep Navy** (`#5fe3cd`, `--ai-on-dark`): AI marks and labels inside the navy AI studio panel. 11.25:1 on deep navy.
- **AI Ink on Teal** (`#0c2f2b`, `--ai-ink-on-vivid`): the label colour on a solid teal fill. 5.79:1.

### Neutral
- **App Field** (`#f5f6f9`, `--bg-app`): the page background for every workspace surface, and the mobile browser theme colour. Not pure white, so white surfaces can sit on it.
- **Surface White** (`#ffffff`, `--surface`): cards, panels, inputs, dialogs.
- **Surface Subtle** (`#f8f9fb`, `--surface-2`): inset areas, table headers, secondary panels, segmented control troughs.
- **Paper Surface** (`#faf9f6`, `--surface-paper`): the system's one warm neutral, and the material of a publication object. Allowed for publication objects, paper sheets, document edges and academic archival surfaces. Forbidden as a page background, as a generic card fill, in warning states, and on ordinary form controls. Deeper paper steps are mixed from this token with the ink ramp through `color-mix()`; no second warm palette and no additional warm hex exists.
- **Deep Navy** (`#121828`, `--surface-inverse`): the left rail, the paper library, the AI studio panel, and any inverse panel. One value, not several near-blacks.
- **Deep Navy Raised** (`#1b2334`, `--surface-inverse-2`): selected rows and secondary blocks inside an inverse surface.
- **Ink Primary** (`#131a2b`, `--text`): body and headings. 17.35:1 on white.
- **Ink Secondary** (`#626978`, `--text-2`): metadata, captions, secondary prose. 5.51:1 on white, 5.10:1 on the app field.
- **Ink Faint** (`#8a92a2`, `--text-3`): large or decorative text only, 3.13:1, never body copy.
- **Ink Inverse** (`#eef1f6`, `--text-inverse`) and **Ink Inverse Secondary** (`#96a0b3`, `--text-inverse-2`): text on deep navy, at 15.63:1 and 6.72:1.
- **Line Soft** (`#e3e6ec`, `--border`) and **Line Strong** (`#ced4e0`, `--border-strong`): decorative card and divider borders, and their hover/active step.
- **Line Control** (`#7d8899`, `--border-control`): the border of an actual control (input, select, textarea, secondary button). Deliberately darker than Line Soft because a control boundary is a non-text UI element and must reach 3:1: it measures 3.59:1 on white and 3.32:1 on the app field.
- **Line Inverse** (`#2b3448`, `--border-inverse`): structure inside a navy panel.
- **Success** (`#1a7a5a`), **Warning** (`#7a4e0f`), **Danger** (`#b3352b`) with washes (`#e6f5ef`, `#fdf4e4`, `#fdecea`): sync-complete, waiting/example-data, and delete/error states. There is deliberately no separate information colour; information reuses brand blue.

### Named Rules
**The One Accent Rule.** Brand blue is the only product accent. No second decorative accent may be introduced for cards, emphasis, or decoration, and a single-series chart is blue or neutral, never a rainbow. One explicit exception: a multi-series data visualisation may need several encoding colours to distinguish real data series. Such a palette is not a second brand colour, is not governed by this rule, and must be designed and approved separately during the DataLab phase. AI teal must never be borrowed as an ordinary chart's second series.

**The AI Teal Containment Rule.** Teal appears only where the surface is about AI: the AI studio, AI-generated results, AI processing state. It never fills a normal business action, a course card, a project control, or a chart series. A scholarly surface, its paper material and its research records are not AI-semantic regions either: none of them may borrow teal to look technical, scientific or modern.

**The Paper Containment Rule.** Paper Surface is a material, not a theme. It belongs to the publication object and the sheets inside it; it never becomes the page ground, never fills a generic card, never marks a warning, and never dresses an ordinary control. A surface that turns warm overall has misused the token, and any deeper paper tone is derived from it rather than added to the palette.

**The Two Blues on Navy Rule.** Against deep navy, never use the main brand blue for text or marks (2.98:1). Use Blue on Deep Navy, or AI on Deep Navy inside AI regions.

**The Light-Only Rule.** The product is light-mode only; there is no dark theme and none is planned. `color-scheme: light` is declared so browser chrome, form controls, and scrollbars do not invert on their own.

## Typography

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

The token layer is product-wide. The page language is not yet unified: the dashboard is now built in the Scholarly Luxe workspace language and is that language's reference implementation, while the course centre, the project workspace, settings, DataLab and PaperLab still use the working bands described above. Both are approved, and both are recorded here so neither reads as a leftover. The shell, the authentication pages and the public landing page are on neither list and still read as an earlier era; the App Shell review is deferred deliberately (see Scholarly Luxe Workspace below). The landing page additionally ships three things this record's own Don'ts forbid — a mock product preview standing in for a screenshot, a decorative command-key control that performs nothing, and a fabricated progress figure with a sparkline — and its hero is to be replaced by a real product screenshot once the owner selects one. These gaps are recorded so they are not mistaken for decisions.

## Elevation & Depth

The system is hybrid but border-led: structure comes from a 1px border, and shadow is a supporting cue rather than the primary signal. Surfaces are not floating cards. Panels sit flat at rest with a border and the lightest shadow; shadow increases only with real elevation, so the appearance of depth always corresponds to something actually being above the page. All three shadow values are tinted cool (towards the navy ink) rather than neutral black. The violet-tinted shadow family inherited from an earlier layer is retired and must not return.

### Shadow Vocabulary
- **Resting structure** (`--shadow-1`, `0 1px 2px rgba(19, 26, 43, .05)`): controls, cards, and panels at rest, always alongside a border.
- **Raised** (`--shadow-2`, `0 8px 24px rgba(19, 26, 43, .06)`): genuinely floating elements such as menus, popovers, and a selected card.
- **Overlay** (`--shadow-3`, `0 24px 70px rgba(10, 16, 32, .18)`): dialogs, drawers, and toasts only.

### Named Rules
**The Border First Rule.** A surface earns separation from a border and spacing before it earns a shadow. If removing a shadow would make the element unreadable, the border is wrong.

**The Inverse Border Rule.** Inside deep navy, depth is carried by a low-opacity light border, not by a shadow. Shadows on inverse surfaces are not used.

**The Structural Elevation Rule.** Page structure carries no elevation. Bands, registers, ruled rows, strips and the bezel are separated by a 1px border and by spacing alone; a shadow is reserved for a control at rest, a genuinely floating element, and an overlay. A page whose every section sits on a raised card has mixed the two vocabularies and lost the distinction the shadow was there to make.

**The Two Shadow Surfaces Rule.** A scholarly surface may raise at most two things, and they are always parts of one publication object: the paper field and the top sheet, both at the resting `--shadow-1`. Everything else on the surface is separated by tone, rules and spacing. This is a budget, not a licence: a third shadowed surface on a scholarly page is a defect, and glow or glass is never a substitute for depth.

## Shapes

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
- **Shape:** 10px radius (`--r-md`), 44px minimum height, 16px horizontal padding.
- **Primary:** Acaora Blue fill with Ink Inverse label (measured 5.25:1). Avoid placing two competing primary actions in the same action group or local context. A larger workspace may legitimately carry different primary actions in separate functional regions, and that is not a violation.
- **Secondary:** Surface White fill, Line Control border, Ink Primary label. The standard button in a workspace toolbar.
- **Ghost:** no fill, Ink Secondary label, used for low-emphasis and icon-only actions.
- **Danger:** Danger red fill, reserved for destructive confirmation.
- **Hover / Focus:** background, border, and colour transitions at 160ms with an ease-out curve. Pressed state compresses to `scale(.985)`, a deliberately restrained value chosen for a desktop productivity tool rather than the stronger compression used in consumer UI. Keyboard focus always shows a visible ring in brand blue.
- **Disabled:** reduced opacity with the native disabled attribute, never a look-alike button that still responds.

### Chips
- **Style:** used for section navigation, filters, knowledge tags, and interest tags. Line Soft border on transparent for navigation chips; brand wash with Blue Ink on Wash for a selected filter; small dark tokens for term tags.
- **State:** selected state is always a fill change plus a text/weight change, never colour alone.

### Cards / Containers
- **Corner Style:** 14px (`--r-lg`) for cards and panels, 18px (`--r-xl`) for workbench containers and dialogs.
- **Background:** Surface White on the app field; Surface Subtle for inset rows and table headers; Deep Navy for the rail, paper library, and AI studio.
- **Shadow Strategy:** resting structure plus border (see Elevation).
- **Border:** Line Soft, tested against a cool background. Border colour is always cool-tinted; a warm or pure-black border is not part of this system.
- **Internal Padding:** 24px as the default panel padding, 16px for dense data panels. (The card primitive currently ships 22px; that value is neither on the spacing scale nor part of this record, and must be aligned to 24px during the phase that next touches it.)

### Working bands
- **Control band:** Surface White ground closed by a 1px Line Soft border, 56px minimum height, its contents capped to the surface's measure. The page title, the surface's single filter and its single primary action live here. Nothing sits above it.
- **Segmented filter:** a Surface Subtle trough at the 6px radius; the pressed segment is Brand Wash with Blue Ink on Wash and a semibold label. A filter that narrows a list is a labelled group of `aria-pressed` buttons, not a tablist — it switches no panel, and calling it one misleads assistive technology.
- **Numeric register:** four or five equal cells divided by 1px vertical rules, each a 12px Line Soft label, a 28px tabular value and a one-line caption. A cell that reports a fact rather than a number drops to the card step (15px), so a phrase never has to pretend to be a metric. Every value is a real array length, a real stored status, or an honest absence.
- **Ruled table and ruled row list:** a Surface Subtle header row over 1px Line Soft row rules, with tabular figures in the numeric columns. Where the rows are actions they stay real buttons carrying their own hover, focus and current state.
- **Four-area strip:** the product's four areas as one full-width four-cell ruled band, each cell carrying the same mark the rail uses for that destination. A cell reports a count only where a count exists. On a scholarly surface this strip is replaced by the workspace contents pattern (see Scholarly Luxe Workspace), which carries the same information as a numbered list rather than as a band.
- **Status bezel:** a 34px band that closes the page with the facts that hold everywhere — local-first, what is not uploaded, the account or surface state. It holds the bottom of a short page, which is what a dense surface uses where an airy one would leave the space empty.
- **State note:** the empty and guest message lives in the content region as a heading, one paragraph, and buttons where the surface has real actions. It is never a dashed dropzone, and it never states a fact that a failed request did not establish — an unread list is unknown, not zero.

### Inputs / Fields
- **Style:** Surface White fill, Line Control border at 3.59:1, 8px radius, 48px minimum height, 15px label-sized text inside.
- **Focus:** border turns brand blue, a soft brand wash halo appears, and a 2px brand ring is drawn just outside the control. Because a shared control's own focus treatment must survive page-scoped styling, the primitive declares this ring itself rather than relying on a global outline rule.
- **Error / Disabled:** invalid fields keep the Danger border and pair it with inline error text below the field; the error state is never signalled by colour alone. Disabled fields use a muted surface and reduced text emphasis. Labels sit above the field, and helper or error text sits below it; a placeholder is never used as the label.

### Navigation
- **Style:** the left rail is a single 248px deep-navy column with a 44px brand mark, six destinations (总览, 课程中心, 论文研究, 数据分析, 项目空间, 设置与隐私), and an account block pinned to the bottom. Items are 48px tall with a 20px icon and a 14px label.
- **States:** inactive text is Ink Inverse Secondary; hover and current use the raised navy with Ink Inverse text; the current item is additionally marked by a brand-on-navy icon. The current item is exposed through `aria-current="page"`, so the state is not colour-only.
- **Mobile treatment:** off-canvas drawer with a fixed trigger, a backdrop, and a body scroll lock that is released on close.

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

### Deferred: App Shell and Sidebar
The navigation rail and app shell still speak the earlier dark-navigation language, and the gap between that language and a Scholarly Luxe body is visible on the same screen. Status: **DEFERRED DESIGN REVIEW**. Once the core workspaces have adopted this language, the shell is reviewed on its own for rail proportion, typography, active state, material, and desktop/mobile navigation. No future shell styling is defined here, and the shell is not to be restyled as a side effect of a page phase.

## Do's and Don'ts

### Do:
- **Do** apply the locked system as already approved. Brand blue `#2f5ad4`, AI teal family, deep-navy rail, cool neutrals, system sans, and the shared focus contract are settled decisions, not open questions.
- **Do** keep one accent. If a surface seems to need a second colour for emphasis, the hierarchy is wrong, not the palette.
- **Do** gate every control boundary at 3:1 and every body text pair at 4.5:1, and record the measured ratio when adding a pair.
- **Do** keep keyboard focus visible on every interactive element, and keep the shared primitive focus treatment working even where page-scoped styles are more specific.
- **Do** keep `aria-current`, `aria-expanded`, `aria-invalid`, `aria-describedby`, and `aria-live` intact through any visual change, and keep the modal accessibility behaviour intact: focus containment while open, a sensible initial focus, Escape to close where appropriate, focus restoration on close, and a correct accessible name and description.
- **Do** let PaperLab stay a dense three-column research workspace and DataLab stay a dense analytical one. Preserve their structure; the visual language is what unifies them.
- **Do** build a workspace page from the working bands, with full-bleed chrome and the capped measure inside it.
- **Do** build a research surface in the Scholarly Luxe language instead where the content is a study rather than a console: a running head, a publication object in paper, numbered sections, an index and a bibliographic record list, held by rules and typography rather than by containers. The two page languages are both approved; pick the one the surface's work calls for, and do not blend them into a third.
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
- **Don't** add a hex value that is not in this document. A new colour requires an explicit decision first.
- **Don't** create a primitive for a single use. Shared primitives are for genuinely cross-surface patterns only.
- **Don't** update visual baselines to make a test pass. Baselines change only after a human has reviewed the diff and approved the new design.
- **Don't** allow the Impeccable launcher or its hook to execute a downloaded binary in this project, and don't commit platform executables.
