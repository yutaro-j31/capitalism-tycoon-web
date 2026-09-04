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

/* ---- lazy-load the two prototype renderer files (only once, only when
   render() is actually first called with the flag on) ---- */
let prototypesPromise=null;
function ensurePrototypesLoaded(){
  if(globalThis.MapCanvas&&globalThis.MapPrefectureProfiles&&globalThis.MapWorldPreview)return Promise.resolve();
  if(typeof document==='undefined')return Promise.reject(new Error('map-phase2-canvas: document unavailable'));
  if(prototypesPromise)return prototypesPromise;
  const loadScript=src=>new Promise((resolve,reject)=>{
    const el=document.createElement('script');
    el.src=src;el.onload=()=>resolve();el.onerror=()=>reject(new Error(`map-phase2-canvas: failed to load ${src}`));
    document.head.appendChild(el);
  });
  prototypesPromise=PROTOTYPE_SCRIPTS.reduce((chain,src)=>chain.then(()=>loadScript(src)),Promise.resolve())
    .catch(error=>{prototypesPromise=null;throw error;});
  return prototypesPromise;
}

/* ---- sprite manifest + image cache (module-level, survives across re-renders) ---- */
let manifestPromise=null;
let assetsPromise=null;
let assetsReady=null;
function ensureAssetsLoaded(){
  const MW=globalThis.MapWorldPreview;
  if(!MW)return Promise.resolve(null);
  if(assetsPromise)return assetsPromise;
  manifestPromise=manifestPromise||fetch(MANIFEST_URL).then(res=>res.json());
  assetsPromise=manifestPromise.then(manifest=>{
    const index2=MW.indexCategoryManifest(manifest);
    if(!index2.ok)return null;
    const legacyIndex=Object.assign({},index2,{sprites:index2.sprites.filter(s=>s.placeholder)});
    const newIndex=Object.assign({},index2,{sprites:index2.sprites.filter(s=>!s.placeholder)});
    return Promise.all([MW.loadSprites(legacyIndex,IMAGE_BASE),MW.loadSprites(newIndex,ASSET_BASE)])
      .then(([legacyResult,newResult])=>({index2,images:Object.assign({},legacyResult.images,newResult.images)}));
  }).catch(()=>null);
  return assetsPromise;
}

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
 * percentage-based layout; a pixel value works identically).
 */
function positionMarkers(canvas,camTransform){
  const container=canvas.parentElement;if(!container)return;
  for(const marker of container.querySelectorAll('[data-d-ui-marker][data-phase2-tile-x]')){
    const tileX=Number(marker.dataset.phase2TileX),tileY=Number(marker.dataset.phase2TileY);
    if(!Number.isFinite(tileX)||!Number.isFinite(tileY))continue;
    const [x,y]=camTransform.toCss(tileX,tileY);
    marker.style.setProperty('--x',`${x}px`);marker.style.setProperty('--y',`${y}px`);
  }
}

/*
 * render(): synchronous, called from js/d-ui-shell.js's renderMapWorkspace()
 * every render, once per call with a fresh <canvas> element
 * (renderMapWorkspace rebuilds .d-city-surface's innerHTML wholesale every
 * time it runs -- there is nothing new to persist across renders other
 * than the caches above). If the prototype renderer files or sprite
 * assets are not loaded yet, paints a neutral placeholder fill and kicks
 * off the load; once it resolves, forces the existing D UI shell
 * enhancer to re-run (the same public entry point a marker click already
 * uses) so the city appears -- this never touches simulation state, only
 * asks the UI to redraw.
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
    ensurePrototypesLoaded().then(ensureAssetsLoaded).then(result=>{
      if(!result||assetsReady)return;
      assetsReady=result;
      /*
       * modules.dUIShell.enhance(true) is called directly (bypassing the
       * shared registry) because it must force a redraw even though g
       * itself hasn't changed -- only this module's own internal
       * assetsReady flag has, which renderKey(g) has no way to see. That
       * rebuilds .d-map-workspace's innerHTML wholesale (a fresh
       * .d-map-stage/.d-map-tools/.d-city-surface), but a direct call to
       * one enhancer's own enhance() does not run any OTHER registered
       * enhancer -- so without the followup runUIEnhancers() call below,
       * js/iphone-playtest-fixes.js's own registered enhancer (which hides
       * the legacy .d-map-tools and builds the iPhone nav/tools/popover
       * chrome, keyed off a data-iphone-map-key attribute on the stage
       * element) would never re-run on this freshly rebuilt stage until
       * some unrelated later click happened to trigger a full pass.
       * runUIEnhancers() itself is safe to call here: this callback never
       * runs while another enhancer pass is already in progress.
       */
      modules.dUIShell?.enhance?.(true);
      modules.uiEnhancerRegistry?.runUIEnhancers?.();
    }).catch(()=>{});
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
  positionMarkers(canvas,camTransform);
}

installPanHandlers();

modules.mapPhase2Canvas=Object.freeze({
  buildMapViewModel,placeEntityTiles,render,consumeJustPanned,
  __installed:true
});
})();
