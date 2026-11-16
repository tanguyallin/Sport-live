const examples=[
 {sport:'padel',tag:'PADEL · HOMMES',status:'EXEMPLE',left:'Paire A',right:'Paire B',score:'—',detail:'Major / P1 / P2 · Tableau principal',tv:'Diffusion à confirmer'},
 {sport:'psg',tag:'PARIS SAINT-GERMAIN',status:'À VENIR',left:'PSG',right:'Adversaire',score:'—',detail:'Prochain match · Horaire à confirmer',tv:'Chaîne à confirmer'},
 {sport:'f1',tag:'FORMULE 1',status:'À VENIR',left:'Prochain Grand Prix',right:'Programme',score:'—',detail:'Essais · Qualifications · Course',tv:'Diffuseur à confirmer'},

];
const events=document.querySelector('#events');let filter='all';let psgLive=[];let psgUpcoming=[];let psgRecent=[];let psgError='';let padelData=null;let padelError='';let padelView='live';let padelGender='men';
function render(){
 const rows=examples.filter(x=>filter==='all'||x.sport===filter);
 events.innerHTML=rows.map(x=>{
  if(x.sport==='padel') return renderPadel();
  if(x.sport==='psg'){
   if(psgError){
    return `<article class="event"><div class="event-top"><span class="tag">${x.tag}</span><span class="status">ERREUR API</span></div><div class="event-main"><div class="teams">Paris Saint-Germain</div><div class="score">—<small>Connexion indisponible</small></div></div><div class="event-foot"><span>${escapeHtml(psgError)}</span></div></article>`;
   }
   const card=(m,label)=>`<article class="event"><div class="event-top"><span class="tag">${label}</span><span class="status">${escapeHtml(m.status)}</span></div><div class="event-main"><div class="teams">${escapeHtml(m.home)}<br>${escapeHtml(m.away)}</div><div class="score">${m.homeScore ?? '—'} - ${m.awayScore ?? '—'}<small>${escapeHtml(m.league)}</small></div></div><div class="event-foot"><span>${m.startTime?new Date(m.startTime).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Horaire non communiqué'}</span></div></article>`;
   const sections=[];
   if(psgLive.length) sections.push(psgLive.map(m=>card(m,'PSG · EN DIRECT')).join(''));
   if(psgUpcoming.length) sections.push('<p class="eyebrow">PROCHAIN MATCH</p>'+card(psgUpcoming[0],'PSG · À VENIR'));
   if(psgRecent.length) sections.push('<p class="eyebrow">DERNIERS RÉSULTATS</p>'+psgRecent.slice(0,3).map(m=>card(m,'PSG · TERMINÉ')).join(''));
   if(!sections.length) sections.push('<article class="event"><div class="event-top"><span class="tag">PARIS SAINT-GERMAIN</span><span class="status">À JOUR</span></div><div class="event-main"><div class="teams">Aucun match trouvé</div><div class="score">—<small>Le calendrier sera actualisé automatiquement.</small></div></div></article>');
   return sections.join('');
  }
  return `<article class="event"><div class="event-top"><span class="tag">${x.tag}</span><span class="status">${x.status}</span></div><div class="event-main"><div class="teams">${x.left}<br>${x.right}</div><div class="score">${x.score}<small>Pas de score connecté</small></div></div><div class="event-foot"><span>${x.detail}<br><b>${x.tv}</b></span><button class="add-event" data-title="${x.tag}: ${x.left} - ${x.right}">+ CALENDRIER</button></div></article>`;
 }).join('')||'<div class="empty">Aucun événement dans cette rubrique pour le moment.</div>';
 document.querySelectorAll('.add-event').forEach(b=>b.addEventListener('click',()=>downloadICS(b.dataset.title)));
 document.querySelectorAll('[data-padel-view]').forEach(b=>b.addEventListener('click',()=>{padelView=b.dataset.padelView;render()}));
 document.querySelectorAll('[data-padel-gender]').forEach(b=>b.addEventListener('click',()=>{padelGender=b.dataset.padelGender;render()}));
}

