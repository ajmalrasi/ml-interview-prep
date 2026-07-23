/* Section metadata for the Jumio face recognition and biometrics prep site.
 * No embedded concept diagrams here (DIAGRAMS is empty); build.js still
 * imports { D, DIAGRAMS, SECTIONS, fig }, so all four are exported.
 */
const D = {};
const DIAGRAMS = {};
function fig(){ return ""; }

const SECTIONS = {
  "Start here":              { icon:"🧭", accent:"#0e7490", tag:"Role map, priorities and a focused study plan" },
  "1 · Face Pipeline":       { icon:"📷", accent:"#0284c7", tag:"Detection, landmarks, alignment, quality and operating conditions" },
  "2 · Face Recognition":    { icon:"🧬", accent:"#7c3aed", tag:"Embeddings, ArcFace-family losses, verification and identification" },
  "3 · Biometric Evaluation":{ icon:"📈", accent:"#d97706", tag:"FMR/FNMR, TAR@FAR, EER, protocols and open-set evaluation" },
  "4 · Fairness":            { icon:"⚖️", accent:"#059669", tag:"Subgroup analysis, uncertainty, mitigation and decision reporting" },
  "5 · Liveness & Security": { icon:"🛡️", accent:"#dc2626", tag:"PAD, deepfakes, replay, morphs, injection and layered defense" },
  "6 · Data & Training":     { icon:"🧪", accent:"#9333ea", tag:"Balanced curation, Airflow, multi-GPU training and synthetic data" },
  "7 · Production & Scale":  { icon:"☁️", accent:"#2563eb", tag:"AWS, TensorRT/ONNX, ANN search, privacy, mobile and monitoring" },
  "8 · Interview Practice":  { icon:"🎯", accent:"#db2777", tag:"Staff-level system design, rapid-fire Q&A and morning cheat sheet" },
};

module.exports = { D, DIAGRAMS, SECTIONS, fig };
