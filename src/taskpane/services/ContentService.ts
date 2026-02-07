import { AIService } from "./AIService";

export class ContentService {
  constructor(private aiService: AIService) {}

  async summarizeForSlide(longText: string, maxBullets: number = 5): Promise<string[]> {
    return this.aiService.summarizeForSlide(longText, maxBullets);
  }

  async expandBulletPoint(bullet: string): Promise<string> {
    return this.aiService.expandBulletPoint(bullet);
  }
}