function renderPadel(){
 const nav=`<div class="padel-tabs"><button data-padel-view="live" class="${padelView==='live'?'active':''}">EN DIRECT</button><button data-padel-view="schedule" class="${padelView==='schedule'?'active':''}">PROGRAMME & RÉSULTATS</button><button data-padel-view="rankings" class="${padelView==='rankings'?'active':''}">CLASSEMENTS FIP</button></div>`;
 if(padelError) return nav+`<div class="empty">Connexion Padel indisponible : ${escapeHtml(padelError)}</div>`;
 if(!padelData) return nav+'<div class="empty">Chargement des données Premier Padel…</div>';
 const matchCard=m=>{
  const sets=Object.keys(m.homeSets||{}).sort().map(k=>`${m.homeSets[k]}-${m.awaySets?.[k]??'—'}`).join('  ');
  const score=m.homeScore==null?'—':`${m.homeScore} - ${m.awayScore??'—'}`;
  const time=m.startTime?new Date(m.startTime).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Horaire non communiqué';
  return `<article class="event"><div class="event-top"><span class="tag">${escapeHtml(m.league)}${m.gender?' · '+escapeHtml(m.gender):''}</span><span class="status">${escapeHtml(m.status)}</span></div><div class="event-main"><div class="teams">${escapeHtml(m.home)}<br>${escapeHtml(m.away)}</div><div class="score">${score}<small>${sets||'Score par set non disponible'}</small></div></div><div class="event-foot"><span>${time}</span></div></article>`;
 };
 let body='';
 if(padelView==='live'){
  const rows=padelData.live||[];
  body=rows.length?rows.map(matchCard).join(''):'<div class="empty">Aucun match en direct actuellement. Les scores apparaîtront ici dès le début des rencontres.</div>';
 }else if(padelView==='schedule'){
  const rows=padelData.matches||[];
  const live=rows.filter(m=>m.statusType==='inprogress'||m.statusType==='break');
  const upcoming=rows.filter(m=>m.statusType==='scheduled'||m.statusType==='notstarted'||m.statusType==='created');
  const finished=rows.filter(m=>m.statusType==='finished');
  body=(live.length?'<p class="eyebrow">EN COURS</p>'+live.map(matchCard).join(''):'')+
   (upcoming.length?'<p class="eyebrow">À VENIR</p>'+upcoming.map(matchCard).join(''):'')+
   (finished.length?'<p class="eyebrow">DERNIERS RÉSULTATS</p>'+finished.slice(-8).reverse().map(matchCard).join(''):'')+
   (!live.length&&!upcoming.length&&!finished.length?'<div class="empty">Aucun match trouvé sur les trois jours consultés.</div>':'');
 }else{
  const rows=padelData.rankings?.[padelGender]||[];
  body=`<div class="padel-gender"><button data-padel-gender="men" class="${padelGender==='men'?'active':''}">HOMMES</button><button data-padel-gender="women" class="${padelGender==='women'?'active':''}">FEMMES</button></div>`+
   (rows.length?`<div class="ranking-list">${rows.map(r=>`<div class="ranking-row"><b>#${r.position??'—'}</b><span>${escapeHtml(r.name)}</span><strong>${r.points==null?'—':Number(r.points).toLocaleString('fr-FR')+' pts'}</strong></div>`).join('')}</div>`:'<div class="empty">Classement indisponible pour le moment.</div>');
 }
 return nav+body+`<p class="data-note">Données SportsAPI · ${padelData.checkedAt?new Date(padelData.checkedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):''} · Actualisation toutes les 10 min</p>`;
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

document.querySelectorAll('.sport').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.sport').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.sport;render()}));
const now=new Date();document.querySelector('#today').textContent=new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short'}).format(now).toUpperCase();
function toast(s){const t=document.querySelector('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000)}
function downloadICS(title){const start=new Date(Date.now()+86400000);start.setHours(19,0,0,0);const end=new Date(start.getTime()+90*60000);const fmt=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const esc=s=>s.replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;');const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sport Live//FR\r\nBEGIN:VEVENT\r\nUID:${Date.now()}@sportlive\r\nDTSTAMP:${fmt(new Date())}\r\nDTSTART:${fmt(start)}\r\nDTEND:${fmt(end)}\r\nSUMMARY:${esc(title)}\r\nDESCRIPTION:Horaire fictif de démonstration. À remplacer par le calendrier officiel.\r\nEND:VEVENT\r\nEND:VCALENDAR`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='sport-live-evenement.ics';a.click();URL.revokeObjectURL(a.href);toast('Fichier calendrier créé. Ouvre-le pour l’ajouter à Calendrier.');}
document.querySelector('#calendarBtn').onclick=()=>downloadICS('SPORT LIVE - événement à compléter');document.querySelector('#navCalendar').onclick=()=>downloadICS('SPORT LIVE - événement à compléter');
document.querySelector('#notifyBtn').onclick=async()=>{if(!('Notification'in window)){toast('Notifications non prises en charge par ce navigateur.');return}if(!('serviceWorker'in navigator)){toast('Installe d’abord Sport Live sur l’écran d’accueil.');return}try{const p=await Notification.requestPermission();document.querySelector('#notifyState').textContent=p==='granted'?'Autorisation accordée':'Autorisation non accordée';toast(p==='granted'?'Autorisation accordée. Les alertes nécessitent encore un service push.':'Autorisation non accordée.')}catch(e){toast('Impossible d’activer les notifications.')}};
document.querySelector('#installHint').onclick=()=>toast('Dans Safari : Partager → Sur l’écran d’accueil → Ajouter.');document.querySelector('#navLive').onclick=()=>{filter='all';document.querySelector('[data-sport="all"]').click();toast('Affichage de tous les sports. Les flux live restent à connecter.')};document.querySelector('#navNews').onclick=()=>document.querySelector('.news-head').scrollIntoView({behavior:'smooth'});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));render();loadPsgLive();loadPadel();setInterval(loadPsgLive,300000);setInterval(loadPadel,600000);