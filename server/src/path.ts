import path from "path";
import fs from "fs";

export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads"); // absolute
export const ORIG_DIR = path.join(UPLOAD_DIR, "orig");
export const AVATAR_DIR = path.join(UPLOAD_DIR, "avatars");
export const CENSORED_DIR = path.join(UPLOAD_DIR, "censored");

// ensure folders exist
for (const dir of [UPLOAD_DIR, ORIG_DIR, AVATAR_DIR, CENSORED_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
