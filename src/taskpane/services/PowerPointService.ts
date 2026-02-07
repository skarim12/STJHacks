import type { SlideStructure, ColorScheme } from "../types";

export class PowerPointService {
  async createSlideFromStructure(structure: SlideStructure, position?: number): Promise<void> {
    return PowerPoint.run(async (context) => {
      const presentation = context.presentation;
      const slides = presentation.slides;
      const count = slides.getCount();
      await context.sync();

      const index = position !== undefined ? position : count;
      const slide = slides.add(index);

      await this.populateSlide(slide, structure);

      if (structure.notes) {
        slide.notesPage.notesTextFrame.textRange.text = structure.notes;
      }

      await context.sync();
    });
  }

  private async populateSlide(slide: PowerPoint.Slide, structure: SlideStructure): Promise<void> {
    const shapes = slide.shapes;

    const titleShape = shapes.addTextBox(structure.title);
    titleShape.left = 50;
    titleShape.top = 40;
    titleShape.width = 600;
    titleShape.height = 60;
    titleShape.textFrame.textRange.font.name = "Calibri";
    titleShape.textFrame.textRange.font.size = 32;
    titleShape.textFrame.textRange.font.bold = true;

    switch (structure.slideType) {
      case "content":
      case "quote":
      case "title":
        await this.addBulletPoints(shapes, structure.content);
        break;
      case "comparison":
        await this.addComparisonLayout(shapes, structure.content);
        break;
      case "image":
        await this.addImagePlaceholder(shapes);
        break;
      default:
        await this.addBulletPoints(shapes, structure.content);
    }
  }

  private async addBulletPoints(shapes: PowerPoint.ShapeCollection, points: string[]): Promise<void> {
    const textBox = shapes.addTextBox("");
    textBox.left = 50;
    textBox.top = 120;
    textBox.width = 600;
    textBox.height = 350;

    const tf = textBox.textFrame;

    let first = true;
    points.forEach((p) => {
      const toInsert = (first ? "" : "\n") + p;
      tf.textRange.insertText(toInsert, PowerPoint.InsertLocation.end);
      first = false;
    });

    const range = tf.textRange;
    range.paragraphFormat.bullet.visible = true;
    range.font.name = "Calibri";
    range.font.size = 18;
  }

  private async addComparisonLayout(shapes: PowerPoint.ShapeCollection, points: string[]): Promise<void> {
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

    const setBullets = (box: PowerPoint.Shape, pts: string[]) => {
      const tf = box.textFrame;
      let first = true;
      pts.forEach((p) => {
        const toInsert = (first ? "" : "\n") + p;
        tf.textRange.insertText(toInsert, PowerPoint.InsertLocation.end);
        first = false;
      });
      const range = tf.textRange;
      range.paragraphFormat.bullet.visible = true;
      range.font.name = "Calibri";
      range.font.size = 16;
    };

    setBullets(leftBox, left);
    setBullets(rightBox, right);
  }

  private async addImagePlaceholder(shapes: PowerPoint.ShapeCollection): Promise<void> {
    const rect = shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle);
    rect.left = 100;
    rect.top = 120;
    rect.width = 500;
    rect.height = 300;
    rect.textFrame.textRange.text = "Insert image here";
    rect.textFrame.textRange.font.size = 20;
    rect.textFrame.textRange.font.italic = true;
  }

  async applyColorTheme(theme: ColorScheme): Promise<void> {
    return PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      slides.load("items");
      await context.sync();

      for (const slide of slides.items) {
        const shapes = slide.shapes;
        shapes.load("items");
        await context.sync();

        for (const shape of shapes.items) {
          // Defensive: shape.textFrame can be null depending on shape type
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
      slides.load("items");
      await context.sync();

      let allNotes = "";

      slides.items.forEach((slide, i) => {
        const notes = slide.notesPage.notesTextFrame.textRange;
        notes.load("text");
        allNotes += `Slide ${i + 1}: ${notes.text}\n\n`;
      });

      await context.sync();
      return allNotes;
    });
  }
}
