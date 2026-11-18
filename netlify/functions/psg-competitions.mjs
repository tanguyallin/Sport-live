let cachedPayload = null;
let cacheExpiresAt = 0;
let pending = null;

const API = "https://api.sportsapi.app/v2";
const normalize = value => String(value || "")
  .normalize("NFD")
  .replace(/[\\u0300-\\u036f]/g, "")
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

function pickSeason(seasons, year) {
  const list = Array.isArray(seasons) ? seasons : [];
  return list.find(item =>
    Number(item.startYear) <= year && Number(item.endYear) >= year
  ) || list.find(item => item?.id) || null;
}

async function tableForEntry(entry, kind, headers, year) {
  const competition = entry?.league;
  const season = pickSeason(entry?.seasons, year);
  if (!competition?.id) {
    return { name: kind === "ligue1" ? "Ligue 1" : "Ligue des Champions", rows: [], error: "Compétition sans identifiant dans SportsAPI." };
  }
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
      sourceUrl: kind === "ligue1"
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

    // Use the same team standings/seasons endpoint that powered the original version.
    const entries = await json(`/teams/${team.id}/standings/seasons`, headers);
    const list = Array.isArray(entries) ? entries : [];
    const ligue1Entry = list.find(item => /ligue\\s*1/i.test(item?.league?.name || ""));
    const uclEntry = list.find(item =>
      /champions league|ligue des champions/i.test(item?.league?.name || "")
    );
    const year = new Date().getUTCFullYear();

    const [ligue1, ucl] = await Promise.all([
      ligue1Entry
        ? tableForEntry(ligue1Entry, "ligue1", headers, year)
        : Promise.resolve({
            name: "Ligue 1",
            rows: [],
            error: "La Ligue 1 n’apparaît pas dans les saisons de classement associées au PSG dans SportsAPI."
          }),
      uclEntry
        ? tableForEntry(uclEntry, "ucl", headers, year)
        : Promise.resolve({
            name: "Ligue des Champions",
            rows: [],
            error: "La Ligue des Champions n’apparaît pas dans les saisons de classement associées au PSG dans SportsAPI."
          })
    ]);

    return {
      ligue1,
      ucl,
      checkedAt: new Date().toISOString(),
      diagnostics: {
        team: team.name,
        teamCompetitionsFound: list.length,
        ligue1Found: !!ligue1Entry,
        uclFound: !!uclEntry
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
