# Pearl workspace refinement

Design read: a white research application with silver material, quiet graphite typography and deliberate blue actions. Reading remains dense and stable; the overview has more space and visible ambient motion.

## Diagnosis

- Repeated blue borders made the shell, content, list rows and navigation shortcuts compete at the same level.
- The sharp vector curtain had little material depth and passed behind too much of the overview.
- An empty recent-record column enlarged the guest and empty states without offering an action.
- Bold Chinese headings, decorative filename typography and persistent border boxes added visual weight.

## Changes

- Separate the sidebar from one opaque workspace surface, using neutral borders and restrained elevation.
- Use a generated pearl material asset, encoded as a 40 KB WebP; drift the composited background and light wash without React animation state.
- Keep one featured record and a flat recent list; collapse to a full-width feature when there are no other records.
- Use open navigation shortcuts, lighter heading weights and filename typography. Preserve AI provenance and functional paragraph numbers.
- Retain shared button light, press, keyboard focus, disabled and reduced-motion behavior.

## Verification

Inspect populated and empty overviews, paper reading, desktop and mobile screenshots before accepting visual baselines. Check responsive overflow, independent reader scrolling, account isolation, keyboard drawer behavior and reduced motion with the existing suite. No data model or API changes are planned.

The first full run exposed a pending Next image-optimizer request for the new homepage preview. The preview is now a pre-encoded WebP loaded directly with `unoptimized`; the existing homepage checks require successful image decoding. A complete rerun passed 45/45. Visual review also caught workspace container coverage, a legacy narrow-screen navigation rule and the nickname input boundary; these were corrected and checked separately.

Final review replaced unmatched reader selectors with the actual journal filename and editable-title selectors, and scoped the privacy notice to override the existing index rule. The affected UI and paper suite passed 27/27 without retries; the paper screenshot was refreshed and visually reviewed.
