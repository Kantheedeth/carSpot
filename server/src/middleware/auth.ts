import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

export interface AuthUser {
  user_id: number;
  roles: string[]; // e.g. ["USER"], ["USER","ADMIN"]
}

export function readAuth(req: Request): AuthUser | null {
  const token = req.cookies?.carspot_token;
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function attachAuth(req: Request, _res: Response, next: NextFunction) {
  const user = readAuth(req);
  if (user) req.authUser = user;
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ ok: false, error: "Login required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const u = req.authUser;
  if (!u || !u.roles.includes("ADMIN")) {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  next();
}

// ✅ Proper Express Request augmentation (no `namespace` needed)
declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthUser;
  }
}
