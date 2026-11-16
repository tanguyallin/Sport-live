export default async () => {
  const key = process.env.SPORTSAPI_API_KEY;
  if (!key) {
    return Response.json({ error: "missing_api_key", message: "La clé SportsAPI n'est pas disponible dans les fonctions Netlify." }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.sportsapi.app/v2/livescores?sport=football", {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }
    });
    const payload = await response.json();

    if (!response.ok) {
      return Response.json({
        error: "sportsapi_error",
        message: payload?.error?.message || `SportsAPI a répondu avec le statut ${response.status}.`
      }, { status: response.status });
    }

    const allMatches = Array.isArray(payload?.data) ? payload.data : [];
    const isPSG = (team) => {
      const name = String(team?.name || "").toLocaleLowerCase("fr");
      return name.includes("paris saint-germain") || name === "paris sg" || name === "psg";
    };
    const matches = allMatches.filter(match => isPSG(match.home) || isPSG(match.away));

    return Response.json({
      matches: matches.map(match => ({
        id: match.id,
        home: match.home?.name || "Équipe domicile",
        away: match.away?.name || "Équipe extérieure",
        homeScore: match.homeScore?.current ?? null,
        awayScore: match.awayScore?.current ?? null,
        status: match.status?.description || match.status?.type || "En cours",
        league: match.league?.name || "Football",
        startTime: match.startTime || null
      })),
      checkedAt: new Date().toISOString()
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({ error: "upstream_unavailable", message: "Impossible de joindre SportsAPI pour le moment." }, { status: 502 });
  }
};
