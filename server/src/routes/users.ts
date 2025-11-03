import { Router, Request, Response } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../models/db";

const r = Router();

/** Row shapes returned from MySQL */
type MeRow = RowDataPacket & {
  user_id: number;
  display_name: string | null;
  status: "ACTIVE" | "BANNED" | "DELETED";
};

type UserStatsRow = RowDataPacket & {
  user_id: number;
  status: "ACTIVE" | "BANNED" | "DELETED";
  post_count: number;
  follower_count: number;
  following_count: number;
  bookmark_count: number;
  successful_matches: number;
  eligible_to_post: 0 | 1 | boolean;
  remaining_to_post: number;
  last_checked: Date | null;
};

type UserPostRow = RowDataPacket & {
  post_id: number;
  image_url_orig: string;
  image_url_censored: string | null;
  created_at: Date;
  avg_rating: number | null;
  rating_count: number;
};

// Current user (for role/visibility)
r.get("/me", async (req: Request, res: Response) => {
  // demo: x-user-id and x-role header; replace with real auth later
  const userId = Number(req.headers["x-user-id"] ?? 1);
  const role = String(req.headers["x-role"] ?? "USER");

  const [rows] = await pool.query<MeRow[]>(
    `SELECT user_id, display_name, status FROM User WHERE user_id=?`,
    [userId]
  );

  if (rows.length === 0) return res.json(null);
  res.json({ ...rows[0], roles: [role] });
});

// Profile stats view
r.get("/users/:id/stats", async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const [rows] = await pool.query<UserStatsRow[]>(
    `SELECT * FROM vuserstats WHERE user_id=?`,
    [id]
  );

  if (rows.length === 0) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
});

// User posts for profile grid
r.get("/users/:id/posts", async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const [rows] = await pool.query<UserPostRow[]>(
    `SELECT post_id, image_url_orig, image_url_censored, created_at,
            (score_sum/NULLIF(rating_count,0)) AS avg_rating, rating_count
     FROM Post
     WHERE user_id=? AND status!='DELETED'
     ORDER BY created_at DESC`,
    [id]
  );

  res.json(rows);
});

export default r;
