import { Router, Request, Response } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pool } from "../models/db";
import { requireUser } from "../middleware/auth";

const r = Router();

type SettingRow = RowDataPacket & { v: string };
type TargetRow = RowDataPacket & { user_id: number; status: string };
type ConversationRow = RowDataPacket & { conversation_id: number };
type FollowRow = RowDataPacket & { follower_id: number; following_id: number };
type InboxRow = RowDataPacket & {
  conversation_id: number;
  other_user_id: number;
  other_display_name: string | null;
  other_profile_pic_url: string | null;
  last_body: string | null;
  last_created_at: Date | null;
  conversation_created_at: Date;
};
type ParticipantRow = RowDataPacket & { is_participant: number };
type MessageRow = RowDataPacket & {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  created_at: Date;
  seen_at: Date | null;
  sender_display_name: string | null;
  sender_profile_pic_url: string | null;
};

function parseBool(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function isParticipant(conversationId: number, userId: number) {
  const [rows] = await pool.query<ParticipantRow[]>(
    `
      SELECT EXISTS(
        SELECT 1 FROM ConversationParticipant
        WHERE conversation_id = ? AND user_id = ?
      ) AS is_participant
    `,
    [conversationId, userId]
  );
  return rows[0]?.is_participant === 1;
}

function mapMessage(row: MessageRow) {
  return {
    message_id: row.message_id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    sender_display_name: row.sender_display_name,
    sender_profile_pic_url: row.sender_profile_pic_url,
    body: row.body,
    created_at: row.created_at,
    seen_at: row.seen_at,
  };
}

r.get("/dm/inbox", requireUser, async (req: Request, res: Response) => {
  const userId = req.authUser!.user_id;

  try {
    const [rows] = await pool.query<InboxRow[]>(
      `
        SELECT
          cp.conversation_id,
          u.user_id AS other_user_id,
          u.display_name AS other_display_name,
          u.profile_pic_url AS other_profile_pic_url,
          lm.body AS last_body,
          lm.created_at AS last_created_at,
          c.created_at AS conversation_created_at
        FROM ConversationParticipant cp
        JOIN ConversationParticipant cp2
          ON cp2.conversation_id = cp.conversation_id
         AND cp2.user_id <> cp.user_id
        JOIN Conversation c ON c.conversation_id = cp.conversation_id
        JOIN \`User\` u ON u.user_id = cp2.user_id
        LEFT JOIN Message lm
          ON lm.message_id = (
            SELECT m2.message_id
            FROM Message m2
            WHERE m2.conversation_id = cp.conversation_id
            ORDER BY m2.created_at DESC, m2.message_id DESC
            LIMIT 1
          )
        WHERE cp.user_id = ?
        ORDER BY
          CASE WHEN lm.created_at IS NULL THEN 1 ELSE 0 END,
          COALESCE(lm.created_at, c.created_at) DESC,
          cp.conversation_id DESC
      `,
      [userId]
    );

    return res.json(
      rows.map((row) => ({
        conversation_id: row.conversation_id,
        other_user: {
          user_id: row.other_user_id,
          display_name: row.other_display_name,
          profile_pic_url: row.other_profile_pic_url,
        },
        last_message: row.last_body,
        last_at: row.last_created_at ?? row.conversation_created_at,
      }))
    );
  } catch (err) {
    console.error("[GET /api/dm/inbox]", err);
    return res.status(500).json({ ok: false, error: "inbox_load_failed" });
  }
});

r.post("/dm/start", requireUser, async (req: Request, res: Response) => {
  const userId = req.authUser!.user_id;
  const rawTarget =
    req.body?.user_id ?? req.body?.target_user_id ?? req.query?.user_id;
  const targetId = Number(rawTarget);

  if (!Number.isFinite(targetId) || targetId <= 0) {
    return res.status(400).json({ ok: false, error: "invalid_target_id" });
  }

  if (targetId === userId) {
    return res.status(400).json({ ok: false, error: "cannot_dm_self" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [targetRows] = await conn.query<TargetRow[]>(
      "SELECT user_id, status FROM `User` WHERE user_id = ? LIMIT 1",
      [targetId]
    );

    if (targetRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: "target_not_found" });
    }

    if (targetRows[0].status !== "ACTIVE") {
      await conn.rollback();
      return res
        .status(403)
        .json({ ok: false, error: "target_not_available" });
    }

    const [settingRows] = await conn.query<SettingRow[]>(
      "SELECT v FROM AppSetting WHERE k = 'require_mutual_follow_for_dm' LIMIT 1"
    );
    const requireMutual =
      settingRows.length === 0 ? true : parseBool(settingRows[0].v);

    if (requireMutual) {
      const [follows] = await conn.query<FollowRow[]>(
        `
          SELECT follower_id, following_id
          FROM Follow
          WHERE (follower_id = ? AND following_id = ?)
             OR (follower_id = ? AND following_id = ?)
        `,
        [userId, targetId, targetId, userId]
      );

      const userFollows = follows.some(
        (row) => row.follower_id === userId && row.following_id === targetId
      );
      const targetFollows = follows.some(
        (row) => row.follower_id === targetId && row.following_id === userId
      );

      if (!userFollows || !targetFollows) {
        await conn.rollback();
        return res
          .status(403)
          .json({ ok: false, error: "mutual_follow_required" });
      }
    }

    const [existing] = await conn.query<ConversationRow[]>(
      `
        SELECT cp1.conversation_id
        FROM ConversationParticipant cp1
        JOIN ConversationParticipant cp2
          ON cp1.conversation_id = cp2.conversation_id
        WHERE cp1.user_id = ? AND cp2.user_id = ?
        ORDER BY cp1.conversation_id ASC
        LIMIT 1
      `,
      [userId, targetId]
    );

    let conversationId: number;
    let created = false;

    if (existing.length > 0) {
      conversationId = existing[0].conversation_id;
    } else {
      const [convResult] = await conn.query<ResultSetHeader>(
        "INSERT INTO Conversation (created_at) VALUES (NOW())"
      );
      conversationId = convResult.insertId;

      await conn.query(
        `
          INSERT INTO ConversationParticipant (conversation_id, user_id)
          VALUES (?, ?), (?, ?)
        `,
        [conversationId, userId, conversationId, targetId]
      );
      created = true;
    }

    await conn.commit();
    return res.json({ ok: true, conversation_id: conversationId, created });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback failures
    }
    console.error("[POST /api/dm/start]", err);
    return res.status(500).json({ ok: false, error: "dm_start_failed" });
  } finally {
    conn.release();
  }
});

