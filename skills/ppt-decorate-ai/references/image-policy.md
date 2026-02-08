# Image policy

## Sources
- External images are allowed only when explicitly enabled.
- Wikimedia/Wikipedia downloads must be from `upload.wikimedia.org`.
- Always set a descriptive `User-Agent`.

## Rate limiting
- Wikimedia can return 429.
- Keep concurrency low (1) when external images are enabled.
- Use retry/backoff on 429.

## AI generation fallback
- Use OpenAI only when explicitly enabled.
- Prefer slide-specific prompts (deck title + slide title + key bullets).
- No text/logos/watermarks.

## Determinism
- No randomness.
- Cache results by prompt to stabilize repeats.
