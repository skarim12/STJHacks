import axios from "axios";
import type {
  PresentationOutline,
  UserPreferences,
  SlideStructure,
  ResearchResult,
  ImageSuggestion,
  FactCheckResult,
  ColorScheme,
} from "../types";
import { buildOutlinePrompt } from "../utils/promptBuilder";

const API_BASE = process.env.BACKEND_URL || "http://localhost:4000/api";

export class AIService {
  async generatePresentationOutline(
    userIdea: string,
    preferences?: UserPreferences
  ): Promise<PresentationOutline> {
    const prompt = buildOutlinePrompt(userIdea, preferences);
    const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
    return response.data as PresentationOutline;
  }

  /**
   * Used internally by TemplateService and ThemeService for simple responses.
   * NOTE: our backend /outline expects STRICT JSON and returns parsed JSON.
   */
  async rawClassification(prompt: string): Promise<string> {
    const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
    const data = response.data;

    if (typeof data === "string") return data;
    if (typeof data?.result === "string") return data.result;
    if (typeof data?.category === "string") return data.category;

    return JSON.stringify(data);
  }

  async generateColorSchemeFromContext(
    industry: string,
    mood: "professional" | "creative" | "energetic"
  ): Promise<ColorScheme> {
    const prompt = `
Suggest a harmonious color scheme for a ${mood} ${industry} presentation.

Return STRICT JSON only:
{
  "primary": "#RRGGBB",
  "secondary": "#RRGGBB",
  "accent": "#RRGGBB",
  "background": "#RRGGBB",
  "text": "#RRGGBB"
}
`.trim();

    const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
    return response.data as ColorScheme;
  }

  async summarizeForSlide(longText: string, maxBullets: number = 5): Promise<string[]> {
    const prompt = `
Summarize this content into ${maxBullets} concise, impactful bullet points suitable for a PowerPoint slide.

${longText}

Each bullet should be 10-15 words maximum.
Return ONLY a JSON array of strings, e.g. ["point 1", "point 2"].
`.trim();

    const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
    const data = response.data;

    if (Array.isArray(data)) return data as string[];
    if (Array.isArray(data?.bullets)) return data.bullets as string[];

    throw new Error("Unexpected summarizeForSlide response format");
  }

  async expandBulletPoint(bullet: string): Promise<string> {
    // Backend expects JSON; request JSON and pull notes.
    const prompt = `
Expand the following bullet point into detailed speaker notes for a PowerPoint presentation:
"${bullet}"

Return STRICT JSON only: { "notes": "..." }
`.trim();

    const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
    const data = response.data;

    if (typeof data === "string") return data;
    if (typeof data?.notes === "string") return data.notes;

    return JSON.stringify(data);
  }

  async enhanceSlideContent(
    slideTitle: string,
    currentContent: string[],
    context: string
  ): Promise<string[]> {
    const prompt = `
You are improving content for a single PowerPoint slide.

Slide title: ${slideTitle}
Existing bullet points:
${currentContent.map((c) => `- ${c}`).join("\n")}

Context of the overall presentation:
${context}

Return ONLY an array of improved bullet points as JSON, e.g. ["point 1", "point 2"].
`.trim();

    const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
    const data = response.data;

    if (Array.isArray(data)) return data as string[];
    if (Array.isArray(data?.slides?.[0]?.content)) {
      return data.slides[0].content as string[];
    }

    throw new Error("Unexpected enhanceSlideContent response format");
  }

  async generateSpeakerNotes(slide: SlideStructure): Promise<string> {
    // Backend expects JSON; request JSON and pull notes.
    const prompt = `
Generate detailed speaker notes for this PowerPoint slide.

Title: ${slide.title}
Type: ${slide.slideType}
Bullet points:
${slide.content.map((c) => `- ${c}`).join("\n")}

Return STRICT JSON only: { "notes": "..." }
`.trim();

    const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
    const data = response.data;

    if (typeof data === "string") return data;
    if (typeof data?.notes === "string") return data.notes;

    return JSON.stringify(data);
  }

  async researchTopic(topic: string, depth: "quick" | "detailed"): Promise<ResearchResult> {
    const response = await axios.post(`${API_BASE}/research`, { topic, depth });
    return response.data as ResearchResult;
  }

  async findRelevantImages(topic: string): Promise<ImageSuggestion[]> {
    // Static suggestions; can be AI-driven later
    return [
      {
        searchTerm: `${topic} infographic`,
        description: "Visual overview of key concepts",
        suggestedSlides: [2, 3],
      },
      {
        searchTerm: `${topic} statistics chart`,
        description: "Data visualization of key metrics",
        suggestedSlides: [3, 4],
      },
    ];
  }

  async factCheck(claim: string): Promise<FactCheckResult> {
    const response = await axios.post(`${API_BASE}/fact-check`, { claim });
    return response.data as FactCheckResult;
  }
}
