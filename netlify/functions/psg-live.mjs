export default async () => {
  const key = process.env.SPORTSAPI_API_KEY;
  if (!key) return Response.json({ error: "missing_api_key", message: "Clé API absente de Netlify." }, { status: 500 });

  const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };
  const get = async (url) => {
    const response = await fetch(url, { headers });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || `SportsAPI HTTP ${response.status}`);
    return body.data;
  };

  try {
    const search = await get("https://api.sportsapi.app/v2/search?q=Paris%20Saint-Germain&type=team");
    const team = (Array.isArray(search) ? search : []).find(item =>
      item.sport === "football" && String(item.name || "").toLowerCase() === "paris saint-germain"
    ) || (Array.isArray(search) ? search : []).find(item => item.sport === "football" && /paris saint-germain/i.test(item.name || ""));

    if (!team?.id) throw new Error("Impossible de trouver le club Paris Saint-Germain dans SportsAPI.");

    const [upcoming, recent, live] = await Promise.all([
      get(`https://api.sportsapi.app/v2/teams/${team.id}/fixtures?type=upcoming&page=0`),
      get(`https://api.sportsapi.app/v2/teams/${team.id}/fixtures?type=recent&page=0`),
      get("https://api.sportsapi.app/v2/livescores?sport=football")
    ]);

    const isPsg = match => [match.home?.name, match.away?.name].some(name => /paris saint-germain|paris sg|^psg$/i.test(String(name || "")));
    const mapMatch = match => ({
      id: match.id,
      home: match.home?.name || "Équipe domicile",
      away: match.away?.name || "Équipe extérieure",
      homeScore: match.homeScore?.current ?? null,
      awayScore: match.awayScore?.current ?? null,
      status: match.status?.description || match.status?.type || "À venir",
      league: match.league?.name || "Football",
      startTime: match.startTime || null
    });

    return Response.json({
      live: (Array.isArray(live) ? live : []).filter(isPsg).map(mapMatch),
      upcoming: (Array.isArray(upcoming) ? upcoming : []).slice(0, 5).map(mapMatch),
      recent: (Array.isArray(recent) ? recent : []).slice(0, 5).map(mapMatch),
      checkedAt: new Date().toISOString()
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: "sportsapi_error", message: error.message || "Erreur SportsAPI." }, { status: 502 });
  }
};
