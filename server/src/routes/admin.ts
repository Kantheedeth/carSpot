import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import type { RowDataPacket } from "mysql2";
import { pool } from "../models/db";
import { requireAdmin } from "../middleware/auth";
import { CENSORED_DIR } from "../path";

const r = Router();
let cachedAdminRoleId: number | null = null;

const censoredStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CENSORED_DIR),
  filename: (_req, file, cb) =>
    cb(
      null,
      `${Date.now()}_${file.originalname
        .replace(/\s+/g, "")
        .replace(/[^\w.\-]/g, "")}`
    ),
});

const uploadCensored = multer({
  storage: censoredStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      return cb(new Error("Only jpg/png/webp images allowed"));
    }
    cb(null, true);
  },
});

async function getAdminRoleId(): Promise<number> {
  if (cachedAdminRoleId !== null) return cachedAdminRoleId;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT role_id FROM Role WHERE name = 'ADMIN' LIMIT 1"
  );
  if (!rows.length) {
    throw new Error("ADMIN role not found");
  }
  cachedAdminRoleId = Number(rows[0].role_id);
  return cachedAdminRoleId;
}

type SummaryRow = RowDataPacket & {
  total_posts: number;
  active_users: number;
  pending_moderation: number;
  new_users_7d: number;
  new_posts_7d: number;
  active_posts: number;
};

type QueueRow = RowDataPacket & {
  post_id: number;
  user_id: number;
  display_name: string | null;
  image_url_orig: string | null;
  image_url_censored: string | null;
  status: string;
  moderation_status: string;
  rating_count: number;
  score_sum: number;
  created_at: Date;
  flagged: number;
};

type RatingRow = RowDataPacket & {
  rating_id: number;
  user_id: number;
  post_id: number;
  score: number;
  created_at: Date;
  rater_display_name: string | null;
  post_owner_id: number | null;
  post_owner_display_name: string | null;
};

type PostRatingRow = RowDataPacket & {
  rating_id: number;
  user_id: number;
  score: number;
  created_at: Date;
  rater_display_name: string | null;
};

type AdminUserRow = RowDataPacket & {
  user_id: number;
  display_name: string | null;
  email: string | null;
  status: string;
  created_at: Date;
  post_count: number | null;
  follower_count: number | null;
  following_count: number | null;
  bookmark_count: number | null;
  successful_matches: number | null;
  eligible_to_post: number | null;
  remaining_to_post: number | null;
  last_checked: Date | null;
  is_admin: number;
};

type PostRow = RowDataPacket & {
  post_id: number;
  user_id: number;
  display_name: string | null;
  image_url_orig: string | null;
  image_url_censored: string | null;
  status: string;
  moderation_status: string;
  rating_count: number;
  score_sum: number;
  created_at: Date;
};

const summarySql = `
  SELECT
    (SELECT COUNT(*) FROM Post) AS total_posts,
    (SELECT COUNT(*) FROM User WHERE status = 'ACTIVE') AS active_users,
    (SELECT COUNT(*) FROM Post WHERE moderation_status = 'PENDING') AS pending_moderation,
    (SELECT COUNT(*) FROM Post WHERE status = 'PUBLISHED' AND moderation_status = 'PASSED') AS active_posts,
    (SELECT COUNT(*) FROM User WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_users_7d,
    (SELECT COUNT(*) FROM Post WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_posts_7d
`;

