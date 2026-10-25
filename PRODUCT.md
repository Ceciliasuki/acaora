# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Chinese university students who do quantitative study, reading, and project work: typically undergraduates, typically on their own laptop, typically in long sessions.

Applied statistics and economics coursework is the common starting scenario, not the boundary of the audience. It is what DataLab and PaperLab were first built against, and it is the scenario this product is easiest to judge in. Students in other quantitative or empirical fields are equally in scope. What defines the audience is the work, not the major.

The owner has explicitly prioritized a professional empirical-research workflow: literature, data, models, robustness checks and the handoff to writing. Course learning stays comparatively independent. The current local research-workbench increment adds structured design, registered analysis summaries, researcher-assessed findings with source links and dossier export; it does not establish that the entire platform has attained a professional certification or a complete reproducible environment.

The professional research tools add append-only protocol versions, account-scoped record backup/restore, data lineage, a literature evidence matrix, executable model-specification batches, full-precision reproduction checks, editable Word/LaTeX delivery, and linked review issues. Source files and full analysis snapshots remain local. The database expansion is active; the frontend increment is local until explicitly released.

The connected research increment adds dependency invalidation, audited multi-table joins, immutable run-bound writing blocks, researcher-declared causal graphs, normal-approximation power planning, complete hypothesis families, and an explicitly authorized loopback Python/R companion. Projects remain private until their owner creates an invitation; viewer/editor access is enforced in the database, and records retain the actual author. Invites do not share personal libraries or original files. Release identity and verified deployment evidence are governed by `docs/releases/2026-10-25-research-workbench.md`.

Their job is not "to use an app". It is to get through a term: follow a course syllabus, read English-language papers, produce assignments and reports, run basic statistical analysis, and keep a research project moving without losing the thread between sessions.

Secondary audience: the owner as sole maintainer and the public as readers of an MIT-licensed repository. Neither is a design target for the workspace surfaces.

## Product Purpose

Acaora is a single study and research workspace that brings course work, paper reading, data analysis, and project tracking into one coherent workspace. When signed in, these records belong to one account and one history; the anonymous PaperLab workspace remains the deliberate device-local exception described below.

It exists because students currently spread this work across a PDF reader, a notes app, a spreadsheet, a statistics tool, and a folder of files, and lose the connections between them. Acaora keeps the course, the paper, the dataset, and the project next to each other, so that reading a paper and finishing an assignment are the same thread instead of four disconnected tools.

Success means a student returns to it in week 12 of a term without having lost their reading position, their notes, or their project state.

## Positioning

Three mechanisms a neighbouring product could not truthfully copy without adopting the same constraints:

1. **Local-first files, account-scoped derived records.** Original PDFs and imported data files are parsed in the browser and never uploaded. What syncs is the derived study record: extracted text, translations, notes, reading position, saved AI results. A cloud-first competitor cannot claim this without redesigning its upload path.
2. **An AI layer that is labelled and kept separate from source material.** Across the whole product, AI output must be clearly identified as AI and stored in a layer of its own, distinct from the original material and from the student's own notes; it is never presented as either. Within PaperLab specifically, any AI output that makes a claim about a paper must cite the numbered source paragraphs it came from, so the student can check it against the text. Other AI surfaces are not required to use paragraph ids: curated course lessons and practice are authored content, require no imported materials or AI key, and keep reference answers distinct from student answers.
3. **One workspace across study, research, data, and projects** rather than four products sharing a login. The dashboard, the paper library, the dataset, and the project tasks draw on the same account record.

## Operating Context

- Chinese-language interface for students at Chinese universities; English is the language of the papers being read, not of the UI.
- Login uses email and password through Supabase Auth, with confirmation and recovery links. QQ, 163/126, Outlook, Gmail, and school mailboxes are all expected.
- The account model has two states that must not be confused with each other. **Signed in:** one account, one record, and that record follows the student across devices. **Anonymous:** a deliberate device-local exception, limited to the paper workspace, so a student can read a paper without creating an account. Anonymous records live only on that device, are not the signed-in record, and are never silently merged into an account.
- Primary environment is desktop web (Chrome or Edge on a laptop). Browser-local translation is a real, relied-on capability: the reader uses the browser's own built-in translation rather than a server, so the paper text does not leave the device. The product's own copy requires a recent desktop Edge build for this to be available.
- Papers arrive as text-layer PDFs. Courses provide their own lessons and exercises. Datasets arrive as CSV and spreadsheet files.
- Work is interrupted constantly and resumed later, including offline. Edits and deletions made offline must survive a reload and reach the cloud on reconnect.
- The product is deployed as a single Next.js app on EdgeOne Makers, with one production domain. There is no separate staging product.

