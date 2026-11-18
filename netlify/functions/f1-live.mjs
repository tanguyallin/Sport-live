let cachedPayload = null;
let cacheExpiresAt = 0;
let pendingRequest = null;
let cachedAccessToken = null;
let tokenExpiresAt = 0;
let pendingToken = null;

async function getOpenF1Token() {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) return cachedAccessToken;
  if (pendingToken) return pendingToken;
  const username = process.env.OPENF1_USERNAME;
  const password = process.env.OPENF1_PASSWORD;
  if (!username || !password) return null;
  pendingToken = (async () => {
    const body = new URLSearchParams({ username, password });
    const response = await fetch("https://api.openf1.org/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error(data.detail || data.message || "Authentification OpenF1 refusée.");
    cachedAccessToken = data.access_token;
    tokenExpiresAt = Date.now() + 55 * 60 * 1000;
    return cachedAccessToken;
  })();
  try { return await pendingToken; } finally { pendingToken = null; }
}

export default async () => {
  if (cachedPayload && Date.now() < cacheExpiresAt) {
    return Response.json(cachedPayload, { headers: { "Cache-Control": "public, max-age=300" } });
  }

  if (!pendingRequest) {
    pendingRequest = (async () => {
      const base = "https://api.openf1.org/v1";
      let openF1Token = null;
      let openF1AuthError = "";
      try { openF1Token = await getOpenF1Token(); } catch (error) { openF1AuthError = error.message || "Authentification OpenF1 impossible."; }
      const get = async (path) => {
        const headers = { Accept: "application/json" };
        if (openF1Token) headers.Authorization = `Bearer ${openF1Token}`;
        const response = await fetch(base + path, { headers });
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

      const [nextSessions, championshipDrivers, championshipTeams, standingsDrivers, latestDrivers] = await Promise.all([
        nextMeeting ? get(`/sessions?meeting_key=${nextMeeting.meeting_key}`) : Promise.resolve([]),
        standingsSession ? get(`/championship_drivers?session_key=${standingsSession.session_key}`) : Promise.resolve([]),
        standingsSession ? get(`/championship_teams?session_key=${standingsSession.session_key}`) : Promise.resolve([]),
        standingsSession ? get(`/drivers?session_key=${standingsSession.session_key}`) : Promise.resolve([]),
        get('/drivers?session_key=latest')
      ]);

      
      const activeSession = nextSessions.find(s => Date.parse(s.date_start) <= now && Date.parse(s.date_end) >= now) || null;
      let liveTiming = { active: !!activeSession, refreshable: !!activeSession && !!openF1Token, available: false, message: openF1Token ? "En attente des données de chronométrage." : (openF1AuthError || "Le direct OpenF1 nécessite un abonnement Live et les variables OPENF1_USERNAME et OPENF1_PASSWORD dans Netlify."), sessionName: activeSession?.session_name || null, drivers: [], updatedAt: new Date().toISOString() };
      if (activeSession && openF1Token) {
        try {
          const [positions, intervals, laps, stints, pits, activeDrivers] = await Promise.all([
            get(`/position?session_key=${activeSession.session_key}`),get(`/intervals?session_key=${activeSession.session_key}`),get(`/laps?session_key=${activeSession.session_key}`),get(`/stints?session_key=${activeSession.session_key}`),get(`/pit?session_key=${activeSession.session_key}`),get(`/drivers?session_key=${activeSession.session_key}`)
          ]);
          const latestByDriver=rows=>{const map=new Map();for(const row of rows){const k=Number(row.driver_number),old=map.get(k);if(!old||String(row.date||"")>String(old.date||""))map.set(k,row);}return map;};
          const pos=latestByDriver(positions),gap=latestByDriver(intervals),stintHistory=new Map(),lapMap=new Map(),pitCounts=new Map(),startPosition=new Map();
          for(const row of [...positions].sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")))){const k=Number(row.driver_number);if(!startPosition.has(k))startPosition.set(k,Number(row.position));}
          for(const row of stints){const k=Number(row.driver_number),list=stintHistory.get(k)||[];list.push(row);stintHistory.set(k,list);}
          for(const row of laps){const k=Number(row.driver_number),old=lapMap.get(k)||{best:null,last:null};if(row.lap_duration&&(!old.best||row.lap_duration<old.best.lap_duration))old.best=row;if(!old.last||Number(row.lap_number)>Number(old.last.lap_number))old.last=row;lapMap.set(k,old);}
          for(const row of pits)pitCounts.set(Number(row.driver_number),(pitCounts.get(Number(row.driver_number))||0)+1);
          const fmt=v=>v?new Date(v*1000).toISOString().slice(14,23):null;
          const gapText=v=>v==null?"Leader":typeof v==="number"?"+"+v.toFixed(3)+"s":String(v);
          const drivers=activeDrivers.map(d=>{const n=Number(d.driver_number),g=gap.get(n),l=lapMap.get(n),p=pos.get(n),stintsForDriver=(stintHistory.get(n)||[]).sort((a,b)=>Number(a.stint_number)-Number(b.stint_number)),tyreHistory=stintsForDriver.map(s=>s.compound).filter((v,i,a)=>v&&(i===0||v!==a[i-1])),startPos=startPosition.get(n);return{driverNumber:n,name:d.full_name||d.name_acronym,acronym:d.name_acronym||"",teamColour:d.team_colour||"536273",position:p?.position??null,positionChange:startPos!=null&&p?.position!=null?startPos-Number(p.position):null,gap:g?gapText(g.gap_to_leader):"—",interval:g?.interval==null?"—":gapText(g.interval),lastLap:fmt(l?.last?.lap_duration),bestLap:fmt(l?.best?.lap_duration),tyre:stintsForDriver.at(-1)?.compound||null,tyreHistory,pitStops:pitCounts.get(n)||0};}).sort((a,b)=>Number(a.position||99)-Number(b.position||99));
          liveTiming={active:true,refreshable:true,available:drivers.length>0,message:drivers.length?"":"OpenF1 n’a pas renvoyé de données pour cette séance. Vérifie l’accès temps réel de la clé API.",sessionName:activeSession.session_name,drivers,updatedAt:new Date().toISOString()};
        }catch(error){liveTiming={active:true,refreshable:true,available:false,message:error.message||"Chronométrage indisponible.",sessionName:activeSession.session_name,drivers:[],updatedAt:new Date().toISOString()};}
      }
      const qualifying = nextSessions.find(s => /^qualifying$/i.test(s.session_name || ""));
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

      const driverMap = new Map([...standingsDrivers, ...latestDrivers].map(d => [Number(d.driver_number), d]));
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
        liveTiming,
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
    cacheExpiresAt = Date.now() + (payload.liveTiming?.refreshable ? 15_000 : 10 * 60 * 1000);
    return Response.json(payload, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    return Response.json({ error: "f1_data_error", message: error.message || "Données F1 indisponibles." }, { status: 502 });
  } finally {
    pendingRequest = null;
  }
};
