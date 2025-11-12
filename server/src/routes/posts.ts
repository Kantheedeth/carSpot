import { Router, Request, Response } from "express";
import multer from "multer";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool } from "../models/db";
import { ORIG_DIR } from "../path";

const r = Router();

r.use((req, _res, next) => {
  console.log(`[posts] ${req.method} ${req.path}`);
  next();
});

/** Safe extractor for unknown errors (no `any`) */
function parseErr(e: unknown): { code?: string; message: string } {
  if (e && typeof e === "object") {
    const code =
      (e as { code?: string }).code ??
      (e as { name?: string }).name;
    const sqlMsg = (e as { sqlMessage?: string }).sqlMessage;
    const msg = (e as { message?: string }).message;
    return { code, message: sqlMsg ?? msg ?? String(e) };
  }
  return { message: String(e) };
}

/** Multer */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ORIG_DIR),
  filename: (_req, file, cb) =>
    cb(null, Date.now() + "_" + file.originalname.replace(/\s+/g, "")),
});
const upload = multer({ storage });

/** Types */
type PostRow = RowDataPacket & {
  post_id: number;
  user_id: number;
  image_url_orig: string;
  image_url_censored: string | null;
  moderation_status: "PENDING" | "PASSED" | "REJECTED";
  status: "PENDING" | "PUBLISHED" | "DELETED";
  flagged: number;
  score_sum: number;
  rating_count: number;
  avg_rating?: number | null;
  created_at: Date;
};

type FeedRow = RowDataPacket & {
  post_id: number;
  user_id: number;
  image_url_orig: string;
  image_url_censored: string | null;
  status: "PUBLISHED" | "PENDING" | "DELETED";
  moderation_status: "PENDING" | "PASSED" | "REJECTED";
  score_sum: number;
  rating_count: number;
  avg_rating: number | null;
  created_at: Date;
  display_name: string | null;
  my_score: number | null;
};

/* -------- FEED with my_score -------- */

r.get("/posts", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Number(req.query.limit || 20));
    const off = (page - 1) * limit;

    // read authUser without fighting global types
    const auth =
      (req as unknown as { authUser?: { user_id: number } }).authUser;
    const userId = auth?.user_id ?? null;

    const params: number[] = [];

    let sql = `
      SELECT
        p.post_id,
        p.user_id,
        p.image_url_orig,
        p.image_url_censored,
        p.status,
        p.moderation_status,
        p.score_sum,
        p.rating_count,
        (p.score_sum / NULLIF(p.rating_count,0)) AS avg_rating,
        p.created_at,
        u.display_name
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
      LEFT JOIN User u ON u.user_id = p.user_id
      WHERE p.status = 'PUBLISHED'
        AND p.moderation_status = 'PASSED'
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, off);

    const [rows] = await pool.query<FeedRow[]>(sql, params);
    res.json(rows);
  } catch (e: unknown) {
    const { code, message } = parseErr(e);
    console.error("[/api/posts] SQL error:", code, message);
    res.status(500).json({ ok: false, code, message });
  }
});

/* -------- POST DETAIL (unchanged) -------- */

r.get("/posts/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query<PostRow[]>(
      `SELECT p.*,
              (p.\`score_sum\`/NULLIF(p.\`rating_count\`,0)) AS avg_rating
       FROM \`Post\` p
       WHERE p.\`post_id\`=?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e: unknown) {
    const { code, message } = parseErr(e);
    console.error("[/api/posts/:id] SQL error:", code, message);
    res.status(500).json({ ok: false, code, message });
  }
});

/* -------- CREATE (unchanged for now) -------- */

r.post("/posts", upload.single("photo"), async (req: Request, res: Response) => {
  const userId = Number(req.header("x-user-id") || 1);
  if (!req.file) return res.status(400).json({ error: "photo required" });

  const image_url_orig = `/uploads/orig/${req.file.filename}`;

  const [result] = await pool.query(
    `INSERT INTO Post (user_id, image_url_orig, moderation_status, status)
     VALUES (?, ?, 'PASSED', 'PUBLISHED')`,
    [userId, image_url_orig]
  );

  const insertId = (result as ResultSetHeader).insertId;
  res.status(201).json({ post_id: insertId, image_url_orig });
});

export default r;
