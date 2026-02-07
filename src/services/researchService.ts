import { performResearch } from "./aiService";
import type { ResearchData } from "../state/usePresentationStore";

export async function getResearch(topic: string): Promise<ResearchData> {
  return performResearch(topic);
}
