'use strict';
/*
 * Published-URL WebKit smoke for the Phase 2 map's lazy-load recovery fix.
 *
 * Real-device incident this exists to catch: PR #613 shipped with a
 * permanent-stuck-loading bug (js/map-phase2-canvas.js's assetsPromise/
 * manifestPromise never reset on failure) that survived a fully green CI
 * run, including the existing published-URL WebKit suite in this same
 * workflow (see tests/iphone-webkit-smoke-test.js) -- because that suite
 * never opens the map tab at all. This file closes that gap: it opens the
 * map on the ACTUAL published GitHub Pages URL, waits (bounded, not
 * indefinitely) for the loading placeholder to resolve, and asserts the
 * city actually painted (not just the neutral background fill) with real
 * markers -- then repeats across a prefecture-switching sequence.
 *
 * "loading表示が存在してもtest pass" is explicitly forbidden by this file's
 * own design: waitForMapLoadResolved() below polls until the DOM no longer
 * shows the "出店候補を読み込み中です" loading text, and a separate assertion
 * confirms the error/retry UI (.d-map-load-error) never appeared -- a test
 * that merely checked "the page loaded" without either of those would not
 * have caught the original incident.
 */
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {webkit,devices}=require('playwright');const {createDiagnostics,observePageDiagnostics,runWithPublishedRetry}=require('./published-webkit-transient-retry');
const ROOT=path.resolve(__dirname,'..'),TARGET_URL=process.env.MAP_PHASE2_TARGET_URL||'https://yutaro-j31.github.io/capitalism-tycoon-web/',ARTIFACT_DIR=path.resolve(process.env.IPHONE_WEBKIT_ARTIFACT_DIR||path.join(ROOT,'artifacts','published-iphone-webkit-smoke'));const SAVE_KEY='capitalism_tycoon_web_v1',SAVE_VERSION=9,DEVICE_NAME='iPhone 13';assert.ok(devices[DEVICE_NAME]);
const PREF_SEQUENCE=['saitama','tochigi','gunma','tokyo'];
const MAP_READY_TIMEOUT_MS=20000;

function writeResult(v){fs.mkdirSync(ARTIFACT_DIR,{recursive:true});fs.writeFileSync(path.join(ARTIFACT_DIR,'published-map-phase2-result.json'),JSON.stringify(v,null,2)+'\n')}
async function raw(page){return page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)}
async function game(page){const r=await raw(page);return r?JSON.parse(r):null}
async function assertRuntimeHealthy(page,label){const dialog=page.locator('#runtime-recovery-root [role="dialog"]');if(await dialog.count()&&await dialog.isVisible()){throw new Error(`${label}: runtime recovery dialog visible`);}}
async function openTab(page,tab){await page.locator('[data-d-ui-action="toggle-menu"]').first().click();const menu=page.locator('#d-ui-command-menu.open');await menu.waitFor({state:'visible'});await menu.locator(`[data-tab="${tab}"]`).click();await menu.waitFor({state:'hidden'});}

/*
 * Waits until the map's DOM is no longer showing the "loading" state --
 * either real markers appeared, the empty-filter state appeared, or (a
 * failure this test must catch, not swallow) the explicit error UI
 * appeared. Never waits indefinitely: MAP_READY_TIMEOUT_MS bounds it, and
 * a timeout here is itself a test failure (the exact "infinite loading"
 * symptom this file exists to prevent).
 */
async function waitForMapLoadResolved(page,timeoutMs){
  await page.waitForFunction(()=>{
    const el=document.querySelector('.d-no-markers');
    if(!el)return true;
    return !(el.textContent||'').includes('読み込み中');
  },{timeout:timeoutMs});
}

async function canvasPaintSample(page){
  return page.evaluate(()=>{
    const canvas=document.querySelector('.d-phase2-canvas');
    if(!canvas)return null;
    const ctx=canvas.getContext('2d');
    const {width,height}=canvas;
    if(!width||!height)return {width,height,variance:0};
    const data=ctx.getImageData(0,0,width,height).data;
    let minR=255,maxR=0,minG=255,maxG=0,minB=255,maxB=0;
    for(let i=0;i<data.length;i+=40){
      const r=data[i],g=data[i+1],b=data[i+2];
      if(r<minR)minR=r;if(r>maxR)maxR=r;
      if(g<minG)minG=g;if(g>maxG)maxG=g;
      if(b<minB)minB=b;if(b>maxB)maxB=b;
    }
    return {width,height,variance:(maxR-minR)+(maxG-minG)+(maxB-minB)};
  });
}

