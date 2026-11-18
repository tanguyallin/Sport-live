const examples=[
 {sport:'padel',tag:'PADEL · HOMMES',status:'EXEMPLE',left:'Paire A',right:'Paire B',score:'—',detail:'Major / P1 / P2 · Tableau principal',tv:'Diffusion à confirmer'},
 {sport:'psg',tag:'PARIS SAINT-GERMAIN',status:'À VENIR',left:'PSG',right:'Adversaire',score:'—',detail:'Prochain match · Horaire à confirmer',tv:'Chaîne à confirmer'},
 {sport:'f1',tag:'FORMULE 1',status:'À VENIR',left:'Prochain Grand Prix',right:'Programme',score:'—',detail:'Essais · Qualifications · Course',tv:'Diffuseur à confirmer'},

];
const events=document.querySelector('#events');let filter='all';let calendarFilter='all';let calendarRenderedEvents=[];let psgLive=[];let psgUpcoming=[];let psgRecent=[];let psgError='';let psgCompetition='all';let psgSquadView=false;let psgSquad=null;let psgSquadError='';let psgSquadLoading=false;let psgStandings=null;let psgStandingsError='';let psgStandingsLoading=false;let padelData=null;let padelError='';let padelView='schedule';let padelGender='men';let padelRankings=null;let padelRankingError='';let padelRankingLoading=false;let f1Data=null;let f1Error='';let f1View='program';let f1StandingMode='drivers';let selectedPsgMatch=null;let psgMatchDetail=null;let psgMatchLoading=false;let psgMatchError='';let selectedPadelTournament=null;let padelTournamentData=null;let padelTournamentLoading=false;let padelTournamentError='';let searchResults=[];let searchHighlight='';
function render(){
 document.body.classList.toggle('direct-mode',filter==='direct');
 document.body.classList.toggle('calendar-mode',filter==='calendar');
 const sportBars=document.querySelectorAll('.sports');sportBars.forEach((bar,index)=>{if(index>0)bar.remove()});
 if(filter==='direct'){
  events.innerHTML=renderDirect();
  return;
 }
 if(filter==='calendar'){
  events.innerHTML=renderAnnualCalendar();
  document.querySelectorAll('[data-calendar-add]').forEach(b=>b.addEventListener('click',()=>downloadCalendarEvent(calendarRenderedEvents[Number(b.dataset.calendarAdd)])));
  document.querySelectorAll('[data-calendar-filter]').forEach(b=>b.addEventListener('click',()=>{calendarFilter=b.dataset.calendarFilter;render()}));
  return;
 }
 if(filter==='psg'&&selectedPsgMatch){events.innerHTML=renderPsgMatchCenter();document.querySelector('[data-psg-back]')?.addEventListener('click',()=>{selectedPsgMatch=null;psgMatchDetail=null;psgMatchError='';render()});return;}

 const rows=examples.filter(x=>filter==='all'||x.sport===filter);
 if(filter==='all')rows.sort((a,b)=>{const eventDate=s=>{if(s==='psg'){const m=(psgUpcoming||[]).filter(x=>x.startTime&&Date.parse(x.startTime)>=Date.now()).sort((x,y)=>Date.parse(x.startTime)-Date.parse(y.startTime))[0];return m?Date.parse(m.startTime):Infinity;}if(s==='padel'){const e=padelAnnualEvents.filter(x=>x.end>=new Date().toISOString().slice(0,10)).sort((x,y)=>x.start.localeCompare(y.start))[0];return e?Date.parse(e.start+'T12:00:00'):Infinity;}const gp=f1NextEvent();return gp?.start?Date.parse(gp.start+'T12:00:00'):Infinity;};return eventDate(a.sport)-eventDate(b.sport);});
 const renderedCards=rows.map(x=>{
  if(x.sport==='padel') return filter==='all'?renderPadelHome():renderPadel();
  if(x.sport==='f1') return filter==='all'?renderF1Home():renderF1();
  if(x.sport==='psg'){
   if(filter==='all') return renderPsgHome();
   const tabs=[['ligue1','LIGUE 1'],['ucl','LIGUE DES CHAMPIONS'],['cdf','COUPE DE FRANCE']];
   const nav=`<div class="f1-tabs psg-competition-tabs"><button data-psg-effectif="1" class="${psgSquadView?'active':''}">EFFECTIF</button><button data-psg-competition="all" class="${!psgSquadView&&psgCompetition==='all'?'active':''}">MATCH À VENIR</button>${tabs.map(([id,label])=>`<button data-psg-competition="${id}" class="${!psgSquadView&&psgCompetition===id?'active':''}">${label}</button>`).join('')}</div>`;
   const all=[...psgLive,...psgUpcoming].filter((m,i,a)=>a.findIndex(v=>String(v.id)===String(m.id))===i);
   const matches=psgSquadView?[]:psgCompetition==='all'?all:[...psgUpcoming,...psgRecent].filter((m,i,a)=>a.findIndex(v=>String(v.id)===String(m.id))===i).filter(m=>{
    const league=String(m.league||'').toLowerCase();
    if(psgCompetition==='ligue1')return /ligue 1|ligue 1 mcdonald/i.test(league);
    if(psgCompetition==='ucl')return /champions league|ligue des champions|uefa champions/i.test(league);
    return /coupe de france|french cup/i.test(league);
   });
   const card=m=>`<article class="event"><div class="event-top"><span class="tag"><span class="psg-competition-flag">${psgCompetitionIcon(m.league)}</span>${escapeHtml(m.league||'PSG')}</span><span class="status">${escapeHtml(m.status)}</span></div><div class="event-main"><div class="teams">${escapeHtml(m.home)}<br>${escapeHtml(m.away)}</div><div class="score">${m.homeScore ?? '—'} - ${m.awayScore ?? '—'}<small>${escapeHtml(m.round||m.league||'')}</small></div></div><div class="event-foot"><span>${m.startTime?new Date(m.startTime).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Horaire non communiqué'}</span>${m.id?'<button class="dashboard-action" data-psg-match-center="'+m.id+'">CENTRE DE MATCH ↗</button>':''}</div></article>`;
   let body='';
   if(psgSquadView){body=renderPsgSquad();}
   else if(psgCompetition==='ligue1'||psgCompetition==='ucl'){
    const table=psgStandings?.[psgCompetition];
    body=table?.rows?.length?`<section class="padel-tournament psg-standings"><header><span class="padel-tournament-kicker">CLASSEMENT · SAISON 2026/27</span><h3>${escapeHtml(table.name)}</h3></header><div class="psg-table-wrap" style="overflow-x:auto"><table class="psg-table" style="width:100%;border-collapse:collapse;white-space:nowrap;font-size:12px"><thead><tr><th>#</th><th style="text-align:left">ÉQUIPE</th><th>J</th><th>G</th><th>N</th><th>P</th><th>BP</th><th>BC</th><th>+/-</th><th>PTS</th></tr></thead><tbody>${table.rows.map(r=>`<tr class="${/paris.?sg|paris saint-germain/i.test(r.team)?'psg-highlight':''}" style="${/paris.?sg|paris saint-germain/i.test(r.team)?'font-weight:800;background:rgba(40,100,210,.12)':''}"><td style="padding:9px 6px">${r.position}</td><td style="text-align:left;padding:9px 6px">${r.image?`<img src="${escapeHtml(r.image)}" alt="" loading="lazy" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;margin-right:6px">`:''}${escapeHtml(r.team)}</td><td>${r.played??'—'}</td><td>${r.wins??'—'}</td><td>${r.draws??'—'}</td><td>${r.losses??'—'}</td><td>${r.for??'—'}</td><td>${r.against??'—'}</td><td>${r.diff==null?'—':(r.diff>0?'+':'')+r.diff}</td><td><b>${r.points??'—'}</b></td></tr>`).join('')}</tbody></table></div><a class="psg-source-link" style="display:inline-block;margin-top:12px" href="${table.sourceUrl}" target="_blank" rel="noopener">Voir aussi sur L’Équipe ↗</a></section>`:
     psgStandingsLoading?'<div class="empty">Chargement du classement…</div>':`<div class="empty">${escapeHtml(psgStandingsError||'Classement pas encore disponible.')}</div>`;
   }else if(psgCompetition==='cdf'){
    body=`<section class="padel-tournament"><header><span class="padel-tournament-kicker">COMPÉTITION À ÉLIMINATION DIRECTE</span><h3>Coupe de France</h3><span class="padel-count">Pas de classement général</span></header><a class="psg-source-link" href="https://www.lequipe.fr/Football/Coupe-de-France/" target="_blank" rel="noopener">Calendrier et résultats sur L’Équipe ↗</a></section>`;
   }
   if(!psgSquadView){
    if(matches.length)body+='<p class="eyebrow">'+(psgCompetition==='all'?'MATCH EN COURS · PROCHAIN MATCH':'MATCHS DE LA COMPÉTITION')+'</p>'+matches.sort((a,b)=>String(a.startTime||'').localeCompare(String(b.startTime||''))).map(card).join('');
    else if(psgCompetition!=='cdf')body+='<div class="empty">Aucun match trouvé dans cette compétition pour le moment.</div>';
    if(psgCompetition==='all'&&psgError)body+=`<div class="empty">${escapeHtml(psgError)}</div>`;
   }
   return nav+body;
  }
  return `<article class="event"><div class="event-top"><span class="tag">${x.tag}</span><span class="status">${x.status}</span></div><div class="event-main"><div class="teams">${x.left}<br>${x.right}</div><div class="score">${x.score}<small>Pas de score connecté</small></div></div><div class="event-foot"><span>${x.detail}<br><b>${x.tv}</b></span><button class="add-event" data-title="${x.tag}: ${x.left} - ${x.right}">+ CALENDRIER</button></div></article>`;
 }).join('')||'<div class="empty">Aucun événement dans cette rubrique pour le moment.</div>';
 events.innerHTML=filter==='all'?renderDashboard(renderedCards):renderedCards;
 document.querySelector('[data-padel-back]')?.addEventListener('click',()=>{padelView='schedule';selectedPadelTournament=null;padelTournamentData=null;padelTournamentError='';render()});

 document.querySelectorAll('[data-psg-match-center]').forEach(b=>b.addEventListener('click',()=>openPsgMatchCenter(b.dataset.psgMatchCenter)));
 document.querySelectorAll('[data-sport-open]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.sportOpen;selectedPsgMatch=null;document.querySelectorAll('.sport').forEach(x=>x.classList.toggle('active',x.dataset.sport===filter));render();}));
 document.querySelectorAll('[data-padel-tournament],[data-padel-search-tournament]').forEach(b=>b.addEventListener('click',()=>{selectedPadelTournament={id:b.dataset.padelTournament||null,name:b.dataset.tournamentName};padelView='tournament';padelTournamentData=null;padelTournamentError='';render();if(!padelTournamentLoading)loadPadelTournament()}));
 document.querySelectorAll('.add-event').forEach(b=>b.addEventListener('click',()=>downloadICS(b.dataset.title)));
 document.querySelectorAll('[data-padel-view]').forEach(b=>b.addEventListener('click',()=>{padelView=b.dataset.padelView;render();if(padelView==='rankings'&&!padelRankings&&!padelRankingLoading)loadPadelRankings();if(padelView==='tournament'&&!padelTournamentData&&!padelTournamentLoading)loadPadelTournament()}));
 document.querySelectorAll('[data-psg-competition]').forEach(b=>b.addEventListener('click',()=>{psgSquadView=false;psgCompetition=b.dataset.psgCompetition;render();if((psgCompetition==='ligue1'||psgCompetition==='ucl')&&!psgStandings&&!psgStandingsLoading)loadPsgCompetitions()}));
 document.querySelectorAll('[data-psg-effectif]').forEach(b=>b.addEventListener('click',()=>{psgSquadView=true;render();if(!psgSquad&&!psgSquadLoading)loadPsgSquad()}));
 document.querySelectorAll('[data-padel-gender]').forEach(b=>b.addEventListener('click',()=>{padelGender=b.dataset.padelGender;render()}));
 document.querySelectorAll('[data-f1-view]').forEach(b=>b.addEventListener('click',()=>{f1View=b.dataset.f1View;render()}));
 document.querySelectorAll('[data-f1-standing]').forEach(b=>b.addEventListener('click',()=>{f1StandingMode=b.dataset.f1Standing;render()}));

}

const padelAnnualEvents=[
 ['Riyadh Season P1','2026-02-09','2026-02-14','Riyadh, Arabie saoudite','P1'],
 ['Gijon P2','2026-03-02','2026-03-08','Gijón, Espagne','P2'],
 ['Cancun P2','2026-03-16','2026-03-22','Cancún, Mexique','P2'],
 ['Miami P1','2026-03-23','2026-03-29','Miami, États-Unis','P1'],
 ['Qatar Major','2026-04-06','2026-04-11','Doha, Qatar','Major'],
 ['Newgiza P2','2026-04-13','2026-04-18','Gizeh, Égypte','P2'],
 ['Brussels P2','2026-04-20','2026-04-26','Bruxelles, Belgique','P2'],
 ['Buenos Aires P1','2026-05-11','2026-05-17','Buenos Aires, Argentine','P1'],
 ['Asuncion P2','2026-05-18','2026-05-24','Asunción, Paraguay','P2'],
 ['Italy Major','2026-06-01','2026-06-07','Italie','Major'],
 ['Valencia P1','2026-06-06','2026-06-14','Valence, Espagne','P1'],
 ['Valladolid P2','2026-06-21','2026-06-28','Valladolid, Espagne','P2'],
 ['Bordeaux P2','2026-06-28','2026-07-05','Bordeaux, France','P2'],
 ['Malaga P1','2026-07-11','2026-07-19','Málaga, Espagne','P1'],
 ['Pretoria P1','2026-07-26','2026-08-02','Pretoria, Afrique du Sud','P1'],
 ['London P1','2026-08-02','2026-08-09','Londres, Royaume-Uni','P1'],
 ['Madrid P1','2026-08-29','2026-09-06','Madrid, Espagne','P1'],
 ['Paris Major','2026-09-06','2026-09-13','Paris, France','Major'],
 ['Rotterdam P2','2026-09-27','2026-10-04','Rotterdam, Pays-Bas','P2'],
 ['Germany P2','2026-10-04','2026-10-11','Düsseldorf, Allemagne','P2'],
 ['Milano P1','2026-10-10','2026-10-18','Milan, Italie','P1'],
 ['Kuwait Major','2026-10-23','2026-10-31','Koweït','Major'],
 ['Dubai P1','2026-11-08','2026-11-15','Dubaï, Émirats arabes unis','P1'],
 ['Mexico Major','2026-11-21','2026-11-29','Acapulco, Mexique','Major'],
 ['Premier Padel Finals','2026-12-10','2026-12-13','Barcelone, Espagne','Finals']
].map(([name,start,end,place,level])=>({sport:'padel',name,start,end,place,detail:level}));
const f1AnnualEvents=[
 {name:'Las Vegas Grand Prix',start:'2026-11-19',end:'2026-11-21',place:'Las Vegas',country:'États-Unis',flag:'🇺🇸',sessions:[
  {name:'Essais libres 1',date:'2026-11-20',time:'01:30'},
  {name:'Essais libres 2',date:'2026-11-20',time:'05:00'},
  {name:'Essais libres 3',date:'2026-11-21',time:'01:30'},
  {name:'Qualifications',date:'2026-11-21',time:'05:00'},
  {name:'Course',date:'2026-11-22',time:'05:00'}
 ]},
 {name:'Qatar Grand Prix',start:'2026-11-27',end:'2026-11-29',place:'Lusail',country:'Qatar',flag:'🇶🇦',sessions:[
  {name:'Essais libres 1',date:'2026-11-27',time:'14:30'},
  {name:'Essais libres 2',date:'2026-11-27',time:'18:00'},
  {name:'Essais libres 3',date:'2026-11-28',time:'15:30'},
  {name:'Qualifications',date:'2026-11-28',time:'19:00'},
  {name:'Course',date:'2026-11-29',time:'17:00'}
 ]},
 {name:'Abu Dhabi Grand Prix',start:'2026-12-04',end:'2026-12-06',place:'Yas Marina',country:'Émirats arabes unis',flag:'🇦🇪',sessions:[
  {name:'Essais libres 1',date:'2026-12-04',time:'10:30'},
  {name:'Essais libres 2',date:'2026-12-04',time:'14:00'},
  {name:'Essais libres 3',date:'2026-12-05',time:'11:30'},
  {name:'Qualifications',date:'2026-12-05',time:'15:00'},
  {name:'Course',date:'2026-12-06',time:'14:00'}
 ]}
];

const f1FallbackDrivers=[
 ['Kimi Antonelli','Mercedes',390],['Max Verstappen','Red Bull Racing',279],['George Russell','Mercedes',262],['Lewis Hamilton','Ferrari',261],['Charles Leclerc','Ferrari',249],['Lando Norris','McLaren',246],['Oscar Piastri','McLaren',152],['Isack Hadjar','Red Bull Racing',122],['Liam Lawson','Racing Bulls',89],['Pierre Gasly','Alpine',42],['Arvid Lindblad','Racing Bulls',38],['Franco Colapinto','Alpine',27],['Oliver Bearman','Haas F1 Team',23],['Gabriel Bortoleto','Audi',14],['Nico Hulkenberg','Audi',14],['Esteban Ocon','Haas F1 Team',7],['Fernando Alonso','Aston Martin',7],['Carlos Sainz','Williams',7],['Alexander Albon','Williams',5],['Yuki Tsunoda','Racing Bulls',1],['Ryo Hirakawa','Haas F1 Team',1],['Lance Stroll','Aston Martin',0],['Valtteri Bottas','Cadillac',0],['Sergio Perez','Cadillac',0],['Rafael Câmara','Haas F1 Team',0]
].map((d,i)=>({position:i+1,name:d[0],team:d[1],points:d[2],acronym:d[0].split(' ').map(x=>x[0]).join('').slice(0,3).toUpperCase(),photo:null,teamColour:'536273'}));
const f1FallbackTeams=[['Mercedes',652],['Ferrari',510],['Red Bull Racing',415],['McLaren',398],['Racing Bulls',114],['Alpine',69],['Haas F1 Team',31],['Audi',28],['Williams',12],['Aston Martin',7],['Cadillac',0]].map((t,i)=>({position:i+1,name:t[0],points:t[1]}));
function f1Flag(meeting){
 if(meeting?.flag) return `<img class="f1-flag" src="${escapeHtml(meeting.flag)}" alt="" loading="lazy">`;
 const code=String(meeting?.countryCode||'').toUpperCase();
 const flags={USA:'🇺🇸',QAT:'🇶🇦',ARE:'🇦🇪',UAE:'🇦🇪',GBR:'🇬🇧',ITA:'🇮🇹',ESP:'🇪🇸',MEX:'🇲🇽',BRA:'🇧🇷',AUS:'🇦🇺',JPN:'🇯🇵',CHN:'🇨🇳',CAN:'🇨🇦',MON:'🇲🇨',NED:'🇳🇱',BEL:'🇧🇪',HUN:'🇭🇺',AUT:'🇦🇹',SGP:'🇸🇬',AZE:'🇦🇿',SAU:'🇸🇦'};
 return flags[code]||meeting?.flagEmoji||'🏁';
}
function f1NextEvent(){
 if(f1Data?.meeting) return {name:f1Data.meeting.name||f1Data.meeting.officialName,place:f1Data.meeting.location,country:f1Data.meeting.country,flag:f1Flag(f1Data.meeting),start:f1Data.meeting.start,end:f1Data.meeting.end};
 const today=new Date().toISOString().slice(0,10);
 const gp=f1AnnualEvents.find(e=>e.end>=today);
 return gp?{...gp,flag:gp.flag}:null;
}
function renderF1Home(){
 const gp=f1NextEvent();
 if(!gp) return '<article class="event"><div class="event-top"><span class="tag">FORMULE 1</span><span class="status">SAISON TERMINÉE</span></div><div class="event-main"><div class="teams">Prochain Grand Prix à venir</div><div class="score">🏁</div></div></article>';
 const date=gp.start?new Date(gp.start).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}):'Dates à confirmer';
 const end=gp.end?new Date(gp.end).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
 return `<article class="event f1-home-card"><div class="event-top"><span class="tag">FORMULE 1 · PROCHAIN GRAND PRIX</span><span class="status">À VENIR</span></div><div class="f1-home-main"><div><div class="f1-home-title">${escapeHtml(gp.name||'Grand Prix')}</div><div class="f1-home-place">${escapeHtml(gp.place||'')} · ${escapeHtml(gp.country||'')}</div><small>${date}${end?' – '+end:''}</small></div><div class="f1-home-flag">${gp.flag}</div></div></article>`;
}
function safeTeamColor(value){const c=String(value||'536273').replace('#','');return /^[0-9a-fA-F]{6}$/.test(c)?'#'+c:'#536273';}
const f1DriverAssets={"alexander albon":{"id":"alealb01","team":"williams","teamName":"Williams"},"arvid lindblad":{"id":"arvlin01","team":"racingbulls","teamName":"Racing Bulls"},"carlos sainz":{"id":"carsai01","team":"williams","teamName":"Williams"},"charles leclerc":{"id":"chalec01","team":"ferrari","teamName":"Ferrari"},"esteban ocon":{"id":"estoco01","team":"haas","teamName":"Haas F1 Team"},"fernando alonso":{"id":"feralo01","team":"astonmartin","teamName":"Aston Martin"},"franco colapinto":{"id":"fracol01","team":"alpine","teamName":"Alpine"},"gabriel bortoleto":{"id":"gabbor01","team":"audi","teamName":"Audi"},"george russell":{"id":"georus01","team":"mercedes","teamName":"Mercedes"},"isack hadjar":{"id":"isahad01","team":"redbullracing","teamName":"Red Bull Racing"},"kimi antonelli":{"id":"andant01","team":"mercedes","teamName":"Mercedes"},"lance stroll":{"id":"lanstr01","team":"astonmartin","teamName":"Aston Martin"},"lando norris":{"id":"lannor01","team":"mclaren","teamName":"McLaren"},"lewis hamilton":{"id":"lewham01","team":"ferrari","teamName":"Ferrari"},"liam lawson":{"id":"lialaw01","team":"racingbulls","teamName":"Racing Bulls"},"max verstappen":{"id":"maxver01","team":"redbullracing","teamName":"Red Bull Racing"},"nico hulkenberg":{"id":"nichul01","team":"audi","teamName":"Audi"},"oliver bearman":{"id":"olibea01","team":"haas","teamName":"Haas F1 Team"},"oscar piastri":{"id":"oscpia01","team":"mclaren","teamName":"McLaren"},"pierre gasly":{"id":"piegas01","team":"alpine","teamName":"Alpine"},"sergio perez":{"id":"serper01","team":"cadillac","teamName":"Cadillac"},"valtteri bottas":{"id":"valbot01","team":"cadillac","teamName":"Cadillac"}};
function f1Photo(driver){
 const asset=f1DriverAssets[String(driver.name||'').toLowerCase()];
 const teamColor=String(driver.teamColour||'536273').replace('#','');
 const fallback=asset?`https://media.formula1.com/image/upload/ar_1:1,c_crop,g_north,w_1000/b_rgb:${teamColor}/common/f1/2026/${asset.team}/${asset.id}/2026${asset.team}${asset.id}front.png`:null;
 const photo=fallback||driver.photo;
 return photo?`<img class="f1-photo" src="${escapeHtml(photo)}" alt="" loading="lazy" onerror="this.onerror=null;this.outerHTML='<div class=\'f1-photo f1-photo-empty\'>${escapeHtml(driver.acronym||'F1')}</div>'">`:`<div class="f1-photo f1-photo-empty">${escapeHtml(driver.acronym||'F1')}</div>`;
}
function renderF1Standings(){
 const drivers=f1Data?.drivers?.length?f1Data.drivers:f1FallbackDrivers;
 const teams=f1Data?.teams?.length?f1Data.teams:f1FallbackTeams;
 const teamMark=t=>{const key=String(t.name||'').toLowerCase();const assets={mercedes:['mercedes','2026mercedeslogowhite.webp'],ferrari:['ferrari','2026ferrarilogo.webp'],'red bull racing':['redbullracing','2026redbullracinglogo.webp'],mclaren:['mclaren','2026mclarenlogo.webp'],'racing bulls':['racingbulls','2026racingbullslogowhite.webp'],alpine:['alpine','2026alpinelogo.webp'],'haas f1 team':['haas','2026haaslogo.webp'],audi:['audi','2026audilogo.webp'],williams:['williams','2026williamslogo.webp'],'aston martin':['astonmartin','2026astonmartinlogowhite.webp'],cadillac:['cadillac','2026cadillaclogo.webp']};const asset=assets[key];const fallback=escapeHtml(t.name.slice(0,3).toUpperCase());return '<span class="f1-team-logo-wrap">'+(asset?'<img class="f1-team-logo" src="https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2026/'+asset[0]+'/'+asset[1]+'" alt="" loading="lazy" onerror="this.onerror=null;this.outerHTML=\'<span class=\\\'f1-team-logo f1-team-logo-fallback\\\'>'+fallback+'</span>\'">':'<span class="f1-team-logo f1-team-logo-fallback">'+fallback+'</span>')+'</span>';};
 const switcher=`<div class="padel-gender"><button data-f1-standing="drivers" class="${f1StandingMode==='drivers'?'active':''}">PILOTES</button><button data-f1-standing="teams" class="${f1StandingMode==='teams'?'active':''}">CONSTRUCTEURS</button></div>`;
 if(f1StandingMode==='teams') return switcher+`<div class="ranking-list f1-ranking-list">${teams.map(t=>`<div class="ranking-row f1-team-row"><b class="ranking-position">#${t.position??'—'}</b>${teamMark(t)}<span class="ranking-name">${escapeHtml(t.name)}</span><strong>${Number(t.points||0).toLocaleString('fr-FR')} pts</strong></div>`).join('')}</div><p class="data-note">Championnat du monde des constructeurs · Saison 2026</p>`;
 return switcher+`<div class="ranking-list f1-ranking-list">${drivers.map(d=>`<div class="ranking-row f1-driver-row ${searchHighlight===normalizeSearch(d.name)?'search-highlight':''}" data-search-name="${escapeHtml(normalizeSearch(d.name))}"><b class="ranking-position">#${d.position??'—'}</b>${f1Photo(d)}<span class="ranking-name"><b>${escapeHtml(d.name)}</b><small>${escapeHtml(d.team||'Écurie')}</small></span><strong>${Number(d.points||0).toLocaleString('fr-FR')} pts</strong></div>`).join('')}</div><p class="data-note">Championnat du monde des pilotes · Saison 2026</p>`;
}
function renderF1Grid(){
 if(!f1Data?.qualifyingPassed) return '<div class="empty">La grille de départ sera disponible après les qualifications.</div>';
 if(!f1Data.gridAvailable) return '<div class="empty">Qualifications terminées. La grille officielle est en attente de publication.</div>';
 return `<div class="f1-grid-list">${f1Data.grid.map(d=>`<article class="f1-grid-row"><b class="f1-grid-position">${d.position}</b>${f1Photo(d)}<div class="f1-grid-driver"><b>${escapeHtml(d.name)}</b><small>${escapeHtml(d.team||'Écurie')}</small></div><span class="f1-grid-team" style="background:${safeTeamColor(d.teamColour)}"></span></article>`).join('')}</div><p class="data-note">Grille de départ · Données OpenF1 après publication officielle</p>`;
}
function renderF1Program(){
 const gp=f1NextEvent();
 if(!gp) return '<div class="empty">La saison est terminée. Le calendrier sera mis à jour à la prochaine publication officielle.</div>';
 const sessions=f1Data?.sessions?.length?f1Data.sessions.filter(s=>Date.parse(s.end)>=Date.now()):[];
 const staticGp=f1AnnualEvents.find(e=>e.name===gp.name)||f1AnnualEvents.find(e=>e.end>=(new Date().toISOString().slice(0,10)));
 const sessionRows=sessions.length?sessions.map(s=>({name:s.name,start:s.start})):((staticGp?.sessions||[]).map(s=>({name:s.name,start:s.date+'T'+s.time+':00+01:00'})));
 const weekend=gp.start&&gp.end?`${new Date(gp.start).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} – ${new Date(gp.end).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}`: 'Dates à confirmer';
 const schedule=sessionRows.map(s=>{const d=new Date(s.start);return `<article class="annual-event"><div class="annual-date"><b>${d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</b><small>${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</small></div><div class="annual-info"><span>🏎️ FORMULE 1</span><b>${escapeHtml(s.name)}</b><small>Heure française</small></div></article>`;}).join('');
 const later=f1AnnualEvents.filter(e=>e.end>=(new Date().toISOString().slice(0,10))&&e.name!==(staticGp?.name)).map(e=>`<article class="f1-next-card"><span>${e.flag}</span><div><b>${escapeHtml(e.name)}</b><small>${new Date(e.start+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} – ${new Date(e.end+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} · ${escapeHtml(e.place)}</small></div></article>`).join('');
 return `<article class="event"><div class="event-top"><span class="tag">PROCHAIN GRAND PRIX</span><span class="status">À VENIR</span></div><div class="f1-event-heading"><div class="f1-event-flag">${gp.flag}</div><div><h3>${escapeHtml(gp.name||'Grand Prix')}</h3><small>${escapeHtml(gp.place||'')} · ${escapeHtml(gp.country||'')}</small></div></div><div class="event-foot"><span>${weekend}</span></div></article><section class="padel-tournament"><header><span class="padel-tournament-kicker">PROGRAMME COMPLET · HEURE FRANÇAISE</span><h3>${escapeHtml(gp.name||'Grand Prix')}</h3><span class="padel-count">${sessionRows.some(s=>/sprint/i.test(s.name))?'Week-end Sprint':'Sans course Sprint'}</span></header>${schedule||'<div class="empty">Les horaires des séances seront affichés dès leur publication.</div>'}</section>${later?'<p class="eyebrow">GRANDS PRIX SUIVANTS</p>'+later:''}`;
}
function renderF1Timing(){
 const t=f1Data?.liveTiming;if(!t?.active)return '<div class="f1-timing-note">Aucune séance en cours actuellement. Le tableau se remplira automatiquement pendant les essais, les qualifications et la course.</div>';
 if(!t.available)return '<div class="f1-timing-note">'+escapeHtml(t.message||'Chronométrage live indisponible.')+'</div>';
 const rows=t.drivers||[];if(!rows.length)return '<div class="f1-timing-note">En attente des premières données de chronométrage…</div>';
 const gain=d=>d.positionChange==null?'—':d.positionChange>0?'▲ '+d.positionChange:d.positionChange<0?'▼ '+Math.abs(d.positionChange):'—';
 return '<div class="f1-timing-wrap"><div class="f1-timing-note"><b>'+escapeHtml(t.sessionName||'Séance en cours')+'</b> · '+escapeHtml(f1Data?.meeting?.name||'Grand Prix')+'</div><div style="overflow-x:auto"><table class="f1-timing-table"><thead><tr><th>POS</th><th>PILOTE</th><th>ÉCART LEADER</th><th>DEVANT</th><th>GAIN</th><th>TOUR</th><th>MEILLEUR</th><th>PNEUS</th><th>STOPS</th></tr></thead><tbody>'+rows.map(d=>'<tr><td><b>'+escapeHtml(d.position??'—')+'</b></td><td><span class="f1-timing-driver"><i style="background:#'+escapeHtml(d.teamColour||'536273')+'"></i>'+escapeHtml(d.acronym||d.name||'—')+'</span></td><td>'+escapeHtml(d.gap||'—')+'</td><td>'+escapeHtml(d.interval||'—')+'</td><td>'+escapeHtml(gain(d))+'</td><td>'+escapeHtml(d.lastLap||'—')+'</td><td><b>'+escapeHtml(d.bestLap||'—')+'</b></td><td>'+escapeHtml((d.tyreHistory||[d.tyre]).filter(Boolean).join(' → ')||'—')+'</td><td>'+escapeHtml(d.pitStops??0)+'</td></tr>').join('')+'</tbody></table></div><p class="f1-timing-updated">Actualisé : '+(t.updatedAt?new Date(t.updatedAt).toLocaleTimeString('fr-FR'):'—')+'</p></div>';
}

