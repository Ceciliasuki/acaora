# White Light Workspace Implementation Plan

> Agent workflow: use superpowers:executing-plans for implementation and verification-before-completion for final checks.

**Goal:** Implement the approved white ACAORA concept, with a silver-blue flowing light curtain and responsive button feedback.

**Architecture:** Preserve the existing Next.js routes, component library and all storage/auth/API contracts. Add one shared decorative SVG curtain and one CSS theme; rebuild the dashboard presentation around real records. Keep the reader opaque and calm.

**Tech stack:** Next.js 16, React 19, existing CSS and Lucide icons. No new runtime dependencies.

**Spec:** User-approved white reference: `C:/Users/Cecilia/.codex/generated_images/01a0f1b1-daca-7910-a93e-3827a48cd2f9/exec-8eefba92-e52c-487a-b2e4-c6852a786afe.png`.

## Constraints

- Use real data and honest loading, guest, empty and error states; no invented paper summaries or decorative metrics.
- Preserve account isolation, paper sync, paragraph references, AI provenance and local file handling.
- Use Humanizer for product copy: remove decorative numbering, duplicated English headings and unsupported claims.
- Ambient animation uses transforms; buttons respond to hover, press and keyboard focus. Reduced-motion users get static surfaces.
- Adapt Magic UI's MIT-licensed inset highlight approach with attribution; do not import its full registry or an animation library.
- Local implementation and preview only; no deployment or production test data.

## Tasks

1. Add meaningful interaction checks and observe failures. Implement shared light theme, curtain and button feedback.
2. Replace the dashboard's numbered editorial layout with a feature and recent-record layout. Simplify visible copy and unify remaining routes.
3. Run typecheck, lint, unit tests, functional E2E, accessibility and visual checks. Inspect desktop/mobile screenshots before accepting new baselines. Obtain a fresh final code review.

## Review focus

- Desktop/mouse, mobile/touch and keyboard navigation.
- Reduced motion, loading/disabled controls and non-interactive background.
- Long reader content and preserved independent scroll containers.
- Guest/empty/error account states and real records.
- Contrast, overflow and consistency across all public routes.

## Decision ledger

- The latest approved white concept supersedes the earlier frozen editorial appearance.
- Work in a new local branch of the clean checkout; no worktree is needed for this single implementer.
- Keep route-level actions truthful: overview record links open their existing workspaces rather than imply unsupported deep links.
- Final review found a drawer breakpoint mismatch, shared button positioning overriding fixed controls, and an inaccurate local-translation heading. All three were corrected and checked.
- After reviewing the local result, the user authorized production publication on 2026-09-30. Release through a reviewed PR and the existing main-branch EdgeOne pipeline; verify the deployed commit separately from local tests.

## Completion evidence

- Production build, TypeScript, ESLint and diff whitespace check passed.
- 28 unit checks passed, including sync/tombstone and account isolation invariants.
- Production-mode Playwright: 45 passed, no retries needed. Includes 9 visual baselines, 2 accessibility checks, five viewport widths, four motion/interaction checks and account/paper/project flows.
- Desktop/mobile screenshots were inspected; intentional baselines were refreshed. Home now uses a dedicated preview asset.
- Development runs showed intermittent login navigation timeouts; individual reruns and the full production run passed. No authentication implementation was changed.
- Browser checks use mocked account/API data; no live sign-in, paid AI request or deployment was performed.
- Preview command: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3210`.
