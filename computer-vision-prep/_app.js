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
  s.last = typeof s.last === "string" ? s.last : null;
  return s;
}
STATE = normalizeState(STATE);
function hasStudyState(){
  return Object.keys(STATE.done).length || Object.keys(STATE.cards).length || Object.keys(STATE.pins).length;
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
  return changed;
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
  document.getElementById("tbTitle").textContent = pg ? pg.title : "Video Intel Prep";
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
  "iou-widget":     initIoUWidget,
  "latency-widget": initLatencyWidget,
  "camera-widget":  initCameraWidget,
  "conv-widget":    initConvWidget,
};
function mountWidgets(){
  for(const id in WIDGETS){
    if(document.getElementById(id)){ try{ WIDGETS[id](); }catch(e){ console.error("widget "+id, e); } }
  }
}

/* ===================== CV interactive-learning widgets ==================== */

/* -------- IoU explorer: drag a prediction box against ground truth -------- */
function initIoUWidget(){
  const host=document.getElementById("iou-widget"); if(!host) return;
  const W=340,H=240, A={x:95,y:65,w:150,h:110};   // fixed ground-truth box
  host.innerHTML=
   '<div class="bv-wrap"><svg class="bv-svg iou-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+
     '<rect id="iou-inter" class="iou-inter"/>'+
     '<rect x="'+A.x+'" y="'+A.y+'" width="'+A.w+'" height="'+A.h+'" class="iou-a"/>'+
     '<rect id="iou-b" class="iou-b"/>'+
     '<text x="'+(A.x+7)+'" y="'+(A.y+17)+'" class="iou-tag-a">ground truth</text>'+
     '<text id="iou-blbl" class="iou-tag-b">prediction</text>'+
   '</svg>'+
   '<div class="bv-controls"><div class="bt-sliders">'+
     '<label>Prediction offset X <b id="iou-dxv">45</b> px<input id="iou-dx" type="range" min="-150" max="150" step="1" value="45"></label>'+
     '<label>Prediction offset Y <b id="iou-dyv">25</b> px<input id="iou-dy" type="range" min="-95" max="95" step="1" value="25"></label>'+
     '<label>Prediction size <b id="iou-sv">1.00</b>×<input id="iou-s" type="range" min="0.4" max="1.8" step="0.05" value="1"></label>'+
   '</div>'+
   '<div class="bv-metrics">'+
     '<div class="bv-m"><span class="bv-mlab">IoU</span><b id="iou-val">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Overlap of GT</span><b id="iou-ov">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">@ 0.5 threshold</span><b id="iou-verdict" class="bv-diag">—</b></div>'+
   '</div></div></div>';
  const el=id=>host.querySelector("#"+id);
  function compute(){
    const dx=+el("iou-dx").value, dy=+el("iou-dy").value, s=+el("iou-s").value;
    const B={x:A.x+dx, y:A.y+dy, w:A.w*s, h:A.h*s};
    const b=el("iou-b");
    b.setAttribute("x",B.x); b.setAttribute("y",B.y); b.setAttribute("width",B.w); b.setAttribute("height",B.h);
    el("iou-blbl").setAttribute("x",B.x+7); el("iou-blbl").setAttribute("y",B.y+17);
    const ix=Math.max(A.x,B.x), iy=Math.max(A.y,B.y);
    const iw=Math.max(0,Math.min(A.x+A.w,B.x+B.w)-ix), ih=Math.max(0,Math.min(A.y+A.h,B.y+B.h)-iy);
    const inter=iw*ih, uni=A.w*A.h+B.w*B.h-inter, iou=uni>0?inter/uni:0;
    const ir=el("iou-inter");
    ir.setAttribute("x",ix); ir.setAttribute("y",iy); ir.setAttribute("width",iw); ir.setAttribute("height",ih);
    el("iou-dxv").textContent=dx; el("iou-dyv").textContent=dy; el("iou-sv").textContent=s.toFixed(2);
    el("iou-val").textContent=iou.toFixed(2);
    el("iou-ov").textContent=(inter/(A.w*A.h)*100).toFixed(0)+"%";
    const v=el("iou-verdict"), ok=iou>=0.5;
    v.textContent=ok?"match ✓":"miss ✗"; v.className="bv-diag "+(ok?"bv-good":"bv-bad");
  }
  ["iou-dx","iou-dy","iou-s"].forEach(id=>el(id).addEventListener("input",compute));
  compute();
}

