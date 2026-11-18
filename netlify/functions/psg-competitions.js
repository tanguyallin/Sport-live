const { api, cached, jsonResponse, league, normalize } = require("./sportsapi");

async function leagueTable(query, predicate) {
  const competition = await league(query, predicate);
  const seasons = await cached(`seasons:${competition.id}`, 12 * 60 * 60 * 1000,
    () => api(`/leagues/${competition.id}/seasons`));
  const currentYear = new Date().getUTCFullYear();
  const season = (Array.isArray(seasons) ? seasons : [])
    .filter(item => Number(item.startYear) <= currentYear && Number(item.endYear) >= currentYear)
    .sort((a, b) => Number(b.startYear) - Number(a.startYear))[0]
    || (Array.isArray(seasons) ? seasons[0] : null);

  if (!season) return { name: competition.name, rows: [] };

  const standings = await cached(`standings:${competition.id}:${season.id}`, 15 * 60 * 1000,
    () => api(`/leagues/${competition.id}/standings?season=${season.id}`));

  return {
    name: competition.name,
    rows: (Array.isArray(standings) ? standings : []).map(row => ({
      position: row.position,
      team: row.team?.name || "Équipe",
      image: row.team?.image || null,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      for: row.scoresFor,
      against: row.scoresAgainst,
      diff: row.scoreDifference,
      points: row.points
    }))
  };
}

exports.handler = async () => {
  try {
    const [ligue1, ucl] = await Promise.all([
      leagueTable("Ligue 1", item =>
        normalize(item.name) === "ligue 1"
      ),
      leagueTable("UEFA Champions League", item =>
        normalize(item.name).includes("champions league")
      )
    ]);
    return jsonResponse(200, { ligue1, ucl, updatedAt: new Date().toISOString() }, 900);
  } catch (error) {
    console.error("psg-competitions:", error);
    return jsonResponse(error.statusCode || 502, {
      message: error.message || "Impossible de récupérer les classements PSG."
    });
  }
};
