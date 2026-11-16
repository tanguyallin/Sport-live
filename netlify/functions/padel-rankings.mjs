let cachedPayload = null;
let cacheExpiresAt = 0;
let pendingRequest = null;
function textOf(html) {
 return String(html).replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ")
 .replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
}
function imageOf(html) {
 const m=html.match(/<img\b[^>]*(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/i);
 if(!m)return null;let u=m[1].replace(/&amp;/g,"&");if(u.startsWith("//"))u="https:"+u;return /^https?:\/\//i.test(u)?u:null;
}
function parseTable(section) {
 const out=[];
 for(const row of section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1]);if(cells.length<3)continue;
  const v=cells.map(textOf),pos=Number(v[0].match(/\d+/)?.[0]),cell=cells.find((c,i)=>i>0&&/<img\b/i.test(c))||cells[1];
  const name=textOf(cell).replace(/^Photo of\s*/i,"").trim(),country=v.find(x=>/\b[A-Z]{3}\b/.test(x)&&x.length<12)?.match(/\b[A-Z]{3}\b/)?.[0]||null,points=Number(v[v.length-1].replace(/[^\d]/g,""));
  if(name&&pos>0&&points>0)out.push({position:pos,name,country,points,image:imageOf(cell)});
 }return out;
}
function parseCards(section) {
 const hs=[...section.matchAll(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>/gi)],out=[];
 for(let i=0;i<hs.length;i++){
  const name=textOf(hs[i][1]);if(!name||name.length<4||/^(men|women|filter|rank)$/i.test(name))continue;
  const start=hs[i].index,end=hs[i+1]?.index??Math.min(section.length,start+1500),tail=section.slice(start,end),before=textOf(section.slice(Math.max(0,start-300),start));
  const pos=Number(before.match(/(?:^|\s)(\d{1,2})\s*$/)?.[1]||textOf(tail).match(/(?:^|\s)(\d{1,2})(?:\s|$)/)?.[1]);
  const pts=Number((textOf(tail).match(/(?:points?|pts)\s*[:：]?\s*([\d\s,.]+)/i)?.[1]||"").replace(/[^\d]/g,"")),country=textOf(tail).match(/\b[A-Z]{3}\b/)?.[0]||null;
  if(pos>0&&pos<=10&&pts>0)out.push({position:pos,name,country,points:pts,image:imageOf(tail)});
 }return out;
}
function parseGender(html,gender) {
 const hs=[...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)],i=hs.findIndex(h=>new RegExp("^"+gender+"$","i").test(textOf(h[1])));
 if(i<0)return[];const start=hs[i].index,next=hs.slice(i+1).find(h=>/^(men|women)$/i.test(textOf(h[1]))),section=html.slice(start,next?.index??html.length),map=new Map();
 for(const p of [...parseCards(section),...parseTable(section)]){const k=p.name.toLowerCase();if(!map.has(k)||(!map.get(k).image&&p.image))map.set(k,p);}
 return [...map.values()].sort((a,b)=>a.position-b.position||b.points-a.points).slice(0,100);
}
export default async () => {
 if(cachedPayload&&Date.now()<cacheExpiresAt)return Response.json(cachedPayload,{headers:{"Cache-Control":"public, max-age=3600"}});
 if(!pendingRequest)pendingRequest=(async()=>{
  const r=await fetch("https://www.padelfip.com/fip-rankings/",{headers:{"Accept":"text/html","User-Agent":"SportLive/1.0"}});
  if(!r.ok)throw new Error("Site officiel FIP HTTP "+r.status);const html=await r.text();
  const rankings={men:parseGender(html,"Men"),women:parseGender(html,"Women")};
  if(!rankings.men.length||!rankings.women.length)throw new Error("Le format du classement FIP a changé ou les données ne sont pas accessibles.");
  return{rankings,source:"FIP officiel",sourceUrl:"https://www.padelfip.com/fip-rankings/",checkedAt:new Date().toISOString()};
 })();
 try{const p=await pendingRequest;cachedPayload=p;cacheExpiresAt=Date.now()+12*60*60*1000;return Response.json(p,{headers:{"Cache-Control":"public, max-age=3600"}});}
 catch(e){return Response.json({error:"fip_rankings_error",message:e.message||"Classements FIP indisponibles."},{status:502});}
 finally{pendingRequest=null;}
};
