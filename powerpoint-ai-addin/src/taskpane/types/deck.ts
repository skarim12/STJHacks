/**
 * Deck JSON Schema for PowerPoint Task Pane Add-in
 *
 * Text-first: supports image placeholders (descriptions only) so it works in
 * environments where uploading/sending images is not possible.
 */

// Slide type variants
export type SlideType =
  | 'title'
  | 'section'
  | 'content'
  | 'bullets'
  | 'twoColumn'
  | 'comparison'
  | 'quote'
  | 'blank';

// Layout options for slides
export type SlideLayout = 'full' | 'left' | 'right' | 'centered' | 'split';

/**
 * Stable ID helper.
 * - Prefers crypto.randomUUID when available
 * - Falls back to timestamp + random
 */
export const newId = (prefix: string): string => {
  const uuid = (globalThis as any)?.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
};

/**
 * Convert a "CSS HSL triplet" string like "220 70% 50%" into a usable CSS color.
 */
export const hsl = (triplet: string): string => `hsl(${triplet})`;

// Image placeholder (no actual images - text description only)
export interface ImagePlaceholder {
  id: string;
  description: string; // e.g., "Chart showing Q1 revenue growth"
  position: 'left' | 'right' | 'center' | 'background';
  suggestedType: 'chart' | 'diagram' | 'photo' | 'icon' | 'screenshot';
}

// Theme tokens for consistent styling
export interface ThemeTokens {
  /** HSL triplet: "220 70% 50%" */
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontHeading: string; // e.g., "Segoe UI"
  fontBody: string;
  fontSize: 'small' | 'medium' | 'large';
}

// Individual slide definition
export interface SelectedAsset {
  kind: 'photo' | 'icon' | 'svg' | 'chart';
  dataUri?: string; // e.g., data:image/jpeg;base64,... or data:image/svg+xml,...
  sourceUrl?: string;
  attribution?: string;
  license?: string;
  altText: string;
}

export interface Slide {
  id: string;
  order: number;
  slideType: SlideType;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  bodyText?: string;
  speakerNotes?: string;
  imagePlaceholders?: ImagePlaceholder[];

  /** Optional resolved assets chosen in the UI (stock preferred, AI fallback). */
  selectedAssets?: SelectedAsset[];

  // For comparison/twoColumn layouts
  leftColumn?: {
    heading?: string;
    bullets?: string[];
  };
  rightColumn?: {
    heading?: string;
    bullets?: string[];
  };

  // For quote slides
  quote?: {
    text: string;
    attribution?: string;
  };
}

// Deck metadata
export interface DeckMetadata {
  createdAt: string;
  updatedAt: string;
  author?: string;
  version: string;
  tags?: string[];
  targetAudience?: string;
  estimatedDuration?: number; // minutes
}

// Complete deck schema
export interface DeckSchema {
  id: string;
  title: string;
  description?: string;
  theme: ThemeTokens;
  /** Optional decoration tokens (e.g., gradient) for exporters/renderers. */
  decoration?: DecorationTokens;
  slides: Slide[];
  metadata: DeckMetadata;
}

// Generation request payload (sent to backend)
export interface DeckGenerationRequest {
  prompt: string;
  /** Optional design prompt; when omitted, the system picks a default style direction. */
  designPrompt?: string;
  slideCount?: number;
  theme?: Partial<ThemeTokens>;
  includeSlideTypes?: SlideType[];
  targetAudience?: string;
  tone?: 'formal' | 'casual' | 'technical' | 'creative';
}

// Generation response from backend
export interface DecorationTokens {
  backgroundStyle: 'solid' | 'softGradient' | 'boldGradient';
  cornerBlobs: boolean;
  headerStripe: boolean;
  cardStyle: 'flat' | 'softShadow';
  imageTreatment: 'square' | 'rounded';
  /** CSS linear-gradient(...) using hsl(...) */
  gradientCss: string;
}

export interface StylePreset {
  id: string;
  name: string;
  theme: ThemeTokens;
  decoration: DecorationTokens;
}

export interface DeckGenerationResponse {
  success: boolean;
  deck?: DeckSchema;
  stylePresets?: StylePreset[];
  recommendedStyleId?: string;
  error?: string;
  warnings?: string[];
}

// Default theme tokens
export const DEFAULT_THEME: ThemeTokens = {
  primaryColor: '220 70% 50%',
  secondaryColor: '220 15% 40%',
  accentColor: '35 90% 55%',
  backgroundColor: '220 15% 98%',
  textColor: '220 15% 15%',
  fontHeading: 'Segoe UI',
  fontBody: 'Segoe UI',
  fontSize: 'medium'
};

// Helper to create empty slide
export const createEmptySlide = (order: number, slideType: SlideType = 'content'): Slide => ({
  id: newId('slide'),
  order,
  slideType,
  layout: 'full',
  title: '',
  bullets: slideType === 'bullets' ? [''] : undefined
});

// Helper to create empty deck
export const createEmptyDeck = (title: string = 'Untitled Deck'): DeckSchema => ({
  id: newId('deck'),
  title,
  theme: { ...DEFAULT_THEME },
  slides: [createEmptySlide(0, 'title')],
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0'
  }
});
