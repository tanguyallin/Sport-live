let cachedPayload = null;
let cacheExpiresAt = 0;
let pendingRequest = null;

export default async () => {
  if (cachedPayload && Date.now() < cacheExpiresAt) {
    return Response.json(cachedPayload, { headers: { "Cache-Control": "public, max-age=300" } });
  }

  if (!pendingRequest) {
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

      const now = new Date();
      const dateAt = (offset) => {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() + offset);
        return d.toISOString().slice(0, 10);
      };

      // One date request per day, limited to the next week to respect the API rate cap.
      const fixtureRequests = Array.from({ length: 7 }, (_, offset) =>
        get(`https://api.sportsapi.app/v2/fixtures?date=${dateAt(offset)}&sport=padel&page=0`)
      );

      const [live, menRaw, womenRaw, ...dailyFixtures] = await Promise.all([
        get("https://api.sportsapi.app/v2/livescores?sport=padel"),
        get("https://api.sportsapi.app/v2/rankings/padel-men"),
        get("https://api.sportsapi.app/v2/rankings/padel-women"),
        ...fixtureRequests
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
        league: m.league?.name || "",
        tournament: m.league?.name || "Tournoi non renseigné",
        gender: m.league?.gender || m.home?.gender || null,
        startTime: m.startTime || null
      });

      const byId = new Map();
      for (const group of [...dailyFixtures, Array.isArray(live) ? live : []]) {
        for (const m of (Array.isArray(group) ? group : [])) {
          if (m?.id != null) byId.set(m.id, mapMatch(m));
        }
      }

      const isTargetTournament = m => /\bmajor\b|\bp1\b|\bp2\b/i.test(String(m.league || ""));
      const matches = [...byId.values()]
        .filter(isTargetTournament)
        .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
      const liveMatches = (Array.isArray(live) ? live : []).map(mapMatch).filter(isTargetTournament);

      const mapRanking = raw => {
        const rows = Array.isArray(raw) ? raw : (Array.isArray(raw?.rows) ? raw.rows : []);
        return rows.slice(0, 30).map(r => ({
          position: r.position,
          name: r.team?.name || r.name || "Joueur",
          image: r.team?.image || r.image || null,
          points: r.points ?? null,
          previousPosition: r.previousPosition ?? null
        }));
      };

      return {
        live: liveMatches,
        matches,
        rankings: { men: mapRanking(menRaw), women: mapRanking(womenRaw) },
        checkedAt: new Date().toISOString(),
        calendarDays: 7
      };
    })();
  }

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
