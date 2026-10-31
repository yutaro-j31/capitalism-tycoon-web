# P3-4 partial captured buyback base rejection evidence

Baseline: `1bb4d6d5e50d2a097644e36b30d4a206eeb852e4`.

The already registered `tests/shareholder-buyback-save-atomicity-test.js` retains its installed-command and
actual direct-export cases. Eight additional cases capture the own `engine.js` prototype declaration of
`buybackOwnShares` (W-BUYBACK-BASE), require it to differ from the installed entry, and trap accidental calls
to that installed entry. The planner still rejects this internal entry; no routing or authority is added.

Two fixtures cover ordinary outside float (9,999 shares) and the seven-share cap. Each executes the captured
body inside the existing `runTransaction`, observes a true result and real cash/treasury mutation, then refuses
through outer caller false/throw or injected outer save-false/post-admission save-throw. Full predecessor state,
including finance/history/holdings/RNG, exact localStorage mirror/cache/durable bytes and no rejected durable
put are required. Production reload and fresh durable-only fake-IDB hydration precede recovery. The restored
installed command must then pass the original independent whole-yen settlement/book/mirror/account-separation
oracle, with exactly one successful recovery put and fresh hydration. Existing assertions remain intact.

This proves rejected speculative calls only. The old base source uses raw quantity-times-price arithmetic and
omits the installed settlement's treasury-book/receipt/mirror work. These pre-existing unadopted semantics are
not certified as a successful transaction, repaired, rounded, or enabled here. A healthy retry deliberately
uses the supported installed writer; it does not commit the legacy candidate. Normal legacy settlement,
standalone base calls, pending predecessor schedules, all callers and base-specific native WebKit remain
unproved. The earlier direct-export evidence does not close those gaps.

Node/fake-IDB partial evidence only; no new physical-iPhone claim, whole-family S_PASS, Authority Cutover,
P3-10 executable command, Phase 3 formal Exit or Phase 4 Entry. No production writer, SAVE_KEY/saveVersion9,
old-save loader, RNG/rounding policy, test registration, Work B CI/runner/config/workflow or vNext change.
