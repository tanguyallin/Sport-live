let cachedPayload = null;
let cacheExpiresAt = 0;
let pendingRequest = null;

async function fetchRanking(category, token) {
 const url = new URL("https://padelapi.org/api/rankings");
 url.searchParams.set("type", "official");
 url.searchParams.set("category", category);
 url.searchParams.set("sort_by", "ranking");
 url.searchParams.set("order_by", "asc");
 url.searchParams.set("per_page", "50");
 const response = await fetch(url, {
  headers: {
   "Authorization": "Bearer " + token,
   "Accept": "application/json"
  }
 });
 const payload = await response.json().catch(() => ({}));
 if (!response.ok) {
  const detail = payload.message || ("HTTP " + response.status);
  throw new Error("Padel API (" + category + ") : " + detail);
 }
 const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [];
 return rows
  .filter(row => row && row.name && Number.isFinite(Number(row.ranking)) && Number.isFinite(Number(row.points)))
  .map(row => ({
   position: Number(row.ranking),
   name: String(row.name),
   country: row.nationality ? String(row.nationality).toUpperCase() : null,
   points: Number(row.points),
   image: row.image || row.image_url || row.photo || row.photo_url || row.player_image || row.avatar || row.avatar_url || row.player?.image || row.player?.photo || null
  }))
  .sort((a, b) => a.position - b.position)
  .slice(0, 50);
}

export default async () => {
 if (cachedPayload && Date.now() < cacheExpiresAt) {
  return Response.json(cachedPayload, { headers: { "Cache-Control": "public, max-age=3600" } });
 }
 if (!pendingRequest) pendingRequest = (async () => {
  const token = process.env.PADEL_API_TOKEN;
  if (!token) throw new Error("Clé Padel API manquante : ajoute PADEL_API_TOKEN dans les variables d’environnement Netlify.");
  const [men, women] = await Promise.all([
   fetchRanking("men", token),
   fetchRanking("women", token)
  ]);
  if (!men.length || !women.length) throw new Error("La source Padel API n’a pas renvoyé les deux classements officiels.");
  return {
   rankings: { men, women },
   source: "Classement officiel FIP · Padel API",
   sourceUrl: "https://padelapi.org/",
   checkedAt: new Date().toISOString()
  };
 })();
 try {
  const payload = await pendingRequest;
  cachedPayload = payload;
  cacheExpiresAt = Date.now() + 12 * 60 * 60 * 1000;
  return Response.json(payload, { headers: { "Cache-Control": "public, max-age=3600" } });
 } catch (error) {
  return Response.json({
   error: "padel_rankings_error",
   message: error.message || "Classements FIP indisponibles."
  }, { status: 502 });
 } finally {
  pendingRequest = null;
 }
};
