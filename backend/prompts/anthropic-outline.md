# Anthropic Prompt — Generate Presentation Outline

## Endpoint
- `POST /api/outline`

## Purpose
Generate a full presentation outline as **STRICT JSON**.

## Output schema (must be valid JSON)
```json
{
  "title": "string",
  "overallTheme": "string",
  "colorScheme": {
    "primary": "string",
    "secondary": "string",
    "accent": "string",
    "background": "string",
    "text": "string"
  },
  "slides": [
    {
      "title": "string",
      "slideType": "title" | "content" | "comparison" | "image" | "quote",
      "content": ["string"],
      "notes": "string",
      "suggestedLayout": "string"
    }
  ]
}
```

## Hard rules
- Return **JSON only**. No markdown. No code fences.
- Keep bullets slide-ready.
- Avoid overly long notes (they inflate token usage and can cause truncation).

## Notes
- Backend sets `max_tokens` high (8192) and does one retry with `temperature=0` if output is invalid/truncated.
