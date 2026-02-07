import axios, { AxiosError } from "axios";
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

const API_BASE =
  (typeof window !== "undefined" && (window as any).__BACKEND_URL__) ||
  "http://localhost:4000/api";

function extractApiError(err: unknown): string {
  // Axios errors from backend often include { error, details }
  const ax = err as AxiosError<any>;
  const status = (ax as any)?.response?.status;
  const data = (ax as any)?.response?.data;

  if (data) {
    const msg = data?.details || data?.error || data?.message;
    if (msg) return status ? `HTTP ${status}: ${msg}` : String(msg);
    try {
      return status ? `HTTP ${status}: ${JSON.stringify(data)}` : JSON.stringify(data);
    } catch {
      // ignore
    }
  }

  const anyErr = err as any;
  return anyErr?.message || String(err);
}

export class AIService {
  async generatePresentationOutline(
    userIdea: string,
    preferences?: UserPreferences
  ): Promise<PresentationOutline> {
    const prompt = buildOutlinePrompt(userIdea, preferences);
    try {
      const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
      return response.data as PresentationOutline;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }
  }

  /**
   * Used internally by TemplateService and ThemeService for simple responses.
   * NOTE: our backend /outline expects STRICT JSON and returns parsed JSON.
   */
  async rawClassification(prompt: string): Promise<string> {
    let data: any;
    try {
      const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
      data = response.data;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }

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

    try {
      const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
      return response.data as ColorScheme;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }
  }

  async generateThemeFromDescribe(describe: string): Promise<{ colorScheme: ColorScheme; themeStyle: any }> {
    const d = String(describe || "").trim();
    if (!d) throw new Error("describe required");

    const prompt = `
You are a presentation brand designer.

Create a cohesive theme based on this description:
${d}

Return STRICT JSON only:
{
  "colorScheme": {
    "primary": "#RRGGBB",
    "secondary": "#RRGGBB",
    "accent": "#RRGGBB",
    "background": "#RRGGBB",
    "text": "#RRGGBB"
  },
  "themeStyle": {
    "background": { "kind": "solid|gradient|vignette" },
    "panels": { "kind": "glass|solid|none" },
    "accents": { "kind": "divider|bars|minimal" },
    "mood": "minimal|bold|classic"
  }
}

Rules:
- background/text MUST have strong contrast.
- Default to a DARK background theme unless the description explicitly requests a light theme.
- Prefer safe, professional colors (no neon unless asked).
- If mood is minimal: panels should be none or very subtle.
- If mood is bold: use bars accents and vignette or gradient background.
`.trim();

    try {
      const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
      const data = response.data as any;
      if (data?.colorScheme) return { colorScheme: data.colorScheme as ColorScheme, themeStyle: data.themeStyle || {} };
      // Back-compat if model returns just a color scheme
      return { colorScheme: data as ColorScheme, themeStyle: {} };
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }
  }

  async summarizeForSlide(longText: string, maxBullets: number = 5): Promise<string[]> {
    const prompt = `
Summarize this content into ${maxBullets} concise, impactful bullet points suitable for a PowerPoint slide.

${longText}

Each bullet should be 10-15 words maximum.
Return ONLY a JSON array of strings, e.g. ["point 1", "point 2"].
`.trim();

    let data: any;
    try {
      const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
      data = response.data;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }

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

    let data: any;
    try {
      const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
      data = response.data;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }

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

    let data: any;
    try {
      const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
      data = response.data;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }

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

    let data: any;
    try {
      const response = await axios.post(`${API_BASE}/outline`, { userIdea: prompt });
      data = response.data;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }

    if (typeof data === "string") return data;
    if (typeof data?.notes === "string") return data.notes;

    return JSON.stringify(data);
  }

  async researchTopic(topic: string, depth: "quick" | "detailed"): Promise<ResearchResult> {
    try {
      const response = await axios.post(`${API_BASE}/research`, { topic, depth });
      return response.data as ResearchResult;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }
  }

  async editOutline(outline: PresentationOutline, message: string): Promise<PresentationOutline> {
    try {
      const response = await axios.post(`${API_BASE}/edit-outline`, { outline, message });
      return response.data as PresentationOutline;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }
  }

  async exportPptx(
    outline: PresentationOutline,
    allowExternalImages: boolean = false,
    allowGeneratedImages: boolean = false,
    imageStyle: "photo" | "illustration" = "photo"
  ): Promise<Blob> {
    try {
      const response = await axios.post(
        `${API_BASE}/export-pptx`,
        { outline, allowExternalImages, allowGeneratedImages, imageStyle },
        { responseType: "blob" }
      );
      return response.data as Blob;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }
  }

  async exportPdf(
    outline: PresentationOutline,
    useAi: boolean = true,
    allowExternalImages: boolean = false,
    allowGeneratedImages: boolean = false
  ): Promise<Blob> {
    try {
      const response = await axios.post(
        `${API_BASE}/export-pdf`,
        { outline, useAi, allowExternalImages, allowGeneratedImages },
        { responseType: "blob" }
      );
      return response.data as Blob;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }
  }

  async getDeckHtml(
    outline: PresentationOutline,
    useAi: boolean = true,
    allowExternalImages: boolean = false,
    allowGeneratedImages: boolean = false
  ): Promise<string> {
    try {
      const response = await axios.post(`${API_BASE}/deck-html`, {
        outline,
        useAi,
        allowExternalImages,
        allowGeneratedImages,
      });
      return String((response.data as any)?.html || "");
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }
  }

  async importPptx(file: File): Promise<{ extractedText: string; outline: PresentationOutline }> {
    const form = new FormData();
    form.append("file", file);

    try {
      const response = await axios.post(`${API_BASE}/import-pptx`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return response.data as { extractedText: string; outline: PresentationOutline };
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }
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
    try {
      const response = await axios.post(`${API_BASE}/fact-check`, { claim });
      return response.data as FactCheckResult;
    } catch (err: any) {
      throw new Error(extractApiError(err));
    }
  }
}
