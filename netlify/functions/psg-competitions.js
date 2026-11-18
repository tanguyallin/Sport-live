const { api, cached, jsonResponse, psgTeam, normalize } = require("./sportsapi");

async function competitionTable(competition, kind, currentYear) {
  if (!competition?.id) return null;

  const seasons = await cached(
    `seasons:${competition.id}`,
    24 * 60 * 60 * 1000,
    () => api(`/leagues/${competition.id}/seasons`)
  );
  const entries = Array.isArray(seasons) ? seasons : [];
  const season = entries.find(item =>
    Number(item.startYear) <= currentYear && Number(item.endYear) >= currentYear
  ) || entries[0];

  if (!season?.id) {
    return { name: competition.name, rows: [], error: "Aucune saison disponible dans SportsAPI." };
  }

  try {
    const standings = await cached(
      `standings:${competition.id}:${season.id}`,
      30 * 60 * 1000,
      () => api(`/leagues/${competition.id}/standings?season=${season.id}`)
    );
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
      })),
      sourceUrl: kind === "ligue1"
        ? "https://www.lequipe.fr/Football/ligue-1/page-classement-equipes/general"
        : "https://www.lequipe.fr/Football/ligue-des-champions/page-classement-equipes/general"
    };
  } catch (error) {
    return { name: competition.name, rows: [], error: error.message || "Classement indisponible." };
  }
}

exports.handler = async () => {
  try {
    const team = await psgTeam();

    // Read the competitions attached to PSG instead of relying on a global exact-name search.
    const leagues = await cached(
      `team-leagues:${team.id}`,
      24 * 60 * 60 * 1000,
      () => api(`/teams/${team.id}/leagues`)
    );
    const list = Array.isArray(leagues) ? leagues : [];
    const ligue1 = list.find(item =>
      item.sport === "football" && normalize(item.name).startsWith("ligue 1")
    );
    const ucl = list.find(item =>
      item.sport === "football" &&
      /uefa champions league|champions league|ligue des champions/i.test(normalize(item.name))
    );
    const year = new Date().getUTCFullYear();

    const [l1Result, uclResult] = await Promise.all([
      ligue1
        ? competitionTable(ligue1, "ligue1", year)
            .catch(error => ({ name: ligue1.name, rows: [], error: error.message }))
        : Promise.resolve({
            name: "Ligue 1",
            rows: [],
            error: "La Ligue 1 n’apparaît pas dans les compétitions associées au PSG dans SportsAPI."
          }),
      ucl
        ? competitionTable(ucl, "ucl", year)
            .catch(error => ({ name: ucl.name, rows: [], error: error.message }))
        : Promise.resolve({
            name: "Ligue des Champions",
            rows: [],
            error: "La Ligue des Champions n’apparaît pas dans les compétitions associées au PSG dans SportsAPI."
          })
    ]);

    return jsonResponse(200, {
      ligue1: l1Result,
      ucl: uclResult,
      updatedAt: new Date().toISOString(),
      diagnostics: {
        team: team.name,
        competitionsFound: list.length,
        ligue1Found: !!ligue1,
        uclFound: !!ucl
      }
    }, 900);
  } catch (error) {
    console.error("psg-competitions:", error);
    return jsonResponse(error.statusCode || 502, {
      message: error.message || "Impossible de récupérer les classements PSG."
    });
  }
};
