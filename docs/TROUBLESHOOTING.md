# Troubleshooting

## Ports in use
`run_dev.py` will auto-pick ports in a range. If a port is busy, stop the owning process.

## PowerShell npm.ps1 blocked
Use:
- `& "C:\Program Files\nodejs\npm.cmd" ...`

## Mixed content / HTTPS
Office add-ins require HTTPS. The UI dev server supports HTTPS if Office dev certs exist.

## Images not appearing in PowerPoint
Common causes:
- image too large (base64 payload)
- SVG assets (prefer raster thumbs)
- blocked/mixed content in add-in environment

Mitigations in this repo:
- prefer smaller Pexels renditions
- Wikimedia uses `thumburl` (raster)
- size caps in `assetFetch.ts`
