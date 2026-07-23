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
const STORE_KEY = "jumio-biometrics-prep-v1";
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
  document.getElementById("tbTitle").textContent = pg ? pg.title : "ML Eng Prep";
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
  "pr-widget":    initPRWidget,
  "bv-widget":    initBiasVarianceWidget,
  "quant-widget": initQuantWidget,
  "batch-widget": initBatchWidget,
  "llmmem-widget":initLLMMemWidget,
  "format-widget":initFormatWidget,
};
function mountWidgets(){
  for(const id in WIDGETS){
    if(document.getElementById(id)){ try{ WIDGETS[id](); }catch(e){ console.error("widget "+id, e); } }
  }
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

/* ============ Bias–Variance / model-complexity explorer =============== */
// Fit polynomials of increasing degree to fixed noisy data; show the curve
// plus train vs test error → the classic U-shaped bias/variance tradeoff.
function initBiasVarianceWidget(){
  const host=document.getElementById("bv-widget"); if(!host) return;
  const rnd=(function(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})(42);
  const gauss=(m,s)=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
  const truef=x=>Math.sin(x*Math.PI*1.15)*0.72;         // ground-truth signal
  // fixed dataset: train + held-out test
  const mk=n=>{const a=[];for(let k=0;k<n;k++){const x=rnd()*2-1;a.push({x,y:truef(x)+gauss(0,0.16)});}return a;};
  const train=mk(16), test=mk(40);
  // least-squares polynomial fit (normal equations, small degree)
  function fit(pts,deg){
    const X=pts.map(p=>{const r=[];for(let j=0;j<=deg;j++)r.push(Math.pow(p.x,j));return r;});
    const y=pts.map(p=>p.y), n=deg+1;
    const A=Array.from({length:n},()=>new Array(n).fill(0)), b=new Array(n).fill(0);
    for(let i=0;i<X.length;i++)for(let a=0;a<n;a++){b[a]+=X[i][a]*y[i];for(let c=0;c<n;c++)A[a][c]+=X[i][a]*X[i][c];}
    for(let a=0;a<n;a++)A[a][a]+=1e-6;                    // ridge for stability
    // Gaussian elimination
    for(let c=0;c<n;c++){let piv=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[piv][c]))piv=r;
      [A[c],A[piv]]=[A[piv],A[c]];[b[c],b[piv]]=[b[piv],b[c]];
      for(let r=0;r<n;r++){if(r===c)continue;const f=A[r][c]/A[c][c];for(let k=c;k<n;k++)A[r][k]-=f*A[c][k];b[r]-=f*b[c];}}
    return b.map((v,i)=>v/A[i][i]);
  }
  const evalp=(w,x)=>w.reduce((s,c,j)=>s+c*Math.pow(x,j),0);
  const mse=(w,pts)=>pts.reduce((s,p)=>s+Math.pow(evalp(w,p.x)-p.y,2),0)/pts.length;
  const W=440,H=250,pad=26;
  const xs=x=>pad+((x+1)/2)*(W-2*pad), ys=y=>H/2 - y*(H/2-pad);
  host.innerHTML=
    '<div class="bv-wrap"><svg class="bv-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+
      '<line x1="'+pad+'" y1="'+(H/2)+'" x2="'+(W-pad)+'" y2="'+(H/2)+'" class="prw-axis"/>'+
      '<path id="bv-true" class="bv-true"/><path id="bv-fit" class="bv-fit"/>'+
      '<g id="bv-train"></g>'+
    '</svg>'+
    '<div class="bv-controls">'+
      '<label class="prw-slabel">Model complexity — polynomial degree <b id="bv-dval">3</b></label>'+
      '<input id="bv-slider" type="range" min="1" max="12" step="1" value="3">'+
      '<div class="bv-legend"><span><i class="bv-lg-true"></i> true signal</span>'+
        '<span><i class="bv-lg-fit"></i> fitted model</span><span><i class="bv-lg-pt"></i> training data</span></div>'+
      '<div class="bv-metrics">'+
        '<div class="bv-m"><span class="bv-mlab">Train error</span><b id="bv-tr">—</b></div>'+
        '<div class="bv-m"><span class="bv-mlab">Test error</span><b id="bv-te">—</b></div>'+
        '<div class="bv-m"><span class="bv-mlab">Diagnosis</span><b id="bv-diag" class="bv-diag">—</b></div>'+
      '</div></div></div>';
  const trainDots=train.map(p=>'<circle cx="'+xs(p.x).toFixed(1)+'" cy="'+ys(p.y).toFixed(1)+'" r="3.6" class="bv-pt"/>').join("");
  host.querySelector("#bv-train").innerHTML=trainDots;
  let td=""; for(let x=-1;x<=1.0001;x+=0.02) td+=(td?"L":"M")+xs(x).toFixed(1)+" "+ys(truef(x)).toFixed(1)+" ";
  host.querySelector("#bv-true").setAttribute("d",td);
  function draw(deg){
    const w=fit(train,deg);
    let d=""; for(let x=-1;x<=1.0001;x+=0.01){const yv=Math.max(-1.3,Math.min(1.3,evalp(w,x)));d+=(d?"L":"M")+xs(x).toFixed(1)+" "+ys(yv).toFixed(1)+" ";}
    host.querySelector("#bv-fit").setAttribute("d",d);
    const tr=mse(w,train), te=mse(w,test);
    host.querySelector("#bv-dval").textContent=deg;
    host.querySelector("#bv-tr").textContent=tr.toFixed(3);
    host.querySelector("#bv-te").textContent=te.toFixed(3);
    const diag=host.querySelector("#bv-diag");
    let msg,cls; if(deg<=2 && tr>0.05){msg="Underfit (high bias)";cls="bv-bad";}
      else if(te>tr*2.2 && te>0.045){msg="Overfit (high variance)";cls="bv-bad";}
      else {msg="Good fit ✓";cls="bv-good";}
    diag.textContent=msg; diag.className="bv-diag "+cls;
  }
  host.querySelector("#bv-slider").addEventListener("input",e=>draw(+e.target.value));
  draw(3);
}