## Capabilities and Constraints

Surfaces (routes as shipped):

- `/` public landing, the only marketing surface
  Its source-and-note example uses the built-in sample paper directly, with readable HTML at desktop/mobile sizes, an explicit example label, source context and a link to the actual sample workspace.
- `/auth`, `/auth/reset`, `/auth/callback` account entry, password recovery, SSR mail callback
- `/dashboard` workspace overview
- `/courses` curated course-selection list with search and track filters. Choosing a course opens its existing syllabus, then starts/resumes learning. Syllabus, lesson and review pages offer a return-to-list action; lesson chapter navigation remains collapsible. Seven guided courses, core/elective lessons, one worked example and three core exercises per lesson, one comprehensive case per course; account-scoped reading and practice records.
- `/papers` PaperLab: a searchable paper-selection library with paper-level favorites, bibliography and confirmed deletion; selecting a paper enters the existing research workspace. Returning preserves notes and reading position. Source links can still enter the target paper/paragraph directly. The workspace has a wide continuous text reader with optional translations, collapsible quick-switch library and reading-position notes, paragraph guidance, AI studio, scholarly search. Desktop panels default to collapsed; their visibility is a device preference, and mobile uses independent panel tabs. Paragraph IDs anchor existing notes/AI evidence; reading does not require paragraph pagination. A separate original-PDF view renders figures and page layout with PDF.js. Original bytes are cached in an account-scoped device database and never enter the cloud queue. Older imports require selecting the matching source PDF once per device; attaching it preserves paragraph IDs, notes, translations, bookmarks and progress and offers explicit preview and confirmation before changing inferred title or numbered-section metadata. Browser-data removal also removes this local copy.
  Reader navigation includes a filterable chapter directory and literal original-text find with source highlights, case sensitivity, matching-paragraph results and keyboard traversal. Annotation review supports text, color and comment-presence filters. These controls reuse existing source anchors and reading history; their queries and filters remain transient UI state.
  Desktop reading also supports a resizable fixed-source comparison pane with its own paragraph and translation view, plus explicit location/swap actions. Annotation selections export or copy source-linked extracts, preserving original quotes and separate personal comments. The original-PDF viewer includes lazy page thumbnails and device-local viewing rotation. These additions do not introduce a second PDF engine or upload original files.
  The 2026-10-21 reader refinement adds direct paragraph/source-page location and a source-scoped back/forward trail on desktop and mobile. Source-page navigation lands at its first extracted paragraph; it does not imply PDF coordinate navigation. Reading shortcuts are scoped to the reader, and history remains session-only UI state. Deployment is owner-authorized; the release PR and production version establish live status.
- `/data` DataLab: local dataset import, descriptive statistics, hypothesis tests, regression, visualisation. Current data and pinned results are page-session state. Named analysis snapshots contain configuration and summaries, not source rows; signed-in snapshots stay in account-scoped localStorage, anonymous snapshots in tab-scoped sessionStorage. They do not cloud-sync. Explicit JSON export/import provides backup; project notes can reference a local snapshot and its data fingerprint, with an optional next task and existing paper-evidence ID.
  Damaged-history recovery confirms identity separately from parsing, offers original-file export, requires explicit recovery confirmation and preserves the damaged raw value before replacement. Account changes cancel asynchronous backup import and staged recovery. Storage refreshes retain in-progress project-link input.
