/* Runtime app — no markdown engine, all content is pre-rendered in DATA. */
const PAGES = DATA.pages;
const byPath = {};
PAGES.forEach(p => byPath[p.path] = p);
let currentPath = null;

// --- live Jupyter playground link (served on the same host, port 8888) ---
const JUPYTER_PORT = 8888;
const JUPYTER_TOKEN = "koireader";   // matches run.sh / koi-jupyter service
function jupyterURL(){
  const proto = location.protocol === "file:" ? "http:" : location.protocol;
  const host = location.hostname || "localhost";
  return proto + "//" + host + ":" + JUPYTER_PORT + "/lab?token=" + JUPYTER_TOKEN;
}

// translucent tint from an accent hex — works on light AND dark backgrounds
function hexToRgba(hex, a){
  hex = (hex||"").replace("#","");
  if(hex.length===3) hex = hex.split("").map(c=>c+c).join("");
  const n = parseInt(hex||"000000", 16);
  return "rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+a+")";
}

function resolvePath(curPath, href){
  if(href.charAt(0)==="#") return null;
  if(/\/$/.test(href)) href += "README.md";
  const base = curPath.split("/").slice(0,-1);
  href.split("/").forEach(p=>{
    if(p==="."||p==="") return;
    if(p==="..") base.pop(); else base.push(p);
  });
  return base.join("/");
}

function buildNav(){
  const nav=document.getElementById("nav");
  DATA.nav.forEach(sec=>{
    const wrap=document.createElement("div"); wrap.className="sec";
    wrap.style.setProperty("--card", sec.accent);
    const h=document.createElement("div"); h.className="sec-h";
    h.innerHTML='<span class="sec-ic">'+(sec.icon||"")+'</span> '+sec.label;
    wrap.appendChild(h);
    sec.items.forEach(it=>{
      const a=document.createElement("a");
      a.className="item"+(/README\.md$/.test(it.path)&&it.path.indexOf("/")>=0?" sub":"");
      a.textContent=it.title; a.href="#"+encodeURI(it.path);
      a.dataset.path=it.path;
      wrap.appendChild(a);
    });
    nav.appendChild(wrap);
  });
}

function setActive(path){
  document.querySelectorAll("nav a.item").forEach(a=>a.classList.toggle("active", a.dataset.path===path));
  const pg=byPath[path];
  document.getElementById("tbTitle").textContent = pg ? pg.title : "ML Eng Prep";
}

function renderPageTools(pg){
  const host=document.getElementById("pagetools");
  let html="";
  if(pg.quiz){
    html += '<div class="quizbar">'+
      '<button class="qbtn" id="hideAll">Quiz me · hide answers</button>'+
      '<button class="qbtn" id="showAll">Show all</button>'+
      '<span class="hint">Tap a question to reveal its answer.</span></div>';
  }
  if(pg.toc && pg.toc.length>=3){
    html += '<details class="toc"><summary>On this page</summary><ul>'+
      pg.toc.map(t=>'<li><a class="lvl'+t.level+'" data-anchor="'+t.id+'" href="#">'+t.text+'</a></li>').join("")+
      '</ul></details>';
  }
  host.innerHTML=html;
  if(pg.quiz){
    const set=open=>document.querySelectorAll("#content details.qa").forEach(d=>d.open=open);
    const hb=document.getElementById("hideAll"), sb=document.getElementById("showAll");
    if(hb) hb.onclick=()=>set(false);
    if(sb) sb.onclick=()=>set(true);
  }
}

function renderPager(path){
  const idx=PAGES.findIndex(p=>p.path===path);
  const pager=document.getElementById("pager");
  if(idx<0){ pager.innerHTML=""; return; }
  const prev=PAGES[idx-1], next=PAGES[idx+1];
  let html="";
  if(prev) html+='<a href="#'+encodeURI(prev.path)+'"><div class="lbl">← Previous</div><div class="ttl">'+prev.title+'</div></a>';
  else html+='<div class="spacer"></div>';
  if(next) html+='<a class="next" href="#'+encodeURI(next.path)+'"><div class="lbl">Next →</div><div class="ttl">'+next.title+'</div></a>';
  else html+='<div class="spacer"></div>';
  pager.innerHTML=html;
}

