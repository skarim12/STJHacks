import { Router } from 'express';
import { runAgent } from '../agents/runAgent.js';
import { StylePresetZ } from '../agents/schemas.js';
import { extractFirstJsonObject, generateStylePresetLLM } from '../services/llm.js';

export const styleRouter = Router();

styleRouter.post('/generate', async (req, res) => {
  const deckTitle = String(req.body?.deckTitle ?? '').trim();
  const deckPrompt = String(req.body?.deckPrompt ?? '').trim();
  const designPrompt = String(req.body?.designPrompt ?? '').trim();
  const tone = String(req.body?.tone ?? '').trim() || undefined;
  const audience = String(req.body?.audience ?? '').trim() || undefined;

  if (!deckPrompt) return res.status(400).json({ success: false, error: 'Missing deckPrompt' });
  if (!designPrompt) return res.status(400).json({ success: false, error: 'Missing designPrompt' });

  try {
    const { raw, provider } = await generateStylePresetLLM({ deckTitle, deckPrompt, designPrompt, tone, audience });
    const json = extractFirstJsonObject(raw);

    const validated = await runAgent({ name: 'StyleAgent', schema: StylePresetZ, run: async () => json });
    if (!validated.ok) {
      return res.status(502).json({ success: false, error: validated.error, issues: validated.issues, provider });
    }

    return res.json({ success: true, stylePreset: validated.value, provider });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? String(e) });
  }
});
