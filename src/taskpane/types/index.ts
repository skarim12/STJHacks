export type SlideType = "title" | "content" | "comparison" | "image" | "quote";

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface UserPreferences {
  tone: "formal" | "casual" | "technical" | "inspirational";
  audience: string;
  slideCount: "short" | "medium" | "long";
  includeResearch: boolean;
}

export interface SlideStructure {
  title: string;
  slideType: SlideType;
  content: string[];
  notes: string;
  suggestedLayout: string;
  /** Optional user-provided description (used for image search/generation + layout hints). */
  describe?: string;
  /** Optional per-slide look preset (affects rendering only, not content). */
  look?: "default" | "light" | "dark" | "bold";
}

export interface PresentationOutline {
  title: string;
  slides: SlideStructure[];
  colorScheme: ColorScheme;
  overallTheme: string;
  /** Optional deck-level user description (applies as a hint across slides). */
  describe?: string;
  /** Optional deck-level look preset (affects rendering only, not content). */
  look?: "default" | "light" | "dark" | "bold";
}

export interface ResearchResult {
  keyFacts: string[];
  recentDevelopments: string[];
  expertPerspectives: string[];
  examples: string[];
}

export interface ImageSuggestion {
  searchTerm: string;
  description: string;
  suggestedSlides: number[];
}

export interface FactCheckResult {
  claim: string;
  verdict: "true" | "false" | "uncertain";
  explanation: string;
  sources: string[];
}

// NEW: Template-related types
export type TemplateCategory = "business" | "educational" | "creative" | "technical";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
}
