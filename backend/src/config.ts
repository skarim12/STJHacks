import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 300)
};

if (!config.anthropicApiKey) {
  // Fail fast in backend, never ship without a key configured
  // eslint-disable-next-line no-console
  console.warn("WARNING: ANTHROPIC_API_KEY is not set. AI routes will fail.");
}