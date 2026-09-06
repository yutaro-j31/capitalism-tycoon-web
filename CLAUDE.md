# Capitalism Tycoon Web — project-specific rules and design knowledge

> The filename `CLAUDE.md` is retained for compatibility with existing tooling/history. These rules apply to **all coding agents**, including Codex. Operational workflow lives in `AGENTS.md`; this file stores project-specific design contracts, runtime constraints, map contracts, and known pitfalls.
>
> Do not read every section for every task. Use the section relevant to the work, following the routing in `AGENTS.md`.

## 1. Game design direction

The product is **資本主義ポケット TYCOON / Capitalism Tycoon Web**. The primary product/UX reference is **Coffee Inc 2**; Capitalism / Capitalism Lab mainly inform deeper economic, operating, and capital-allocation systems.

Two founding routes are legitimate game designs:

1. **Store/operator route** — begin with an operating business such as ramen, deepen store operations, establish HQ functions, then diversify.
2. **Investment-company route** — begin without owning a store, use company capital for investment/capital allocation, then expand into HQ functions, other businesses, M&A, etc.

Do not make “owns at least one ramen store” a universal progression prerequisite. Investment-company functionality must use **company cash, company holdings, and company ledger**, never silently personal cash/holdings.

Do not interpret multiple founding routes as “unlock everything immediately.” Each route keeps staged progression. Prefer capability/unlock logic over resurrecting the old PR #391 monolithic `founding-routes-integration.js` or unnecessary `foundingRoute` state.

The current operating-depth strategy is to deepen five pillars rather than spread shallow mechanics across every business type:

- `ramen`
- `conveni`
- `gym`
- `productVentures` (IT company)
- `realEstateAgency`

Non-core business data remains for save/data compatibility. When priorities are otherwise equal, deepen operations, customers, products, supply, workforce, advertising, competition, and meaningful player trade-offs before adding another isolated finance/governance surface.

`market.js`, `supply.js`, and `workforce.js` being ramen-focused is an intentional staged state, not evidence that the investment-company route is forbidden. Expand detailed store operations deliberately, one area at a time, with the relevant deterministic fingerprints checked.

`docs/gameplay-systems-roadmap.md` is the current gameplay depth tracker. `docs/DEVELOPMENT_ROADMAP.md` is a retired saveVersion-8-era plan and is not the current roadmap.

## 2. Core invariants

These are non-negotiable unless the user explicitly authorizes a dedicated migration:

- `SAVE_KEY=capitalism_tycoon_web_v1`
- `saveVersion=9`
- backward compatibility with old saves
- deterministic simulation
- accounting integrity
- complete separation of company assets/cash from personal assets/cash
- no `Math.random()` in deterministic production simulation paths
- UI rendering must not consume simulation RNG
- iPhone Safari is the priority client
- no direct push to `main`
- no force-push
- one feature/fix/infrastructure concern per PR
- never delete tests, unregister tests, add fake skips, or weaken assertions to obtain green CI

A timeout increase is prohibited **when it hides a regression**. A dedicated CI PR may increase a timeout when measured healthy runtime plus normal variance shows the existing budget is too tight; include measurements and investigate the bottleneck rather than changing only the number without evidence.

## 3. D UI shell and browser runtime

D UI (`js/d-ui-shell.js`, `js/d-ui-context-tabs.js`, and `css/d-ui-*.css`) is the production visual language. Extend it screen-by-screen; do not introduce a competing design system.

Do not trace/copy third-party game artwork. Layout and interaction patterns may inspire the design, but assets must remain original.

New visual styling belongs in `css/d-ui-*.css` unless an existing contract explicitly says otherwise. `css/app.css` is protected by byte-level extraction tests; do not casually edit it.

The production startup MutationObserver count and external enhancer registration budget are guarded by tests. The current external enhancer budget is 79. Prefer extending existing D UI enhancer hooks or adding static `d-` classes where possible instead of creating more startup observers/enhancers.

Never rely on hover as the only way to perform a required action on iPhone. Maintain usable touch targets, no horizontal overflow, and avoid unnecessary DOM proliferation or expensive synchronous interaction work.

`play.html` is only a `location.replace` redirect to `index.html`. Do not revive assumptions that runtime remains on `play.html` or that every script receives a launch token.

