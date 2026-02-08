# API

Base path: `/api`

## v0 (current)

### Generation
- `POST /api/deck/generate`
- `POST /api/deck/generate/stream` (SSE)

### Deck
- `GET /api/deck/:deckId`
- `POST /api/deck/:deckId/qa/run`
- `POST /api/deck/:deckId/improve`
- `POST /api/deck/:deckId/repair`

### Export
- `GET /api/export/pptx/:deckId`
- `GET /api/export/report/:deckId` (QA + asset attribution)

## v1 (compat)

Mounted as aliases to the same handlers:
- `/api/v1/deck/*`
- `/api/v1/assets/*`
- `/api/v1/style/*`
- `/api/v1/export/*`
- `/api/v1/upload/*`
