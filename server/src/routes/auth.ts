import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import path from "path";
import { pool } from "../models/db";
import jwt from "jsonwebtoken";
import { readAuth } from "../middleware/auth";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { AVATAR_DIR } from "../path";

const router = Router();

const isProd = process.env.NODE_ENV === "production";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const httpOnlyBase = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: isProd,
  domain: COOKIE_DOMAIN,
};

const clientBase = {
  httpOnly: false as const,
  sameSite: "lax" as const,
  secure: isProd,
  domain: COOKIE_DOMAIN,
};

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (_req, file, cb) =>
    cb(
      null,
      Date.now() +
        "_" +
        file.originalname.replace(/\s+/g, "").replace(/[^\w.\-]/g, "")
    ),
});
const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      return cb(new Error("Only jpg/png/webp images allowed"));
    }
    cb(null, true);
  },
});

async function loadRoles(userId: number): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.name
     FROM UserRole ur
     JOIN Role r ON ur.role_id = r.role_id
     WHERE ur.user_id = ?`,
    [userId]
  );
  return rows.map((r) => String(r.name));
}

function setAuthCookie(res: Response, userId: number, roles: string[]) {
  const token = jwt.sign({ user_id: userId, roles }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res
    .cookie("carspot_token", token, {
      ...httpOnlyBase,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .clearCookie("carspot_guest_ui", clientBase);
}

/* ---------- GUEST ---------- */

router.get("/auth/guest", (_req: Request, res: Response) => {
  res
    .clearCookie("carspot_token", httpOnlyBase)
    .cookie("carspot_guest_ui", "1", {
      ...clientBase,
      maxAge: 60 * 60 * 1000,
    })
    .json({ ok: true, mode: "guest" });
});

router.post("/auth/logout", (_req: Request, res: Response) => {
  res
    .clearCookie("carspot_token", httpOnlyBase)
    .clearCookie("carspot_guest_ui", clientBase)
    .json({ ok: true, mode: "logged_out" });
});

/* ---------- SIGNUP (plain password) ---------- */
/*
  POST /api/auth/signup
  body: {
    email: string,
    password: string,
    display_name: string,
    profile_pic_url?: string
  }
*/
router.post(
  "/auth/signup",
  uploadAvatar.single("avatar"),
  async (req: Request, res: Response) => {
    const { email, password, display_name, profile_pic_url } = req.body || {};
    const uploadedAvatar = req.file
      ? `/uploads/avatars/${req.file.filename}`
      : undefined;

    if (
      !email ||
      typeof email !== "string" ||
      !password ||
      typeof password !== "string" ||
      !display_name ||
      typeof display_name !== "string"
    ) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    try {
      // email unique?
      const [existing] = await pool.query<RowDataPacket[]>(
        "SELECT user_id FROM User WHERE email = ? LIMIT 1",
        [email]
      );
      if (existing.length) {
        return res
          .status(409)
          .json({ ok: false, error: "Email already registered" });
      }

      // store plain password for now (DEV ONLY)
      const [ins] = await pool.query<ResultSetHeader>(
        `INSERT INTO User (email, password, display_name, profile_pic_url, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
        [email, password, display_name, uploadedAvatar || profile_pic_url || null]
      );

      const userId = ins.insertId;

      // ensure USER role (role_id = 1)
      await pool.query<ResultSetHeader>(
        "INSERT IGNORE INTO UserRole (user_id, role_id) VALUES (?, 1)",
        [userId]
      );

      const roles = await loadRoles(userId);
      setAuthCookie(res, userId, roles);

      res.json({
        ok: true,
        user_id: userId,
        roles,
        email,
        display_name,
        profile_pic_url: uploadedAvatar || profile_pic_url || null,
      });
    } catch (err: unknown) {
      console.error("[signup]", err);
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  }
);

/* ---------- LOGIN (email + password) ---------- */
/*
  POST /api/auth/login
  body: { email: string, password: string }
*/
router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ ok: false, error: "Email and password required" });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, password
       FROM User
       WHERE email = ? AND status = 'ACTIVE'
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const { user_id, password: stored } = rows[0];

    if (String(stored) !== password) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const roles = await loadRoles(Number(user_id));
    setAuthCookie(res, Number(user_id), roles);

    res.json({ ok: true, user_id, roles });
  } catch (err: unknown) {
    console.error("[login]", err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

/* ---------- WHOAMI ---------- */

router.get("/auth/me", (req: Request, res: Response) => {
  const me = readAuth(req);
  res.json({ ok: true, user: me });
});

export default router;
