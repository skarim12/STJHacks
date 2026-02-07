import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api";
import { authMiddleware } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);

app.use(authMiddleware);
app.use(rateLimit);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRoutes);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${PORT}`);
});
