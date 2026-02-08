---
name: ppt-decorate-ai
description: Add final-pass deck decoration from a natural-language prompt for the STJHacks PowerPoint AI backend. Use when implementing or debugging the decorate pipeline (/api/decorate-outline): pick layouts, fill images for slides with image slots, generate subtle shapes/typography via stylePlan, and ensure PPTX export matches the decorated HTML/PDF as closely as possible.
---

# ppt-decorate-ai

Turn an outline into a **presentation-quality** deck via a deterministic decorate pass.

## Workflow (decorate pipeline)

### 1) Lock layouts first
- Run `enrichOutlineWithLayouts(outline, ...)`.
- Treat `layoutPlan.variant` as the contract used by **both** HTML and PPTX renderers.

### 2) Decide which slides "need images"
Only slides whose chosen layout includes an image slot:
- `imageCard` or `fullBleedImage` in `layoutVariants`.

### 3) Fill images (with fallbacks)
- Prefer external sources when explicitly enabled:
  1) Wikimedia Commons file search
  2) Wikipedia page → lead image
- If no external image found and AI generation is enabled:
  3) OpenAI image generation
- Keep concurrency conservative to avoid 429 rate limits.

### 4) Add subtle decoration
- Run `enrichOutlineWithStyles(outline, ...)` to populate `slide.stylePlan`:
  - typography tweaks (Calibri/Segoe UI/Arial only)
  - subtle shape accents (rect/line) that avoid text boxes
- Feed `themePrompt` and `decoratePrompt` into the stylist so it can stay coherent.

### 5) Verify renderer parity (PPTX is priority)
- PPTX must render using `layoutPlan` + `stylePlan`.
- If HTML looks good but PPTX is worse: fix `backend/src/utils/pptx.ts` to match the grid + spacing.

## API
- `POST /api/decorate-outline` returns `{ outline, enrichment }`.
- `enrichment` must be used as diagnostics (attempted/skipped/provider errors).

## References
- Read `references/decorate-contract.md` for pipeline + invariants.
- Read `references/image-policy.md` for external image rules and rate-limit handling.
