# API contract: theme

## POST /api/theme-from-prompt

### Request
```json
{
  "outline": { "title": "...", "slides": [/*...*/] },
  "themePrompt": "Dark fintech: navy bg, cyan accent, angular ribbons, subtle grid."
}
```

### Response
```json
{
  "outline": {
    "look": "dark",
    "themeStyle": { "mood": "serious", "background": "solid", "panels": "glass", "contrast": "high" },
    "colorScheme": {
      "primary": "#...",
      "secondary": "#...",
      "accent": "#...",
      "background": "#...",
      "text": "#..."
    },
    "themePrompt": "...",
    "slides": [/* unchanged content */]
  }
}
```

### Invariants
- Do not change slide count/order.
- Do not regenerate slide titles/bullets.
- Must be deterministic post-processing (validation + enforcement).
