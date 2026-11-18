const { getStore } = require("@netlify/blobs");

const BASE = "https://api.sportsapi.app/v2";
const memoryCache = new Map();
const inFlight = new Map();
let sharedStore;

function store() {
  if (!sharedStore) sharedStore = getStore("sport-live-sportsapi-cache");
  return sharedStore;
}

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

// Shared Netlify Blobs cache survives cold starts and is common to all functions/users.
// Stale values are deliberately retained so a temporary API 429 does not blank the app.
async function cached(key, ttlMs, loader, staleTtlMs = 7 * 24 * 60 * 60 * 1000) {
  const now = Date.now();
  const local = memoryCache.get(key);
  if (local && local.expiresAt > now) return local.value;
  if (inFlight.has(key)) return inFlight.get(key);

  const task = (async () => {
    let saved = local || null;
    try {
      const shared = await store().get(`v1:${key}`, { type: "json", consistency: "strong" });
      if (shared) saved = shared;
    } catch (error) {
      console.warn("Cache partagé indisponible, cache mémoire utilisé:", error.message);
    }

    if (saved && saved.expiresAt > now) {
      memoryCache.set(key, saved);
      return saved.value;
    }

    try {
      const value = await loader();
      const entry = {
        value,
        expiresAt: now + ttlMs,
        staleUntil: now + ttlMs + staleTtlMs
      };
      memoryCache.set(key, entry);
      try { await store().setJSON(`v1:${key}`, entry); }
      catch (error) { console.warn("Écriture du cache partagé impossible:", error.message); }
      return value;
    } catch (error) {
      if (saved && saved.staleUntil > now) {
        console.warn(`SportsAPI indisponible (${error.statusCode || "erreur"}), utilisation du cache périmé pour ${key}.`);
        memoryCache.set(key, saved);
        return saved.value;
      }
      throw error;
    }
  })();

  inFlight.set(key, task);
  try { return await task; }
  finally { inFlight.delete(key); }
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();
}

async function searchEntity(query, type, predicate) {
  return cached(`search:${type}:${query}`, 24 * 60 * 60 * 1000, async () => {
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
  const isMen = item => item.sport === "football" &&
    /paris saint.?germain|paris sg/i.test(item.name || "") &&
    (!item.gender || item.gender === "male");
  try {
    return await searchEntity("Paris Saint-Germain", "team", isMen);
  } catch (firstError) {
    // Never turn a 429 into a second API request: that makes rate limiting worse.
    if (firstError.statusCode !== 404) throw firstError;
    return searchEntity("Paris SG", "team", isMen);
  }
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
