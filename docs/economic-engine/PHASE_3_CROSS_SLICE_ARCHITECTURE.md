# Phase 3 Cross-slice Ownership Architecture

**PROPOSED READ-ONLY EXTENSION CONTRACT. No implementation, authority cutover, migration, Phase Exit/Entry or merge authorization.**

Audited production main: `743d08d1867f453fe09c61e1fd5312c846cfc1eb`, 2026-10-15 JST. This common contract precedes P3-5..12 design adoption; approved Entry/P3-1/2/3 remain normative. No earlier contract or formal roadmap is rewritten.

## 1. Architecture and source authority

Raw committed legacy snapshot → validated identity/alias index → independently pure family adapters → canonical beneficial-position/relationship composition → voting eligibility / founder wealth projections → separately approved command guard. Only a future explicitly adopted writer may mutate ownership; projection never writes a mirror back.

| Fact / source | Legacy writer / installed chain | Reader | Authority boundary |
|---|---|---|---|
| Player issued/founder/treasury/designated personal lot | engine + expansion + shareholder returns + crisis + M&A wrappers | existing ownershipProjection / ownershipReconciliation | P3-4 stopped; P3-2 is diagnostic |
| market / personalStocks / companyStocks | engine trades, expansion stockSplit, personalStockMargin forced helpers, startup IPO | P3-5 | Phase9 settlement unchanged |
| subsidiaries / maSubsidiaries | makeSubsidiary; listed subsidiary market/IPO/secondary/follow-on/control; ma-deal-room → board/financing/PE wrappers; disposal/group actions | P3-6 | Phase10/11/12 boundaries unchanged |
| maSubsidiaries commercialization spinouts | new-business-commercialization.js::act(mode=spinout), installed commercializeNewBusiness | P3-6 unresolved raw relationship | derived row lacks retained ownership/class/voting provenance; never infer100% |
| productVentures / newBusinesses / overseasSubsidiaries | existing operating/overseas writers (not adopted here) | explicit unsupported/source-coverage disclosure | operational assets are not automatically legal issuers; parent equity coverage must disclose them |
| peDeals + mirrored subsidiary | expansion create/transfer/sync/exit; pe-value-creation wrapper | P3-7 canonical interest; P3-6 hierarchy | no double asset; Phase13 unchanged |
| peFirm.funds/deals/cash | peFund formation/service/distributions; peAcquisition closing; pePortfolioOperations exit/parent conversion | P3-7 | fund and external co-invest not founder gross assets |
| startups / activeFundingRound / ipoStockID | engine invest/follow-on/close/writeoff/list; expansion secondary; weekly update | P3-8 | Phase14 settlement unchanged |
| Existing personalNetWorth and consumers | engine base + expansion wrapper | separate P3-11 component projection | no consumer/credit/progression cutover |
| Debt / pledged assets | legacy finance and specialist lenders; #981 proposed future debt authority | evidence only | Phase4 Entry not authorized |

Source inventory is a CODE search and installed-chain inspection, not a formal proof all dynamic writers were found. P3-4 must refresh Track A over direct/base/raw/shadow/weekly/whole-state/import paths before adoption. A source path missing from this summary is not permission to leave a parallel authoritative writer.

## 2. Proposed common API and types (not production exports)

Prefer extending the existing `economicReadModel` public module with pure opt-in methods; preserve all existing API result shapes/readModelVersion. Internal helper names are implementation choices. New ownership snapshot version1 is a new return type, not save schema.

```ts
type Reason = { code: string; path: string; message: string; evidenceRefs: string[] };
type SourceRef = { path: string; durableId: string|null; family: string;
  role: 'current'|'alias'|'historical'|'unresolved' };
type Evidence<T> = { status: 'known'|'unknown'|'invalid'; value: T|null;
  sourceRefs: SourceRef[]; reasons: Reason[] };
type EntityRef = { entityId: string|null; generation: number|null;
  identityStatus: 'proven'|'source-scoped'|'unresolved'; sourceRefs: SourceRef[] };
type Position = { positionId: string; ownershipKey: string|null;
  issuer: EntityRef; securityClassId: string|null;
  registeredHolder: EntityRef; beneficialOwner: EntityRef;
  accountKind: 'personal'|'company'|'fund'|'external'|'unknown';
  quantity: Evidence<number>; economicFraction: Evidence<number>;
  votingUnits: Evidence<number>; sourceRefs: SourceRef[];
  assetRole: 'canonical'|'alias'|'historical'|'unresolved' };
type AdapterResult = { authority: 'read-only'; adapterVersion: 1;
  complete: boolean; entities: EntityRef[]; classes: object[];
  positions: Position[]; relationships: object[]; unresolved: object[];
  issues: Reason[]; sourceCoverage: object[] };
```

