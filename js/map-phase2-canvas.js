// Production Phase 2 map renderer: view-model adapter, deterministic entity
// placement, Canvas city scenery, and pointer-drag pan/camera. This is the
// sole map renderer -- PR D (see docs/map-phase2-production-integration-
// audit.md) promoted it out of the PR A-C feature-flagged experiment and
// removed the legacy DOM-scraped/procedural-city renderer it used to sit
// beside.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before map-phase2-canvas.js.');
const modules=globalThis.__capitalismTycoonModules;
if(modules.mapPhase2Canvas)throw new Error('map-phase2-canvas.js is already registered.');

/*
 * buildMapViewModel()/placeEntityTiles(): pure, read-only view-model
 * adapter and deterministic entity placement (see the audit doc, PR B).
 * Reuses prototypes/map-canvas-renderer.js (window.MapCanvas) and
 * prototypes/map-world-preview.js (window.MapWorldPreview) as-is -- see
 * the audit doc for why a 4th hash()/placement implementation must not
 * be created here. They stay lazily loaded (see ensurePrototypesLoaded
 * below), not static <script> tags in index.html: those two files live
 * under prototypes/, not js/, and tests/javascript-module-split-test.js
 * treats index.html's script tags as an exact 1:1 inventory of js/*.js.
 */

const ASSET_BASE='./assets/map-sprites/phase2';
const IMAGE_BASE='./assets/map-sprites/phase1';
const MANIFEST_URL=`${ASSET_BASE}/sprites.json`;
const PROTOTYPE_SCRIPTS=['./prototypes/map-canvas-renderer.js','./prototypes/map-prefecture-profiles.js','./prototypes/map-world-preview.js'];
const WORLD_COLS=32,WORLD_ROWS=28;
/*
 * Initial-framing pull-back (Map Framing / Zoom-out Calibration). This
 * constant is the sole projection scale for both the Canvas paint and
 * marker placement (the transform.scale that render()'s ctx.setTransform
 * and withCamera().toCss both apply uniformly) -- this pass still adds no
 * separate per-viewport or gesture-driven zoom state. Lowering it here is
 * a pure "pull the camera back" change: every other paint/placement/pan
 * code path already reads scale from the resolved transform, not this
 * constant directly, so nothing else needed to change to widen the
 * initial view. At the previous 0.72 the initial iPhone view (390x844)
 * showed roughly 1-2 of the world's 7 street-grid block-columns -- a
 * close-up of one intersection, not a city overview. 0.44 was chosen by
 * measuring the world's actual isometric content bounds (via
 * MapWorldPreview.worldTransform against WORLD_COLS/WORLD_ROWS above) at
 * the production map canvas's measured CSS width on both an iPhone 13
 * viewport (374px) and a 1280x800 desktop viewport (520px): it puts
 * roughly 3-4 block-columns in view on either, the "3-5 blocks" target,
 * while the far taller-than-wide world content (its bounding box is
 * roughly 2:1 width:height) means the shorter content height comfortably
 * fits inside the taller portrait viewport at the same scale. See
 * tests/map-phase2-framing-zoomout-test.js for the exact derivation.
 */
const DEFAULT_SCALE=0.44;
const FALLBACK_PREF_ID='tokyo';

/*
 * buildMapViewModel(): pure, read-only, deterministic. Reads
 * g.stores/g.tenants/g.rentalOffices/g.properties/g.selectedPref
 * directly -- NOT the DOM (unlike production's own mapEntities(), which
 * scrapes rendered legacy buttons for 3 of its 4 entity kinds; see the
 * audit doc's "duplication flags" section). Never mutates g/engine,
 * never calls into JavaScript's built-in random-number generator, never
 * consumes the simulation's own RNG
 * stream (the only "randomness" anywhere in this file is the pure,
 * unseeded FNV-1a hash() reused from window.MapCanvas via render()).
 */
function buildMapViewModel(g,engineInstance){
  const prefID=(g&&(g.selectedPref||g.founderHomePrefID))||null;
  const businessName=id=>engineInstance&&engineInstance.business?engineInstance.business(id)?.name:undefined;
  const byPref=list=>(Array.isArray(list)?list:[]).filter(item=>!prefID||item.prefID===prefID);
  /*
   * PR B extends each entity with a couple of legacy-shaped fields
   * (rawID/name, and a raw store/property reference where one exists) so
   * js/d-ui-shell.js's existing selectedDetail() -- built for production's
   * own DOM-scraped mapEntities() -- can render a Phase 2 marker's detail
   * card without any changes to selectedDetail() itself. The documented
   * {id,kind,sourceId,pref,label} shape from PR A is unchanged; this is
   * additive only.
   */
  const stores=byPref(g&&g.stores).map(store=>{
    const label=store.name||businessName(store.businessID)||'直営店舗';
    return {id:`store:${store.id}`,kind:'store',sourceId:store.id,pref:store.prefID,label,rawID:store.id,name:label,store};
  });
  const tenants=byPref(g&&g.tenants).map(tenant=>{
    const label=tenant.name||'出店候補';
    return {id:`tenant:${tenant.id}`,kind:'tenant',sourceId:tenant.id,pref:tenant.prefID,label,rawID:tenant.id,name:label};
  });
  const offices=byPref(g&&g.rentalOffices).map(office=>{
    const label=office.name||'オフィス候補';
    return {id:`office:${office.id}`,kind:'office',sourceId:office.id,pref:office.prefID,label,rawID:office.id,name:label};
  });
  const properties=byPref(g&&g.properties).map(property=>{
    const label=property.name||'不動産候補';
    return {id:`realestate:${property.id}`,kind:'realestate',sourceId:property.id,pref:property.prefID,label,rawID:property.id,name:label,property,propertyKind:property.kind};
  });
  return {prefID,entities:[...stores,...tenants,...offices,...properties]};
}

