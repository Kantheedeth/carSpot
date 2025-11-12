import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../models/db";

const r = Router();

// GET /api/users/:id/stats
r.get("/users/:id/stats", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        u.user_id,
        u.display_name,
        u.status,
        IFNULL(v.post_count, 0)          AS post_count,
        IFNULL(v.follower_count, 0)      AS follower_count,
        IFNULL(v.following_count, 0)     AS following_count,
        IFNULL(v.bookmark_count, 0)      AS bookmark_count,
        IFNULL(v.successful_matches, 0)  AS successful_matches,
        IFNULL(v.eligible_to_post, 1)    AS eligible_to_post,
        IFNULL(v.remaining_to_post, 0)   AS remaining_to_post,
        v.last_checked
      FROM \`User\` u
      LEFT JOIN vuserstats v ON v.user_id = u.user_id
      WHERE u.user_id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    return res.json(rows[0]); // 👈 includes display_name now
  } catch (err) {
    console.error("[users/:id/stats]", err);
    return res.status(500).json({ ok: false, error: "Failed to load stats" });
  }
});

export default r;
