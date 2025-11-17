import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { pool } from "../models/db";
import jwt from "jsonwebtoken";
import { readAuth } from "../middleware/auth";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { AVATAR_DIR } from "../path";

const router = Router();

const isProd = process.env.NODE_ENV === "production";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:4000/api/auth/google/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

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

/* ---------- GOOGLE OAUTH ---------- */

router.get("/auth/google", (_req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res
      .status(500)
      .json({ ok: false, error: "Google OAuth not configured" });
  }

  const state = crypto.randomUUID();
  res.cookie("google_oauth_state", state, {
    ...httpOnlyBase,
    maxAge: 10 * 60 * 1000,
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

router.get("/auth/google/callback", async (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res
      .status(500)
      .json({ ok: false, error: "Google OAuth not configured" });
  }

  const { code, state } = req.query || {};
  const cookieState = req.cookies?.google_oauth_state;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ ok: false, error: "Missing code" });
  }
  if (!state || state !== cookieState) {
    return res.status(400).json({ ok: false, error: "Invalid state" });
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      id_token?: string;
    };

    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      }
    );

    if (!userInfoRes.ok) {
      const text = await userInfoRes.text();
      throw new Error(`Failed to load user info: ${text}`);
    }

    const profile = (await userInfoRes.json()) as {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
      verified_email?: boolean;
    };

    if (!profile.id) {
      throw new Error("Google user id missing");
    }

    const googleId = profile.id;
    const email = profile.email || null;
    const displayName = profile.name || profile.email || "Google User";
    const picture = profile.picture || null;

    // find existing by google_id
    let userId: number | null = null;
    let status: string | null = null;

    const [byGoogle] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, status FROM User WHERE google_id = ? LIMIT 1`,
      [googleId]
    );
    if (byGoogle.length) {
      userId = Number(byGoogle[0].user_id);
      status = String(byGoogle[0].status);
    } else if (email) {
      // attach google_id to existing email account if present
      const [byEmail] = await pool.query<RowDataPacket[]>(
        `SELECT user_id, status FROM User WHERE email = ? LIMIT 1`,
        [email]
      );
      if (byEmail.length) {
        userId = Number(byEmail[0].user_id);
        status = String(byEmail[0].status);
        await pool.query(
          `UPDATE User SET google_id = COALESCE(google_id, ?) WHERE user_id = ?`,
          [googleId, userId]
        );
      }
    }

    if (userId && status !== "ACTIVE") {
      return res
        .status(403)
        .json({ ok: false, error: "Account is not active" });
    }

    if (!userId) {
      const [ins] = await pool.query<ResultSetHeader>(
        `INSERT INTO User (google_id, email, display_name, profile_pic_url, status)
         VALUES (?, ?, ?, ?, 'ACTIVE')`,
        [googleId, email, displayName, picture]
      );
      userId = Number(ins.insertId);

      await pool.query<ResultSetHeader>(
        "INSERT IGNORE INTO UserRole (user_id, role_id) VALUES (?, 1)",
        [userId]
      );
    }

    const roles = await loadRoles(userId);
    setAuthCookie(res, userId, roles);

    res
      .clearCookie("google_oauth_state", httpOnlyBase)
      .redirect(FRONTEND_URL);
  } catch (err: unknown) {
    console.error("[google_callback]", err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
