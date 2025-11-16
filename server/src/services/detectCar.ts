import fs from "fs/promises";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
let genAI: GoogleGenerativeAI | null = null;

function getClient() {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export async function detectCarPresence(filePath: string): Promise<boolean> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType =
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    }[ext] || "image/jpeg";

  const prompt =
    "Respond ONLY with strict JSON {\"hasCar\":true|false}. Does this photo clearly show a car?";

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: buffer.toString("base64"),
      },
    },
  ]);

  const text = (result.response?.text() || "").trim();
  if (!text) return false;
  try {
    const parsed = JSON.parse(text);
    return Boolean(parsed?.hasCar);
  } catch {
    return false;
  }
}
