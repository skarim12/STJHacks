# LLM Provider Policy

**File:** `src/services/llm.ts`

## Policy
- Primary: OpenAI if `API_KEY` is set.
- Fallback: Anthropic if `CLAUDE_API_KEY` is set.

The `llmGenerate()` function will:
1) call primary
2) if it fails, call fallback
3) if both fail, throw

## Relevant env vars
- `API_KEY` (OpenAI)
- `OPENAI_MODEL` (chat)
- `OPENAI_IMAGE_MODEL` (images)
- `CLAUDE_API_KEY`
- `CLAUDE_MODEL`

## JSON handling
`extractFirstJsonObject()` removes code fences and attempts to extract balanced JSON blocks.
