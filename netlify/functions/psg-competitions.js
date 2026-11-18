const { api, cached, jsonResponse, psgTeam, normalize } = require("./sportsapi");

function pickSeason(seasons, year) {
  const list = Array.isArray(seasons) ? seasons : [];
  return list.find(item =>
    Number(item.startYear) <= year && Number(item.endYear) >= year
  ) || list.find(item => item?.id) || null;
}

async function tableForEntry(entry, kind, year) {
  const competition = entry?.league;
  const season = pickSeason(entry?.seasons, year);
  if (!competition?.id) {
    return { name: kind === "ligue1" ? "Ligue 1" : "Ligue des Champions", rows: [], error: "Compétition sans identifiant dans SportsAPI." };
  }
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
        team: row.team?.name || row.name || "Équipe",
        image: row.team?.image || null,
        played: row.played ?? null,
        wins: row.wins ?? null,
        draws: row.draws ?? null,
        losses: row.losses ?? null,
        for: row.scoresFor ?? null,
        against: row.scoresAgainst ?? null,
        diff: row.scoreDifference ?? null,
        points: row.points ?? null
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
    const entries = await cached(
      `team-standings-seasons:${team.id}`,
      6 * 60 * 60 * 1000,
      () => api(`/teams/${team.id}/standings/seasons`)
    );
    const list = Array.isArray(entries) ? entries : [];
    const ligue1Entry = list.find(item =>
      /ligue\\s*1/i.test(item?.league?.name || "")
    );
    const uclEntry = list.find(item =>
      /champions league|ligue des champions/i.test(item?.league?.name || "")
    );
    const year = new Date().getUTCFullYear();

    const [ligue1, ucl] = await Promise.all([
      ligue1Entry
        ? tableForEntry(ligue1Entry, "ligue1", year)
        : Promise.resolve({
            name: "Ligue 1",
            rows: [],
            error: "La Ligue 1 n’apparaît pas dans les saisons de classement associées au PSG dans SportsAPI."
          }),
      uclEntry
        ? tableForEntry(uclEntry, "ucl", year)
        : Promise.resolve({
            name: "Ligue des Champions",
            rows: [],
            error: "La Ligue des Champions n’apparaît pas dans les saisons de classement associées au PSG dans SportsAPI."
          })
    ]);

    return jsonResponse(200, {
      ligue1,
      ucl,
      updatedAt: new Date().toISOString(),
      diagnostics: {
        team: team.name,
        teamCompetitionsFound: list.length,
        ligue1Found: !!ligue1Entry,
        uclFound: !!uclEntry
      }
    }, 900);
  } catch (error) {
    console.error("psg-competitions:", error);
    return jsonResponse(error.statusCode || 502, {
      message: error.message || "Impossible de récupérer les classements PSG."
    });
  }
};
