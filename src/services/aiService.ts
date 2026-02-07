import {
  PresentationOutline,
  UserPreferences,
  SlideStructure,
  ResearchResult,
  ImageSuggestion,
  FactCheckResult
} from "../types";

const API_BASE = process.env.BACKEND_URL || "http://localhost:4000/api";

export class AIService {
  async generatePresentationOutline(
    userIdea: string,
    preferences?: UserPreferences
  ): Promise<PresentationOutline> {
    const response = await fetch(`${API_BASE}/outline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIdea, preferences })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to generate outline");
    }

    const outline = (await response.json()) as PresentationOutline;
    return outline;
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

    const response = await fetch(`${API_BASE}/outline`, {
      // Reuse outline endpoint with a different prompt is not ideal;
      // in production you'd expose a dedicated endpoint. For now:
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIdea: prompt })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to enhance slide content");
    }

    const json = await response.json();
    // Expect json.slides[0].content or just json (array)
    if (Array.isArray(json)) return json as string[];
    if (Array.isArray(json?.slides?.[0]?.content)) {
      return json.slides[0].content as string[];
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

    const response = await fetch(`${API_BASE}/outline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIdea: prompt })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to generate speaker notes");
    }

    const json = await response.json();
    if (typeof json === "string") return json;
    if (typeof json.notes === "string") return json.notes;
    return JSON.stringify(json);
  }

  async researchTopic(topic: string, depth: "quick" | "detailed"): Promise<ResearchResult> {
    const response = await fetch(`${API_BASE}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, depth })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to research topic");
    }
    return (await response.json()) as ResearchResult;
  }

  async findRelevantImages(topic: string): Promise<ImageSuggestion[]> {
    // Simple deterministic suggestions; you can later drive this via AI if you like
    return [
      {
        searchTerm: `${topic} infographic`,
        description: "High-level visual overview",
        suggestedSlides: [2, 3]
      },
      {
        searchTerm: `${topic} statistics chart`,
        description: "Data visualization",
        suggestedSlides: [3, 4]
      }
    ];
  }

  async factCheck(claim: string): Promise<FactCheckResult> {
    const response = await fetch(`${API_BASE}/fact-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to fact check");
    }
    return (await response.json()) as FactCheckResult;
  }
}