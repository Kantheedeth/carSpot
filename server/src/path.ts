import path from "path";
import fs from "fs";

export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads"); // absolute
export const ORIG_DIR   = path.join(UPLOAD_DIR, "orig");

// ensure folders exist
for (const p of [UPLOAD_DIR, ORIG_DIR]) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
