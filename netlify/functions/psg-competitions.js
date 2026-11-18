const { api, cached, jsonResponse, psgTeam, normalize } = require("./sportsapi");

async function findFrenchLeague() {
  const leagues = await cached(
    "football-leagues-france",
    24 * 60 * 60 * 1000,
    () => api("/leagues?sport=football&country=FR")
  );
  const list = Array.isArray(leagues) ? leagues : [];
  const competition = list.find(item =>
    item.sport === "football" &&
    normalize(item.name).startsWith("ligue 1") &&
    (!item.slug || normalize(item.slug).startsWith("ligue-1"))
  ) || list.find(item =>
    item.sport === "football" &&
    normalize(item.slug).startsWith("ligue-1")
  );

  return { competition: competition || null, directoryLoaded: true, leaguesCount: list.length };
}

async function competitionTable(competition, kind, currentYear) {
  if (!competition?.id) {
    return { name: kind === "ligue1" ? "Ligue 1" : "Ligue des Champions", rows: [] };
  }

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
    const teamLeagues = await cached(
      `team-leagues:${team.id}`,
      24 * 60 * 60 * 1000,
      () => api(`/teams/${team.id}/leagues`)
    );
    const teamList = Array.isArray(teamLeagues) ? teamLeagues : [];
    const ucl = teamList.find(item =>
      item.sport === "football" &&
      /uefa champions league|champions league|ligue des champions/i.test(normalize(item.name))
    );

    const frenchDirectory = await findFrenchLeague();
    const ligue1 = frenchDirectory.competition;
    const year = new Date().getUTCFullYear();

    const [l1Result, uclResult] = await Promise.all([
      ligue1
        ? competitionTable(ligue1, "ligue1", year)
        : Promise.resolve({
            name: "Ligue 1",
            rows: [],
            error: frenchDirectory.directoryLoaded
              ? "La Ligue 1 n’a pas été trouvée dans le répertoire des compétitions françaises de SportsAPI."
              : "Le répertoire des compétitions françaises est indisponible dans SportsAPI."
          }),
      ucl
        ? competitionTable(ucl, "ucl", year)
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
        teamCompetitionsFound: teamList.length,
        frenchCategoryFound: frenchDirectory.categoryFound,
        frenchLeaguesFound: frenchDirectory.leaguesCount,
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
