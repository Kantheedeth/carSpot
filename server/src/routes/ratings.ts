import { Router, Request, Response } from "express";
import { pool } from "../models/db";

const r = Router();

// Utility type guards for MySQL errors without using `any`
function getMysqlCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const code = (err as Record<string, unknown>).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}
function getMysqlMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const m1 = (err as Record<string, unknown>).sqlMessage;
    const m2 = (err as Record<string, unknown>).message;
    if (typeof m1 === "string") return m1;
    if (typeof m2 === "string") return m2;
  }
  return String(err);
}

r.post("/posts/:id/rate", async (req: Request, res: Response) => {
  const userId = Number(req.header("x-user-id") || 1);
  const postId = Number(req.params.id);

  // body typing (no `any`)
  const body = req.body as { score?: number | string };
  const score = Number(body?.score);

  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return res.status(400).json({ error: "score must be 1..10" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO Rating (user_id, post_id, score) VALUES (?, ?, ?)`,
      [userId, postId, score]
    );
    await conn.commit();
    res.json({ ok: true });
  } catch (e: unknown) {
    await conn.rollback();
    const code = getMysqlCode(e);
    if (code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "already rated" });
    }
    res.status(400).json({ error: getMysqlMessage(e) });
  } finally {
    conn.release();
  }
});

export default r;
