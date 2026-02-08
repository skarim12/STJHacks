# SpeakerNotesAgent

**File:** `src/agents/speakerNotesAgent.ts`

## Purpose
Generate speaker notes with a consistent voice.

Rules:
- 2–5 sentences per slide
- explain the bullets
- add transitions
- do not invent contradictory claims

## Inputs
- `DeckSchema`

## Outputs
- `{ bySlideId: Record<string, string>, warnings }`

## Routes
- Deck: `POST /api/deck/:deckId/speaker-notes/generate`
- Single slide: `POST /api/deck/:deckId/slides/:slideId/speaker-notes/generate`

## Smart UI behavior
- If slide already has notes → regenerate only that slide
- If slide lacks notes → fill missing notes