async function assertCityPainted(page,label){
  await waitForMapLoadResolved(page,MAP_READY_TIMEOUT_MS);
  const errorUi=await page.locator('.d-map-load-error').count();
  assert.equal(errorUi,0,`${label}: map surfaced its error/retry UI instead of loading (loadState reached 'error')`);
  const markerCount=await page.locator('.d-map-marker').count();
  assert.ok(markerCount>=1,`${label}: expected at least 1 actionable marker, saw ${markerCount}`);
  const paint=await canvasPaintSample(page);
  assert.ok(paint,`${label}: .d-phase2-canvas not found`);
  assert.ok(paint.width>0&&paint.height>0,`${label}: canvas has a zero backing store (${JSON.stringify(paint)})`);
  assert.ok(paint.variance>10,`${label}: canvas reads as a flat, unpainted fill (variance=${paint.variance}) -- the city never actually rendered`);
  return {markerCount,paint};
}

/*
 * Cache coherence on the REAL published origin. js/map-phase2-canvas.js and
 * css/d-ui-map-phase2-markers.css each report the revision they were stamped
 * with (scripts/asset-revision.js). A browser that mixed generations -- fresh
 * HTML plus a stale cached script or stylesheet, the failure that kept showing
 * an old marker UI on a real device while GitHub Pages was serving correct
 * bytes -- makes these two disagree.
 */
async function assertAssetRevisionCoherent(page,label){
  const revisions=await page.evaluate(()=>({
    js:globalThis.__STATIC_ASSET_REVISION||null,
    css:getComputedStyle(document.documentElement).getPropertyValue('--d-map-asset-revision').trim().replace(/^"|"$/g,'')
  }));
  assert.match(String(revisions.js||''),/^[0-9a-f]{12}$/,`${label}: the published js/map-phase2-canvas.js reported no stamped asset revision (${JSON.stringify(revisions)})`);
  assert.equal(revisions.css,revisions.js,`${label}: script and stylesheet are different generations (${JSON.stringify(revisions)}) -- the browser is running mixed map assets`);
  return revisions;
}

/*
 * 看板をタップ -> その物件の詳細. Picks a marker genuinely inside the visible
 * city surface (positionMarkers() intentionally leaves off-camera markers
 * outside it) and asserts the detail that comes back belongs to THAT entity
 * and is actually on screen -- on the stacked iPhone layout the panel renders
 * below the map, so "updated but invisible" is the exact reported symptom.
 */
async function assertMarkerOpensDetail(page,label){
  const markerId=await page.evaluate(()=>{
    const stage=document.querySelector('.d-city-surface-phase2')?.getBoundingClientRect();
    if(!stage)return null;
    for(const el of document.querySelectorAll('.d-map-marker')){
      if(el.hidden)continue;
      const r=el.getBoundingClientRect();
      if(r.width&&r.left>=stage.left&&r.right<=stage.right&&r.top>=stage.top&&r.bottom<=stage.bottom)return el.dataset.dUiMarker;
    }
    return null;
  });
  if(!markerId)return null;
  await page.locator(`.d-map-marker[data-d-ui-marker="${markerId}"]`).click({timeout:15000});
  await page.waitForTimeout(400);
  const detail=await page.evaluate(()=>{
    const el=document.querySelector('.d-context-panel');
    if(!el)return null;
    const r=el.getBoundingClientRect();
    return {selected:document.querySelector('.d-map-marker.selected')?.dataset.dUiMarker||null,
      heading:el.querySelector('h2')?.textContent?.trim()||'',
      html:el.innerHTML,top:r.top,bottom:r.bottom,viewportHeight:window.innerHeight};
  });
  assert.ok(detail,`${label}: no detail panel after tapping a marker`);
  assert.equal(detail.selected,markerId,`${label}: tapping a marker must select that same marker`);
  assert.ok(detail.heading.length>0,`${label}: the detail panel must name the tapped entity`);
  const sourceId=markerId.slice(markerId.indexOf(':')+1);
  if(!markerId.startsWith('store:'))assert.ok(detail.html.includes(`data-id="${sourceId}"`),`${label}: the detail action must carry the tapped entity's own id (${sourceId}), not another entity's`);
  assert.ok(detail.top<detail.viewportHeight&&detail.bottom>0,`${label}: the detail must be visible after the tap (top=${Math.round(detail.top)}, viewport=${detail.viewportHeight})`);
  return {markerId,heading:detail.heading};
}

