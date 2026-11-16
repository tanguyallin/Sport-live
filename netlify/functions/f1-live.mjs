let cachedPayload = null;
let cacheExpiresAt = 0;
let pendingRequest = null;

export default async () => {
  if (cachedPayload && Date.now() < cacheExpiresAt) {
    return Response.json(cachedPayload, { headers: { "Cache-Control": "public, max-age=300" } });
  }

  if (!pendingRequest) {
    pendingRequest = (async () => {
      const base = "https://api.openf1.org/v1";
      const get = async (path) => {
        const response = await fetch(base + path, { headers: { Accept: "application/json" } });
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      };
      const now = Date.now();
      const year = new Date().getFullYear();

      const [meetings, allRaceSessions] = await Promise.all([
        get(`/meetings?year=${year}`),
        get(`/sessions?year=${year}&session_name=Race`)
      ]);

      const nextMeeting = meetings
        .filter(m => !m.is_cancelled && Date.parse(m.date_end) >= now)
        .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0] || null;

      const completedRaces = allRaceSessions
        .filter(s => Date.parse(s.date_end) <= now)
        .sort((a, b) => Date.parse(b.date_end) - Date.parse(a.date_end));
      const standingsSession = completedRaces[0] || allRaceSessions[0] || null;

      const [nextSessions, championshipDrivers, championshipTeams, standingsDrivers] = await Promise.all([
        nextMeeting ? get(`/sessions?meeting_key=${nextMeeting.meeting_key}`) : Promise.resolve([]),
        standingsSession ? get(`/championship_drivers?session_key=${standingsSession.session_key}`) : Promise.resolve([]),
        standingsSession ? get(`/championship_teams?session_key=${standingsSession.session_key}`) : Promise.resolve([]),
        standingsSession ? get(`/drivers?session_key=${standingsSession.session_key}`) : Promise.resolve([])
      ]);

      const qualifying = nextSessions.find(s => /qualifying/i.test(s.session_name || ""));
      const race = nextSessions.find(s => /^race$/i.test(s.session_name || ""));
      const qualifyingPassed = !!qualifying && Date.parse(qualifying.date_end) <= now;

      let grid = [];
      let gridDrivers = [];
      if (qualifyingPassed && race) {
        [grid, gridDrivers] = await Promise.all([
          get(`/starting_grid?session_key=${race.session_key}`),
          get(`/drivers?session_key=${race.session_key}`)
        ]);
      }

      const driverMap = new Map(standingsDrivers.map(d => [Number(d.driver_number), d]));
      const gridDriverMap = new Map(gridDrivers.map(d => [Number(d.driver_number), d]));
      const mappedStandings = championshipDrivers
        .map(row => {
          const driver = driverMap.get(Number(row.driver_number)) || {};
          return {
            position: row.position_current ?? row.position_start ?? null,
            points: row.points_current ?? row.points_start ?? 0,
            driverNumber: row.driver_number,
            name: driver.full_name || driver.broadcast_name || driver.name_acronym || "Pilote",
            acronym: driver.name_acronym || "",
            team: driver.team_name || "",
            teamColour: driver.team_colour || "536273",
            photo: driver.headshot_url || null
          };
        })
        .sort((a, b) => Number(a.position) - Number(b.position));

      const mappedGrid = grid
        .map(row => {
          const driver = gridDriverMap.get(Number(row.driver_number)) || {};
          return {
            position: row.position,
            driverNumber: row.driver_number,
            name: driver.full_name || driver.broadcast_name || driver.name_acronym || "Pilote",
            acronym: driver.name_acronym || "",
            team: driver.team_name || "",
            teamColour: driver.team_colour || "536273",
            photo: driver.headshot_url || null,
            lapDuration: row.lap_duration || null
          };
        })
        .sort((a, b) => Number(a.position) - Number(b.position));

      return {
        meeting: nextMeeting ? {
          name: nextMeeting.meeting_name,
          officialName: nextMeeting.meeting_official_name,
          country: nextMeeting.country_name,
          countryCode: nextMeeting.country_code,
          flag: nextMeeting.country_flag || null,
          location: nextMeeting.location,
          start: nextMeeting.date_start,
          end: nextMeeting.date_end,
          meetingKey: nextMeeting.meeting_key
        } : null,
        sessions: nextSessions.map(s => ({
          name: s.session_name,
          start: s.date_start,
          end: s.date_end,
          sessionKey: s.session_key
        })).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
        qualifyingPassed,
        grid: mappedGrid,
        gridAvailable: mappedGrid.length > 0,
        drivers: mappedStandings,
        teams: championshipTeams.map(t => ({
          position: t.position_current ?? t.position_start ?? null,
          name: t.team_name,
          points: t.points_current ?? t.points_start ?? 0
        })).sort((a, b) => Number(a.position) - Number(b.position)),
        updatedAt: new Date().toISOString()
      };
    })();
  }

  try {
    const payload = await pendingRequest;
    cachedPayload = payload;
    cacheExpiresAt = Date.now() + 10 * 60 * 1000;
    return Response.json(payload, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    return Response.json({ error: "f1_data_error", message: error.message || "Données F1 indisponibles." }, { status: 502 });
  } finally {
    pendingRequest = null;
  }
};
