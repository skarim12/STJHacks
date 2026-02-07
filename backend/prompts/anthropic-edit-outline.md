# Anthropic Prompt — Edit Existing Outline

## Endpoint
- `POST /api/edit-outline`

## Purpose
Apply a natural-language edit instruction to an existing outline JSON.

## Hard rules
- Return **STRICT JSON only** with the **same schema** as the outline.
- Preserve slide ordering and count unless explicitly instructed.
- Preserve existing content unless explicitly instructed.
- No markdown/code fences.
