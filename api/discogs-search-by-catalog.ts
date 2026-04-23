import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const rawCatno = String(req.query.catno || "").trim();

    if (!rawCatno) {
      return res.status(400).json({ error: "Catalog number is required" });
    }

    const token = process.env.DISCOGS_TOKEN;
    const userAgent = process.env.DISCOGS_USER_AGENT || "MusicaElegante/1.0";

    if (!token) {
      return res.status(500).json({ error: "DISCOGS_TOKEN is missing" });
    }

    const variants = [
      rawCatno,
      rawCatno.replace(/-/g, ""),
      rawCatno.replace(/\s+/g, ""),
    ].filter(Boolean);

    let found: any = null;

    for (const catno of variants) {
      const searchUrl = new URL("https://api.discogs.com/database/search");
      searchUrl.searchParams.set("catno", catno);
      searchUrl.searchParams.set("type", "release");
      searchUrl.searchParams.set("per_page", "10");

      const response = await fetch(searchUrl.toString(), {
        headers: {
          "User-Agent": userAgent,
          "Authorization": `Discogs token=${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Discogs error:", text);
        continue;
      }

      const data = await response.json();

      if (data.results?.length) {
        found = data.results[0];
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: "No Discogs release found" });
    }

    return res.status(200).json({
      title: found.title || "",
      year: found.year || "",
      country: found.country || "",
      format: Array.isArray(found.format) ? found.format.join(", ") : "",
      label: Array.isArray(found.label) ? found.label.join(", ") : "",
      catno: found.catno || "",
      thumb: found.thumb || "",
      coverImage: found.cover_image || "",
      discogsUrl: found.uri ? `https://www.discogs.com${found.uri}` : "",
      raw: found,
    });
  } catch (error) {
    console.error("Discogs catalog search error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected Discogs error",
    });
  }
}