/* ================== Quantization playground (FP32 → INT8) ============== */
// Pick a float range + a value; see the affine int8 mapping, scale/zero-point,
// the quantized integer, the dequantized value, and the rounding error.
function initQuantWidget(){
  const host=document.getElementById("quant-widget"); if(!host) return;
  host.innerHTML=
    '<div class="qz-wrap"><div class="qz-controls">'+
      '<div class="qz-row"><label>Tensor range [min, max]</label>'+
        '<span><input id="qz-min" type="number" value="-6" step="0.5" class="qz-num"> to '+
        '<input id="qz-max" type="number" value="6" step="0.5" class="qz-num"></span></div>'+
      '<div class="qz-row"><label>Scheme</label><span>'+
        '<button class="qz-seg sel" data-s="sym">symmetric</button>'+
        '<button class="qz-seg" data-s="asym">asymmetric</button></span></div>'+
      '<div class="qz-row"><label>Value to quantize <b id="qz-xval">2.00</b></label>'+
        '<input id="qz-x" type="range" min="-6" max="6" step="0.01" value="2"></div>'+
    '</div>'+
    '<div class="qz-out">'+
      '<div class="qz-cell"><span>scale (Δ)</span><b id="qz-scale">—</b></div>'+
      '<div class="qz-cell"><span>zero-point</span><b id="qz-zp">—</b></div>'+
      '<div class="qz-cell"><span>int8 code</span><b id="qz-q">—</b></div>'+
      '<div class="qz-cell"><span>dequantized</span><b id="qz-dq">—</b></div>'+
      '<div class="qz-cell qz-err"><span>quant error</span><b id="qz-e">—</b></div>'+
    '</div>'+
    '<svg class="qz-bar" viewBox="0 0 440 64" preserveAspectRatio="xMidYMid meet">'+
      '<line x1="20" y1="40" x2="420" y2="40" class="prw-axis"/>'+
      '<g id="qz-ticks"></g>'+
      '<circle id="qz-true" cy="40" r="5" class="qz-true"/>'+
      '<circle id="qz-quant" cy="40" r="5" class="qz-quantdot"/>'+
      '<text x="20" y="60" id="qz-lmin" class="prw-axlbl">-6</text>'+
      '<text x="420" y="60" id="qz-lmax" text-anchor="end" class="prw-axlbl">6</text>'+
    '</svg></div>';
  let scheme="sym";
  const el=id=>host.querySelector("#"+id);
  const QMIN=-128, QMAX=127;
  function compute(){
    let lo=parseFloat(el("qz-min").value), hi=parseFloat(el("qz-max").value);
    if(!(hi>lo)){ hi=lo+1; }
    const x=parseFloat(el("qz-x").value);
    let scale, zp;
    if(scheme==="sym"){ const a=Math.max(Math.abs(lo),Math.abs(hi)); scale=a/127; zp=0; }
    else { scale=(hi-lo)/(QMAX-QMIN); zp=Math.round(QMIN - lo/scale); }
    const q=Math.max(QMIN,Math.min(QMAX, Math.round(x/scale)+zp));
    const dq=(q-zp)*scale;
    el("qz-scale").textContent=scale.toFixed(4);
    el("qz-zp").textContent=zp;
    el("qz-q").textContent=q;
    el("qz-dq").textContent=dq.toFixed(3);
    el("qz-e").textContent=(dq-x>=0?"+":"")+(dq-x).toFixed(3);
    el("qz-xval").textContent=x.toFixed(2);
    // slider bounds follow the range
    const sl=el("qz-x"); sl.min=lo; sl.max=hi;
    el("qz-lmin").textContent=lo; el("qz-lmax").textContent=hi;
    const px=v=>20+((v-lo)/(hi-lo))*400;
    el("qz-true").setAttribute("cx",px(x).toFixed(1));
    el("qz-quant").setAttribute("cx",px(dq).toFixed(1));
    // draw a few quantization grid ticks (every ~16 codes)
    let ticks=""; for(let c=QMIN;c<=QMAX;c+=16){ const v=(c-zp)*scale; if(v<lo||v>hi)continue;
      ticks+='<line x1="'+px(v).toFixed(1)+'" y1="34" x2="'+px(v).toFixed(1)+'" y2="46" class="qz-tick"/>'; }
    el("qz-ticks").innerHTML=ticks;
  }
  host.querySelectorAll(".qz-seg").forEach(b=>b.onclick=()=>{
    scheme=b.dataset.s; host.querySelectorAll(".qz-seg").forEach(x=>x.classList.toggle("sel",x===b)); compute();
  });
  ["qz-min","qz-max","qz-x"].forEach(id=>el(id).addEventListener("input",compute));
  compute();
}

