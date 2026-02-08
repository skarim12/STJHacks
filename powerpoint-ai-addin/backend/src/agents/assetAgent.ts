import type { AssetManifest, Slide, VisualIntent } from '../types/deck.js';
import { newId } from '../utils/id.js';
import { renderSimpleBarChartSvg, renderStepsDiagramSvg, svgToDataUri } from '../utils/svg.js';

export const AssetAgent = {
  /**
   * Phase B/D: generate deterministic SVG assets for diagrams/charts.
   * Phase C: stock photos/icons are selected via UI endpoints.
   */
  run(slides: Slide[]): { assets: AssetManifest; warnings: string[] } {
    const warnings: string[] = [];
    const assets: AssetManifest = { items: [], bySlideId: {} };

    for (const s of slides) {
      const intent = s.visualIntent;
      if (!intent || intent.visualType === 'none') continue;

      const slideAssets: string[] = [];

      if (intent.visualType === 'diagram' && intent.diagramSpec?.steps?.length) {
        const { svg, width, height } = renderStepsDiagramSvg({ title: s.title, steps: intent.diagramSpec.steps });
        const assetId = newId('asset');
        assets.items.push({
          assetId,
          kind: 'svg',
          title: `Diagram: ${s.title}`,
          altText: `Diagram showing steps for ${s.title}`,
          dataUri: svgToDataUri(svg),
          width,
          height
        });
        slideAssets.push(assetId);
      }

      if (intent.visualType === 'chart' && intent.chartSpec?.labels?.length) {
        const { svg, width, height } = renderSimpleBarChartSvg({
          title: intent.chartSpec.title ?? s.title,
          labels: intent.chartSpec.labels,
          values: intent.chartSpec.values,
          unit: intent.chartSpec.unit
        });
        const assetId = newId('asset');
        assets.items.push({
          assetId,
          kind: 'chart',
          title: `Chart: ${s.title}`,
          altText: `Chart for ${s.title}`,
          dataUri: svgToDataUri(svg),
          width,
          height
        });
        slideAssets.push(assetId);
      }

      if (intent.visualType === 'photo' || intent.visualType === 'icon') {
        warnings.push(
          `Slide "${s.title}": ${intent.visualType} is stock-preferred. Use /api/assets/search to pick one; AI fallback can be added later.`
        );
      }

      if (slideAssets.length) assets.bySlideId[s.id] = slideAssets;
    }

    return { assets, warnings };
  }
};