`complete` describes declared adapter evidence scope, not a full legal registry, wealth total, adoption approval or command authority. Resolved identity with unknown class/votes can be a known economic relationship while control remains unsupported. Unknown quantity is null+reason, never0. Null issuer/class cannot create an ownershipKey usable for aggregation; unresolved rows retain diagnostic source IDs but cannot merge by name.

Proposed `buildOwnershipIdentityIndex(rawState)` and `projectOwnershipSnapshot(rawState)` create a snapshot-local validated index/composition. All APIs reject non-object roots with structured INPUT_INVALID; bad rows are quarantined with exact paths and unaffected facts may return partial evidence. Index and snapshot share an opaque in-memory source token bound to the exact immutable input (never saved/time/random); passing an index for another input rejects. Caller must supply a fresh immutable committed view after each successful transaction/hydration. No reliance on week alone: same-week trades change ownership.

### Stable reason-code contract

| Code | Required result / explanation |
|---|---|
| INPUT_INVALID | malformed root/row; partial affected-row quarantine or root error; never coerce |
| IDENTITY_UNPROVEN / GENERATION_UNPROVEN | entity/old-company binding lacks evidence; issuer/actor not executable |
| ALIAS_CONFLICT / ID_COLLISION | multiple sources disagree or ID reused; affected claim excluded from totals/rights |
| CLASS_UNKNOWN / RIGHTS_UNKNOWN | legal class/voting terms absent; economic evidence retained separately |
| DENOMINATOR_UNKNOWN / DENOMINATOR_ZERO | votes cannot be evaluated; zero denominator never eligibility |
| CONSERVATION_INVALID | issued/treasury/outstanding/known-holder quantities inconsistent; preserve source |
| QUANTITY_OUT_OF_ENVELOPE / NUMERIC_DOMAIN_UNSUPPORTED | share envelope invalid or voting integer domain unsupported |
| INDIRECT_CONTROL_UNSUPPORTED / CYCLE_UNSUPPORTED | graph/delegation cannot establish direct rights |
| ISSUER_FAMILY_UNSUPPORTED / AUTHORITY_NOT_ADOPTED | facts may project; new command execution prohibited |
| THRESHOLD_NOT_MET | valid complete evidence, exact comparator false; INELIGIBLE rather than UNKNOWN |
| EFFECT_UNAPPROVED / STALE_EVIDENCE | proposed command effect absent or revision changed; direct execution rejects |
| VALUATION_SOURCE_CONFLICT / VALUATION_BASIS_UNSUPPORTED | amount unknown, raw observations retained |
| LIABILITY_COVERAGE_UNKNOWN / VALUATION_INCOMPLETE | total wealth null; known subtotal explicitly incomplete |

Code strings and source paths are deterministic API data; localized message text is UI only and must not determine permission. UNKNOWN versus invalid versus INELIGIBLE remain distinct. Unrecognized reason/evidence state fails closed. Numeric residuals never rewrite source quantities. Adding a diagnostic code is additive; changing semantic meaning requires a contract revision.

## 3. Identity and generation

Reuse existing P1 IDs exactly: entity:company:player, entity:person:founder and security:player-company:common. These are active-slot references, not proof that every historical company generation is one legal issuer. Keep existing P1 IDs unchanged; proposed metadata includes currentCompanySerial and provenance only when proven. Do not append serial silently to existing public IDs or rewrite historical operations.