/*
 * PR B: deterministic tile placement for the 4 real entity kinds -- see
 * docs/map-phase2-production-integration-audit.md section 6 (PR B).
 * Building scenery and real markers are separate concepts: this never
 * changes buildWorldDistrict()'s own city fabric, it only picks which
 * already-generated zone-appropriate tile a given production entity's
 * marker sits on.
 */
const ENTITY_KIND_DISTRICTS={store:['commercial','cbd'],tenant:['commercial','cbd'],office:['cbd']};
/* g.properties' `kind` field is one of these 6 fixed Japanese labels (see
   js/engine.js's makeProperties()) -- not a fabricated attribute. */
const PROPERTY_KIND_DISTRICTS={
  '商業ビル':['commercial'],'土地':['commercial','residential','industrial'],
  '住宅':['residential'],'大型物件':['premiumResidential','commercial'],
  '物流':['industrial'],'オフィス':['cbd']
};
function districtCandidatesFor(entity){
  if(entity.kind==='realestate')return PROPERTY_KIND_DISTRICTS[entity.propertyKind]||['commercial','residential','industrial'];
  return ENTITY_KIND_DISTRICTS[entity.kind]||['commercial'];
}
/*
 * placeEntityTiles(): pure given an already-built district (buildWorldDistrict
 * output, read via the same module-level cache render() uses -- see
 * ensureDistrict below). Reuses window.MapCanvas's own FNV-1a hash() (via
 * the Base binding closed over by ensureDistrict/render) -- no new hash
 * implementation. Entities are resolved in a canonical (id-sorted) order
 * so which entity keeps a hash-preferred tile on a collision never depends
 * on the order the caller happened to pass entities in; the returned
 * array preserves the caller's original order. Never calls into JavaScript's
 * built-in random-number generator or any simulation RNG -- the only
 * "randomness" is the reused pure hash.
 * Returns null (not entities-with-null-tiles) if the district isn't built
 * yet for this prefecture (assets/prototypes still loading).
 */
function placeEntityTiles(entities,prefID){
  const Base=globalThis.MapCanvas;
  if(!Base||!assetsReady)return null;
  const district=ensureDistrict(assetsReady.index2,prefID);
  const byZone=new Map();
  for(const cell of district.tiles){
    if(!byZone.has(cell.zone))byZone.set(cell.zone,[]);
    byZone.get(cell.zone).push(cell);
  }
  const occupied=new Set();
  const placements=new Map();
  const canonicalOrder=[...entities].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  for(const entity of canonicalOrder){
    const eligible=districtCandidatesFor(entity).flatMap(zone=>byZone.get(zone)||[]);
    if(!eligible.length){placements.set(entity.id,{tileX:null,tileY:null});continue;}
    const seed=Base.hash(`${prefID}:marker:${entity.kind}:${entity.sourceId}`);
    let picked=null;
    for(let attempt=0;attempt<eligible.length;attempt++){
      const cell=eligible[(seed+attempt)%eligible.length];
      const key=`${cell.tileX},${cell.tileY}`;
      if(!occupied.has(key)){occupied.add(key);picked=cell;break;}
    }
    if(!picked)picked=eligible[seed%eligible.length];
    placements.set(entity.id,{tileX:picked.tileX,tileY:picked.tileY});
  }
  return entities.map(entity=>Object.assign({},entity,placements.get(entity.id)));
}

/*
 * layoutMarkerPlacards(): pure, deterministic screen-space decluttering for
 * production Phase 2 markers (Marker Interaction / Decluttering / Placard
 * UX pass). Called by js/d-ui-shell.js right after placeEntityTiles(), on
 * its full, UNFILTERED result -- mapFilterKind hiding some markers must
 * never reshuffle where the ones that remain visible sit.
 *
 * Runs entirely in the same camera-INDEPENDENT world-space transform
 * ensureDistrict()/render() already use for canvas painting (transform.
 * toScreen(), NOT camTransform.toCss(), which bakes in the live camera.x/y
 * pan offset) -- so the layout this produces depends only on
 * (prefID, each entity's already-assigned tileX/tileY), never on the
 * current camera position. Two markers' anchors both translate by the
 * exact same delta when the camera pans, so their RELATIVE positions --
 * and therefore every collision this resolves -- are pan-invariant by
 * construction; positionMarkers() below applies the camera translation
 * uniformly on top of these offsets every render, so panning moves every
 * placard by the same delta and never reshuffles this layout.
 *
 * Collision boxes (PLACARD_W x PLACARD_H) approximate a marker's actual
 * rendered footprint (css/d-ui-map-phase2-markers.css's glyph + the
 * always-visible label this same pass adds) at its largest breakpoint --
 * deliberately conservative, so a real render is never TIGHTER than what
 * this reserved.
 */
const PLACARD_W=108,PLACARD_H=86,PLACARD_GAP=8;
/*
 * Candidate offsets: candidate #1 is "no shift at all" (a marker with no
 * neighbours keeps today's exact on-anchor position), followed by an
 * expanding 8-compass ring search (N/NE/E/SE/S/SW/W/NW, ring 1..
 * PLACARD_RING_COUNT, each ring PLACARD_W/H+PLACARD_GAP farther out).
 * Diagonal candidates are fine here -- unlike an earlier axis-only design,
 * css/d-ui-map-phase2-markers.css's .d-map-marker-dot leader is a plain dot
 * at the true anchor (position:absolute + a translate(-ox,-oy) offset), not
 * a rotated line, so it reads correctly for ANY direction. 6 rings x 8
 * directions = 48 candidates beyond the on-anchor one: comfortably enough
 * headroom for the densest real fixture seen in local verification (17
 * markers clustered around one prefecture's landmark) to resolve without
 * falling through to the last-resort branch below.
 */
