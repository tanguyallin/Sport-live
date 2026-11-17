let cachedPayload=null,cacheExpiresAt=0,pending=null;
export default async()=>{
 if(cachedPayload&&Date.now()<cacheExpiresAt)return Response.json(cachedPayload,{headers:{'Cache-Control':'public, max-age=3600'}});
 if(!pending)pending=(async()=>{
  const key=process.env.SPORTSAPI_API_KEY;if(!key)throw new Error('Clé SportsAPI absente de Netlify.');
  const headers={Authorization:'Bearer '+key,Accept:'application/json'};
  const get=async url=>{const r=await fetch(url,{headers});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error?.message||'SportsAPI HTTP '+r.status);return b.data;};
  const found=await get('https://api.sportsapi.app/v2/search?q=Paris%20Saint-Germain&type=team');
  const team=(Array.isArray(found)?found:[]).find(t=>t.sport==='football'&&/paris saint-germain|paris sg/i.test(t.name||''));
  if(!team?.id)throw new Error('Club PSG introuvable dans SportsAPI.');
  const squad=await get('https://api.sportsapi.app/v2/teams/'+team.id+'/squad');
  const players=(Array.isArray(squad)?squad:[]).map(p=>({id:p.id,name:p.name,position:p.position||p.positionCode||null,heightCm:p.heightCm||null,dateOfBirth:p.dateOfBirth||null,image:p.image||null,appearances:p.appearances??p.statistics?.appearances??p.matchesPlayed??null})).sort((a,b)=>String(a.position||'').localeCompare(String(b.position||''))||a.name.localeCompare(b.name,'fr'));
  return {players,season:'2026/27',checkedAt:new Date().toISOString()};
 })();
 try{const data=await pending;cachedPayload=data;cacheExpiresAt=Date.now()+6*60*60*1000;return Response.json(data,{headers:{'Cache-Control':'public, max-age=3600'}});}
 catch(e){return Response.json({error:'psg_squad_error',message:e.message||'Effectif indisponible.'},{status:502});}
 finally{pending=null;}
}