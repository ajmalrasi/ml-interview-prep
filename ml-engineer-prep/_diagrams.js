/* Section metadata for the ML/Cloud Engineer prep site.
 * No embedded concept diagrams here (DIAGRAMS is empty); build.js still
 * imports { D, DIAGRAMS, SECTIONS, fig }, so all four are exported.
 */
const D = {};
const DIAGRAMS = {};
function fig(){ return ""; }

const SECTIONS = {
  "Start here":               { icon:"🧭", accent:"#3b82f6", tag:"What the role wants and how to use this pack" },
  "1 · ML Foundations":       { icon:"📚", accent:"#2f9e6f", tag:"Lifecycle, learning types, bias–variance, metrics" },
  "2 · Data Pipelines":       { icon:"🔀", accent:"#14a3a3", tag:"Ingest, clean, batch vs stream, feature stores" },
  "3 · Model Development":    { icon:"🧠", accent:"#9a5cd0", tag:"Classical ML, deep learning, training at scale" },
  "4 · Experimentation":      { icon:"🧪", accent:"#d39a1f", tag:"Validation, metrics, A/B tests, experiment tracking" },
  "5 · MLOps & Serving":      { icon:"🚀", accent:"#e0663f", tag:"Deploy, serve, CI/CD, registries, patterns" },
  "6 · Monitoring & Reliability":{ icon:"📈", accent:"#dd5b54", tag:"Drift, data quality, retraining, observability" },
  "7 · Cloud & Infra":        { icon:"☁️", accent:"#4a8bd1", tag:"AWS/GCP/Azure, GPUs, Kubernetes, IaC, cost" },
  "8 · Optimization & Scaling":{ icon:"⚡", accent:"#c98a1a", tag:"Quantization, distillation, distributed, inference" },
  "9 · Generative AI & LLMs": { icon:"✨", accent:"#7c6cf0", tag:"Transformers, RAG, fine-tuning, LLMOps, eval" },
  "10 · ML System Design":    { icon:"🏗️", accent:"#34ad7c", tag:"Design a recommender, feature pipeline, ML platform" },
  "11 · Drill Bank":          { icon:"🎯", accent:"#cc5fab", tag:"Rapid Q&A across every topic" },
};

module.exports = { D, DIAGRAMS, SECTIONS, fig };
