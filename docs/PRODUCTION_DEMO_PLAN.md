# Production-Ready Demo Plan (Web App + Robust PPTX Output)

**Target:** GitHub publishable repo that demonstrates a robust, professional-quality, end-to-end “prompt → deck → PPTX” system.

**Primary client:** Web app.

**Secondary clients (optional):** PowerPoint Office add-in (Office.js insertion), CLI.

---

## 0) Success criteria (what “production-ready demo” means)

A generated deck is considered **final-presentation quality** when it satisfies all of the following **automatically** (no manual fixes required for typical prompts):

### Output quality gates
- **No broken layouts**: no out-of-bounds boxes, no unintended overlaps.
- **Readable typography**: body text >= 14pt by default; titles >= 28pt; contrast passes.
- **Non-generic writing**: avoids filler phrases, uses action titles, consistent terminology.
- **Speaker notes**: present for every non-title slide (unless disabled), coherent talk track.
- **Visuals render in PowerPoint**: all image assets in final PPTX appear reliably.
- **Asset licensing tracked**: attribution + license captured for each external asset.

### Reliability gates
- **Deterministic fallbacks** at every stage (template-first layout, stock-first assets, repair loops).
- **Bounded costs**: configured “Fast/Balanced/Polished” modes.
- **Observable**: requestId, stage timings, warnings/errors surfaced to UI.
- **Reproducible**: export artifacts (deck JSON + QA report) stored with a run id.

---

## 1) Repo shape (publishable GitHub project)

We will evolve the current code into a monorepo-like structure. If staying single-repo without workspaces, still keep clear directories.

### Recommended layout

```
/ (repo root)
  README.md
  LICENSE
  .gitignore
  .env.example

  docs/
    PRODUCTION_DEMO_PLAN.md
    ARCHITECTURE.md
    API.md
    QUALITY_SYSTEM.md
    ASSET_LICENSING.md
    TROUBLESHOOTING.md

  apps/
    web/                  # new primary UI (React/Vite)
    backend/              # demo backend (Express)

  packages/
    schema/               # shared types + JSON schema
    core/                 # generation pipeline (stages, QA, repair)
    exporter-pptx/        # PPTX renderer
    renderer-preview/     # HTML/canvas preview renderer (optional)

  examples/
    prompts/
    golden-decks/
```

**Short-term (minimal disruption):**
- Keep existing `powerpoint-ai-addin/backend` as `apps/backend` and build the new web UI alongside it.

---

## 2) Web app user experience (demo-friendly, “works first time”)

### A) Primary flow
1. User enters a single prompt.
2. Optional advanced fields (collapsed by default):
   - audience, tone, duration, slide count, brand preset
   - include citations (research mode)
   - quality mode: Fast / Balanced / Polished
3. User clicks **Generate**.
4. UI shows streaming stage progress + warnings + a live deck preview.
5. User can:
   - export PPTX
   - edit a slide with natural language instruction
   - re-run “QA + Repair”

### B) Required web screens
- **Generate** page (wizard)
- **Run** page (SSE stream view: stages, warnings, artifacts)
- **Deck preview** (thumbnail grid + slide detail)
- **QA dashboard** (issues grouped by severity + suggested fixes)
- **Export** (PPTX download, plus citations/license report download)

### C) Web app files (minimum)

`apps/web/`
- `src/pages/Generate.tsx`
- `src/pages/Run.tsx`
- `src/components/StreamProgress.tsx`
- `src/components/DeckGrid.tsx`
- `src/components/SlideDetail.tsx`
- `src/components/QaPanel.tsx`
- `src/services/api.ts` (REST)
- `src/services/sse.ts` (EventSource/SSE)
- `src/state/useRunStore.ts` (Zustand or similar)

---

## 3) Backend: versioned API + robust pipeline

### A) API surface (v1)

**Deck generation**
- `POST /api/v1/deck/generate` → `{ deckId, deck, qa, warnings }`
- `POST /api/v1/deck/generate/stream` (SSE) → stage events

**Deck retrieval**
- `GET /api/v1/deck/:deckId`

**QA + Repair**
- `POST /api/v1/deck/:deckId/qa`
- `POST /api/v1/deck/:deckId/repair` (may iterate repair loop)

**Slide editing**
- `POST /api/v1/deck/:deckId/slides/:slideId/edit/stream` (SSE)

**Export**
- `GET /api/v1/export/pptx/:deckId`
- `GET /api/v1/export/report/:deckId` (QA + licensing/citations JSON)

**Assets**
- `POST /api/v1/assets/search`
- `POST /api/v1/assets/fetch` (downloads + normalizes + returns dataUri + provenance)

### B) Server files
`apps/backend/src/`
- `server.ts`
- `routes/v1/deck.ts`
- `routes/v1/deckStream.ts`
- `routes/v1/qa.ts`
- `routes/v1/repair.ts`
- `routes/v1/export.ts`
- `routes/v1/assets.ts`
- `middleware/requestId.ts`
- `middleware/errors.ts`
- `middleware/rateLimit.ts`
- `config/env.ts`

