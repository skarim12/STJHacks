import axios from "axios";
import type {
  PresentationOutline,
  UserPreferences,
  SlideStructure,
  ResearchResult,
  ImageSuggestion,
  FactCheckResult,
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

Return ONLY an array of improved bullet points as JSON, e.g.:
["point 1", "point 2"]
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
    const prompt = `
Generate detailed speaker notes for this PowerPoint slide.

Title: ${slide.title}
Type: ${slide.slideType}
Bullet points:
${slide.content.map((c) => `- ${c}`).join("\n")}

Return ONLY a plain text paragraph of speaker notes.
`.trim();

    const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
    const data = response.data;
    if (typeof data === "string") return data;
    if (typeof data.notes === "string") return data.notes;
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
