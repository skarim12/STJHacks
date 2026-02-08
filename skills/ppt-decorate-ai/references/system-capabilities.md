# System capabilities: decorate (STJHacks)

This doc enumerates what the decorate pipeline can do today.

## Inputs we can accept
- `outline` (deck JSON)
- `decoratePrompt` (deck-wide instruction)
- Image toggles:
  - `allowExternalImages` (Wikimedia/Wikipedia)
  - `allowGeneratedImages` (OpenAI)
  - `imageStyle`: `photo | illustration`
- Stored prompts on outline:
  - `outline.themePrompt`
  - `outline.decoratePrompt`

## Layout system (deterministic)

### Slide types
- `title | content | comparison | quote | imagePlaceholder`

### Layout plans
- Each slide gets `slide.layoutPlan.variant`.
- Variant names come from `backend/src/utils/layoutVariants.ts`.

### Boxes we render (kinds)
- `header`, `bulletsCard`, `statementCard`, `quoteCard`, `comparisonLeft`, `comparisonRight`, `accentBar`, `imageCard`, `fullBleedImage`

### Variety rules
- We use deterministic anti-repetition (avoid repeating the same variant too often).
- More variants = more composition variety; no randomness required.

## Image system

### When we attempt images
- We fill images only for slides whose chosen layout includes an image slot:
  - a box of kind `imageCard` or `fullBleedImage`.

### External sources (when enabled)
1) Wikimedia Commons file search
2) Wikipedia search → lead image
Constraints:
- Downloads only from `upload.wikimedia.org`.
- Descriptive User-Agent.
- Concurrency kept low; retry/backoff on 429.

### AI generation fallback (when enabled)
- OpenAI image generation (`gpt-image-1`) → base64 PNG data URI
- Prompt is slide-specific (deck title + slide title + describe + key bullets)
- Retries/backoff on transient errors

### Failure modes
- Commons/Wikipedia may return "no result".
- Wikimedia can rate-limit (429).
- OpenAI can fail with 400 if request/key/model is invalid.

## Style system (typography + shapes)

### SlideStylePlan fields (stored on slide)
- `slide.stylePlan.title/kicker/subtitle/body`: fontFace, fontSize, color, weight
- `slide.stylePlan.shapes`: array of subtle `rect` and `line` shapes with normalized coordinates

### Fonts we support (by design)
- `Calibri | Segoe UI | Arial`

### Deterministic fallback styling
- If AI returns empty, we still generate a deterministic stylePlan that varies:
  - fontFace (stable per slide)
  - body/title font sizes (based on content density)
  - accent vs secondary for small highlights

## PPTX parity priorities
- PPTX renderer draws explicit "cards" behind bullets/quotes/comparisons/statements.
- PPTX uses layout boxes from layoutPlan.

## What decorate cannot do yet
- True semantic image matching (we are improving prompts/sources, but not guaranteed perfect relevance).
- Complex per-slide illustrations beyond OpenAI generation.
- Full template-level master slides.
