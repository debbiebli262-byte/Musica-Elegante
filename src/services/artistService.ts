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
  alert("ARTIST SERVICE NEW VERSION");
  console.log("ARTIST SERVICE NEW VERSION", artistName);
  console.log("fetchArtistMetadata called with:", artistName);
  console.log("API key exists:", !!apiKey);

  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY missing");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Provide detailed biographical information for the artist "${artistName}".
Return ONLY valid JSON with these keys:
- biography
- birthDate
- deathDate
- birthPlace
- deathPlace
- instruments
- periods
- imageKeyword

Rules:
- biography: around 120-180 words
- birthDate and deathDate: format YYYY-MM-DD when known, otherwise empty string
- birthPlace and deathPlace: "City, Country" when known, otherwise empty string
- instruments: array of strings
- periods: array of strings
- imageKeyword: a short portrait description`;

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

    console.log("Gemini response object:", response);
    console.log("Gemini response text:", response.text);

    if (!response.text) {
      console.error("Gemini returned empty response.text");
      return null;
    }

    const data = JSON.parse(response.text);

    const result: ArtistMetadata = {
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

    console.log("Parsed artist metadata:", result);
    return result;
  } catch (error) {
    console.error("Error fetching artist metadata:", error);
    return null;
  }
}
