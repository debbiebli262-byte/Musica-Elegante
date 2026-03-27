import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

export interface AlbumData {
  title: string;
  releaseYear: string;
  imageUrl: string;
}

export async function fetchArtistDiscography(
  artistName: string
): Promise<AlbumData[]> {
  console.log("DISCOGRAPHY SERVICE RUNNING", artistName);
  console.log("API key exists:", !!apiKey);

  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY is missing");
    return [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Escribe una lista de los 10 álbumes o grabaciones más conocidos del artista "${artistName}".
Devuelve SOLO un array JSON válido con objetos que tengan:
- title
- releaseYear
- imageKeyword`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              releaseYear: { type: Type.STRING },
              imageKeyword: { type: Type.STRING }
            },
            required: ["title", "releaseYear", "imageKeyword"]
          }
        }
      }
    });

    console.log("Gemini discography text:", response.text);

    if (!response.text) return [];

    const albums = JSON.parse(response.text);

    return albums.map((album: any) => ({
      title: album.title,
      releaseYear: album.releaseYear,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(
        `${album.title} ${album.imageKeyword || "album"}`
      )}/800/800`
    }));
  } catch (error) {
    console.error("Error fetching discography:", error);
    return [];
  }
}
