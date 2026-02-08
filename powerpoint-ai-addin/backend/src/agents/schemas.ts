import { z } from 'zod';

export const SlideTypeZ = z.enum([
  'title',
  'section',
  'content',
  'bullets',
  'twoColumn',
  'comparison',
  'quote',
  'blank'
]);

export const SlideLayoutZ = z.enum(['full', 'left', 'right', 'centered', 'split']);

export const ThemeTokensZ = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  accentColor: z.string(),
  backgroundColor: z.string(),
  textColor: z.string(),
  fontHeading: z.string(),
  fontBody: z.string(),
  fontSize: z.enum(['small', 'medium', 'large'])
});

export const ImagePlaceholderZ = z.object({
  id: z.string(),
  description: z.string(),
  position: z.enum(['left', 'right', 'center', 'background']),
  suggestedType: z.enum(['chart', 'diagram', 'photo', 'icon', 'screenshot'])
});

export const VisualIntentZ = z
  .object({
    visualType: z.enum(['photo', 'icon', 'diagram', 'chart', 'table', 'timeline', 'none']),
    visualGoal: z.string(),
    queryTerms: z.array(z.string()).optional(),
    diagramSpec: z
      .object({
        kind: z.enum(['steps', 'flow']),
        steps: z.array(z.string()).min(1)
      })
      .optional(),
    chartSpec: z
      .object({
        kind: z.enum(['bar', 'line', 'pie']),
        title: z.string().optional(),
        labels: z.array(z.string()).min(1),
        values: z.array(z.number()).min(1),
        unit: z.string().optional()
      })
      .optional()
  })
  .superRefine((v, ctx) => {
    if (v.visualType === 'diagram' && !v.diagramSpec) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'diagramSpec is required when visualType=diagram' });
    }
    if (v.visualType === 'chart' && !v.chartSpec) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'chartSpec is required when visualType=chart' });
    }
  });

export const SelectedAssetZ = z.object({
  kind: z.enum(['photo', 'icon', 'svg', 'chart']),
  dataUri: z.string().optional(),
  sourceUrl: z.string().optional(),
  attribution: z.string().optional(),
  license: z.string().optional(),
  altText: z.string()
});

export const LayoutBoxZ = z.object({
  id: z.string(),
  kind: z.enum(['title', 'subtitle', 'bullets', 'body', 'image', 'shape']),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  fontFace: z.string().optional(),
  fontSize: z.number().optional(),
  color: z.string().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  valign: z.enum(['top', 'middle', 'bottom']).optional(),
  fill: z.string().optional(),
  line: z.string().optional(),
  radius: z.number().optional()
});

export const SlideLayoutPlanZ = z.object({
  version: z.literal('1.0'),
  slideW: z.number(),
  slideH: z.number(),
  boxes: z.array(LayoutBoxZ).min(1)
});

export const DecorationTokensZ = z.object({
  backgroundStyle: z.enum(['solid', 'softGradient', 'boldGradient']),
  cornerBlobs: z.boolean(),
  headerStripe: z.boolean(),
  cardStyle: z.enum(['flat', 'softShadow']),
  imageTreatment: z.enum(['square', 'rounded']),
  gradientCss: z.string()
});

export const StylePresetZ = z.object({
  id: z.string(),
  name: z.string(),
  theme: ThemeTokensZ,
  decoration: DecorationTokensZ
});

export const SlideZ = z.object({
  id: z.string(),
  order: z.number().int().nonnegative(),
  slideType: SlideTypeZ,
  layout: SlideLayoutZ,
  title: z.string(),
  subtitle: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  bodyText: z.string().optional(),
  speakerNotes: z.string().optional(),
  imagePlaceholders: z.array(ImagePlaceholderZ).optional(),
  selectedAssets: z.array(SelectedAssetZ).optional(),
  leftColumn: z
    .object({ heading: z.string().optional(), bullets: z.array(z.string()).optional() })
    .optional(),
  rightColumn: z
    .object({ heading: z.string().optional(), bullets: z.array(z.string()).optional() })
    .optional(),
  quote: z.object({ text: z.string(), attribution: z.string().optional() }).optional(),
  visualIntent: VisualIntentZ.optional(),
  layoutPlan: SlideLayoutPlanZ.optional()
});

export const DeckMetadataZ = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  author: z.string().optional(),
  version: z.string(),
  tags: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  estimatedDuration: z.number().optional()
});

export const DeckSchemaZ = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  theme: ThemeTokensZ,
  decoration: DecorationTokensZ.optional(),
  slides: z.array(SlideZ),
  metadata: DeckMetadataZ
});

export const DeckGenerationRequestZ = z.object({
  prompt: z.string().min(1),
  designPrompt: z.string().min(1).optional(),
  slideCount: z.number().int().min(1).max(30).optional(),
  theme: ThemeTokensZ.partial().optional(),
  includeSlideTypes: z.array(SlideTypeZ).optional(),
  targetAudience: z.string().optional(),
  tone: z.enum(['formal', 'casual', 'technical', 'creative']).optional()
});

export const SlidePatchZ = SlideZ.partial().extend({ id: z.never().optional(), order: z.never().optional() });

export const SlideEditRequestZ = z.object({
  instruction: z.string().optional(),
  patch: SlidePatchZ.optional()
});

export const SlideEditResponseZ = z.object({
  success: z.boolean(),
  slideId: z.string(),
  patch: SlidePatchZ,
  warnings: z.array(z.string()).optional()
});
