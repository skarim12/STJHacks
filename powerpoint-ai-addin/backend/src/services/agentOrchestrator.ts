import type { DeckGenerationRequest, DeckGenerationResponse, DeckSchema, ThemeTokens } from '../types/deck.js';
import { newId } from '../utils/id.js';
import { OutlineAgent } from '../agents/outlineAgent.js';
import { VisualIntentAgent } from '../agents/visualIntentAgent.js';
import { AssetAgent } from '../agents/assetAgent.js';
import { RenderPlanAgent } from '../agents/renderPlanAgent.js';
import { DeckSchemaZ, StylePresetZ } from '../agents/schemas.js';
import { runAgent } from '../agents/runAgent.js';
import { pickBestPhoto, searchPexelsPhotos } from './pexels.js';
import { fetchImageAsDataUri } from './assetFetch.js';
import { extractFirstJsonObject, generateStylePresetLLM } from './llm.js';

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
  // User requested: allow as many selections as needed (no global cap).
  for (const s of slides) {
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

      // no global cap
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

  // Style presets (fallback + baseline)
  const fallbackStylePresets = [
    {
      id: 'style-modern',
      name: 'Modern Blue',
      theme: { ...DEFAULT_THEME, primaryColor: '220 70% 50%', accentColor: '35 90% 55%', backgroundColor: '220 15% 98%' },
      decoration: {
        backgroundStyle: 'softGradient' as const,
        cornerBlobs: true,
        headerStripe: false,
        cardStyle: 'softShadow' as const,
        imageTreatment: 'rounded' as const,
        gradientCss: 'linear-gradient(135deg, hsl(220 70% 50% / 0.18) 0%, hsl(195 85% 55% / 0.10) 45%, hsl(220 15% 98% / 1) 100%)'
      }
    },
    {
      id: 'style-warm',
      name: 'Warm Minimal',
      theme: { ...DEFAULT_THEME, primaryColor: '18 85% 55%', accentColor: '45 95% 55%', backgroundColor: '30 30% 98%' },
      decoration: {
        backgroundStyle: 'solid' as const,
        cornerBlobs: false,
        headerStripe: true,
        cardStyle: 'flat' as const,
        imageTreatment: 'rounded' as const,
        gradientCss: 'linear-gradient(180deg, hsl(30 30% 98%) 0%, hsl(30 30% 99%) 100%)'
      }
    },
    {
      id: 'style-dark',
      name: 'Dark Punchy',
      theme: {
        ...DEFAULT_THEME,
        primaryColor: '210 90% 60%',
        accentColor: '290 85% 60%',
        backgroundColor: '220 20% 12%',
        textColor: '0 0% 98%'
      },
      decoration: {
        backgroundStyle: 'boldGradient' as const,
        cornerBlobs: false,
        headerStripe: true,
        cardStyle: 'softShadow' as const,
        imageTreatment: 'square' as const,
        gradientCss: 'linear-gradient(135deg, hsl(220 20% 12%) 0%, hsl(290 85% 60% / 0.22) 50%, hsl(210 90% 60% / 0.18) 100%)'
      }
    },
    {
      id: 'style-green',
      name: 'Fresh Green',
      theme: { ...DEFAULT_THEME, primaryColor: '145 70% 40%', accentColor: '195 85% 50%', backgroundColor: '160 25% 98%' },
      decoration: {
        backgroundStyle: 'softGradient' as const,
        cornerBlobs: true,
        headerStripe: true,
        cardStyle: 'flat' as const,
        imageTreatment: 'rounded' as const,
        gradientCss: 'linear-gradient(135deg, hsl(160 25% 98%) 0%, hsl(195 85% 50% / 0.12) 55%, hsl(145 70% 40% / 0.12) 100%)'
      }
    }
  ];

  // Always use an agent when possible: attempt LLM style generation.
  const defaultDesignPrompt =
    'Modern clean, high contrast, subtle gradients, minimal cards, hackathon demo aesthetic; ensure readability.';

  let agentStylePreset: any | null = null;
  try {
    const { raw, provider } = await generateStylePresetLLM({
      deckTitle: outline.title,
      deckPrompt: req.prompt,
      designPrompt: req.designPrompt?.trim() || defaultDesignPrompt,
      tone: req.tone,
      audience: req.targetAudience
    });
    const json = extractFirstJsonObject(raw);

    // Normalize a bit to reduce schema failures
    if (!json.id) json.id = `style-${newId('s')}`;
    if (!json.name) json.name = 'AI Design';

    const validatedStyle = await runAgent({ name: 'StyleAgent.inline', schema: StylePresetZ, run: async () => json });
    if (validatedStyle.ok) {
      agentStylePreset = validatedStyle.value;
      (agentStylePreset as any).provider = provider;
    } else {
      warnings.push('StyleAgent failed validation; using fallback styles.');
    }
  } catch (e: any) {
    warnings.push(`StyleAgent failed; using fallback styles: ${e?.message ?? String(e)}`);
  }

  const stylePresets = agentStylePreset ? [agentStylePreset, ...fallbackStylePresets] : fallbackStylePresets;
  const recommendedStyleId = (agentStylePreset?.id ?? fallbackStylePresets[0].id) as string;

  // Apply recommended theme + decoration immediately
  const recPreset = stylePresets.find((s: any) => s.id === recommendedStyleId);
  if (recPreset?.theme) {
    deck.theme = { ...deck.theme, ...recPreset.theme };
  }
  if (recPreset?.decoration) {
    (deck as any).decoration = recPreset.decoration;
  }

  // Validate final deck contract AFTER applying style/decoration
  const validated = await runAgent({ name: 'Orchestrator.deck', schema: DeckSchemaZ, run: async () => deck });
  if (!validated.ok) {
    return { success: false, error: validated.error, warnings: ['Deck validation failed'] };
  }

  return {
    success: true,
    deck: validated.value,
    stylePresets,
    recommendedStyleId,
    assets: assetOut.assets,
    renderPlan,
    warnings: warnings.length ? warnings : undefined
  };
};
