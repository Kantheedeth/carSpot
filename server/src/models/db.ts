import mysql from "mysql2/promise";
import "dotenv/config";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",   // use 127.0.0.1 to force TCP
  port: Number(process.env.DB_PORT || 3306),  // set your real port
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "car_rating_app",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
});

// simple ping() the rest of the app can call
export async function ping() {
  const c = await pool.getConnection();
  await c.ping();
  c.release();
}
