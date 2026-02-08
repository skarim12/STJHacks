# RenderPlanAgent

**File:** `src/agents/renderPlanAgent.ts`

## Purpose
Pick a high-level template per slide (TITLE_LEFT_VISUAL_RIGHT, SECTION_SPLASH, etc.).

This is currently heuristic-based and mainly used as metadata.

## Inputs
- slides

## Outputs
- `RenderPlan`

## Suggested improvements
- Make this LLM-backed with strict template + variant enums
- Tie it to LayoutPlanAgent (layout families) so it meaningfully affects positions
