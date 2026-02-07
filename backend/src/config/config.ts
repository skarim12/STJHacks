import dotenv from "dotenv";

dotenv.config();

export const config = {
  claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "",
  apiEndpoint: process.env.API_ENDPOINT || "http://localhost:4000",
  maxTokens: Number(process.env.MAX_TOKENS || 4096),
  // You can override with CLAUDE_MODEL in backend/.env (recommended for reproducibility).
  // IMPORTANT: model availability depends on your Anthropic account/entitlements.
  defaultModel:
    process.env.CLAUDE_MODEL ||
    "claude-sonnet-4-5-20250929"
};

if (!config.claudeApiKey) {
  // eslint-disable-next-line no-console
  console.warn("WARNING: Claude/Anthropic API key is not set. AI routes will fail.");
}
