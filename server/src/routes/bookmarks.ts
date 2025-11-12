// server/src/routes/bookmarks.ts
import { Router } from "express";
import { pool } from "../models/db";
import { requireUser } from "../middleware/auth";

const r = Router();

// GET /api/me/bookmarks
r.get("/me/bookmarks", requireUser, async (req, res) => {
  const userId = req.authUser!.user_id;

  const [rows] = await pool.query(
    `SELECT p.post_id,
            p.image_url_orig,
            p.created_at,
            (p.score_sum/NULLIF(p.rating_count,0)) AS avg_rating,
            p.rating_count
     FROM Bookmark b
     JOIN Post p ON p.post_id = b.post_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC`,
    [userId]
  );

  res.json(rows);
});

// POST /api/posts/:id/bookmark
r.post("/posts/:id/bookmark", requireUser, async (req, res) => {
  const userId = req.authUser!.user_id;
  const postId = Number(req.params.id);

  await pool.query(
    `INSERT IGNORE INTO Bookmark (user_id, post_id) VALUES (?, ?)`,
    [userId, postId]
  );

  res.json({ ok: true });
});

// DELETE /api/posts/:id/bookmark
r.delete("/posts/:id/bookmark", requireUser, async (req, res) => {
  const userId = req.authUser!.user_id;
  const postId = Number(req.params.id);

  await pool.query(
    `DELETE FROM Bookmark WHERE user_id = ? AND post_id = ?`,
    [userId, postId]
  );

  res.json({ ok: true });
});

export default r;