/* ============ Batch size → latency / throughput explorer ============== */
// Simple queuing-style model: latency = fixed overhead + per-item compute that
// improves with batching (better GPU utilization), throughput = batch/latency.
function initBatchWidget(){
  const host=document.getElementById("batch-widget"); if(!host) return;
  host.innerHTML=
    '<div class="bt-wrap"><div class="bt-controls">'+
      '<label class="prw-slabel">Batch size <b id="bt-bval">8</b></label>'+
      '<input id="bt-b" type="range" min="1" max="128" step="1" value="8">'+
      '<div class="bt-sliders">'+
        '<label>Fixed overhead <b id="bt-oval">4</b> ms<input id="bt-o" type="range" min="0" max="20" step="0.5" value="4"></label>'+
        '<label>Compute / item at batch=1 <b id="bt-cval">6</b> ms<input id="bt-c" type="range" min="0.5" max="20" step="0.5" value="6"></label>'+
        '<label>Batch efficiency <b id="bt-eval">0.6</b><input id="bt-e" type="range" min="0" max="0.95" step="0.05" value="0.6"></label>'+
      '</div>'+
      '<div class="bv-metrics">'+
        '<div class="bv-m"><span class="bv-mlab">Latency / batch</span><b id="bt-lat">—</b></div>'+
        '<div class="bv-m"><span class="bv-mlab">Throughput</span><b id="bt-thr">—</b></div>'+
        '<div class="bv-m"><span class="bv-mlab">Per-item latency</span><b id="bt-pil">—</b></div>'+
      '</div></div>'+
      '<svg class="bt-svg" viewBox="0 0 300 220" preserveAspectRatio="xMidYMid meet">'+
        '<line x1="34" y1="190" x2="290" y2="190" class="prw-axis"/>'+
        '<line x1="34" y1="14" x2="34" y2="190" class="prw-axis"/>'+
        '<path id="bt-thrline" class="bt-thrline"/><path id="bt-latline" class="bt-latline"/>'+
        '<circle id="bt-dot" r="4.5" class="bt-dot"/>'+
        '<text x="162" y="212" text-anchor="middle" class="prw-axlbl">batch size →</text>'+
        '<text x="12" y="100" transform="rotate(-90 12 100)" text-anchor="middle" class="prw-axlbl">throughput</text>'+
      '</svg></div>';
  const el=id=>host.querySelector("#"+id);
  const W=300,H=220,pL=34,pR=10,pT=14,pB=30;
  // latency(b) = overhead + compute*b*(1 - eff*(1 - 1/b))  ; throughput = b/latency
  function lat(b,o,c,e){ return o + c*b*(1 - e*(1 - 1/b)); }
  function compute(){
    const b=+el("bt-b").value, o=+el("bt-o").value, c=+el("bt-c").value, e=+el("bt-e").value;
    el("bt-bval").textContent=b; el("bt-oval").textContent=o; el("bt-cval").textContent=c; el("bt-eval").textContent=e.toFixed(2);
    const L=lat(b,o,c,e), thr=b/L*1000, pil=L/b;
    el("bt-lat").textContent=L.toFixed(1)+" ms";
    el("bt-thr").textContent=thr.toFixed(0)+" it/s";
    el("bt-pil").textContent=pil.toFixed(2)+" ms";
    // plot throughput vs batch across full range, normalized
    const bs=[]; for(let x=1;x<=128;x++) bs.push({b:x, thr:x/lat(x,o,c,e)*1000, lat:lat(x,o,c,e)});
    const maxThr=Math.max(...bs.map(p=>p.thr)), maxLat=Math.max(...bs.map(p=>p.lat));
    const xOf=x=>pL+((x-1)/127)*(W-pL-pR);
    const yThr=v=>H-pB-(v/maxThr)*(H-pT-pB);
    const yLat=v=>H-pB-(v/maxLat)*(H-pT-pB);
    el("bt-thrline").setAttribute("d",bs.map((p,i)=>(i?"L":"M")+xOf(p.b).toFixed(1)+" "+yThr(p.thr).toFixed(1)).join(" "));
    el("bt-latline").setAttribute("d",bs.map((p,i)=>(i?"L":"M")+xOf(p.b).toFixed(1)+" "+yLat(p.lat).toFixed(1)).join(" "));
    el("bt-dot").setAttribute("cx",xOf(b)); el("bt-dot").setAttribute("cy",yThr(thr));
  }
  ["bt-b","bt-o","bt-c","bt-e"].forEach(id=>el(id).addEventListener("input",compute));
  compute();
}

