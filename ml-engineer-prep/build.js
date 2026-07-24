#!/usr/bin/env node
/* Build a single self-contained index.html from the markdown files.
 * Renders all .md to HTML at build time (no runtime markdown engine, no fetch).
 * Result works offline by double-click (file://) AND when served.
 *
 *   node build.js
 *
 * Edit the .md files, then re-run this to regenerate index.html.
 */
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;
const { D, DIAGRAMS, SECTIONS, fig } = require("./_diagrams.js");

/* ----------------------------- site structure ----------------------------- */
const SITE = [
  { label:"Start here", items:[
    { dir:"", file:"README.md", title:"Overview & How to Use" },
    { dir:"", file:"idfc-ml-engineer-path.md", title:"IDFC ML Engineer: 2-Day Path" },
    { dir:"", file:"idfc-interview-debrief.md", title:"IDFC AI Engineer: Interview Debrief", quiz:true },
  ]},
  { label:"1 · ML Foundations", dir:"01-ml-foundations", items:[
    { file:"README.md", title:"Overview" },
    { file:"ml-lifecycle.md", title:"The ML Lifecycle" },
    { file:"learning-types.md", title:"Learning Types & Algorithms" },
    { file:"bias-variance.md", title:"Bias, Variance & Overfitting" },
    { file:"metrics.md", title:"Evaluation Metrics" },
  ]},
  { label:"2 · Data Pipelines", dir:"02-data-pipelines", items:[
    { file:"README.md", title:"Overview" },
    { file:"ingestion-and-storage.md", title:"Ingestion & Storage" },
    { file:"batch-vs-streaming.md", title:"Batch vs Streaming" },
    { file:"spark-hadoop-at-scale.md", title:"Spark & Hadoop at Scale" },
    { file:"preprocessing-and-quality.md", title:"Preprocessing & Data Quality" },
    { file:"feature-stores.md", title:"Feature Engineering & Feature Stores" },
  ]},
  { label:"3 · Model Development", dir:"03-model-development", items:[
    { file:"README.md", title:"Overview" },
    { file:"classical-ml.md", title:"Classical ML (Trees & Boosting)" },
    { file:"deep-learning.md", title:"Deep Learning Essentials" },
    { file:"frameworks-in-practice.md", title:"PyTorch, TensorFlow & Keras in Practice" },
    { file:"training-at-scale.md", title:"Training at Scale" },
    { file:"hyperparameter-tuning.md", title:"Hyperparameter Tuning" },
  ]},
  { label:"4 · Experimentation", dir:"04-experimentation", items:[
    { file:"README.md", title:"Overview" },
    { file:"validation-splits.md", title:"Validation & Data Splits" },
    { file:"experiment-tracking.md", title:"Experiment Tracking" },
    { file:"ab-testing.md", title:"Online A/B Testing & Stats" },
  ]},
  { label:"5 · MLOps & Serving", dir:"05-mlops-serving", items:[
    { file:"README.md", title:"Overview" },
    { file:"serving-patterns.md", title:"Serving Patterns" },
    { file:"packaging-and-registry.md", title:"Packaging, Registry & Versioning" },
    { file:"cicd-for-ml.md", title:"CI/CD & Pipelines for ML" },
  ]},
  { label:"6 · Monitoring & Reliability", dir:"06-monitoring-reliability", items:[
    { file:"README.md", title:"Overview" },
    { file:"drift-and-quality.md", title:"Drift & Data-Quality Monitoring" },
    { file:"performance-monitoring.md", title:"Performance & Ops Monitoring" },
    { file:"retraining-loops.md", title:"Retraining Loops" },
  ]},
  { label:"7 · Cloud & Infra", dir:"07-cloud-infra", items:[
    { file:"README.md", title:"Overview" },
    { file:"cloud-ml-stacks.md", title:"AWS / GCP / Azure ML Stacks" },
    { file:"containers-k8s.md", title:"Containers, Kubernetes & Kubeflow" },
    { file:"gpu-kubernetes-operations.md", title:"GPU Kubernetes Operations" },
    { file:"iac-and-cost.md", title:"IaC, GPUs & Cost Control" },
  ]},
  { label:"8 · Optimization & Scaling", dir:"08-optimization-scaling", items:[
    { file:"README.md", title:"Overview" },
    { file:"model-compression.md", title:"Quantization, Pruning, Distillation" },
    { file:"distributed-training.md", title:"Distributed Training" },
    { file:"nccl-collectives.md", title:"NCCL & Distributed Collectives" },
    { file:"inference-optimization.md", title:"Inference & Serving Optimization" },
  ]},
  { label:"9 · Generative AI & LLMs", dir:"09-generative-ai-llms", items:[
    { file:"README.md", title:"Overview" },
    { file:"transformers-and-llms.md", title:"Transformers & How LLMs Work" },
    { file:"prompting-and-rag.md", title:"Prompting & RAG" },
    { file:"fine-tuning.md", title:"Fine-Tuning & PEFT (LoRA)" },
    { file:"llmops-and-eval.md", title:"LLMOps & Evaluation" },
  ]},
  { label:"10 · ML System Design", dir:"10-system-design", items:[
    { file:"README.md", title:"Overview" },
    { file:"framework.md", title:"A Design Framework" },
    { file:"worked-recommender.md", title:"Worked Example: Recommender" },
    { file:"worked-ml-platform.md", title:"Worked Example: ML Platform" },
    { file:"worked-perception-platform.md", title:"Worked Example: Hybrid Perception Platform" },
    { file:"worked-data-loader-library.md", title:"Worked Example: Data-Loading Library" },
  ]},
  { label:"11 · Drill Bank", dir:"11-drill-bank", items:[
    { file:"README.md", title:"Overview" },
    { file:"drill-bank.md", title:"Rapid Q&A", quiz:true },
    { file:"decision-tradeoffs.md", title:"Decision Tradeoffs: Why X over Y" },
    { file:"cheat-sheet.md", title:"One-Page Cheat Sheet" },
  ]},
  { label:"12 · NVIDIA Model Optimization", dir:"12-nvidia-model-optimization", items:[
    { file:"README.md", title:"Overview" },
    { file:"quantization-deep.md", title:"Quantization, Deeply" },
    { file:"numerical-precision.md", title:"Numerical Precision (FP32→FP8→INT8)" },
    { file:"tensorrt-internals.md", title:"TensorRT Internals" },
    { file:"inference-stack.md", title:"The Modern Inference Stack" },
    { file:"gpu-performance.md", title:"GPU Performance & Profiling" },
    { file:"sparsity-pruning-distillation.md", title:"Sparsity, Pruning & Distillation" },
    { file:"llm-inference.md", title:"LLM Inference Optimization" },
    { file:"experiment-walkthrough.md", title:"Experiment Walkthrough (Your Project)" },
    { file:"interview-qa.md", title:"Interview Q&A: Rapid Fire", quiz:true },
  ]},
  { label:"13 · LLM & VLM Optimization", dir:"13-llm-vlm-optimization", items:[
    { file:"README.md", title:"Overview" },
    { file:"cnn-to-llm.md", title:"CNN → LLM/VLM: What Transfers" },
    { file:"llm-quantization.md", title:"LLM Quantization" },
    { file:"llm-opt-in-practice.md", title:"The Loop in Practice" },
    { file:"serving-architecture.md", title:"Serving Architecture (Internal Deployment)" },
    { file:"vlm-optimization.md", title:"VLM Optimization" },
    { file:"experiment-redo.md", title:"Experiment Redo (Your Project as LLM/VLM)" },
    { file:"interview-qa.md", title:"Interview Q&A: LLM & VLM", quiz:true },
  ]},
];