function renderF1(){
 const showGrid=!!f1Data?.qualifyingPassed;if(f1View==='grid'&&!showGrid)f1View='program';
 const tabs=[['program','PROGRAMME'],['timing','LIVE TIMING'],['standings','CLASSEMENT'],...(showGrid?[['grid','GRILLE DE DÉPART']]:[])];
 const body=f1View==='timing'?renderF1Timing():f1View==='standings'?renderF1Standings():f1View==='grid'?renderF1Grid():renderF1Program();
 return '<div class="f1-tabs">'+tabs.map(([id,label])=>'<button data-f1-view="'+id+'" class="'+(f1View===id?'active':'')+'">'+label+'</button>').join('')+'</div>'+body+(f1Error?'<p class="data-note">Certaines données F1 sont momentanément indisponibles.</p>':'');
}
async function loadF1(){
 try{
  const response=await fetch('/.netlify/functions/f1-live',{cache:'no-store'});
  const result=await response.json();
  if(!response.ok) throw new Error(result.message||'Données F1 indisponibles');
  f1Data=result;f1Error='';if(document.querySelector('#searchPopover')&&!document.querySelector('#searchPopover').hidden)renderSearchResults(document.querySelector('#globalSearch')?.value||'');
 }catch(error){f1Error=error.message||'Connexion F1 impossible';}
 render();
}


