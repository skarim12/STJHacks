# OpenAI Prompt — Slide Image Generation

## Used by
- `backend/src/utils/imageGeneration.ts`

## Provider
- OpenAI Images API
- Env var: `API_KEY`

## Purpose
Generate a **single** slide-safe image that can be embedded as a `data:image/png;base64,...` URI.

## Prompt guidelines
- No text in the image.
- 16:9-friendly composition.
- High contrast, presentation-safe.
- Style variants:
  - `illustration`: clean vector-like illustration
  - `photo`: photo-real look

## Safety/guardrails
- Backend caches by prompt for 24h.
- Caller must explicitly enable generation via `allowGeneratedImages: true`.