/* ============ LLM inference memory: weights + KV cache ================= */
// Estimate serving memory: weight bytes at a chosen precision, plus the KV
// cache which grows with batch × sequence length. Shows why long context hurts.
function initLLMMemWidget(){
  const host=document.getElementById("llmmem-widget"); if(!host) return;
  host.innerHTML=
    '<div class="lm-wrap"><div class="bt-controls">'+
      '<div class="bt-sliders">'+
        '<label>Parameters <b id="lm-pval">7</b> B<input id="lm-p" type="range" min="1" max="180" step="1" value="7"></label>'+
        '<label>Hidden size <b id="lm-hval">4096</b><input id="lm-h" type="range" min="1024" max="16384" step="256" value="4096"></label>'+
        '<label>Layers <b id="lm-lval">32</b><input id="lm-l" type="range" min="8" max="120" step="1" value="32"></label>'+
        '<label>Context length <b id="lm-sval">4096</b> tok<input id="lm-s" type="range" min="512" max="131072" step="512" value="4096"></label>'+
        '<label>Batch (concurrent seqs) <b id="lm-bval">1</b><input id="lm-b" type="range" min="1" max="64" step="1" value="1"></label>'+
      '</div>'+
      '<div class="lm-row"><label>Weight precision</label><span>'+
        '<button class="qz-seg" data-b="4">INT4</button>'+
        '<button class="qz-seg sel" data-b="16">FP16</button>'+
        '<button class="qz-seg" data-b="32">FP32</button></span></div>'+
    '</div>'+
    '<div class="lm-out">'+
      '<div class="qz-cell"><span>weights</span><b id="lm-w">—</b></div>'+
      '<div class="qz-cell"><span>KV cache</span><b id="lm-kv">—</b></div>'+
      '<div class="qz-cell qz-err"><span>total VRAM</span><b id="lm-tot">—</b></div>'+
    '</div>'+
    '<div class="lm-stack"><div class="lm-seg lm-seg-w" id="lm-bw"><span>weights</span></div>'+
      '<div class="lm-seg lm-seg-kv" id="lm-bkv"><span>KV</span></div></div>'+
    '<div class="lm-note" id="lm-note"></div></div>';
  let wbits=16;
  const el=id=>host.querySelector("#"+id);
  const GB=v=>v>=1?v.toFixed(1)+" GB":(v*1024).toFixed(0)+" MB";
  function compute(){
    const P=+el("lm-p").value*1e9, hid=+el("lm-h").value, L=+el("lm-l").value,
          S=+el("lm-s").value, B=+el("lm-b").value;
    el("lm-pval").textContent=el("lm-p").value; el("lm-hval").textContent=hid;
    el("lm-lval").textContent=L; el("lm-sval").textContent=S.toLocaleString(); el("lm-bval").textContent=B;
    const wBytes=P*(wbits/8);
    // KV cache: 2 (K&V) × layers × seq × batch × hidden × 2 bytes (fp16 cache)
    const kvBytes=2*L*S*B*hid*2;
    const wg=wBytes/1e9, kv=kvBytes/1e9, tot=wg+kv;
    el("lm-w").textContent=GB(wg); el("lm-kv").textContent=GB(kv); el("lm-tot").textContent=GB(tot);
    const wp=tot?Math.round(wg/tot*100):0;
    el("lm-bw").style.width=wp+"%"; el("lm-bkv").style.width=(100-wp)+"%";
    let note; const cards=Math.ceil(tot/80);
    note = "≈ "+cards+" × 80 GB GPU"+(cards>1?"s":"")+" just to hold this in memory. "+
      (kv>wg? "KV cache now dominates — long context / big batch is the bottleneck." :
              "Weights dominate — quantizing them is the biggest win.");
    el("lm-note").textContent=note;
  }
  host.querySelectorAll(".qz-seg").forEach(b=>b.onclick=()=>{
    wbits=+b.dataset.b; host.querySelectorAll(".qz-seg").forEach(x=>x.classList.toggle("sel",x===b)); compute();
  });
  ["lm-p","lm-h","lm-l","lm-s","lm-b"].forEach(id=>el(id).addEventListener("input",compute));
  compute();
}

