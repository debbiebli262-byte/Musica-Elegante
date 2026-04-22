import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import mammoth from "mammoth";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });
console.log("Loaded GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "YES" : "NO");

const execFileAsync = promisify(execFile);
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const upload = multer({ dest: "uploads/" });

async function extractTextFromWordFile(filePath: string, originalName: string) {
  const extension = path.extname(originalName).toLowerCase();

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (extension === ".doc") {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "word-import-"));
    const outputDir = tempDir;

    try {
      await execFileAsync("libreoffice", [
        "--headless",
        "--convert-to",
        "docx",
        "--outdir",
        outputDir,
        filePath,
      ]);

      const convertedName = path.basename(filePath, path.extname(filePath)) + ".docx";
      const convertedPath = path.join(outputDir, convertedName);

      const result = await mammoth.extractRawText({ path: convertedPath });
      return result.value;
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  }

  throw new Error("Only .doc and .docx files are supported");
}

async function parseWordTextWithAI(rawText: string, sourceFileName: string) {
  if (!ai) {
    throw new Error("GEMINI_API_KEY is missing in the server environment");
  }

  const prompt = `
You are extracting structured classical music library data from a Word document.

Return ONLY valid JSON.

The document may contain:
- composer biography
- sections like Arias / Quartets / Other Works
- individual works or recordings
- performers, orchestra, conductor
- recording dates
- album or box-set titles
- label, catalog number, format, edition year

Important extraction rule:
The document is often organized by WORK/RECORDING entries, not by album entries.
So first identify each recording entry, then attach album information if it appears below that entry.

Return this JSON structure:

{
  "composer": {
    "name": "",
    "birthDate": "",
    "birthPlace": "",
    "deathDate": "",
    "deathPlace": "",
    "biography": "",
    "nationality": ""
  },
  "recordings": [
    {
      "section": "",
      "workTitle": "",
      "workSubtitle": "",
      "opus": "",
      "compositionDate": "",
      "premiereDate": "",
      "performers": [],
      "soloists": [],
      "orchestra": "",
      "conductor": "",
      "choir": "",
      "recordingDate": "",
      "recordingLocation": "",
      "albumTitle": "",
      "albumSubtitle": "",
      "label": "",
      "catalogNumber": "",
      "format": "",
      "editionYear": "",
      "country": "",
      "notes": ""
    }
  ],
  "albums": [
    {
      "title": "",
      "label": "",
      "catalogNumber": "",
      "format": "",
      "editionYear": "",
      "country": "",
      "discCount": 1,
      "works": [],
      "performers": [],
      "orchestra": "",
      "conductor": "",
      "notes": ""
    }
  ],
  "warnings": []
}

Rules:
- Do not invent missing data.
- If a field is unknown, use empty string or empty array.
- A recording entry may exist even if album info is partial.
- Album titles often appear AFTER the work/performer lines.
- Catalog numbers like "09026-61580-2", "449 346-2", "CACD103" are important.
- Formats like CD, 2 CD, 6 CD, ADD, DDD should be captured when present.
- Keep the original language meaning.
- Extract as many recording entries as possible, not just one album.

Source file: ${sourceFileName}

Document text:
"""${rawText.slice(0, 120000)}"""
`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      composer: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          birthDate: { type: Type.STRING },
          birthPlace: { type: Type.STRING },
          deathDate: { type: Type.STRING },
          deathPlace: { type: Type.STRING },
          biography: { type: Type.STRING },
          nationality: { type: Type.STRING }
        }
      },
      recordings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            section: { type: Type.STRING },
            workTitle: { type: Type.STRING },
            workSubtitle: { type: Type.STRING },
            opus: { type: Type.STRING },
            compositionDate: { type: Type.STRING },
            premiereDate: { type: Type.STRING },
            performers: { type: Type.ARRAY, items: { type: Type.STRING } },
            soloists: { type: Type.ARRAY, items: { type: Type.STRING } },
            orchestra: { type: Type.STRING },
            conductor: { type: Type.STRING },
            choir: { type: Type.STRING },
            recordingDate: { type: Type.STRING },
            recordingLocation: { type: Type.STRING },
            albumTitle: { type: Type.STRING },
            albumSubtitle: { type: Type.STRING },
            label: { type: Type.STRING },
            catalogNumber: { type: Type.STRING },
            format: { type: Type.STRING },
            editionYear: { type: Type.STRING },
            country: { type: Type.STRING },
            notes: { type: Type.STRING }
          }
        }
      },
      albums: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            label: { type: Type.STRING },
            catalogNumber: { type: Type.STRING },
            format: { type: Type.STRING },
            editionYear: { type: Type.STRING },
            country: { type: Type.STRING },
            discCount: { type: Type.NUMBER },
            works: { type: Type.ARRAY, items: { type: Type.STRING } },
            performers: { type: Type.ARRAY, items: { type: Type.STRING } },
            orchestra: { type: Type.STRING },
            conductor: { type: Type.STRING },
            notes: { type: Type.STRING }
          }
        }
      },
      warnings: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    },
    required: ["composer", "recordings", "albums", "warnings"]
  };

  const maxRetries = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`AI attempt ${attempt}`);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      if (!response.text) {
        throw new Error("AI returned empty response");
      }

      return JSON.parse(response.text);
    } catch (error) {
      lastError = error;
      console.error(`AI attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to parse Word text with AI");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/resolve-image", async (req, res) => {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch site");
      }

      const html = await response.text();

      const ogImage =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];

      const twitterImage =
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1];

      const icon =
        html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)?.[1];

      let resolvedUrl = ogImage || twitterImage || icon;

      if (resolvedUrl && !resolvedUrl.startsWith("http")) {
        const baseUrl = new URL(url);
        resolvedUrl = new URL(resolvedUrl, baseUrl.origin).toString();
      }

      if (resolvedUrl) {
        return res.json({ imageUrl: resolvedUrl });
      }

      const firstImg = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];

      if (firstImg) {
        const baseUrl = new URL(url);
        resolvedUrl = new URL(firstImg, baseUrl.origin).toString();
        return res.json({ imageUrl: resolvedUrl });
      }

      return res.status(404).json({ error: "No image found on this site" });
    } catch (error) {
      console.error("Error resolving image:", error);
      return res.status(500).json({ error: "Failed to resolve image from URL" });
    }
  });

  app.post("/api/import-word", upload.single("file"), async (req, res) => {
    let filePath: string | undefined;

    try {
      filePath = req.file?.path;
      const originalName = req.file?.originalname || "";

      console.log("Uploading file:", originalName);

      if (!filePath) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const extension = path.extname(originalName).toLowerCase();

      if (![".doc", ".docx"].includes(extension)) {
        return res.status(400).json({ error: "Only .doc and .docx files are supported" });
      }

      const rawText = await extractTextFromWordFile(filePath, originalName);

      console.log("Extracted text length:", rawText?.length || 0);

      if (!rawText.trim()) {
        return res.status(400).json({ error: "No readable text found in the Word file" });
      }

      const parsed = await parseWordTextWithAI(rawText, originalName);

      console.log("PARSED RESULT:");
      console.log(JSON.stringify(parsed, null, 2));

      return res.json({
        ...parsed,
        rawText,
        sourceFileName: originalName,
      });
    } catch (error) {
      console.error("Error importing Word file:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to process Word file",
      });
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
