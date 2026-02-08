# System capabilities: theming (STJHacks)

This doc is the ground truth for what our system can and cannot do today.

## What the theme system can control

### Deck-level fields (stored on outline)
- `outline.look`: `default | light | dark | bold`
- `outline.themeStyle`:
  - `mood`: `calm | energetic | serious | playful`
  - `background`: `solid | subtleGradient`
  - `panels`: `glass | flat`
  - `contrast`: `auto | high`
- `outline.colorScheme` (hex-only):
  - `primary`, `secondary`, `accent`, `background`, `text`
- `outline.themePrompt`: text prompt used to generate theme (kept for later decoration/styling)

### Enforcement / validation (always run)
`enforceThemeStyle(outline)`:
- Normalizes missing/partial themeStyle.
- Normalizes colors to `#rrggbb`.
- Enforces minimum contrast between `background` and `text`.

## What theme currently affects (renderers)

### HTML/PDF renderer
- Background color/gradient mode (via `themeStyle.background`).
- Card/panel appearance (via `themeStyle.panels`).
- Accent elements (bars/underlines/shapes) (via `colorScheme.accent/secondary`).

### PPTX renderer
- Slide background fill uses `colorScheme.background`.
- Card/panel rendering exists (rounded rectangles) for most content boxes.
- Decorative shapes from `slide.stylePlan.shapes` render behind content.

## What theme does NOT do yet (future work)
- True per-deck asset packs (logos, templates).
- Complex gradients/noise textures in PPTX.
- Fully custom fonts (we prefer system fonts only).

## Prompt guidance
Good theme prompts specify:
- industry vibe + brightness (light/dark)
- 1–2 accent colors
- shape motif keywords: `ribbons`, `grid dots`, `corner frames`, `soft blobs`, `diagonal cuts`
- constraints: `high contrast`, `minimal`, `no external fonts`

Bad prompts are too abstract: "make it cool".