/* ----------------------------- markdown parser ----------------------------- */
function escapeHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function slug(s){return s.toLowerCase().replace(/<[^>]+>/g,"").replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"-");}

/* ----- lightweight build-time syntax highlighter (Python / bash) ----- */
const HL = {
  python: {
    re: /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?''')|([rbfRBF]{0,2}"(?:\\.|[^"\\])*"|[rbfRBF]{0,2}'(?:\\.|[^'\\])*')|(@[A-Za-z_]\w*)|\b(def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|in|not|and|or|lambda|yield|pass|break|continue|global|nonlocal|raise|assert|del|is|async|await|None|True|False|self)\b|\b(print|len|range|int|str|float|list|dict|set|tuple|bool|bytes|open|enumerate|zip|map|filter|isinstance|super|hash|abs|min|max|sum|np|cv2|Gst|GLib|GObject|gi|pyds)\b|\b(0[xX][0-9a-fA-F]+|\d+\.?\d*)\b/g,
    cls: ["comment","string","string","decorator","keyword","builtin","number"]
  },
  bash: {
    re: /(#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|\b(gst-launch-1\.0|gst-inspect-1\.0|ffprobe|ffmpeg|python3?|node|pip3?|bash|sudo|export|cd|dot|nvidia-smi|tegrastats|cat|grep|ls)\b|(\$\{[^}]+\}|\$\w+)|(?<![\w-])(-{1,2}[A-Za-z][\w-]*)|\b(0[xX][0-9a-fA-F]+|\d+\.?\d*)\b/g,
    cls: ["comment","string","command","variable","flag","number"]
  }
};
HL.py = HL.python; HL.sh = HL.bash; HL.shell = HL.bash;
function highlight(code, lang){
  const spec = HL[lang];
  if(!spec) return escapeHtml(code);
  let out="", last=0, m;
  spec.re.lastIndex = 0;
  while((m = spec.re.exec(code))){
    if(m.index>last) out += escapeHtml(code.slice(last, m.index));
    let cls="text";
    for(let g=1; g<m.length; g++){ if(m[g]!==undefined){ cls=spec.cls[g-1]; break; } }
    out += '<span class="tok-'+cls+'">'+escapeHtml(m[0])+'</span>';
    last = spec.re.lastIndex;
    if(m[0]===""){ spec.re.lastIndex++; last = spec.re.lastIndex; }
  }
  out += escapeHtml(code.slice(last));
  return out;
}

function inlineMd(s){
  const codes=[];
  s = s.replace(/`([^`]+)`/g, (m,c)=>{ codes.push(c); return "@@CODE"+(codes.length-1)+"@@"; });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m,t,u)=>{
    const ext = /^(https?:)?\/\//.test(u) || /^mailto:/.test(u);
    if(ext) return '<a href="'+u+'" target="_blank" rel="noopener">'+t+'</a>';
    if(u.charAt(0)==='#') return '<a href="'+u+'">'+t+'</a>';
    return '<a class="mdlink" data-href="'+u.replace(/"/g,'&quot;')+'" href="#">'+t+'</a>';
  });
  s = s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g,"$1<em>$2</em>");
  s = s.replace(/@@CODE(\d+)@@/g,(m,i)=>"<code>"+escapeHtml(codes[+i])+"</code>");
  return s;
}
function isSep(line){ return /^\s*\|?[\s:|-]*-[-\s:|]*\|?\s*$/.test(line) && line.indexOf("-")>=0; }
function splitRow(line){
  let s = line.trim();
  if(s.charAt(0)==="|") s=s.slice(1);
  if(s.charAt(s.length-1)==="|") s=s.slice(0,-1);
  return s.split("|").map(c=>c.trim());
}
function renderMarkdown(md){
  const lines = md.replace(/\r\n?/g,"\n").split("\n");
  let i=0, out=[];
  const isListItem = l => /^(\s*)([-*+]|\d+\.)\s+/.test(l);
  while(i<lines.length){
    let line = lines[i];
    if(line.trim()===""){ i++; continue; }
    if(/^\s*```/.test(line)){
      const lang = line.trim().replace(/^```/,"").trim();
      i++; let buf=[];
      while(i<lines.length && !/^\s*```/.test(lines[i])){ buf.push(lines[i]); i++; }
      i++;
      const code = buf.join("\n");
      if(/^fig:/.test(lang)){                       // inline SVG diagram
        const name = lang.slice(4).trim();
        const cap = code.trim().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        out.push(D[name] ? fig(D[name], cap) : '<pre><code>'+escapeHtml(code)+'</code></pre>');
        continue;
      }
      if(lang === "rawhtml"){                        // pass raw HTML through verbatim
        out.push(code);
        continue;
      }
      out.push('<pre><code'+(lang?' class="language-'+lang+'"':'')+'>'+highlight(code, lang)+'</code></pre>');
      continue;
    }
    let h = line.match(/^(#{1,6})\s+(.*)$/);
    if(h){
      const lvl=h[1].length, txt=h[2].trim();
      out.push('<h'+lvl+' id="'+slug(txt)+'">'+inlineMd(txt)+'</h'+lvl+'>');
      i++; continue;
    }
    if(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)){ out.push("<hr>"); i++; continue; }
    if(/^\s*>/.test(line)){
      let buf=[];
      while(i<lines.length && /^\s*>/.test(lines[i])){ buf.push(lines[i].replace(/^\s*>\s?/,"")); i++; }
      out.push("<blockquote>"+renderMarkdown(buf.join("\n"))+"</blockquote>");
      continue;
    }
    if(line.indexOf("|")>=0 && i+1<lines.length && isSep(lines[i+1])){
      const header = splitRow(line);
      i+=2; let rows=[];
      while(i<lines.length && lines[i].indexOf("|")>=0 && lines[i].trim()!==""){ rows.push(splitRow(lines[i])); i++; }
      let t='<table><thead><tr>'+header.map(c=>"<th>"+inlineMd(c)+"</th>").join("")+"</tr></thead><tbody>";
      rows.forEach(r=>{ t+="<tr>"+header.map((_,k)=>"<td>"+inlineMd(r[k]||"")+"</td>").join("")+"</tr>"; });
      t+="</tbody></table>";
      out.push('<div class="table-scroll">'+t+'</div>');
      continue;
    }
    if(isListItem(line)){
      let items=[];
      while(i<lines.length && isListItem(lines[i])){
        const m=lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        items.push({ indent:m[1].length, ordered:/\d+\./.test(m[2]), text:m[3] });
        i++;
      }
      out.push(buildList(items));
      continue;
    }
    let buf=[];
    while(i<lines.length){
      const l=lines[i];
      if(l.trim()==="" || /^\s*```/.test(l) || /^#{1,6}\s/.test(l) ||
         /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l) || /^\s*>/.test(l) || isListItem(l) ||
         (l.indexOf("|")>=0 && i+1<lines.length && isSep(lines[i+1]))) break;
      buf.push(l); i++;
    }
    out.push("<p>"+inlineMd(buf.join(" ").trim())+"</p>");
  }
  return out.join("\n");
}
function buildList(items){
  let pos=0;
  function helper(curIndent){
    const ordered=items[pos].ordered;
    let html=ordered?"<ol>":"<ul>";
    while(pos<items.length && items[pos].indent>=curIndent){
      if(items[pos].indent>curIndent){
        const sub=helper(items[pos].indent);
        html=html.replace(/<\/li>$/, sub+"</li>");
      } else {
        html+="<li>"+inlineMd(items[pos].text)+"</li>";
        pos++;
      }
    }
    html+=ordered?"</ol>":"</ul>";
    return html;
  }
  return helper(items[0].indent);
}

/* ------------------- transforms applied to rendered HTML ------------------- */
// Turn "Q: ... ?" + following answer paragraphs into collapsible <details>.
function wrapQA(html){
  // Question and answer may share one <p> (no blank line in source) or be split.
  return html.replace(
    /<p><strong>(Q:[\s\S]*?)<\/strong>\s*([\s\S]*?)<\/p>([\s\S]*?)(?=<p><strong>Q:|<h2|<hr|<p>→|$)/g,
    (m, q, firstAns, rest) => {
      const body = (firstAns.trim() ? '<p>'+firstAns.trim()+'</p>' : '') + rest.trim();
      return '<details class="qa" open><summary>'+q.trim()+'</summary><div class="qa-body">'+body+'</div></details>';
    }
  );
}
function extractTOC(html){
  const toc=[]; const re=/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g; let m;
  while((m=re.exec(html))) toc.push({ level:+m[1], id:m[2], text:m[3].replace(/<[^>]+>/g,"") });
  return toc;
}
function stripTags(html){ return html.replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim(); }

/* ------------------------------- build data -------------------------------- */
// Turn "**TL;DR:** ..." into a highlighted insight card.
function calloutTLDR(html){
  return html.replace(/<p><strong>TL;DR:?<\/strong>\s*([\s\S]*?)<\/p>/,
    (m, body) => '<div class="callout tldr"><div class="cic">💡</div><div class="cbody"><span class="clead">TL;DR</span> '+body.trim()+'</div></div>');
}
// Inject a concept diagram right after the page's <h1>.
function injectDiagram(rel, html){
  const d = DIAGRAMS[rel]; if(!d) return html;
  const svg = fig(D[d[0]], d[1]);
  return /<\/h1>/.test(html) ? html.replace(/<\/h1>/, "</h1>\n"+svg) : svg+html;
}
// Graphical section cards for the home page.
function homeCards(){
  const cards = SITE.filter(s=>s.dir).map(sec=>{
    const m = SECTIONS[sec.label] || {};
    const href = sec.dir + "/README.md";
    return '<a class="seccard mdlink" data-href="'+href+'" href="#" style="--card:'+m.accent+'">'+
      '<span class="sc-ic">'+(m.icon||"•")+'</span>'+
      '<span class="sc-lbl">'+sec.label+'</span>'+
      '<span class="sc-tag">'+(m.tag||"")+'</span></a>';
  }).join("");
  return '<h2 id="jump-in">Jump in</h2><div class="section-cards">'+cards+'</div>';
}
const HOME_HERO =
  '<div class="hero"><span class="hero-badge">AI / ML Engineer</span>'+
  '<div class="hero-title">ML on the Cloud: Interview Prep</div>'+
  '<p class="hero-sub">The whole ML lifecycle: data pipelines, model development, experimentation, '+
  'and deploying &amp; monitoring models in production with MLOps — plus cloud infra, optimization, '+
  'and generative AI. Eleven chapters and a drill bank.</p></div>';

const PAGES = [];
SITE.forEach(sec => sec.items.forEach(it => {
  const rel = (sec.dir ? sec.dir + "/" : "") + it.file;
  const md = fs.readFileSync(path.join(ROOT, rel), "utf8");
  let html = renderMarkdown(md);
  if(it.quiz) html = wrapQA(html);
  html = calloutTLDR(html);
  html = injectDiagram(rel, html);
  if(rel === "README.md") html = HOME_HERO + html.replace(/<\/figure>/, "</figure>\n"+homeCards());
  const toc = extractTOC(html);
  const text = stripTags(html).toLowerCase();
  const meta = SECTIONS[sec.label] || {};
  PAGES.push({ path:rel, title:it.title, section:sec.label, quiz:!!it.quiz,
    accent:meta.accent||"", html, toc, text, words: text.split(" ").length });
}));

const NAV = SITE.map(sec => {
  const m = SECTIONS[sec.label] || {};
  return { label: sec.label, icon: m.icon||"", accent: m.accent||"var(--accent)",
    items: sec.items.map(it => ({ path:(sec.dir?sec.dir+"/":"")+it.file, title:it.title })) };
});

const DATA = { nav: NAV, pages: PAGES };
let dataJson = JSON.stringify(DATA).replace(/<\//g, "<\\/");  // keep </script> safe

/* --------------------------------- template -------------------------------- */
const CSS = fs.readFileSync(path.join(ROOT, "_site.css"), "utf8");
const APP = fs.readFileSync(path.join(ROOT, "_app.js"), "utf8");

const HTML =
'<!doctype html>\n<html lang="en">\n<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
'<meta name="theme-color" content="#3b82f6">\n' +
'<title>AI / ML Engineer: Interview Prep</title>\n' +
'<style>\n' + CSS + '\n</style>\n</head>\n<body>\n' +
'<div class="app">\n' +
'  <aside class="sidebar" id="sidebar">\n' +
'    <div class="site-switcher"><label for="siteSwitcher">Switch website</label><select id="siteSwitcher" aria-label="Switch interview preparation website" onchange="if(this.value){const h=location.protocol===&quot;file:&quot;?&quot;http://192.168.3.20&quot;:location.protocol+&quot;//&quot;+location.hostname;location.href=h+&quot;:&quot;+this.value+&quot;/&quot;}"><option value="9000">Computer Vision</option><option value="9001">RAG &amp; LLM</option><option value="9002" selected>ML Engineer</option><option value="9003">Automotive SoC</option><option value="9004">Python</option><option value="9005">Biometrics</option><option value="9006">Agentic AI</option></select></div>\n' +
'    <div class="brand">\n' +
'      <h1>AI / ML Engineer Prep</h1>\n' +
'      <div class="sub">ML on the cloud · MLOps · Data pipelines · GenAI</div>\n' +
'      <button class="nav-hide" id="navHide" type="button" aria-label="Collapse navigation" aria-controls="sidebar" aria-expanded="true">← Hide navigation</button>\n' +
'      <div class="tools">\n' +
'        <input id="search" type="search" placeholder="Search all pages…" autocomplete="off" autocapitalize="off" spellcheck="false">\n' +
'        <button class="iconbtn" id="timerBtn" title="Study / exam timer">⏱</button>\n' +
'        <button class="iconbtn theme-toggle" title="Toggle light / dark">◐</button>\n' +
'      </div>\n' +
'      <div class="progwrap">\n' +
'        <div class="progtrack"><div class="progbar" id="progBar"></div></div>\n' +
'        <div class="proglbl" id="progLbl"></div>\n' +
'      </div>\n' +
'      <div id="resumeSlot"></div>\n' +
'    </div>\n' +
'    <nav id="nav"></nav>\n' +
'  </aside>\n' +
'  <main class="main">\n' +
'    <div class="nav-collapsed-bar"><button class="iconbtn nav-show" id="navShow" type="button" aria-label="Show navigation" aria-controls="sidebar" aria-expanded="false">☰ <span>Show navigation</span></button></div>\n' +
'    <div class="topbar">\n' +
'      <button class="iconbtn" id="menu" aria-label="Open menu">☰</button>\n' +
'      <span class="tb-title" id="tbTitle">ML Eng Prep</span>\n' +
'      <button class="iconbtn" id="searchBtn" aria-label="Search">🔍</button>\n' +
'      <button class="iconbtn theme-toggle" aria-label="Toggle theme">◐</button>\n' +
'    </div>\n' +
'    <div class="content-wrap">\n' +
'      <div id="pagetools"></div>\n' +
'      <article id="content"></article>\n' +
'      <div class="pager" id="pager"></div>\n' +
'    </div>\n' +
'  </main>\n' +
'</div>\n' +
'<div class="scrim" id="scrim"></div>\n' +
'<div class="searchpanel" id="searchpanel"></div>\n' +
'<div class="timer-panel" id="timerPanel">\n' +
'  <div class="timer-head"><span class="timer-title">Study timer</span>' +
'    <button class="iconbtn timer-x" id="timerClose" aria-label="Close">✕</button></div>\n' +
'  <div class="timer-face"><div class="timer-ring" id="timerRing"><div class="timer-time" id="timerTime">25:00</div></div></div>\n' +
'  <div class="timer-presets">' +
'    <button class="timer-preset sel" data-min="25">25m</button>' +
'    <button class="timer-preset" data-min="45">45m</button>' +
'    <button class="timer-preset" data-min="60">60m</button>' +
'    <button class="timer-preset" data-min="90">90m mock</button></div>\n' +
'  <button class="timer-play" id="timerPlay">▶</button>\n' +
'</div>\n' +
'<script>\nconst DATA=' + dataJson + ';\n' + APP + '\n</script>\n' +
'</body>\n</html>\n';

fs.writeFileSync(path.join(ROOT, "index.html"), HTML);
const kb = (Buffer.byteLength(HTML)/1024).toFixed(0);
const totalWords = PAGES.reduce((a,p)=>a+p.words,0);
console.log("Built index.html  ("+kb+" KB, "+PAGES.length+" pages, ~"+totalWords+" words embedded)");