/* ============ Number-format explorer (numerical precision page) ========= */
// Pick a format → see how its bits split into sign / exponent / mantissa, and
// how that fixes range (exponent) vs precision (mantissa). INT formats show the
// "one uniform step placed by a scale" story instead.
function initFormatWidget(){
  const host=document.getElementById("format-widget"); if(!host) return;
  const FMT={
    fp32:{name:"FP32", s:1,e:8,m:23, range:"±3.4 × 10³⁸", minpos:"1.2 × 10⁻³⁸", prec:"~7 decimal digits",
          note:"The baseline. Also the master-weight copy in mixed precision."},
    tf32:{name:"TF32", s:1,e:8,m:10, range:"= FP32", minpos:"= FP32", prec:"~FP16 (3 digits)",
          note:"Stored in 32 bits but only 19 are used in the multiply. Auto-on for FP32 matmuls on Ampere+."},
    fp16:{name:"FP16", s:1,e:5,m:10, range:"±65,504", minpos:"6.1 × 10⁻⁵", prec:"~3 decimal digits",
          loss:true, note:"Narrow exponent → small gradients underflow → needs loss scaling."},
    bf16:{name:"BF16", s:1,e:8,m:7,  range:"= FP32", minpos:"1.2 × 10⁻³⁸", prec:"~2 decimal digits",
          note:"Same 8-bit exponent as FP32 → no underflow → no loss scaling. Default for large-model training."},
    e4m3:{name:"FP8 E4M3", s:1,e:4,m:3, range:"±448", minpos:"~0.016", prec:"very coarse (more mantissa)",
          scale:true, note:"Hopper/Ada forward pass — weights & activations. Needs per-tensor scaling."},
    e5m2:{name:"FP8 E5M2", s:1,e:5,m:2, range:"±57,344", minpos:"6.1 × 10⁻⁵", prec:"coarsest (more range)",
          scale:true, note:"Hopper/Ada gradients — trades mantissa for the range gradients need."},
    int8:{name:"INT8", int:8, range:"set by scale", minpos:"one step = scale", prec:"256 uniform levels",
          scale:true, note:"No exponent/mantissa — a single uniform step you place with a scale. Needs calibration."},
    int4:{name:"INT4", int:4, range:"set by scale", minpos:"one step = scale", prec:"16 uniform levels",
          scale:true, note:"Just 16 levels — group-wise scales keep it usable. LLM weight-only (AWQ/GPTQ)."},
  };
  const order=["fp32","tf32","fp16","bf16","e4m3","e5m2","int8","int4"];
  host.innerHTML=
    '<div class="fmt-wrap">'+
      '<div class="fmt-segs">'+order.map((k,i)=>
        '<button class="qz-seg'+(i===0?" sel":"")+'" data-f="'+k+'">'+FMT[k].name+'</button>').join("")+'</div>'+
      '<div class="fmt-bar" id="fmt-bar"></div>'+
      '<div class="qz-out fmt-grid">'+
        '<div class="qz-cell"><span>total bits</span><b id="fmt-bits">—</b></div>'+
        '<div class="qz-cell"><span>dynamic range</span><b id="fmt-range">—</b></div>'+
        '<div class="qz-cell"><span>smallest positive</span><b id="fmt-min">—</b></div>'+
        '<div class="qz-cell"><span>precision</span><b id="fmt-prec">—</b></div>'+
      '</div>'+
      '<div class="fmt-flags" id="fmt-flags"></div>'+
      '<div class="lm-note" id="fmt-note"></div>'+
    '</div>';
  const el=id=>host.querySelector("#"+id);
  function draw(k){
    const f=FMT[k];
    let bar="", bits;
    if(f.int){
      bits=f.int;
      bar='<div class="fmt-seg fmt-int" style="flex:'+f.int+'"><span>'+f.int+'-bit integer</span></div>'+
          '<div class="fmt-scale">× scale</div>';
    } else {
      bits=f.s+f.e+f.m;
      bar='<div class="fmt-seg fmt-sign" style="flex:'+f.s+'"><span>sign</span></div>'+
          '<div class="fmt-seg fmt-exp" style="flex:'+f.e+'"><span>'+f.e+' exp · range</span></div>'+
          '<div class="fmt-seg fmt-mant" style="flex:'+f.m+'"><span>'+f.m+' mantissa · precision</span></div>';
    }
    el("fmt-bar").innerHTML=bar;
    el("fmt-bits").textContent=bits;
    el("fmt-range").textContent=f.range;
    el("fmt-min").textContent=f.minpos;
    el("fmt-prec").textContent=f.prec;
    let flags="";
    if(f.loss) flags+='<span class="fmt-flag warn">needs loss scaling</span>';
    else if(!f.int && !f.scale) flags+='<span class="fmt-flag ok">no loss scaling</span>';
    if(f.scale) flags+='<span class="fmt-flag">needs scaling / calibration</span>';
    el("fmt-flags").innerHTML=flags;
    el("fmt-note").textContent=f.note;
  }
  host.querySelectorAll(".qz-seg").forEach(b=>b.onclick=()=>{
    host.querySelectorAll(".qz-seg").forEach(x=>x.classList.toggle("sel",x===b)); draw(b.dataset.f);
  });
  draw("fp32");
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