r.get("/admin/dashboard", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [summaryRows] = await pool.query<SummaryRow[]>(summarySql);
    const summary = summaryRows[0] || {
      total_posts: 0,
      active_users: 0,
      pending_moderation: 0,
      active_posts: 0,
      new_users_7d: 0,
      new_posts_7d: 0,
    };

    const [activityRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT DATE(created_at) AS day, COUNT(*) AS count
        FROM User
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `
    );

    const [queueRows] = await pool.query<QueueRow[]>(
      `
        SELECT
          p.post_id,
          p.user_id,
          u.display_name,
          p.image_url_orig,
          p.image_url_censored,
          p.status,
          p.moderation_status,
          p.rating_count,
          p.score_sum,
          p.flagged,
          p.created_at
        FROM Post p
        JOIN User u ON u.user_id = p.user_id
        WHERE p.moderation_status = 'PENDING'
        ORDER BY p.created_at DESC
        LIMIT 8
      `
    );

    const [ratingRows] = await pool.query<RatingRow[]>(
      `
        SELECT
          r.rating_id,
          r.user_id,
          r.post_id,
          r.score,
          r.created_at,
          ru.display_name AS rater_display_name,
          p.user_id AS post_owner_id,
          pu.display_name AS post_owner_display_name
        FROM Rating r
        JOIN User ru ON ru.user_id = r.user_id
        JOIN Post p ON p.post_id = r.post_id
        LEFT JOIN User pu ON pu.user_id = p.user_id
        ORDER BY r.created_at DESC
        LIMIT 10
      `
    );

    res.json({
      summary: {
        total_posts: Number(summary.total_posts) || 0,
        active_users: Number(summary.active_users) || 0,
        pending_reviews: Number(summary.pending_moderation) || 0,
        active_posts: Number(summary.active_posts) || 0,
        new_users_7d: Number(summary.new_users_7d) || 0,
        new_posts_7d: Number(summary.new_posts_7d) || 0,
      },
      queue: queueRows.map((row) => ({
        post_id: row.post_id,
        user_id: row.user_id,
        display_name: row.display_name,
        image_url_orig: row.image_url_orig,
        image_url_censored: row.image_url_censored,
        status: row.status,
        moderation_status: row.moderation_status,
        rating_count: row.rating_count,
        avg_rating:
          row.rating_count > 0 ? Number(row.score_sum) / Number(row.rating_count) : null,
        created_at: row.created_at,
        flagged: Number(row.flagged) || 0,
      })),
      ratings: ratingRows.map((row) => ({
        rating_id: row.rating_id,
        user_id: row.user_id,
        post_id: row.post_id,
        score: row.score,
        created_at: row.created_at,
        rater_display_name: row.rater_display_name,
        post_owner_id: row.post_owner_id,
        post_owner_display_name: row.post_owner_display_name,
      })),
      user_activity: activityRows.map((row) => ({
        day: row.day,
        count: Number(row.count) || 0,
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/dashboard]", err);
    res.status(500).json({ ok: false, error: "dashboard_load_failed" });
  }
});

r.post(
  "/admin/posts/:id/approve",
  requireAdmin,
  async (req: Request, res: Response) => {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId) || postId <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_post_id" });
    }

    const adminId = req.authUser!.user_id;
    const note =
      typeof req.body?.note === "string" && req.body.note.trim().length > 0
        ? req.body.note.trim()
        : null;

    try {
      await pool.query("CALL sp_moderation_pass(?, ?, ?)", [
        postId,
        adminId,
        note,
      ]);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[POST /api/admin/posts/:id/approve]", err);
      return res
        .status(500)
        .json({ ok: false, error: "moderation_approve_failed" });
    }
  }
);

r.post(
  "/admin/posts/:id/reject",
  requireAdmin,
  async (req: Request, res: Response) => {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId) || postId <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_post_id" });
    }

    const adminId = req.authUser!.user_id;
    const note =
      typeof req.body?.note === "string" && req.body.note.trim().length > 0
        ? req.body.note.trim()
        : null;

    try {
      await pool.query("CALL sp_moderation_reject(?, ?, ?)", [
        postId,
        adminId,
        note,
      ]);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[POST /api/admin/posts/:id/reject]", err);
      return res
        .status(500)
        .json({ ok: false, error: "moderation_reject_failed" });
    }
  }
);

r.post(
  "/admin/posts/:id/censored",
  requireAdmin,
  uploadCensored.single("censored"),
  async (req: Request, res: Response) => {
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId) || postId <= 0) {
      if (req.file) {
        fs.unlink(req.file.path, () => undefined);
      }
      return res.status(400).json({ ok: false, error: "invalid_post_id" });
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "file_required" });
    }

    const adminId = req.authUser!.user_id;
    const relPath = `/uploads/censored/${req.file.filename}`;
    const note =
      typeof req.body?.note === "string" && req.body.note.trim().length > 0
        ? req.body.note.trim()
        : null;

    try {
      await pool.query("CALL sp_moderation_replace_censored(?, ?, ?, ?)", [
        postId,
        adminId,
        relPath,
        note,
      ]);
      return res.json({ ok: true, image_url_censored: relPath });
    } catch (err) {
      fs.unlink(req.file.path, () => undefined);
      console.error("[POST /api/admin/posts/:id/censored]", err);
      return res
        .status(500)
        .json({ ok: false, error: "moderation_replace_failed" });
    }
  }
);

r.get("/admin/posts", requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const status = typeof req.query.status === "string" ? req.query.status : null;
  const moderation =
    typeof req.query.moderation === "string" ? req.query.moderation : null;
  const search = String(req.query.search || "").trim();
  const sortParam = typeof req.query.sort === "string" ? req.query.sort : "created_desc";

  const where: string[] = [];
  const params: Array<string | number> = [];

  if (status) {
    where.push("p.status = ?");
    params.push(status);
  }

  if (moderation) {
    where.push("p.moderation_status = ?");
    params.push(moderation);
  }

  if (search) {
    const like = `%${search.replace(/[%_]/g, "\\$&")}%`;
    where.push("(u.display_name LIKE ? OR CAST(p.post_id AS CHAR) = ?)");
    params.push(like, search);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const orderByMap: Record<string, string> = {
      created_desc: "p.created_at DESC",
      created_asc: "p.created_at ASC",
      ratings_desc: "p.rating_count DESC",
      ratings_asc: "p.rating_count ASC",
    };
    const orderBy = orderByMap[sortParam] || orderByMap.created_desc;

    const baseQuery = `
      FROM Post p
      JOIN User u ON u.user_id = p.user_id
      ${whereClause}
    `;

    const [rows] = await pool.query<PostRow[]>(
      `
        SELECT
          p.post_id,
          p.user_id,
          u.display_name,
          p.image_url_orig,
          p.image_url_censored,
          p.status,
          p.moderation_status,
          p.rating_count,
          p.score_sum,
          p.created_at
        ${baseQuery}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total ${baseQuery}`,
      params
    );

    const total = Number(countRows[0]?.total) || 0;

    res.json({
      page,
      limit,
      total,
      rows: rows.map((row) => ({
        post_id: row.post_id,
        user_id: row.user_id,
        display_name: row.display_name,
        image_url_orig: row.image_url_orig,
        image_url_censored: row.image_url_censored,
        status: row.status,
        moderation_status: row.moderation_status,
        rating_count: row.rating_count,
        avg_rating:
          row.rating_count > 0 ? Number(row.score_sum) / Number(row.rating_count) : null,
        created_at: row.created_at,
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/posts]", err);
    res.status(500).json({ ok: false, error: "admin_posts_load_failed" });
  }
});

r.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = String(req.query.search || "").trim();
  const statusFilter =
    typeof req.query.status === "string" ? req.query.status : null;
  const sortParam = typeof req.query.sort === "string" ? req.query.sort : "created_desc";

  const where: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    const like = `%${search.replace(/[%_]/g, "\\$&")}%`;
    where.push("(u.display_name LIKE ? OR u.email LIKE ? OR CAST(u.user_id AS CHAR) = ?)");
    params.push(like, like, search);
  }

  if (statusFilter) {
    where.push("u.status = ?");
    params.push(statusFilter);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const orderByMap: Record<string, string> = {
      created_desc: "u.created_at DESC",
      created_asc: "u.created_at ASC",
      posts_desc: "IFNULL(v.post_count,0) DESC",
      posts_asc: "IFNULL(v.post_count,0) ASC",
    };
    const orderBy = orderByMap[sortParam] || orderByMap.created_desc;

    const baseQuery = `
      FROM User u
      LEFT JOIN vuserstats v ON v.user_id = u.user_id
      ${whereClause}
    `;

    const [rows] = await pool.query<AdminUserRow[]>(
      `
        SELECT
          u.user_id,
          u.display_name,
          u.email,
          u.status,
          u.created_at,
          IFNULL(v.post_count, 0) AS post_count,
          IFNULL(v.follower_count, 0) AS follower_count,
          IFNULL(v.following_count, 0) AS following_count,
          IFNULL(v.bookmark_count, 0) AS bookmark_count,
          IFNULL(v.successful_matches, 0) AS successful_matches,
          IFNULL(v.eligible_to_post, 0) AS eligible_to_post,
          IFNULL(v.remaining_to_post, 0) AS remaining_to_post,
          v.last_checked,
          EXISTS(
            SELECT 1
            FROM UserRole ur
            JOIN Role r ON r.role_id = ur.role_id
            WHERE ur.user_id = u.user_id AND r.name = 'ADMIN'
          ) AS is_admin
        ${baseQuery}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total ${baseQuery}`,
      params
    );

    const total = Number(countRows[0]?.total) || 0;

    res.json({
      page,
      limit,
      total,
      rows: rows.map((row) => ({
        user_id: row.user_id,
        display_name: row.display_name,
        email: row.email,
        status: row.status,
        created_at: row.created_at,
        post_count: Number(row.post_count) || 0,
        follower_count: Number(row.follower_count) || 0,
        following_count: Number(row.following_count) || 0,
        bookmark_count: Number(row.bookmark_count) || 0,
        successful_matches: Number(row.successful_matches) || 0,
        eligible_to_post: row.eligible_to_post === 1,
        remaining_to_post: Number(row.remaining_to_post) || 0,
        last_checked: row.last_checked,
        is_admin: row.is_admin === 1,
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    res.status(500).json({ ok: false, error: "admin_users_load_failed" });
  }
});

r.get("/admin/posts/:id", requireAdmin, async (req: Request, res: Response) => {
  const postId = Number(req.params.id);
  if (!Number.isFinite(postId)) {
    return res.status(400).json({ ok: false, error: "invalid_post_id" });
  }

  try {
    const [rows] = await pool.query<PostRow[]>(
      `
        SELECT
          p.post_id,
          p.user_id,
          u.display_name,
          p.image_url_orig,
          p.image_url_censored,
          p.status,
          p.moderation_status,
          p.rating_count,
          p.score_sum,
          p.created_at
        FROM Post p
        JOIN User u ON u.user_id = p.user_id
        WHERE p.post_id = ?
        LIMIT 1
      `,
      [postId]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "post_not_found" });
    }

    const post = rows[0];

    const [ratings] = await pool.query<PostRatingRow[]>(
      `
        SELECT
          r.rating_id,
          r.user_id,
          r.score,
          r.created_at,
          u.display_name AS rater_display_name
        FROM Rating r
        JOIN User u ON u.user_id = r.user_id
        WHERE r.post_id = ?
        ORDER BY r.created_at DESC
        LIMIT 50
      `,
      [postId]
    );

    res.json({
      post: {
        post_id: post.post_id,
        user_id: post.user_id,
        display_name: post.display_name,
        image_url_orig: post.image_url_orig,
        image_url_censored: post.image_url_censored,
        status: post.status,
        moderation_status: post.moderation_status,
        rating_count: post.rating_count,
        avg_rating:
          post.rating_count > 0
            ? Number(post.score_sum) / Number(post.rating_count)
            : null,
        created_at: post.created_at,
      },
      ratings: ratings.map((row) => ({
        rating_id: row.rating_id,
        user_id: row.user_id,
        score: row.score,
        created_at: row.created_at,
        rater_display_name: row.rater_display_name,
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/posts/:id]", err);
    res.status(500).json({ ok: false, error: "admin_post_load_failed" });
  }
});

async function updateUserRole(
  userId: number,
  makeAdmin: boolean
) {
  const roleId = await getAdminRoleId();
  if (makeAdmin) {
    await pool.query(
      "INSERT IGNORE INTO UserRole (user_id, role_id) VALUES (?, ?)",
      [userId, roleId]
    );
  } else {
    await pool.query("DELETE FROM UserRole WHERE user_id = ? AND role_id = ?", [
      userId,
      roleId,
    ]);
  }
}

r.post(
  "/admin/users/:id/grant-admin",
  requireAdmin,
  async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ ok: false, error: "invalid_user_id" });
    }
    try {
      await updateUserRole(userId, true);
      res.json({ ok: true });
    } catch (err) {
      console.error("[POST /api/admin/users/:id/grant-admin]", err);
      res
        .status(500)
        .json({ ok: false, error: "grant_admin_failed" });
    }
  }
);

r.post(
  "/admin/users/:id/revoke-admin",
  requireAdmin,
  async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ ok: false, error: "invalid_user_id" });
    }
    try {
      await updateUserRole(userId, false);
      res.json({ ok: true });
    } catch (err) {
      console.error("[POST /api/admin/users/:id/revoke-admin]", err);
      res
        .status(500)
        .json({ ok: false, error: "revoke_admin_failed" });
    }
  }
);

r.post(
  "/admin/users/:id/delete",
  requireAdmin,
  async (req: Request, res: Response) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ ok: false, error: "invalid_user_id" });
    }

    try {
      await pool.query(
        "UPDATE User SET status = 'DELETED' WHERE user_id = ? LIMIT 1",
        [userId]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("[POST /api/admin/users/:id/delete]", err);
      res.status(500).json({ ok: false, error: "delete_user_failed" });
    }
  }
);

export default r;
