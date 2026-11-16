let cachedPayload=null,cacheExpiresAt=0,pending=null;
const API="https://api.sportsapi.app/v2";
const json=async(url,headers)=>{const r=await fetch(url,{headers});const b=await r.json();if(!r.ok)throw new Error(b?.error?.message||"SportsAPI HTTP "+r.status);return b.data;};
const mapRows=data=>(Array.isArray(data)?data:[]).map(r=>({
 position:r.position,team:r.team?.name||r.name||"Équipe",image:r.team?.image||null,
 played:r.played??null,wins:r.wins??null,draws:r.draws??null,losses:r.losses??null,
 for:r.scoresFor??null,against:r.scoresAgainst??null,diff:r.scoreDifference??null,points:r.points??null
}));
export default async()=>{
 if(cachedPayload&&Date.now()<cacheExpiresAt)return Response.json(cachedPayload,{headers:{"Cache-Control":"public, max-age=3600"}});
 if(!pending)pending=(async()=>{
  const key=process.env.SPORTSAPI_API_KEY;if(!key)throw new Error("Clé SportsAPI absente de Netlify.");
  const headers={Authorization:"Bearer "+key,Accept:"application/json"};
  const found=await json(API+"/search?q=Paris%20Saint-Germain&type=team",headers);
  const team=(Array.isArray(found)?found:[]).find(t=>t.sport==="football"&&/paris saint-germain|paris sg/i.test(t.name||""));
  if(!team?.id)throw new Error("Club PSG introuvable dans SportsAPI.");
  const seasons=await json(API+"/teams/"+team.id+"/standings/seasons",headers);
  const entries=Array.isArray(seasons)?seasons:[];
  const pick=(re)=>entries.find(e=>re.test(String(e.league?.name||"")));
  const l1=pick(/ligue\s*1/i),ucl=pick(/champions league|ligue des champions/i);
  const latest=e=>(Array.isArray(e?.seasons)?e.seasons:[]).find(s=>s?.id)||null;
  const [l1Table,uclTable]=await Promise.all([
   l1&&latest(l1)?json(API+"/leagues/"+l1.league.id+"/standings?season="+latest(l1).id,headers):Promise.resolve([]),
   ucl&&latest(ucl)?json(API+"/leagues/"+ucl.league.id+"/standings?season="+latest(ucl).id,headers):Promise.resolve([])
  ]);
  return{
   ligue1:l1?{name:l1.league.name,rows:mapRows(l1Table),sourceUrl:"https://www.lequipe.fr/Football/ligue-1/page-classement-equipes/general"}:null,
   ucl:ucl?{name:ucl.league.name,rows:mapRows(uclTable),sourceUrl:"https://www.lequipe.fr/Football/ligue-des-champions/page-classement-equipes/general"}:null,
   checkedAt:new Date().toISOString()
  };
 })();
 try{const data=await pending;cachedPayload=data;cacheExpiresAt=Date.now()+6*60*60*1000;return Response.json(data,{headers:{"Cache-Control":"public, max-age=3600"}});}
 catch(e){return Response.json({error:"psg_competitions_error",message:e.message||"Classements indisponibles."},{status:502});}
 finally{pending=null;}
};
