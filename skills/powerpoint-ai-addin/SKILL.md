---
name: powerpoint-ai-addin
description: Build and iterate on an AI-powered Microsoft PowerPoint Office Add-in (Task Pane) using React + TypeScript + Office.js + Fluent UI, with a backend proxy (Node/Express) to call Anthropic Claude and handle API keys, rate limiting, and caching. Use when implementing features like idea-to-slides generation, slide creation via PowerPoint.run, research assistant, theme/color management, speaker notes export, manifest configuration, and project scaffolding for a PowerPoint add-in.
---

# PowerPoint AI Add-in

## Overview

Implement the PowerPoint AI add-in described in `references/powerpoint-ai-addin-spec.md`: a React task pane that turns rough ideas into a structured deck, creates slides via Office.js, and uses a backend proxy for all AI calls.

## Workflow

### 0) Read the spec and pick scope

1. Read `references/powerpoint-ai-addin-spec.md`.
2. Confirm the target phase/scope:
   - Phase 1: outline + slide creation + theme
   - Phase 2: research assistant
   - Phase 3: theme/color system
   - Phase 4: UX polish
   - Phase 5: testing + deployment

### 1) Scaffold the Office Add-in project (frontend)

Prefer Yeoman `generator-office` to generate a **PowerPoint Task Pane** add-in in **TypeScript**.

If operating on Windows, run the commands in `scripts/scaffold_frontend.ps1` (or execute them manually) to:
- install `yo` + `generator-office`
- generate the project
- add dependencies (React, Fluent UI, Zustand, Axios)

Minimum structure to converge to (match spec; do not over-engineer):

- `src/taskpane/components/`
- `src/taskpane/services/`
- `src/taskpane/store/`
- `src/taskpane/types/`
- `src/taskpane/utils/`

### 2) Add the backend proxy (required for security)

Do not call Anthropic directly from the task pane. Implement a small Node/Express backend that:
- stores API keys in env vars
- exposes minimal endpoints (e.g., `/api/outline`, `/api/research`, `/api/enhance-slide`)
- applies rate limiting
- optionally caches responses

Keep backend in `backend/` per spec.

### 3) Implement core services (frontend)

Implement services as thin, testable modules:

- `AIService`:
  - call backend endpoints (not Anthropic)
  - define types: `PresentationOutline`, `SlideStructure`, `ColorScheme`, `UserPreferences`
  - provide parsers/validators for JSON responses

- `PowerPointService`:
  - implement slide creation via `PowerPoint.run(async (context) => { ... })`
  - batch operations and call `context.sync()` only when needed
  - map `slideType` → layout behavior (title/content/comparison/image/quote)
  - set fonts/positions with conservative defaults (Calibri, title 32, body 18, etc.)

- `ResearchService`:
  - call backend to research topic and return slide-ready structured data

### 4) Implement UI (task pane)

Build UI in React with Fluent UI:

- `IdeaInputPanel`: multiline input + generate button + progress indicator
- `SlidePreview`: list of generated slide titles/types; enable edit/reorder later

Keep state in Zustand:
- store services, preferences, outline, status flags, errors

### 5) Quality, safety, and error handling

- Handle API failures gracefully (show error + allow retry)
- Validate AI output (ensure JSON parse; enforce max bullets; strip unsafe HTML)
- Never log secrets
- Ensure manifest permissions are correct (`ReadWriteDocument`)

## Conventions / Guardrails

- Use TypeScript strictly (`strict: true`).
- Prefer small, composable modules; avoid “god services”.
- Keep Office.js calls inside `PowerPoint.run`; do not leak `context` outside.
- Add a backend even for local dev; treat it as mandatory.

## References

- Primary spec: `references/powerpoint-ai-addin-spec.md`
