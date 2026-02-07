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
}

export interface PresentationOutline {
  title: string;
  slides: SlideStructure[];
  colorScheme: ColorScheme;
  overallTheme: string;
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