function loadPage(path){
  const pg=byPath[path];
  const content=document.getElementById("content");
  if(!pg){ content.innerHTML='<div class="loading">Page not found: '+path+'</div>'; document.getElementById("pagetools").innerHTML=""; document.getElementById("pager").innerHTML=""; return; }
  currentPath=path;
  setActive(path);
  // tint the page to its section accent (soft tint is translucent → theme-proof)
  const root=document.documentElement.style;
  if(pg.accent){ root.setProperty("--sec-accent", pg.accent); root.setProperty("--sec-accent-soft", hexToRgba(pg.accent, 0.16)); }
  else { root.removeProperty("--sec-accent"); root.removeProperty("--sec-accent-soft"); }
  content.innerHTML=pg.html;
  renderPageTools(pg);
  renderPager(path);
  initPRWidget();
  window.scrollTo(0,0);
  closeSidebar();
}

/* ---------- Precision vs Recall interactive widget (metrics page) ---------- */
function initPRWidget(){
  const host=document.getElementById("pr-widget");
  if(!host) return;

  // Deterministic pseudo-random data so the picture is stable across reloads.
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const rnd=mulberry32(1234567);
  function gauss(m,s){ let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd(); return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
  const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

  const N=260, posRate=0.38;
  const pts=[];
  for(let k=0;k<N;k++){
    const pos=rnd()<posRate;
    const score=clamp(pos?gauss(0.66,0.17):gauss(0.34,0.17),0.01,0.99);
    pts.push({pos, score, jitter:rnd()});
  }

  // Geometry
  const W=660,H=300,padL=48,padR=18,padT=18,padB=46;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const xOf=s=>padL+s*plotW;
  const yOf=j=>padT+8+j*(plotH-16);

  const dots=pts.map(p=>{
    const cx=xOf(p.score).toFixed(1), cy=yOf(p.jitter).toFixed(1);
    const cls=p.pos?"prw-pos":"prw-neg";
    return '<circle class="prw-dot '+cls+'" cx="'+cx+'" cy="'+cy+'" r="4.2"/>';
  }).join("");

  // Precision/recall curve across all thresholds (for the mini chart)
  const P=pts.filter(p=>p.pos).length, Ntot=pts.length;
  const curve=[];
  for(let t=0;t<=1.0001;t+=0.02){
    let tp=0,fp=0;
    for(const p of pts){ if(p.score>=t){ p.pos?tp++:fp++; } }
    const prec=(tp+fp)?tp/(tp+fp):1;
    const rec=P?tp/P:0;
    curve.push({t, prec, rec});
  }
  const cW=210,cH=190,cPad=34;
  const rx=r=>cPad+r*(cW-cPad-10);
  const ry=p=>10+(1-p)*(cH-cPad-10);
  const curvePath=curve.map((c,k)=>(k?'L':'M')+rx(c.rec).toFixed(1)+' '+ry(c.prec).toFixed(1)).join(' ');

  host.innerHTML=
  '<div class="prw-wrap">'+
    '<div class="prw-main">'+
      '<svg class="prw-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+
        '<rect id="prw-shade" x="0" y="'+padT+'" width="0" height="'+plotH+'" class="prw-shade"/>'+
        '<line x1="'+padL+'" y1="'+(padT+plotH)+'" x2="'+(W-padR)+'" y2="'+(padT+plotH)+'" class="prw-axis"/>'+
        '<g class="prw-ticks">'+
          [0,0.25,0.5,0.75,1].map(v=>'<text x="'+xOf(v).toFixed(0)+'" y="'+(padT+plotH+20)+'" text-anchor="middle">'+v+'</text>').join('')+
        '</g>'+
        '<text x="'+(padL+plotW/2)+'" y="'+(H-6)+'" text-anchor="middle" class="prw-axlbl">model score →</text>'+
        dots+
        '<line id="prw-line" x1="0" y1="'+padT+'" x2="0" y2="'+(padT+plotH)+'" class="prw-thline"/>'+
        '<text id="prw-lbl" x="0" y="'+(padT-4)+'" text-anchor="middle" class="prw-thlbl">0.50</text>'+
      '</svg>'+
      '<div class="prw-controls">'+
        '<label class="prw-slabel">Threshold <b id="prw-tval">0.50</b></label>'+
        '<input id="prw-slider" type="range" min="0" max="1" step="0.01" value="0.5">'+
        '<div class="prw-legend"><span><i class="prw-lg-pos"></i> actual positive</span>'+
          '<span><i class="prw-lg-neg"></i> actual negative</span>'+
          '<span><i class="prw-lg-shade"></i> predicted positive</span></div>'+
      '</div>'+
    '</div>'+
    '<div class="prw-side">'+
      '<div class="prw-metrics">'+
        '<div class="prw-metric prw-mp"><span class="prw-mlab">Precision</span><span class="prw-mval" id="prw-prec">—</span></div>'+
        '<div class="prw-metric prw-mr"><span class="prw-mlab">Recall</span><span class="prw-mval" id="prw-rec">—</span></div>'+
        '<div class="prw-metric prw-mf"><span class="prw-mlab">F1</span><span class="prw-mval" id="prw-f1">—</span></div>'+
      '</div>'+
      '<table class="prw-cm"><tr><td class="prw-cm-h"></td><td class="prw-cm-h">pred +</td><td class="prw-cm-h">pred −</td></tr>'+
        '<tr><td class="prw-cm-h">actual +</td><td class="prw-tp" id="prw-tp">0</td><td class="prw-fn" id="prw-fn">0</td></tr>'+
        '<tr><td class="prw-cm-h">actual −</td><td class="prw-fp" id="prw-fp">0</td><td class="prw-tn" id="prw-tn">0</td></tr>'+
      '</table>'+
      '<svg class="prw-pr" viewBox="0 0 '+cW+' '+cH+'" preserveAspectRatio="xMidYMid meet">'+
        '<line x1="'+cPad+'" y1="'+(cH-cPad)+'" x2="'+(cW-8)+'" y2="'+(cH-cPad)+'" class="prw-axis"/>'+
        '<line x1="'+cPad+'" y1="10" x2="'+cPad+'" y2="'+(cH-cPad)+'" class="prw-axis"/>'+
        '<path d="'+curvePath+'" class="prw-curve"/>'+
        '<circle id="prw-prdot" r="5" class="prw-prdot"/>'+
        '<text x="'+((cW+cPad)/2)+'" y="'+(cH-6)+'" text-anchor="middle" class="prw-axlbl">recall</text>'+
        '<text x="12" y="'+(cH/2)+'" transform="rotate(-90 12 '+(cH/2)+')" text-anchor="middle" class="prw-axlbl">precision</text>'+
      '</svg>'+
    '</div>'+
  '</div>';

  const slider=host.querySelector("#prw-slider");
  const line=host.querySelector("#prw-line");
  const shade=host.querySelector("#prw-shade");
  const lbl=host.querySelector("#prw-lbl");
  const prdot=host.querySelector("#prw-prdot");
  const el=id=>host.querySelector("#"+id);

  function update(t){
    let tp=0,fp=0,fn=0,tn=0;
    for(const p of pts){
      if(p.score>=t){ p.pos?tp++:fp++; } else { p.pos?fn++:tn++; }
    }
    const prec=(tp+fp)?tp/(tp+fp):1;
    const rec=(tp+fn)?tp/(tp+fn):0;
    const f1=(prec+rec)?2*prec*rec/(prec+rec):0;
    const x=xOf(t);
    line.setAttribute("x1",x); line.setAttribute("x2",x);
    lbl.setAttribute("x",clamp(x,padL+14,W-padR-14)); lbl.textContent=t.toFixed(2);
    shade.setAttribute("x",x); shade.setAttribute("width",Math.max(0,(W-padR)-x));
    el("prw-tval").textContent=t.toFixed(2);
    el("prw-prec").textContent=(prec*100).toFixed(0)+"%";
    el("prw-rec").textContent=(rec*100).toFixed(0)+"%";
    el("prw-f1").textContent=f1.toFixed(2);
    el("prw-tp").textContent=tp; el("prw-fp").textContent=fp;
    el("prw-fn").textContent=fn; el("prw-tn").textContent=tn;
    prdot.setAttribute("cx",rx(rec)); prdot.setAttribute("cy",ry(prec));
  }
  slider.addEventListener("input", ()=>update(parseFloat(slider.value)));
  update(0.5);
}

function go(path){ location.hash="#"+encodeURI(path); }
function onHash(){
  let raw=decodeURI(location.hash.replace(/^#/,""));
  loadPage(raw || "README.md");
}

// internal links + TOC anchors
document.addEventListener("click", e=>{
  const anchor=e.target.closest("a[data-anchor]");
  if(anchor){ e.preventDefault(); const el=document.getElementById(anchor.dataset.anchor); if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); return; }
  const a=e.target.closest("a.mdlink");
  if(!a) return;
  const href=a.getAttribute("data-href");
  if(href==="JUPYTER"){ e.preventDefault(); window.open(jupyterURL(), "_blank", "noopener"); return; }
  e.preventDefault();
  const target=resolvePath(currentPath||"README.md", href);
  if(target) go(target);
});

/* ---------------------------------- search --------------------------------- */
const searchBox=document.getElementById("search");
const panel=document.getElementById("searchpanel");
let selIndex=-1, results=[];

function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function snippet(text, q){
  const i=text.indexOf(q); if(i<0) return text.slice(0,120)+"…";
  const s=Math.max(0,i-50), e=Math.min(text.length,i+q.length+70);
  let frag=(s>0?"…":"")+text.slice(s,e)+(e<text.length?"…":"");
  return frag.replace(new RegExp(escRe(q),"ig"), m=>"<mark>"+m+"</mark>");
}
function runSearch(){
  const q=searchBox.value.trim().toLowerCase();
  if(q.length<2){ panel.classList.remove("show"); return; }
  results=PAGES.filter(p=>p.text.indexOf(q)>=0 || p.title.toLowerCase().indexOf(q)>=0).slice(0,40);
  selIndex=-1;
  if(!results.length){ panel.innerHTML='<div class="empty">No matches for “'+q+'”.</div>'; panel.classList.add("show"); return; }
  panel.innerHTML=results.map((p,k)=>
    '<a class="sr" data-k="'+k+'" data-path="'+p.path+'" href="#'+encodeURI(p.path)+'">'+
    '<div class="t">'+p.title+' <span style="color:var(--muted);font-weight:400">· '+p.section+'</span></div>'+
    '<div class="c">'+snippet(p.text,q)+'</div></a>').join("");
  panel.classList.add("show");
}
searchBox.addEventListener("input", runSearch);
searchBox.addEventListener("focus", ()=>{ if(searchBox.value.trim().length>=2) runSearch(); });
panel.addEventListener("click", e=>{ const r=e.target.closest(".sr"); if(r){ e.preventDefault(); go(r.dataset.path); closeSearch(); } });
function closeSearch(){ panel.classList.remove("show"); }
document.addEventListener("click", e=>{ if(!panel.contains(e.target) && e.target!==searchBox && !e.target.closest("#searchBtn")) closeSearch(); });
searchBox.addEventListener("keydown", e=>{
  if(!panel.classList.contains("show")) return;
  if(e.key==="ArrowDown"){ e.preventDefault(); selIndex=Math.min(results.length-1,selIndex+1); }
  else if(e.key==="ArrowUp"){ e.preventDefault(); selIndex=Math.max(0,selIndex-1); }
  else if(e.key==="Enter"){ e.preventDefault(); if(results[selIndex]){ go(results[selIndex].path); closeSearch(); searchBox.blur(); } return; }
  else if(e.key==="Escape"){ closeSearch(); searchBox.blur(); return; }
  panel.querySelectorAll(".sr").forEach((el,i)=>el.classList.toggle("sel", i===selIndex));
  const sel=panel.querySelector(".sr.sel"); if(sel) sel.scrollIntoView({block:"nearest"});
});

/* --------------------------------- theme ----------------------------------- */
function applyTheme(t){ document.documentElement.dataset.theme=t; try{localStorage.setItem("koi-theme",t);}catch(_){} }
function toggleTheme(){ applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"); }
document.querySelectorAll(".theme-toggle").forEach(b=>b.addEventListener("click",toggleTheme));
(function(){ let t; try{t=localStorage.getItem("koi-theme");}catch(_){}
  if(!t) t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"; applyTheme(t); })();

/* ----------------------------- mobile drawer ------------------------------- */
const sidebar=document.getElementById("sidebar"), scrim=document.getElementById("scrim");
function openSidebar(){ sidebar.classList.add("open"); scrim.classList.add("show"); }
function closeSidebar(){ sidebar.classList.remove("open"); scrim.classList.remove("show"); }
document.getElementById("menu").addEventListener("click", openSidebar);
document.getElementById("searchBtn").addEventListener("click", ()=>{ openSidebar(); setTimeout(()=>searchBox.focus(),260); });
scrim.addEventListener("click", closeSidebar);
addEventListener("keydown", e=>{ if(e.key==="Escape") closeSidebar(); });

/* --------------------------- live Jupyter button --------------------------- */
(function(){
  const jl=document.getElementById("jupyterLink");
  if(jl){
    jl.href=jupyterURL();
    jl.title="Opens JupyterLab on this device, port "+JUPYTER_PORT+
             " — requires the playground running (bash run.sh, or the koi-jupyter service).";
  }
})();

/* ----------------------------------- init ---------------------------------- */
buildNav();
window.addEventListener("hashchange", onHash);
onHash();
