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
  const headers={"Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Language":"fr-FR,fr;q=0.9,en-US;q=0.8","User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36","Referer":"https://www.padelfip.com/","Cache-Control":"no-cache"};
  let html="",lastError="";
  for(const url of ["https://www.padelfip.com/fip-rankings/","https://padelfip.com/fip-rankings/"]){
   try{const r=await fetch(url,{headers});if(!r.ok){lastError="Site officiel FIP HTTP "+r.status;continue;}html=await r.text();if(html.length>1000)break;}catch(e){lastError=e.message;}
  }
  let rankings=html?{men:parseGender(html,"Men"),women:parseGender(html,"Women")}:{men:[],women:[]};
  if(!rankings.men.length||!rankings.women.length){
   try{
    const proxy=await fetch("https://r.jina.ai/http://www.padelfip.com/fip-rankings/",{headers:{"Accept":"text/plain","User-Agent":"SportLive/1.0"}});
    if(proxy.ok){
     const text=await proxy.text();
     const parseRows=gender=>{
      const lines=text.split(String.fromCharCode(10));let active=false;const section=[];
      for(const line of lines){
       const heading=line.trim().replaceAll("#","").trim().toLowerCase();
       if(heading==="men"){active=gender==="men";continue;}
       if(heading==="women"){active=gender==="women";continue;}
       if(active)section.push(line);
      }
      const out=[],seen=new Set();
      for(const line of section){
       const cells=line.split("|").map(x=>x.replaceAll("*","").replaceAll("_","").replaceAll("[","").replaceAll("]","").trim()).filter(Boolean);
       if(cells.length<4)continue;
       const pos=Number(cells[0].replace(/[^0-9]/g,""));
       const name=(cells[1]||"").replace("Image: Photo of","").trim();
       const country=(cells[2]||"").match(/[A-Z]{3}/)?.[0]||null;
       const points=Number((cells[3]||"").replace(/[^0-9]/g,""));
       if(pos>0&&name&&points>0&&!seen.has(name.toLowerCase())){out.push({position:pos,name,country,points,image:null});seen.add(name.toLowerCase());}
      }
      if(out.length<5){
       const flat=section.join(" ").replace(/\s+/g," ");
       const pattern=/(?:^|\s)(\d{1,3})\s+([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÿ.'’ -]{2,}?)\s+([A-Z]{3})\s+(?:Points\s*)?([\d, ]{2,})/g;
       for(const match of flat.matchAll(pattern)){
        const pos=Number(match[1]),name=match[2].trim(),country=match[3],points=Number(match[4].replace(/[^0-9]/g,""));
        if(pos>0&&name&&points>0&&!seen.has(name.toLowerCase())){out.push({position:pos,name,country,points,image:null});seen.add(name.toLowerCase());}
       }
      }
      return out.sort((a,b)=>a.position-b.position).slice(0,100);
     };
     rankings={men:parseRows("men"),women:parseRows("women")};
    }
   }catch(e){lastError=e.message;}
  }
  if(!rankings.men.length||!rankings.women.length)throw new Error(lastError||"Le classement officiel FIP reste inaccessible (HTTP 403).");
  return{rankings,source:"FIP officiel",sourceUrl:"https://www.padelfip.com/fip-rankings/",checkedAt:new Date().toISOString()};
 })();
 try{const p=await pendingRequest;cachedPayload=p;cacheExpiresAt=Date.now()+12*60*60*1000;return Response.json(p,{headers:{"Cache-Control":"public, max-age=3600"}});}
 catch(e){return Response.json({error:"fip_rankings_error",message:e.message||"Classements FIP indisponibles."},{status:502});}
 finally{pendingRequest=null;}
};
