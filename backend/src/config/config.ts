import dotenv from "dotenv";

dotenv.config();

export const config = {
  claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "",
  apiEndpoint: process.env.API_ENDPOINT || "http://localhost:4000",
  maxTokens: Number(process.env.MAX_TOKENS || 4096),
  // Use a known-valid Anthropic model id by default.
  // You can override with CLAUDE_MODEL in backend/.env.
  defaultModel: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20240620",
};

if (!config.claudeApiKey) {
  // eslint-disable-next-line no-console
  console.warn("WARNING: Claude/Anthropic API key is not set. AI routes will fail.");
}
