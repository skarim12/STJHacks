# OutlineAgent

**File:** `src/agents/outlineAgent.ts`

## Purpose
Generate the initial *slide-ready* deck structure from a user prompt.

This is the most important agent for content quality: if it outputs generic placeholders, everything downstream looks empty.

## Inputs
- `DeckGenerationRequest` (`src/types/deck.ts`)
  - `prompt` (required)
  - optional: `targetAudience`, `tone`, `slideCount`

### Slide count policy
- If the **prompt explicitly requests** a slide count (e.g. "10 slides"), follow it.
- Otherwise, the model chooses an appropriate count.
- Safety cap is applied server-side (currently clamped to max 30).

## Outputs
Returns `{ title, slides }` where slides validate against `SlideZ` (`src/agents/schemas.ts`).

Each slide must include:
- `id`, `order`, `slideType`, `layout`, `title`
- `speakerNotes` (required by prompt; validated indirectly)
- `bullets` or `bodyText` for non-title slides

## Key constraints (OpenClaw-style)
- NO placeholder bullets ("Key point", "Supporting detail", etc.)
- Bullets should be *concrete* and not always exactly 3
- Bullets should be short (<= ~14 words)
- Speaker notes: 2–5 sentences, with transitions

## Failure modes
- LLM returns invalid JSON → extraction fails → agent falls back to a deterministic template.
- LLM returns placeholder-y content → agent rejects and falls back.

## Suggested improvements
- Add an explicit `intent` field to slides (problem/solution/metrics/etc.) to guide visuals/layout.
- Add a “repair loop” when output fails QA (not yet implemented here; can be added in orchestrator).