const PLACARD_RING_COUNT=6;
const PLACARD_DIRECTIONS=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
function buildPlacardCandidates(){
  const list=[{dx:0,dy:0}];
  for(let ring=1;ring<=PLACARD_RING_COUNT;ring++){
    for(const [ux,uy] of PLACARD_DIRECTIONS)list.push({dx:ux*ring*(PLACARD_W+PLACARD_GAP),dy:uy*ring*(PLACARD_H+PLACARD_GAP)});
  }
  return list;
}
const PLACARD_CANDIDATES=buildPlacardCandidates();
function placardRect(cx,cy){return {left:cx-PLACARD_W/2,top:cy-PLACARD_H/2,right:cx+PLACARD_W/2,bottom:cy+PLACARD_H/2};}
function rectsOverlap(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
function layoutMarkerPlacards(entities,prefID){
  if(!assetsReady)return null;
  ensureDistrict(assetsReady.index2,prefID);
  const transform=cachedTransform;
  const canonicalOrder=[...entities].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const claimed=[];
  const offsets=new Map();
  for(const entity of canonicalOrder){
    if(entity.tileX===null||entity.tileX===undefined||entity.tileY===null||entity.tileY===undefined){offsets.set(entity.id,{dx:0,dy:0});continue;}
    /*
     * transform.toScreen() (see prototypes/map-world-preview.js's own
     * worldTransform()) returns RAW, UNSCALED tile-space pixels -- the
     * CSS-pixel conversion positionMarkers() below relies on is what
     * multiplies by transform.scale (DEFAULT_SCALE). PLACARD_W/H are
     * CSS-pixel sizes (they must match what css/d-ui-map-phase2-markers.css
     * actually renders), so the anchor used for collision math must be
     * scaled the exact same way -- comparing CSS-pixel boxes against raw
     * unscaled coordinates silently under-detects collisions by a factor of
     * 1/DEFAULT_SCALE (~2.3x at 0.44), which is exactly the real on-device
     * bug a Chromium dry-run of this fix caught.
     */
    const [rawAx,rawAy]=transform.toScreen(entity.tileX,entity.tileY);
    const ax=rawAx*transform.scale,ay=rawAy*transform.scale;
    let chosen=null;
    for(const candidate of PLACARD_CANDIDATES){
      const rect=placardRect(ax+candidate.dx,ay+candidate.dy);
      if(!claimed.some(other=>rectsOverlap(rect,other))){chosen=candidate;claimed.push(rect);break;}
    }
    /*
     * Last resort (spec: never silently drop a marker, and this should be
     * pathologically rare given PLACARD_CANDIDATES' 49 slots): every
     * candidate collided with something already claimed. Pick whichever
     * candidate overlaps the LEAST already-claimed area rather than
     * blindly reusing candidate #1 -- two entities that both exhaust their
     * candidates must not both fall back to the exact same {dx:0,dy:0}
     * (spec: "単純に同じ位置へ重ねない"), and this stays fully deterministic
     * (canonical entity order, no randomness).
     */
    if(!chosen){
      let bestCandidate=PLACARD_CANDIDATES[0],bestOverlap=Infinity;
      for(const candidate of PLACARD_CANDIDATES){
        const rect=placardRect(ax+candidate.dx,ay+candidate.dy);
        const totalOverlap=claimed.reduce((sum,other)=>{
          const ow=Math.max(0,Math.min(rect.right,other.right)-Math.max(rect.left,other.left));
          const oh=Math.max(0,Math.min(rect.bottom,other.bottom)-Math.max(rect.top,other.top));
          return sum+ow*oh;
        },0);
        if(totalOverlap<bestOverlap){bestOverlap=totalOverlap;bestCandidate=candidate;}
      }
      chosen=bestCandidate;
      claimed.push(placardRect(ax+chosen.dx,ay+chosen.dy));
    }
    offsets.set(entity.id,chosen);
  }
  return entities.map(entity=>{
    const o=offsets.get(entity.id)||{dx:0,dy:0};
    return Object.assign({},entity,{placardOffsetX:o.dx,placardOffsetY:o.dy});
  });
}

/*
 * ---- lazy-load recovery (bounded-retry state machine) ----
 *
 * Real-device incident this fixes: a single transient failure anywhere in
 * the load chain (a lazy prototype <script> failing to load, the manifest
 * fetch failing, a bad/invalid manifest) used to be cached PERMANENTLY --
 * the old ensureAssetsLoaded() set its module-level assetsPromise once and
 * never reset it even on failure (its .catch(()=>null) just resolved to
 * null forever), and manifestPromise had the same problem via its
 * `manifestPromise||fetch(...)` guard (a REJECTED promise is still
 * truthy, so it was never retried either). assetsReady would then never
 * get set, and every subsequent render() call -- prefecture switch, tab
 * re-entry, anything -- kept hitting the same dead cached promise. The
 * map showed "出店候補を読み込み中です" (loading) forever with no way to
 * recover short of a full page reload.
 *
 * This replaces that with a small idle/loading/ready/error state machine:
 * a failed attempt is retried a bounded number of times (a one-shot
 * setTimeout per retry -- never setInterval or unbounded polling), and
 * once retries are exhausted the map surfaces an explicit error with a
 * real retry control (js/d-ui-shell.js reads getLoadState()) instead of
 * silently hanging. Each failure is tagged with which stage produced it
 * (prototype script load, manifest fetch, manifest validation) so a real
 * cause is never swallowed -- see loadErrorDetail below.
 */
const PROTOTYPE_GLOBALS=['MapCanvas','MapPrefectureProfiles','MapWorldPreview'];
function loadScriptOnce(src){
  return new Promise((resolve,reject)=>{
    const el=document.createElement('script');
    el.src=src;el.onload=()=>resolve();el.onerror=()=>reject(new Error(`map-phase2-canvas: failed to load ${src}`));
    document.head.appendChild(el);
  });
}
/*
 * Idempotent under a partial-success retry: only whichever of the 3 lazy
 * scripts hasn't already set its own global gets (re)loaded -- if script 3
 * failed after 1 and 2 already succeeded, a retry never re-fetches/
 * re-executes the two that are already present. Dependency order (1, then
 * 2, then 3) is still preserved via the sequential .then chain even when
 * only a subset is missing, since PROTOTYPE_SCRIPTS/PROTOTYPE_GLOBALS stay
 * index-aligned and whichever prefix already succeeded is always
 * contiguous (script N+1 can never load before script N does).
 */
function ensurePrototypesLoaded(){
  if(PROTOTYPE_GLOBALS.every(name=>globalThis[name]))return Promise.resolve();
  if(typeof document==='undefined'){const e=new Error('map-phase2-canvas: document unavailable');e.stage='prototype';return Promise.reject(e);}
  let chain=Promise.resolve();
  PROTOTYPE_SCRIPTS.forEach((src,i)=>{
    const globalName=PROTOTYPE_GLOBALS[i];
    chain=chain.then(()=>{
      if(globalThis[globalName])return;
      return loadScriptOnce(src).catch(error=>{error.stage='prototype';throw error;});
    });
  });
  return chain;
}

/* ---- sprite manifest + image cache ---- */
let assetsReady=null;
/*
 * A single, un-cached attempt -- no module-level promise memoization here
 * any more (that was the permanent-failure trap). attemptLoad() below owns
 * all retry/caching policy; this function just tries once and rejects with
 * a stage-tagged error on any failure so the caller can tell prototype
 * script / manifest fetch / manifest validation failures apart.
 */
function ensureAssetsLoaded(){
  const MW=globalThis.MapWorldPreview;
  if(!MW){const e=new Error('map-phase2-canvas: MapWorldPreview unavailable');e.stage='prototype';return Promise.reject(e);}
  return fetch(MANIFEST_URL)
    .catch(error=>{error.stage='manifest-fetch';throw error;})
    .then(res=>{
      if(!res.ok){const e=new Error(`map-phase2-canvas: manifest HTTP ${res.status}`);e.stage='manifest-fetch';throw e;}
      return res.json().catch(error=>{error.stage='manifest-fetch';throw error;});
    })
    .then(manifest=>{
      const index2=MW.indexCategoryManifest(manifest);
      if(!index2.ok){const e=new Error(`map-phase2-canvas: manifest validation failed (${index2.errors.slice(0,3).join('; ')})`);e.stage='manifest-validation';throw e;}
      const legacyIndex=Object.assign({},index2,{sprites:index2.sprites.filter(s=>s.placeholder)});
      const newIndex=Object.assign({},index2,{sprites:index2.sprites.filter(s=>!s.placeholder)});
      return Promise.all([MW.loadSprites(legacyIndex,IMAGE_BASE),MW.loadSprites(newIndex,ASSET_BASE)])
        .then(([legacyResult,newResult])=>({index2,images:Object.assign({},legacyResult.images,newResult.images)}));
    });
}

/*
 * idle -> loading -> ready, or idle -> loading -> (retry) -> ... -> error.
 * loadErrorDetail is diagnostics only (stage + message, logged to console
 * for developers) -- js/d-ui-shell.js never shows it verbatim to the user,
 * only a generic "読み込みに失敗しました" + retry button (see getLoadState()).
 */
let loadState='idle';
let loadAttempts=0;
let loadErrorDetail=null;
const MAX_LOAD_ATTEMPTS=3;
const LOAD_RETRY_DELAYS_MS=[500,1500];
function notifyMapReady(){
  modules.dUIShell?.enhance?.(true);
  modules.uiEnhancerRegistry?.runUIEnhancers?.();
}
function attemptLoad(){
  loadState='loading';
  ensurePrototypesLoaded()
    .then(ensureAssetsLoaded)
    .then(result=>{
      assetsReady=result;
      loadState='ready';
      loadErrorDetail=null;
      notifyMapReady();
    })
    .catch(error=>{
      loadAttempts++;
      loadErrorDetail={stage:error?.stage||'unknown',message:(error&&error.message)||String(error)};
      if(typeof console!=='undefined'&&console.error)console.error('map-phase2-canvas: load attempt failed',loadErrorDetail);
      if(loadAttempts<MAX_LOAD_ATTEMPTS){
        const delay=LOAD_RETRY_DELAYS_MS[loadAttempts-1]??LOAD_RETRY_DELAYS_MS[LOAD_RETRY_DELAYS_MS.length-1];
        globalThis.setTimeout(attemptLoad,delay);
      }else{
        loadState='error';
        notifyMapReady();
      }
    });
}
/* Called from render() below every time assetsReady is still falsy --
   only actually starts (or restarts) a load while idle, so this never
   spawns concurrent load chains or duplicate network activity during an
   in-progress attempt or its bounded retry backoff. */
function ensureMapReady(){
  if(loadState==='idle'){loadAttempts=0;attemptLoad();}
}
/* User-triggered retry after retries were exhausted (js/d-ui-shell.js's
   "再試行" button) -- a no-op while already loading. */
function retryMapLoad(){
  if(loadState==='loading')return;
  loadAttempts=0;loadErrorDetail=null;attemptLoad();
}
function getLoadState(){return {state:loadState,error:loadErrorDetail};}

/* ---- district cache: rebuilt only when the resolved prefecture changes ---- */
let cachedDistrict=null,cachedPrefID=null,cachedTransform=null;
let lastCanvasEl=null,lastCssW=null,lastCssH=null,lastDpr=null;
function ensureDistrict(index2,prefID){
  const MW=globalThis.MapWorldPreview;
  if(cachedDistrict&&cachedPrefID===prefID)return cachedDistrict;
  const district=MW.buildWorldDistrict({index2,prefID,cols:WORLD_COLS,rows:WORLD_ROWS});
  const wt=MW.worldTransform(district,index2.tile,DEFAULT_SCALE);
  cachedDistrict=district;cachedPrefID=prefID;cachedTransform=wt.transform;
  return district;
}

function initialCamera(district,transform,rawW,rawH){
  const MW=globalThis.MapWorldPreview;
  const landmark=district.tiles.find(cell=>cell.zone==='landmark');
  if(!landmark)return {x:0,y:0};
  const [lx,ly]=transform.toScreen(landmark.tileX,landmark.tileY);
  return MW.clampCameraToContent({x:lx-rawW/2,y:ly-rawH/2},transform,district,rawW,rawH);
}

/*
 * PR C: camera is the single, persistent {x,y} source of truth for both
 * the Canvas paint and marker positioning (see docs/map-phase2-
 * production-integration-audit.md section 6, PR C) -- there must never be
 * a separate Canvas camera, marker camera, and CSS-zoom camera. PR A/B's
 * render() recomputed a fresh landmark-centred camera on every single
 * call, which silently undid any pan the instant anything else (a
 * selection, a filter click) re-ran the enhancer; this module-level
 * variable is what a pointer drag actually mutates, and render() now only
 * (re)initialises it when the resolved prefecture changes (STEP 13:
 * switching prefectures resets to a fresh, landmark-centred camera --
 * the old position has no meaning in a different world) or on first
 * paint. On every other call it is preserved and merely re-clamped
 * (worldWidth/worldHeight/contentBounds do not change unless the world
 * itself was rebuilt, but the viewport might have -- e.g. window resize).
 */
let camera=null,cameraPrefID=null;
function resolveCamera(district,transform,prefID,rawW,rawH){
  const MW=globalThis.MapWorldPreview;
  if(!camera||cameraPrefID!==prefID){
    camera=initialCamera(district,transform,rawW,rawH);
    cameraPrefID=prefID;
  }else{
    camera=MW.clampCameraToContent(camera,transform,district,rawW,rawH);
  }
  return camera;
}

/*
 * PR C: pointer-drag pan, ported from the already-working design in
 * map-phase2-preview.html (pointer capture withheld until the tap/pan
 * threshold is crossed, so a plain marker tap is never affected by it;
 * justPanned briefly suppresses the synthetic click a drag-ending
 * pointerup produces, so ending a pan on top of a marker never selects
 * it). Delegated on document (installed once, at load time, like
 * js/d-ui-shell.js's own click/keydown listeners) rather than re-attached
 * to the <canvas> element every render -- renderMapWorkspace() rebuilds
 * that element's innerHTML (and therefore the canvas itself) on every
 * enhancer pass, so a per-element listener would need re-attaching each
 * time anyway. Pointer Events are the sole gesture path (pointerdown/
 * move/up/cancel, setPointerCapture) -- WebKit on iPhone has supported
 * Pointer Events since Safari 13, and using only one event family avoids
 * the double-firing risk of running both Pointer and Touch listeners on
 * the same gesture.
 */
const PAN_THRESHOLD=8;
let dragState=null,justPanned=false,lastG=null,pendingFrame=false;
function consumeJustPanned(){
  if(!justPanned)return false;
  justPanned=false;
  return true;
}
function schedulePanRedraw(canvas){
  if(pendingFrame)return;
  pendingFrame=true;
  globalThis.requestAnimationFrame(()=>{pendingFrame=false;render(canvas,lastG);});
}
function onPointerDown(event){
  if(dragState)return;
  /*
   * Gate on the shared .d-city-surface-phase2 container, not the canvas
   * element alone -- Phase 2 markers are DOM siblings of the canvas (both
   * direct children of .d-city-surface), not descendants of it, so a drag
   * that starts on top of a marker button must still be able to pan (see
   * map-phase2-preview.html's reference stage-level listener, which covers
   * both canvas and marker overlay the same way). Tap-vs-pan disambiguation
   * is handled entirely by PAN_THRESHOLD + deferred pointer capture below,
   * never by excluding certain start targets.
   */
  const container=event.target?.closest?.('.d-city-surface-phase2');
  const canvas=container?.querySelector?.('.d-phase2-canvas');
  if(!canvas||!camera)return;
  dragState={pointerId:event.pointerId,canvas,startX:event.clientX,startY:event.clientY,camStart:{x:camera.x,y:camera.y},dragging:false};
}
function onPointerMove(event){
  if(!dragState||event.pointerId!==dragState.pointerId)return;
  const dx=event.clientX-dragState.startX,dy=event.clientY-dragState.startY;
  if(!dragState.dragging){
    if(Math.hypot(dx,dy)<PAN_THRESHOLD)return;
    dragState.dragging=true;
    try{dragState.canvas.setPointerCapture(dragState.pointerId);}catch(e){}
  }
  const transform=cachedTransform;if(!transform)return;
  camera={x:dragState.camStart.x-dx/transform.scale,y:dragState.camStart.y-dy/transform.scale};
  schedulePanRedraw(dragState.canvas);
}
function endDrag(event){
  if(!dragState||(event&&event.pointerId!==undefined&&event.pointerId!==dragState.pointerId))return;
  if(dragState.dragging){
    justPanned=true;
    globalThis.setTimeout(()=>{justPanned=false;},50);
    try{dragState.canvas.releasePointerCapture(dragState.pointerId);}catch(e){}
  }
  dragState=null;
}
function installPanHandlers(){
  if(typeof document==='undefined'||typeof document.addEventListener!=='function')return;
  document.addEventListener('pointerdown',onPointerDown,true);
  document.addEventListener('pointermove',onPointerMove,true);
  document.addEventListener('pointerup',endDrag,true);
  document.addEventListener('pointercancel',endDrag,true);
  /* pointerleave never bubbles, but a capture-phase document listener
     still sees it on the way down to whatever element the pointer left --
     this only matters pre-threshold (a pointerdown with no following
     move before the pointer truly leaves the map surface), so a genuine
     drag that has already captured the pointer is never affected by it.
     Since a drag can legitimately start on top of a small marker button
     (STEP 7), the pointer crossing that button's own edge onto a sibling
     element (its icon span, the canvas, another part of the surface) must
     NOT cancel the pending drag -- only relatedTarget landing outside the
     whole .d-city-surface-phase2 container means the pointer actually left
     the interactive map area. */
  document.addEventListener('pointerleave',event=>{
    if(!dragState||dragState.dragging||event.pointerId!==dragState.pointerId)return;
    const stillInside=event.relatedTarget&&event.relatedTarget.closest?.('.d-city-surface-phase2');
    if(!stillInside)dragState=null;
  },true);
  /*
   * A resize (desktop window resize, or an iPhone orientation change) must
   * re-clamp the camera against the new viewport and reposition markers,
   * but must never rebuild the district or re-place entities -- render()
   * already guarantees that (ensureDistrict()'s cache only keys off
   * prefID, and placeEntityTiles() is never called from here at all).
   */
  if(typeof globalThis.addEventListener==='function'){
    globalThis.addEventListener('resize',()=>{
      const canvas=document.querySelector('.d-phase2-canvas');
      if(canvas&&lastG)render(canvas,lastG);
    },{passive:true});
  }
}

/*
 * PR B: positions the Phase 2 marker DOM (built by js/d-ui-shell.js with
 * data-phase2-tile-x/y attributes, no position yet) using the exact same
 * camTransform this render() call just used to paint the canvas -- a
 * single shared worldToScreen for both, per the audit's PR B design.
 * Markers stay real DOM <button> overlay elements (not drawn onto the
 * canvas) for accessibility/hit-target/tooltip reasons -- this only ever
 * sets their existing --x/--y custom properties (already consumed as
 * plain left/top by css/d-ui.css's .d-map-marker rule for the legacy
 * percentage-based layout; a pixel value works identically). Also applies
 * Requirement E's viewport clamp ("画面端ではviewport内へclamp") -- see the
 * detailed comments inside positionMarkers() below for the clamp itself,
 * why it only applies to on-screen anchors, and the cross-marker nudge
 * that keeps several independently-clamped markers from collapsing onto
 * the same boundary value. --ox/--oy record the ACTUAL applied placard
 * offset (post-clamp/nudge), not the raw data-phase2-offset-x/y request,
 * so .d-map-marker-dot (css/d-ui-map-phase2-markers.css) -- positioned as
 * a child of the marker via translate(calc(-1*var(--ox)),calc(-1*var(--oy)))
 * -- always lands back on the true tile anchor.
 */
/*
 * Clamp margin: HALF of the marker's own smallest rendered footprint
 * (css/d-ui-map-phase2-markers.css's <=520px breakpoint, 44x54 -- the iOS
 * minimum tap target), not the full PLACARD_W/H collision box. The clamp's
 * job is only to keep the tappable glyph on-screen; the wider label
 * trailing off past the edge is a minor, acceptable cosmetic clip (
 * .d-map-stage already has overflow:hidden), and using the much bigger
 * placard box here would pull far more aggressively -- exactly what let
 * unrelated markers' clamped positions collide with each other in the
 * first Chromium dry-run of this fix.
 */
const MARKER_CLAMP_HALF_W=22,MARKER_CLAMP_HALF_H=27;
/*
 * Deterministic nudge offsets tried, in order, when the naturally-clamped
 * position collides with an already-positioned marker (see the "cross-
 * marker clamp collision" comment below) -- alternating +/-, growing by one
 * button-height (2*MARKER_CLAMP_HALF_H+4px gap) each step. Bounded
 * (CLAMP_NUDGE_STEP_COUNT steps each direction): if every one still
 * collides, the last one is accepted anyway --
 * this only runs for markers that ALREADY needed clamping (rare), so a
 * residual overlap here is the same kind of "unavoidable extreme density"
 * last resort layoutMarkerPlacards() itself allows, never an infinite
 * search or a dropped marker.
 */
const CLAMP_NUDGE_STEP=MARKER_CLAMP_HALF_H*2+4;
const CLAMP_NUDGE_STEP_COUNT=14;
function buildClampNudgeOffsets(){
  const list=[0];
  for(let n=1;n<=CLAMP_NUDGE_STEP_COUNT;n++)list.push(n*CLAMP_NUDGE_STEP,-n*CLAMP_NUDGE_STEP);
  return list;
}
const CLAMP_NUDGE_OFFSETS=buildClampNudgeOffsets();
/*
 * Exclusion zones for the real, always-must-stay-tappable iPhone chrome
 * controls js/iphone-playtest-fixes.js's ensureMapChrome() renders as
 * LATER SIBLINGS of .d-city-surface-phase2 inside .d-map-stage --
 * .iphone-map-nav (prefecture select + view toggle), .iphone-map-tools
 * (filter/legend toggles), .iphone-map-popover (their opened panel).
 * Raising .d-map-marker's z-index above this chrome (the root-cause tap
 * fix -- see css/d-ui-map-phase2-markers.css) means a marker that happens
 * to render ON TOP of one of these controls now blocks ITS tap instead --
 * confirmed by a real post-merge WebKit CI failure
 * (tests/iphone-playtest-webkit-test.js timed out clicking the filter
 * button: "span ... from .d-city-surface-phase2 subtree intercepts
 * pointer events"). Measured live from the DOM every render (not
 * hardcoded pixel guesses, which would drift the moment this chrome's own
 * CSS changes) and converted into the same canvas-relative coordinate
 * space positionMarkers() already uses -- .d-phase2-canvas is inset:0
 * within .d-city-surface, itself inset:0 within .d-map-stage, so the
 * canvas's own getBoundingClientRect() is a safe, always-available common
 * origin for both.
 */
function chromeExclusionRects(canvas){
  const stage=typeof canvas.closest==='function'?canvas.closest('.d-map-stage'):null;
  if(!stage||typeof canvas.getBoundingClientRect!=='function')return [];
  const origin=canvas.getBoundingClientRect();
  const rects=[];
  for(const selector of ['.iphone-map-nav','.iphone-map-tools','.iphone-map-popover']){
    const el=stage.querySelector?.(selector);
    if(!el||el.hidden||typeof el.getBoundingClientRect!=='function')continue;
    const r=el.getBoundingClientRect();
    if(!(r.width>0)||!(r.height>0))continue;
    rects.push({left:r.left-origin.left,top:r.top-origin.top,right:r.right-origin.left,bottom:r.bottom-origin.top});
  }
  return rects;
}
function positionMarkers(canvas,camTransform,cssW,cssH){
  const container=canvas.parentElement;if(!container)return;
  const halfW=MARKER_CLAMP_HALF_W,halfH=MARKER_CLAMP_HALF_H;
  const clamp=(value,min,max)=>Math.min(Math.max(value,min),max);
  const clampX=x=>Number.isFinite(cssW)?clamp(x,halfW,Math.max(halfW,cssW-halfW)):x;
  const clampY=y=>Number.isFinite(cssH)?clamp(y,halfH,Math.max(halfH,cssH-halfH)):y;
  /*
   * Requirement E ("画面端ではviewport内へclamp") only applies to a marker
   * whose own BUILDING is actually visible -- clamping is meant to keep a
   * near-edge placard from being cut off, not to relocate an entity whose
   * tile is nowhere near the current camera view. layoutMarkerPlacards()'s
   * collision search deliberately has no idea what the live viewport looks
   * like (that is what keeps it pan-stable), so its offsets can legitimately
   * point an off-screen marker's placard even farther off-screen -- clamping
   * THAT back into view would drag unrelated off-screen entities into the
   * same visible corner and manufacture brand-new collisions between
   * markers that were never near each other, which is the exact real-device
   * regression a Chromium dry-run of this fix caught. An anchor within one
   * placard-width/height of the canvas box (not just strictly inside it) is
   * treated as "visible enough to matter" so a placard whose OWN anchor is
   * just past the edge still gets nudged fully into view.
   */
  const anchorVisible=(ax,ay)=>Number.isFinite(cssW)&&Number.isFinite(cssH)
    &&ax>=-PLACARD_W&&ax<=cssW+PLACARD_W&&ay>=-PLACARD_H&&ay<=cssH+PLACARD_H;
  const markerRect=(cx,cy)=>({left:cx-halfW,top:cy-halfH,right:cx+halfW,bottom:cy+halfH});
  /*
   * claimed starts pre-seeded with the live iPhone-chrome exclusion
   * rects (see chromeExclusionRects() above) so the SAME nudge search
   * that resolves marker-vs-marker collisions also treats those controls
   * as occupied space no marker may render on top of. Every on-screen
   * marker (not just ones that needed viewport-edge clamping) is checked
   * against `claimed`: a marker whose natural (or edge-clamped) position
   * doesn't collide with anything is placed immediately and its own rect
   * joins `claimed`, so later markers route around it too. This pass is
   * deliberately render-time/viewport-dependent (unlike layoutMarker
   * Placards()'s own pan-invariant world-space search) -- the chrome
   * controls sit at fixed pixel offsets from the viewport edges, not tied
   * to camera position, so this never destabilizes pan (see the
   * dedicated pan-stability test), and it is recomputed fresh every
   * render, never cached.
   */
  const claimed=chromeExclusionRects(canvas);
  const onScreen=[];
  for(const marker of container.querySelectorAll('[data-d-ui-marker][data-phase2-tile-x]')){
    const tileX=Number(marker.dataset.phase2TileX),tileY=Number(marker.dataset.phase2TileY);
    if(!Number.isFinite(tileX)||!Number.isFinite(tileY))continue;
    const [ax,ay]=camTransform.toCss(tileX,tileY);
    const dx=Number(marker.dataset.phase2OffsetX)||0,dy=Number(marker.dataset.phase2OffsetY)||0;
    const naturalX=ax+dx,naturalY=ay+dy;
    if(!anchorVisible(ax,ay)){
      /* Genuinely off-screen: leave layoutMarkerPlacards()'s own offset
         untouched and skip the collision search entirely -- it is
         invisible either way ( .d-city-surface clips it), and nudging it
         would only cost cycles without ever being seen. */
      marker.style.setProperty('--x',`${naturalX}px`);marker.style.setProperty('--y',`${naturalY}px`);
      marker.style.setProperty('--ox',`${naturalX-ax}px`);marker.style.setProperty('--oy',`${naturalY-ay}px`);
      continue;
    }
    onScreen.push({marker,ax,ay,baseX:clampX(naturalX),baseY:clampY(naturalY)});
  }
  for(const {marker,ax,ay,baseX,baseY} of onScreen){
    let chosenY=baseY,resolvedRect=markerRect(baseX,baseY);
    if(claimed.some(other=>rectsOverlap(resolvedRect,other))){
      /*
       * Nudge candidates start from the already-clamped baseY, not a raw
       * unclamped value -- an unbounded offset from a narrow-canvas
       * ring-search result would just clamp back to the same boundary
       * every time if the nudge started from there instead.
       */
      let found=false;
      for(const offset of CLAMP_NUDGE_OFFSETS){
        if(offset===0)continue;
        const tryY=clampY(baseY+offset);
        const rect=markerRect(baseX,tryY);
        if(!claimed.some(other=>rectsOverlap(rect,other))){chosenY=tryY;resolvedRect=rect;found=true;break;}
      }
      if(!found)resolvedRect=markerRect(baseX,chosenY);
    }
    claimed.push(resolvedRect);
    const x=baseX,y=chosenY;
    marker.style.setProperty('--x',`${x}px`);marker.style.setProperty('--y',`${y}px`);
    marker.style.setProperty('--ox',`${x-ax}px`);marker.style.setProperty('--oy',`${y-ay}px`);
  }
}

/*
 * render(): synchronous, called from js/d-ui-shell.js's renderMapWorkspace()
 * every render, once per call with a fresh <canvas> element
 * (renderMapWorkspace rebuilds .d-city-surface's innerHTML wholesale every
 * time it runs -- there is nothing new to persist across renders other
 * than the caches above). If the prototype renderer files or sprite
 * assets are not loaded yet, paints a neutral placeholder fill and asks
 * the bounded-retry state machine above to (re)start loading if it isn't
 * already; notifyMapReady() (called from attemptLoad() on success or on
 * final failure, not on every render) is what forces the existing D UI
 * shell enhancer to re-run so the city -- or the error/retry UI -- appears.
 * This never touches simulation state, only asks the UI to redraw.
 */
function render(canvas,g){
  if(!canvas)return;
  lastG=g;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const rect=canvas.getBoundingClientRect();
  const cssW=Math.max(1,Math.round(rect.width)),cssH=Math.max(1,Math.round(rect.height));
  const Base=globalThis.MapCanvas,MW=globalThis.MapWorldPreview;

  if(!Base||!MW||!assetsReady){
    if(Base){Base.sizeCanvas(canvas,cssW,cssH,globalThis.devicePixelRatio);}
    else{canvas.width=cssW;canvas.height=cssH;canvas.style.width=`${cssW}px`;canvas.style.height=`${cssH}px`;}
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#bfd0da';ctx.fillRect(0,0,cssW,cssH);
    ensureMapReady();
    return;
  }

  /*
   * Skip the (unconditional, per Base.sizeCanvas) canvas.width/height
   * reassignment when this is the SAME canvas element as last time AND its
   * CSS size hasn't actually changed -- pan/select/filter redraws happen
   * far more often than real resizes, and reassigning canvas.width to its
   * own value still resets the backing store per the HTML5 canvas spec.
   *
   * The canvas-identity half of that check is load-bearing, not defensive:
   * js/d-ui-shell.js's renderMapWorkspace() rebuilds .d-city-surface's
   * innerHTML wholesale on every render (prefecture switch included), so a
   * BRAND NEW <canvas> element replaces the old one. css/d-ui-map-phase2-
   * canvas.css's .d-phase2-canvas{width:100%;height:100%} still gives that
   * fresh element the right CSS layout box, so cssW/cssH above read
   * correctly -- but a fresh <canvas> element's own backing store
   * (canvas.width/height, the bitmap Base.sizeCanvas sets) starts at the
   * HTML default of 300x150 regardless of its CSS size. Comparing only
   * cssW/cssH against the previous canvas's last-known size let a
   * same-size prefecture switch skip sizeCanvas() on the new element
   * entirely, leaving its bitmap at 300x150 while every paint call below
   * still assumed the real (much larger) cssW/cssH -- a small stretched
   * fragment of the scenery, or just the background fill color, is what
   * that produces once the browser scales that tiny bitmap up to the
   * element's real CSS box. See tests/map-phase2-prefecture-switch-canvas-
   * lifecycle-test.js.
   */
  const sameCanvas=canvas===lastCanvasEl;
  const dpr=(sameCanvas&&cssW===lastCssW&&cssH===lastCssH&&lastDpr)?lastDpr:Base.sizeCanvas(canvas,cssW,cssH,globalThis.devicePixelRatio);
  lastCanvasEl=canvas;lastCssW=cssW;lastCssH=cssH;lastDpr=dpr;
  const {index2,images}=assetsReady;
  const prefID=(g&&(g.selectedPref||g.founderHomePrefID))||FALLBACK_PREF_ID;
  const district=ensureDistrict(index2,prefID);
  const transform=cachedTransform;
  const rawW=cssW/transform.scale,rawH=cssH/transform.scale;
  const camera=resolveCamera(district,transform,prefID,rawW,rawH);
  const camTransform=MW.withCamera(transform,camera);
  const visible=MW.cullVisible(district,transform,camera,rawW,rawH,300);
  const viewDistrict={prefID:district.prefID,tiles:visible,byKey:district.byKey,cols:district.cols,rowsCount:district.rowsCount};

  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);ctx.fillStyle='#bfd0da';ctx.fillRect(0,0,cssW,cssH);
  ctx.setTransform(dpr*transform.scale,0,0,dpr*transform.scale,0,0);
  MW.paintTerrain(ctx,viewDistrict,camTransform,index2.tile);
  MW.paintSidewalkWidening(ctx,visible,camTransform,index2.tile,district.byKey);
  MW.paintWorldRoads(ctx,visible,camTransform,index2.tile,district.byKey);
  MW.paintCrosswalks(ctx,visible,camTransform,index2.tile);
  MW.paintOpenLots(ctx,visible,camTransform,index2.tile,district.prefID);
  MW.paintGreenery(ctx,viewDistrict,camTransform);
  MW.blitWorldSprites(ctx,viewDistrict,camTransform,images,index2,{placeholderLabels:false,spriteWidthFactor:1.18});
  ctx.setTransform(1,0,0,1,0,0);
  positionMarkers(canvas,camTransform,cssW,cssH);
}

installPanHandlers();

modules.mapPhase2Canvas=Object.freeze({
  buildMapViewModel,placeEntityTiles,layoutMarkerPlacards,render,consumeJustPanned,
  getLoadState,retryMapLoad,
  __installed:true
});
})();
