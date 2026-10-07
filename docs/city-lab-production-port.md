# City Lab production UI migration

The user requested the City Lab prototype's map and management presentation in the real game. This is an authorized rendering migration from Phase 2 Canvas2D to local Three.js by default; Phase 2 remains the capability and recovery fallback. Economic behavior stays in the production game.

## Sources and boundaries

- Visual/geometry reference: the original City Lab prototype, revision `d9d2974c4b9f50277f03a5c064c07fc755a0ad7e` (`src/city.html`, `src/management.html`).
- Initial production base: `1a14987e14b10b0cf9d5da2f3a75e002b7b5a43d`. Rebased and validated on `2495f4e310f024eafe249a15fa0bf67bcc302679`, including the current standalone accounting changes.
- PR #889 is separate navigation work on the same base. This change preserves the existing D UI navigation/action dispatcher rather than introducing a competing shell or modifying that PR's active head. Shared cache stamps/importer changes may need restamping after either merge.
- No prototype demo balances, `mstate`, fabricated companies, cloud save, weekly settlement, development timers or purchase writers are copied.
- No changes to the economic engine, settlement/ledger writers, save key/version or `css/app.css`.

## Production connections

| Screen / interaction | Production source / action |
| --- | --- |
| 3D markers and buildings | `mapPhase2Canvas.buildMapViewModel(g, engine)`; all five canonical kinds, raw IDs and raw state references |
| Regional scenery | All 47 explicit `MapPrefectureProfiles` profiles, existing `MapCanvas.hash`; no simulation RNG |
| Company cash and week | `g.companyCash`, `g.week`, production `compactYen` |
| Bottom Sheet | Existing `dUIShell.selectedDetail`; existing store context tabs |
| Available tenant | Existing `open-store` dispatcher and store-opening estimate/confirmation |
| Office | Existing `contract-office` action |
| Property | Existing company/personal purchase actions with the same property ID and ownership gating |
| Week advance | Existing `advance-week`, production weekly summary and canonical save |
| Region selection | Existing `data-bind="selectedPref"` handler |
| Management screens | Existing 19 screen templates and domain enhancers; City Lab header/back action/capital summary and semantic styling |
| Company/personal loan | Existing iPhone money form and `engine.borrow` paths |
| Save / restart | Existing production save v9, localStorage/IDB recovery and setup/settings UI |

Three.js r160 is included locally under `assets/vendor/`, with its MIT license. It is loaded lazily with the existing map hash/profile libraries. The module is wired in both `index.html` and the module-order fixture. All new map assets/styles share the content-derived asset revision.

## Camera and lifecycle

The City Lab facade, road, balcony, canopy and tree geometry is batched with `InstancedMesh`. Real entities own their semantic buildings; anonymous background buildings are scenery and cannot be selected. A deterministic 56-building visual cap does not remove source entities or any production directory actions. Locations are stylized city lots, not real geocoded addresses.

- Shared orthographic camera projects meshes and DOM labels.
- Two-axis pointer drag begins after 8px; focal pinch is bounded to 0.58–2.6, initial/fit zoom 0.82; DPR is at most 1.65.
- Filtering/selection changes keep camera and geometry. Prefecture changes reset framing; world regeneration is never on the pointer-move path.
- Label hit targets are at least 44px. Labels are hidden outside view and behind HUD/control/Sheet rectangles. The visible selected ID determines the actual detail and actions.
- Bottom Sheet scrolls independently, expands by handle/tap/swipe, closes explicitly or with Escape, and supports focusing the selected building.
- Full management forms remain native scrolling and use 16px inputs. Company and personal balances have distinct labels. The news enhancer and store cockpit preserve the City Lab header placement.
- Camera/selection/filter state lives in presentation only. The module registers no startup MutationObserver or external enhancer. Its map-scoped ResizeObserver and pointer/wheel handlers are disconnected on exit/replacement, and WebGL resources are disposed.
- Asset timeout/load failure, unsupported WebGL and context loss lead to the existing Canvas2D map and a real 3D retry. The fallback retains its own historical framing, sprites, placards and native vertical page-scroll contracts.

## Validation

- Canonical VM test covers 47 profiles and 801 real initial-state entities, stable locations under source reordering, semantic geometry, occupied-tenant suppression, visual-cap overflow, state/RNG immutability and the absence of demo save/economic APIs.
- Actual WebKit acceptance exercises all 19 production screens at 390×844 and 430×932, navigation, page overflow, store operations and weekly/save behavior.
- Dedicated City Lab WebKit gate covers portrait, small portrait and landscape, real marker taps, drag, Pointer Event pinch, prefecture changes, map exit/re-entry, company loan separation, canonical week/save/reload and genuine WebGL capability fallback, actual retry back to 3D and context-loss recovery. It is registered in the required iPhone Acceptance CI job; the VM test is registered in canonical run-all and shard C.
- Existing D UI desktop/iPhone smoke is preserved with deliberate marker/hidden-Sheet contract updates for the new map. Published map checks exercise actual 3D draw calls/geometry and canvas screenshot variance, while retaining the strict Canvas2D paint check for fallback.
- Existing save, transaction, startup-budget, map/detail/placement, module-order, frozen-CSS and asset-coherence checks remain required.

Physical iPhone handling/performance and its real keyboard are not claimed from WebKit emulation. Prototype visuals are reused on the full production controls: extra real game fields and unlock gates are retained instead of replacing them with the prototype's simplified demo forms.

## CI follow-up

The first PR CI found two presentation integration gaps. Canonical WebKit week-advance locators now target `.d-topbar`, because the City Lab work header adds a second equivalent control. This changes the interaction target only; weekly state, accounting, saved results and button-size assertions remain intact. The CEO navigation test also waits for the existing `requestAnimationFrame` focus handoff before asserting the exact PMI support target; it does not accept unfocused navigation.

The writer inventory's lexical candidate list adds `js/city-lab-map.js` for company cash and `js/d-ui-shell.js` for personal cash, both used only to display balances. The exact-authority mutation inventory is unchanged. No discovery rule, hash check or negative omission test is relaxed.

The two-store native opening test additionally found that industry selection re-rendered the map and closed the source directory. The City Lab wrapper now uses the existing shell's presentation-only directory-open state, preserving the form through changes and sharing it with Canvas2D fallback. The test selects the canonical directory control, verifies that industry selection keeps it open, then opens both real stores and advances a week.

Final review follow-up: the City Lab failure/context-loss callback now runs the shared UI enhancer pipeline after installing Canvas2D. This restores the iPhone prefecture/list switch and filter/legend controls immediately, including when Phase 2 assets are already cached and no load-complete refresh follows. The WebKit recovery test requires exactly one navigation bar and tool bar after this cached fallback. No additional enhancer or observer is registered.

## Owner iPhone readability follow-up

The owner's Safari screenshots showed duplicated capital/week headers, a wrapping capital summary, a dark market-sector track with low-contrast text, and a violet active dock inherited from legacy mobile rules. On mobile, the global KPI strip is now replaced by the explicitly labelled company/profit/personal summary in one compact row. The global topbar retains real week controls; the management work header retains its title and map-back action. Desktop retains the full KPI strip. Market sector filters and the five-tab mobile dock use City Lab paper/teal with sufficiently specific overrides, and map HUD cards are more compact without shrinking controls below 44px.

The existing D UI WebKit gate checks the actual computed active dock and sector colours, the compact summary and the absence of duplicate mobile KPI/week controls; its startup wait uses the real visible global week button. Desktop's five-KPI contract and existing navigation/financial interaction checks remain intact. No economic writer, save migration, simulation RNG or enhancer registration changes are involved.
