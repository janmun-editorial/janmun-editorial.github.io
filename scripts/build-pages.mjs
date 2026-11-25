// Regenerate static SEO pages from index.html and js/news-data.js.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {dirname} from "node:path";
import vm from "node:vm";
function buildPages(source,news){
 const base="https://janmun-editorial.github.io/";
 const meta={home:["잔문 殘文 | 독립 문학 편집실","문학의 바깥을 읽는다. 읽히지 않던 문학을, 오래 남을 책으로. 독립 문학 편집실 잔문."],about:["설립의 말 | 잔문 殘文","창작 방식과 이력보다 작품을 대하는 태도를 중요하게 생각하는 잔문의 창립 철학."],editorial:["편집 철학 | 잔문 殘文","무엇을 남길 것인가. 소설의 문장, 인물, 구조와 작가의 고유한 시선을 존중하는 편집 철학."],ethics:["창작 윤리 | 잔문 殘文","AI 활용 여부와 관계없이 창작 과정의 정직함, 타인의 권리와 최종 원고에 대한 책임을 중요하게 생각한다."],members:["잔문 동인 | 온라인 문학 창작 공동체","원고 합평, 작품 연구와 문학 토론을 함께하는 잔문 동인. 첫 정기 모집 준비 중."],books:["잔문 총서 | 소설집 출간 프로젝트","엽편과 단편소설을 중심으로 한 잔문 총서 및 첫 공동 소설집 기획 안내. 출간 준비 중."],submission:["소설 투고 안내 | 잔문 殘文","소설 투고 자격, AI 활용 공개, 심사 및 편집, 출간 비용에 관한 안내. 현재 원고 접수 준비 중."],archive:["문학 아카이브 | 잔문 殘文","창립 문서, 문예지, 작가 기록, 편집 기록, 문학 비평과 출간 기록을 모으는 문학 아카이브."],news:["소식·공식 공지 | 잔문 殘文","잔문의 창립 준비, 동인 및 원고 모집, 출간, 행사와 운영에 관한 공식 안내."],saved:["나의 서재 | 잔문 殘文","브라우저에 저장된 읽기 목록, 문장 수집과 독서 메모를 확인하는 개인 공간."]};
 const labels={notice:"공지",members:"동인 모집",submission:"원고 모집",publication:"출간",events:"행사",operations:"운영"};
 const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
 const path=id=>id==="home"?"":id==="journal"?"archive/?category=journal":id+"/";
 const valid=new Set([...Object.keys(meta),"journal",...news.map(n=>"news/"+n.id)]);
 let master=source.replace(/^      <template data-janmun-view="[^"]+">\n([\s\S]*?)\n      <\/template>/gm,(_,v)=>v)
 .replace(/href="[^"]*" data-route-link="([^"]+)"/g,(_,id)=>`href="#${id}"`)
 .replace(/(href|src)="(?:\.\/|\.\.\/)+(assets\/|css\/|js\/)/g,(_,a,p)=>`${a}="${p}`)
 .replace(/ data-site-root="[^"]*"| data-start-route="[^"]*"/g,"")
 .replace(/^    <!-- JANMUN SEO BEGIN -->[\s\S]*?^    <!-- JANMUN SEO END -->\n/gm,"")
 .replace(/^    <title>[^<]*<\/title>\n/gm,"")
 .replace(/^    <meta name="description"[^>]*>\n/gm,"")
 .replace(/js\/main\.js\?v=[^"]+/,"js/main.js?v=1.1.1");
 const docs=[["about","01","설립의 말","문학의 바깥을 읽는 이유"],["editorial","02","편집 철학","무엇을 남길 것인가."],["ethics","03","창작 윤리","완벽함이 아니라 정직함."],["members","04","잔문 동인","서로의 가장 이른 독자이자, 가장 오래 남는 독자로."]];
 const rows=docs.map(([id,num,t,s])=>`<div class="archive-row"><span class="eyebrow">${num}</span><a href="#${id}"><span class="archive-record-meta">창립 문서 · 잔문 · 등록 2026-11-24</span><h3>${esc(t)}</h3><p>${esc(s)}</p></a></div>`).join("");
 const pins=news.filter(n=>n.pinned).map(n=>`<div class="notice-pin"><span class="eyebrow">중요 공지</span><a class="notice-pin-title" href="#news/${esc(n.id)}">${esc(n.title)}</a><p>${esc(n.body[0])}</p><span class="notice-date">${esc(n.date)}</span></div>`).join("");
 const list=news.filter(n=>!n.pinned).sort((a,b)=>b.date.localeCompare(a.date)).map(n=>`<div class="notice-row"><span class="notice-category">${esc(labels[n.category])}</span><a class="notice-row-title" href="#news/${esc(n.id)}">${esc(n.title)}</a><span class="notice-state">${esc(n.status)}</span><time class="notice-date" datetime="${esc(n.date)}">${esc(n.date)}</time></div>`).join("");
 function fill(id,cls,content){const begin=`<!-- STATIC ${id} BEGIN -->`,end=`<!-- STATIC ${id} END -->`;if(master.includes(begin)){master=master.replace(new RegExp(begin+"[\\s\\S]*?"+end),()=>begin+content+end);return;}const re=new RegExp(`<div (?:id="${id}" class="${cls}"|class="${cls}" id="${id}")></div>`);if(!re.test(master))throw Error("missing "+id);master=master.replace(re,()=>`<div id="${id}" class="${cls}">${begin}${content}${end}</div>`)}
 fill("archive-list","archive-list",rows);fill("news-pinned","notice-pinned",pins);fill("news-list","notice-list",list);
 const files={};
 for(const route of [...Object.keys(meta),...news.map(n=>"news/"+n.id)]){
  const detail=route.startsWith("news/")?news.find(n=>"news/"+n.id===route):null,id=detail?"news":route,prefix=route==="home"?"./":detail?"../../":"../",url=base+path(route);
  const [title,desc]=detail?[detail.title+" | 잔문 殘文",detail.body[0].slice(0,155)]:meta[route];
  const graph=route==="home"?{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":base+"#organization","name":"잔문 殘文","alternateName":"JANMUN","url":base,"logo":base+"assets/janmun-mark.svg","description":"독립 문학 편집실 · 창립 준비"},{"@type":"WebSite","@id":base+"#website","name":"잔문 殘文","url":base,"inLanguage":"ko","publisher":{"@id":base+"#organization"}}]}:{"@context":"https://schema.org","@type":"WebPage","name":title,"description":desc,"url":url,"inLanguage":"ko","isPartOf":{"@id":base+"#website"}};
  const tags=["<!-- JANMUN SEO BEGIN -->",`<title>${esc(title)}</title>`,`<meta name="description" content="${esc(desc)}">`,`<link rel="canonical" href="${url}">`,`<meta name="robots" content="${route==="saved"?"noindex, follow":"index, follow"}">`,`<meta property="og:type" content="${detail?"article":"website"}">`,`<meta property="og:site_name" content="잔문 殘文">`,`<meta property="og:locale" content="ko_KR">`,`<meta property="og:title" content="${esc(title)}">`,`<meta property="og:description" content="${esc(desc)}">`,`<meta property="og:url" content="${url}">`,`<meta property="og:image" content="${base}assets/share.png">`,`<meta property="og:image:width" content="1200">`,`<meta property="og:image:height" content="630">`,`<meta property="og:image:alt" content="잔문 편집실 로고">`,`<meta name="twitter:card" content="summary_large_image">`,`<meta name="twitter:title" content="${esc(title)}">`,`<meta name="twitter:description" content="${esc(desc)}">`,`<meta name="twitter:image" content="${base}assets/share.png">`,...(detail?[`<meta property="article:published_time" content="${esc(detail.date)}">`]:[]),`<script type="application/ld+json">${JSON.stringify(graph).replace(/</g,"\\u003c")}</script>`,"<!-- JANMUN SEO END -->"];
  let page=master.replace('<html lang="ko" data-theme="light">',`<html lang="ko" data-theme="light" data-site-root="${prefix}" data-start-route="${route}">`).replace("  </head>",()=>tags.map(t=>"    "+t).join("\n")+"\n  </head>");
  let count=0;page=page.replace(/^      <section class="view shell(?: reading)?" id="page-([\w-]+)"(?: hidden)?>[\s\S]*?^      <\/section>/gm,(full,key)=>{
   count++;let v=full.replace(/(id="page-[\w-]+")(?: hidden)?>/,(_,x)=>x+(key===id?"":" hidden")+">");
   if(detail&&key==="news"){const content=detail.body.map(p=>`<p>${esc(p)}</p>`).join("");const links=detail.links.map(l=>`<a class="outline" href="${esc(l.href)}">${esc(l.label)} →</a>`).join("");v=v.replace('id="news-board">','id="news-board" hidden>').replace('<article id="news-detail" class="page-body notice-detail" hidden></article>',()=>`<article id="news-detail" class="page-body notice-detail"><a class="textlink" href="#news">← 소식 목록</a><header class="notice-detail-head"><span class="eyebrow">${esc(labels[detail.category])} · ${esc(detail.status)}</span><h2>${esc(detail.title)}</h2><p class="notice-date">게시 ${esc(detail.date)}${detail.updated?" · 수정 "+esc(detail.updated):""}</p></header><div class="notice-detail-copy">${content}</div><div class="actions">${links}</div></article>`);}
   return key===id?v:`      <template data-janmun-view="${key}">\n${v}\n      </template>`;
  });
  if(count!==10)throw Error("Expected 10 views, got "+count+" for "+route);
  page=page.replace(/href="#([^"]+)"/g,(whole,key)=>valid.has(key)?`href="${prefix+path(key)}" data-route-link="${key}"`:whole).replace(/(href|src)="((?:assets|css|js)\/[^"]+)"/g,(_,attr,value)=>`${attr}="${prefix+value}"`);
  const outside=page.replace(/<template data-janmun-view="[^"]+">[\s\S]*?<\/template>/g,"");if((outside.match(/class="view shell(?: reading)?" id="page-[^"]+">/g)||[]).length!==1||!page.includes(`data-start-route="${route}"`)||!page.includes(`rel="canonical" href="${url}"`)||(detail&&!outside.includes(esc(detail.title))))throw Error("static validation failed "+route);
  files[route==="home"?"index.html":route+"/index.html"]=page;
 }
 const indexed=Object.keys(files).filter(f=>f!=="saved/index.html").map(f=>base+(f==="index.html"?"":f.replace(/index\.html$/,"")));files["sitemap.xml"]='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+indexed.map(u=>"  <url><loc>"+esc(u)+"</loc></url>").join("\n")+"\n</urlset>\n";
 return files;
}
const scope={window:{}};vm.runInNewContext(readFileSync("js/news-data.js","utf8"),scope);
const files=buildPages(readFileSync("index.html","utf8"),scope.window.JANMUN_NEWS);
for(const [p,c] of Object.entries(files)){mkdirSync(dirname(p),{recursive:true});writeFileSync(p,c,"utf8");}
console.log("Generated "+Object.keys(files).length+" files.");