async function runAttempt(attempt){
  fs.mkdirSync(ARTIFACT_DIR,{recursive:true});
  let browser,page;const diagnostics=createDiagnostics(),startedAt=new Date().toISOString();
  const prefResults={},markerDetails={};let assetRevision=null;
  try{
    browser=await webkit.launch();
    const context=await browser.newContext({...devices[DEVICE_NAME],locale:'ja-JP',timezoneId:'Asia/Tokyo',reducedMotion:'reduce',serviceWorkers:'block'});
    page=await context.newPage();
    observePageDiagnostics(page,{published:true,targetUrl:TARGET_URL,diagnostics});
    await page.goto(TARGET_URL,{waitUntil:'networkidle',timeout:45000});
    await page.evaluate(k=>localStorage.removeItem(k),SAVE_KEY);
    await page.reload({waitUntil:'networkidle',timeout:45000});
    await page.locator('#setup-form input[name="playerName"]').fill('公開マップ検証者');
    await page.locator('#setup-form input[name="companyName"]').fill('公開マップ商事');
    await page.locator('#setup-form').evaluate(f=>f.requestSubmit());
    await page.locator('.topbar').waitFor({state:'visible'});
    await assertRuntimeHealthy(page,'after setup');
    const initial=await game(page);
    assert.equal(initial.configured,true);
    assert.equal(initial.saveVersion,SAVE_VERSION);

    await openTab(page,'map');
    await assertRuntimeHealthy(page,'after opening map');
    prefResults.initial=await assertCityPainted(page,'initial map open (cold load)');
    assetRevision=await assertAssetRevisionCoherent(page,'initial map open (cold load)');
    markerDetails.initial=await assertMarkerOpensDetail(page,'initial map open (cold load)');
    await page.screenshot({path:path.join(ARTIFACT_DIR,'published-map-phase2-initial.png')});

    const prefSelect=page.locator('[data-iphone-pref]');
    await prefSelect.waitFor({state:'visible'});
    for(const prefID of PREF_SEQUENCE){
      await prefSelect.selectOption(prefID);
      await assertRuntimeHealthy(page,`after switching to ${prefID}`);
      prefResults[prefID]=await assertCityPainted(page,`prefecture switch: ${prefID}`);
      await assertAssetRevisionCoherent(page,`prefecture switch: ${prefID}`);
      markerDetails[prefID]=await assertMarkerOpensDetail(page,`prefecture switch: ${prefID}`);
      assert.equal(await prefSelect.inputValue(),prefID,`prefecture select did not settle on ${prefID}`);
    }
    await page.screenshot({path:path.join(ARTIFACT_DIR,'published-map-phase2-final.png')});

    const after=await game(page);
    assert.equal(after.saveVersion,SAVE_VERSION);
    assert.deepEqual(diagnostics,{consoleErrors:[],pageErrors:[],failedRequests:[],requiredAssetServerErrors:[]});
    writeResult({status:'passed',attempt,published:true,requiredAssetServerErrors:diagnostics.requiredAssetServerErrors,startedAt,completedAt:new Date().toISOString(),targetUrl:TARGET_URL,device:DEVICE_NAME,browser:'WebKit',browserVersion:browser.version(),saveKey:SAVE_KEY,saveVersion:SAVE_VERSION,prefSequence:PREF_SEQUENCE,prefResults,assetRevision,markerDetails,...diagnostics});
    console.log('Published Phase 2 map WebKit smoke passed');
  }catch(e){
    if(page)try{await page.screenshot({path:path.join(ARTIFACT_DIR,'published-map-phase2-failure.png')})}catch(_){}
    writeResult({status:'failed',attempt,published:true,startedAt,completedAt:new Date().toISOString(),targetUrl:TARGET_URL,error:e.stack||String(e),prefResults,assetRevision,markerDetails,...diagnostics});
    e.publishedWebKitDiagnostics=diagnostics;
    throw e;
  }finally{
    if(browser)await browser.close();
  }
}

async function main(){await runWithPublishedRetry({published:true,resultPath:path.join(ARTIFACT_DIR,'published-map-phase2-result.json'),runAttempt})}
main().catch(e=>{console.error(e.stack||e);process.exit(1)});
