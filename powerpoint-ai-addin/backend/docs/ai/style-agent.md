# Style generation (StyleAgent.inline)

**Files:**
- generator: `src/services/llm.ts` (`generateStylePresetLLM`)
- validation: `src/agents/schemas.ts` (`StylePresetZ`)
- orchestrator integration: `src/services/agentOrchestrator.ts`

## Purpose
Generate a deck-wide theme and decoration tokens:
- HSL triplet colors
- fonts
- gradients
- card style

## Inputs
- deck title
- deck prompt
- optional designPrompt
- tone/audience

## Outputs
- `StylePreset` JSON
- `recommendedStyleId`

## Provider policy
Uses `llmGenerate` which prefers OpenAI (`API_KEY`) and falls back to Anthropic (`CLAUDE_API_KEY`).

## Failure modes
If style generation fails or fails zod validation, the system falls back to built-in presets.

## Suggested improvements
- Add typography scale + spacing tokens
- Add contrast QA and an automatic repair loop