For non-player sources, deterministic proposed IDs encode durable kind/source ID using injective escaping (UTF-8 percent encoding with delimiter escaping), scoped to proven owner/generation where required. Examples: entity:company:startup:<escaped startup.id>, entity:fund:pe:<escaped fund.id>, entity:company:ma:<escaped target.id>. Security class uses an explicit class durable ID/binding only; unknown class=null, not guessed common. Namespace+length/escaped components must be collision-tested; no hash-only IDs, RNG, array index, display name or tickers as legal identity. A source-scoped ID is labeled as such and is not sufficient historical identity for new commands.

Commercialization spinouts retain derived spinout-* IDs but not projectID/startWeek/ownership/class on maSubsidiaries rows. Treat them as source-scoped unresolved relationships; never reconstruct their identities from bounded commercialization history, regenerate derived IDs or infer100% ownership from collection membership/EV. Duplicate/reused spinout IDs or lost history stay unsupported. M&A target stable key/deal/source IDs and reciprocal conversion evidence establish aliases when unique; duplicate durable IDs quarantine involved rows. A listing market.id is an instrument alias, not automatically a permanent legal issuer. Unique startup.id + ipoStockID provenance may bind a listing; a ticker rename/reuse without retained linkage stays unknown. IPO changes listing status and possibly class; it does not create a second issuer or imply class rights continuity. Split preserves known issuer/class and scales observed quantities; delisting preserves position identity and changes status only. Reader never replays a split or IPO.

Company sale/refounding increments currentCompanySerial and replaces company roots while preserving personal assets. Source links that cannot distinguish old/new company or own-ticker interests are unresolved for new capabilities. Do not attach retained personal holdings/debt to a refounded issuer merely because the active-slot ID/ticker matches. Historical generation ambiguity is shared with #981; persisted generation adoption/repair remains separately approved.

## 4. Beneficial dedup and composition

Canonical position identity is proven issuer + class/interest-kind + legal registered holder + proven beneficial owner + generation. Source path identifies a bucket, not another asset. A split/renaming does not change beneficial identity. Keep source lots and registered versus beneficial roles visible.

Composition builds alias claims, validates uniqueness/agreement/lifecycle, then includes one canonical economic interest; retained alias/history rows are excluded from all totals. Do not use numeric coincidence to prove alias identity. Conflicts quarantine the entire affected economic claim with explicit reasons; do not prefer maximum/minimum/latest/first silently.

| Overlap | Composition rule |
|---|---|
| P3-1 unresolved row versus resolved P3-5 position | replacement by exact source key; no concatenated totals |
| original founder + designated personal own lot | one P3-2 founder beneficial position with two evidence buckets |
| company-owned peDeals and subsidiary mirror | P3-7 canonical stake; P3-6 relationship aliases same interest |
| startup company stake and makeSubsidiary mirror | one company interest; personal startup interest separate |
| zeroed startup IPO stake and listed lot | current listed position; startup/round remains history |
| nonzero startup stake and IPO lot both claiming converted asset | conflict; no valuation/control until reconciled |
| exited fund deal and reciprocal parent subsidiary | parent current interest; fund historical deal/paid distributions excluded |
| parent equity including subsidiary versus look-through asset | parent value OR decomposition, never both |

No aggregation across company/person/fund vehicles for command eligibility; no automatic family/trust/joint control. Indirect economic path diagnostics require complete acyclic graph and documented coverage. Cyclic/cross-holding value or votes stays unsupported; direct valid facts remain available.

## 5. Rights and numeric domains

Economic fraction, legal share quantity, voting units, management rights, fund capital rights and proceeds participation are separate types of evidence. All external absent class/treasury/non-voting data remains unknown. Player single-common evidence comes from approved P3-1/2 only. Legacy ratio/source quantity validity does not establish executable voting.

Readable share quantities use the existing P3-1 predicate: typeof q === 'number', Number.isFinite(q), 0 <= q <= Number.MAX_SAFE_INTEGER; no strings/coercion/clamping. Fractions inside that envelope remain diagnostic evidence, not executable voting units. P3-2 exact Number/TwoSum conservation semantics remain unchanged. Tests distinguish MAX_SAFE_INTEGER, just-over,1e20 and finite fractional quantities. P3-9 accepts finite nonnegative safe integer voting units and exact BigInt comparison in transient calculation; unsupported fractions fail closed. Never persist BigInt or round quantities to pass thresholds. Phase0 authoritative monetary-posting envelope is abs(amount *100) <= Number.MAX_SAFE_INTEGER at the approved JPY0.01 quantum; legacy prices/valuation estimates have separate precision and are not required to be cent-quantized just to display evidence. Monetary projections use finite in-envelope Number evidence; enforce source rounding domain separately from quantities/votes and reject nonfinite/overflow. No EPSILON may grant rights. ECO-010 must be evaluated per class with all denominator terms known, not “passed” by assuming treasury0 externally.

