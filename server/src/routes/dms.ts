import { Router } from "express";
const r = Router();

// you can CALL sp_start_dm here later
r.post("/dm/start", async (_req, res) => {
  res.status(501).json({ error: "not implemented yet" });
});

export default r;
