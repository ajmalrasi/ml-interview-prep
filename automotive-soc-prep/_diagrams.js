/* Section metadata for the Automotive SoC AI Application Engineer prep site.
 * No embedded concept diagrams here (DIAGRAMS is empty); build.js still
 * imports { D, DIAGRAMS, SECTIONS, fig }, so all four are exported.
 */
const D = {};
const DIAGRAMS = {};
function fig(){ return ""; }

const SECTIONS = {
  "Start here":                    { icon:"🧭", accent:"#3b82f6", tag:"What the automotive-SoC role wants and how to use this pack" },
  "1 · Embedded Accelerators":     { icon:"🔩", accent:"#e0663f", tag:"NPU / DSP / CNNIP HWA, operator mapping, offload, fallback" },
  "2 · ONNX Toolchain":            { icon:"🧩", accent:"#7c6cf0", tag:"Graph surgery, QDQ models, compiler/runtime, partitioning" },
  "3 · Quantization for Embedded": { icon:"📐", accent:"#c98a1a", tag:"PTQ, QAT, calibration, accuracy-loss diagnosis & mitigation" },
  "4 · BEV & Perception Models":   { icon:"🚗", accent:"#2f9e6f", tag:"Detection, segmentation, BEV (LSS / BEVFormer / BEVFusion), occupancy" },
  "5 · SoC Architecture":          { icon:"🧠", accent:"#14a3a3", tag:"Memory hierarchy, DMA, IPMMU, multi-core scheduling & scaling" },
  "6 · Runtime, Safety & Validation":{ icon:"🛡️", accent:"#dd5b54", tag:"Linux / QNX, SIL / HIL, ISO 26262 / ASIL functional safety" },
  "7 · Interview Q&A":             { icon:"🎯", accent:"#cc5fab", tag:"Rapid-fire Q&A and the morning-of cheat sheet" },
};

module.exports = { D, DIAGRAMS, SECTIONS, fig };
