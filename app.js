const examples=[
 {sport:'padel',tag:'PADEL · HOMMES',status:'EXEMPLE',left:'Paire A',right:'Paire B',score:'—',detail:'Major / P1 / P2 · Tableau principal',tv:'Diffusion à confirmer'},
 {sport:'psg',tag:'PARIS SAINT-GERMAIN',status:'À VENIR',left:'PSG',right:'Adversaire',score:'—',detail:'Prochain match · Horaire à confirmer',tv:'Chaîne à confirmer'},
 {sport:'f1',tag:'FORMULE 1',status:'À VENIR',left:'Prochain Grand Prix',right:'Programme',score:'—',detail:'Essais · Qualifications · Course',tv:'Diffuseur à confirmer'},

];
const events=document.querySelector('#events');let filter='all';let calendarFilter='all';let psgLive=[];let psgUpcoming=[];let psgRecent=[];let psgError='';let psgCompetition='all';let psgStandings=null;let psgStandingsError='';let psgStandingsLoading=false;let padelData=null;let padelError='';let padelView='live';let padelGender='men';let padelRankings=null;let padelRankingError='';let padelRankingLoading=false;let f1Data=null;let f1Error='';let f1View='program';let f1StandingMode='drivers';
function render(){
 if(filter==='calendar'){
  events.innerHTML=renderAnnualCalendar();
  document.querySelectorAll('[data-calendar-filter]').forEach(b=>b.addEventListener('click',()=>{calendarFilter=b.dataset.calendarFilter;render()}));
  return;
 }
 const rows=examples.filter(x=>filter==='all'||x.sport===filter);
 events.innerHTML=rows.map(x=>{
  if(x.sport==='padel') return renderPadel();
  if(x.sport==='f1') return filter==='all'?renderF1Home():renderF1();
  if(x.sport==='psg'){
   const tabs=[['all','TOUS'],['ligue1','LIGUE 1'],['ucl','LIGUE DES CHAMPIONS'],['cdf','COUPE DE FRANCE']];
   const nav=`<div class="f1-tabs psg-competition-tabs">${tabs.map(([id,label])=>`<button data-psg-competition="${id}" class="${psgCompetition===id?'active':''}">${label}</button>`).join('')}</div>`;
   const all=[...psgLive,...psgUpcoming,...psgRecent].filter((m,i,a)=>a.findIndex(v=>String(v.id)===String(m.id))===i);
   const matches=psgCompetition==='all'?all:all.filter(m=>{
    const league=String(m.league||'').toLowerCase();
    if(psgCompetition==='ligue1')return /ligue 1|ligue 1 mcdonald/i.test(league);
    if(psgCompetition==='ucl')return /champions league|ligue des champions|uefa champions/i.test(league);
    return /coupe de france|french cup/i.test(league);
   });
   const card=m=>`<article class="event"><div class="event-top"><span class="tag">${escapeHtml(m.league||'PSG')}</span><span class="status">${escapeHtml(m.status)}</span></div><div class="event-main"><div class="teams">${escapeHtml(m.home)}<br>${escapeHtml(m.away)}</div><div class="score">${m.homeScore ?? '—'} - ${m.awayScore ?? '—'}<small>${escapeHtml(m.round||m.league||'')}</small></div></div><div class="event-foot"><span>${m.startTime?new Date(m.startTime).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Horaire non communiqué'}</span></div></article>`;
   let body='';
   if(psgCompetition==='ligue1'||psgCompetition==='ucl'){
    const table=psgStandings?.[psgCompetition];
    body=table?.rows?.length?`<section class="padel-tournament psg-standings"><header><span class="padel-tournament-kicker">CLASSEMENT · SAISON 2026/27</span><h3>${escapeHtml(table.name)}</h3></header><div class="psg-table-wrap" style="overflow-x:auto"><table class="psg-table" style="width:100%;border-collapse:collapse;white-space:nowrap;font-size:12px"><thead><tr><th>#</th><th style="text-align:left">ÉQUIPE</th><th>J</th><th>G</th><th>N</th><th>P</th><th>BP</th><th>BC</th><th>+/-</th><th>PTS</th></tr></thead><tbody>${table.rows.map(r=>`<tr class="${/paris.?sg|paris saint-germain/i.test(r.team)?'psg-highlight':''}" style="${/paris.?sg|paris saint-germain/i.test(r.team)?'font-weight:800;background:rgba(40,100,210,.12)':''}"><td style="padding:9px 6px">${r.position}</td><td style="text-align:left;padding:9px 6px">${r.image?`<img src="${escapeHtml(r.image)}" alt="" loading="lazy" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;margin-right:6px">`:''}${escapeHtml(r.team)}</td><td>${r.played??'—'}</td><td>${r.wins??'—'}</td><td>${r.draws??'—'}</td><td>${r.losses??'—'}</td><td>${r.for??'—'}</td><td>${r.against??'—'}</td><td>${r.diff==null?'—':(r.diff>0?'+':'')+r.diff}</td><td><b>${r.points??'—'}</b></td></tr>`).join('')}</tbody></table></div><a class="psg-source-link" style="display:inline-block;margin-top:12px" href="${table.sourceUrl}" target="_blank" rel="noopener">Voir aussi sur L’Équipe ↗</a></section>`:
     psgStandingsLoading?'<div class="empty">Chargement du classement…</div>':`<div class="empty">${escapeHtml(psgStandingsError||'Classement pas encore disponible.')}</div>`;
   }else if(psgCompetition==='cdf'){
    body=`<section class="padel-tournament"><header><span class="padel-tournament-kicker">COMPÉTITION À ÉLIMINATION DIRECTE</span><h3>Coupe de France</h3><span class="padel-count">Pas de classement général</span></header><a class="psg-source-link" href="https://www.lequipe.fr/Football/Coupe-de-France/" target="_blank" rel="noopener">Calendrier et résultats sur L’Équipe ↗</a></section>`;
   }
   if(matches.length)body+='<p class="eyebrow">'+(psgCompetition==='all'?'MATCHS DU PSG':'MATCHS DE LA COMPÉTITION')+'</p>'+matches.sort((a,b)=>String(b.startTime||'').localeCompare(String(a.startTime||''))).map(card).join('');
   else if(psgCompetition!=='cdf')body+='<div class="empty">Aucun match trouvé dans cette compétition pour le moment.</div>';
   if(psgCompetition==='all'&&psgError)body+=`<div class="empty">${escapeHtml(psgError)}</div>`;
   return nav+body;
  }
  return `<article class="event"><div class="event-top"><span class="tag">${x.tag}</span><span class="status">${x.status}</span></div><div class="event-main"><div class="teams">${x.left}<br>${x.right}</div><div class="score">${x.score}<small>Pas de score connecté</small></div></div><div class="event-foot"><span>${x.detail}<br><b>${x.tv}</b></span><button class="add-event" data-title="${x.tag}: ${x.left} - ${x.right}">+ CALENDRIER</button></div></article>`;
 }).join('')||'<div class="empty">Aucun événement dans cette rubrique pour le moment.</div>';
 document.querySelectorAll('.add-event').forEach(b=>b.addEventListener('click',()=>downloadICS(b.dataset.title)));
 document.querySelectorAll('[data-padel-view]').forEach(b=>b.addEventListener('click',()=>{padelView=b.dataset.padelView;render();if(padelView==='rankings'&&!padelRankings&&!padelRankingLoading)loadPadelRankings()}));
 document.querySelectorAll('[data-psg-competition]').forEach(b=>b.addEventListener('click',()=>{psgCompetition=b.dataset.psgCompetition;render();if((psgCompetition==='ligue1'||psgCompetition==='ucl')&&!psgStandings&&!psgStandingsLoading)loadPsgCompetitions()}));
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
 ['Mexico Major','2026-11-23','2026-11-29','Acapulco, Mexique','Major']
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
function f1Photo(driver){
 return driver.photo? `<img class="f1-photo" src="${escapeHtml(driver.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<div class="f1-photo f1-photo-empty">${escapeHtml(driver.acronym||'F1')}</div>`;
}
function renderF1Standings(){
 const drivers=f1Data?.drivers?.length?f1Data.drivers:f1FallbackDrivers;
 const teams=f1Data?.teams?.length?f1Data.teams:f1FallbackTeams;
 const switcher=`<div class="padel-gender"><button data-f1-standing="drivers" class="${f1StandingMode==='drivers'?'active':''}">PILOTES</button><button data-f1-standing="teams" class="${f1StandingMode==='teams'?'active':''}">CONSTRUCTEURS</button></div>`;
 if(f1StandingMode==='teams') return switcher+`<div class="ranking-list f1-ranking-list">${teams.map(t=>`<div class="ranking-row f1-team-row"><b class="ranking-position">#${t.position??'—'}</b><span class="f1-team-mark"></span><span class="ranking-name">${escapeHtml(t.name)}</span><strong>${Number(t.points||0).toLocaleString('fr-FR')} pts</strong></div>`).join('')}</div><p class="data-note">Championnat du monde des constructeurs · Saison 2026</p>`;
 return switcher+`<div class="ranking-list f1-ranking-list">${drivers.map(d=>`<div class="ranking-row f1-driver-row"><b class="ranking-position">#${d.position??'—'}</b>${f1Photo(d)}<span class="ranking-name"><b>${escapeHtml(d.name)}</b><small>${escapeHtml(d.team||'Écurie')}</small></span><strong>${Number(d.points||0).toLocaleString('fr-FR')} pts</strong></div>`).join('')}</div><p class="data-note">Championnat du monde des pilotes · Saison 2026</p>`;
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
function renderF1(){
 const showGrid=!!f1Data?.qualifyingPassed;
 if(f1View==='grid'&&!showGrid) f1View='program';
 const tabs=[['program','PROGRAMME'],['standings','CLASSEMENT'],...(showGrid?[['grid','GRILLE DE DÉPART']]:[])];
 let body=f1View==='standings'?renderF1Standings():f1View==='grid'?renderF1Grid():renderF1Program();
 return `<div class="f1-tabs">${tabs.map(([id,label])=>`<button data-f1-view="${id}" class="${f1View===id?'active':''}">${label}</button>`).join('')}</div>${body}`+(f1Error?'<p class="data-note">Certaines données F1 sont momentanément indisponibles.</p>':'');
}
async function loadF1(){
 try{
  const response=await fetch('/.netlify/functions/f1-live',{cache:'no-store'});
  const result=await response.json();
  if(!response.ok) throw new Error(result.message||'Données F1 indisponibles');
  f1Data=result;f1Error='';
 }catch(error){f1Error=error.message||'Connexion F1 impossible';}
 render();
}

function renderAnnualCalendar(){
 const psgEvents=[...psgRecent,...psgUpcoming].filter((m,i,arr)=>arr.findIndex(x=>String(x.id)===String(m.id))===i).map(m=>({sport:'psg',name:`${m.home} – ${m.away}`,start:(m.startTime||'').slice(0,10),time:m.startTime,place:m.league||'PSG',detail:m.status,score:m.homeScore==null?'':`${m.homeScore}–${m.awayScore}`}));
 const now=new Date();const todayKey=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const f1SessionEvents=f1AnnualEvents.flatMap(gp=>gp.sessions.map(s=>({sport:'f1',name:gp.flag+' '+gp.name+' — '+s.name,start:s.date,time:s.time,place:gp.place,detail:s.name})));
 const all=[...psgEvents,...padelAnnualEvents,...f1SessionEvents].filter(e=>e.start&&e.start>=todayKey&&(e.end?e.end>=todayKey:true)).sort((a,b)=>a.start.localeCompare(b.start));
 const filtered=calendarFilter==='all'?all:all.filter(e=>e.sport===calendarFilter);
 const filters=[['all','TOUT'],['psg','PSG'],['padel','PADEL'],['f1','F1']];
 const monthNames=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
 const grouped=new Map();
 for(const e of filtered){const d=new Date(e.start+'T12:00:00');const key=monthNames[d.getMonth()];if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(e);}
 const blocks=[...grouped.entries()].map(([month,items])=>`<section class="annual-month"><h3>${month} 2026</h3>${items.map(e=>{const d=new Date(e.start+'T12:00:00');const date=d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});const end=e.end&&e.end!==e.start?' – '+new Date(e.end+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}):'';const label=e.sport==='psg'?'⚽ PSG':e.sport==='padel'?'🎾 PADEL':'🏎️ F1';const sub=e.sport==='psg'?[e.place,e.time?new Date(e.time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'',e.score].filter(Boolean).join(' · '):[e.place,e.detail,e.time].filter(Boolean).join(' · ');return `<article class="annual-event"><div class="annual-date"><b>${date}</b><small>${end}</small></div><div class="annual-info"><span>${label}</span><b>${escapeHtml(e.name)}</b><small>${escapeHtml(sub)}</small></div></article>`}).join('')}</section>`).join('');
 return `<div class="calendar-filters">${filters.map(([id,label])=>`<button data-calendar-filter="${id}" class="${calendarFilter===id?'active':''}">${label}</button>`).join('')}</div>${blocks||'<div class="empty">Aucune date disponible pour ce filtre.</div>'}<p class="data-note">Les matchs du PSG proviennent du flux de résultats. Le calendrier Padel et F1 correspond au programme 2026 publié.</p>`;
}
function renderPadel(){
 const nav=`<div class="padel-tabs"><button data-padel-view="live" class="${padelView==='live'?'active':''}">EN DIRECT</button><button data-padel-view="schedule" class="${padelView==='schedule'?'active':''}">JOURNÉE PAR JOURNÉE</button><button data-padel-view="rankings" class="${padelView==='rankings'?'active':''}">CLASSEMENTS FIP</button></div>`;
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
   return `<section class="padel-tournament"><header><span class="padel-tournament-kicker">PREMIER PADEL</span><h3>${escapeHtml(name)}</h3><span class="padel-count">${matches.length} match${matches.length>1?'s':''}</span></header>${dayBlocks}</section>`;
  }).join('');
 };
 let body='';
 if(padelView==='live'){
  const rows=rowsFor(padelData.live);
  body=rows.length?tournamentGroups(rows):'<div class="empty">Aucun match Major, P1 ou P2 en direct actuellement.</div>';
 }else if(padelView==='schedule'){
  const rows=rowsFor(padelData.matches);
  const today=new Date().toISOString().slice(0,10);
  const nextTournaments=padelAnnualEvents.filter(e=>e.end>=today);
  const tournamentCalendar=nextTournaments.length?`<div class="padel-upcoming"><p class="eyebrow">PROCHAINS TOURNOIS</p>${nextTournaments.map(e=>`<article class="padel-upcoming-card"><div><b>${escapeHtml(e.name)}</b><small>${new Date(e.start+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} – ${new Date(e.end+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} · ${escapeHtml(e.place)}</small></div><strong>${escapeHtml(e.detail)}</strong></article>`).join('')}</div>`:'';
  body=tournamentCalendar+(rows.length?tournamentGroups(rows):'<div class="empty">Les tableaux et horaires détaillés seront affichés à leur publication.</div>');
 }else{
  const rows=padelRankings?.[padelGender]||[];
  body=`<div class="padel-gender"><button data-padel-gender="men" class="${padelGender==='men'?'active':''}">HOMMES</button><button data-padel-gender="women" class="${padelGender==='women'?'active':''}">FEMMES</button></div>`+
   (rows.length?`<div class="ranking-list">${rows.map(r=>`<div class="ranking-row"><b class="ranking-position">#${r.position??'—'}</b>${r.image?`<img class="ranking-photo" src="${escapeHtml(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<div class="ranking-photo ranking-photo-empty">👤</div>'}<span class="ranking-name">${escapeHtml(r.name)}${r.country?`<small>${escapeHtml(r.country)}</small>`:''}</span><strong>${r.points==null?'—':Number(r.points).toLocaleString('fr-FR')+' pts'}</strong></div>`).join('')}</div>`:padelRankingLoading?'<div class="empty">Chargement des classements officiels FIP…</div>':`<div class="empty">${escapeHtml(padelRankingError||'Classement indisponible pour le moment.')}</div>`);
 }
 return nav+body+`<p class="data-note">Tournois affichés : Major · P1 · P2 | Actualisation toutes les 10 min</p>`;
}
async function loadPadelRankings(){
 padelRankingLoading=true;padelRankingError='';render();
 try{
  const response=await fetch('/.netlify/functions/padel-rankings',{cache:'no-store'});
  const result=await response.json();
  if(!response.ok) throw new Error(result.message||'Classements FIP indisponibles');
  padelRankings=result.rankings;
 }catch(error){padelRankingError=error.message||'Connexion FIP impossible';}
 finally{padelRankingLoading=false;render();}
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

document.querySelectorAll('.sport').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.sport').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.sport;if(filter==='psg'&&!psgStandings&&!psgStandingsLoading)loadPsgCompetitions();document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('.bottom-nav button:first-child').classList.add('selected');render()}));
const now=new Date();document.querySelector('#today').textContent=new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short'}).format(now).toUpperCase();
function toast(s){const t=document.querySelector('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000)}
function downloadICS(title){const start=new Date(Date.now()+86400000);start.setHours(19,0,0,0);const end=new Date(start.getTime()+90*60000);const fmt=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const esc=s=>s.replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;');const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sport Live//FR\r\nBEGIN:VEVENT\r\nUID:${Date.now()}@sportlive\r\nDTSTAMP:${fmt(new Date())}\r\nDTSTART:${fmt(start)}\r\nDTEND:${fmt(end)}\r\nSUMMARY:${esc(title)}\r\nDESCRIPTION:Horaire fictif de démonstration. À remplacer par le calendrier officiel.\r\nEND:VEVENT\r\nEND:VCALENDAR`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='sport-live-evenement.ics';a.click();URL.revokeObjectURL(a.href);toast('Fichier calendrier créé. Ouvre-le pour l’ajouter à Calendrier.');}
document.querySelector('#calendarBtn').onclick=()=>downloadICS('SPORT LIVE - événement à compléter');document.querySelector('#navCalendar').onclick=()=>{filter='calendar';document.querySelectorAll('.sport').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('#navCalendar').classList.add('selected');render();};
document.querySelector('#notifyBtn').onclick=async()=>{if(!('Notification'in window)){toast('Notifications non prises en charge par ce navigateur.');return}if(!('serviceWorker'in navigator)){toast('Installe d’abord Sport Live sur l’écran d’accueil.');return}try{const p=await Notification.requestPermission();document.querySelector('#notifyState').textContent=p==='granted'?'Autorisation accordée':'Autorisation non accordée';toast(p==='granted'?'Autorisation accordée. Les alertes nécessitent encore un service push.':'Autorisation non accordée.')}catch(e){toast('Impossible d’activer les notifications.')}};
document.querySelector('#installHint').onclick=()=>toast('Dans Safari : Partager → Sur l’écran d’accueil → Ajouter.');document.querySelector('#navLive').onclick=()=>{filter='all';document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('#navLive').classList.add('selected');document.querySelector('[data-sport="all"]').click();toast('Affichage de tous les sports. Les flux live restent à connecter.')};document.querySelector('#navNews').onclick=()=>{filter='all';document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('selected'));document.querySelector('#navNews').classList.add('selected');document.querySelector('.news-head').scrollIntoView({behavior:'smooth'});};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));render();loadPsgLive();loadPadel();loadF1();setInterval(loadPsgLive,300000);setInterval(loadPadel,600000);setInterval(loadF1,600000);