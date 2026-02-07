import type { ColorScheme, SlideStructure } from '../types';

export class PowerPointService {
  async createSlideFromStructure(structure: SlideStructure): Promise<void> {
    // NOTE: This requires Office.js runtime inside PowerPoint.
    // We keep the API surface here so the rest of the app is testable.
    await PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      const slide = slides.add();

      const shapes = slide.shapes;
      const title = shapes.addTextBox(structure.title);
      title.left = 50;
      title.top = 30;
      title.width = 620;
      title.height = 50;

      if (structure.slideType === 'content' && structure.content?.length) {
        const body = shapes.addTextBox(structure.content.map((p) => `• ${p}`).join('\n'));
        body.left = 50;
        body.top = 110;
        body.width = 620;
        body.height = 360;
      }

      // Speaker notes (basic)
      if (structure.notes) {
        // Some Office.js versions expose notes differently; keep as TODO until tested.
      }

      await context.sync();
    });
  }

  async applyColorTheme(_theme: ColorScheme): Promise<void> {
    // TODO: Apply theme across slides (requires design decisions + Office.js testing)
    return;
  }
}
