import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const artistName = String(req.query.name || "").trim();

  if (!artistName) {
    return res.status(400).json({ error: "Missing artist name" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Escribe una biografía del artista "${artistName}" en español.

Devuelve SOLO JSON válido con estas claves:
- biography
- birthDate
- deathDate
- birthPlace
- deathPlace
- instruments
- periods
- imageKeyword`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text;

    if (!text) {
      return res.status(500).json({ error: "Empty response from Gemini" });
    }

    const cleanText = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanText);

    return res.status(200).json({
      biography: data.biography || "",
      birthDate: data.birthDate || "",
      deathDate: data.deathDate || "",
      birthPlace: data.birthPlace || "",
      deathPlace: data.deathPlace || "",
      instruments: Array.isArray(data.instruments) ? data.instruments : [],
      periods: Array.isArray(data.periods) ? data.periods : [],
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(
        `${artistName} portrait ${data.imageKeyword || "musician"}`
      )}/800/800`,
    });
  } catch (error: any) {
    console.error("Gemini artist metadata error:", error);

    return res.status(500).json({
      error: "Gemini error",
      message: error?.message || String(error),
    });
  }
}