---

## 4) Professional pipeline: stages + QA + repair loops

### A) Stage breakdown

1) **NormalizeRequestStage**
- Derive slide count from duration/audience.
- Apply defaults.

2) **OutlineStage**
- Use narrative templates (pitch/training/report/plan).
- Output slide goals + slide types.

3) **ContentStage**
- Generate action titles first.
- Constrain bullets (3–6) and forbid fluff.
- Ensure per-slide objective is met.

4) **VisualIntentStage**
- Decide visual type (photo/diagram/chart/icon/none).
- Produce query terms.

5) **AssetStage**
- Provider chain: Stock → Wikimedia → AI fallback.
- Normalize/resize assets for PPT reliability.
- Track attribution/licensing.

6) **StyleStage**
- Prefer style presets + limited LLM tweaks.
- Enforce contrast/readability.

7) **LayoutStage (template-first)**
- Deterministic templates per slide type.
- AI can vary within safe ranges.
- Run text-fit and collision checks.

8) **SpeakerNotesStage**
- Generate talk track per slide.
- Enforce time-per-slide target.

9) **QAStage**
- Layout validity
- Density/verbosity
- Generic language
- Visual relevance
- Consistency

10) **RepairStage (1–3 iterations)**
- Map QA issues → targeted deterministic fix functions + limited LLM rewrites.
- Stop when thresholds pass.

### B) Core pipeline files
`packages/core/src/`
- `pipeline/generateDeck.ts`
- `pipeline/stages/*.ts`
- `qa/scoreDeck.ts`
- `qa/checks/overlaps.ts`
- `qa/checks/outOfBounds.ts`
- `qa/checks/fontTooSmall.ts`
- `qa/checks/bulletDensity.ts`
- `qa/checks/genericLanguage.ts`
- `repair/applyRepairs.ts`
- `layout/templates/*`
- `layout/fit/estimateText.ts`
- `layout/fit/fitText.ts`

---

## 5) Layout robustness (the #1 differentiator)

### A) Deterministic templates
Maintain a template library keyed by `(slideType, layout)`:
- title
- agenda
- section
- content (text-only)
- content + image
- two-column
- comparison table
- timeline/process
- quote
- summary/next steps

Templates define:
- a grid
- margins
- default font sizes
- box roles and priorities

### B) Text fit policy
When text doesn’t fit:
1. shrink body font within bounds
2. reduce bullet count (summarize)
3. split slide into two
4. fallback to text-only template (drop image) if necessary

**Never** silently produce 10pt text unless user opted in.

---

## 6) Images that always show up (PowerPoint realities)

### Rules
- Prefer raster images (JPG/PNG). Avoid SVG insertion into PPT unless rasterized.
- Cap payload sizes to avoid Office.js/PPTX issues.
- Normalize and cache images.

### Asset normalization
- Download
- Verify content-type
- Resize to sensible bounds (e.g., max 1600px on long edge)
- Convert WebP → PNG if needed
- Store with content hash in cache

Files:
- `packages/core/src/assets/normalizeImage.ts`
- `packages/core/src/assets/cache.ts`

---

## 7) Observability and demo polish

### Logging
- requestId on every request
- stage timing
- warnings collected and returned to UI

### SSE event contract
Events:
- `stage:start`
- `artifact`
- `warning`
- `stage:end`
- `done`
- `error`

Artifacts should be small summaries, not huge blobs, except when UI explicitly requests full deck.

---

## 8) Testing for “works first time”

### Golden test decks
- Keep 10–20 prompts in `examples/prompts/`
- For each prompt, store expected minimum QA thresholds.
- CI generates decks with a fixed seed/config and verifies:
  - export completes
  - QA passes
  - PPTX contains image parts when visuals requested

### Unit tests
- validators
- layout checks
- text fitting

---

## 9) Milestones (demo-first)

### Milestone 1: Web app + stable API (1–2 days)
- Create `apps/web`
- Wire to existing backend SSE endpoints
- Implement deck preview and export download

### Milestone 2: Quality gates + repair loop (2–4 days)
- Add QA checks for layout/density/generic language
- Add targeted repairs

### Milestone 3: Layout templates + text fit (3–6 days)
- Template-first layout
- Fit checks and split-slide

### Milestone 4: Asset normalization + license report (2–4 days)
- Normalize images
- Attribution report export

---

## 10) Immediate refactor steps from current state

1. Introduce `api/v1` routes without breaking existing demo routes.
2. Extract schema/types into a shared package (even if local initially).
3. Move generation logic into stage modules.
4. Build the web app as the primary demo UI.

---

## Appendix: “Fast/Balanced/Polished” modes (recommended defaults)

- **Fast**: 1 pass, minimal repairs, stock-first images, smaller model.
- **Balanced**: 1 repair loop, full QA.
- **Polished**: 2 repair loops, stricter QA, more rewrite passes.
