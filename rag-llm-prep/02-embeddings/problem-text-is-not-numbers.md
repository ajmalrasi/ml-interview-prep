# The Problem: Text Is Not Numbers

**TL;DR:** Computers do math, not language. To search by meaning, we need to
turn text into numbers first.

## What computers can do with numbers

Given two numbers, a computer can tell you:
- Which is bigger
- How far apart they are
- How similar they are

Given two sentences in English, a computer can't do any of that without
first converting them.

## Keyword search: the old way

The simplest approach: does the word "black hole" appear in this document?

```rawhtml
<div class="example">
  <span class="ex-q">Question: "What stops light from escaping a black hole?"</span>
  <span class="ex-a">Document: "Nothing can escape a black hole's gravity…" → <span class="hl">match ✅</span> (keyword overlap)<br>
  Document: "Beyond the event horizon, not even light gets out…" → <b>no keyword match ❌</b> — yet it's the better answer. That's the problem embeddings solve.</span>
</div>
```

The second document is *about* exactly this, but doesn't use the words "black
hole" or "escape." Keyword search misses it entirely. This is the fundamental
limit of exact-match approaches like BM25.

## What we need instead

We need a way to represent meaning so that:

```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr">"What stops light from escaping a black hole?"</span></div>
  <div class="frow"><span class="fexpr fv" style="font-size:22px">≈</span></div>
  <div class="frow"><span class="fexpr">"Beyond the event horizon, not even light gets out…"</span><span class="fnote">close in meaning despite zero shared keywords</span></div>
</div>
```

...are recognized as related, even though they share almost no words.

The solution is **embeddings** — turning each piece of text into a list of
numbers that represents its meaning in a way that similar meanings get similar
numbers.

→ Next: **[what-is-an-embedding.md](what-is-an-embedding.md)**
