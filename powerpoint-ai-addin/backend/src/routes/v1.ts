import { Router } from 'express';

// Minimal versioned API surface (non-breaking): proxies to existing v0 routes.
// This keeps the demo stable while making the repo publishable and forward-compatible.

export const v1Router = Router();

// Health
v1Router.get('/health', (_req, res) => res.json({ ok: true, version: 'v1' }));

// Deck endpoints (proxy)
v1Router.use('/deck', async (req, res, next) => {
  // Rewrite /api/v1/deck/* -> /api/deck/* by delegating to the main router.
  // Express doesn't have a built-in rewrite here without extra deps,
  // so we rely on mounting v1Router UNDER /api and sharing the same deck routers.
  next();
});
