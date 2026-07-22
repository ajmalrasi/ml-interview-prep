# Speculative Decoding — Guess Ahead, Verify in Bulk

**TL;DR:** generation is one token per forward pass because you can't know
token N+1 before token N. Speculative decoding cheats with two models: a
small one guesses several tokens ahead, the big one verifies them all in a
single pass. Right guesses are accepted almost for free.

## Beginner mental model

Think of autocomplete reviewed by an expert. A fast assistant writes several likely words;
the expert checks the entire proposal, keeps the correct prefix, and replaces the first
mistake. If the assistant is often right, one expensive review commits several tokens.

> **ML bridge:** this resembles a student/teacher setup, but it is **not distillation**.

| Student/teacher distillation | Speculative decoding |
|---|---|
| Train a small student to imitate a teacher | No training step is required by the mechanism |
| Usually deploy the student alone | Draft and target both run during inference |
| Output quality/distribution may differ from teacher | Correct verification preserves the target distribution |
| Goal is a cheaper deployed model | Goal is fewer sequential target-model passes |

The sequence is: **draft K tokens → target scores the block once → accept the contiguous
prefix → use a target correction at the first rejection**. Later draft tokens are discarded
because they were conditioned on a token the target rejected.

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

## Try it: proposal length × acceptance

Change how many tokens the draft proposes and how often it agrees with the target. The
target verifies the whole proposal in one pass, but it can commit only the accepted prefix
plus its correction at the first mismatch. Tokens after that mismatch are discarded.

```rawhtml
<div id="speculative-widget"></div>
```

## Why speculation over ordinary decode—and when not?

| Situation | Choice | Reason |
|---|---|---|
| Code, JSON, boilerplate | Try speculation | Predictable continuations can produce a long accepted prefix |
| Creative or high-entropy text | Benchmark carefully | Early rejection wastes draft work and later proposals |
| Large draft almost as costly as target | Ordinary decode may win | Draft overhead can erase avoided target passes |
| Target already runs large efficient batches | Benchmark at real concurrency | Speculation can interact differently with batching than at load 1 |

**The decision metric is not acceptance rate alone.** Measure end-to-end tokens/second and
latency with draft cost included, then report acceptance rate to explain the result.

Plain version: instead of writing word by word, pausing to think after each
word, you let a fast intern sketch the whole sentence. The expert checks it
all at once — keeps what's right, redoes only what's wrong.

A key correctness point worth saying in an interview: with greedy decoding, accepted tokens
match what the target would choose. With sampling, a correct acceptance/rejection algorithm
preserves the target model's output distribution. It is a latency mechanism, not permission
to silently accept a lower-quality draft answer.

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
