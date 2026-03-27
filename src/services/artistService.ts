import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

export interface ArtistMetadata {
  biography: string;
  birthDate: string;
  deathDate: string;
  birthPlace: string;
  deathPlace: string;
  instruments: string[];
  periods: string[];
  imageUrl: string;
}

export async function fetchArtistMetadata(
  artistName: string
): Promise<ArtistMetadata | null> {
  console.log("ARTIST SERVICE RUNNING", artistName);
  console.log("API key exists:", !!apiKey);

  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY missing");
    return null;
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
- imageKeyword

Reglas:
- biography: 120-180 palabras, en español
- birthDate y deathDate: formato YYYY-MM-DD si se conoce, si no cadena vacía
- birthPlace y deathPlace: "Ciudad, País" si se conoce, si no cadena vacía
- instruments: array de strings en español
- periods: array de strings en español
- imageKeyword: descripción corta para retrato`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            biography: { type: Type.STRING },
            birthDate: { type: Type.STRING },
            deathDate: { type: Type.STRING },
            birthPlace: { type: Type.STRING },
            deathPlace: { type: Type.STRING },
            instruments: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            periods: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            imageKeyword: { type: Type.STRING }
          },
          required: [
            "biography",
            "birthDate",
            "deathDate",
            "birthPlace",
            "deathPlace",
            "instruments",
            "periods",
            "imageKeyword"
          ]
        }
      }
    });

    console.log("Gemini response text:", response.text);

    if (!response.text) {
      console.error("Gemini returned empty response.text");
      return null;
    }

    const data = JSON.parse(response.text);

    return {
      biography: data.biography || "",
      birthDate: data.birthDate || "",
      deathDate: data.deathDate || "",
      birthPlace: data.birthPlace || "",
      deathPlace: data.deathPlace || "",
      instruments: Array.isArray(data.instruments) ? data.instruments : [],
      periods: Array.isArray(data.periods) ? data.periods : [],
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(
        `${artistName} portrait ${data.imageKeyword || "musician"}`
      )}/800/800`
    };
  } catch (error) {
    console.error("Error fetching artist metadata:", error);
    return null;
  }
}
