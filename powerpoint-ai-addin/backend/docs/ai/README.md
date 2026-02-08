# AI Agents (PowerPoint AI Add-in Backend)

This folder documents each AI/agent component in the backend, OpenClaw-style:
- what it does
- inputs/outputs (schemas)
- provider/key requirements
- fallbacks and failure modes
- QA checks

## Agents (current)

- [OutlineAgent](./outline-agent.md)
- [ContentRefinementAgent](./content-refinement-agent.md)
- [VisualIntentAgent](./visual-intent-agent.md)
- [AssetAgent](./asset-agent.md)
- [Style generation (StyleAgent.inline)](./style-agent.md)
- [LayoutPlanAgent](./layout-plan-agent.md)
- [SpeakerNotesAgent](./speaker-notes-agent.md)
- [SlideEditAgent](./slide-edit-agent.md)
- [RenderPlanAgent](./render-plan-agent.md)

## Provider policy

Primary provider is OpenAI if `API_KEY` is set; fallback is Anthropic if `CLAUDE_API_KEY` is set. See `src/services/llm.ts`.

## Endpoints overview

- Generate deck (JSON): `POST /api/deck/generate`
- Generate deck (SSE stream): `POST /api/deck/generate/stream`
- Export PPTX: `GET /api/export/pptx/:deckId`
- Improve deck: `POST /api/deck/:deckId/improve`
- QA: `POST /api/deck/:deckId/qa/run`
- Speaker notes:
  - deck: `POST /api/deck/:deckId/speaker-notes/generate`
  - single slide: `POST /api/deck/:deckId/slides/:slideId/speaker-notes/generate`