/* --------- Latency budget: do the pipeline stages fit the frame? --------- */
function initLatencyWidget(){
  const host=document.getElementById("latency-widget"); if(!host) return;
  host.innerHTML=
   '<div class="bv-wrap"><div class="bv-controls">'+
     '<div class="lm-row"><label>Target frame rate</label><span>'+
       '<button class="qz-seg" data-fps="15">15 fps</button>'+
       '<button class="qz-seg sel" data-fps="30">30 fps</button>'+
       '<button class="qz-seg" data-fps="60">60 fps</button></span></div>'+
     '<div class="bt-sliders">'+
       '<label>Decode <b id="lat-dv">6</b> ms<input id="lat-d" type="range" min="0" max="40" step="0.5" value="6"></label>'+
       '<label>Preprocess <b id="lat-pv">3</b> ms<input id="lat-p" type="range" min="0" max="40" step="0.5" value="3"></label>'+
       '<label>Inference <b id="lat-iv">14</b> ms<input id="lat-i" type="range" min="0" max="90" step="0.5" value="14"></label>'+
       '<label>Postprocess <b id="lat-ov">2</b> ms<input id="lat-o" type="range" min="0" max="40" step="0.5" value="2"></label>'+
     '</div>'+
     '<div class="lm-stack lat-stack" id="lat-stack"></div>'+
     '<div class="lat-legend" id="lat-legend"></div>'+
     '<div class="bv-metrics">'+
       '<div class="bv-m"><span class="bv-mlab">Total</span><b id="lat-total">—</b></div>'+
       '<div class="bv-m"><span class="bv-mlab">Frame budget</span><b id="lat-budget">—</b></div>'+
       '<div class="bv-m"><span class="bv-mlab">Max FPS</span><b id="lat-maxfps">—</b></div>'+
       '<div class="bv-m"><span class="bv-mlab">Verdict</span><b id="lat-verdict" class="bv-diag">—</b></div>'+
     '</div></div></div>';
  let fps=30; const el=id=>host.querySelector("#"+id);
  const names=["Decode","Preprocess","Inference","Postprocess"], cols=["#3b82f6","#0e8f8f","var(--accent)","#9a5cd0"];
  function compute(){
    const parts=[+el("lat-d").value,+el("lat-p").value,+el("lat-i").value,+el("lat-o").value];
    el("lat-dv").textContent=parts[0]; el("lat-pv").textContent=parts[1]; el("lat-iv").textContent=parts[2]; el("lat-ov").textContent=parts[3];
    const total=parts.reduce((a,b)=>a+b,0), budget=1000/fps, scale=Math.max(total,budget)||1;
    el("lat-stack").innerHTML=parts.map((v,k)=>'<div class="lm-seg" style="width:'+(v/scale*100)+'%;background:'+cols[k]+'">'+(v/scale>0.09?v:'')+'</div>').join("")+
      '<div class="lat-mark" style="left:'+(budget/scale*100)+'%"></div>';
    el("lat-legend").innerHTML=names.map((n,k)=>'<span><i style="background:'+cols[k]+'"></i>'+n+'</span>').join("")+'<span><i class="lat-mk"></i>budget</span>';
    el("lat-total").textContent=total.toFixed(1)+" ms";
    el("lat-budget").textContent=budget.toFixed(1)+" ms";
    el("lat-maxfps").textContent=(total>0?(1000/total).toFixed(0):"∞")+" fps";
    const v=el("lat-verdict"), ok=total<=budget;
    v.textContent=ok?("fits ✓ +"+(budget-total).toFixed(1)+"ms"):("over "+(total-budget).toFixed(1)+"ms");
    v.className="bv-diag "+(ok?"bv-good":"bv-bad");
  }
  host.querySelectorAll(".qz-seg").forEach(b=>b.onclick=()=>{fps=+b.dataset.fps;host.querySelectorAll(".qz-seg").forEach(x=>x.classList.toggle("sel",x===b));compute();});
  ["lat-d","lat-p","lat-i","lat-o"].forEach(id=>el(id).addEventListener("input",compute));
  compute();
}

