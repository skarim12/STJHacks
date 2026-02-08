import { Router } from 'express';
import { deckRouter } from './deck.js';
import { deckExtrasRouter } from './deckExtras.js';
import { deckStreamRouter } from './deckStream.js';
import { assetsRouter } from './assets.js';
import { styleRouter } from './style.js';
import { exportRouter } from './export.js';
import { uploadRouter } from './upload.js';
import { speakerNotesRouter } from './speakerNotes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ ok: true }));

// Legacy endpoint retained for existing UI wiring.
apiRouter.post('/outline', async (req, res) => {
  const idea = String(req.body?.idea ?? '').trim();
  if (!idea) return res.status(400).json({ error: 'Missing idea' });

  return res.json({
    title: 'Generated Presentation',
    overallTheme: 'professional',
    colorScheme: {
      primary: '#2B579A',
      secondary: '#FFFFFF',
      accent: '#00B7C3',
      background: '#FFFFFF',
      text: '#1A1A1A'
    },
    slides: [
      { title: idea, slideType: 'title', content: [] },
      { title: 'Key Points', slideType: 'content', content: ['Point 1', 'Point 2', 'Point 3'] }
    ]
  });
});

// New agent-style deck pipeline (Phase A-D)
apiRouter.use('/deck', deckRouter);
apiRouter.use('/deck', deckExtrasRouter);
apiRouter.use('/deck', deckStreamRouter);
// Speaker notes regeneration lives under /api/deck/:deckId/speaker-notes/generate
apiRouter.use('/deck', speakerNotesRouter);
apiRouter.use('/assets', assetsRouter);
apiRouter.use('/style', styleRouter);
apiRouter.use('/export', exportRouter);
apiRouter.use('/upload', uploadRouter);

// Versioned API (v1) – non-breaking: mount the same handlers under /api/v1/*.
// This keeps current clients working while providing a stable surface for the web demo.
apiRouter.use('/v1/deck', deckRouter);
apiRouter.use('/v1/deck', deckExtrasRouter);
apiRouter.use('/v1/deck', deckStreamRouter);
apiRouter.use('/v1/deck', speakerNotesRouter);
apiRouter.use('/v1/assets', assetsRouter);
apiRouter.use('/v1/style', styleRouter);
apiRouter.use('/v1/export', exportRouter);
apiRouter.use('/v1/upload', uploadRouter);
