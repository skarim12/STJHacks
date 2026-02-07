import { Request, Response, NextFunction } from "express";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const ipBuckets = new Map<string, { count: number; windowStart: number }>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || "unknown";
  const now = Date.now();

  const bucket = ipBuckets.get(ip) || { count: 0, windowStart: now };

  if (now - bucket.windowStart > WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }

  bucket.count += 1;
  ipBuckets.set(ip, bucket);

  if (bucket.count > MAX_REQUESTS) {
    return res.status(429).json({ error: "Too many requests" });
  }

  next();
}
