import { Router } from "express";
import { pool } from "../models/db";
const r = Router();

r.get("/settings", async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT k, v FROM AppSetting
     WHERE k IN ('rating_tolerance','rating_matches_required',
                 'require_mutual_follow_for_dm','posting_enabled','moderation_mode')`
  );
  res.json(rows);
});

export default r;
