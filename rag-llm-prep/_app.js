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

/* ---------------------- persistent study-state store ---------------------- */
// localStorage is the instant/offline copy; /api/progress is shared by devices.
const STORE_KEY = "mlprep-v1";
function loadStore(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }catch(_){ return {}; } }
function saveStore(s){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(s)); }catch(_){} }
let STATE = loadStore();
let remoteReady = location.protocol === "file:";
let serverHasState = false;
let saveQueue = Promise.resolve();
let syncLabel = location.protocol === "file:" ? "local" : "connecting";
function normalizeState(s){
  s = s && typeof s === "object" ? s : {};
  s.done = s.done && typeof s.done === "object" ? s.done : {};
  s.cards = s.cards && typeof s.cards === "object" ? s.cards : {};
  s.pins = s.pins && typeof s.pins === "object" ? s.pins : {};
  s.analytics = s.analytics && typeof s.analytics === "object" ? s.analytics : {};
  s.last = typeof s.last === "string" ? s.last : null;
  return s;
}
STATE = normalizeState(STATE);
function hasStudyState(){
  return Object.keys(STATE.done).length || Object.keys(STATE.cards).length ||
    Object.keys(STATE.pins).length || Object.keys(STATE.analytics).length;
}
function mergeLegacyLocal(remote, local){
  let changed=false;
  const deleted=remote._deleted && typeof remote._deleted==="object" ? remote._deleted : {};
  ["done","cards","pins"].forEach(field=>{
    const tombstones=deleted[field] && typeof deleted[field]==="object" ? deleted[field] : {};
    Object.keys(local[field]||{}).forEach(key=>{
      if(!(key in remote[field]) && !(key in tombstones)){ remote[field][key]=local[field][key]; changed=true; }
    });
  });
  Object.keys(local.analytics||{}).forEach(key=>{
    if(!(key in remote.analytics)){ remote.analytics[key]=local.analytics[key]; changed=true; }
  });
  return changed;
}

