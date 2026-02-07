import type { SlideStructure, ColorScheme } from "../types";

export class PowerPointService {
  /**
   * Batch slide creation to minimize PowerPoint.run/context.sync overhead.
   *
   * NOTE: Office.js PowerPoint typings vary by version; we keep the implementation
   * runtime-correct and use minimal type assertions to avoid TS build failures.
   */
  async createSlidesBatch(slidesToCreate: SlideStructure[]): Promise<void> {
    return PowerPoint.run(async (context) => {
      const presentation = context.presentation;
      const slideCollection = presentation.slides;

      for (const structure of slidesToCreate) {
        const slide = (slideCollection as any).add();
        await this.populateSlide(slide as any, structure);
        if (structure.notes) {
          try {
            (slide as any).notesPage.notesTextFrame.textRange.text = structure.notes;
          } catch {
            // Notes not supported in some hosts/typings
          }
        }
      }

      await context.sync();
    });
  }

  async createSlideFromStructure(structure: SlideStructure): Promise<void> {
    return PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      const slide = (slides as any).add();

      await this.populateSlide(slide as any, structure);

      if (structure.notes) {
        try {
          (slide as any).notesPage.notesTextFrame.textRange.text = structure.notes;
        } catch {
          // ignore
        }
      }

      await context.sync();
    });
  }

  private async populateSlide(slide: any, structure: SlideStructure): Promise<void> {
    const shapes = slide.shapes as any;

    const titleShape = shapes.addTextBox(structure.title);
    titleShape.left = 50;
    titleShape.top = 40;
    titleShape.width = 600;
    titleShape.height = 60;

    // Font APIs vary; guard them
    try {
      titleShape.textFrame.textRange.font.name = "Calibri";
      titleShape.textFrame.textRange.font.size = 32;
      titleShape.textFrame.textRange.font.bold = true;
    } catch {
      // ignore
    }

    switch (structure.slideType) {
      case "comparison":
        await this.addComparisonLayout(shapes, structure.content);
        break;
      case "image":
        await this.addImagePlaceholder(shapes);
        break;
      case "content":
      case "quote":
      case "title":
      default:
        await this.addBulletPoints(shapes, structure.content);
    }
  }

  private async addBulletPoints(shapes: any, points: string[]): Promise<void> {
    const textBox = shapes.addTextBox(points.join("\n"));
    textBox.left = 50;
    textBox.top = 120;
    textBox.width = 600;
    textBox.height = 350;

    try {
      const range = textBox.textFrame.textRange;
      range.font.name = "Calibri";
      range.font.size = 18;
    } catch {
      // ignore
    }
  }

  private async addComparisonLayout(shapes: any, points: string[]): Promise<void> {
    const leftBox = shapes.addTextBox("");
    leftBox.left = 50;
    leftBox.top = 120;
    leftBox.width = 280;
    leftBox.height = 350;

    const rightBox = shapes.addTextBox("");
    rightBox.left = 370;
    rightBox.top = 120;
    rightBox.width = 280;
    rightBox.height = 350;

    const half = Math.ceil(points.length / 2);
    const left = points.slice(0, half);
    const right = points.slice(half);

    try {
      leftBox.textFrame.textRange.text = left.join("\n");
      rightBox.textFrame.textRange.text = right.join("\n");
      leftBox.textFrame.textRange.font.size = 16;
      rightBox.textFrame.textRange.font.size = 16;
    } catch {
      // ignore
    }
  }

  private async addImagePlaceholder(shapes: any): Promise<void> {
    try {
      const rect = shapes.addGeometricShape((PowerPoint as any).GeometricShapeType.rectangle);
      rect.left = 100;
      rect.top = 120;
      rect.width = 500;
      rect.height = 300;
      rect.textFrame.textRange.text = "Insert image here";
      rect.textFrame.textRange.font.size = 20;
      rect.textFrame.textRange.font.italic = true;
    } catch {
      // fallback: a textbox
      const tb = shapes.addTextBox("Insert image here");
      tb.left = 100;
      tb.top = 120;
      tb.width = 500;
      tb.height = 300;
    }
  }

  async applyColorTheme(theme: ColorScheme): Promise<void> {
    return PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      (slides as any).load?.("items");
      await context.sync();

      const slideItems = (slides as any).items || [];
      for (const slide of slideItems) {
        const shapes = slide.shapes;
        (shapes as any).load?.("items");
        await context.sync();

        const shapeItems = (shapes as any).items || [];
        for (const shape of shapeItems) {
          const tf = (shape as any).textFrame;
          if (tf?.textRange?.font) {
            tf.textRange.font.color = theme.text;
          }
        }
      }

      await context.sync();
    });
  }

  async exportToNotes(): Promise<string> {
    return PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      (slides as any).load?.("items");
      await context.sync();

      const slideItems = (slides as any).items || [];
      let allNotes = "";

      for (let i = 0; i < slideItems.length; i++) {
        const slide = slideItems[i];
        try {
          const notesRange = (slide as any).notesPage.notesTextFrame.textRange;
          notesRange.load?.("text");
          await context.sync();
          allNotes += `Slide ${i + 1}: ${notesRange.text}\n\n`;
        } catch {
          allNotes += `Slide ${i + 1}: (notes unavailable)\n\n`;
        }
      }

      return allNotes;
    });
  }
}
