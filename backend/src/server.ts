import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import aiRoutes from "./aiRoutes";

const app = express();

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

app.use("/api", aiRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: any) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${config.port}`);
});
