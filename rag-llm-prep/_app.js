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

/* --------------------- tiny persistent store (localStorage) ---------------- */
// All study state (progress, flashcard grades) lives under one namespaced key.
const STORE_KEY = "mlprep-v1";
function loadStore(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }catch(_){ return {}; } }
function saveStore(s){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(s)); }catch(_){} }
let STATE = loadStore();
STATE.done   = STATE.done   || {};   // { path: true }         pages marked complete
STATE.cards  = STATE.cards  || {};   // { "path#cardhash": 1|-1 }  flashcard grades
STATE.last   = STATE.last   || null; // last visited path (for "resume")
function persist(){ saveStore(STATE); }
// stable short hash for card ids
function hashStr(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }

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
    h.innerHTML='<span class="sec-ic">'+(sec.icon||"")+'</span> '+sec.label+
      '<span class="sec-count"></span>';
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
  document.getElementById("tbTitle").textContent = pg ? pg.title : "RAG Prep";
}

function renderPageTools(pg){
  const host=document.getElementById("pagetools");
  let html="";
  if(pg.quiz){
    html += '<div class="quizbar">'+
      '<button class="qbtn" id="hideAll">Quiz me · hide answers</button>'+
      '<button class="qbtn" id="showAll">Show all</button>'+
      '<button class="qbtn" id="shuffleCards">🔀 Shuffle</button>'+
      '<span class="qfilter">Show: '+
        '<button class="fbtn sel" data-f="all">all</button>'+
        '<button class="fbtn" data-f="unseen">unseen</button>'+
        '<button class="fbtn" data-f="misses">misses</button></span>'+
      '<span class="quiz-stats" id="quizStats"></span></div>';
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
    const shuf=document.getElementById("shuffleCards");
    if(shuf) shuf.onclick=()=>shuffleCards();
    host.querySelectorAll(".fbtn").forEach(b=>b.onclick=()=>{
      host.querySelectorAll(".fbtn").forEach(x=>x.classList.toggle("sel",x===b));
      applyQuizFilter(b.dataset.f);
    });
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
  if(pg.quiz) initFlashcards(pg);
  renderPager(path);
  mountWidgets();
  markVisited(path);
  window.scrollTo(0,0);
  closeSidebar();
}

/* ----------------------------- widget registry ----------------------------- */
// Each widget is a <div id="…"> placed in a markdown page via a ```rawhtml fence.
// After a page renders we mount whichever hosts are present. Add new widgets here.
const WIDGETS = {
  "chunk-widget":   initChunkWidget,
  "cosine-widget":  initCosineWidget,
  "context-widget": initContextWidget,
  "index-widget":   initIndexWidget,
};
function mountWidgets(){
  for(const id in WIDGETS){
    if(document.getElementById(id)){ try{ WIDGETS[id](); }catch(e){ console.error("widget "+id, e); } }
  }
}

/* ===================== RAG interactive-learning widgets =================== */

/* --------- Chunking visualizer: size + overlap over a document --------- */
function initChunkWidget(){
  const host=document.getElementById("chunk-widget"); if(!host) return;
  const L=1000;
  host.innerHTML=
   '<div class="bv-wrap"><div class="bv-controls"><div class="bt-sliders">'+
     '<label>Chunk size <b id="ck-sv">200</b> tokens<input id="ck-s" type="range" min="50" max="500" step="10" value="200"></label>'+
     '<label>Overlap <b id="ck-ov">40</b> tokens<input id="ck-o" type="range" min="0" max="240" step="10" value="40"></label>'+
   '</div>'+
   '<svg class="chunk-svg" viewBox="0 0 460 160" preserveAspectRatio="xMidYMid meet"><g id="ck-g"></g></svg>'+
   '<div class="bv-metrics">'+
     '<div class="bv-m"><span class="bv-mlab">Chunks</span><b id="ck-n">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Overlap</span><b id="ck-pct">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Redundancy</span><b id="ck-red">—</b></div>'+
   '</div>'+
   '<div class="lm-note" id="ck-note"></div></div></div>';
  const el=id=>host.querySelector("#"+id);
  const W=460, padX=10, plotW=W-2*padX;
  function compute(){
    let S=+el("ck-s").value, O=+el("ck-o").value;
    if(O>=S){ O=S-10; el("ck-o").value=O; }
    el("ck-sv").textContent=S; el("ck-ov").textContent=O;
    const stride=S-O, sc=x=>padX+(x/L)*plotW;
    const starts=[]; for(let p=0;p<L;p+=stride){ starts.push(p); if(p+S>=L) break; }
    const n=starts.length, rowH=15, gap=4;
    let g='<rect x="'+padX+'" y="10" width="'+plotW+'" height="10" class="ck-doc" rx="2"/>'+
          '<text x="'+padX+'" y="7" class="ck-lbl">document · '+L+' tokens</text>';
    starts.forEach((p,i)=>{
      const x=sc(p), w=sc(Math.min(p+S,L))-x, y=30+(i%7)*(rowH+gap);
      g+='<rect x="'+x.toFixed(1)+'" y="'+y+'" width="'+w.toFixed(1)+'" height="'+rowH+'" class="ck-chunk c'+(i%4)+'" rx="3"/>';
    });
    el("ck-g").innerHTML=g;
    el("ck-n").textContent=n;
    el("ck-pct").textContent=(O/S*100).toFixed(0)+"%";
    const red=(n*S)/L;
    el("ck-red").textContent=red.toFixed(2)+"×";
    el("ck-note").textContent="Stride = "+stride+" tokens → "+n+" chunks totaling "+(n*S)+" tokens for a "+L+"-token doc ("+red.toFixed(2)+"× redundancy). More overlap keeps ideas that straddle a boundary retrievable, but stores and searches more vectors.";
  }
  ["ck-s","ck-o"].forEach(id=>el(id).addEventListener("input",compute));
  compute();
}

/* --------- Cosine similarity: the angle IS the score --------- */
function initCosineWidget(){
  const host=document.getElementById("cosine-widget"); if(!host) return;
  const W=200,H=200,cx=100,cy=100,R=76;
  host.innerHTML=
   '<div class="bv-wrap"><div class="cos-row">'+
     '<svg class="cos-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+
       '<line x1="8" y1="'+cy+'" x2="'+(W-8)+'" y2="'+cy+'" class="prw-axis"/>'+
       '<line x1="'+cx+'" y1="8" x2="'+cx+'" y2="'+(H-8)+'" class="prw-axis"/>'+
       '<line id="cos-a" class="cos-veca" x1="'+cx+'" y1="'+cy+'"/>'+
       '<line id="cos-b" class="cos-vecb" x1="'+cx+'" y1="'+cy+'"/>'+
       '<text id="cos-a-l" class="cos-lbl-a">A</text><text id="cos-b-l" class="cos-lbl-b">B</text>'+
     '</svg>'+
     '<div class="cos-side">'+
       '<div class="bv-m"><span class="bv-mlab">Cosine similarity</span><b id="cos-val">—</b></div>'+
       '<div class="bv-m"><span class="bv-mlab">Angle between</span><b id="cos-ang">—</b></div>'+
       '<div class="bv-m"><span class="bv-mlab">Reading</span><b id="cos-read" class="bv-diag">—</b></div>'+
     '</div></div>'+
     '<div class="bv-controls"><div class="bt-sliders">'+
       '<label>Vector A angle <b id="cos-av">20</b>°<input id="cos-aa" type="range" min="0" max="360" step="1" value="20"></label>'+
       '<label>Vector B angle <b id="cos-bv">75</b>°<input id="cos-ba" type="range" min="0" max="360" step="1" value="75"></label>'+
     '</div></div></div>';
  const el=id=>host.querySelector("#"+id);
  const rad=d=>d*Math.PI/180;
  function compute(){
    const a=+el("cos-aa").value, b=+el("cos-ba").value;
    el("cos-av").textContent=a; el("cos-bv").textContent=b;
    el("cos-a").setAttribute("x2",cx+R*Math.cos(rad(a))); el("cos-a").setAttribute("y2",cy-R*Math.sin(rad(a)));
    el("cos-b").setAttribute("x2",cx+R*Math.cos(rad(b))); el("cos-b").setAttribute("y2",cy-R*Math.sin(rad(b)));
    el("cos-a-l").setAttribute("x",cx+(R+12)*Math.cos(rad(a))); el("cos-a-l").setAttribute("y",cy-(R+12)*Math.sin(rad(a)));
    el("cos-b-l").setAttribute("x",cx+(R+12)*Math.cos(rad(b))); el("cos-b-l").setAttribute("y",cy-(R+12)*Math.sin(rad(b)));
    let diff=Math.abs(a-b)%360; if(diff>180) diff=360-diff;
    const cos=Math.cos(rad(diff));
    el("cos-val").textContent=cos.toFixed(3);
    el("cos-ang").textContent=diff.toFixed(0)+"°";
    const rd=el("cos-read"); let msg,cls;
    if(cos>0.8){msg="near-duplicate";cls="bv-good";} else if(cos>0.3){msg="related";cls="bv-good";}
    else if(cos>-0.3){msg="unrelated";cls="";} else {msg="opposite";cls="bv-bad";}
    rd.textContent=msg; rd.className="bv-diag "+cls;
  }
  ["cos-aa","cos-ba"].forEach(id=>el(id).addEventListener("input",compute));
  compute();
}

/* --------- Context-window budget: how many chunks actually fit --------- */
function initContextWidget(){
  const host=document.getElementById("context-widget"); if(!host) return;
  host.innerHTML=
   '<div class="bv-wrap"><div class="bv-controls">'+
     '<div class="lm-row"><label>Context window</label><span>'+
       '<button class="qz-seg" data-w="4096">4K</button>'+
       '<button class="qz-seg sel" data-w="8192">8K</button>'+
       '<button class="qz-seg" data-w="32768">32K</button>'+
       '<button class="qz-seg" data-w="131072">128K</button></span></div>'+
     '<div class="bt-sliders">'+
       '<label>Retrieved chunks (k) <b id="cx-kv">5</b><input id="cx-k" type="range" min="1" max="40" step="1" value="5"></label>'+
       '<label>Tokens per chunk <b id="cx-tv">256</b><input id="cx-t" type="range" min="50" max="1000" step="10" value="256"></label>'+
       '<label>Prompt + query <b id="cx-pv">300</b> tokens<input id="cx-p" type="range" min="50" max="2000" step="10" value="300"></label>'+
       '<label>Reserve for answer <b id="cx-av">500</b> tokens<input id="cx-a" type="range" min="100" max="4000" step="50" value="500"></label>'+
     '</div>'+
     '<div class="lm-stack cx-stack" id="cx-stack"></div>'+
     '<div class="cx-legend"><span><i style="background:#0e8f8f"></i>prompt</span><span><i style="background:var(--accent)"></i>retrieved chunks</span><span><i style="background:#3b82f6"></i>answer</span><span><i class="cx-mk"></i>window</span></div>'+
     '<div class="bv-metrics">'+
       '<div class="bv-m"><span class="bv-mlab">Input tokens</span><b id="cx-in">—</b></div>'+
       '<div class="bv-m"><span class="bv-mlab">Window used</span><b id="cx-pct">—</b></div>'+
       '<div class="bv-m"><span class="bv-mlab">Status</span><b id="cx-status" class="bv-diag">—</b></div>'+
     '</div></div></div>';
  let win=8192; const el=id=>host.querySelector("#"+id);
  function compute(){
    const k=+el("cx-k").value,t=+el("cx-t").value,p=+el("cx-p").value,ans=+el("cx-a").value;
    el("cx-kv").textContent=k; el("cx-tv").textContent=t; el("cx-pv").textContent=p; el("cx-av").textContent=ans;
    const ctx=k*t, input=ctx+p, needed=input+ans, scale=Math.max(needed,win);
    const parts=[[p,"#0e8f8f"],[ctx,"var(--accent)"],[ans,"#3b82f6"]];
    el("cx-stack").innerHTML=parts.map(([v,c])=>'<div class="lm-seg" style="width:'+(v/scale*100)+'%;background:'+c+'">'+(v/scale>0.08?v:'')+'</div>').join("")+
      '<div class="stack-mark" style="left:'+(win/scale*100)+'%"></div>';
    el("cx-in").textContent=input.toLocaleString();
    el("cx-pct").textContent=(input/win*100).toFixed(0)+"%";
    const s=el("cx-status"), ok=needed<=win;
    s.textContent=ok?"fits ✓":"overflow ✗"; s.className="bv-diag "+(ok?"bv-good":"bv-bad");
  }
  host.querySelectorAll(".qz-seg").forEach(b=>b.onclick=()=>{win=+b.dataset.w;host.querySelectorAll(".qz-seg").forEach(x=>x.classList.toggle("sel",x===b));compute();});
  ["cx-k","cx-t","cx-p","cx-a"].forEach(id=>el(id).addEventListener("input",compute));
  compute();
}

/* --------- Vector-index memory: why you quantize / use ANN --------- */
function initIndexWidget(){
  const host=document.getElementById("index-widget"); if(!host) return;
  host.innerHTML=
   '<div class="bv-wrap"><div class="bv-controls"><div class="bt-sliders">'+
     '<label>Vectors <b id="ix-nv">1M</b><input id="ix-n" type="range" min="4" max="8" step="0.1" value="6"></label>'+
     '<label>Dimensions <b id="ix-dv">768</b><input id="ix-d" type="range" min="128" max="3072" step="128" value="768"></label>'+
   '</div>'+
   '<div class="lm-row"><label>Stored precision</label><span>'+
     '<button class="qz-seg" data-b="1">int8</button>'+
     '<button class="qz-seg" data-b="2">fp16</button>'+
     '<button class="qz-seg sel" data-b="4">fp32</button></span></div>'+
   '<div class="bv-metrics">'+
     '<div class="bv-m"><span class="bv-mlab">Raw vectors</span><b id="ix-mem">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Per vector</span><b id="ix-per">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">+ HNSW graph</span><b id="ix-hnsw">—</b></div>'+
   '</div>'+
   '<div class="lm-note" id="ix-note"></div></div></div>';
  let bytes=4; const el=id=>host.querySelector("#"+id);
  const fmtN=n=>n>=1e9?(n/1e9).toFixed(1)+"B":n>=1e6?(n/1e6).toFixed(0)+"M":n>=1e3?(n/1e3).toFixed(0)+"K":(""+n);
  const GB=v=>v>=1?v.toFixed(2)+" GB":(v*1024).toFixed(0)+" MB";
  function compute(){
    const N=Math.round(Math.pow(10,+el("ix-n").value)), d=+el("ix-d").value;
    el("ix-nv").textContent=fmtN(N); el("ix-dv").textContent=d;
    const raw=N*d*bytes, per=d*bytes, hnsw=N*32*4;
    el("ix-mem").textContent=GB(raw/1e9);
    el("ix-per").textContent=per>=1024?(per/1024).toFixed(1)+" KB":per+" B";
    el("ix-hnsw").textContent=GB((raw+hnsw)/1e9);
    el("ix-note").textContent="A flat index keeps every vector in full: "+fmtN(N)+" × "+d+"-dim × "+bytes+"B = "+GB(raw/1e9)+" of RAM, before the ANN graph. That memory wall is why you quantize (PQ / int8) or switch to IVF / HNSW as N grows.";
  }
  host.querySelectorAll(".qz-seg").forEach(b=>b.onclick=()=>{bytes=+b.dataset.b;host.querySelectorAll(".qz-seg").forEach(x=>x.classList.toggle("sel",x===b));compute();});
  ["ix-n","ix-d"].forEach(id=>el(id).addEventListener("input",compute));
  compute();
}

/* ============================ flashcards / SRS ============================= */
// Turn each quiz <details.qa> into a gradeable card (Got it / Missed),
// persisted in STATE.cards. Adds shuffle + "review misses only" + a counter.
function cardKey(path, q){ return path + "#" + hashStr(q); }
function initFlashcards(pg){
  const content=document.getElementById("content");
  const cards=[...content.querySelectorAll("details.qa")];
  if(!cards.length) return;
  cards.forEach(d=>{
    const q=(d.querySelector("summary")?.textContent||"").trim();
    const key=cardKey(pg.path, q);
    d.dataset.key=key;
    const grade=STATE.cards[key];
    d.classList.toggle("known", grade===1);
    d.classList.toggle("missed", grade===-1);
    const body=d.querySelector(".qa-body");
    if(body && !body.querySelector(".card-grade")){
      const bar=document.createElement("div");
      bar.className="card-grade";
      bar.innerHTML='<button class="cg cg-known" data-g="1">✓ Got it</button>'+
        '<button class="cg cg-missed" data-g="-1">✗ Missed</button>'+
        '<button class="cg cg-clear" data-g="0">clear</button>';
      body.appendChild(bar);
    }
  });
  updateQuizStats(pg);
}
function gradeCard(d, g, pg){
  const key=d.dataset.key; if(!key) return;
  if(g===0) delete STATE.cards[key]; else STATE.cards[key]=g;
  persist();
  d.classList.toggle("known", g===1);
  d.classList.toggle("missed", g===-1);
  updateQuizStats(pg);
}
function updateQuizStats(pg){
  const content=document.getElementById("content");
  const cards=[...content.querySelectorAll("details.qa")];
  const total=cards.length;
  let known=0, missed=0;
  cards.forEach(d=>{ if(d.classList.contains("known"))known++; else if(d.classList.contains("missed"))missed++; });
  const el=document.getElementById("quizStats");
  if(el) el.innerHTML='<b class="qs-known">'+known+'</b> mastered · <b class="qs-missed">'+missed+
    '</b> missed · '+(total-known-missed)+' left <span class="qs-total">('+total+' cards)</span>';
}
// filter: "all" | "misses" | "unseen"
function applyQuizFilter(mode){
  const content=document.getElementById("content");
  content.querySelectorAll("details.qa").forEach(d=>{
    let show=true;
    if(mode==="misses") show=d.classList.contains("missed");
    else if(mode==="unseen") show=!d.classList.contains("known") && !d.classList.contains("missed");
    d.classList.toggle("qa-hide", !show);
  });
}
function shuffleCards(){
  const content=document.getElementById("content");
  // shuffle within each H2 group so section headers still make sense
  const kids=[...content.children];
  let group=[];
  const flush=()=>{
    for(let i=group.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [group[i],group[j]]=[group[j],group[i]]; }
    group.forEach(n=>content.appendChild(n));
    group=[];
  };
  kids.forEach(n=>{
    if(n.tagName==="H2"||n.tagName==="H1"||n.tagName==="HR"){ flush(); content.appendChild(n); }
    else if(n.classList.contains("qa")) group.push(n);
    else { flush(); content.appendChild(n); }
  });
  flush();
}

/* ============================ progress tracking =========================== */
function isDone(path){ return !!STATE.done[path]; }
function setDone(path, v){ if(v) STATE.done[path]=true; else delete STATE.done[path]; persist(); refreshProgressUI(); }
function markVisited(path){
  STATE.last=path; persist();
  setActiveDone();
  renderPageStatus(path);
  refreshProgressUI();
}
// count only real content pages (exclude the home overview) toward totals
function progressPages(){ return PAGES.filter(p=>p.path!=="README.md"); }
function refreshProgressUI(){
  const all=progressPages();
  const done=all.filter(p=>isDone(p.path)).length;
  const pct=all.length?Math.round(done/all.length*100):0;
  const bar=document.getElementById("progBar"), lbl=document.getElementById("progLbl");
  if(bar) bar.style.width=pct+"%";
  if(lbl) lbl.textContent=done+" / "+all.length+" pages · "+pct+"%";
  // per-item checks + per-section counts in the nav
  document.querySelectorAll("nav a.item").forEach(a=>{
    a.classList.toggle("done", isDone(a.dataset.path));
  });
  document.querySelectorAll("nav .sec").forEach(secEl=>{
    const links=[...secEl.querySelectorAll("a.item")].filter(a=>a.dataset.path!=="README.md" || secEl.querySelectorAll("a.item").length===1);
    const count=secEl.querySelector(".sec-count");
    if(count){
      const d=links.filter(a=>isDone(a.dataset.path)).length;
      count.textContent=d+"/"+links.length;
      count.classList.toggle("all-done", d===links.length && links.length>0);
    }
  });
}
function setActiveDone(){
  document.querySelectorAll("nav a.item").forEach(a=>a.classList.toggle("done", isDone(a.dataset.path)));
}
// A small status strip appended under the pager: mark complete + next.
function renderPageStatus(path){
  const existing=document.querySelector(".page-status"); if(existing) existing.remove();
  if(path==="README.md") return; // home has no "complete" concept
  const host=document.getElementById("pager");
  if(!host) return;
  const done=isDone(path);
  const strip=document.createElement("div");
  strip.className="page-status";
  strip.innerHTML='<button class="complete-btn'+(done?" is-done":"")+'" id="completeBtn">'+
    (done?"✓ Completed — click to unmark":"Mark this page complete")+'</button>';
  host.parentNode.insertBefore(strip, host);
  strip.querySelector("#completeBtn").onclick=()=>{
    setDone(path, !isDone(path));
    renderPager(path);            // re-render pager block…
    const old=document.querySelector(".page-status"); if(old) old.remove();
    renderPageStatus(path);       // …and this strip
  };
}

/* =============================== study timer ============================== */
// Global floating timer that survives SPA navigation (lives outside #content).
const Timer=(function(){
  let total=25*60, left=25*60, running=false, tick=null;
  function fmt(s){ const m=Math.floor(s/60), ss=s%60; return m+":"+(ss<10?"0":"")+ss; }
  function paint(){
    const t=document.getElementById("timerTime");
    const ring=document.getElementById("timerRing");
    if(t) t.textContent=fmt(left);
    if(ring){ const frac=total?left/total:0; ring.style.background=
      "conic-gradient(var(--accent) "+(frac*360)+"deg, var(--border) 0)"; }
    const panel=document.getElementById("timerPanel");
    if(panel) panel.classList.toggle("done", left<=0);
    const pb=document.getElementById("timerPlay"); if(pb) pb.textContent=running?"❚❚":"▶";
  }
  function step(){ if(left>0){ left--; if(left<=0){ stop(); flash(); } paint(); } }
  function flash(){ const p=document.getElementById("timerPanel"); if(p){ p.classList.add("ring"); setTimeout(()=>p.classList.remove("ring"),3000);} }
  function start(){ if(running||left<=0) return; running=true; tick=setInterval(step,1000); paint(); }
  function stop(){ running=false; if(tick) clearInterval(tick); tick=null; paint(); }
  function toggle(){ running?stop():start(); }
  function reset(sec){ stop(); total=sec; left=sec; paint(); }
  function open(){ const p=document.getElementById("timerPanel"); if(p){ p.classList.add("show"); paint(); } }
  function close(){ const p=document.getElementById("timerPanel"); if(p) p.classList.remove("show"); }
  return { start, stop, toggle, reset, open, close, paint };
})();
function initTimer(){
  const launch=document.getElementById("timerBtn");
  if(launch) launch.onclick=()=>Timer.open();
  const panel=document.getElementById("timerPanel");
  if(!panel) return;
  panel.querySelector("#timerPlay").onclick=()=>Timer.toggle();
  panel.querySelector("#timerClose").onclick=()=>Timer.close();
  panel.querySelectorAll(".timer-preset").forEach(b=>{
    b.onclick=()=>{ Timer.reset(+b.dataset.min*60); panel.querySelectorAll(".timer-preset").forEach(x=>x.classList.toggle("sel",x===b)); };
  });
  Timer.paint();
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

/* ------------------------- flashcard grade clicks -------------------------- */
// Delegated on #content (the node persists; only its innerHTML changes).
document.getElementById("content").addEventListener("click", e=>{
  const btn=e.target.closest(".cg"); if(!btn) return;
  e.preventDefault(); e.stopPropagation();
  const card=btn.closest("details.qa"); if(!card) return;
  gradeCard(card, +btn.dataset.g, byPath[currentPath]);
});

/* --------------------------------- resume ---------------------------------- */
function renderResume(){
  const slot=document.getElementById("resumeSlot"); if(!slot) return;
  const p=STATE.last && byPath[STATE.last];
  if(p && p.path!=="README.md"){
    slot.innerHTML='<a class="resume-link" href="#'+encodeURI(p.path)+'">↻ Resume: '+p.title+'</a>';
  } else slot.innerHTML="";
}

/* ----------------------------------- init ---------------------------------- */
buildNav();
initTimer();
refreshProgressUI();
renderResume();
window.addEventListener("hashchange", ()=>{ onHash(); renderResume(); });
onHash();
