import { Router } from 'express';
import { DeckStore } from '../services/deckStore.js';
import { runDeckQa } from '../services/deckQa.js';

export const deckExtrasRouter = Router();

// GET /api/deck/:deckId
// Return the current in-memory deck
// (In production you'd persist; for prototype this is enough.)
deckExtrasRouter.get('/:deckId', (req, res) => {
  const deckId = String(req.params.deckId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });
  return res.json({ success: true, deck });
});

// POST /api/deck/:deckId/qa/run
deckExtrasRouter.post('/:deckId/qa/run', (req, res) => {
  const deckId = String(req.params.deckId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });
  const report = runDeckQa(deck);
  return res.json({ success: true, deckId, report });
});

// POST /api/deck/:deckId/improve
// Runs: content refine -> speaker notes fill -> layout regen
// Best-effort; always returns success with warnings unless deck missing.
deckExtrasRouter.post('/:deckId/improve', async (req, res) => {
  const deckId = String(req.params.deckId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

  const warnings: string[] = [];
  let working: any = { ...deck };

  try {
    const { ContentRefinementAgent } = await import('../agents/contentRefinementAgent.js');
    const out = await ContentRefinementAgent.run(working);
    warnings.push(...out.warnings);

    if (out.patches?.length) {
      const byId: Record<string, any> = {};
      for (const p of out.patches) byId[String(p.slideId)] = p;
      working.slides = working.slides.map((s: any) => {
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
    }
  } catch (e: any) {
    warnings.push(`Improve: content refine crashed: ${e?.message ?? String(e)}`);
  }

  try {
    const { SpeakerNotesAgent } = await import('../agents/speakerNotesAgent.js');
    const out = await SpeakerNotesAgent.run(working);
    warnings.push(...out.warnings);
    working.slides = working.slides.map((s: any) => ({ ...s, speakerNotes: out.bySlideId[s.id] ?? s.speakerNotes }));
  } catch (e: any) {
    warnings.push(`Improve: speaker notes crashed: ${e?.message ?? String(e)}`);
  }

  try {
    const { LayoutPlanAgent } = await import('../agents/layoutPlanAgent.js');
    const out = await LayoutPlanAgent.run(working);
    warnings.push(...out.warnings);
    for (const s of working.slides) {
      const p = out.bySlideId[s.id];
      if (p) s.layoutPlan = p;
    }
  } catch (e: any) {
    warnings.push(`Improve: layout plan crashed: ${e?.message ?? String(e)}`);
  }

  working.metadata = { ...(working.metadata ?? {}), updatedAt: new Date().toISOString() };
  DeckStore.set(working);

  const report = runDeckQa(working);
  return res.json({ success: true, deckId, report, warnings });
});

// POST /api/deck/:deckId/repair
// Deterministic repairs driven by QA heuristics (no additional AI calls required).
// Goal: "works first time" by clamping common failure modes (too many bullets, missing notes, missing layoutPlan).
// Best-effort; always returns success with warnings unless deck missing.
deckExtrasRouter.post('/:deckId/repair', async (req, res) => {
  const deckId = String(req.params.deckId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

  const warnings: string[] = [];
  let working: any = { ...deck };

  // 1) Clamp content density (deterministic)
  const MAX_BULLETS = 6;
  const MAX_BODY_CHARS = 700;
  working.slides = (working.slides ?? []).map((s: any) => {
    const out = { ...s };
    if (Array.isArray(out.bullets) && out.bullets.length > MAX_BULLETS) {
      out.bullets = out.bullets.slice(0, MAX_BULLETS);
      warnings.push(`Repair: trimmed bullets to ${MAX_BULLETS} for slide "${String(out.title || '').slice(0, 60)}"`);
    }
    if (typeof out.bodyText === 'string' && out.bodyText.length > MAX_BODY_CHARS) {
      out.bodyText = out.bodyText.slice(0, MAX_BODY_CHARS).trim() + '…';
      warnings.push(`Repair: trimmed bodyText to ${MAX_BODY_CHARS} chars for slide "${String(out.title || '').slice(0, 60)}"`);
    }
    return out;
  });

  // 1b) Split overly long/dense bullet slides (better than shrinking fonts endlessly)
  try {
    const { newId } = await import('../utils/id.js');

    const outSlides: any[] = [];
    for (const s of working.slides ?? []) {
      const bullets = Array.isArray((s as any).bullets) ? (s as any).bullets : null;
      const bodyText = typeof (s as any).bodyText === 'string' ? String((s as any).bodyText) : '';

      // Heuristic: split if there are many bullets OR the total bullet text is very long.
      const bulletTextLen = bullets ? bullets.join(' ').length : 0;
      const shouldSplit = Boolean(bullets && (bullets.length >= 9 || bulletTextLen > 520));

      if (bullets && shouldSplit) {
        const splitAt = Math.min(5, Math.max(3, Math.round(bullets.length / 2)));
        const a = bullets.slice(0, splitAt);
        const b = bullets.slice(splitAt);

        outSlides.push({ ...s, bullets: a });
        outSlides.push({
          ...s,
          id: newId('slide'),
          title: `${String(s.title || 'Slide')} (cont.)`,
          bullets: b,
          bodyText: bodyText ? undefined : (s as any).bodyText,
          speakerNotes: ''
        });

        warnings.push(`Repair: split dense bullet slide into two slides: "${String(s.title || '').slice(0, 60)}"`);
        continue;
      }

      // If no bullets but body text is huge, split body into two slides.
      if (!bullets && bodyText && bodyText.length > 900) {
        const mid = Math.round(bodyText.length / 2);
        const cut = bodyText.lastIndexOf('\n', mid) > 200 ? bodyText.lastIndexOf('\n', mid) : bodyText.lastIndexOf(' ', mid);
        const at = cut > 200 ? cut : mid;

        const a = bodyText.slice(0, at).trim();
        const b = bodyText.slice(at).trim();

        outSlides.push({ ...s, bodyText: a });
        outSlides.push({ ...s, id: newId('slide'), title: `${String(s.title || 'Slide')} (cont.)`, bodyText: b, speakerNotes: '' });
        warnings.push(`Repair: split long body slide into two slides: "${String(s.title || '').slice(0, 60)}"`);
        continue;
      }

      outSlides.push(s);
    }

    // Re-number orders
    working.slides = outSlides.map((s, idx) => ({ ...s, order: idx }));
  } catch (e: any) {
    warnings.push(`Repair: split-slide step failed: ${e?.message ?? String(e)}`);
  }

  // 2) Ensure speaker notes exist (best-effort; uses existing agent)
  try {
    const missing = (working.slides ?? []).some((s: any) => !String(s.speakerNotes ?? '').trim());
    if (missing) {
      const { SpeakerNotesAgent } = await import('../agents/speakerNotesAgent.js');
      const out = await SpeakerNotesAgent.run(working);
      warnings.push(...(out.warnings ?? []));
      working.slides = working.slides.map((s: any) => ({ ...s, speakerNotes: out.bySlideId[s.id] ?? s.speakerNotes }));
    }
  } catch (e: any) {
    warnings.push(`Repair: speaker notes step failed: ${e?.message ?? String(e)}`);
  }

  // 3) Ensure layoutPlan exists and is QA-safe (best-effort)
  try {
    const { buildFallbackLayoutPlan } = await import('../services/layoutTemplates.js');

    // If a slide has no plan at all, create a conservative deterministic one.
    for (const s of working.slides ?? []) {
      if (!(s as any).layoutPlan?.boxes?.length) {
        (s as any).layoutPlan = buildFallbackLayoutPlan({ deck: working, slide: s });
        warnings.push(`Repair: applied fallback layoutPlan for slide "${String(s.title || '').slice(0, 60)}" (missing plan).`);
      }
    }

    // If QA detects layout failures, replan only the failing slides using fallback templates.
    const afterPlanQa = runDeckQa(working);
    const failingSlideIds = new Set(
      (afterPlanQa.issues ?? [])
        .filter((i: any) => i.level === 'fail' && i.slideId)
        .map((i: any) => String(i.slideId))
    );

    if (failingSlideIds.size) {
      for (const s of working.slides ?? []) {
        if (!failingSlideIds.has(String(s.id))) continue;
        (s as any).layoutPlan = buildFallbackLayoutPlan({ deck: working, slide: s });
        warnings.push(`Repair: replaced layoutPlan with fallback template for slide "${String(s.title || '').slice(0, 60)}" (QA fail).`);
      }
    } else {
      // Otherwise, keep existing plan; optionally regenerate via agent if many slides lack plan.
      const needsLayout = (working.slides ?? []).some((s: any) => !(s as any).layoutPlan?.boxes?.length);
      if (needsLayout) {
        const { LayoutPlanAgent } = await import('../agents/layoutPlanAgent.js');
        const out = await LayoutPlanAgent.run(working);
        warnings.push(...(out.warnings ?? []));
        for (const s of working.slides) {
          const p = out.bySlideId?.[s.id];
          if (p) (s as any).layoutPlan = p;
        }
      }
    }
  } catch (e: any) {
    warnings.push(`Repair: layout plan step failed: ${e?.message ?? String(e)}`);
  }

  working.metadata = { ...(working.metadata ?? {}), updatedAt: new Date().toISOString() };
  DeckStore.set(working);

  const report = runDeckQa(working);
  return res.json({ success: true, deckId, report, warnings });
});
