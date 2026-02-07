import { AIService } from "./AIService";
import type { ResearchResult, ImageSuggestion, FactCheckResult } from "../types";

export class ResearchService {
  constructor(private aiService: AIService) {}

  async researchTopic(topic: string, depth: "quick" | "detailed" = "quick"): Promise<ResearchResult> {
    return this.aiService.researchTopic(topic, depth);
  }

  async findRelevantImages(topic: string): Promise<ImageSuggestion[]> {
    return this.aiService.findRelevantImages(topic);
  }

  async factCheck(claim: string): Promise<FactCheckResult> {
    return this.aiService.factCheck(claim);
  }
}
