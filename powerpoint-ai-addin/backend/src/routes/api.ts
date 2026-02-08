import { Router } from 'express';
import { deckRouter } from './deck.js';
import { assetsRouter } from './assets.js';
import { styleRouter } from './style.js';
import { exportRouter } from './export.js';

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
apiRouter.use('/assets', assetsRouter);
apiRouter.use('/style', styleRouter);
apiRouter.use('/export', exportRouter);
