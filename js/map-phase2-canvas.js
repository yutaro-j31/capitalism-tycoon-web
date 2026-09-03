// PR A: production adapter foundation + feature flag + Phase 2 Canvas
// background wiring. See docs/map-phase2-production-integration-audit.md.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before map-phase2-canvas.js.');
const modules=globalThis.__capitalismTycoonModules;
if(modules.mapPhase2Canvas)throw new Error('map-phase2-canvas.js is already registered.');

/*
 * Marker/selection/filter wiring is PR B; this module only builds a pure,
 * read-only view model and draws Phase 2's deterministic city scenery
 * (terrain/roads/greenery/civic/office.mid/residential.mid/P0/P1 sprites/
 * landmark) into a <canvas> inside the existing production map shell.
 * Reuses prototypes/map-canvas-renderer.js (window.MapCanvas) and
 * prototypes/map-world-preview.js (window.MapWorldPreview) as-is -- see
 * the audit doc for why a 4th hash()/placement implementation must not
 * be created here. They stay lazily loaded (see ensurePrototypesLoaded
 * below), not static <script> tags in index.html: those two files live
 * under prototypes/, not js/, and tests/javascript-module-split-test.js
 * treats index.html's script tags as an exact 1:1 inventory of js/*.js --
 * loading them on demand also means a flag-off page never pays their
 * parse/network cost at all.
 */

const ASSET_BASE='./assets/map-sprites/phase2';
const IMAGE_BASE='./assets/map-sprites/phase1';
const MANIFEST_URL=`${ASSET_BASE}/sprites.json`;
const PROTOTYPE_SCRIPTS=['./prototypes/map-canvas-renderer.js','./prototypes/map-world-preview.js'];
const WORLD_COLS=32,WORLD_ROWS=28;
const DEFAULT_SCALE=0.72;
const FALLBACK_PREF_ID='tokyo';

/*
 * Feature flag: internal/dev-only, NOT game state. Read once per call from
 * the URL (?phase2MapCanvas=1/true/on), with an in-memory override for
 * console/dev toggling (setEnabledForDev). Never written to persistent
 * browser storage, the game's save key, or any g / engine field -- it
 * cannot survive a reload and cannot affect save compatibility.
 */
let flagOverride=null;
function urlFlagOn(){
  try{
    const params=new URLSearchParams(globalThis.location?.search||'');
    const raw=params.get('phase2MapCanvas');
    return raw==='1'||raw==='true'||raw==='on';
  }catch(e){return false;}
}
function isEnabled(){
  if(flagOverride!==null)return flagOverride;
  if(typeof globalThis.__phase2MapCanvas==='boolean')return globalThis.__phase2MapCanvas;
  return urlFlagOn();
}
function setEnabledForDev(value){flagOverride=value===null||value===undefined?null:Boolean(value);}

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
  const stores=byPref(g&&g.stores).map(store=>({id:`store:${store.id}`,kind:'store',sourceId:store.id,pref:store.prefID,label:store.name||businessName(store.businessID)||'直営店舗'}));
  const tenants=byPref(g&&g.tenants).map(tenant=>({id:`tenant:${tenant.id}`,kind:'tenant',sourceId:tenant.id,pref:tenant.prefID,label:tenant.name||'出店候補'}));
  const offices=byPref(g&&g.rentalOffices).map(office=>({id:`office:${office.id}`,kind:'office',sourceId:office.id,pref:office.prefID,label:office.name||'オフィス候補'}));
  const properties=byPref(g&&g.properties).map(property=>({id:`realestate:${property.id}`,kind:'realestate',sourceId:property.id,pref:property.prefID,label:property.name||'不動産候補'}));
  return {prefID,entities:[...stores,...tenants,...offices,...properties]};
}

/* ---- lazy-load the two prototype renderer files (only once, only when
   render() is actually first called with the flag on) ---- */
let prototypesPromise=null;
function ensurePrototypesLoaded(){
  if(globalThis.MapCanvas&&globalThis.MapWorldPreview)return Promise.resolve();
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
 * render(): synchronous, called from js/d-ui-shell.js's renderMapWorkspace()
 * only when isEnabled() is true, once per call with a fresh <canvas>
 * element (renderMapWorkspace rebuilds .d-city-surface's innerHTML
 * wholesale every time it runs, exactly like the legacy DOM/SVG layers
 * it sits beside -- there is nothing new to persist across renders other
 * than the caches above). If the prototype renderer files or sprite
 * assets are not loaded yet, paints a neutral placeholder fill and kicks
 * off the load; once it resolves, forces the existing D UI shell
 * enhancer to re-run (the same public entry point a marker click already
 * uses) so the city appears -- this never touches simulation state, only
 * asks the UI to redraw.
 */
function render(canvas,g){
  if(!canvas)return;
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
      modules.dUIShell?.enhance?.(true);
    }).catch(()=>{});
    return;
  }

  const dpr=Base.sizeCanvas(canvas,cssW,cssH,globalThis.devicePixelRatio);
  const {index2,images}=assetsReady;
  const prefID=(g&&(g.selectedPref||g.founderHomePrefID))||FALLBACK_PREF_ID;
  const district=ensureDistrict(index2,prefID);
  const transform=cachedTransform;
  const rawW=cssW/transform.scale,rawH=cssH/transform.scale;
  const camera=initialCamera(district,transform,rawW,rawH);
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
}

modules.mapPhase2Canvas=Object.freeze({
  isEnabled,setEnabledForDev,buildMapViewModel,render,
  __installed:true
});
})();
