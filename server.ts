import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import mammoth from "mammoth";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ dest: "uploads/" });

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
      if (!response.ok) throw new Error("Failed to fetch site");
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

      res.status(404).json({ error: "No image found on this site" });
    } catch (error) {
      console.error("Error resolving image:", error);
      res.status(500).json({ error: "Failed to resolve image from URL" });
    }
  });

  app.post("/api/upload-word", upload.single("file"), async (req, res) => {
    try {
      const filePath = req.file?.path;
      if (!filePath) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;

      fs.unlinkSync(filePath);

      return res.json({
        success: true,
        extractedText: text,
      });
    } catch (error) {
      console.error("Error processing Word file:", error);
      return res.status(500).json({ error: "Failed to process Word file" });
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
