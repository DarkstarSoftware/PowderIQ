// src/lib/skimap.ts
// Fetches the most recent trail map image URL from skimap.org for a given area ID.
// Results cached 24h via Next.js fetch cache.

export async function fetchSkimapImage(areaId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://skimap.org/skiareas/view/${areaId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PowderIQ/1.0)' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // First <source type="image/jpg"> is the most recent map (page ordered newest first)
    const match = html.match(/<source srcSet="(https:\/\/files\.skimap\.org\/[^"]+)" type="image\/jpg"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
