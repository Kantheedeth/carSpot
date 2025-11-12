import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool } from "../models/db";
import { requireUser } from "../middleware/auth";
import { AVATAR_DIR } from "../path";

const r = Router();

type UserStatsRow = RowDataPacket & {
  user_id: number;
  display_name: string | null;
  profile_pic_url: string | null;
  status: "ACTIVE" | "BANNED" | "DELETED";
  post_count: number;
  follower_count: number;
  following_count: number;
  bookmark_count: number;
  successful_matches: number;
  eligible_to_post: number;
  remaining_to_post: number;
  last_checked: Date | null;
  is_following: number;
};

type UserPostRow = RowDataPacket & {
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
  my_score: number | null;
};

type UserSearchRow = RowDataPacket & {
  user_id: number;
  display_name: string | null;
};

type SimpleUserRow = RowDataPacket & {
  user_id: number;
  display_name: string | null;
  profile_pic_url: string | null;
};

type MutualFollowRow = RowDataPacket & { is_mutual: number };
type ConversationLookupRow = RowDataPacket & { conversation_id: number };

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

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      return cb(new Error("Only png/jpg/webp avatars allowed"));
    }
    cb(null, true);
  },
});
// GET /api/users/:id/stats  → profile header metrics (public)
r.get("/users/:id/stats", async (req: Request, res: Response) => {
  const uid = Number(req.params.id);
  if (!Number.isFinite(uid)) {
    return res
      .status(400)
      .json({ ok: false, error: "Invalid id" });
  }

  try {
    const viewerId = req.authUser?.user_id ?? null;
    const params: number[] = [];

    const followSelect =
      viewerId !== null
        ? `EXISTS(
            SELECT 1
            FROM Follow f
            WHERE f.follower_id = ?
              AND f.following_id = u.user_id
          ) AS is_following`
        : `0 AS is_following`;

    if (viewerId !== null) params.push(viewerId);
    params.push(uid);

    const [rows] = await pool.query<UserStatsRow[]>(
      `
        SELECT
          u.user_id,
          u.display_name,
          u.profile_pic_url,
          u.status,
          IFNULL(v.post_count, 0)          AS post_count,
          IFNULL(v.follower_count, 0)      AS follower_count,
          IFNULL(v.following_count, 0)     AS following_count,
          IFNULL(v.bookmark_count, 0)      AS bookmark_count,
          IFNULL(v.successful_matches, 0)  AS successful_matches,
          IFNULL(v.eligible_to_post, 1)    AS eligible_to_post,
          IFNULL(v.remaining_to_post, 0)   AS remaining_to_post,
          v.last_checked,
          ${followSelect}
        FROM \`User\` u
        LEFT JOIN vuserstats v ON v.user_id = u.user_id
        WHERE u.user_id = ?
        LIMIT 1
      `,
      params
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ ok: false, error: "User not found" });
    }

    const stats = rows[0];
    return res.json({
      user_id: stats.user_id,
      display_name: stats.display_name,
      profile_pic_url: stats.profile_pic_url,
      status: stats.status,
      post_count: Number(stats.post_count) || 0,
      follower_count: Number(stats.follower_count) || 0,
      following_count: Number(stats.following_count) || 0,
      bookmark_count: Number(stats.bookmark_count) || 0,
      successful_matches: Number(stats.successful_matches) || 0,
      eligible_to_post: stats.eligible_to_post === 1,
      remaining_to_post: Number(stats.remaining_to_post) || 0,
      last_checked: stats.last_checked,
      is_following: stats.is_following === 1,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    const message =
      (err as { sqlMessage?: string }).sqlMessage ||
      (err as { message?: string }).message ||
      "Failed to load stats";

    console.error("[users/:id/stats]", code, message);
    return res.status(500).json({ ok: false, error: message });
  }
});

// GET /api/users/search?query=foo → lookup users by display name
r.get("/users/search", async (req: Request, res: Response) => {
  const raw = String(req.query.query || "").trim();
  if (raw.length < 2) {
    return res.json([]);
  }

  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
  const like = `%${raw.replace(/[%_]/g, "\\$&")}%`;

  try {
    const [rows] = await pool.query<UserSearchRow[]>(
      `
        SELECT user_id, display_name
        FROM \`User\`
        WHERE status = 'ACTIVE'
          AND display_name LIKE ?
        ORDER BY display_name ASC
        LIMIT ?
      `,
      [like, limit]
    );

    res.json(
      rows.map((row) => ({
        user_id: row.user_id,
        display_name: row.display_name,
      }))
    );
  } catch (err) {
    const code = (err as { code?: string }).code;
    const message =
      (err as { sqlMessage?: string }).sqlMessage ||
      (err as { message?: string }).message ||
      "Failed to search users";
    console.error("[users/search]", code, message);
    res.status(500).json({ ok: false, error: message });
  }
});

