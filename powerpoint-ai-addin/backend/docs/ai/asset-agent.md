# AssetAgent

**File:** `src/agents/assetAgent.ts`

## Purpose
Generate non-photo assets (diagrams/charts placeholders) and an `AssetManifest`.

## Inputs
- `slides: Slide[]`

## Outputs
- `{ assets: AssetManifest, warnings: string[] }`

## Notes
Photo selection is handled separately:
- Pexels (if `PEXEL_API`)
- Wikimedia Commons fallback
- OpenAI image fallback (if `API_KEY`)

## Failure modes
Should never crash deck generation; warnings only.
