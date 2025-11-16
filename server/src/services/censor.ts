import fs from "fs/promises";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const requestedModel = process.env.GEMINI_MODEL;
const modelName =
  !requestedModel || /flash-image$/i.test(requestedModel)
    ? requestedModel || "gemini-2.5-flash-image"
    : `${requestedModel}-image`;

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

async function editImage(buffer: Buffer, mimeType: string) {
  const client = getClient();
  const model = client.getGenerativeModel({ model: modelName });
  const prompt = `
ONLY blur actual automobile license plates using a rectangular black box.
If no plates are visible, return the original photo unchanged and do not invent any blur.
`.trim();
  const base64 = buffer.toString("base64");

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: base64,
      },
    },
  ]);

  const parts =
    result.response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = (part as {
      inlineData?: { data?: string; mimeType?: string };
    }).inlineData;
    if (inline?.data) {
      return {
        buffer: Buffer.from(inline.data, "base64"),
        mimeType: inline.mimeType || "image/png",
      };
    }
  }
  return null;
}

export async function censorImage({
  sourcePath,
  targetPath,
}: {
  sourcePath: string;
  targetPath: string;
}) {
  const buffer = await fs.readFile(sourcePath);
  const ext = path.extname(sourcePath).toLowerCase();
  const mimeType =
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    }[ext] || "image/jpeg";

  let edited: { buffer: Buffer; mimeType: string } | null = null;
  try {
    edited = await editImage(buffer, mimeType);
  } catch (err) {
    console.error("[censor] Gemini request failed", err);
    edited = null;
  }

  if (edited) {
    await fs.writeFile(targetPath, edited.buffer);
    return { wasCensored: true, mimeType: edited.mimeType };
  }

  await fs.copyFile(sourcePath, targetPath);
  return { wasCensored: false, mimeType };
}
