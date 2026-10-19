# P3-9 slice — player common-class Control Ladder eligibility (read-only)

**Contract:** [PHASE_3_P3_9_CONTRACT.md](PHASE_3_P3_9_CONTRACT.md) §4 and §15. A pure, player-only projection may precede P3-4. It is marked read-only and non-executable.
**Authority:** READ_ONLY. There is no command, writer, save root, adoption marker or UI wiring. P3-4 remains STOPPED, and P3-10 command activation remains separately gated.

## API

```js
__capitalismTycoonModules.phase3ControlEligibility.projectControlEligibility(snapshot, {issuerEntityId, actingEntityId})
```

- **Input:** the raw P3-2 `economicReadModel.ownershipReconciliation(state)` result. JSON data from any realm is accepted; an engine instance is never accepted.
- **Output:** a deep-frozen object with these fields:
  - `authority: 'read-only'`, `executable: false`
  - `status: 'EVALUATED' | 'UNKNOWN'`
  - `votingEvidence`
  - six `capabilities`, each `{commandId, status: ELIGIBLE | INELIGIBLE | UNKNOWN, threshold, executionStatus: 'NOT_AUTHORIZED', reasons, evidenceRefs}`
  - `issues`, using the shared `Reason` shape

## Exact comparator

With n = the actor's beneficial voting units and d = eligible outstanding units (issued − treasury), every comparison is a `BigInt` cross-product:

| Stage | Rule |
|---|---|
| `informationRequest` | `100n ≥ d` |
| `managementProposal` | `100n ≥ 3d` |
| `blockSpecialResolution` | `3n > d` |
| `ordinaryResolution` | `2n > d` |
| `specialResolution` | `3n ≥ 2d` |
| `squeezeOutEligibility` | `10n ≥ 9d` |

There is no floating ratio, rounding or EPSILON. The disclosure (5%) and equity-method (20%) markers are not ladder stages and are not emitted.

## Supported scope and fail-closed cases

**EVALUATED** only when all of the following hold:
- The issuer is `entity:company:player` and the actor is `entity:person:founder`.
- The reconciliation is `ok`.
- There is exactly one class, it is `common`, it has `votingRightsPerUnit === 1`, and its evidence is `legacy-player-single-common-class`.
- `issued = treasury + outstanding`, all as safe integers.
- The actor has exactly one beneficial holding in that class, and it is a safe integer ≤ d.
- d > 0.

Anything else returns **UNKNOWN for all six stages**, never INELIGIBLE-zero, with one explicit reason:

| Reason | Cause |
|---|---|
| `INPUT_INVALID` | Malformed, accessor, non-enumerable or exotic-prototype evidence. Getters are never executed. |
| `ISSUER_FAMILY_UNSUPPORTED` | Any other issuer. |
| `ACTOR_UNSUPPORTED` | The company itself, other persons, or missing or duplicate holdings. |
| `RECONCILIATION_FAILED` | Reconciliation not ok, conservation broken, or holder above d. |
| `CLASS_RULES_UNKNOWN` | Other class shapes or vote weights. |
| `NUMERIC_DOMAIN_UNSUPPORTED` | Fractional or unsafe units. |
| `DENOMINATOR_ZERO` | d = 0. |
| `OWN_SHARE_ALIAS_UNRESOLVED` | The company holds own shares outside treasury. |

## Purity

- No state, RNG, wall-clock, save, `finance.event` or normalize access. The projector receives only the snapshot.
- Repeated, JSON round-tripped and key-reordered input produces identical output.
- The test checks that state and host RNG are unchanged around the production `ownershipReconciliation` + projector path.

## Tests

`tests/phase3-control-eligibility-test.js` (canonical `run-all.js`, shard L) covers:
- the 18 boundary cases from the contract;
- treasury exclusion (d = 900, n = 450 is exactly 1/2);
- the coprime denominator d = 7;
- safe-integer maximum cross-products;
- every UNKNOWN reason, including accessor, non-enumerable and inherited-prototype evidence;
- production wiring with founder legacy and personal own-share buckets;
- the own-share alias case and a fractional legacy bucket;
- determinism and deep freeze.

No WebKit is needed, because there is no UI or browser behavior change. A UI explanation is a separate optional slice under the contract's §13.
