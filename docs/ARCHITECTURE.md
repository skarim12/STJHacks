# Architecture

This repository is a **production-ready demo** for AI-driven PowerPoint deck generation.

## Runtime (dev)

Startup is intentionally stable and unchanged:
- `python run_dev.py` starts:
  - UI dev server: `powerpoint-ai-addin` (webpack-dev-server)
  - Backend: `powerpoint-ai-addin/backend` (Express)

The web demo is served from the same UI server:
- `/taskpane.html` (Office add-in taskpane)
- `/web.html` (web demo)

## Data flow

1. UI calls backend generation endpoint (SSE streaming)
2. Backend orchestrator runs stages:
   - outline → visual intent → assets → style → layout → QA → auto-repair (if needed)
3. Backend stores deck in memory (`DeckStore`)
4. UI fetches deck JSON and renders preview from `layoutPlan`
5. Exporter produces PPTX from deck JSON

## Key invariants
- `layoutPlan` uses inches for a 16:9 slide (`13.333 x 7.5`).
- When AI layout fails QA, deterministic templates are applied.
- Repairs are deterministic where possible; AI is optional.
