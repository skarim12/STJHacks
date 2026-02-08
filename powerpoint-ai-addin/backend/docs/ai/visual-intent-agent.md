# VisualIntentAgent

**File:** `src/agents/visualIntentAgent.ts`

## Purpose
Decide what kind of visual each slide should have and attach placeholders.

## Inputs
- `DeckGenerationRequest`
- individual `Slide`

## Outputs
- `slide.visualIntent` (type, goal, optional queryTerms)
- optionally `slide.imagePlaceholders` attached via `attachPlaceholder`

## How it’s used
Called in the orchestrator before asset selection.

## Failure modes
Should be deterministic and not require an API key. If it becomes LLM-backed, it must have a strict schema.

## Suggested improvements
- Make intents depend on slide `intent` field (problem/metrics/roadmap…)
- Add constraints: avoid faces/logos, prefer illustration vs photo, etc.