## 4. Phase 2 production map contract

The production map architecture is:

**Canvas 2D city + local sprite assets + DOM marker overlay + pannable world**

Responsibilities:

- Canvas: city background, roads, sidewalks, parks/open space, parcels, buildings, landmarks, scenery, shadows, greenery, non-interactive props
- DOM: store/tenant/office/real-estate markers, selection, filters, taps, details, accessibility

`Phase 2` is the only production renderer. Do not reintroduce the old procedural DOM/SVG map or legacy marker-slot path.

### Camera / lifecycle

Preserve the current camera/runtime contracts:

- `DEFAULT_SCALE = 0.44`
- DPR clamp max 2
- Pointer Events
- `PAN_THRESHOLD = 8px`
- one-finger pan on iPhone and mouse drag on desktop
- Canvas and DOM markers share the same world/camera transform
- use requestAnimationFrame coalescing for pan updates
- do not rebuild/regenerate the world while panning
- prefecture change resets the camera
- resize re-clamps the camera
- a fresh canvas element must reinitialize its backing store even when CSS size is unchanged

### Regional identity

All 47 prefectures have deterministic regional profiles. Preserve structural variation between prefectures. Tokyo Tower is Tokyo-only; other prefectures use their own/generic regional composition.

### Lazy loading / cache coherence

Map lazy loading must have bounded retry and explicit error/retry state. Never leave production in permanent “loading” state after a failed manifest/assets promise.

Map-critical assets use the content-hash revision/stamp mechanism. If any map-critical asset changes, run:

`node scripts/stamp-asset-revision.js`

The revision must be content-derived; do not use `Date.now()`, `Math.random()`, or commit SHA as the revision source.

Map-critical assets include the production map renderer/shell/iPhone map fixes, the map CSS imported through `d-ui-mobile-company.css`, lazy prototypes, and `sprites.json`. `tests/static-asset-cache-coherence-test.js` guards mixed-generation release failures.

### Marker/detail contracts

Supported production detail flow includes:

- store -> store detail
- tenant -> tenant detail
- office -> office detail
- realestate -> property detail

Keep existing `selectedEntity` / `selectedDetail()`-based behavior as the source of truth unless a dedicated redesign intentionally changes that model.

Markers must satisfy both **anchor integrity** and **semantic building affinity**:

- final marker displacement stays within `MAX_ANCHOR_OFFSET = 56`
- marker movement paths finish through the existing anchor cap logic (`capToAnchor()` contract)
- do not lower the cap casually: iPhone chrome avoidance needs enough nudge distance to clear `.iphone-map-nav`; lowering 56 to 40 previously reintroduced the filter-tap interception regression
- choose marker candidates from the actual rendered sprite/open-space surface, not merely district zone
- `KIND_SURFACES` / `PROPERTY_KIND_SURFACES` define allowed surfaces; unlisted surfaces are forbidden
- use `SPRITE_SURFACE_OVERRIDES` for individual sprite exceptions instead of inventing a new category for one asset
- civic, landmark, signage, reserved footprints, and green open-space surfaces must not accidentally host normal property markers unless the semantic table explicitly changes

Visible marker size and hit target are separate concepts:

- pin shape is drawn on `.d-map-marker:before`
- the button itself remains unclipped (`clip-path:none`)
- critical tap target must remain at least 44px on both axes
- the current resting pin is intentionally visually small (26x32) so the city remains visible
- marker labels are hidden at rest and shown for selected / hover / keyboard-focus states; do not return to always-on placards
- accessible button naming carries category + entity name, so hiding the visible placard must not remove accessible identification

Relevant regression tests include:

- `tests/map-marker-anchor-integrity-test.js`
- `tests/map-marker-building-affinity-test.js`
- `tests/map-marker-density-selection-test.js`
- `tests/map-marker-detail-interaction-test.js`
- `tests/map-phase2-prefecture-switch-canvas-lifecycle-test.js`
- `tests/map-prefecture-identity-regional-variation-test.js`
- `tests/map-phase2-lazy-load-recovery-test.js`
- `tests/static-asset-cache-coherence-test.js`
- `tests/map-phase2-iphone-pan-webkit-test.js`

## 5. Map asset development direction

