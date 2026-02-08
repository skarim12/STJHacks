import type { RenderPlan, Slide } from '../types/deck.js';

export const RenderPlanAgent = {
  run(slides: Slide[]): RenderPlan {
    return {
      version: '1.0',
      slides: slides.map((s) => {
        if (s.slideType === 'title') return { slideId: s.id, template: 'TITLE_TOP_VISUAL_FULL', emphasis: 'visual' };
        if (s.slideType === 'section') return { slideId: s.id, template: 'SECTION_SPLASH', emphasis: 'text' };
        if (s.slideType === 'quote') return { slideId: s.id, template: 'QUOTE_CENTER', emphasis: 'text' };

        const vt = s.visualIntent?.visualType;
        if (vt === 'diagram' || vt === 'chart' || vt === 'photo') {
          return { slideId: s.id, template: 'TITLE_LEFT_VISUAL_RIGHT', emphasis: 'balanced' };
        }
        return { slideId: s.id, template: 'TITLE_LEFT_VISUAL_RIGHT', emphasis: 'text' };
      })
    };
  }
};
