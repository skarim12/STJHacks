import "./config/config"; // loads dotenv + validates required env vars early

import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api";
import streamRoutes from "./routes/stream";
import { authMiddleware } from "./middleware/auth";
import { apiLimiter } from "./middleware/rateLimit";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

const app = express();
const PORT = Number(process.env.PORT || 4000);

const USE_HTTPS = String(process.env.USE_HTTPS || "").toLowerCase() === "true";
const DEFAULT_CERT_DIR = path.join(process.env.USERPROFILE || "", ".office-addin-dev-certs");
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(DEFAULT_CERT_DIR, "localhost.crt");
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(DEFAULT_CERT_DIR, "localhost.key");

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

const start = () => {
  if (USE_HTTPS) {
    const certExists = fs.existsSync(SSL_CERT_PATH);
    const keyExists = fs.existsSync(SSL_KEY_PATH);
    if (!certExists || !keyExists) {
      // eslint-disable-next-line no-console
      console.warn(
        `USE_HTTPS=true but SSL cert/key not found. cert=${SSL_CERT_PATH} key=${SSL_KEY_PATH}. Falling back to http.`
      );
      http.createServer(app).listen(PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`Backend (http) listening on port ${PORT}`);
      });
      return;
    }

    const cert = fs.readFileSync(SSL_CERT_PATH);
    const key = fs.readFileSync(SSL_KEY_PATH);

    https.createServer({ cert, key }, app).listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Backend (https) listening on port ${PORT}`);
    });
    return;
  }

  http.createServer(app).listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend (http) listening on port ${PORT}`);
  });
};

start();
