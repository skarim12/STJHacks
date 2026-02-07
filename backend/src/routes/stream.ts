import { Router } from "express";
import axios from "axios";
import { config } from "../config/config";

const router = Router();

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

router.get("/outline-stream", async (req, res) => {
  const topic = String((req.query as any)?.topic || "").trim();

  if (!topic) {
    res.status(400).end();
    return;
  }

  if (!config.claudeApiKey) {
    res.status(500).end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    const system = "You are a presentation design expert...";
    const user = `Create an outline for: ${topic}`;

    const response = await axios.post(
      ANTHROPIC_URL,
      {
        model: config.defaultModel,
        max_tokens: config.maxTokens,
        temperature: 0.5,
        stream: true,
        system,
        messages: [{ role: "user", content: user }],
      },
      {
        headers: {
          "x-api-key": config.claudeApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        responseType: "stream",
      }
    );

    response.data.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      res.write(`data: ${text}\n\n`);
    });

    response.data.on("end", () => {
      res.write("event: end\n");
      res.write("data: [DONE]\n\n");
      res.end();
    });

    response.data.on("error", () => {
      res.end();
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.end();
  }
});

export default router;
