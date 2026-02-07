import "./config/config"; // loads dotenv + validates required env vars early

import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api";
import streamRoutes from "./routes/stream";
import { authMiddleware } from "./middleware/auth";
import { apiLimiter } from "./middleware/rateLimit";

const app = express();
const PORT = Number(process.env.PORT || 4000);

// Some PPTX outlines can get large; raise JSON limit above the default (100kb).
app.use(express.json({ limit: "10mb" }));
app.use(
  cors({
    origin: "*",
  })
);

// Auth first (if you extend it), then rate limiting, then routes
app.use(authMiddleware);
app.use("/api", apiLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRoutes);
app.use("/stream", streamRoutes);

// Final error handler (e.g., multer file too large, invalid JSON)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = Number(err?.status || err?.statusCode || 500);
  const message = String(err?.message || "Internal Server Error");

  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);

  if (message.toLowerCase().includes("file too large")) {
    return res.status(413).json({ error: "Upload too large", details: message });
  }

  if (status === 413) {
    return res.status(413).json({ error: "Request too large", details: message });
  }

  return res.status(status).json({ error: "Request failed", details: message });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${PORT}`);
});
