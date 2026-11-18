let cachedPayload = null;
let cacheExpiresAt = 0;
let pending = null;

const API = "https://api.sportsapi.app/v2";
const normalize = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

async function json(path, headers) {
  const response = await fetch(API + path, {
    headers,
    signal: AbortSignal.timeout(12000)
  });
  let body = {};
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `SportsAPI HTTP ${response.status}`);
  }
  return body.data;
}

const mapRows = data => (Array.isArray(data) ? data : []).map(row => ({
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
}));

async function findFrenchLeague(headers) {
  const leagues = await json("/leagues?sport=football&country=FR", headers);
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

async function tableForCompetition(competition, headers, currentYear) {
  if (!competition?.id) return null;
  const seasons = await json(`/leagues/${competition.id}/seasons`, headers);
  const entries = Array.isArray(seasons) ? seasons : [];
  const season = entries.find(item =>
    Number(item.startYear) <= currentYear && Number(item.endYear) >= currentYear
  ) || entries[0];

  if (!season?.id) {
    return { name: competition.name, rows: [], error: "Aucune saison disponible dans SportsAPI." };
  }

  try {
    const standings = await json(
      `/leagues/${competition.id}/standings?season=${season.id}`,
      headers
    );
    return {
      name: competition.name,
      rows: mapRows(standings),
      sourceUrl: competition.kind === "ligue1"
        ? "https://www.lequipe.fr/Football/ligue-1/page-classement-equipes/general"
        : "https://www.lequipe.fr/Football/ligue-des-champions/page-classement-equipes/general"
    };
  } catch (error) {
    return { name: competition.name, rows: [], error: error.message || "Classement indisponible." };
  }
}

export default async () => {
  if (cachedPayload && Date.now() < cacheExpiresAt) {
    return Response.json(cachedPayload, { headers: { "Cache-Control": "public, max-age=3600" } });
  }

  if (!pending) pending = (async () => {
    const key = process.env.SPORTSAPI_API_KEY;
    if (!key) throw new Error("Clé SportsAPI absente de Netlify.");
    const headers = { Authorization: "Bearer " + key, Accept: "application/json" };

    const found = await json("/search?q=Paris%20Saint-Germain&type=team", headers);
    const team = (Array.isArray(found) ? found : []).find(item =>
      item.sport === "football" &&
      /paris saint.?germain|paris sg/i.test(item.name || "") &&
      (!item.gender || item.gender === "male")
    );
    if (!team?.id) throw new Error("Club PSG masculin introuvable dans SportsAPI.");

    const teamLeagues = await json(`/teams/${team.id}/leagues`, headers);
    const teamList = Array.isArray(teamLeagues) ? teamLeagues : [];
    const ucl = teamList.find(item =>
      item.sport === "football" &&
      /uefa champions league|champions league|ligue des champions/i.test(normalize(item.name))
    );

    // Discover Ligue 1 from the French football directory, not from the PSG list.
    const frenchDirectory = await findFrenchLeague(headers);
    const ligue1 = frenchDirectory.competition;
    const year = new Date().getUTCFullYear();

    const [l1Table, uclTable] = await Promise.all([
      ligue1
        ? tableForCompetition({ ...ligue1, kind: "ligue1" }, headers, year)
            .catch(error => ({ name: ligue1.name, rows: [], error: error.message }))
        : Promise.resolve({
            name: "Ligue 1",
            rows: [],
            error: frenchDirectory.directoryLoaded
              ? "La Ligue 1 n’a pas été trouvée dans le répertoire des compétitions françaises de SportsAPI."
              : "Le répertoire des compétitions françaises est indisponible dans SportsAPI."
          }),
      ucl
        ? tableForCompetition({ ...ucl, kind: "ucl" }, headers, year)
            .catch(error => ({ name: ucl.name, rows: [], error: error.message }))
        : Promise.resolve({
            name: "Ligue des Champions",
            rows: [],
            error: "La Ligue des Champions n’apparaît pas dans les compétitions associées au PSG dans SportsAPI."
          })
    ]);

    return {
      ligue1: l1Table,
      ucl: uclTable,
      checkedAt: new Date().toISOString(),
      diagnostics: {
        team: team.name,
        teamCompetitionsFound: teamList.length,
        frenchDirectoryLoaded: frenchDirectory.directoryLoaded,
        frenchLeaguesFound: frenchDirectory.leaguesCount,
        ligue1Found: !!ligue1,
        uclFound: !!ucl
      }
    };
  })();

  try {
    const data = await pending;
    cachedPayload = data;
    cacheExpiresAt = Date.now() + 30 * 60 * 1000;
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: "psg_competitions_error",
      message: error.message || "Classements indisponibles."
    }, { status: 502 });
  } finally {
    pending = null;
  }
};