- `/projects` project workspace: status, progress, tasks, notes, resources. Research project kinds also offer design records, an analysis register with saved-value comparisons, findings linked to excerpts/analyses, and saved-record Markdown/JSON export. Analysis registrations save recognised settings, summaries and data fingerprints with the project; full snapshots and original rows remain local. Drafts are owner/project scoped, conditional saves preserve concurrent work, and missing source links are explicit. Existing paper evidence and snapshot references are grouped as research materials. Explicit project context in paper/data URLs keeps source locations, snapshot targets and project returns connected; choosing a context never saves an association by itself. Courses remain a comparatively independent study module, without a required project context. These research-continuity and workbench additions are local until separately released.
- `/settings` profile, password, AI key, privacy
- `/dev/ui-kit` development-only component and token gallery (returns 404 in production)

Confirmed constraints:

- No commercial use or paid infrastructure subscriptions; the owner has purchased and configured the custom domain acaora.cn.
- Production uses acaora.cn on Tencent EdgeOne China console with same-origin account APIs. Direct access has been observed on the owner’s connection; that does not establish availability on every mainland network.
- Original files must never be uploaded. Server keys must never reach the browser. The browser talks to same-origin `/api/*` only.
- Cloud deletion must propagate to every device and must not be resurrected by an offline device.
- Long-session use is the design case; single-visit conversion is not.

Undecided product facts, recorded rather than invented:

- Whether legacy device-only records should ever be claimed by an account. Currently they are deliberately not claimed, because claiming them would silently turn device-local data into account data.
- Whether AI capabilities beyond the current action set are in scope.

## Brand Commitments

- Name: **Acaora 学曦**. The Chinese name is part of the identity, not a translation.
- Mark: a single letter **A** in a rounded tile.
- Voice: calm, precise, academic, plain. No marketing hype, no exclamation marks, no invented enthusiasm.
- The product is open source under MIT and the repository is public.
- Binding visual constraint volunteered by the owner and recorded without expansion: the interface is **light-mode only**; there is no dark theme.

## Evidence on Hand

Real and present:

- A working codebase with typecheck, lint, unit and mock E2E suites, accessibility smoke checks and committed visual baselines. Current release counts and tested scope belong in docs/course-reviews/release.md.
- A real production deployment with a traceable build commit endpoint (`/api/version`).
- A development-only UI gallery at `/dev/ui-kit`.
- Real integration with Supabase Auth, Semantic Scholar, Crossref, and the DeepSeek API.
- Documentation of the production auth smoke procedure and of the paper-sync reliability design.

Absent, and must not be fabricated by any future design or content work:

- No user testimonials, no customer logos, no press mentions, no partner names.
- No usage metrics, no retention or engagement numbers, no benchmarks, no performance claims.
- No testimonials, pricing, plans, or commercial claims of any kind.
- No user photographs or real user avatars.

## Product Principles

1. **One account, one record when signed in.** Signed in, course work, papers, data, and projects share one identity and one history, and that history follows the student across devices. Do not split them into separate products. The single sanctioned exception is the anonymous paper workspace: it is deliberately device-local, and it is never silently promoted into an account record.
2. **Local-first for files, account-scoped for records.** The original file stays on the device; only derived study records sync.
3. **AI is a labelled layer, never the source.** Across the product, AI output is clearly identified as AI, stored separately, and visually distinguishable from original material and from the student's own notes. In PaperLab specifically, AI claims about a paper must remain traceable to the numbered source paragraphs.
4. **Depth for the twelfth week, not delight for the first minute.** Optimise the long study session and the resumable workflow over first-visit impressions.
5. **Correctness and reliability outrank new surface.** Data correctness, auth correctness, and production availability come before new features or visual change.

## Accessibility & Inclusion

- Target WCAG 2.1 AA: body text at 4.5:1 or better, non-text UI and control boundaries at 3:1 or better.
- Full keyboard operability with a visible focus indicator on every interactive element. Focus must never be removed for visual tidiness.
- State must never be conveyed by colour alone; pair every colour cue with text, icon, or shape.
- Honour `prefers-reduced-motion`.
- The audience reads Chinese in long sessions, so typography must hold up at length and at small sizes: no body text below 12px, and no reliance on a Latin-only typeface for Chinese headings.
- Screen-reader users must be able to follow account and sync state changes; the interface is expected to expose these as live regions rather than silent repaints.
