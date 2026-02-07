import { Request, Response, NextFunction } from "express";

export function authMiddleware(_req: Request, _res: Response, next: NextFunction) {
  // Minimal placeholder for now; extend with real auth later
  // Example: check an API key header if desired
  next();
}