After production integration, framing, lifecycle, regional identity, lazy-load/cache coherence, marker anchoring, building affinity, and marker-density selection UX, the next visual-depth work may add **P2 environment props** such as:

- streetlights
- benches
- planting/planters
- signs
- parking/service equipment
- other small environmental scenery

P2 props are **Canvas scenery**, not DOM interaction UI. They must be deterministic, preserve culling, avoid simulation RNG, avoid rebuilding the world during pan, and not increase DOM nodes. Use the **actual current asset inventory** where appropriate, and otherwise prefer low-cost deterministic Canvas primitives. Do **not** assume dedicated prop sprites or a `propSlots` system already exist.

Before adding props, inspect the current manifest, available assets, `map-world-preview`/world-generation code, and existing taxonomy so categories are based on actual inventory rather than assumptions. If dedicated prop sprites or building-level `propSlots` become necessary, treat that as a separate future PR rather than bundling it into a Canvas micro-props pass.

Office grade/tier affinity and pinch zoom remain separate possible future PRs. Do not bundle either into a props PR unless the user explicitly changes scope.

## 6. Founding-route validation (only when that area changes)

When founding/progression work changes the two-route model, prove the affected contracts:

- existing store/operator route remains reachable through normal progression
- investment-company route can begin/continue with zero stores when intended
- company investment changes company cash/holdings/ledger only, not personal assets
- loosening investment-route gates does not unlock unrelated M&A/real-estate/governance/business systems unconditionally
- old saves without new optional route information still load safely with `saveVersion=9`
- deterministic validation does not add unnecessary RNG consumption

Do not run these route-specific checks for unrelated CSS, map-prop, CI, or documentation changes.

## 7. Known technical pitfalls

Use only the pitfalls relevant to the task.

### Determinism/tests

- A test stub like `random:()=>0.42` can collapse UUID-derived IDs into duplicates; use a deterministic sequence/LCG when distinct values are required.
- Changing competitor population can alter `tests/fixtures/transaction-baseline-v1.json` RNG call counts. If accounting/cash/transaction counts also move unexpectedly, treat that as a bug rather than blindly updating a fingerprint.
- Market calibration uses Tokyo and Osaka; changes affecting those markets can legitimately move calibration, but investigate before updating fixtures.

### Test registration / canonical shards

Canonical execution currently spans **A-H (8 shards)**. `tests/run-all-shards.json` explicitly assigns B-H; unassigned entries fall into A. When adding an expensive test, inspect current shard distribution rather than assuming one shard is permanently light/heavy.

Runner startup delay (`created_at -> started_at`) is not the same as job-step runtime for timeout analysis. Compare actual step duration before concluding a job is near timeout.

### WebKit / CI

`npx playwright install --with-deps webkit` has historically hung during browser download even when unchanged reruns later succeed. Browser-installing jobs must keep job-level timeout coverage as enforced by `tests/workflow-browser-timeout-contract.js`.

A PR can be green while push/schedule-only WebKit steps remain untested. When a workflow gates WebKit on non-PR events, inspect the main/push run before declaring that path verified.

If a workflow has `paths:` filters, editing a non-matching file will not trigger it. For a CI fix, verify the affected workflow through an event/dispatch that actually exercises the changed path.

When a workflow has been failing early for a long time, later steps may never have executed. After fixing the first failure, inspect the newly reached steps rather than assuming there is only one latent issue.

### Local branch state

Fetching does not automatically advance a stale local `main`. Base work on current `origin/main` (or fast-forward local main explicitly) before branching.

## 8. Validation guidance

Do not use a universal sequence such as “unit -> 208-week -> occurrence-rate -> mutation -> all related tests” for every change.

Choose validation by risk:

- map/UI-only: focused map/UI tests + syntax/static as applicable + browser/WebKit when interaction/lifecycle changes
- gameplay/economic/state: focused tests + save/determinism/accounting checks when affected + long-run/reachability/occurrence checks when the mechanic requires them
- CI-only: workflow contract/syntax + measured execution of the affected job/workflow
- docs-only: verify references and factual repository claims; no blanket runtime suite

The full local canonical suite is expensive; focused local tests plus GitHub canonical CI are the normal final-gate strategy unless the task specifically requires a full local run.
