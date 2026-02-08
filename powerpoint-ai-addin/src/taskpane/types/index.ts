// Legacy types used by the current outline-generation flow
export type SlideType = 'title' | 'content' | 'comparison' | 'image' | 'quote';

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface SlideStructure {
  title: string;
  slideType: SlideType;
  content: string[];
  notes?: string;
  suggestedLayout?: string;
}

export interface PresentationOutline {
  title: string;
  slides: SlideStructure[];
  colorScheme: ColorScheme;
  overallTheme?: string;
}

// New (text-first) deck schema used by the prototype + eventual add-in
export * from './deck';