/* ------------------------- per-page study analytics ------------------------ */
let trackedPagePath=null;
let trackedPageStartedAt=null;
let analyticsSaveTimer=null;
let analyticsPaintTimer=null;
function analyticsEntry(path){
  let a=STATE.analytics[path];
  if(!a || typeof a!=="object") a=STATE.analytics[path]={};
  a.seconds=Math.max(0, Number(a.seconds)||0);
  a.visits=Math.max(0, Math.floor(Number(a.visits)||0));
  a.lastVisited=Math.max(0, Number(a.lastVisited)||0);
  return a;
}
function pageSeconds(path){
  const a=analyticsEntry(path);
  let seconds=a.seconds;
  if(path===trackedPagePath && trackedPageStartedAt!==null && document.visibilityState==="visible"){
    seconds+=Math.max(0,Date.now()-trackedPageStartedAt)/1000;
  }
  return seconds;
}
function fmtMinutes(seconds){
  const mins=Math.max(0,seconds)/60;
  return (mins<10?mins.toFixed(1):Math.round(mins))+" min";
}
function persistPageAnalytics(path, beacon){
  if(!path) return;
  const change={op:"set",field:"analytics",key:path,value:analyticsEntry(path)};
  saveStore(STATE);
  if(!remoteReady || location.protocol==="file:" || (!serverHasState && !hasStudyState())) return;
  if(beacon && navigator.sendBeacon){
    try{
      navigator.sendBeacon("/api/progress",new Blob([JSON.stringify(change)],{type:"application/json"}));
      return;
    }catch(_){}
  }
  persist(change);
}
function flushTrackedPage(saveRemote){
  if(!trackedPagePath || trackedPageStartedAt===null) return;
  const now=Date.now();
  analyticsEntry(trackedPagePath).seconds+=Math.max(0,now-trackedPageStartedAt)/1000;
  trackedPageStartedAt=now;
  if(saveRemote) persistPageAnalytics(trackedPagePath,false); else saveStore(STATE);
}
function beginTrackedPage(){
  if(!trackedPagePath || trackedPageStartedAt!==null || document.visibilityState!=="visible") return;
  const a=analyticsEntry(trackedPagePath);
  a.visits++;
  a.lastVisited=Date.now();
  trackedPageStartedAt=Date.now();
  persistPageAnalytics(trackedPagePath,false);
}
function switchTrackedPage(path){
  if(path===trackedPagePath && trackedPageStartedAt!==null) return;
  flushTrackedPage(true);
  trackedPageStartedAt=null;
  trackedPagePath=path;
  beginTrackedPage();
}
function analyticsStatus(path){
  if(path==="README.md") return "Overview";
  if(isDone(path)) return "Completed";
  return analyticsEntry(path).visits?"In progress":"Not started";
}
function escAnalytics(s){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function renderAnalyticsPanel(path){
  const old=document.getElementById("analyticsPanel"); if(old) old.remove();
  if(path!=="README.md") return;
  const content=document.getElementById("content"); if(!content) return;
  const pages=progressPages();
  const done=pages.filter(p=>isDone(p.path)).length;
  const panel=document.createElement("section");
  panel.id="analyticsPanel"; panel.className="analytics-panel";
  panel.innerHTML='<div class="analytics-overview-head"><div><span class="analytics-kicker">Study analytics</span>'+
    '<h2>Time on every page</h2><p>Counts only while this site is visible. Time and completion sync across devices.</p></div>'+
    '<div class="analytics-total"><strong id="analyticsTotalTime">0.0 min</strong><span>'+done+" / "+pages.length+' completed</span></div></div>'+
    '<div class="analytics-page-list">'+PAGES.map(p=>{
      const a=analyticsEntry(p.path), status=analyticsStatus(p.path);
      return '<a class="analytics-row" href="#'+encodeURI(p.path)+'"><span class="analytics-row-main"><strong>'+
        escAnalytics(p.title)+'</strong><small>'+a.visits+(a.visits===1?" visit":" visits")+'</small></span>'+
        '<span class="analytics-minutes" data-page-minutes="'+escAnalytics(p.path)+'">'+fmtMinutes(pageSeconds(p.path))+'</span>'+
        '<span class="analytics-state state-'+status.toLowerCase().replace(" ","-")+'">'+status+'</span></a>';
    }).join("")+'</div>';
  const first=content.firstElementChild;
  if(first) first.insertAdjacentElement("afterend",panel); else content.appendChild(panel);
  updateAnalyticsUI();
}
function updateAnalyticsUI(){
  document.querySelectorAll("[data-page-minutes]").forEach(el=>{
    el.textContent=fmtMinutes(pageSeconds(el.dataset.pageMinutes));
  });
  const current=document.getElementById("pageTimeValue");
  if(current && currentPath) current.textContent=fmtMinutes(pageSeconds(currentPath));
  const total=document.getElementById("analyticsTotalTime");
  if(total) total.textContent=fmtMinutes(PAGES.reduce((sum,p)=>sum+pageSeconds(p.path),0));
}
function initPageAnalytics(){
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden"){
      flushTrackedPage(true); trackedPageStartedAt=null;
    }else{ beginTrackedPage(); updateAnalyticsUI(); }
  });
  window.addEventListener("pagehide",()=>{
    flushTrackedPage(false);
    trackedPageStartedAt=null;
    persistPageAnalytics(trackedPagePath,true);
  });
  analyticsSaveTimer=setInterval(()=>flushTrackedPage(true),15000);
  analyticsPaintTimer=setInterval(updateAnalyticsUI,1000);
}
function persist(change){
  saveStore(STATE);
  if(!remoteReady || location.protocol === "file:" || (!serverHasState && !hasStudyState())) return;
  syncLabel = "saving"; refreshProgressUI();
  const body=JSON.stringify(change || {op:"replace", state:STATE});
  saveQueue=saveQueue.catch(()=>{}).then(async()=>{
    try{
      const r=await fetch("/api/progress", {method:"POST", headers:{"Content-Type":"application/json"}, body});
      if(!r.ok) throw new Error("HTTP "+r.status);
      serverHasState=true; syncLabel="synced";
    }catch(_){ syncLabel="local — sync unavailable"; }
    refreshProgressUI();
  });
}
async function syncProgress(){
  if(location.protocol === "file:") return;
  try{
    const r=await fetch("/api/progress", {cache:"no-store"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const payload=await r.json();
    let migrated=false;
    if(payload.exists){
      const remote=normalizeState(payload.state);
      migrated=mergeLegacyLocal(remote, STATE);
      STATE=remote; saveStore(STATE); serverHasState=true;
    }
    remoteReady=true; syncLabel="synced";
    if((!payload.exists && hasStudyState()) || migrated) persist({op:"replace", state:STATE});
  }catch(_){ remoteReady=true; syncLabel="local — sync unavailable"; }
}
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
  let active=null;
  document.querySelectorAll("nav a.item").forEach(a=>{
    const on=a.dataset.path===path;
    a.classList.toggle("active",on);
    if(on) active=a;
  });
  revealActiveNav(active);
  const pg=byPath[path];
  document.getElementById("tbTitle").textContent = pg ? pg.title : "RAG Prep";
}

function revealActiveNav(active){
  const side=document.getElementById("sidebar");
  if(!side||!active) return;
  requestAnimationFrame(()=>{
    const target=active.offsetTop-(side.clientHeight-active.offsetHeight)/2;
    side.scrollTop=Math.max(0,target);
  });
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
  switchTrackedPage(path);
  currentPath=path;
  setActive(path);
  // tint the page to its section accent (soft tint is translucent → theme-proof)
  const root=document.documentElement.style;
  if(pg.accent){ root.setProperty("--sec-accent", pg.accent); root.setProperty("--sec-accent-soft", hexToRgba(pg.accent, 0.16)); }
  else { root.removeProperty("--sec-accent"); root.removeProperty("--sec-accent-soft"); }
  content.innerHTML=pg.html;
  renderAnalyticsPanel(path);
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
  "kv-cache-widget": initKVCacheWidget,
  "paged-attention-widget": initPagedAttentionWidget,
  "prefill-scheduler-widget": initPrefillSchedulerWidget,
  "continuous-batching-widget": initContinuousBatchingWidget,
  "speculative-widget": initSpeculativeWidget,
  "vllm-journey-widget": initVLLMJourneyWidget,
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

/* --------- KV cache: what is reused, what attention still reads --------- */
function initKVCacheWidget(){
  const host=document.getElementById("kv-cache-widget"); if(!host) return;
  const tokens=["The","bank","approved","the","loan","because","risk","was","low","."];
  host.innerHTML=
   '<div class="bv-wrap kvw-wrap"><div class="bv-controls">'+
     '<div class="lm-row"><label>Execution mode</label><span class="kvw-mode">'+
       '<button class="qz-seg" type="button" data-kvmode="no">No cache</button>'+
       '<button class="qz-seg sel" type="button" data-kvmode="cache">KV cache</button>'+
     '</span></div>'+
     '<div class="bt-sliders"><label for="kvw-step">Generation step <b id="kvw-stepv">5 / 10</b>'+
       '<input id="kvw-step" type="range" min="1" max="10" step="1" value="5"></label></div>'+
   '</div>'+
   '<svg id="kvw-svg" class="kvw-svg" viewBox="0 0 680 240" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="kvw-title kvw-desc"></svg>'+
   '<div class="kvw-legend"><span><i class="kvw-lg-attn"></i>attention read</span><span><i class="kvw-lg-old"></i><b id="kvw-old-label">cached K,V</b></span><span><i class="kvw-lg-new"></i>new K,V</span></div>'+
   '<div class="bv-metrics">'+
     '<div class="bv-m"><span class="bv-mlab">K/V projections now</span><b id="kvw-now">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Cumulative projections</span><b id="kvw-total">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Keys attention reads</span><b id="kvw-attn">—</b></div>'+
   '</div>'+
   '<div class="lm-note kvw-note" id="kvw-note" aria-live="polite"></div></div>';
  let mode="cache";
  const el=id=>host.querySelector("#"+id);
  const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  function compute(){
    const n=+el("kvw-step").value;
    el("kvw-stepv").textContent=n+" / "+tokens.length;
    host.querySelectorAll("[data-kvmode]").forEach(b=>{
      const selected=b.dataset.kvmode===mode;
      b.classList.toggle("sel",selected);
      b.setAttribute("aria-pressed",selected?"true":"false");
    });
    const compact=host.clientWidth<520;
    const W=compact?420:680, center=W/2, qy=168;
    let shown=[];
    if(compact && n>5){
      const grouped=n-4;
      shown.push({idx:grouped-1,label:"tokens 1–"+grouped,kv:"K1…K"+grouped,status:(mode==="cache"?"cached ×":"redo ×")+grouped,group:true});
      for(let i=grouped;i<n;i++) shown.push({idx:i,label:tokens[i],kv:"K"+(i+1)+" · V"+(i+1),status:null,group:false});
    }else{
      for(let i=0;i<n;i++) shown.push({idx:i,label:tokens[i],kv:"K"+(i+1)+" · V"+(i+1),status:null,group:false});
    }
    const gap=Math.min(compact?74:68,(compact?330:590)/Math.max(1,shown.length-1));
    const start=center-((shown.length-1)*gap)/2;
    const qx=start+(shown.length-1)*gap;
    let lines="",nodes="";
    shown.forEach((item,j)=>{
      const i=item.idx, x=start+j*gap;
      lines+='<line class="kvw-attn" x1="'+qx.toFixed(1)+'" y1="'+(qy-16)+'" x2="'+x.toFixed(1)+'" y2="91"/>';
      const current=i===n-1;
      const cls=current?"kvw-current":(mode==="cache"?"kvw-old-cache":"kvw-old-no");
      const status=item.status||(current?"compute":(mode==="cache"?"cache read":"recompute"));
      const boxW=item.group?72:56;
      nodes+='<g class="kvw-node"><rect class="'+cls+'" x="'+(x-boxW/2).toFixed(1)+'" y="30" width="'+boxW+'" height="58" rx="9"/>'+
        '<text class="kvw-token" x="'+x.toFixed(1)+'" y="50">'+esc(item.label)+'</text>'+
        '<text class="kvw-kv" x="'+x.toFixed(1)+'" y="69">'+esc(item.kv)+'</text>'+
        '<text class="kvw-status" x="'+x.toFixed(1)+'" y="108">'+status+'</text></g>';
    });
    const desc=mode==="cache"
      ?"At generation step "+n+", previous key and value vectors are read from the cache. Only the newest token's key and value are projected again. The current query still attends to all "+n+" keys."
      :"At generation step "+n+", key and value vectors for the whole prefix are recomputed. The current query attends to all "+n+" keys.";
    el("kvw-svg").setAttribute("viewBox","0 0 "+W+" 240");
    const caption=compact?"Q"+n+" still reads every key — only old K,V projections are reused.":"Q"+n+" still compares with K1…K"+n+" — the cache removes repeated K,V projection work, not attention reads.";
    el("kvw-svg").innerHTML='<title id="kvw-title">KV cache execution at token '+n+'</title><desc id="kvw-desc">'+desc+'</desc>'+lines+nodes+
      '<g class="kvw-query"><circle cx="'+qx.toFixed(1)+'" cy="'+qy+'" r="21"/><text x="'+qx.toFixed(1)+'" y="'+(qy+5)+'">Q'+n+'</text></g>'+
      '<text class="kvw-caption" x="'+center+'" y="220">'+caption+'</text>';
    const now=mode==="cache"?1:n;
    const total=mode==="cache"?n:n*(n+1)/2;
    el("kvw-now").textContent=now+" pair"+(now===1?"":"s");
    el("kvw-total").textContent=total+" pairs";
    el("kvw-attn").textContent=n+" keys";
    el("kvw-old-label").textContent=mode==="cache"?"cached K,V":"recomputed K,V";
    el("kvw-note").textContent=mode==="cache"
      ?"Token "+n+": read K,V for tokens 1–"+Math.max(0,n-1)+", compute only token "+n+", then compare Q"+n+" with all "+n+" keys. Cache held per layer: "+(2*n)+" vectors (K and V)."
      :"Token "+n+": rebuild K,V for all "+n+" tokens, then compare Q"+n+" with the same "+n+" keys. The wasted projection work grows every step.";
  }
  host.querySelectorAll("[data-kvmode]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.kvmode;compute();}));
  el("kvw-step").addEventListener("input",compute);
  compute();
}

/* --------- PagedAttention: pack live KV blocks instead of max reservations --------- */
function initPagedAttentionWidget(){
  const host=document.getElementById("paged-attention-widget"); if(!host) return;
  const shapes={short:[2,1,3,2],mixed:[6,3,8,2],long:[9,8,10,7]};
  const names=["A","B","C","D"];
  host.innerHTML=
   '<div class="bv-wrap vli-wrap"><div class="bv-controls">'+
     '<div class="lm-row"><label>Memory layout</label><span class="vli-buttons">'+
       '<button class="qz-seg" type="button" data-pamode="contiguous">Max-size reservations</button>'+
       '<button class="qz-seg sel" type="button" data-pamode="paged">PagedAttention</button></span></div>'+
     '<div class="lm-row"><label>Request lengths</label><span class="vli-buttons">'+
       '<button class="qz-seg" type="button" data-pashape="short">Short</button>'+
       '<button class="qz-seg sel" type="button" data-pashape="mixed">Mixed</button>'+
       '<button class="qz-seg" type="button" data-pashape="long">Near max</button></span></div>'+
   '</div><div id="pa-memory" class="pa-memory" role="img"></div>'+
   '<div class="pa-legend"><span><i class="pa-used"></i>live KV</span><span><i class="pa-waste"></i>reserved but unused</span><span><i class="pa-free"></i>free</span></div>'+
   '<div class="bv-metrics">'+
     '<div class="bv-m"><span class="bv-mlab">Live KV tokens</span><b id="pa-used">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Slots reserved</span><b id="pa-reserved">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Memory waste</span><b id="pa-waste">—</b></div>'+
   '</div><div class="lm-note" id="pa-note" aria-live="polite"></div></div>';
  let mode="paged",shape="mixed";
  const el=id=>host.querySelector("#"+id);
  function makeBlock(owner,usedSlots,kind,index){
    const label=owner?owner+(index+1):"free";
    let html='<div class="pa-block '+(owner?"":"is-free")+'" aria-label="'+label+'">';
    for(let s=0;s<2;s++) html+='<span class="'+(s<usedSlots?"is-used":kind)+'"></span>';
    return html+'<b>'+(owner?label:"")+'</b></div>';
  }
  function compute(){
    const lengths=shapes[shape], used=lengths.reduce((a,b)=>a+b,0);
    let blocks=[];
    if(mode==="contiguous"){
      lengths.forEach((len,r)=>{
        for(let b=0;b<5;b++) blocks.push(makeBlock(names[r],Math.max(0,Math.min(2,len-b*2)),"is-waste",b));
      });
    }else{
      const remaining=lengths.map(n=>Math.ceil(n/2)), sequence=[];
      let left=remaining.reduce((a,b)=>a+b,0);
      while(left){
        remaining.forEach((n,r)=>{if(n>0){sequence.push(r);remaining[r]--;left--;}});
      }
      const seen=[0,0,0,0];
      sequence.forEach(r=>{
        const blockIndex=seen[r]++, filled=Math.min(2,lengths[r]-blockIndex*2);
        blocks.push(makeBlock(names[r],filled,"is-waste",blockIndex));
      });
      while(blocks.length<20) blocks.push(makeBlock("",0,"is-free",0));
    }
    el("pa-memory").innerHTML=blocks.join("");
    const reserved=mode==="contiguous"?40:lengths.reduce((n,x)=>n+Math.ceil(x/2)*2,0);
    const waste=reserved-used;
    el("pa-memory").setAttribute("aria-label",(mode==="paged"?"PagedAttention":"Contiguous reservation")+" memory map. "+used+" live token slots, "+reserved+" reserved, "+waste+" wasted.");
    el("pa-used").textContent=used+" / 40";
    el("pa-reserved").textContent=reserved+" / 40";
    el("pa-waste").textContent=waste+" slots";
    host.querySelectorAll("[data-pamode]").forEach(b=>{const on=b.dataset.pamode===mode;b.classList.toggle("sel",on);b.setAttribute("aria-pressed",on?"true":"false");});
    host.querySelectorAll("[data-pashape]").forEach(b=>{const on=b.dataset.pashape===shape;b.classList.toggle("sel",on);b.setAttribute("aria-pressed",on?"true":"false");});
    el("pa-note").textContent=mode==="paged"
      ?"Requests A–D own small physical blocks that can sit anywhere. Only their current pages are allocated; the only waste is the unused tail of a partly filled page."
      :"Each request reserves 10 contiguous token slots up front. Short requests leave most of that reservation unusable by another request until they finish.";
  }
  host.querySelectorAll("[data-pamode]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.pamode;compute();}));
  host.querySelectorAll("[data-pashape]").forEach(b=>b.addEventListener("click",()=>{shape=b.dataset.pashape;compute();}));
  compute();
}

/* --------- Prefill scheduler: one long prompt vs active token streams --------- */
function initPrefillSchedulerWidget(){
  const host=document.getElementById("prefill-scheduler-widget"); if(!host) return;
  host.innerHTML=
   '<div class="bv-wrap vli-wrap"><div class="bv-controls">'+
     '<div class="lm-row"><label>Prefill policy</label><span class="vli-buttons">'+
       '<button class="qz-seg" type="button" data-pfmode="full">Full prefill</button>'+
       '<button class="qz-seg sel" type="button" data-pfmode="chunked">Chunked prefill</button></span></div>'+
     '<div class="bt-sliders"><label for="pf-step">Time slice <b id="pf-stepv">5 / 8</b><input id="pf-step" type="range" min="1" max="8" step="1" value="5"></label></div>'+
   '</div><svg id="pf-svg" class="vli-svg" viewBox="0 0 680 220" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="pf-title pf-desc"></svg>'+
   '<div class="bv-metrics">'+
     '<div class="bv-m"><span class="bv-mlab">Stream tokens sent</span><b id="pf-decodes">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Long prompt done</span><b id="pf-progress">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Longest stream pause</span><b id="pf-pause">—</b></div>'+
   '</div><div class="lm-note" id="pf-note" aria-live="polite"></div></div>';
  let mode="chunked";
  const el=id=>host.querySelector("#"+id);
  function compute(){
    const step=+el("pf-step").value, compact=host.clientWidth<520;
    const W=compact?430:680, left=compact?86:116, right=12, cols=8, gap=(W-left-right)/cols;
    const decode=mode==="full"?Math.max(0,step-Math.min(3,Math.max(0,step-2))):step;
    const progress=mode==="full"?Math.max(0,Math.min(100,(step-2)*34)):Math.max(0,Math.min(100,(step-2)*25));
    let svg='<title id="pf-title">Prefill and decode scheduling through time slice '+step+'</title><desc id="pf-desc">'+
      (mode==="full"?"A full prefill blocks active decode between slices three and five.":"Four smaller prefill chunks share slices with active decode so streaming continues.")+'</desc>';
    ["active chats · decode","new long prompt · prefill"].forEach((label,row)=>{
      svg+='<text class="vli-lane-label" x="'+(left-8)+'" y="'+(row?142:72)+'">'+label+'</text>';
    });
    for(let i=1;i<=cols;i++){
      const x=left+(i-1)*gap;
      svg+='<text class="vli-axis-label" x="'+(x+gap/2)+'" y="198">'+i+'</text>';
      if(i===step) svg+='<rect class="vli-cursor" x="'+(x+2)+'" y="27" width="'+(gap-4)+'" height="148" rx="7"/>';
      const blocked=mode==="full"&&i>=3&&i<=5;
      svg+='<rect class="vli-cell '+(blocked?"is-wait":"is-decode")+'" x="'+(x+5)+'" y="48" width="'+(gap-10)+'" height="34" rx="6"/>'+
        '<text class="vli-cell-label" x="'+(x+gap/2)+'" y="69">'+(blocked?"wait":"D"+i)+'</text>';
      if(mode==="chunked"&&i>=3&&i<=6){
        svg+='<rect class="vli-cell is-prefill" x="'+(x+5)+'" y="118" width="'+(gap-10)+'" height="34" rx="6"/><text class="vli-cell-label" x="'+(x+gap/2)+'" y="139">P'+(i-2)+'</text>';
      }
    }
    if(mode==="full"){
      const x=left+2*gap;
      svg+='<rect class="vli-cell is-prefill" x="'+(x+5)+'" y="118" width="'+(3*gap-10)+'" height="34" rx="6"/><text class="vli-cell-label" x="'+(x+1.5*gap)+'" y="139">one long prefill</text>';
    }
    svg+='<text class="vli-axis-title" x="'+((left+W-right)/2)+'" y="216">time slice →</text>';
    el("pf-svg").setAttribute("viewBox","0 0 "+W+" 220"); el("pf-svg").innerHTML=svg;
    el("pf-stepv").textContent=step+" / 8";
    el("pf-decodes").textContent=decode+" tokens";
    el("pf-progress").textContent=Math.round(progress)+"%";
    el("pf-pause").textContent=mode==="full"?"3 slices":"0 slices";
    host.querySelectorAll("[data-pfmode]").forEach(b=>{const on=b.dataset.pfmode===mode;b.classList.toggle("sel",on);b.setAttribute("aria-pressed",on?"true":"false");});
    el("pf-note").textContent=mode==="full"
      ?"The new prompt finishes prefill sooner (first token after slice 5), but active streams emit nothing for three slices: a head-of-line ITL spike."
      :"Decode keeps its place every slice; spare token budget advances one prefill chunk. Existing streams stay smooth, while the long request's first token moves to after slice 6.";
  }
  host.querySelectorAll("[data-pfmode]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.pfmode;compute();}));
  el("pf-step").addEventListener("input",compute); compute();
}

/* --------- Continuous batching: refill a sequence slot as soon as it frees --------- */
function initContinuousBatchingWidget(){
  const host=document.getElementById("continuous-batching-widget"); if(!host) return;
  const schedules={
    static:[["A","A","A","A","A","A","D","D","D","D"],["B","B","B",null,null,null,"E","E",null,null],["C","C","C","C",null,null,"F","F","F",null]],
    continuous:[["A","A","A","A","A","A",null,null,null,null],["B","B","B","D","D","D","D",null,null,null],["C","C","C","C","E","E","F","F","F",null]]
  };
  const finished={static:{B:3,C:4,A:6,E:8,F:9,D:10},continuous:{B:3,C:4,E:6,A:6,D:7,F:9}};
  host.innerHTML=
   '<div class="bv-wrap vli-wrap"><div class="bv-controls">'+
     '<div class="lm-row"><label>Batch policy</label><span class="vli-buttons">'+
       '<button class="qz-seg" type="button" data-cbmode="static">Static</button>'+
       '<button class="qz-seg sel" type="button" data-cbmode="continuous">Continuous</button></span></div>'+
     '<div class="bt-sliders"><label for="cb-step">Decode iteration <b id="cb-stepv">6 / 10</b><input id="cb-step" type="range" min="1" max="10" step="1" value="6"></label></div>'+
   '</div><svg id="cb-svg" class="vli-svg" viewBox="0 0 680 230" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="cb-title cb-desc"></svg>'+
   '<div class="bv-metrics">'+
     '<div class="bv-m"><span class="bv-mlab">Completed requests</span><b id="cb-done">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Idle slot-steps</span><b id="cb-idle">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Queue now</span><b id="cb-queue">—</b></div>'+
   '</div><div class="lm-note" id="cb-note" aria-live="polite"></div></div>';
  let mode="continuous";
  const el=id=>host.querySelector("#"+id);
  function compute(){
    const step=+el("cb-step").value, compact=host.clientWidth<520, schedule=schedules[mode];
    const start=compact?Math.max(1,step-5):1, end=compact?Math.max(6,step):10, cols=end-start+1;
    const W=compact?430:680,left=compact?66:88,right=12,gap=(W-left-right)/cols;
    let svg='<title id="cb-title">'+(mode==="continuous"?"Continuous":"Static")+' batching through iteration '+step+'</title><desc id="cb-desc">Three GPU sequence slots. '+(mode==="continuous"?"New requests refill slots immediately.":"Finished slots stay idle until the longest request in the batch finishes.")+'</desc>';
    for(let t=start;t<=end;t++){
      const x=left+(t-start)*gap;
      if(t===step) svg+='<rect class="vli-cursor" x="'+(x+2)+'" y="24" width="'+(gap-4)+'" height="154" rx="7"/>';
      svg+='<text class="vli-axis-label" x="'+(x+gap/2)+'" y="202">'+t+'</text>';
    }
    schedule.forEach((lane,r)=>{
      svg+='<text class="vli-lane-label" x="'+(left-8)+'" y="'+(59+r*47)+'">slot '+(r+1)+'</text>';
      for(let t=start;t<=end;t++){
        const x=left+(t-start)*gap, req=lane[t-1], future=t>step;
        svg+='<rect class="vli-cell '+(future?"is-future":req?"is-decode":"is-wait")+'" x="'+(x+5)+'" y="'+(38+r*47)+'" width="'+(gap-10)+'" height="32" rx="6"/>'+
          '<text class="vli-cell-label" x="'+(x+gap/2)+'" y="'+(59+r*47)+'">'+(future?"":req||"idle")+'</text>';
      }
    });
    svg+='<text class="vli-axis-title" x="'+((left+W-right)/2)+'" y="222">decode iteration →</text>';
    el("cb-svg").setAttribute("viewBox","0 0 "+W+" 230"); el("cb-svg").innerHTML=svg;
    let idle=0; schedule.forEach(lane=>{for(let t=0;t<step;t++) if(!lane[t]) idle++;});
    const done=Object.values(finished[mode]).filter(t=>t<=step).length;
    const admitted=new Set(); schedule.forEach(l=>l.slice(0,step).forEach(x=>{if(x)admitted.add(x);}));
    el("cb-stepv").textContent=step+" / 10";
    el("cb-done").textContent=done+" / 6";
    el("cb-idle").textContent=idle;
    el("cb-queue").textContent=Math.max(0,6-admitted.size)+" requests";
    host.querySelectorAll("[data-cbmode]").forEach(b=>{const on=b.dataset.cbmode===mode;b.classList.toggle("sel",on);b.setAttribute("aria-pressed",on?"true":"false");});
    el("cb-note").textContent=mode==="continuous"
      ?"B finishes after iteration 3, so D starts in that slot at iteration 4. C's slot takes E, then F—admission happens between token steps."
      :"B and C finish early, but their GPU slots remain idle until A ends the batch at iteration 6. Only then can D, E, and F enter.";
  }
  host.querySelectorAll("[data-cbmode]").forEach(b=>b.addEventListener("click",()=>{mode=b.dataset.cbmode;compute();}));
  el("cb-step").addEventListener("input",compute); compute();
}

/* --------- Speculative decoding: accepted prefix from one target verification --------- */
function initSpeculativeWidget(){
  const host=document.getElementById("speculative-widget"); if(!host) return;
  const tokens=["the","loan","was","approved","today","."];
  host.innerHTML=
   '<div class="bv-wrap vli-wrap"><div class="bv-controls">'+
     '<div class="lm-row"><label>Draft agreement</label><span class="vli-buttons">'+
       '<button class="qz-seg" type="button" data-spquality="low">Low</button>'+
       '<button class="qz-seg sel" type="button" data-spquality="medium">Medium</button>'+
       '<button class="qz-seg" type="button" data-spquality="high">High</button></span></div>'+
     '<div class="bt-sliders"><label for="sp-count">Draft tokens proposed <b id="sp-countv">5</b><input id="sp-count" type="range" min="2" max="6" step="1" value="5"></label></div>'+
   '</div><div class="sp-flow" role="img" id="sp-flow"></div>'+
   '<div class="bv-metrics">'+
     '<div class="bv-m"><span class="bv-mlab">Draft prefix accepted</span><b id="sp-accepted">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Tokens committed</span><b id="sp-committed">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Large-model passes</span><b id="sp-passes">—</b></div>'+
   '</div><div class="lm-note" id="sp-note" aria-live="polite"></div></div>';
  let quality="medium";
  const el=id=>host.querySelector("#"+id);
  function compute(){
    const count=+el("sp-count").value;
    let accepted=quality==="low"?1:quality==="medium"?Math.min(3,count):count-(count>4?1:0);
    accepted=Math.min(count,accepted);
    const all=accepted===count, committed=all?count:accepted+1;
    let draft='<div class="sp-stage-label">small draft model proposes</div><div class="sp-tokens">';
    for(let i=0;i<count;i++){
      const cls=i<accepted?"is-accepted":i===accepted?"is-rejected":"is-discarded";
      const mark=i<accepted?"✓":i===accepted?"✕":"—";
      draft+='<span class="sp-token '+cls+'"><b>'+tokens[i]+'</b><small>'+mark+'</small></span>';
    }
    draft+='</div><div class="sp-arrow">target model verifies the whole block in one pass ↓</div><div class="sp-result">';
    for(let i=0;i<accepted;i++) draft+='<span class="sp-token is-accepted"><b>'+tokens[i]+'</b><small>kept</small></span>';
    if(!all) draft+='<span class="sp-token is-correction"><b>application</b><small>target correction</small></span>';
    draft+='</div>';
    el("sp-flow").innerHTML=draft;
    el("sp-flow").setAttribute("aria-label",count+" draft tokens proposed. "+accepted+" accepted before the first rejection. "+committed+" tokens committed using one target-model verification pass.");
    el("sp-countv").textContent=count;
    el("sp-accepted").textContent=accepted+" / "+count;
    el("sp-committed").textContent=committed;
    el("sp-passes").textContent="1 vs "+committed;
    host.querySelectorAll("[data-spquality]").forEach(b=>{const on=b.dataset.spquality===quality;b.classList.toggle("sel",on);b.setAttribute("aria-pressed",on?"true":"false");});
    el("sp-note").textContent=all
      ?"Every proposal agrees, so one target pass commits the whole block. Real speedup still subtracts the draft model and verification overhead."
      :"Verification accepts only the contiguous prefix. The first mismatch is replaced by the target token and everything after it is discarded; low acceptance can cost more than ordinary decoding.";
  }
  host.querySelectorAll("[data-spquality]").forEach(b=>b.addEventListener("click",()=>{quality=b.dataset.spquality;compute();}));
  el("sp-count").addEventListener("input",compute); compute();
}

/* --------- Beginner map: follow one request through vLLM --------- */
function initVLLMJourneyWidget(){
  const host=document.getElementById("vllm-journey-widget"); if(!host) return;
  const stages=[
    {name:"Request",sub:"prompt enters",note:"The app sends token IDs and generation settings; vLLM queues the request but does not change the model or prompt."},
    {name:"Prefill",sub:"process prompt",note:"Like one dense CV forward pass over all image patches: prompt tokens run in parallel and create the first KV state."},
    {name:"KV pages",sub:"store history",note:"Like cached feature maps stored in small tiles: old K/V tensors stay in VRAM so decode does not rebuild them."},
    {name:"Decode batch",sub:"one next token",note:"Each iteration advances every active sequence by one token; a finished slot can immediately admit another request."},
    {name:"Speculate",sub:"optional shortcut",note:"A small draft proposes several future tokens; the target verifies the block and keeps only the accepted prefix."}
  ];
  host.innerHTML=
   '<div class="bv-wrap vj-wrap"><div class="lm-row"><label>Follow one request</label><span class="vli-buttons">'+
     stages.map((s,i)=>'<button class="qz-seg'+(i===0?' sel':'')+'" type="button" data-vjstep="'+i+'">'+(i+1)+' · '+s.name+'</button>').join('')+
   '</span></div><div class="vj-track" id="vj-track" role="img"></div><div class="lm-note vj-note" id="vj-note" aria-live="polite"></div></div>';
  let current=0;
  const track=host.querySelector("#vj-track"), note=host.querySelector("#vj-note");
  function compute(){
    let html='';
    stages.forEach((s,i)=>{
      html+='<div class="vj-stage'+(i===current?' is-active':'')+(i<current?' is-done':'')+'"><span>'+(i+1)+'</span><b>'+s.name+'</b><small>'+s.sub+'</small></div>';
      if(i<stages.length-1) html+='<i class="vj-arrow" aria-hidden="true">→</i>';
    });
    track.innerHTML=html;
    track.setAttribute("aria-label","Request journey, step "+(current+1)+" of "+stages.length+": "+stages[current].name+". "+stages[current].note);
    note.textContent=stages[current].note;
    host.querySelectorAll("[data-vjstep]").forEach(b=>{const on=+b.dataset.vjstep===current;b.classList.toggle("sel",on);b.setAttribute("aria-pressed",on?"true":"false");});
  }
  host.querySelectorAll("[data-vjstep]").forEach(b=>b.addEventListener("click",()=>{current=+b.dataset.vjstep;compute();}));
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
  persist({op:"set", field:"cards", key, value:g});
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
function setDone(path, v){ if(v) STATE.done[path]=true; else delete STATE.done[path]; persist({op:"set", field:"done", key:path, value:v}); refreshProgressUI(); renderResume(); }
function markVisited(path){
  if(path!=="README.md"){
    STATE.last=path;
    persist({op:"set", field:"last", value:path});
  } else saveStore(STATE);
  setActiveDone();
  renderPageStatus(path);
  refreshProgressUI();
  renderResume();
}
// count only real content pages (exclude the home overview) toward totals
function progressPages(){ return PAGES.filter(p=>p.path!=="README.md"); }
function refreshProgressUI(){
  const all=progressPages();
  const done=all.filter(p=>isDone(p.path)).length;
  const pct=all.length?Math.round(done/all.length*100):0;
  const bar=document.getElementById("progBar"), lbl=document.getElementById("progLbl");
  if(bar) bar.style.width=pct+"%";
  if(lbl) lbl.textContent=done+" / "+all.length+" pages · "+pct+"% · "+syncLabel;
  // per-item checks + per-section counts in the nav
  document.querySelectorAll("nav a.item").forEach(a=>{
    a.classList.toggle("done", isDone(a.dataset.path));
    a.classList.toggle("pinned", !!STATE.pins[a.dataset.path]);
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
  const pinned=!!STATE.pins[path];
  const strip=document.createElement("div");
  strip.className="page-status";
  strip.innerHTML='<div class="page-time-summary"><span>Time on this page</span><strong id="pageTimeValue">'+
    fmtMinutes(pageSeconds(path))+'</strong></div>'+
    '<button class="complete-btn'+(done?" is-done":"")+'" id="completeBtn">'+
    (done?"✓ Completed — click to unmark":"Mark this page complete")+'</button>'+
    '<button class="pin-btn'+(pinned?" is-pinned":"")+'" id="pinBtn" aria-pressed="'+pinned+'">'+
    (pinned?"★ Pinned":"☆ Pin page")+'</button>';
  host.parentNode.insertBefore(strip, host);
  strip.querySelector("#completeBtn").onclick=()=>{
    setDone(path, !isDone(path));
    renderPager(path);            // re-render pager block…
    const old=document.querySelector(".page-status"); if(old) old.remove();
    renderPageStatus(path);       // …and this strip
  };
  strip.querySelector("#pinBtn").onclick=()=>{
    const value=!STATE.pins[path];
    if(value) STATE.pins[path]=true; else delete STATE.pins[path];
    persist({op:"set", field:"pins", key:path, value}); refreshProgressUI(); renderResume(); renderPageStatus(path);
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

/* ---------------------- navigation visibility + drawer --------------------- */
const sidebar=document.getElementById("sidebar"), scrim=document.getElementById("scrim");
const appShell=document.querySelector(".app"), navMedia=matchMedia("(max-width:880px)");
const NAV_HIDDEN_KEY="koi-nav-hidden-v1";
let navHiddenPreference=false;
try{navHiddenPreference=localStorage.getItem(NAV_HIDDEN_KEY)==="1";}catch(_){}
function saveNavPreference(){try{localStorage.setItem(NAV_HIDDEN_KEY,navHiddenPreference?"1":"0");}catch(_){}}
function applyNavPreference(){
  const collapsed=!navMedia.matches&&navHiddenPreference;
  appShell.classList.toggle("nav-hidden",collapsed);
  const show=document.getElementById("navShow");
  if(show) show.setAttribute("aria-expanded",collapsed?"false":"true");
}
function openSidebar(){sidebar.classList.add("open");scrim.classList.add("show");revealActiveNav(document.querySelector("nav a.item.active"));}
function closeSidebar(){sidebar.classList.remove("open");scrim.classList.remove("show");}
document.getElementById("navHide").addEventListener("click",()=>{
  if(navMedia.matches){closeSidebar();return;}
  navHiddenPreference=true;saveNavPreference();applyNavPreference();
});
document.getElementById("navShow").addEventListener("click",()=>{
  navHiddenPreference=false;saveNavPreference();applyNavPreference();
  revealActiveNav(document.querySelector("nav a.item.active"));
});
if(navMedia.addEventListener) navMedia.addEventListener("change",applyNavPreference);
else navMedia.addListener(applyNavPreference);
applyNavPreference();
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

/* ------------------------- resume + pinned shortcuts ---------------------- */
function resumePage(){
  const last=STATE.last && byPath[STATE.last];
  if(last && last.path!=="README.md" && !isDone(last.path)) return last;
  const pages=progressPages();
  if(!pages.length) return null;
  const lastIndex=last ? PAGES.findIndex(p=>p.path===last.path) : -1;
  return pages.find(p=>PAGES.indexOf(p)>lastIndex && !isDone(p.path)) || pages.find(p=>!isDone(p.path)) || null;
}
function renderResume(){
  const slot=document.getElementById("resumeSlot"); if(!slot) return;
  const resume=resumePage();
  const pinned=PAGES.filter(p=>STATE.pins[p.path]);
  let html="";
  if(resume && resume.path!==currentPath){
    html+='<a class="resume-link" href="#'+encodeURI(resume.path)+'">→ Continue: '+resume.title+'</a>';
  }
  if(pinned.length){
    html+='<div class="pinned-block"><div class="pinned-title">Pinned pages</div>'+pinned.map(p=>
      '<a class="pinned-link" href="#'+encodeURI(p.path)+'"><span>★</span>'+p.title+'</a>').join("")+'</div>';
  }
  slot.innerHTML=html;
}

/* ----------------------------------- init ---------------------------------- */
buildNav();
initTimer();
initPageAnalytics();
refreshProgressUI();
renderResume();
window.addEventListener("hashchange", onHash);
syncProgress().finally(()=>{ refreshProgressUI(); renderResume(); onHash(); });
