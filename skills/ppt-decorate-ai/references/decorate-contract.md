# Decorate contract (STJHacks)

## POST /api/decorate-outline

### Request
```json
{
  "outline": { "title": "...", "slides": [/*...*/] },
  "decoratePrompt": "Add relevant imagery to every slide with an image slot; keep consistent style.",
  "allowExternalImages": true,
  "allowGeneratedImages": true,
  "imageStyle": "photo"
}
```

### Response
```json
{
  "outline": {
    "layoutPlan": {"variant": "..."},
    "slides": [
      {
        "layoutPlan": {"variant": "content.splitRightHero"},
        "imageDataUri": "data:image/...",
        "stylePlan": { "shapes": [/*...*/] }
      }
    ]
  },
  "enrichment": {
    "imagesAdded": 5,
    "imagesBefore": 0,
    "imagesAfter": 5,
    "attempted": 6,
    "skipped": {"title":0,"alreadyHasImage":0,"notSelected":2,"noQuery":0},
    "perSlide": [
      {"index":3,"source":"wikipedia"},
      {"index":5,"source":"openai"},
      {"index":7,"source":"none","error":"wikimedia: ... | wikipedia: ... | openai: ..."}
    ]
  }
}
```

### Invariants
- Must not rewrite slide content.
- Must be deterministic for a given outline + prompt + toggles.
- Only fill images where the chosen layout reserves image space.
