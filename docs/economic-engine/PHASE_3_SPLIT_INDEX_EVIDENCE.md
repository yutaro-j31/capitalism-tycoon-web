# P3-4 partial same-week stock-split index evidence

Starting main: `3759a6e3c43eae2ab298488ac3c896903e7b75a0`.

The already registered `tests/phase3-ownership-snapshot-test.js` extends its existing valid player-common fixture
with the actual installed `stockSplit('OWN', 2)` writer. Prior synthetic quantity edits and full stock-split economic
fault tests are retained; the new concern is binding an ownership index across a real same-root/same-week writer.

Save-false and an exception after actual save admission capture a speculative post-split index at the outer commit.
Both failures restore the entire prior state and persisted RNG, keep the root, retain the prior valid index, reject
the speculative index, preserve mirror/cache/durable bytes and start no rejected durable put. The healthy retry
and another distinct split in the same week each invalidate their predecessor index despite unchanged root/week.

Independently expected quantities scale from issued1,000 / treasury100 / outstanding900 / founder beneficial610
to factors2 and4; company/personal EXT lots stay30/20. Both cash/debt accounts and persisted RNG remain unchanged,
host RNG is not drawn, accounting validates and no command/wealth authority is granted. Production reload and a
fresh runtime hydrated solely from durable fake-IndexedDB retain the factor4 facts. Projection purity is checked.

This is partial Node/fake-IndexedDB evidence, not a new native-WebKit/physical-device result, a complete writer
inventory or family S_PASS, Authority Cutover, Phase 3 Exit or Phase 4 Entry. No production writer, settlement,
saveVersion9, old-save loader, test registration, Work B runner/workflow/config or vNext change is included.
