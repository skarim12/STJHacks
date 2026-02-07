import dotenv from "dotenv";

dotenv.config();

export const config = {
  claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "",
  apiEndpoint: process.env.API_ENDPOINT || "http://localhost:4000",
  maxTokens: Number(process.env.MAX_TOKENS || 4096),
  defaultModel: process.env.CLAUDE_MODEL || "claude-3.5-sonnet",
};

if (!config.claudeApiKey) {
  // eslint-disable-next-line no-console
  console.warn("WARNING: Claude/Anthropic API key is not set. AI routes will fail.");
}
