import axios from "axios";
import type { SlideOutline, ResearchData } from "../state/usePresentationStore";

const API_BASE_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function generateSlideOutlines(
  roughIdea: string
): Promise<{ refinedPrompt: string; slides: SlideOutline[] }> {
  const response = await axios.post(`${API_BASE_URL}/api/generateSlides`, {
    roughIdea
  });
  return response.data;
}

export async function performResearch(topic: string): Promise<ResearchData> {
  const response = await axios.post(`${API_BASE_URL}/api/research`, {
    topic
  });
  return response.data;
}