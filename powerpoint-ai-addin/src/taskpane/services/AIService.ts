import axios from 'axios';
import type { PresentationOutline } from '../types';

export class AIService {
  constructor(private cfg: { baseUrl: string }) {}

  async generatePresentationOutline(userIdea: string): Promise<PresentationOutline> {
    const { data } = await axios.post(`${this.cfg.baseUrl}/api/outline`, { idea: userIdea });
    return data as PresentationOutline;
  }
}
