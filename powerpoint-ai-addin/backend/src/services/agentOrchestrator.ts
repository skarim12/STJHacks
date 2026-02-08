import type { DeckGenerationRequest, DeckGenerationResponse, DeckSchema, ThemeTokens } from '../types/deck.js';
import { newId } from '../utils/id.js';
import { OutlineAgent } from '../agents/outlineAgent.js';
import { VisualIntentAgent } from '../agents/visualIntentAgent.js';
import { AssetAgent } from '../agents/assetAgent.js';
import { RenderPlanAgent } from '../agents/renderPlanAgent.js';
import { DeckSchemaZ } from '../agents/schemas.js';
import { runAgent } from '../agents/runAgent.js';
import { pickBestPhoto, searchPexelsPhotos } from './pexels.js';
import { fetchImageAsDataUri } from './assetFetch.js';

const DEFAULT_THEME: ThemeTokens = {
  primaryColor: '220 70% 50%',
  secondaryColor: '220 15% 40%',
  accentColor: '35 90% 55%',
  backgroundColor: '220 15% 98%',
  textColor: '220 15% 15%',
  fontHeading: 'Segoe UI',
  fontBody: 'Segoe UI',
  fontSize: 'medium'
};

/**
 * Orchestrator (OpenClaw-style): runs agents and validates outputs.
 */
export const generateDeckWithAgents = async (req: DeckGenerationRequest): Promise<DeckGenerationResponse> => {
  const warnings: string[] = [];
  const now = new Date().toISOString();

  // 1) Outline
  const outline = await OutlineAgent.run(req);
  const slides = outline.slides;

  // 2) Visual intent + placeholders
  for (const s of slides) {
    s.visualIntent = VisualIntentAgent.run(req, s);
    VisualIntentAgent.attachPlaceholder(s);
  }

  // 3) Assets (diagrams/charts now; stock photos/icons can be auto-selected)
  const assetOut = AssetAgent.run(slides);
  warnings.push(...assetOut.warnings);

  // Phase C: auto-select stock photos for slides that want them (stock preferred)
  // Keep API usage bounded for demos.
  const MAX_AUTO_PHOTOS = 3;
  let autoCount = 0;

  for (const s of slides) {
    if (autoCount >= MAX_AUTO_PHOTOS) break;
    if (s.visualIntent?.visualType !== 'photo') continue;

    const query = (s.visualIntent.queryTerms?.join(' ') || `${outline.title} ${s.title}`).trim();

    try {
      const results = await searchPexelsPhotos(query, 6);
      const best = pickBestPhoto(results);
      if (!best) {
        warnings.push(`No stock photo results for slide "${s.title}" (query: ${query}).`);
        continue;
      }

      const fetched = await fetchImageAsDataUri(best.downloadUrl);

      s.selectedAssets = [
        ...(s.selectedAssets ?? []).filter((a) => a.kind !== 'photo'),
        {
          kind: 'photo',
          dataUri: fetched.dataUri,
          sourceUrl: best.sourceUrl ?? best.downloadUrl,
          attribution: best.attribution,
          license: best.license,
          altText: best.altText
        }
      ];

      autoCount++;
    } catch (e: any) {
      warnings.push(`Auto photo select failed for slide "${s.title}": ${e?.message ?? String(e)}`);
    }
  }

  // 4) Render plan
  const renderPlan = RenderPlanAgent.run(slides);

  const deck: DeckSchema = {
    id: newId('deck'),
    title: outline.title,
    description: req.prompt,
    theme: { ...DEFAULT_THEME, ...(req.theme ?? {}) },
    slides,
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      targetAudience: req.targetAudience,
      estimatedDuration: slides.length * 2
    }
  };

  // Validate final deck contract
  const validated = await runAgent({ name: 'Orchestrator.deck', schema: DeckSchemaZ, run: async () => deck });
  if (!validated.ok) {
    return { success: false, error: validated.error, warnings: ['Deck validation failed'] };
  }

  return {
    success: true,
    deck: validated.value,
    assets: assetOut.assets,
    renderPlan,
    warnings: warnings.length ? warnings : undefined
  };
};
