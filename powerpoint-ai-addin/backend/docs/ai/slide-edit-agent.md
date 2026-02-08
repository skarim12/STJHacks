# SlideEditAgent

**File:** `src/agents/slideEditAgent.ts`

## Purpose
Apply an edit instruction to a single slide using a patch-based contract.

This is used by:
- `POST /api/deck/:deckId/slides/:slideId/ai-edit`

## Inputs
- `slideId`
- current slide JSON
- `instruction` string
- optional existing patch

## Outputs
- `{ patch, warnings }`

## Notes
Should preserve slideId/order and only modify allowed fields.
