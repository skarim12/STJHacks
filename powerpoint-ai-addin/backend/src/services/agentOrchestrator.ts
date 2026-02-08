import type { DeckGenerationRequest, DeckGenerationResponse, DeckSchema, ThemeTokens } from '../types/deck.js';
import { newId } from '../utils/id.js';
import { OutlineAgent } from '../agents/outlineAgent.js';
import { VisualIntentAgent } from '../agents/visualIntentAgent.js';
import { AssetAgent } from '../agents/assetAgent.js';
import { RenderPlanAgent } from '../agents/renderPlanAgent.js';
import { LayoutPlanAgent } from '../agents/layoutPlanAgent.js';
import { DeckSchemaZ, StylePresetZ } from '../agents/schemas.js';
import { runAgent } from '../agents/runAgent.js';
import { pickBestPhoto, searchPexelsPhotos } from './pexels.js';
import { pickBestWikimediaImage, searchWikimediaCommonsImages } from './wikimedia.js';
import { fetchImageAsDataUri } from './assetFetch.js';
import { extractFirstJsonObject, generateStylePresetLLM } from './llm.js';
import type { Reporter } from './reporter.js';
import { safeReporter } from './reporter.js';
import { runDeckQa } from './deckQa.js';

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
export const generateDeckWithAgents = async (
  req: DeckGenerationRequest,
  reporter?: Reporter
): Promise<DeckGenerationResponse> => {
  const rep = safeReporter(reporter);
  const warnings: string[] = [];
  const now = new Date().toISOString();

  // 1) Outline
  rep.stageStart('outline');
  const outline = await OutlineAgent.run(req);
  const slides = outline.slides;
  rep.artifact('outline', 'slides', {
    title: outline.title,
    slideCount: slides.length,
    slideTitles: slides.map((s) => s.title)
  });
  rep.stageEnd('outline');

  // 2) Visual intent + placeholders
  rep.stageStart('visual_intent');
  for (const s of slides) {
    s.visualIntent = VisualIntentAgent.run(req, s);
    VisualIntentAgent.attachPlaceholder(s);
  }
  rep.artifact('visual_intent', 'intents', {
    bySlide: slides.map((s) => ({ slideId: s.id, title: s.title, visualType: s.visualIntent?.visualType }))
  });
  rep.stageEnd('visual_intent');

  // 3) Assets (diagrams/charts now; stock photos/icons can be auto-selected)
  rep.stageStart('assets');
  const assetOut = AssetAgent.run(slides);
  warnings.push(...assetOut.warnings);
  if (assetOut.warnings?.length) rep.warning('assets', 'AssetAgent warnings', { warnings: assetOut.warnings });

  // Phase C: auto-select visuals for slides that want a photo.
  // Priority:
  //  1) Pexels (if PEXEL_API is set)
  //  2) Wikimedia Commons (no key)
  //  3) OpenAI image generation (if API_KEY is set)
  // If everything fails, keep the placeholder and add a warning (do not fail deck generation).
  for (const s of slides) {
    if (s.visualIntent?.visualType !== 'photo') continue;

    const query = (s.visualIntent.queryTerms?.join(' ') || `${outline.title} ${s.title}`).trim();

    // Helper to attach a photo asset from a URL (converted to data URI).
    const attachFromUrl = async (downloadUrl: string, meta: { sourceUrl?: string; attribution?: string; license?: string; altText?: string }) => {
      const fetched = await fetchImageAsDataUri(downloadUrl);
      s.selectedAssets = [
        ...(s.selectedAssets ?? []).filter((a) => a.kind !== 'photo'),
        {
          kind: 'photo',
          dataUri: fetched.dataUri,
          sourceUrl: meta.sourceUrl ?? downloadUrl,
          attribution: meta.attribution,
          license: meta.license,
          altText: meta.altText ?? `Image for: ${query}`
        }
      ];
    };

    // 1) Pexels
    const hasPexels = Boolean(String(process.env.PEXEL_API ?? '').trim());
    if (hasPexels) {
      try {
        const results = await searchPexelsPhotos(query, 6);
        const best = pickBestPhoto(results);
        if (best) {
          await attachFromUrl(best.downloadUrl, {
            sourceUrl: best.sourceUrl ?? best.downloadUrl,
            attribution: best.attribution,
            license: best.license,
            altText: best.altText
          });
          continue;
        }
        warnings.push(`No Pexels photo results for slide "${s.title}" (query: ${query}).`);
      } catch (e: any) {
        warnings.push(`Pexels auto photo failed for slide "${s.title}": ${e?.message ?? String(e)}`);
      }
    }

    // 2) Wikimedia Commons fallback
    try {
      const wResults = await searchWikimediaCommonsImages(query, 8);
      const wBest = pickBestWikimediaImage(wResults);
      if (wBest) {
        await attachFromUrl(wBest.downloadUrl, {
          sourceUrl: wBest.sourceUrl ?? wBest.downloadUrl,
          attribution: wBest.attribution,
          license: wBest.license,
          altText: wBest.altText
        });
        continue;
      }
      warnings.push(`No Wikimedia results for slide "${s.title}" (query: ${query}).`);
    } catch (e: any) {
      warnings.push(`Wikimedia auto photo failed for slide "${s.title}": ${e?.message ?? String(e)}`);
    }

    // 3) OpenAI Images fallback
    try {
      if (String(process.env.API_KEY ?? '').trim()) {
        const { generateOpenAiImageBase64 } = await import('./openaiImages.js');
        const prompt = `High quality photo/illustration for a presentation slide. Slide title: "${s.title}". Deck topic: "${outline.title}". Use a clean, modern, high-contrast style suitable for PowerPoint. Avoid text in the image.`;
        // Smaller size is far more reliable for Office.js addImage (base64 limits) while still looking good on slides.
        const out = await generateOpenAiImageBase64({ prompt, size: '1024x1024' });
        s.selectedAssets = [
          ...(s.selectedAssets ?? []).filter((a) => a.kind !== 'photo'),
          {
            kind: 'photo',
            dataUri: `data:image/png;base64,${out.b64}`,
            altText: out.revisedPrompt ?? prompt,
            attribution: 'AI-generated (OpenAI)',
            license: 'AI-generated'
          }
        ];
        continue;
      }
    } catch (e: any) {
      warnings.push(`OpenAI image fallback failed for slide "${s.title}": ${e?.message ?? String(e)}`);
    }

    warnings.push(`No photo selected for slide "${s.title}" (no providers succeeded).`);
  }

  // 4) Render plan (template-level)
  const renderPlan = RenderPlanAgent.run(slides);
  rep.artifact('assets', 'renderPlan', renderPlan);
  rep.stageEnd('assets');

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

  rep.stageStart('style');
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
  if (agentStylePreset) rep.artifact('style', 'aiStylePreset', agentStylePreset);
  rep.artifact('style', 'recommendedStyleId', { recommendedStyleId });

  // Apply recommended theme + decoration immediately
  const recPreset = stylePresets.find((s: any) => s.id === recommendedStyleId);
  if (recPreset?.theme) {
    deck.theme = { ...deck.theme, ...recPreset.theme };
  }
  if (recPreset?.decoration) {
    (deck as any).decoration = recPreset.decoration;
  }
  rep.stageEnd('style');

  // 5) Content refinement pass (optional but recommended): improves specificity + varies bullet counts.
  try {
    const bulletCounts = deck.slides.map((s: any) => (Array.isArray(s.bullets) ? s.bullets.length : 0)).filter((n: number) => n > 0);
    const uniform = bulletCounts.length > 0 && bulletCounts.every((n: number) => n === bulletCounts[0]);

    if (uniform) {
      rep.stageStart('content_refine' as any);
      const { ContentRefinementAgent } = await import('../agents/contentRefinementAgent.js');
      const out = await ContentRefinementAgent.run(deck);
      if (out.warnings?.length) rep.warning('content_refine' as any, 'Content refinement warnings', { warnings: out.warnings });

      if (out.patches?.length) {
        const byId: Record<string, any> = {};
        for (const p of out.patches) byId[String(p.slideId)] = p;
        deck.slides = deck.slides.map((s: any) => {
          const p = byId[s.id];
          if (!p) return s;
          return {
            ...s,
            title: p.title ?? s.title,
            bullets: p.bullets ?? s.bullets,
            bodyText: p.bodyText ?? s.bodyText,
            speakerNotes: p.speakerNotes ?? s.speakerNotes
          };
        });
        rep.artifact('content_refine' as any, 'patchedSlides', { count: out.patches.length });
      }
      rep.stageEnd('content_refine' as any);
    }
  } catch (e: any) {
    rep.warning('content_refine' as any, 'Content refinement crashed', { error: e?.message ?? String(e) });
  }

  // 6) AI raw layout plan (exact x/y/w/h). Must come AFTER style + visuals are attached.
  rep.stageStart('layout');
  try {
    const { bySlideId, warnings: layoutWarnings } = await LayoutPlanAgent.run(deck);
    warnings.push(...layoutWarnings);
    if (layoutWarnings?.length) rep.warning('layout', 'LayoutPlanAgent warnings', { warnings: layoutWarnings });
    for (const s of deck.slides) {
      const p = bySlideId[s.id];
      if (p) (s as any).layoutPlan = p;
    }
    rep.artifact('layout', 'layoutPlanSummary', {
      slides: deck.slides.map((s) => ({ slideId: s.id, boxes: (s as any).layoutPlan?.boxes?.length ?? 0 }))
    });
  } catch (e: any) {
    warnings.push(`LayoutPlanAgent crashed: ${e?.message ?? String(e)}`);
    rep.warning('layout', 'LayoutPlanAgent crashed', { error: e?.message ?? String(e) });
  }
  rep.stageEnd('layout');

  // 6) QA gate
  rep.stageStart('qa');
  let qa = runDeckQa(deck);
  rep.artifact('qa', 'report', qa);

  // If QA fails (layout issues are common), auto-repair by applying deterministic template layouts
  // to failing slides. This improves "works first time" without additional AI calls.
  if (!qa.pass || qa.issues?.some((i: any) => i.level === 'fail')) {
    try {
      const { buildFallbackLayoutPlan } = await import('./layoutTemplates.js');
      const failingSlideIds = new Set(
        (qa.issues ?? []).filter((i: any) => i.level === 'fail' && i.slideId).map((i: any) => String(i.slideId))
      );

      if (failingSlideIds.size) {
        for (const s of deck.slides) {
          if (!failingSlideIds.has(String(s.id))) continue;
          (s as any).layoutPlan = buildFallbackLayoutPlan({ deck, slide: s as any });
        }
        warnings.push(`Auto-repair: applied fallback layout templates for ${failingSlideIds.size} failing slide(s).`);
        rep.warning('qa', 'Auto-repair applied fallback layout templates', { count: failingSlideIds.size });

        // Re-run QA after repair
        qa = runDeckQa(deck);
        rep.artifact('qa', 'report_after_repair', qa);
      }
    } catch (e: any) {
      warnings.push(`Auto-repair (fallback layout) failed: ${e?.message ?? String(e)}`);
      rep.warning('qa', 'Auto-repair failed', { error: e?.message ?? String(e) });
    }
  }

  // If QA is still failing due to density, try a deterministic split pass.
  if (qa.issues?.some((i: any) => i.level === 'fail' && String(i.message || '').toLowerCase().includes('overcrowded'))) {
    try {
      const { newId } = await import('../utils/id.js');
      const outSlides: any[] = [];
      for (const s of deck.slides ?? []) {
        const bullets = Array.isArray((s as any).bullets) ? (s as any).bullets : null;
        const bulletTextLen = bullets ? bullets.join(' ').length : 0;
        if (bullets && (bullets.length >= 9 || bulletTextLen > 520)) {
          const splitAt = Math.min(5, Math.max(3, Math.round(bullets.length / 2)));
          outSlides.push({ ...s, bullets: bullets.slice(0, splitAt) });
          outSlides.push({ ...s, id: newId('slide'), title: `${String(s.title || 'Slide')} (cont.)`, bullets: bullets.slice(splitAt), speakerNotes: '' });
          continue;
        }
        outSlides.push(s);
      }
      deck.slides = outSlides.map((s, idx) => ({ ...s, order: idx }));
      warnings.push('Auto-repair: split dense slides to reduce overcrowding.');
      rep.warning('qa', 'Auto-repair split dense slides', { slideCount: deck.slides.length });

      qa = runDeckQa(deck);
      rep.artifact('qa', 'report_after_split', qa);
    } catch (e: any) {
      warnings.push(`Auto-repair (split slides) failed: ${e?.message ?? String(e)}`);
      rep.warning('qa', 'Auto-repair split failed', { error: e?.message ?? String(e) });
    }
  }

  rep.stageEnd('qa');

  // Validate final deck contract AFTER applying style/decoration/layoutPlan
  const validated = await runAgent({ name: 'Orchestrator.deck', schema: DeckSchemaZ, run: async () => deck });
  if (!validated.ok) {
    return { success: false, error: validated.error, warnings: ['Deck validation failed'] };
  }

  rep.stageStart('done');
  rep.stageEnd('done', { deckId: validated.value.id });

  return {
    success: true,
    deck: validated.value,
    stylePresets,
    recommendedStyleId,
    assets: assetOut.assets,
    renderPlan,
    qa,
    warnings: warnings.length ? warnings : undefined
  };
};
