import { PresentationOutline, SlideStructure } from "../types";

export function isValidOutline(outline: any): outline is PresentationOutline {
  return outline && typeof outline.title === "string" && Array.isArray(outline.slides);
}

export function validateSlide(slide: SlideStructure): SlideStructure {
  return {
    ...slide,
    title: slide.title || "Untitled Slide",
    content: slide.content || [],
    notes: slide.notes || "",
    suggestedLayout: slide.suggestedLayout || "Title and Content",
  };
}
