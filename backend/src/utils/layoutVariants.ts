export type LayoutBoxKind =
  | "header"
  | "bulletsCard"
  | "imageCard"
  | "quoteCard"
  | "comparisonLeft"
  | "comparisonRight"
  | "statementCard"
  | "accentBar"
  | "fullBleedImage"
  | "placeholder";

export type GridRect = {
  colStart: number; // 1..12
  colSpan: number; // 1..12
  rowStart: number; // 1..8
  rowSpan: number; // 1..8
};

export type LayoutBox = {
  id: string;
  kind: LayoutBoxKind;
  rect: GridRect;
};

export type LayoutVariant = {
  name: string;
  slideTypes: Array<"title" | "content" | "comparison" | "quote" | "imagePlaceholder">;
  boxes: LayoutBox[];
};

// 12x8 grid inside the safe area
export const LAYOUT_VARIANTS: LayoutVariant[] = [
  // CONTENT
  {
    name: "content.singleCard",
    slideTypes: ["content"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "body", kind: "bulletsCard", rect: { colStart: 1, colSpan: 12, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    name: "content.twoColBullets",
    slideTypes: ["content"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "bulletsLeft", kind: "bulletsCard", rect: { colStart: 1, colSpan: 6, rowStart: 3, rowSpan: 6 } },
      { id: "bulletsRight", kind: "bulletsCard", rect: { colStart: 7, colSpan: 6, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    name: "content.leftAccentBar",
    slideTypes: ["content"],
    boxes: [
      { id: "bar", kind: "accentBar", rect: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 8 } },
      { id: "header", kind: "header", rect: { colStart: 2, colSpan: 11, rowStart: 1, rowSpan: 2 } },
      { id: "body", kind: "bulletsCard", rect: { colStart: 2, colSpan: 11, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    name: "content.statement",
    slideTypes: ["content"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "statement", kind: "statementCard", rect: { colStart: 1, colSpan: 12, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    name: "content.splitRightHero",
    slideTypes: ["content"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "body", kind: "bulletsCard", rect: { colStart: 1, colSpan: 7, rowStart: 3, rowSpan: 6 } },
      { id: "image", kind: "imageCard", rect: { colStart: 8, colSpan: 5, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    name: "content.splitLeftHero",
    slideTypes: ["content"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "image", kind: "imageCard", rect: { colStart: 1, colSpan: 5, rowStart: 3, rowSpan: 6 } },
      { id: "body", kind: "bulletsCard", rect: { colStart: 6, colSpan: 7, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    // Two stacked content cards + header. Great for variety without requiring images.
    name: "content.twoStackCards",
    slideTypes: ["content"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "bodyTop", kind: "bulletsCard", rect: { colStart: 1, colSpan: 12, rowStart: 3, rowSpan: 3 } },
      { id: "bodyBottom", kind: "bulletsCard", rect: { colStart: 1, colSpan: 12, rowStart: 6, rowSpan: 3 } },
    ],
  },
  {
    // Three-column cards. Works best with shorter bullets.
    name: "content.threeCards",
    slideTypes: ["content"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "c1", kind: "bulletsCard", rect: { colStart: 1, colSpan: 4, rowStart: 3, rowSpan: 6 } },
      { id: "c2", kind: "bulletsCard", rect: { colStart: 5, colSpan: 4, rowStart: 3, rowSpan: 6 } },
      { id: "c3", kind: "bulletsCard", rect: { colStart: 9, colSpan: 4, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    // Asymmetric two cards (wide + narrow) gives a more editorial feel.
    name: "content.asymTwoCards",
    slideTypes: ["content"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "main", kind: "bulletsCard", rect: { colStart: 1, colSpan: 8, rowStart: 3, rowSpan: 6 } },
      { id: "side", kind: "bulletsCard", rect: { colStart: 9, colSpan: 4, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    // Accent bar + two stacked cards.
    name: "content.accentTwoStack",
    slideTypes: ["content"],
    boxes: [
      { id: "bar", kind: "accentBar", rect: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 8 } },
      { id: "header", kind: "header", rect: { colStart: 2, colSpan: 11, rowStart: 1, rowSpan: 2 } },
      { id: "top", kind: "bulletsCard", rect: { colStart: 2, colSpan: 11, rowStart: 3, rowSpan: 3 } },
      { id: "bottom", kind: "bulletsCard", rect: { colStart: 2, colSpan: 11, rowStart: 6, rowSpan: 3 } },
    ],
  },

  // IMAGE PLACEHOLDER (or IMAGE)
  {
    name: "image.fullBleed",
    slideTypes: ["imagePlaceholder"],
    boxes: [
      // full-bleed image is handled specially by renderer/PPTX; this box just flags it.
      { id: "bg", kind: "fullBleedImage", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 8 } },
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "body", kind: "bulletsCard", rect: { colStart: 1, colSpan: 6, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    name: "image.hero",
    slideTypes: ["imagePlaceholder"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "image", kind: "imageCard", rect: { colStart: 1, colSpan: 8, rowStart: 3, rowSpan: 6 } },
      { id: "body", kind: "bulletsCard", rect: { colStart: 9, colSpan: 4, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    name: "image.captionRight",
    slideTypes: ["imagePlaceholder"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "body", kind: "bulletsCard", rect: { colStart: 1, colSpan: 5, rowStart: 3, rowSpan: 6 } },
      { id: "image", kind: "imageCard", rect: { colStart: 6, colSpan: 7, rowStart: 3, rowSpan: 6 } },
    ],
  },

  // COMPARISON
  {
    name: "comparison.twoCards",
    slideTypes: ["comparison"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "left", kind: "comparisonLeft", rect: { colStart: 1, colSpan: 6, rowStart: 3, rowSpan: 6 } },
      { id: "right", kind: "comparisonRight", rect: { colStart: 7, colSpan: 6, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    // Comparison with a center divider accent bar.
    name: "comparison.divided",
    slideTypes: ["comparison"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "divider", kind: "accentBar", rect: { colStart: 6, colSpan: 1, rowStart: 3, rowSpan: 6 } },
      { id: "left", kind: "comparisonLeft", rect: { colStart: 1, colSpan: 5, rowStart: 3, rowSpan: 6 } },
      { id: "right", kind: "comparisonRight", rect: { colStart: 7, colSpan: 6, rowStart: 3, rowSpan: 6 } },
    ],
  },

  // QUOTE
  {
    name: "quote.full",
    slideTypes: ["quote"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "quote", kind: "quoteCard", rect: { colStart: 1, colSpan: 12, rowStart: 3, rowSpan: 6 } },
    ],
  },
  {
    name: "quote.splitImage",
    slideTypes: ["quote"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { id: "quote", kind: "quoteCard", rect: { colStart: 1, colSpan: 7, rowStart: 3, rowSpan: 6 } },
      { id: "image", kind: "imageCard", rect: { colStart: 8, colSpan: 5, rowStart: 3, rowSpan: 6 } },
    ],
  },

  // TITLE
  {
    name: "title.center",
    slideTypes: ["title"],
    boxes: [
      { id: "header", kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 2, rowSpan: 4 } },
      { id: "image", kind: "imageCard", rect: { colStart: 4, colSpan: 6, rowStart: 6, rowSpan: 3 } },
    ],
  },
];

export function getVariantByName(name: string): LayoutVariant | null {
  return LAYOUT_VARIANTS.find((v) => v.name === name) || null;
}

export function allowedVariantsForSlideType(slideType: string): LayoutVariant[] {
  const t = String(slideType || "").toLowerCase();
  const norm = (t === "image" ? "imagePlaceholder" : t) as any;
  return LAYOUT_VARIANTS.filter((v) => (v.slideTypes as any).includes(norm));
}
