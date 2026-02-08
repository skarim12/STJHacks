# Asset licensing & attribution

This demo attempts to always track attribution for external assets.

## Where attribution lives

Resolved visuals are stored on each slide:
- `slide.selectedAssets[]`
  - `sourceUrl`
  - `attribution`
  - `license`
  - `altText`

## Exportable report

Download:
- `GET /api/export/report/:deckId`

This returns QA plus a flattened list of per-slide asset attributions.

## Notes

- Pexels images are governed by the Pexels license.
- Wikimedia assets should include license/artist metadata when available.