## 6. Purity, transaction and save contract

No new saved registry, root, saveVersion, SAVE_KEY, normalization/backfill or historical receipt. Readers validate raw JSON data descriptors before dereference and reject getters/proxies/exotic data where detectable; immutable plain JSON is the supported input boundary. No live ensure/preview that mutates state, no RNG or clock, no finance writes, no emit/save/flush. Output owns its data; freezing source is a mutation and forbidden. Repeated calls preserve complete source/RNG/cash/ledger/debt/ownership and storage bytes.

P3-4 remains only the separately approved candidate ownership authority migration. P3-10 economic effect writers must commit all adopted quantities/cash/book/status/receipt in the existing outer transaction/checkpoint; no new command-specific rollback engine. Strict EconomicOperation schema is unchanged; nonmonetary information display has no fake zero posting. Later settlement authority stays Phase9/10/13/14.

## 7. iPhone performance contract

Build indexed lookup once per immutable source snapshot, O(N+E) index and expected O(N+E) adapters plus deterministic output sorting O(R log R), storage O(N+E). Do not full-clone state, rebuild entire graph per issuer card or call mutating helper on clones. Render selected issuer only, paginate/window long lists and retain44px touch targets. Pure cache outside saved state may be used only with explicit snapshot identity/revision invalidation; week/state-object identity alone is insufficient because live objects mutate in-place and hydrate/rollback replace data. Correctness first: skip cache until reliable invalidation exists.

Proposed scale fixture100/1000 issuers + proportional holdings/edges measures index/build/selected-issuer timings, allocation/output rows and repeated UI calls, using browser performance.now outside simulation only. Compare same-device baseline; no invented millisecond SLA or claimed physical-iPhone measurements. BigInt voting compares selected issuer, not every edge on every render. Detect quadratic repeated scans, retained snapshots/listener growth and duplicate renders. Existing physical-iPhone baseline protocol remains normative.

## 8. Phase4 interface review (#981)

Reviewed PR981 head7234639d094309a837438ebe82a62af8bb5375b0 proposal schema and additional P1 audit. DebtInstrumentId, issuerEntityId/securityClassId, borrowerEntityId/lenderEntityId are distinct identities. Company/person/fund source scopes and company-generation evidence must agree across debt/ownership. Founder shareholder loan is personal debt receivable versus company payable; company EquityValue already subtracts its debt. Pledged ownership/collateral links asset/security ID+beneficial fraction+lien evidence; a pledge does not transfer title or grant creditor voting/control absent explicit terms. Do not reduce gross wealth twice for pledge and debt. Cost of Debt consumes debt metrics; ownership provides legal attribution and pledged evidence only. WACC/Cost of Equity/EV bridge remains Phase6.

Recommended amendments to981 (proposal only, no edits to its branch): reference this shared generation/alias contract; require loan/pledge duplicate and founder receivable tests across sale/refounding; carry incomplete liability coverage into wealth total; update stale issue/PR status at merge. #981's six additional P1 families are reported prior TEST evidence on their stated baselines, not newly re-executed here; Owner has separately approved repairs, which are not implemented by this task. Phase4 Entry requires their evidence-based disposition plus Phase3 formal completion/approval. Docs merge approval and production Entry remain separate.

## 9. Reviewable boundary

P3-5..8 are safe candidates for separate pure implementation approval while P3-4 is stopped: no competing writer or consumer change. P3-9/P3-11 pure preparation can be partial/unknown, not pretend missing evidence is complete. P3-10 production blocked; P3-12 NOT PASS. Exact per-slice specifications, tests, dependencies, Owner decisions and review evidence are companion docs. Formal approved contracts/Track A/Phase4 branches are untouched.
