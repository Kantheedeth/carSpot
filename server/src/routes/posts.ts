import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool } from "../models/db";
import { ORIG_DIR } from "../path";
import { requireUser } from "../middleware/auth";

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
  flagged: number;
};

type GateRow = RowDataPacket & {
  successful_matches: number | null;
  required: string | number | null;
  user_has_posted: number | null;
  eligible_to_post: number | null;
};

const DEFAULT_MATCH_REQUIREMENT = 5;

async function getPostingGate(userId: number) {
  if (!Number.isFinite(userId)) {
    throw new Error("invalid-user-id");
  }

  const [rows] = await pool.query<GateRow[]>(
    `
      SELECT
        IFNULL(v.successful_matches, 0) AS successful_matches,
        COALESCE(aset.v, ?) AS required,
        EXISTS(SELECT 1 FROM Post p WHERE p.user_id = v.user_id LIMIT 1) AS user_has_posted,
        v.eligible_to_post AS eligible_to_post
      FROM vuserstats v
      LEFT JOIN (
        SELECT v FROM AppSetting WHERE k = 'rating_matches_required' LIMIT 1
      ) aset ON 1=1
      WHERE v.user_id = ?
      LIMIT 1
    `,
    [DEFAULT_MATCH_REQUIREMENT, userId]
  );

  const row = rows[0];
  if (!row) {
    return {
      required: DEFAULT_MATCH_REQUIREMENT,
      successful: 0,
      hasPosted: false,
      eligible: false,
    };
  }

  const required =
    Number(row.required ?? DEFAULT_MATCH_REQUIREMENT) ||
    DEFAULT_MATCH_REQUIREMENT;
  const successful = Number(row.successful_matches ?? 0);
  const hasPosted = row.user_has_posted === 1;
  const eligible = row.eligible_to_post === 1;
  return { required, successful, hasPosted, eligible };
}

async function ensurePostingUnlocked(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const auth = req.authUser;
  if (!auth) {
    return res.status(401).json({ ok: false, error: "Login required" });
  }

  try {
    const { required, successful, hasPosted, eligible } = await getPostingGate(
      auth.user_id
    );
    if (!eligible && !hasPosted && successful < required) {
      return res.status(403).json({
        ok: false,
        error: "posting_locked",
        message: `Rate and match ${required} posts before posting.`,
        required,
        successful_matches: successful,
        remaining: Math.max(0, required - successful),
        has_posted: hasPosted,
        eligible_to_post: eligible,
      });
    }
    next();
  } catch (err) {
    console.error("[/api/posts:create] gate check failed", err);
    return res.status(500).json({ ok: false, error: "gate_check_failed" });
  }
}

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
        u.display_name,
        p.flagged
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

/* -------- POSTING ELIGIBILITY -------- */

r.get("/posts/eligibility", requireUser, async (req: Request, res: Response) => {
  try {
    const { required, successful, hasPosted, eligible } = await getPostingGate(
      req.authUser!.user_id
    );
    const unlocked = eligible || hasPosted || successful >= required;

    res.json({
      ok: true,
      required,
      successful_matches: successful,
      remaining: Math.max(0, required - successful),
      unlocked,
      has_posted: hasPosted,
      eligible_to_post: eligible,
    });
  } catch (err) {
    console.error("[/api/posts/eligibility] failed", err);
    res.status(500).json({ ok: false, error: "eligibility_failed" });
  }
});

/* -------- DELETE POST -------- */

r.delete("/posts/:id", requireUser, async (req: Request, res: Response) => {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ ok: false, error: "invalid_post_id" });
  }

  const userId = req.authUser!.user_id;

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE Post
       SET status = 'DELETED'
       WHERE post_id = ? AND user_id = ? AND status <> 'DELETED'
       LIMIT 1`,
      [postId, userId]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ ok: false, error: "post_not_found_or_not_owned" });
    }

    res.json({ ok: true, post_id: postId });
  } catch (err) {
    const { code, message } = parseErr(err);
    console.error("[DELETE /api/posts/:id]", code, message);
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

/* -------- CREATE -------- */

r.post(
  "/posts",
  requireUser,
  ensurePostingUnlocked,
  upload.single("photo"),
  async (req: Request, res: Response) => {
    const auth = req.authUser!;
    const userId = auth.user_id;

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "photo required" });
    }

    const image_url_orig = `/uploads/orig/${req.file.filename}`;

    try {
      const [result] = await pool.query(
        `INSERT INTO Post (user_id, image_url_orig, moderation_status, status)
         VALUES (?, ?, 'PASSED', 'PUBLISHED')`,
        [userId, image_url_orig]
      );

      const insertId = (result as ResultSetHeader).insertId;
      res.status(201).json({ ok: true, post_id: insertId, image_url_orig });
    } catch (err) {
      console.error("[/api/posts:create] insert failed", err);
      res.status(500).json({ ok: false, error: "create_failed" });
    }
  }
);

/* -------- REPORT POST -------- */

r.post("/posts/:id/report", requireUser, async (req: Request, res: Response) => {
  const postId = Number(req.params.id);
  const userId = req.authUser!.user_id;

  if (!Number.isFinite(postId)) {
    return res.status(400).json({ ok: false, error: "invalid_post_id" });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT user_id FROM Post WHERE post_id = ? LIMIT 1",
      [postId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "post_not_found" });
    }

    if (Number(rows[0].user_id) === userId) {
      return res
        .status(400)
        .json({ ok: false, error: "cannot_report_own_post" });
    }

    await pool.query(
      `UPDATE Post
       SET flagged = COALESCE(flagged,0) + 1,
           moderation_status = CASE
             WHEN moderation_status = 'PASSED' THEN 'PENDING'
             ELSE moderation_status
           END
       WHERE post_id = ?
       LIMIT 1`,
      [postId]
    );

    const [updated] = await pool.query<RowDataPacket[]>(
      "SELECT flagged FROM Post WHERE post_id = ? LIMIT 1",
      [postId]
    );

    res.json({ ok: true, flagged: Number(updated[0]?.flagged) || 0 });
  } catch (err) {
    const { code, message } = parseErr(err);
    console.error("[/api/posts/:id/report]", code, message);
    res.status(500).json({ ok: false, code, message });
  }
});

export default r;
