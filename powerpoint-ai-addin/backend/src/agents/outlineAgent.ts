import type { DeckGenerationRequest, Slide } from '../types/deck.js';
import { newId } from '../utils/id.js';
import { runAgent } from './runAgent.js';
import { SlideZ } from './schemas.js';
import { extractFirstJsonObject, llmGenerate } from '../services/llm.js';

const titleFromPrompt = (prompt: string): string => {
  const words = prompt.trim().split(/\s+/).slice(0, 10);
  if (!words.length) return 'Untitled Deck';
  return words.join(' ') + (prompt.trim().split(/\s+/).length > 10 ? '…' : '');
};

const clampBullets = (bullets: string[] | undefined, max = 9): string[] | undefined => {
  if (!bullets?.length) return bullets;
  return bullets.slice(0, max);
};

const parseRequestedSlideCount = (prompt: string): number | null => {
  const p = String(prompt || '');
  // e.g. "10 slides", "10-slide deck", "10 slide presentation"
  const m = p.match(/\b(\d{1,3})\s*(?:-\s*)?(?:slides?|slide\s*deck|slide\s*presentation|page\s*deck|pages?)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

const bannedBulletFragments = [
  'key point',
  'supporting detail',
  'evidence',
  'risks / constraints',
  'what we learned',
  'what we’re proposing',
  'what happens next'
];

function looksLikePlaceholder(s: Slide): boolean {
  const all = [s.title, ...(s.bullets ?? [])].join(' ').toLowerCase();
  return bannedBulletFragments.some((b) => all.includes(b));
}

export const OutlineAgent = {
  async run(req: DeckGenerationRequest): Promise<{ title: string; slides: Slide[] }> {
    const requestedFromPrompt = parseRequestedSlideCount(req.prompt);
    // "Boundless" in practice still needs a safety cap; accept up to 30.
    const requested = requestedFromPrompt ?? (req.slideCount ?? null);
    const slideCount = requested != null ? Math.max(3, Math.min(30, requested)) : null;

    // OpenClaw-style: ask LLM for STRICT JSON and validate it.
    const system = `You are an expert presentation writer AND slide designer.
Return ONLY valid JSON (no markdown, no commentary).

You must produce a slide-ready deck outline. Rules:
- No placeholder bullets like "Key point" / "Supporting detail".
- Bullets must be concrete, specific, and presentation-ready.
- Prefer numbers, examples, named entities, steps, and concise phrasing.
- Bullets should NOT always be exactly 3.
  - For "bullets" slides: typically 4-7 bullets.
  - For "section" slides: typically 3-5 bullets.
- Each slide MUST have speakerNotes (2-5 sentences) explaining the bullets.
- Keep bullets short (<= 14 words each).
- Use slideType values exactly: "title" | "bullets" | "section".
- Use layout values exactly: "centered" | "full".
- Slide ordering must start at 0 and increment by 1.

Output schema:
{
  "title": string,
  "slides": Array<{
    "order": number,
    "slideType": "title"|"bullets"|"section",
    "layout": "centered"|"full",
    "title": string,
    "subtitle"?: string,
    "bullets"?: string[],
    "bodyText"?: string,
    "speakerNotes"?: string
  }>
}`.trim();

    const user = `Prompt: ${req.prompt}
Audience: ${req.targetAudience ?? 'unspecified'}
Tone: ${req.tone ?? 'unspecified'}

Slide count guidance:
- If the prompt explicitly requests a slide count, follow it.
- Otherwise choose an appropriate number of slides for the prompt (prefer 6-14, but you may go outside if justified).
${slideCount ? `Requested slide count: ${slideCount}` : 'No requested slide count.'}

Structure guidance:
- Slide 0: title slide
- Last slide: key takeaways / next steps
- Middle slides: include what fits the prompt (problem, solution, how it works, differentiation, metrics, risks, timeline, demo, etc.)
`.trim();

    let slides: Slide[] | null = null;
    let deckTitle = titleFromPrompt(req.prompt);

    try {
      const { raw } = await llmGenerate({ system, user, maxTokens: 1800, temperature: 0.5 });
      const json = extractFirstJsonObject(raw);
      deckTitle = String(json?.title || deckTitle);
      const candidate = Array.isArray(json?.slides) ? json.slides : [];

      // Normalize into our Slide type (assign ids, clamp bullets).
      const normalized: Slide[] = candidate.map((s: any, idx: number) => {
        const order = Number.isFinite(Number(s?.order)) ? Number(s.order) : idx;
        const slide: Slide = {
          id: newId('slide'),
          order,
          slideType: (String(s?.slideType || 'bullets') as any),
          layout: (String(s?.layout || 'full') as any),
          title: String(s?.title || ''),
          subtitle: s?.subtitle != null ? String(s.subtitle) : undefined,
          bullets: clampBullets(Array.isArray(s?.bullets) ? s.bullets.map((b: any) => String(b)) : undefined),
          bodyText: s?.bodyText != null ? String(s.bodyText) : undefined,
          speakerNotes: s?.speakerNotes != null ? String(s.speakerNotes) : undefined
        };
        return slide;
      });

      // Ensure slide count only if requested.
      if (slideCount != null && normalized.length !== slideCount) {
        slides = null;
      } else if (normalized.some(looksLikePlaceholder)) {
        // Reject placeholder-y outputs.
        slides = null;
      } else {
        // Normalize ordering if needed.
        const sorted = [...normalized].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }));
        slides = sorted;
      }
    } catch {
      slides = null;
    }

    // Fallback: deterministic template (never fail). Still validated below.
    if (!slides) {
      slides = [];
      slides.push({
        id: newId('slide'),
        order: 0,
        slideType: 'title',
        layout: 'centered',
        title: deckTitle,
        subtitle: req.targetAudience ? `For ${req.targetAudience}` : 'Generated outline',
        speakerNotes: 'Set context and state the goal of the presentation.'
      });

      const fallbackCount = slideCount ?? 8;
      const middleCount = fallbackCount - 2;
      const topics = [
        'Problem',
        'Why Now',
        'Solution',
        'How It Works',
        'Differentiation',
        'Impact / Metrics',
        'Risks & Mitigations',
        'Roadmap'
      ].slice(0, middleCount);

      topics.forEach((t, i) => {
        slides!.push({
          id: newId('slide'),
          order: i + 1,
          slideType: 'bullets',
          layout: 'full',
          title: t,
          bullets: clampBullets([`Define ${t.toLowerCase()} clearly`, 'Include 1 concrete example', 'Include 1 metric or proof point']),
          speakerNotes: `Explain ${t.toLowerCase()} with specifics.`
        });
      });

      slides!.push({
        id: newId('slide'),
        order: fallbackCount - 1,
        slideType: 'section',
        layout: 'centered',
        title: 'Key Takeaways & Next Steps',
        bullets: clampBullets(['Decision needed', 'Immediate next step', 'Owner + timeline']),
        speakerNotes: 'Summarize and ask for a decision or action.'
      });
    }

    const slidesArr: Slide[] = slides ?? [];

    // Validate each slide structure (agent contract)
    const results = await Promise.all(
      slidesArr.map((s) =>
        runAgent({
          name: 'OutlineAgent.slide',
          schema: SlideZ,
          run: async () => s
        })
      )
    );

    const bad = results.find((r) => !r.ok);
    if (bad && !bad.ok) throw new Error(bad.error);

    return { title: deckTitle, slides: slidesArr };
  }
};