/* --------- Camera pinhole: pixels <-> metres for a CCTV view --------- */
function initCameraWidget(){
  const host=document.getElementById("camera-widget"); if(!host) return;
  host.innerHTML=
   '<div class="bv-wrap"><div class="bv-controls"><div class="bt-sliders">'+
     '<label>Focal length <b id="cam-fv">900</b> px<input id="cam-f" type="range" min="300" max="2400" step="10" value="900"></label>'+
     '<label>Image width <b id="cam-wv">1920</b> px<input id="cam-w" type="range" min="640" max="3840" step="16" value="1920"></label>'+
     '<label>Object height <b id="cam-hv">1.7</b> m<input id="cam-h" type="range" min="0.3" max="4" step="0.1" value="1.7"></label>'+
     '<label>Distance <b id="cam-dv">12</b> m<input id="cam-d" type="range" min="2" max="80" step="1" value="12"></label>'+
   '</div>'+
   '<div class="bv-metrics">'+
     '<div class="bv-m"><span class="bv-mlab">Projected height</span><b id="cam-px">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Horizontal FOV</span><b id="cam-fov">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Ground per pixel</span><b id="cam-gsd">—</b></div>'+
   '</div>'+
   '<div class="lm-note" id="cam-note"></div></div></div>';
  const el=id=>host.querySelector("#"+id);
  function compute(){
    const f=+el("cam-f").value,Wp=+el("cam-w").value,Hm=+el("cam-h").value,d=+el("cam-d").value;
    el("cam-fv").textContent=f; el("cam-wv").textContent=Wp; el("cam-hv").textContent=Hm.toFixed(1); el("cam-dv").textContent=d;
    const px=f*Hm/d, fov=2*Math.atan(Wp/(2*f))*180/Math.PI, gsd=d/f;
    el("cam-px").textContent=px.toFixed(0)+" px";
    el("cam-fov").textContent=fov.toFixed(0)+"°";
    el("cam-gsd").textContent=(gsd*100).toFixed(1)+" cm";
    el("cam-note").textContent="A "+Hm.toFixed(1)+" m object at "+d+" m projects to ≈ "+px.toFixed(0)+" px tall; each pixel covers ≈ "+(gsd*100).toFixed(1)+" cm of ground. Double the distance → half the size (the pinhole 1/d law that underlies calibration and crowd density).";
  }
  ["cam-f","cam-w","cam-h","cam-d"].forEach(id=>el(id).addEventListener("input",compute));
  compute();
}

/* --------- Conv sizing: output size + receptive field per layer --------- */
function initConvWidget(){
  const host=document.getElementById("conv-widget"); if(!host) return;
  host.innerHTML=
   '<div class="bv-wrap"><div class="bv-controls"><div class="bt-sliders">'+
     '<label>Input size <b id="cv-nv">224</b> px<input id="cv-n" type="range" min="32" max="512" step="16" value="224"></label>'+
     '<label>Kernel <b id="cv-kv">3</b><input id="cv-k" type="range" min="1" max="11" step="2" value="3"></label>'+
     '<label>Stride <b id="cv-sv">2</b><input id="cv-s" type="range" min="1" max="4" step="1" value="2"></label>'+
     '<label>Padding <b id="cv-pv">1</b><input id="cv-p" type="range" min="0" max="5" step="1" value="1"></label>'+
     '<label>Layers <b id="cv-lv">5</b><input id="cv-l" type="range" min="1" max="10" step="1" value="5"></label>'+
   '</div>'+
   '<div class="conv-chain" id="cv-chain"></div>'+
   '<div class="bv-metrics">'+
     '<div class="bv-m"><span class="bv-mlab">Final feature map</span><b id="cv-out">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Receptive field</span><b id="cv-rf">—</b></div>'+
     '<div class="bv-m"><span class="bv-mlab">Total downsample</span><b id="cv-ds">—</b></div>'+
   '</div></div></div>';
  const el=id=>host.querySelector("#"+id);
  function compute(){
    let n=+el("cv-n").value; const k=+el("cv-k").value,s=+el("cv-s").value,p=+el("cv-p").value,L=+el("cv-l").value;
    el("cv-nv").textContent=n; el("cv-kv").textContent=k; el("cv-sv").textContent=s; el("cv-pv").textContent=p; el("cv-lv").textContent=L;
    const N0=n; let rf=1, jump=1; const sizes=[n];
    for(let i=0;i<L;i++){
      const out=Math.floor((n+2*p-k)/s)+1;
      rf=rf+(k-1)*jump; jump=jump*s; n=Math.max(1,out); sizes.push(n);
    }
    el("cv-chain").innerHTML=sizes.map((v,i)=>'<span class="node ghost conv-node">'+v+'²</span>'+(i<sizes.length-1?'<span class="arw tiny"></span>':'')).join("");
    el("cv-out").textContent=n+"×"+n;
    el("cv-rf").textContent=rf+" px";
    el("cv-ds").textContent=(N0/n).toFixed(1)+"×";
  }
  ["cv-n","cv-k","cv-s","cv-p","cv-l"].forEach(id=>el(id).addEventListener("input",compute));
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
  strip.innerHTML='<button class="complete-btn'+(done?" is-done":"")+'" id="completeBtn">'+
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
refreshProgressUI();
renderResume();
window.addEventListener("hashchange", onHash);
syncProgress().finally(()=>{ refreshProgressUI(); renderResume(); onHash(); });
