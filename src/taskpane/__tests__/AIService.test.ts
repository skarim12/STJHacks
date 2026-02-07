import axios from "axios";
import { AIService } from "../services/AIService";
import type { PresentationOutline } from "../types";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("AIService", () => {
  let service: AIService;

  beforeEach(() => {
    service = new AIService();
    jest.clearAllMocks();
  });

  test("generates presentation outline", async () => {
    const fakeOutline: PresentationOutline = {
      title: "Quarterly Sales Review",
      overallTheme: "Business Performance",
      colorScheme: {
        primary: "#0078D4",
        secondary: "#2B88D8",
        accent: "#FFB900",
        background: "#FFFFFF",
        text: "#000000",
      },
      slides: [
        {
          title: "Overview",
          slideType: "title",
          content: ["Q1–Q4 sales summary", "Key growth trends"],
          notes: "Introduce overall context.",
          suggestedLayout: "Title Slide",
        },
      ],
    };

    mockedAxios.post.mockResolvedValueOnce({ data: fakeOutline } as any);

    const result = await service.generatePresentationOutline("Quarterly sales review");

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(result.title).toBe("Quarterly Sales Review");
    expect(Array.isArray(result.slides)).toBe(true);
    expect(result.slides.length).toBeGreaterThan(0);
  });

  test("handles API errors gracefully", async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error("Network error: backend not reachable"));

    await expect(service.generatePresentationOutline("Quarterly sales review")).rejects.toThrow(
      "Network error: backend not reachable"
    );

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});
