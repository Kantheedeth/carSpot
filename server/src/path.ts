import path from "path";
import fs from "fs";

export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads"); // absolute
export const ORIG_DIR   = path.join(UPLOAD_DIR, "orig");
export const AVATAR_DIR = path.join(UPLOAD_DIR, "avatars");

// ensure folders exist
for (const p of [UPLOAD_DIR, ORIG_DIR, AVATAR_DIR]) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
