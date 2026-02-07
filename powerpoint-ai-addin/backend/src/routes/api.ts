import { Router } from 'express';

export const apiRouter = Router();

// NOTE: Stub implementation. Next step is to call Claude via Anthropic SDK/API.
apiRouter.post('/outline', async (req, res) => {
  const idea = String(req.body?.idea ?? '').trim();
  if (!idea) return res.status(400).json({ error: 'Missing idea' });

  // Minimal deterministic outline so the UI wiring works end-to-end.
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
