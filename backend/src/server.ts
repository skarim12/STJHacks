import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import NodeCache from "node-cache";
import { config } from "./config";
import {
  callAnthropicForSlides,
  callAnthropicForResearch
} from "./anthropicClient";

const app = express();
const cache = new NodeCache({ stdTTL: config.cacheTtlSeconds });

app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!config.allowedOrigins.length || config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    }
  })
);
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api", limiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/generateSlides", async (req, res) => {
  try {
    const roughIdea = String(req.body?.roughIdea || "").trim();
    if (!roughIdea) {
      return res.status(400).json({ error: "Missing 'roughIdea'." });
    }

    const cacheKey = `slides:${roughIdea}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await callAnthropicForSlides(roughIdea);
    cache.set(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to generate slides", details: err?.message || "" });
  }
});

app.post("/api/research", async (req, res) => {
  try {
    const topic = String(req.body?.topic || "").trim();
    if (!topic) {
      return res.status(400).json({ error: "Missing 'topic'." });
    }

    const cacheKey = `research:${topic}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const result = await callAnthropicForResearch(topic);
    cache.set(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to perform research", details: err?.message || "" });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: any) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${config.port}`);
});