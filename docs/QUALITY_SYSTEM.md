# Quality system

The demo targets "works first time" by combining:

- **QA checks** (`backend/src/services/deckQa.ts`)
  - layout bounds
  - overlaps
  - small fonts
  - missing image when image box exists
  - density heuristics
  - speaker notes presence

- **Auto-repair during generation** (`backend/src/services/agentOrchestrator.ts`)
  - apply deterministic fallback templates to failing slides
  - optionally split dense slides

- **Manual repair endpoint** (`POST /api/deck/:deckId/repair`)
  - deterministic clamps
  - speaker notes fill
  - layout regeneration and sanitization

## Philosophy

Prefer deterministic repairs and stable templates over repeated LLM retries.
