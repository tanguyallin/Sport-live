let cachedPayload = null;
let cacheExpiresAt = 0;
let pendingRequest = null;

export default async () => {
  if (cachedPayload && Date.now() < cacheExpiresAt) {
    return Response.json(cachedPayload, { headers: { "Cache-Control": "public, max-age=" + (cachedPayload.live?.length ? 30 : 300) } });
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

      // Limit the live window to three days to keep the combined SportAPI usage below its rate cap.
      const fixtureRequests = Array.from({ length: 3 }, (_, offset) =>
        get(`https://api.sportsapi.app/v2/fixtures?date=${dateAt(offset)}&sport=padel&page=0`)
      );

      const dailyFixtures = await Promise.all(fixtureRequests);

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
        leagueId: m.league?.id || null,
        round: m.round?.name || (typeof m.round === "string" ? m.round : null),
        gender: m.league?.gender || m.home?.gender || null,
        startTime: m.startTime || null
      });

      const byId = new Map();
      for (const group of dailyFixtures) {
        for (const m of (Array.isArray(group) ? group : [])) {
          if (m?.id != null) byId.set(m.id, mapMatch(m));
        }
      }

      const isTargetTournament = m => /\bmajor\b|\bp1\b|\bp2\b/i.test(String(m.league || ""));
      const matches = [...byId.values()]
        .filter(isTargetTournament)
        .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
      const liveMatches = matches.filter(m => /live|in.?progress|playing|period|half/i.test(String(m.statusType || "")));

      return {
        live: liveMatches,
        matches,
        checkedAt: new Date().toISOString(),
        calendarDays: 3
      };
    })();
  }

  try {
    const payload = await pendingRequest;
    cachedPayload = payload;
    cacheExpiresAt = Date.now() + (payload.live.length ? 30_000 : 10 * 60 * 1000);
    return Response.json(payload, { headers: { "Cache-Control": "public, max-age=" + (payload.live.length ? 30 : 300) } });
  } catch (error) {
    return Response.json({ error: "sportsapi_error", message: error.message || "Erreur SportsAPI." }, { status: 502 });
  } finally {
    pendingRequest = null;
  }
};
