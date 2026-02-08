# ContentRefinementAgent

**File:** `src/agents/contentRefinementAgent.ts`

## Purpose
Second-pass editor. Takes an already generated deck and improves it:
- assertion-based titles
- more specific bullets (examples/metrics)
- varied bullet counts (avoid uniform 3)
- improved speaker notes with transitions

## Inputs
- `DeckSchema` (full deck JSON)

## Outputs
- `{ patches: [{ slideId, title?, bullets?, bodyText?, speakerNotes? }], warnings }`

Patches are applied in `POST /api/deck/:deckId/improve` and also in the orchestrator when it detects uniform bullet counts.

## Failure modes
- LLM fails → returns empty patches + warnings.

## Notes
This agent should not change slide count or slideIds.
