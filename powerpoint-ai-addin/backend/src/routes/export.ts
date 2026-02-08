import { Router } from 'express';
import PptxGenJS from 'pptxgenjs';
import { DeckStore } from '../services/deckStore.js';
import type { DeckSchema, Slide } from '../types/deck.js';

export const exportRouter = Router();

function safeFileName(name: string): string {
  const base = (name || 'deck').replace(/[^a-z0-9-_]+/gi, '_');
  return base.slice(0, 80) || 'deck';
}

function addSlide(pptx: any, slide: Slide, deck: DeckSchema) {
  const s = pptx.addSlide();

  // Background: PPTXGen supports solid fill easily; gradients are non-trivial.
  // We’ll use solid backgroundColor as a baseline.
  const bg = deck.theme?.backgroundColor ? `hsl(${deck.theme.backgroundColor})` : undefined;
  if (bg) {
    try {
      // @ts-ignore
      s.background = { color: 'FFFFFF' };
    } catch {
      // ignore
    }
  }

  // Layout constants for LAYOUT_WIDE (13.333 x 7.5)
  const marginX = 0.5;
  const titleY = 0.35;
  const bodyY = 1.25;

  const hasPhoto = Boolean(slide.selectedAssets?.find((a) => a.kind === 'photo' && a.dataUri));

  const titleW = 12.3;
  const bodyW = hasPhoto ? 6.3 : 12.3;

  s.addText(slide.title || '', {
    x: marginX,
    y: titleY,
    w: titleW,
    h: 0.6,
    fontFace: deck.theme?.fontHeading || 'Calibri',
    fontSize: 30,
    color: '111111'
  });

  const bodyLines = slide.bullets?.length
    ? slide.bullets.map((b) => `• ${b}`)
    : slide.bodyText
      ? [slide.bodyText]
      : [];

  if (bodyLines.length) {
    s.addText(bodyLines.join('\n'), {
      x: marginX,
      y: bodyY,
      w: bodyW,
      h: 5.8,
      fontFace: deck.theme?.fontBody || 'Calibri',
      fontSize: 18,
      color: '222222',
      valign: 'top'
    });
  }

  // Image on the right (if present)
  const photo = slide.selectedAssets?.find((a) => a.kind === 'photo' && a.dataUri)?.dataUri;
  if (photo) {
    const b64 = photo.includes(',') ? photo.split(',')[1] : photo;
    // PNG/JPG both work; we pass base64 and let pptxgen handle.
    s.addImage({
      data: b64,
      x: 7.4,
      y: bodyY,
      w: 5.4,
      h: 4.05
    });
  }
}

// Download a PPTX for a generated deck (web demo export)
// GET /api/export/pptx/:deckId
exportRouter.get('/pptx/:deckId', async (req, res) => {
  const deckId = String(req.params.deckId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

  try {
    const pptx = new (PptxGenJS as any)();
    pptx.layout = 'LAYOUT_WIDE';

    // Basic metadata
    pptx.author = deck.metadata?.author || 'STJHacks';
    pptx.company = 'STJHacks';
    pptx.subject = deck.title;
    pptx.title = deck.title;

    for (const sl of deck.slides) addSlide(pptx, sl, deck);

    const buf: Buffer = await pptx.write('nodebuffer');

    const filename = `${safeFileName(deck.title)}.pptx`;
    res.setHeader(
      'content-type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('content-disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buf);
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? String(e) });
  }
});
