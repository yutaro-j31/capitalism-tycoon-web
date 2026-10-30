# P3-4 partial captured IPO base evidence

Base: main `301e69b71a599c497a1748c93224d0b3660b50eb`, after #1218. This test-only slice extends the already
registered `tests/parent-ipo-save-atomicity-test.js` for the W-IPO-BASE boundary in the writer matrix.

The test captures the actual own `executeIPO` declaration on the base prototype and requires it to differ from the
final installed method. It calls that function only inside the existing production `runTransaction`, with the
existing production IPO-ready fixture. No independent transaction or replacement IPO implementation is introduced.

Three cases cover normal commit, save-false and post-admission save-throw. Failure restores full live state including
RNG, exact mirror/cache/durable bytes, and starts no rejected durable put. Reload and fresh durable-only hydration
use the existing suite oracle. Retrying the same captured function then succeeds once. Independent expected primary
and founder-secondary quantities, whole-yen account-specific proceeds, the pinned IPO reward, issued-share mirror,
unchanged holding maps and valid accounting are checked. A repeat after listing is rejected without another durable
put or economic mutation. The PE-exit and network wrapper state must remain untouched, explicitly distinguishing
this base path from the installed IPO chain covered by the existing tests.

A local sensitivity control that replaces the captured invocation with the installed chain exits 1 at the PE-exit
state assertion. The normal captured call passes, so merely holding a base-function reference is not sufficient proof.

This is Node/fake-IndexedDB evidence for a captured base **with an explicit outer boundary**. It does not certify
standalone base-call atomicity or make that path a supported public command; it does not replace or adopt the
installed chain. No new native WebKit evidence is claimed. Pending #1213 owns IPO verification routing and its
financial review gate. No production code, schema, registry, test registration, CI runner/workflow or Work B file
changes. Whole-family closure, Authority Cutover, S_PASS, Phase 3 Exit and Phase 4 Entry remain separate gates.