function downloadCalendarEvent(e){
 if(!e){toast('Événement introuvable.');return;}
 const pad=n=>String(n).padStart(2,'0');
 const localStamp=d=>d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'T'+pad(d.getHours())+pad(d.getMinutes())+'00';
 const dateStamp=s=>String(s).replace(/-/g,'');
 const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 let startLine='',endLine='';
 if(e.sport==='padel'||!e.time){
  const endDate=new Date((e.end||e.start)+'T12:00:00');endDate.setDate(endDate.getDate()+1);
  startLine='DTSTART;VALUE=DATE:'+dateStamp(e.start);
  endLine='DTEND;VALUE=DATE:'+dateStamp(endDate.getFullYear()+'-'+pad(endDate.getMonth()+1)+'-'+pad(endDate.getDate()));
 }else{
  let start;
  if(e.sport==='psg'&&String(e.time).includes('T')) start=new Date(e.time);
  else {const t=String(e.time).match(/(\d{1,2}):(\d{2})/);start=new Date(e.start+'T'+pad(t?Number(t[1]):19)+':'+(t?t[2]:'00')+':00');}
  const end=new Date(start.getTime()+(e.sport==='psg'?120:60)*60000);
  startLine='DTSTART:'+localStamp(start);endLine='DTEND:'+localStamp(end);
 }
 const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sport Live//FR','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+Date.now()+'@sportlive','DTSTAMP:'+localStamp(new Date()),startLine,endLine,'SUMMARY:'+esc(e.name),'LOCATION:'+esc(e.place||''),'DESCRIPTION:'+esc([e.detail,e.score].filter(Boolean).join(' · ')),'END:VEVENT','END:VCALENDAR'].join('\r\n');
 const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='sport-live-evenement.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Ouvre le fichier pour l’ajouter à Calendrier.');
}
function renderAnnualCalendar(){
 const psgEvents=[...psgRecent,...psgUpcoming].filter((m,i,arr)=>arr.findIndex(x=>String(x.id)===String(m.id))===i).map(m=>({sport:'psg',name:`${m.home} – ${m.away}`,start:(m.startTime||'').slice(0,10),time:m.startTime,place:m.league||'PSG',detail:m.status,score:m.homeScore==null?'':`${m.homeScore}–${m.awayScore}`}));
 const now=new Date();const todayKey=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const f1SessionEvents=f1AnnualEvents.flatMap(gp=>gp.sessions.map(s=>({sport:'f1',name:gp.flag+' '+gp.name+' — '+s.name,start:s.date,time:s.time,place:gp.place,detail:s.name})));
 const all=[...psgEvents,...padelAnnualEvents,...f1SessionEvents].filter(e=>e.start&&e.start>=todayKey&&(e.end?e.end>=todayKey:true)).sort((a,b)=>{const stamp=e=>{const raw=String(e.time||'');return Date.parse(raw.includes('T')?raw:e.start+'T'+(raw||'00:00')+':00');};return stamp(a)-stamp(b);});
 const filtered=calendarFilter==='all'?all:all.filter(e=>e.sport===calendarFilter);
 calendarRenderedEvents=filtered;
 const filters=[['all','TOUT'],['psg','PSG'],['padel','PADEL'],['f1','F1']];
 const monthNames=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
 const grouped=new Map();
 for(const e of filtered){const d=new Date(e.start+'T12:00:00');const key=monthNames[d.getMonth()];if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(e);}
 const blocks=[...grouped.entries()].map(([month,items])=>`<section class="annual-month"><h3>${month} 2026</h3>${items.map(e=>{const d=new Date(e.start+'T12:00:00');const date=d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});const end=e.end&&e.end!==e.start?' – '+new Date(e.end+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}):'';const label=e.sport==='psg'?'⚽ PSG':e.sport==='padel'?'🎾 PADEL':'🏎️ F1';const sub=e.sport==='psg'?[e.place,e.time?new Date(e.time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'',e.score].filter(Boolean).join(' · '):[e.place,e.detail,e.time].filter(Boolean).join(' · ');return `<article class="annual-event"><div class="annual-date"><b>${date}</b><small>${end}</small></div><div class="annual-info"><span>${label}</span><b>${escapeHtml(e.name)}</b><small>${escapeHtml(sub)}</small></div><button class="calendar-add-icon" data-calendar-add="${filtered.indexOf(e)}" aria-label="Ajouter au calendrier iPhone" title="Ajouter au calendrier"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v6M9 16h6"/></svg></button></article>`}).join('')}</section>`).join('');
 return `<div class="calendar-filters">${filters.map(([id,label])=>`<button data-calendar-filter="${id}" class="${calendarFilter===id?'active':''}">${label}</button>`).join('')}</div>${blocks||'<div class="empty">Aucune date disponible pour ce filtre.</div>'}<p class="data-note">Les matchs du PSG proviennent du flux de résultats. Le calendrier Padel et F1 correspond au programme 2026 publié.</p>`;
}
function renderPsgSquad(){
 if(psgSquadLoading&&!psgSquad)return '<div class="empty">Chargement de l’effectif du PSG…</div>';
 if(psgSquadError&&!psgSquad?.length)return `<div class="empty">${escapeHtml(psgSquadError)}</div>`;
 const players=Array.isArray(psgSquad)?psgSquad:[];
 if(!players.length)return '<div class="empty">Effectif indisponible pour le moment.</div>';
 const age=p=>p.dateOfBirth?Math.floor((Date.now()-Date.parse(p.dateOfBirth))/(365.2425*86400000))+' ans':'—';
 return `<div class="psg-squad-list">${players.map(p=>`<article class="psg-player-row ${searchHighlight===normalizeSearch(p.name)?'search-highlight':''}" data-search-name="${escapeHtml(normalizeSearch(p.name))}"><img src="${escapeHtml(p.image||'')}" alt="" loading="lazy" onerror="this.style.display='none'"><div class="psg-player-main"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.position||'Poste non renseigné')} · ${p.heightCm?escapeHtml(p.heightCm)+' cm':'Taille —'} · ${age(p)}</small></div></article>`).join('')}</div><p class="data-note">Effectif actuel · Saison 2026/27.</p>`;
}
async function loadPsgSquad(){
 if(psgSquadLoading)return;psgSquadLoading=true;psgSquadError='';render();
 try{const response=await fetch('/.netlify/functions/psg-squad',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.message||'Effectif indisponible');psgSquad=data.players||[];}
 catch(error){psgSquadError=error.message||'Impossible de charger l’effectif.';}
 finally{psgSquadLoading=false;render();if(document.querySelector('#searchPopover')&&!document.querySelector('#searchPopover').hidden)renderSearchResults(document.querySelector('#globalSearch')?.value||'');}
}
function psgCompetitionIcon(league){
 const name=String(league||'').toLowerCase();
 if(/champions|ligue des champions|uefa/i.test(name))return '🏆';
 if(/ligue 1|coupe de france|french cup/i.test(name))return '🇫🇷';
 return '⚽';
}
function renderDashboard(cards){const n=(psgLive||[]).length+(padelData?.live||[]).length+(f1Data?.liveTiming?.active?1:0);return '<section class="dashboard-overview"><div><p class="eyebrow">SPORT LIVE · VOTRE PROGRAMME</p><h2>Les temps forts, au même endroit.</h2><p>PSG · FORMULE 1 · PREMIER PADEL</p></div><div class="dashboard-live-count"><b>'+n+'</b><small>EN DIRECT</small></div></section><div class="dashboard-section-title"><p class="eyebrow">SUIVI PERSONNALISÉ</p><h2>À suivre</h2></div><div class="dashboard-cards">'+cards+'</div>';}
function openPsgMatchCenter(id){const m=[...(psgLive||[]),...(psgUpcoming||[]),...(psgRecent||[])].find(x=>String(x.id)===String(id));if(!m)return;selectedPsgMatch=m;psgMatchDetail=null;psgMatchError='';filter='psg';document.querySelectorAll('.sport').forEach(x=>x.classList.toggle('active',x.dataset.sport==='psg'));document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('#navHome').classList.add('selected');loadPsgMatchDetail(m);}
function renderPsgMatchCenter(){const m=selectedPsgMatch||{},d=psgMatchDetail||{},f=d.fixture||{},home=f.home?.name||m.home,away=f.away?.name||m.away,homeScore=f.homeScore?.current??m.homeScore,awayScore=f.awayScore?.current??m.awayScore,clock=f.clock?.display||(f.clock?.minute!=null?f.clock.minute+(f.clock.addedMinute?'+'+f.clock.addedMinute:'')+'′':f.status?.description||m.status);if(psgMatchLoading&&!psgMatchDetail)return '<div class="psg-match-center"><button class="match-center-back" data-psg-back>← Retour au PSG</button><div class="empty">Chargement des données du match…</div></div>';const stats=(d.statistics?.periods||[]).flatMap(p=>p.groups||[]).flatMap(g=>g.items||[]).filter(x=>/possession|shots|corner|fouls|yellow|red|offsides|passes/i.test((x.key||'')+' '+(x.name||''))).slice(0,12),ev=(Array.isArray(d.events)?d.events:[]);const side=(k,l)=>{const ps=d.lineups?.[k]?.players||[];return '<div><h4>'+l+'</h4>'+(ps.length?ps.map(p=>'<p>'+escapeHtml(p.shirtNumber||'')+' '+escapeHtml(p.player?.name||p.name||'Joueur')+' <small>'+escapeHtml(p.position||'')+'</small></p>').join(''):'<p>Composition non publiée.</p>')+'</div>'};return '<div class="psg-match-center"><button class="match-center-back" data-psg-back>← Retour au PSG</button><section class="match-center-score"><span class="tag">'+escapeHtml(m.league||'PARIS SAINT-GERMAIN')+'</span><div class="match-center-teams"><b>'+escapeHtml(home||'PSG')+'</b><strong>'+(homeScore??'—')+' – '+(awayScore??'—')+'</strong><b>'+escapeHtml(away||'Adversaire')+'</b></div><div class="match-center-clock">'+escapeHtml(clock||'Match')+'</div></section>'+(psgMatchError?'<div class="f1-timing-note">'+escapeHtml(psgMatchError)+'</div>':'')+'<section class="match-center-section"><h3>Statistiques du match</h3>'+(stats.length?stats.map(x=>'<div class="match-stat-row"><span>'+escapeHtml(x.home?.display??x.home?.value??'—')+'</span><b>'+escapeHtml(x.name||x.key)+'</b><span>'+escapeHtml(x.away?.display??x.away?.value??'—')+'</span></div>').join(''):'<p class="data-note">Statistiques détaillées non disponibles pour le moment.</p>')+'</section><section class="match-center-section"><h3>Chronologie</h3><div class="match-timeline">'+(ev.length?ev.map(x=>'<div class="match-event-row"><span class="match-event-minute">'+escapeHtml(x.minute==null?(x.addedMinute?'90+'+x.addedMinute+'′':'—'):x.minute+(x.addedMinute?'+'+x.addedMinute:'')+'′')+'</span><div class="match-event-copy"><b>'+escapeHtml(x.player?.name||x.playerName||x.type||'Événement')+'</b><small>'+escapeHtml(x.detail||x.type||'')+(x.assist?.name?' · Passe : '+escapeHtml(x.assist.name):'')+'</small></div></div>').join(''):'<p class="data-note">Aucun événement communiqué pour le moment.</p>')+'</div></section><section class="match-center-section"><h3>Compositions</h3><div class="match-lineups">'+side('home','DOMICILE')+side('away','EXTÉRIEUR')+'</div></section></div>';}
async function loadPsgMatchDetail(m){if(!m?.id)return;psgMatchLoading=true;render();try{const r=await fetch('/.netlify/functions/psg-match-detail?fixtureId='+encodeURIComponent(m.id),{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.message||'Détail du match indisponible');psgMatchDetail=d;psgMatchError='';}catch(e){psgMatchError=e.message||'Impossible de charger le centre de match.';}finally{psgMatchLoading=false;render();}}
async function loadPadelTournament(){const selected=selectedPadelTournament;if(!selected?.id&&!selected?.name)return;padelTournamentLoading=true;padelTournamentError='';render();try{const query=selected.id?'leagueId='+encodeURIComponent(selected.id):'tournament='+encodeURIComponent(selected.name);const r=await fetch('/.netlify/functions/padel-tournament?'+query,{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.message||'Tableau du tournoi indisponible');padelTournamentData=d;if(selectedPadelTournament&&!selectedPadelTournament.id&&d.leagueId)selectedPadelTournament.id=d.leagueId;}catch(e){padelTournamentError=e.message||'Tableau indisponible.';}finally{padelTournamentLoading=false;render();if(document.querySelector('#searchPopover')&&!document.querySelector('#searchPopover').hidden)renderSearchResults(document.querySelector('#globalSearch')?.value||'');}}
function renderPsgHome(){
 const now=Date.now(),live=Array.isArray(psgLive)?psgLive[0]:null;
 const next=(psgUpcoming||[]).filter(m=>m.startTime&&Date.parse(m.startTime)>=now).sort((a,b)=>Date.parse(a.startTime)-Date.parse(b.startTime))[0];
 const match=live||next;
 if(!match)return '<article class="event"><div class="event-top"><span class="tag">⚽ PARIS SAINT-GERMAIN</span><span class="status">À VENIR</span></div><div class="event-main"><div class="teams">Prochain match du PSG</div><div class="score">—</div></div><div class="event-foot"><span>Calendrier en attente de mise à jour</span></div></article>';
 const date=match.startTime?new Date(match.startTime).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'En cours';
 return `<article class="event psg-home-card"><div class="event-top"><span class="tag"><span class="psg-competition-flag">${psgCompetitionIcon(match.league)}</span>PSG · ${escapeHtml(match.league||'FOOTBALL')}</span><span class="status">${live?'EN DIRECT':'PROCHAIN MATCH'}</span></div><div class="event-main"><div class="teams">${escapeHtml(match.home||'PSG')}<br>${escapeHtml(match.away||'Adversaire')}</div><div class="score">${match.homeScore??'—'} - ${match.awayScore??'—'}<small>${escapeHtml(match.round||match.status||'')}</small></div></div><div class="event-foot"><span>${date}</span>${match.id?'<button class="dashboard-action" data-psg-match-center="'+match.id+'">CENTRE DE MATCH ↗</button>':''}</div></article>`;
}
function renderPadelHome(){
 if(padelError)return `<article class="event"><div class="event-top"><span class="tag">🎾 PADEL</span><span class="status">INDISPONIBLE</span></div><div class="empty">${escapeHtml(padelError)}</div></article>`;
 const live=padelData?.live?.filter(m=>/\bmajor\b|\bp1\b|\bp2\b/i.test(String(m.league||m.tournament||'')))||[];
 if(live.length){const m=live[0],sets=Object.keys(m.homeSets||{}).sort((a,b)=>Number(a)-Number(b)).map(k=>m.homeSets[k]+'-'+(m.awaySets?.[k]??'—')).join(' · ');return `<article class="event"><div class="event-top"><span class="tag">🎾 PADEL · ${escapeHtml(m.tournament||m.league||'PREMIER PADEL')}</span><span class="status">EN DIRECT</span></div><div class="event-main"><div class="teams">${escapeHtml(m.home||'Paire 1')}<br>${escapeHtml(m.away||'Paire 2')}</div><div class="score">${m.homeScore??'—'} - ${m.awayScore??'—'}<small>${escapeHtml(sets||'Match en cours')}</small></div></div><div class="event-foot"><span>Scores actualisés en direct</span>${m.leagueId?'<button class="dashboard-action" data-padel-tournament="'+m.leagueId+'" data-tournament-name="'+escapeHtml(m.tournament||m.league||'Premier Padel')+'">CENTRE DU TOURNOI ↗</button>':''}</div></article>`;}
 const today=new Date().toISOString().slice(0,10),next=padelAnnualEvents.filter(e=>e.end>=today).sort((a,b)=>a.start.localeCompare(b.start))[0];
 if(!next)return '<article class="event"><div class="event-top"><span class="tag">🎾 PADEL</span></div><div class="empty">Aucun prochain tournoi annoncé.</div></article>';
 return `<article class="event padel-home-card"><div class="event-top"><span class="tag">🎾 PREMIER PADEL</span><span class="status">PROCHAIN TOURNOI</span></div><div class="event-main"><div class="teams">${escapeHtml(next.name)}<small>${escapeHtml(next.place)}</small></div><div class="score">${escapeHtml(next.detail)}</div></div><div class="event-foot"><span>${new Date(next.start+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} – ${new Date(next.end+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</span><button class="dashboard-action" data-padel-search-tournament="1" data-tournament-name="${escapeHtml(next.name)}">CENTRE DU TOURNOI ↗</button></div></article>`;
}
function renderPadelTournament(){const rounds=(padelTournamentData?.trees||[]).flatMap(t=>t.rounds||[]);const bracket=rounds.map(r=>'<section class="padel-bracket-round"><h4>'+escapeHtml(r.name||'Tour')+'</h4>'+(r.blocks||[]).map(m=>'<div class="padel-bracket-match"><b>'+escapeHtml(m.home?.team?.name||'À déterminer')+' '+(m.home?.score??'')+' — '+(m.away?.score??'')+' '+escapeHtml(m.away?.team?.name||'À déterminer')+'</b><small>'+(m.finished?'Terminé':m.inProgress?'En cours':m.startTime?new Date(m.startTime).toLocaleDateString('fr-FR'):'À venir')+'</small></div>').join('')+'</section>').join('');const rows=(padelData?.matches||[]).filter(m=>String(m.leagueId||'')===String(selectedPadelTournament?.id||'')).sort((a,b)=>String(a.startTime||'').localeCompare(String(b.startTime||'')));const journey=rows.length?'<section class="match-center-section"><h3>Parcours et matchs disponibles</h3>'+rows.map(m=>{const sets=Object.keys(m.homeSets||{}).sort((a,b)=>Number(a)-Number(b)).map(k=>m.homeSets[k]+'-'+(m.awaySets?.[k]??'—')).join(' · ');return '<div class="padel-bracket-match"><b>'+escapeHtml(m.round||m.home+' – '+m.away)+'</b><small>'+escapeHtml(m.homeScore==null?'À jouer':m.homeScore+'–'+m.awayScore)+(sets?' · '+escapeHtml(sets):'')+' · '+escapeHtml(m.status)+'</small></div>';}).join('')+'</section>':'';return '<button class="match-center-back" data-padel-back>← Retour au programme</button><section class="match-center-section"><p class="eyebrow">TABLEAU DU TOURNOI</p><h3>'+escapeHtml(selectedPadelTournament?.name||'Premier Padel')+'</h3></section>'+(padelTournamentLoading?'<div class="empty">Chargement du tableau officiel…</div>':padelTournamentError?'<div class="empty">'+escapeHtml(padelTournamentError)+'</div>':bracket||'<div class="f1-timing-note">Aucun tableau à élimination directe fourni pour ce tournoi. Les matchs disponibles sont listés ci-dessous.</div>')+journey;}
function renderPadel(){
 const nav=`<div class="padel-tabs"><button data-padel-view="schedule" class="${padelView==='schedule'?'active':''}">JOURNÉE PAR JOURNÉE</button><button data-padel-view="rankings" class="${padelView==='rankings'?'active':''}">CLASSEMENTS FIP</button></div>`;
 if(padelView==='tournament'){return nav+renderPadelTournament();}
  if(padelView!=='rankings'&&padelError) return nav+`<div class="empty">Connexion Padel indisponible : ${escapeHtml(padelError)}</div>`;
 if(padelView!=='rankings'&&!padelData) return nav+'<div class="empty">Chargement des tournois Premier Padel…</div>';
 const rowsFor = list => (list||[]).filter(m=>/\bmajor\b|\bp1\b|\bp2\b/i.test(String(m.league||m.tournament||'')));
 const matchCard=m=>{
  const setKeys=Object.keys(m.homeSets||{}).sort((a,b)=>Number(a)-Number(b));
  const sets=setKeys.map(k=>`${m.homeSets[k]}-${m.awaySets?.[k]??'—'}`).join('  ');
  const score=m.homeScore==null?'—':`${m.homeScore} - ${m.awayScore??'—'}`;
  const time=m.startTime?new Date(m.startTime).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'Horaire à confirmer';
  return `<article class="padel-match"><div class="padel-match-pairs"><div><span>${escapeHtml(m.home)}</span><span>${escapeHtml(m.away)}</span></div><div class="padel-match-score"><b>${score}</b><small>${sets||escapeHtml(m.status)}</small></div></div><div class="padel-match-time">${time} · ${escapeHtml(m.status)}</div></article>`;
 };
 const tournamentGroups = list => {
  const tournaments=new Map();
  for(const m of list){
   const name=m.tournament||m.league||'Tournoi';
   if(!tournaments.has(name)) tournaments.set(name,[]);
   tournaments.get(name).push(m);
  }
  return [...tournaments.entries()].sort((a,b)=>a[0].localeCompare(b[0],'fr')).map(([name,matches])=>{
   const days=new Map();
   for(const m of matches){
    const d=m.startTime?new Date(m.startTime):null;
    const key=d&&!Number.isNaN(d.getTime())?d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}):'Date à confirmer';
    if(!days.has(key)) days.set(key,[]);
    days.get(key).push(m);
   }
   const dayBlocks=[...days.entries()].map(([day,dayMatches])=>`<section class="padel-day"><h4>${escapeHtml(day)}</h4>${dayMatches.sort((a,b)=>String(a.startTime||'').localeCompare(String(b.startTime||''))).map(matchCard).join('')}</section>`).join('');
   return `<section class="padel-tournament"><header><span class="padel-tournament-kicker">PREMIER PADEL</span><h3>${escapeHtml(name)}</h3><span class="padel-count">${matches.length} match${matches.length>1?'s':''}</span></header>${dayBlocks}${matches[0]?.leagueId?'<button class="padel-tournament-open" data-padel-tournament="'+matches[0].leagueId+'" data-tournament-name="'+escapeHtml(name)+'">Voir le tableau et le parcours <span>→</span></button>':''}</section>`;
  }).join('');
 };
 let body='';
 if(padelView==='schedule'){
  const rows=rowsFor(padelData.matches);
  const today=new Date().toISOString().slice(0,10);
  const nextTournaments=padelAnnualEvents.filter(e=>e.end>=today);
  const tournamentCalendar=nextTournaments.length?`<div class="padel-upcoming"><p class="eyebrow">PROCHAINS TOURNOIS</p>${nextTournaments.map(e=>`<article class="padel-upcoming-card"><div><b>${escapeHtml(e.name)}</b><small>${new Date(e.start+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} – ${new Date(e.end+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} · ${escapeHtml(e.place)}</small></div><strong>${escapeHtml(e.detail)}</strong><button class="dashboard-action" data-padel-search-tournament="1" data-tournament-name="${escapeHtml(e.name)}">TABLEAU ↗</button></article>`).join('')}</div>`:'';
  body=tournamentCalendar+(rows.length?tournamentGroups(rows):'<div class="empty">Les tableaux et horaires détaillés seront affichés à leur publication.</div>');
 }else{
  const rows=padelRankings?.[padelGender]||[];
  body=`<div class="padel-gender"><button data-padel-gender="men" class="${padelGender==='men'?'active':''}">HOMMES</button><button data-padel-gender="women" class="${padelGender==='women'?'active':''}">FEMMES</button></div>`+
   (rows.length?`<div class="ranking-list">${rows.map(r=>`<div class="ranking-row ${searchHighlight===normalizeSearch(r.name)?'search-highlight':''}" data-search-name="${escapeHtml(normalizeSearch(r.name))}"><b class="ranking-position">#${r.position??'—'}</b>${r.image?`<img class="ranking-photo" src="${escapeHtml(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<div class="ranking-photo ranking-photo-empty">👤</div>'}<span class="ranking-name">${escapeHtml(String(r.name||'').trim().replace(/\s+/g,' '))}${r.country?`<small>${escapeHtml(r.country)}</small>`:''}</span><strong>${r.points==null?'—':Number(r.points).toLocaleString('fr-FR')+' pts'}</strong></div>`).join('')}</div>`:padelRankingLoading?'<div class="empty">Chargement des classements officiels FIP…</div>':`<div class="empty">${escapeHtml(padelRankingError||'Classement indisponible pour le moment.')}</div>`);
 }
 return nav+body+`<p class="data-note">Tournois affichés : Major · P1 · P2 | Actualisation toutes les 10 min</p>`;
}
function renderDirect(){
 const cards=[];
 const psg=Array.isArray(psgLive)?psgLive:[];
 psg.forEach(m=>cards.push(`<article class="event"><div class="event-top"><span class="tag">⚽ PSG · ${escapeHtml(m.league||'FOOTBALL')}</span><span class="status">EN DIRECT</span></div><div class="event-main"><div class="teams">${escapeHtml(m.home||'PSG')}<br>${escapeHtml(m.away||'Adversaire')}</div><div class="score">${m.homeScore??'—'} - ${m.awayScore??'—'}<small>${escapeHtml(m.round||m.status||'Match en cours')}</small></div></div></article>`));
 const padel=Array.isArray(padelData?.live)?padelData.live.filter(m=>/\bmajor\b|\bp1\b|\bp2\b/i.test(String(m.league||m.tournament||''))):[];
 padel.forEach(m=>{const sets=Object.keys(m.homeSets||{}).sort((a,b)=>Number(a)-Number(b)).map(k=>`${m.homeSets[k]}-${m.awaySets?.[k]??'—'}`).join('  ');cards.push(`<article class="event"><div class="event-top"><span class="tag">🎾 PADEL · ${escapeHtml(m.tournament||m.league||'PREMIER PADEL')}</span><span class="status">EN DIRECT</span></div><div class="event-main"><div class="teams">${escapeHtml(m.home||'Paire 1')}<br>${escapeHtml(m.away||'Paire 2')}</div><div class="score">${m.homeScore==null?'—':`${m.homeScore} - ${m.awayScore??'—'}`}<small>${escapeHtml(sets||m.status||'Match en cours')}</small></div></div></article>`)});
 const now=Date.now();
 const f1sessions=(f1Data?.sessions||[]).filter(x=>Date.parse(x.start)<=now&&Date.parse(x.end)>=now);
 f1sessions.forEach(x=>cards.push(`<article class="event"><div class="event-top"><span class="tag">🏎️ FORMULE 1</span><span class="status">EN DIRECT</span></div><div class="event-main"><div class="teams">${escapeHtml(f1Data?.meeting?.name||'Grand Prix')}</div><div class="score">${escapeHtml(x.name)}<small>Séance en cours</small></div></div></article>`));
 return cards.length?cards.join(''):'<div class="empty">Aucun événement sportif en direct actuellement. Les matchs en cours apparaîtront ici, et uniquement ici.</div>';
}
async function loadPadelRankings(){
 padelRankingLoading=true;padelRankingError='';render();
 try{
  const response=await fetch('/.netlify/functions/padel-rankings',{cache:'no-store'});
  const result=await response.json();
  if(!response.ok) throw new Error(result.message||'Classements FIP indisponibles');
  padelRankings=result.rankings;
 }catch(error){padelRankingError=error.message||'Connexion FIP impossible';}
 finally{padelRankingLoading=false;render();if(document.querySelector('#searchPopover')&&!document.querySelector('#searchPopover').hidden)renderSearchResults(document.querySelector('#globalSearch')?.value||'');}
}
async function loadPadel(){
 try{
  const response=await fetch('/.netlify/functions/padel-live',{cache:'no-store'});
  const result=await response.json();
  if(!response.ok) throw new Error(result.message||'Erreur de connexion');
  padelData=result;padelError='';
 }catch(error){padelError=error.message||'Connexion impossible';}
 render();
}


let newsItems=[];let newsFilter='all';let newsLoading=false;let newsError='';
function renderNews(){
 const root=document.querySelector('#news-feed');if(!root)return;
 const visible=(newsFilter==='all'?newsItems:newsItems.filter(n=>n.sport===newsFilter)).slice().sort((a,b)=>Date.parse(b.date||0)-Date.parse(a.date||0)).slice(0,12);
 let content='';
 if(newsLoading&&!newsItems.length)content='<div class="empty">Chargement des actualités…</div>';
 else if(visible.length){
  content='<div class="news-list">'+visible.map(n=>{
   const label=n.sport==='psg'?'PSG':n.sport==='padel'?'PADEL':'FORMULE 1';
   const date=n.date?new Date(n.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
   return '<a class="news-item" href="'+escapeHtml(n.url)+'" target="_blank" rel="noopener"><div class="news-item-copy"><div class="news-meta"><span class="news-category '+n.sport+'">'+label+'</span><span>'+escapeHtml(n.source)+'</span><span>'+date+'</span></div><b>'+escapeHtml(n.title)+'</b><p>'+escapeHtml(n.description||'')+'</p><small>Lire l’article ↗</small></div>'+(n.image?'<img src="'+escapeHtml(n.image)+'" alt="" loading="lazy">':'')+'</a>';
  }).join('')+'</div>';
 }else content='<div class="empty">'+(newsError?escapeHtml(newsError):'Aucun article trouvé pour cette rubrique.')+'</div>';
 root.innerHTML='<div class="news-filters">'+[['all','TOUT'],['psg','PSG'],['padel','PADEL'],['f1','F1']].map(([id,label])=>'<button data-news-filter="'+id+'" class="'+(newsFilter===id?'active':'')+'">'+label+'</button>').join('')+'</div>'+content+'<p class="data-note">Médias gratuits · Lecture complète selon les conditions de chaque éditeur.</p>';root.querySelectorAll('[data-news-filter]').forEach(b=>b.addEventListener('click',()=>{newsFilter=b.dataset.newsFilter;renderNews()}));
}
async function loadNews(){
 newsLoading=true;renderNews();
 try{const response=await fetch('/.netlify/functions/news',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.message||'Actualités indisponibles');newsItems=Array.isArray(data.articles)?data.articles:[];newsError='';}
 catch(error){newsError=error.message||'Impossible de charger les actualités.';}
 finally{newsLoading=false;renderNews();}
}

function normalizeSearch(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function buildSearchResults(query){
 const q=normalizeSearch(query);if(!q)return [];const items=[];
 const add=(type,title,subtitle,meta,action,terms=[])=>items.push({type,title,subtitle,meta,action,terms:[title,subtitle,...terms].map(normalizeSearch).join(' ')});
 (padelRankings?.men||[]).forEach(p=>add('padel-player',p.name,'Joueur de padel · Hommes',p.country||'Classement FIP',{name:p.name,gender:'men'},[p.country]));
 (padelRankings?.women||[]).forEach(p=>add('padel-player',p.name,'Joueuse de padel · Femmes',p.country||'Classement FIP',{name:p.name,gender:'women'},[p.country]));
 (psgSquad||[]).forEach(p=>add('psg-player',p.name,'Joueur du Paris Saint-Germain',p.position||'Effectif PSG',{name:p.name}));
 const drivers=f1Data?.drivers?.length?f1Data.drivers:f1FallbackDrivers;drivers.forEach(d=>add('f1-driver',d.name,'Pilote de Formule 1',d.team||'F1',{name:d.name}));
 [...(psgLive||[]),...(psgUpcoming||[]),...(psgRecent||[])].filter((m,i,a)=>a.findIndex(x=>String(x.id)===String(m.id))===i).forEach(m=>add('psg-match',(m.home||'PSG')+' – '+(m.away||'Adversaire'),'Match du PSG',m.status||m.league||'Football',{id:m.id}));
 (padelData?.matches||[]).forEach(m=>add('padel-match',(m.home||'Paire 1')+' – '+(m.away||'Paire 2'),'Match Premier Padel',m.tournament||m.league||m.status||'Padel',{id:m.id,leagueId:m.leagueId,name:m.tournament||m.league||'Premier Padel'}));
 const gps=[...(f1Data?.meeting?[f1Data.meeting]:[]),...f1AnnualEvents].filter((g,i,a)=>a.findIndex(x=>normalizeSearch(x.name||x.officialName)===normalizeSearch(g.name||g.officialName))===i);
 gps.forEach(g=>add('f1-event',g.name||g.officialName||'Grand Prix','Grand Prix de Formule 1',g.place||g.location||g.country||'Calendrier F1',{name:g.name||g.officialName}));
 return items.filter(x=>x.terms.includes(q)||x.terms.split(' ').some(t=>t.startsWith(q))).sort((a,b)=>(normalizeSearch(a.title).startsWith(q)?0:1)-(normalizeSearch(b.title).startsWith(q)?0:1)||a.title.localeCompare(b.title,'fr')).slice(0,14);
}
function renderSearchResults(query){
 const root=document.querySelector('#searchResults');if(!root)return;searchResults=buildSearchResults(query);
 if(!normalizeSearch(query)){root.innerHTML='<p class="search-hint">Recherche un joueur, un pilote ou une affiche de match.</p>';return;}
 if(!searchResults.length){root.innerHTML='<p class="search-hint">Aucun résultat. Les données disponibles sont recherchées dans les classements et calendriers chargés.</p>';return;}
 root.innerHTML=searchResults.map((r,i)=>'<button class="search-result" data-search-result="'+i+'"><span class="search-result-icon">'+(r.type.includes('padel')?'🎾':r.type.includes('psg')?'⚽':'🏎️')+'</span><span class="search-result-copy"><b>'+escapeHtml(r.title)+'</b><small>'+escapeHtml(r.subtitle)+'</small></span><span class="search-result-meta">'+escapeHtml(r.meta||'')+'</span><span class="search-result-arrow">›</span></button>').join('');
 root.querySelectorAll('[data-search-result]').forEach(b=>b.addEventListener('click',()=>openSearchResult(searchResults[Number(b.dataset.searchResult)])));
}
function closeSearch(){const pop=document.querySelector('#searchPopover');if(pop)pop.hidden=true;document.querySelector('#searchToggle')?.setAttribute('aria-expanded','false');}
function openSearchResult(r){
 if(!r)return;closeSearch();searchHighlight='';
 if(r.type==='psg-match'){openPsgMatchCenter(r.action.id);return;}
 if(r.type==='padel-match'){filter='padel';padelView=r.action.leagueId?'tournament':'schedule';selectedPadelTournament=r.action.leagueId?{id:r.action.leagueId,name:r.action.name}:null;padelTournamentData=null;padelTournamentError='';render();if(selectedPadelTournament)loadPadelTournament();}
 else if(r.type==='f1-event'){filter='f1';f1View='program';render();document.querySelectorAll('.sport').forEach(x=>x.classList.toggle('active',x.dataset.sport==='f1'));}
 else if(r.type==='f1-driver'){filter='f1';f1View='standings';f1StandingMode='drivers';searchHighlight=normalizeSearch(r.action.name);render();document.querySelectorAll('.sport').forEach(x=>x.classList.toggle('active',x.dataset.sport==='f1'));}
 else if(r.type==='padel-player'){filter='padel';padelView='rankings';padelGender=r.action.gender;searchHighlight=normalizeSearch(r.action.name);render();document.querySelectorAll('.sport').forEach(x=>x.classList.toggle('active',x.dataset.sport==='padel'));if(!padelRankings&&!padelRankingLoading)loadPadelRankings();}
 else if(r.type==='psg-player'){filter='psg';psgSquadView=true;searchHighlight=normalizeSearch(r.action.name);render();document.querySelectorAll('.sport').forEach(x=>x.classList.toggle('active',x.dataset.sport==='psg'));if(!psgSquad&&!psgSquadLoading)loadPsgSquad();}
 document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('#navHome').classList.add('selected');
 setTimeout(()=>document.querySelector('.search-highlight')?.scrollIntoView({behavior:'smooth',block:'center'}),80);
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function loadPsgCompetitions(){
 psgStandingsLoading=true;psgStandingsError='';render();
 try{
  const response=await fetch('/.netlify/functions/psg-competitions',{cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw new Error(result.message||'Classements indisponibles');
  psgStandings=result;
 }catch(error){psgStandingsError=error.message||'Connexion aux classements impossible';}
 finally{psgStandingsLoading=false;render();}
}
async function loadPsgLive(){
 try{
  const response=await fetch('/.netlify/functions/psg-live',{cache:'no-store'});
  const result=await response.json();
  if(!response.ok) throw new Error(result.message||'Erreur de connexion');
  psgLive=Array.isArray(result.live)?result.live:[];
  psgUpcoming=Array.isArray(result.upcoming)?result.upcoming:[];
  psgRecent=Array.isArray(result.recent)?result.recent:[];
  psgError='';
 }catch(error){psgLive=[];psgUpcoming=[];psgRecent=[];psgError=error.message||'Connexion impossible';}
 render();
}

document.querySelectorAll('.sport').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.sport').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.sport;document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('#navHome').classList.add('selected');render();renderNews()}));
const now=new Date();document.querySelector('#today').textContent=new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short'}).format(now).toUpperCase();
function toast(s){const t=document.querySelector('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000)}
function downloadICS(title){const start=new Date(Date.now()+86400000);start.setHours(19,0,0,0);const end=new Date(start.getTime()+90*60000);const fmt=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const esc=s=>s.replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;');const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sport Live//FR\r\nBEGIN:VEVENT\r\nUID:${Date.now()}@sportlive\r\nDTSTAMP:${fmt(new Date())}\r\nDTSTART:${fmt(start)}\r\nDTEND:${fmt(end)}\r\nSUMMARY:${esc(title)}\r\nDESCRIPTION:Horaire fictif de démonstration. À remplacer par le calendrier officiel.\r\nEND:VEVENT\r\nEND:VCALENDAR`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='sport-live-evenement.ics';a.click();URL.revokeObjectURL(a.href);toast('Fichier calendrier créé. Ouvre-le pour l’ajouter à Calendrier.');}
document.querySelector('#calendarBtn').onclick=()=>downloadICS('SPORT LIVE - événement à compléter');document.querySelector('#navCalendar').onclick=()=>{filter='calendar';document.querySelectorAll('.sport').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('#navCalendar').classList.add('selected');render();};
document.querySelector('#navNewsQuick').onclick=()=>document.querySelector('#navNews').click();
document.querySelector('#installHint').onclick=()=>toast('Dans Safari : Partager → Sur l’écran d’accueil → Ajouter.');document.querySelector('#navHome').onclick=()=>{filter='all';document.querySelectorAll('.sport').forEach(x=>x.classList.toggle('active',x.dataset.sport==='all'));document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('#navHome').classList.add('selected');document.body.classList.remove('direct-mode');render();renderNews();window.scrollTo({top:0,behavior:'smooth'});};document.querySelector('#navLive').onclick=()=>{filter='direct';document.querySelectorAll('.sport').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('#navLive').classList.add('selected');render()};document.querySelector('#navNews').onclick=()=>{document.body.classList.remove('direct-mode');filter='all';document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('#navNews').classList.add('selected');document.querySelector('.news-head').scrollIntoView({behavior:'smooth'});if(!newsItems.length&&!newsLoading)loadNews();};
document.querySelector('#searchToggle')?.addEventListener('click',()=>{const pop=document.querySelector('#searchPopover'),input=document.querySelector('#globalSearch'),open=pop.hidden;pop.hidden=!open;document.querySelector('#searchToggle').setAttribute('aria-expanded',String(open));if(open){input.focus();renderSearchResults(input.value);if(!psgSquad&&!psgSquadLoading)loadPsgSquad();if(!padelRankings&&!padelRankingLoading)loadPadelRankings();}});
document.querySelector('#searchClose')?.addEventListener('click',closeSearch);
document.querySelector('#globalSearch')?.addEventListener('input',e=>renderSearchResults(e.target.value));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSearch();if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('#searchToggle')?.click();}});
document.addEventListener('click',e=>{const pop=document.querySelector('#searchPopover');if(pop&&!pop.hidden&&!pop.contains(e.target)&&!e.target.closest('#searchToggle'))closeSearch();});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));render();loadPsgLive();loadPadel();loadF1();loadNews();setInterval(loadPsgLive,300000);setInterval(()=>{if(filter==='psg'&&selectedPsgMatch&&!psgMatchLoading&&/live|in.?progress|playing|half|extra time/i.test(String(selectedPsgMatch.status||'')+' '+String(selectedPsgMatch.statusType||'')+' '+String(psgMatchDetail?.fixture?.status?.type||'')))loadPsgMatchDetail(selectedPsgMatch)},30000);setInterval(loadPadel,60000);setInterval(loadF1,600000);setInterval(()=>{if(f1Data?.liveTiming?.refreshable)loadF1()},20000);