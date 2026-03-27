import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
console.log("Gemini API key:", apiKey);

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

export async function fetchArtistMetadata(artistName: string): Promise<ArtistMetadata | null> {
  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY missing");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Provide detailed biographical information for the artist "${artistName}". 
Include:
- A comprehensive biography (approx 200 words).
- Birth date (YYYY-MM-DD).
- Death date (YYYY-MM-DD, if applicable).
- Birth place (City, Country).
- Death place (City, Country, if applicable).
- List of primary instruments or vocal styles.
- List of musical periods or sub-genres (e.g., Bebop, Baroque).
- A descriptive keyword for a high-quality portrait image.
Return the data as a JSON object.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
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
            instruments: { type: Type.ARRAY, items: { type: Type.STRING } },
            periods: { type: Type.ARRAY, items: { type: Type.STRING } },
            imageKeyword: { type: Type.STRING }
          },
          required: ["biography", "birthDate", "birthPlace", "instruments", "periods", "imageKeyword"]
        },
        tools: [{ googleSearch: {} }]
      }
    });

    console.log("Gemini raw response:", response);
    console.log("Gemini text:", response.text);

    if (!response.text) return null;

    const data = JSON.parse(response.text);

    return {
      biography: data.biography,
      birthDate: data.birthDate,
      deathDate: data.deathDate || '',
      birthPlace: data.birthPlace,
      deathPlace: data.deathPlace || '',
      instruments: data.instruments || [],
      periods: data.periods || [],
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(
        artistName + ' portrait ' + data.imageKeyword
      )}/800/800`
    };

  } catch (error) {
    console.error("Error fetching artist metadata:", error);
    return null;
  }
}
