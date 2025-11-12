import { Router, Request, Response } from "express";
import { pool } from "../models/db";

const r = Router();

r.get("/posts", async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  // 👇 if your middleware sets req.authUser, just access it as unknown
  const userId =
    (req as unknown as { authUser?: { user_id?: number } }).authUser?.user_id ??
    null;

  const params: Array<number | null> = [];

  let sql = `
    SELECT
      p.post_id,
      p.user_id,
      p.image_url_orig,
      p.image_url_censored,
      (p.score_sum / NULLIF(p.rating_count,0)) AS avg_rating,
      p.rating_count,
      p.created_at,
      u.display_name,
      p.status,
      p.moderation_status
  `;

  if (userId !== null) {
    sql += `,
      (
        SELECT r.score
        FROM Rating r
        WHERE r.post_id = p.post_id
          AND r.user_id = ?
        LIMIT 1
      ) AS my_score
    `;
    params.push(userId);
  } else {
    sql += `,
      NULL AS my_score
    `;
  }

  sql += `
    FROM Post p
    JOIN User u ON u.user_id = p.user_id
    WHERE p.status = 'PUBLISHED'
      AND p.moderation_status = 'PASSED'
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

export default r;