r.get(
  "/dm/:cid/messages",
  requireUser,
  async (req: Request, res: Response) => {
    const conversationId = Number(req.params.cid);
    const userId = req.authUser!.user_id;

    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_conversation" });
    }

    const participant = await isParticipant(conversationId, userId);
    if (!participant) {
      return res.status(403).json({ ok: false, error: "not_participant" });
    }

    try {
      const [rows] = await pool.query<MessageRow[]>(
        `
          SELECT
            m.message_id,
            m.conversation_id,
            m.sender_id,
            m.body,
            m.created_at,
            m.seen_at,
            u.display_name AS sender_display_name,
            u.profile_pic_url AS sender_profile_pic_url
          FROM Message m
          JOIN \`User\` u ON u.user_id = m.sender_id
          WHERE m.conversation_id = ?
          ORDER BY m.created_at ASC, m.message_id ASC
        `,
        [conversationId]
      );

      return res.json(rows.map(mapMessage));
    } catch (err) {
      console.error("[GET /api/dm/:cid/messages]", err);
      return res
        .status(500)
        .json({ ok: false, error: "messages_load_failed" });
    }
  }
);

r.post(
  "/dm/:cid/messages",
  requireUser,
  async (req: Request, res: Response) => {
    const conversationId = Number(req.params.cid);
    const userId = req.authUser!.user_id;
    const bodyText = String(req.body?.body || "").trim();

    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_conversation" });
    }

    if (!bodyText) {
      return res.status(400).json({ ok: false, error: "message_required" });
    }

    if (bodyText.length > 4000) {
      return res
        .status(400)
        .json({ ok: false, error: "message_too_long" });
    }

    const participant = await isParticipant(conversationId, userId);
    if (!participant) {
      return res.status(403).json({ ok: false, error: "not_participant" });
    }

    try {
      const [result] = await pool.query<ResultSetHeader>(
        `
          INSERT INTO Message (conversation_id, sender_id, body, created_at)
          VALUES (?, ?, ?, NOW())
        `,
        [conversationId, userId, bodyText]
      );

      const insertId = result.insertId;
      const [rows] = await pool.query<MessageRow[]>(
        `
          SELECT
            m.message_id,
            m.conversation_id,
            m.sender_id,
            m.body,
            m.created_at,
            m.seen_at,
            u.display_name AS sender_display_name,
            u.profile_pic_url AS sender_profile_pic_url
          FROM Message m
          JOIN \`User\` u ON u.user_id = m.sender_id
          WHERE m.message_id = ?
          LIMIT 1
        `,
        [insertId]
      );

      if (!rows.length) {
        return res
          .status(500)
          .json({ ok: false, error: "message_not_found_after_insert" });
      }

      return res.status(201).json(mapMessage(rows[0]));
    } catch (err) {
      console.error("[POST /api/dm/:cid/messages]", err);
      return res.status(500).json({ ok: false, error: "message_send_failed" });
    }
  }
);

export default r;
