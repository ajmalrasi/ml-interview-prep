# Speculative Decoding — Guess Ahead, Verify in Bulk

**TL;DR:** generation is one token per forward pass because you can't know
token N+1 before token N. Speculative decoding cheats with two models: a
small one guesses several tokens ahead, the big one verifies them all in a
single pass. Right guesses are accepted almost for free.

## Breaking the one-token-per-pass constraint

Generation is one token per forward pass because you don't know token N+1
until you've computed token N. **Speculative decoding** breaks that
constraint with a cheat: two models.

A small, fast **draft model** guesses several tokens ahead — say 4 to 8 —
cheaply. Then the big model runs **once** to verify all of them in parallel.

That works because verification doesn't have the one-at-a-time dependency
generation has: checking "would I have written these tokens?" can happen for
all of them in a single pass. Correct guesses are accepted for free. The
first wrong guess is thrown away, and the big model's own token is used
instead.

```rawhtml
<div class="diagram"><div class="vflow" style="align-items:stretch">
  <span class="node data">draft model <span class="nsub">small, fast — proposes: "the" "cache" "grows" "with" "context"</span></span>
  <span class="varw" title="all 5 handed to the big model at once"></span>
  <span class="node">verify <span class="nsub">big model, 1 pass — ✓ ✓ ✓ ✗ (rejected at token 4)</span></span>
  <span class="varw"></span>
  <span class="node out">3 accepted + big model's own 4th token <span class="nsub">= 4 tokens for ~1 big-model pass instead of 4</span></span>
</div></div>
```

Plain version: instead of writing word by word, pausing to think after each
word, you let a fast intern sketch the whole sentence. The expert checks it
all at once — keeps what's right, redoes only what's wrong.

A key correctness point worth saying in an interview: the output is
**identical** to what the big model would have produced alone. Verification
accepts exactly the tokens the big model agrees with. It's a latency trick,
not a quality trade.

## Lives or dies on the draft model's hit rate

A bad draft model wastes the verification pass on tokens that get rejected
anyway — worse than no speculation at all.

| Output type | Draft hit rate | Speculation payoff |
|---|---|---|
| Code, JSON, structured formats | high — predictable next tokens | large speedups |
| Boilerplate/formulaic prose | decent | moderate |
| Creative, high-entropy text | low | can be net negative |

This has a neat tie-in to DocsMind's roadmap: tool-call JSON (see
[12-tool-calling](../12-tool-calling/reliability-and-security.md)) is
exactly the predictable, structured output where speculation shines —
serving and reliability concerns end up pointing at the same workload.

## How you'd validate it

Same discipline as everything else: measure tok/s with and without a draft
model, per workload type, on the actual card. Report the acceptance rate
alongside the speedup — a high speedup with a high acceptance rate is a
result; a speedup claim without the acceptance rate is a vendor slide.

→ Next: **[16-python-concurrency/README.md](../16-python-concurrency/README.md)**
