# Wikimedia Commons — Image Search

## Used by
- `backend/src/utils/externalImages.ts`

## Purpose
Find a relevant public image for a slide without needing custom scraping.

## Approach
- Use MediaWiki API (`commons.wikimedia.org/w/api.php`) to search File: namespace
- Then download the direct image URL

## Guardrails
- Only allow downloads from `upload.wikimedia.org`
- Embed as `data:` URI for deterministic PDF rendering
- Size caps (bytes) and caching (24h)
- Must be explicitly enabled via `allowExternalImages: true`
