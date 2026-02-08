import type {
  AssetManifest,
  DeckGenerationRequest,
  DeckGenerationResponse,
  DeckSchema,
  RenderPlan,
  Slide,
  ThemeTokens,
  VisualIntent
} from '../types/deck.js';
import { newId } from '../utils/id.js';
import {
  renderSimpleBarChartSvg,
  renderStepsDiagramSvg,
  svgToDataUri
} from '../utils/svg.js';

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

const titleFromPrompt = (prompt: string): string => {
  const words = prompt.trim().split(/\s+/).slice(0, 7);
  if (!words.length) return 'Untitled Deck';
  return words.join(' ') + (prompt.trim().split(/\s+/).length > 7 ? '…' : '');
};

const clampBullets = (bullets: string[] | undefined, max = 6): string[] | undefined => {
  if (!bullets?.length) return bullets;
  return bullets.slice(0, max);
};

/**
 * Phase A-D mock agents:
 * - Outline
 * - Visual intent
 * - Asset generation (diagrams/charts as SVG data URIs)
 * - Render plan
 *
 * This is deterministic and works without external API keys.
 * Later, replace each section with real LLM + search tooling.
 */
export const generateDeckWithAgents = async (
  req: DeckGenerationRequest
): Promise<DeckGenerationResponse> => {
  const warnings: string[] = [];
  const slideCount = Math.max(3, Math.min(15, req.slideCount ?? 5));
  const now = new Date().toISOString();

  // --- Outline Agent (deterministic for now) ---
  const deckId = newId('deck');
  const slides: Slide[] = [];

  slides.push({
    id: newId('slide'),
    order: 0,
    slideType: 'title',
    layout: 'centered',
    title: titleFromPrompt(req.prompt),
    subtitle: req.targetAudience ? `For ${req.targetAudience}` : 'Generated outline',
    speakerNotes: 'Set context and state the goal of the presentation.'
  });

  const middleCount = slideCount - 2;
  const topics = [
    'Problem / Opportunity',
    'Solution Overview',
    'How It Works',
    'Impact / Metrics',
    'Next Steps'
  ].slice(0, middleCount);

  topics.forEach((t, i) => {
    slides.push({
      id: newId('slide'),
      order: i + 1,
      slideType: 'bullets',
      layout: 'full',
      title: t,
      bullets: clampBullets([
        `Key point about ${t.toLowerCase()}`,
        'Supporting detail / evidence',
        'Risks / constraints (if any)'
      ]),
      speakerNotes: `Explain ${t.toLowerCase()} and connect it back to the objective.`
    });
  });

  slides.push({
    id: newId('slide'),
    order: slideCount - 1,
    slideType: 'section',
    layout: 'centered',
    title: 'Key Takeaways',
    bullets: clampBullets([
      'What we learned',
      'What we’re proposing',
      'What happens next'
    ]),
    speakerNotes: 'Summarize and clearly ask for a decision or action.'
  });

  // --- Visual Intent Agent ---
  const addVisualIntent = (slide: Slide, idx: number): VisualIntent => {
    if (slide.slideType === 'title') {
      return {
        visualType: 'photo',
        visualGoal: 'Provide an attractive title backdrop that matches the topic',
        queryTerms: req.prompt.split(/\s+/).slice(0, 6)
      };
    }

    // Simple heuristic: make slide 2 a diagram, slide 3 a chart
    if (idx === 2) {
      return {
        visualType: 'diagram',
        visualGoal: 'Explain the process at a glance',
        diagramSpec: {
          kind: 'steps',
          steps: ['Input', 'Analyze', 'Compose', 'Render', 'Review']
        }
      };
    }

    if (idx === 3) {
      return {
        visualType: 'chart',
        visualGoal: 'Show a clear improvement or trend',
        chartSpec: {
          kind: 'bar',
          title: 'Impact (Example)',
          labels: ['Before', 'After'],
          values: [42, 78],
          unit: '%'
        }
      };
    }

    return {
      visualType: 'icon',
      visualGoal: 'Add a simple icon to reinforce the slide topic',
      queryTerms: slide.title.split(/\s+/)
    };
  };

  slides.forEach((s, idx) => {
    s.visualIntent = addVisualIntent(s, idx);
    // Ensure placeholder exists for the UI / renderer
    if (s.visualIntent.visualType !== 'none') {
      s.imagePlaceholders = [
        {
          id: newId('ph'),
          description: `${s.visualIntent.visualType}: ${s.visualIntent.visualGoal}`,
          position: s.slideType === 'title' ? 'background' : 'right',
          suggestedType:
            s.visualIntent.visualType === 'diagram'
              ? 'diagram'
              : s.visualIntent.visualType === 'chart'
                ? 'chart'
                : s.visualIntent.visualType === 'photo'
                  ? 'photo'
                  : 'icon'
        }
      ];
    }
  });

  // --- Asset Sourcing Agent (Phase B-D: generated diagrams/charts; photos/icons are placeholders for now) ---
  const assets: AssetManifest = { items: [], bySlideId: {} };

  for (const s of slides) {
    const intent = s.visualIntent;
    if (!intent || intent.visualType === 'none') continue;

    const slideAssets: string[] = [];

    if (intent.visualType === 'diagram' && intent.diagramSpec?.steps?.length) {
      const { svg, width, height } = renderStepsDiagramSvg({
        title: s.title,
        steps: intent.diagramSpec.steps
      });
      const assetId = newId('asset');
      assets.items.push({
        assetId,
        kind: 'svg',
        title: `Diagram: ${s.title}`,
        altText: `Diagram showing steps for ${s.title}`,
        dataUri: svgToDataUri(svg),
        width,
        height
      });
      slideAssets.push(assetId);
    }

    if (intent.visualType === 'chart' && intent.chartSpec?.labels?.length) {
      const { svg, width, height } = renderSimpleBarChartSvg({
        title: intent.chartSpec.title ?? s.title,
        labels: intent.chartSpec.labels,
        values: intent.chartSpec.values,
        unit: intent.chartSpec.unit
      });
      const assetId = newId('asset');
      assets.items.push({
        assetId,
        kind: 'chart',
        title: `Chart: ${s.title}`,
        altText: `Chart for ${s.title}`,
        dataUri: svgToDataUri(svg),
        width,
        height
      });
      slideAssets.push(assetId);
    }

    // Phase C (stock preferred): we don't automatically fetch stock here yet.
    // Instead, we provide query terms + placeholders so UI can present choices.
    if (intent.visualType === 'photo' || intent.visualType === 'icon') {
      warnings.push(
        `Slide "${s.title}": ${intent.visualType} sourcing is available via /api/assets/search; pick an option in the UI to attach it.`
      );
    }

    if (slideAssets.length) {
      assets.bySlideId[s.id] = slideAssets;
    }
  }

  // --- Layout Composer Agent (Render plan) ---
  const renderPlan: RenderPlan = {
    version: '1.0',
    slides: slides.map((s) => {
      if (s.slideType === 'title') {
        return { slideId: s.id, template: 'TITLE_TOP_VISUAL_FULL', emphasis: 'visual' };
      }
      if (s.slideType === 'section') {
        return { slideId: s.id, template: 'SECTION_SPLASH', emphasis: 'text' };
      }
      if (s.slideType === 'quote') {
        return { slideId: s.id, template: 'QUOTE_CENTER', emphasis: 'text' };
      }
      const vt = s.visualIntent?.visualType;
      if (vt === 'diagram' || vt === 'chart' || vt === 'photo') {
        return { slideId: s.id, template: 'TITLE_LEFT_VISUAL_RIGHT', emphasis: 'balanced' };
      }
      return { slideId: s.id, template: 'TITLE_LEFT_VISUAL_RIGHT', emphasis: 'text' };
    })
  };

  const deck: DeckSchema = {
    id: deckId,
    title: titleFromPrompt(req.prompt),
    description: req.prompt,
    theme: {
      ...DEFAULT_THEME,
      ...(req.theme ?? {})
    },
    slides,
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      targetAudience: req.targetAudience,
      estimatedDuration: slideCount * 2
    }
  };

  return { success: true, deck, assets, renderPlan, warnings };
};
