# LayoutPlanAgent

**File:** `src/agents/layoutPlanAgent.ts`

## Purpose
Generate a raw `layoutPlan` per slide: exact x/y/w/h in inches on a 16:9 slide.

This drives:
- PPTX export rendering (`src/routes/export.ts`)
- PowerPoint insertion placement (`src/taskpane/services/PowerPointService.ts`)

## Inputs
- `DeckSchema` (after style + visuals attached)

## Output
- `{ bySlideId: Record<string, SlideLayoutPlan>, warnings }`

`SlideLayoutPlan` schema:
- `version: '1.0'`
- `slideW: 13.333`, `slideH: 7.5`
- `boxes[]` where each box has:
  - kind: title|subtitle|bullets|body|image|shape
  - x,y,w,h in inches
  - optional text styling hints (fontSize/fontFace/color)

## Safety
The agent output is sanitized:
- clamp boxes within slide bounds
- clamp font size to [10..44]

## Failure modes
If this agent fails, deck generation continues with fallback layouts.

## Suggested improvements
- Add a deterministic overlap resolver
- Add a text-fit estimator + repair loop
- Add layout families/variants to increase variety
