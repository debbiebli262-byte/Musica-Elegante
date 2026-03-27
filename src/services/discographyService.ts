import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || '';

export interface AlbumData {
  title: string;
  releaseYear: string;
  imageUrl: string;
}

export async function fetchArtistDiscography(artistName: string): Promise<AlbumData[]> {
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Provide a list of the top 10 most famous albums by the artist "${artistName}". 
  For each album, include the title and the release year. 
  Also, provide a descriptive keyword for each album that can be used to generate a relevant cover image using a placeholder service like picsum.photos.
  Return the data as a JSON array of objects with keys: "title", "releaseYear", and "imageKeyword".`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
        },
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text;
    if (!text) return [];

    const albums = JSON.parse(text);
    return albums.map((album: any) => ({
      title: album.title,
      releaseYear: album.releaseYear,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(album.title + ' ' + album.imageKeyword)}/800/800`
    }));
  } catch (error) {
    console.error("Error fetching discography:", error);
    return [];
  }
}
