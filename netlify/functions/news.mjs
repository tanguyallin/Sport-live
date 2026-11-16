let cachedPayload=null;
let cacheExpiresAt=0;
let pendingRequest=null;
const SOURCES=[
 {sport:"psg",name:"L'Équipe",url:"https://dwh.lequipe.fr/api/edito/rss?path=/",match:/paris.?sg|paris saint-germain|demb[eé]l[eé]|barcola|marquinhos|vitinha|dou[eé]|hakimi|don[nn]arumma|safonov|luis enrique/i},
 {sport:"psg",name:"RMC Sport",url:"https://rmcsport.bfmtv.com/rss/football/",match:/paris.?sg|paris saint-germain|demb[eé]l[eé]|barcola|marquinhos|vitinha|dou[eé]|hakimi|don[nn]arumma|safonov|luis enrique/i},
 {sport:"psg",name:"Maxifoot",url:"https://rss.maxifoot.com/football-general.xml",match:/paris.?sg|paris saint-germain|demb[eé]l[eé]|barcola|marquinhos|vitinha|dou[eé]|hakimi|don[nn]arumma|safonov|luis enrique/i},
 {sport:"padel",name:"Padel Magazine",url:"https://padelmagazine.fr/feed/",match:/./},
 {sport:"f1",name:"Motorsport.com",url:"https://fr.motorsport.com/rss/f1/news/",match:/formule 1|\bf1\b|grand prix|pilote|écurie|verstappen|hamilton|leclerc|norris|antonelli|gasly|piastri|ferrari|mercedes|red bull|mclaren|alpine/i},
 {sport:"f1",name:"Paddock GP",url:"https://www.paddock-gp.com/feed/",match:/formule 1|\bf1\b|grand prix|pilote|écurie|verstappen|hamilton|leclerc|norris|antonelli|gasly|piastri|ferrari|mercedes|red bull|mclaren|alpine/i}
];
function decodeXml(s=""){
 return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
}
function tag(block,name){
 const re=new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i");
 const m=block.match(re);return m?decodeXml(m[1]).trim():"";
}
function cleanText(s=""){
 return decodeXml(s.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ")).trim().slice(0,360);
}
function parseFeed(xml,source){
 const blocks=[...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(m=>m[2]);
 return blocks.map(block=>{
  const title=tag(block,"title");
  let url=tag(block,"link");
  if(!url){const m=block.match(/<link[^>]+href=["']([^"']+)["']/i);url=m?.[1]||tag(block,"guid");}
  if(url.startsWith("//"))url="https:"+url;
  const date=tag(block,"pubDate")||tag(block,"published")||tag(block,"updated")||tag(block,"dc:date");
  const raw=tag(block,"description")||tag(block,"summary")||tag(block,"content:encoded");
  const description=cleanText(raw);
  const image=block.match(/<media:content[^>]+url=["']([^"']+)/i)?.[1]||block.match(/<enclosure[^>]+url=["']([^"']+)/i)?.[1]||raw.match(/<img[^>]+src=["']([^"']+)/i)?.[1]||null;
  return {sport:source.sport,source:source.name,title:cleanText(title),url,date:date&&Number.isFinite(Date.parse(date))?new Date(date).toISOString():null,description,image};
 }).filter(a=>a.title&&/^https?:\/\//i.test(a.url||"")&&source.match.test(a.title+" "+a.description));
}
export default async()=>{
 if(cachedPayload&&Date.now()<cacheExpiresAt)return Response.json(cachedPayload,{headers:{"Cache-Control":"public, max-age=300"}});
 if(!pendingRequest){
  pendingRequest=(async()=>{
   const results=await Promise.all(SOURCES.map(async source=>{
    try{const response=await fetch(source.url,{headers:{Accept:"application/rss+xml, application/atom+xml, application/xml, text/xml"}});if(!response.ok)throw new Error("HTTP "+response.status);return parseFeed(await response.text(),source);}
    catch{return [];}
   }));
   const seen=new Set();
   const articles=results.flat().filter(a=>{if(seen.has(a.url))return false;seen.add(a.url);return true;}).sort((a,b)=>(Date.parse(b.date||"")||0)-(Date.parse(a.date||"")||0)).slice(0,60);
   return {articles,updatedAt:new Date().toISOString(),sources:SOURCES.map(s=>({sport:s.sport,name:s.name,url:s.url}))};
  })();
 }
 try{const payload=await pendingRequest;cachedPayload=payload;cacheExpiresAt=Date.now()+10*60*1000;return Response.json(payload,{headers:{"Cache-Control":"public, max-age=300"}});}
 catch(error){return Response.json({error:"news_error",message:error.message||"Flux d'actualités indisponibles."},{status:502});}
 finally{pendingRequest=null;}
};