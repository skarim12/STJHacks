---
name: ppt-theme-ai
description: Create and apply deck-wide presentation themes from a natural-language prompt (background/panels/accents/mood) for the STJHacks PowerPoint AI backend. Use when adding or improving theme generation endpoints (/api/theme-from-prompt), validating themeStyle/colorScheme, enforcing contrast/coherence, or wiring main-panel text-box theme controls.
---

# ppt-theme-ai

Generate a coherent **deck-wide theme** from a single text prompt and apply it deterministically.

## Workflow

### 1) Decide what the user wants
- Parse the user prompt into: vibe (mood), background treatment, panel treatment, accent behavior.
- Keep it **PPT-friendly** (solid/subtle gradient, high contrast, no external fonts).

### 2) Call the backend theme endpoint (preferred)
- Endpoint: `POST /api/theme-from-prompt`
- Input: `{ outline, themePrompt }`
- Output: `{ outline }` (with updated `look`, `themeStyle`, `colorScheme`, and `themePrompt` stored for later)

### 3) Enforce safety + coherence
Always run `enforceThemeStyle(outline)` after applying theme output.
- Validate allowed enum values for `themeStyle`.
- Normalize hex colors.
- Enforce minimum contrast (4.5 or 7.0 when high-contrast).

### 4) Apply across renderers
- HTML/PDF: theme is read from `outline.colorScheme` + `outline.themeStyle`.
- PPTX: ensure background fill + accent colors use the same scheme.

## Output rules (important)
- Deterministic: no randomness.
- Prefer subtle shapes and safe colors.
- Do not rewrite slide content.

## References
- Read `references/system-capabilities.md` for what the system can actually control today.
- Read `references/theme-schema.md` for the exact schema + constraints.
- Read `references/api-contract.md` for endpoint payloads and expected response shapes.