function formatFollowerCount(followingId: number) {
  return pool
    .query<RowDataPacket[]>(
      "SELECT COUNT(*) AS follower_count FROM Follow WHERE following_id = ?",
      [followingId]
    )
    .then(([rows]) => Number(rows[0]?.follower_count) || 0);
}

async function doesFollow(followerId: number, followingId: number) {
  const [rows] = await pool.query<MutualFollowRow[]>(
    `
      SELECT EXISTS(
        SELECT 1 FROM Follow WHERE follower_id = ? AND following_id = ?
      ) AS is_mutual
    `,
    [followerId, followingId]
  );
  return rows[0]?.is_mutual === 1;
}

function canViewConnections(req: Request, targetId: number) {
  const viewer = req.authUser;
  if (!viewer) return false;
  if (viewer.user_id === targetId) return true;
  return viewer.roles?.includes("ADMIN") ?? false;
}

async function ensureConversationBetween(
  userA: number,
  userB: number
): Promise<number | null> {
  if (userA === userB) return null;

  const [existing] = await pool.query<ConversationLookupRow[]>(
    `
      SELECT cp1.conversation_id
      FROM ConversationParticipant cp1
      JOIN ConversationParticipant cp2
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = ? AND cp2.user_id = ?
      LIMIT 1
    `,
    [userA, userB]
  );
  if (existing.length > 0) {
    return existing[0].conversation_id;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [stillNone] = await conn.query<ConversationLookupRow[]>(
      `
        SELECT cp1.conversation_id
        FROM ConversationParticipant cp1
        JOIN ConversationParticipant cp2
          ON cp1.conversation_id = cp2.conversation_id
        WHERE cp1.user_id = ? AND cp2.user_id = ?
        LIMIT 1
      `,
      [userA, userB]
    );
    if (stillNone.length > 0) {
      await conn.rollback();
      return stillNone[0].conversation_id;
    }

    const [convResult] = await conn.query<ResultSetHeader>(
      "INSERT INTO Conversation (created_at) VALUES (NOW())"
    );
    const conversationId = convResult.insertId;

    await conn.query(
      `
        INSERT INTO ConversationParticipant (conversation_id, user_id)
        VALUES (?, ?), (?, ?)
      `,
      [conversationId, userA, conversationId, userB]
    );

    await conn.commit();
    return conversationId;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback failure
    }
    console.error("[ensureConversationBetween]", err);
    return null;
  } finally {
    conn.release();
  }
}

// PUT /api/users/me → update display name / avatar
r.put(
  "/users/me",
  requireUser,
  avatarUpload.single("avatar"),
  async (req: Request, res: Response) => {
    const userId = req.authUser!.user_id;
    const { display_name, profile_pic_url } = req.body || {};

    const updates: string[] = [];
    const params: (string | null | number)[] = [];

    if (typeof display_name === "string" && display_name.trim()) {
      updates.push("display_name = ?");
      params.push(display_name.trim());
    }

    let newAvatar: string | null | undefined;
    if (req.file) {
      newAvatar = `/uploads/avatars/${req.file.filename}`;
    } else if (profile_pic_url !== undefined) {
      newAvatar = profile_pic_url ? String(profile_pic_url) : null;
    }
    if (newAvatar !== undefined) {
      updates.push("profile_pic_url = ?");
      params.push(newAvatar);
    }

    if (!updates.length) {
      return res.status(400).json({ ok: false, error: "No changes provided" });
    }

    params.push(userId);

    try {
      await pool.query(
        `UPDATE User SET ${updates.join(", ")} WHERE user_id = ?`,
        params
      );

      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT display_name, profile_pic_url FROM User WHERE user_id = ?",
        [userId]
      );
      const row = rows[0];
      res.json({
        ok: true,
        display_name: row?.display_name ?? null,
        profile_pic_url: row?.profile_pic_url ?? null,
      });
    } catch (err) {
      console.error("[PUT /users/me]", err);
      const msg =
        (err as { sqlMessage?: string }).sqlMessage ||
        (err as { message?: string }).message ||
        "Failed to update profile";
      res.status(500).json({ ok: false, error: msg });
    }
  }
);

