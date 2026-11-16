let cachedPayload = null;
let cacheExpiresAt = 0;
let pendingRequest = null;

export default async () => {
  if (cachedPayload && Date.now() < cacheExpiresAt) {
    return Response.json(cachedPayload, { headers: { "Cache-Control": "public, max-age=300" } });
  }
  if (pendingRequest) {
    try { return Response.json(await pendingRequest, { headers: { "Cache-Control": "public, max-age=300" } }); }
    catch (error) { return Response.json({ error: "sportsapi_error", message: error.message || "Erreur SportsAPI." }, { status: 502 }); }
  }

  pendingRequest = (async () => {
    const key = process.env.SPORTSAPI_API_KEY;
    if (!key) throw new Error("Clé API absente de Netlify.");
    const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };
    const get = async (url) => {
      const response = await fetch(url, { headers });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || `SportsAPI HTTP ${response.status}`);
      return body.data;
    };
    const day = new Date();
    const date = (offset) => {
      const d = new Date(day);
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    const [live, today, tomorrow, men, women] = await Promise.all([
      get("https://api.sportsapi.app/v2/livescores?sport=padel"),
      get(`https://api.sportsapi.app/v2/fixtures?date=${date(0)}&sport=padel&page=0`),
      get(`https://api.sportsapi.app/v2/fixtures?date=${date(1)}&sport=padel&page=0`),
      get("https://api.sportsapi.app/v2/rankings/padel-men"),
      get("https://api.sportsapi.app/v2/rankings/padel-women")
    ]);

    const mapMatch = (m) => ({
      id: m.id,
      home: m.home?.name || "Paire à déterminer",
      away: m.away?.name || "Paire à déterminer",
      homeImage: m.home?.image || null,
      awayImage: m.away?.image || null,
      homeScore: m.homeScore?.current ?? null,
      awayScore: m.awayScore?.current ?? null,
      homeSets: m.homeScore?.periods || {},
      awaySets: m.awayScore?.periods || {},
      status: m.status?.description || m.status?.type || "Programmé",
      statusType: m.status?.type || "scheduled",
      league: m.league?.name || "Premier Padel / FIP",
      gender: m.league?.gender || m.home?.gender || null,
      startTime: m.startTime || null
    });
    const byId = new Map();
    for (const m of [...(Array.isArray(today) ? today : []), ...(Array.isArray(tomorrow) ? tomorrow : []), ...(Array.isArray(live) ? live : [])]) {
      if (m?.id != null) byId.set(m.id, mapMatch(m));
    }
    const matches = [...byId.values()].sort((a,b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
    const mapRanking = rows => (Array.isArray(rows) ? rows : []).slice(0, 20).map(r => ({
      position: r.position,
      name: r.team?.name || "Joueur",
      image: r.team?.image || null,
      points: r.points ?? null,
      previousPosition: r.previousPosition ?? null
    }));
    return {
      live: (Array.isArray(live) ? live : []).map(mapMatch),
      matches,
      rankings: { men: mapRanking(men), women: mapRanking(women) },
      checkedAt: new Date().toISOString()
    };
  })();

  try {
    const payload = await pendingRequest;
    cachedPayload = payload;
    cacheExpiresAt = Date.now() + 10 * 60 * 1000;
    return Response.json(payload, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    return Response.json({ error: "sportsapi_error", message: error.message || "Erreur SportsAPI." }, { status: 502 });
  } finally {
    pendingRequest = null;
  }
};
