import type { Slide, VisualIntent, DeckGenerationRequest } from '../types/deck.js';
import { newId } from '../utils/id.js';

export const VisualIntentAgent = {
  run(req: DeckGenerationRequest, slide: Slide): VisualIntent {
    if (slide.slideType === 'title') {
      return {
        visualType: 'photo',
        visualGoal: 'Provide an attractive title backdrop that matches the topic',
        queryTerms: req.prompt.split(/\s+/).slice(0, 6)
      };
    }

    // simple heuristic: diagram for "How It Works" slide, chart for "Impact"
    if (slide.title.toLowerCase().includes('how it works')) {
      return {
        visualType: 'diagram',
        visualGoal: 'Explain the process at a glance',
        diagramSpec: {
          kind: 'steps',
          steps: ['Input', 'Analyze', 'Compose', 'Render', 'Review']
        }
      };
    }

    if (slide.title.toLowerCase().includes('impact')) {
      return {
        visualType: 'chart',
        visualGoal: 'Show a clear improvement or trend',
        chartSpec: {
          kind: 'bar',
          title: 'Impact (Example)',
          labels: ['Before', 'After'],
          values: [42, 78],
          unit: '%'
        }
      };
    }

    return {
      visualType: 'icon',
      visualGoal: 'Add a simple icon to reinforce the slide topic',
      queryTerms: slide.title.split(/\s+/)
    };
  },

  attachPlaceholder(slide: Slide): void {
    if (!slide.visualIntent || slide.visualIntent.visualType === 'none') return;
    slide.imagePlaceholders = [
      {
        id: newId('ph'),
        description: `${slide.visualIntent.visualType}: ${slide.visualIntent.visualGoal}`,
        position: slide.slideType === 'title' ? 'background' : 'right',
        suggestedType:
          slide.visualIntent.visualType === 'diagram'
            ? 'diagram'
            : slide.visualIntent.visualType === 'chart'
              ? 'chart'
              : slide.visualIntent.visualType === 'photo'
                ? 'photo'
                : 'icon'
      }
    ];
  }
};
