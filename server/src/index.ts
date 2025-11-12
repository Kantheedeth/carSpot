import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import cookieParser from "cookie-parser";    
import { UPLOAD_DIR, ORIG_DIR } from "./path";
import { ping, pool } from "./models/db";
import type { RowDataPacket } from "mysql2";


import posts from "./routes/posts";
import users from "./routes/users";
import ratings from "./routes/ratings";
import bookmarks from "./routes/bookmarks";
import dms from "./routes/dms";
import settings from "./routes/settings";
import auth from "./routes/auth";
import { attachAuth } from "./middleware/auth"; 

const app = express();                    // ← exactly once
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());    
app.use(morgan("dev"));
app.use(attachAuth);  

// serve static uploads
console.log("[static] /uploads ->", UPLOAD_DIR);
app.use("/uploads", express.static(UPLOAD_DIR));

// health
app.get("/api/health", async (_req, res) => {
  try { await ping(); res.json({ ok: true }); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: msg });
  }
});

// debug
// --- Debug routes (typed, no "any") ---
interface DbRow extends RowDataPacket { db: string }

interface PostRaw extends RowDataPacket {
  post_id: number;
  image_url_orig: string;
  status: "PUBLISHED" | "PENDING" | "DELETED";
  moderation_status: "PENDING" | "PASSED" | "REJECTED";
  created_at: Date;
}

app.get("/api/debug/db", async (_req, res) => {
  const [rows] = await pool.query<DbRow[]>("SELECT DATABASE() AS db");
  res.json({ db: rows[0]?.db ?? null });
});

app.get("/api/debug/posts-raw", async (_req, res) => {
  const [rows] = await pool.query<PostRaw[]>(
    "SELECT post_id,image_url_orig,status,moderation_status,created_at FROM `Post` ORDER BY post_id DESC LIMIT 10"
  );
  res.json(rows);
});

app.get("/api/debug/uploads", (_req, res) => {
  const files = fs.existsSync(ORIG_DIR) ? fs.readdirSync(ORIG_DIR) : [];
  res.json({ dir: ORIG_DIR, files });
});


// APIs
app.use("/api", posts);
app.use("/api", users);
app.use("/api", ratings);
app.use("/api", bookmarks);
app.use("/api", dms);
app.use("/api", settings);
app.use("/api", auth);

// 404 trap
app.use((req, res) => {
  console.warn("[404]", req.method, req.originalUrl);
  res.status(404).json({ ok: false, error: "Not found", path: req.originalUrl });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API http://localhost:${port}`));
