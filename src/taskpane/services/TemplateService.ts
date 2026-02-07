import type { Template, TemplateCategory } from "../types";
import { AIService } from "./AIService";

export class TemplateService {
  private templates: Template[] = [
    {
      id: "corporate-professional",
      name: "Corporate Professional",
      description: "Clean, business-focused layout for corporate presentations.",
      category: "business",
    },
    {
      id: "academic-clean",
      name: "Academic Clean",
      description: "Structured layout ideal for lectures and academic talks.",
      category: "educational",
    },
    {
      id: "modern-minimalist",
      name: "Modern Minimalist",
      description: "Visual and spacious design for creative storytelling.",
      category: "creative",
    },
    {
      id: "technical-doc",
      name: "Technical Documentation",
      description: "Detail-oriented layout for technical deep dives.",
      category: "technical",
    },
  ];

  constructor(private aiService: AIService) {}

  getAllTemplates(): Template[] {
    return this.templates;
  }

  getTemplate(id: string): Template | undefined {
    return this.templates.find((t) => t.id === id);
  }

  private classifyByKeyword(topic: string): TemplateCategory {
    const lower = topic.toLowerCase();

    if (
      lower.includes("sales") ||
      lower.includes("marketing") ||
      lower.includes("business") ||
      lower.includes("strategy")
    ) {
      return "business";
    }

    if (
      lower.includes("course") ||
      lower.includes("lecture") ||
      lower.includes("class") ||
      lower.includes("training")
    ) {
      return "educational";
    }

    if (
      lower.includes("design") ||
      lower.includes("creative") ||
      lower.includes("story") ||
      lower.includes("brand")
    ) {
      return "creative";
    }

    return "technical";
  }

  async classifyTopicWithAI(topic: string): Promise<TemplateCategory> {
    // IMPORTANT: our backend /outline expects STRICT JSON, so we ask for JSON.
    const prompt = `
Classify the following presentation topic into one of these categories:
- business
- educational
- creative
- technical

Topic: "${topic}"

Return STRICT JSON only:
{ "category": "business" | "educational" | "creative" | "technical" }
`.trim();

    const result = await this.aiService.rawClassification(prompt);
    const cat = (result || "").trim().toLowerCase();

    if (cat === "business" || cat === "educational" || cat === "creative" || cat === "technical") {
      return cat;
    }

    return this.classifyByKeyword(topic);
  }

  async suggestTemplate(topic: string): Promise<Template> {
    // 1) Try heuristic classification quickly
    const heuristicCategory = this.classifyByKeyword(topic);

    // 2) Try AI classification, but fall back if it fails
    let category: TemplateCategory = heuristicCategory;
    try {
      category = await this.classifyTopicWithAI(topic);
    } catch {
      // ignore and keep heuristic
    }

    const map: Record<TemplateCategory, string> = {
      business: "corporate-professional",
      educational: "academic-clean",
      creative: "modern-minimalist",
      technical: "technical-doc",
    };

    const templateId = map[category];
    const template = this.getTemplate(templateId);

    if (!template) {
      return this.templates[0];
    }

    return template;
  }
}
