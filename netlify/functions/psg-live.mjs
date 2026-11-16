let cachedPayload = null;
let cacheExpiresAt = 0;
let pendingRequest = null;

export default async () => {
  if (cachedPayload && Date.now() < cacheExpiresAt) {
    return Response.json(cachedPayload, {
      headers: { "Cache-Control": "public, max-age=60" }
    });
  }

  if (!pendingRequest) {
    pendingRequest = (async () => {
      const key = process.env.SPORTSAPI_API_KEY;
      if (!key) throw new Error("Clé API absente de Netlify.");

      const headers = {
        Authorization: `Bearer ${key}`,
        Accept: "application/json"
      };

      const get = async (url) => {
        const response = await fetch(url, { headers });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error?.message || `SportsAPI HTTP ${response.status}`);
        }
        return body.data;
      };

      const search = await get("https://api.sportsapi.app/v2/search?q=Paris%20Saint-Germain&type=team");
      const teams = Array.isArray(search) ? search : [];
      const team = teams.find(item =>
        item.sport === "football" &&
        String(item.name || "").toLowerCase() === "paris saint-germain"
      ) || teams.find(item =>
        item.sport === "football" &&
        /paris saint-germain/i.test(item.name || "")
      );

      if (!team?.id) {
        throw new Error("Impossible de trouver le club Paris Saint-Germain dans SportsAPI.");
      }

      const [upcoming, recent, live] = await Promise.all([
        get(`https://api.sportsapi.app/v2/teams/${team.id}/fixtures?type=upcoming&page=0`),
        get(`https://api.sportsapi.app/v2/teams/${team.id}/fixtures?type=recent&page=0`),
        get("https://api.sportsapi.app/v2/livescores?sport=football")
      ]);

      const isPsg = match =>
        [match.home?.name, match.away?.name].some(name =>
          /paris saint-germain|paris sg|^psg$/i.test(String(name || ""))
        );

      const mapMatch = match => ({
        id: match.id,
        home: match.home?.name || "Équipe domicile",
        away: match.away?.name || "Équipe extérieure",
        homeScore: match.homeScore?.current ?? null,
        awayScore: match.awayScore?.current ?? null,
        status: match.status?.description || match.status?.type || "À venir",
        league: match.league?.name || "Football",
        startTime: match.startTime || match.start_time || match.date || null
      });

      const payload = {
        live: (Array.isArray(live) ? live : []).filter(isPsg).map(mapMatch),
        upcoming: (Array.isArray(upcoming) ? upcoming : []).slice(0, 5).map(mapMatch),
        recent: (Array.isArray(recent) ? recent : []).slice(0, 5).map(mapMatch),
        checkedAt: new Date().toISOString(),
        diagnostics: {
          upcomingCount: Array.isArray(upcoming) ? upcoming.length : -1,
          recentCount: Array.isArray(recent) ? recent.length : -1,
          liveCount: Array.isArray(live) ? live.length : -1,
          upcomingFirstStartTime: Array.isArray(upcoming)
            ? (upcoming[0]?.startTime || upcoming[0]?.start_time || upcoming[0]?.date || null)
            : null,
          recentFirstStartTime: Array.isArray(recent)
            ? (recent[0]?.startTime || recent[0]?.start_time || recent[0]?.date || null)
            : null
        }
      };

      cachedPayload = payload;
      cacheExpiresAt = Date.now() + 5 * 60 * 1000;
      return payload;
    })();
  }

  try {
    const payload = await pendingRequest;
    return Response.json(payload, {
      headers: { "Cache-Control": "public, max-age=60" }
    });
  } catch (error) {
    return Response.json({
      error: "sportsapi_error",
      message: error.message || "Erreur SportsAPI."
    }, { status: 502 });
  } finally {
    pendingRequest = null;
  }
};
