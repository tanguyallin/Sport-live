const BASE = "https://api.sportsapi.app/v2";
const memoryCache = new Map();

function jsonResponse(statusCode, body, cacheSeconds = 30) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": statusCode === 200
        ? `public, max-age=${cacheSeconds}, stale-while-revalidate=120`
        : "no-store"
    },
    body: JSON.stringify(body)
  };
}

async function api(path) {
  const key = process.env.SPORTSAPI_API_KEY;
  if (!key) {
    const error = new Error("La clé SPORTSAPI_API_KEY manque dans les variables d’environnement Netlify.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });

  let payload;
  try { payload = await response.json(); }
  catch { payload = {}; }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `SportsAPI a répondu HTTP ${response.status}.`;
    const error = new Error(message);
    error.statusCode = response.status === 429 ? 429 : (response.status >= 500 ? 502 : response.status);
    throw error;
  }
  return payload?.data;
}

async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > now) return entry.value;
  const value = await loader();
  memoryCache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function searchEntity(query, type, predicate) {
  return cached(`search:${type}:${query}`, 6 * 60 * 60 * 1000, async () => {
    const hits = await api(`/search?q=${encodeURIComponent(query)}&type=${type}`);
    const match = (Array.isArray(hits) ? hits : []).find(predicate);
    if (!match) {
      const error = new Error(`SportsAPI ne trouve pas ${query}. Vérifie la couverture de la compétition.`);
      error.statusCode = 404;
      throw error;
    }
    return match;
  });
}

async function psgTeam() {
  return searchEntity("Paris Saint-Germain", "team", item =>
    item.sport === "football" &&
    normalize(item.name) === "paris saint-germain" &&
    (!item.gender || item.gender === "male")
  );
}

async function league(query, predicate) {
  return searchEntity(query, "league", item =>
    item.sport === "football" && predicate(item)
  );
}

function fixtureForApp(fixture) {
  const statusType = fixture?.status?.type;
  const status = statusType === "inprogress" ? "EN DIRECT"
    : statusType === "finished" ? "TERMINÉ"
    : statusType === "postponed" ? "REPORTÉ"
    : statusType === "canceled" ? "ANNULÉ"
    : fixture?.status?.description || "À VENIR";

  return {
    id: fixture.id,
    home: fixture.home?.name || "Équipe à confirmer",
    away: fixture.away?.name || "Équipe à confirmer",
    homeScore: fixture.homeScore?.current ?? null,
    awayScore: fixture.awayScore?.current ?? null,
    league: fixture.league?.name || "Football",
    round: fixture.round?.name || fixture.round?.description || "",
    status,
    startTime: fixture.startTime || null
  };
}

module.exports = { api, cached, jsonResponse, psgTeam, league, fixtureForApp, normalize };
