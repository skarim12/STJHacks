# Anthropic Prompt — Fact Check

## Endpoint
- `POST /api/fact-check`

## Purpose
Given a claim, return STRICT JSON:
```json
{
  "claim": "string",
  "verdict": "true" | "false" | "uncertain",
  "explanation": "string",
  "sources": ["string"]
}
```

## Rules
- JSON only. No markdown.
- If uncertain, say uncertain and explain why.
