/* Section metadata for the Python interview-prep learning site. */
const D = {};
const DIAGRAMS = {};
function fig(){ return ""; }

const SECTIONS = {
  "Start here":                  { icon:"🧭", accent:"#3b82f6", tag:"A learning path that starts with understanding, not testing" },
  "1 · Map, Filter & Reduce":    { icon:"🔁", accent:"#e0663f", tag:"Transform, select and fold — plus comprehensions and lazy iterators" },
  "2 · Core Python Semantics":   { icon:"🧠", accent:"#7c6cf0", tag:"Names, objects, mutability, identity, equality, hashing and scope" },
  "3 · Functions & Control Flow":{ icon:"ƒ", accent:"#c98a1a", tag:"Signatures, arguments, closures, decorators and exception strategy" },
  "4 · Iterators & Generators":  { icon:"♻️", accent:"#2f9e6f", tag:"The iteration protocol, generators, yield from and streaming tools" },
  "5 · The Object Model":        { icon:"🧩", accent:"#14a3a3", tag:"MRO, super, descriptors, properties, dataclasses and slots" },
  "6 · Concurrency":             { icon:"⚡", accent:"#dd5b54", tag:"The GIL, threads, processes, asyncio, races and backpressure" },
  "7 · Production Python":       { icon:"🛠️", accent:"#5b7fd8", tag:"Resource safety, typing, testing, logging, performance and memory" },
  "8 · Coding Practice":         { icon:"⌨️", accent:"#8a67d5", tag:"Problems first, then readable worked solutions and trade-offs" },
  "9 · Interview Practice":      { icon:"🎯", accent:"#cc5fab", tag:"Answer frameworks, hard Q&A, a mock interview and cheat sheet" },
};

module.exports = { D, DIAGRAMS, SECTIONS, fig };
