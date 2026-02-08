export type SlideType =
  | 'title'
  | 'section'
  | 'content'
  | 'bullets'
  | 'twoColumn'
  | 'comparison'
  | 'quote'
  | 'blank';

export type SlideLayout = 'full' | 'left' | 'right' | 'centered' | 'split';

export interface ImagePlaceholder {
  id: string;
  description: string;
  position: 'left' | 'right' | 'center' | 'background';
  suggestedType: 'chart' | 'diagram' | 'photo' | 'icon' | 'screenshot';
}

export interface ThemeTokens {
  primaryColor: string; // HSL triplet: "220 70% 50%"
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontHeading: string;
  fontBody: string;
  fontSize: 'small' | 'medium' | 'large';
}

export interface SelectedAsset {
  kind: 'photo' | 'icon' | 'svg' | 'chart';
  dataUri?: string;
  sourceUrl?: string;
  attribution?: string;
  license?: string;
  altText: string;
}

export interface LayoutBox {
  id: string;
  kind: 'title' | 'subtitle' | 'bullets' | 'body' | 'image' | 'shape';
  x: number;
  y: number;
  w: number;
  h: number;

  // Text styling (optional; renderer will apply safe defaults/fallbacks)
  fontFace?: string;
  fontSize?: number;
  color?: string; // hex like #RRGGBB
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';

  // For shapes
  fill?: string; // hex
  line?: string; // hex
  radius?: number; // for rounded rects
}

export interface SlideLayoutPlan {
  version: '1.0';
  slideW: number; // inches (PPT wide is 13.333)
  slideH: number; // inches (PPT wide is 7.5)
  boxes: LayoutBox[];
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

  /** Resolved/selected visuals to use when rendering. */
  selectedAssets?: SelectedAsset[];

  /**
   * AI-generated raw layout plan (exact box positions/sizes).
   * If missing, renderers fall back to deterministic templates.
   */
  layoutPlan?: SlideLayoutPlan;

  leftColumn?: { heading?: string; bullets?: string[] };
  rightColumn?: { heading?: string; bullets?: string[] };

  quote?: { text: string; attribution?: string };

  // Phase A-D extensions
  visualIntent?: VisualIntent;
}

export interface DeckMetadata {
  createdAt: string;
  updatedAt: string;
  author?: string;
  version: string;
  tags?: string[];
  targetAudience?: string;
  estimatedDuration?: number;
}

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
  assets?: AssetManifest;
  renderPlan?: RenderPlan;
  /** Optional QA report emitted by the orchestrator. */
  qa?: { pass: boolean; score: number; issues: Array<{ level: string; slideId?: string; message: string }> };
  error?: string;
  warnings?: string[];
}

// --- Visuals / Assets / Render Plan ---

export type VisualType = 'photo' | 'icon' | 'diagram' | 'chart' | 'table' | 'timeline' | 'none';

export interface VisualIntent {
  visualType: VisualType;
  visualGoal: string; // what it should communicate
  queryTerms?: string[];
  // If diagram
  diagramSpec?: {
    kind: 'steps' | 'flow';
    steps: string[];
  };
  // If chart
  chartSpec?: {
    kind: 'bar' | 'line' | 'pie';
    title?: string;
    labels: string[];
    values: number[];
    unit?: string;
  };
}

export interface AssetItem {
  assetId: string;
  kind: 'photo' | 'icon' | 'svg' | 'chart';
  title?: string;
  sourceUrl?: string;
  license?: string;
  attribution?: string;
  altText: string;
  // One of these will be present
  dataUri?: string; // for generated svg/png
  filePath?: string; // for downloaded assets
  width?: number;
  height?: number;
  dominantColors?: string[];
}

export interface AssetManifest {
  items: AssetItem[];
  bySlideId: Record<string, string[]>; // slideId -> assetIds
}

export type LayoutTemplate =
  | 'TITLE_CENTER'
  | 'TITLE_LEFT_VISUAL_RIGHT'
  | 'TITLE_TOP_VISUAL_FULL'
  | 'TWO_COLUMN'
  | 'QUOTE_CENTER'
  | 'SECTION_SPLASH';

export interface RenderPlanSlide {
  slideId: string;
  template: LayoutTemplate;
  emphasis?: 'text' | 'visual' | 'balanced';
}

export interface RenderPlan {
  version: '1.0';
  slides: RenderPlanSlide[];
}