// POST /api/users/:id/follow → follow another user
r.post("/users/:id/follow", requireUser, async (req: Request, res: Response) => {
  const followerId = req.authUser!.user_id;
  const targetId = Number(req.params.id);
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }
  if (targetId === followerId) {
    return res
      .status(400)
      .json({ ok: false, error: "Cannot follow yourself" });
  }

  try {
    await pool.query(
      `
        INSERT INTO Follow (follower_id, following_id, created_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE created_at = created_at
      `,
      [followerId, targetId]
    );

    const follower_count = await formatFollowerCount(targetId);
    let conversation_id: number | null = null;
    const targetFollowsBack = await doesFollow(targetId, followerId);
    if (targetFollowsBack) {
      conversation_id = await ensureConversationBetween(followerId, targetId);
    }

    return res.json({ ok: true, follower_count, conversation_id });
  } catch (err) {
    const code = (err as { code?: string }).code;
    const message =
      (err as { sqlMessage?: string }).sqlMessage ||
      (err as { message?: string }).message ||
      "Failed to follow";
    console.error("[users/:id/follow][POST]", code, message);
    return res.status(500).json({ ok: false, error: message });
  }
});

// DELETE /api/users/:id/follow → unfollow
r.delete(
  "/users/:id/follow",
  requireUser,
  async (req: Request, res: Response) => {
    const followerId = req.authUser!.user_id;
    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    if (targetId === followerId) {
      return res
        .status(400)
        .json({ ok: false, error: "Cannot unfollow yourself" });
    }

    try {
      await pool.query(
        "DELETE FROM Follow WHERE follower_id = ? AND following_id = ?",
        [followerId, targetId]
      );

      const follower_count = await formatFollowerCount(targetId);
      return res.json({ ok: true, follower_count });
    } catch (err) {
      const code = (err as { code?: string }).code;
      const message =
        (err as { sqlMessage?: string }).sqlMessage ||
        (err as { message?: string }).message ||
        "Failed to unfollow";
      console.error("[users/:id/follow][DELETE]", code, message);
      return res.status(500).json({ ok: false, error: message });
    }
  }
);

r.get("/users/:id/followers", requireUser, async (req: Request, res: Response) => {
  const targetId = Number(req.params.id);
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }

  if (!canViewConnections(req, targetId)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const [rows] = await pool.query<SimpleUserRow[]>(
      `
        SELECT u.user_id, u.display_name, u.profile_pic_url
        FROM Follow f
        JOIN \`User\` u ON u.user_id = f.follower_id
        WHERE f.following_id = ?
        ORDER BY f.created_at DESC
      `,
      [targetId]
    );

    res.json(
      rows.map((row) => ({
        user_id: row.user_id,
        display_name: row.display_name,
        profile_pic_url: row.profile_pic_url,
      }))
    );
  } catch (err) {
    console.error("[GET /users/:id/followers]", err);
    res.status(500).json({ ok: false, error: "followers_load_failed" });
  }
});

r.get("/users/:id/following", requireUser, async (req: Request, res: Response) => {
  const targetId = Number(req.params.id);
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }

  if (!canViewConnections(req, targetId)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const [rows] = await pool.query<SimpleUserRow[]>(
      `
        SELECT u.user_id, u.display_name, u.profile_pic_url
        FROM Follow f
        JOIN \`User\` u ON u.user_id = f.following_id
        WHERE f.follower_id = ?
        ORDER BY f.created_at DESC
      `,
      [targetId]
    );

    res.json(
      rows.map((row) => ({
        user_id: row.user_id,
        display_name: row.display_name,
        profile_pic_url: row.profile_pic_url,
      }))
    );
  } catch (err) {
    console.error("[GET /users/:id/following]", err);
    res.status(500).json({ ok: false, error: "following_load_failed" });
  }
});

// GET /api/users/:id/posts → profile feed, includes viewer's score if logged in
r.get("/users/:id/posts", async (req: Request, res: Response) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Number(req.query.limit || 20));
    const offset = (page - 1) * limit;

    const auth = (req as unknown as { authUser?: { user_id: number } }).authUser;
    const viewerId = auth?.user_id ?? null;

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
        p.created_at
    `;

    if (viewerId !== null) {
      sql += `,
        (
          SELECT r.score
          FROM Rating r
          WHERE r.post_id = p.post_id
            AND r.user_id = ?
          LIMIT 1
        ) AS my_score
      `;
      params.push(viewerId);
    } else {
      sql += `,
        NULL AS my_score
      `;
    }

    sql += `
      FROM Post p
      WHERE p.user_id = ?
        AND p.status = 'PUBLISHED'
        AND p.moderation_status = 'PASSED'
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(targetUserId, limit, offset);

    const [rows] = await pool.query<UserPostRow[]>(sql, params);
    return res.json(rows);
  } catch (err) {
    const code = (err as { code?: string }).code;
    const message =
      (err as { sqlMessage?: string }).sqlMessage ||
      (err as { message?: string }).message ||
      "Failed to load posts";

    console.error("[users/:id/posts]", code, message);
    return res.status(500).json({ ok: false, error: message });
  }
});

export default r;
