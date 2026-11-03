# P3-4 partial current-generation refounding evidence

Starting main: `d16eb41feac2e402b9e8bc5924861c2af061f674`.

The already registered `tests/refounding-ledger-test.js` adds ownership/control observations to an actual
`acceptBuyoutOffer(1.2)` → `foundNewCompanyAfterBuyout` journey. This supplements the existing synthetic
generation cases and import/replacement evidence; it does not adopt a new authoritative issuer family.

The first-generation fixture has 1,000,000 issued shares, 600,000 legacy founder shares and 20,000 personally
held own shares. The company-account own-share alias is removed from the fixture and its opening finance rebuilt
before observation, so first-generation control evidence is genuinely evaluated. Sale invalidates its index.
Save-false and save-throw during actual refounding restore the complete sold state into the same root, preserve
mirror/cache/durable bytes and restore the sold index; an index captured from the speculative new generation is
rejected after rollback. A healthy retry then commits the founder's existing ¥50,000,000 contribution exactly once.

The actual second generation retains the root and reuses `CPTY`. Its new founder bucket of 10,000 is kept separate
from the retained 20,000-share personal lot of the former issuer. Neither that ticker alias nor the new founder bucket
proves a new-generation security class or votes: the class collection remains empty, the old lot has no bound class
or voting units, all Control Ladder capabilities remain UNKNOWN and execution remains NOT_AUTHORIZED.
The naive legacy reconciliation would join a retained 20,000-share lot to only 10,000 newly issued shares;
ECO-011 therefore fails and Control reports RECONCILIATION_FAILED before its later generation check. The test
pins that existing fail-closed order rather than repairing quantities or treating ticker reuse as identity.
Old/sold indexes cannot bind the committed generation. Personal holdings remain once, company holdings are cleared,
both cash accounts reconcile to the contribution and finance validates. These facts are checked live, through
production reload and through a fresh runtime hydrated solely from the durable fake-IndexedDB map.

Ownership/control observations assert no full-state/persisted-RNG change, host RNG draw, cache/durable change or
IDB write admission. Existing refounding accounting, PE retention, deterministic replay and weekly checks remain.
This is scoped Node/fake-IndexedDB evidence, not a new real-WebKit/physical-iPhone result, complete family closure,
arbitrary old-save repair, S_PASS, Authority Cutover, Phase 3 Exit or Phase 4 Entry. No production/save-schema,
test-registration, CI runner/config/workflow, Work B or vNext change is included.
