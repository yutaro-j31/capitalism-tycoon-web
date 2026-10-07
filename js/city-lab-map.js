// City Lab production presentation. Reads the canonical map adapter; never owns economics or saves.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.mapPhase2Canvas)throw new Error('map-phase2-canvas.js must precede city-lab-map.js.');
if(modules.cityLabMap)throw new Error('city-lab-map.js is already registered.');
const LAZY_URLS=['./assets/vendor/three-r160.min.js?rev=ef20bfd929e6','./prototypes/map-canvas-renderer.js?rev=ef20bfd929e6','./prototypes/map-prefecture-profiles.js?rev=ef20bfd929e6'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KIND={store:'自社店舗',tenant:'出店候補',office:'オフィス',realestate:'不動産',competitor:'競合'};
let loading=null,failed=false,current=null;
function loadScript(url,ready){
  if(ready())return Promise.resolve();
  return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;let done=false;
    const finish=err=>{if(done)return;done=true;clearTimeout(timer);s.onload=s.onerror=null;if(err){s.remove();reject(err);}else resolve();};
    const timer=setTimeout(()=>finish(new Error('City asset timeout')),12000);
    s.onload=()=>finish(ready()?null:new Error('City asset did not register'));s.onerror=()=>finish(new Error('City asset failed'));document.head.appendChild(s);
  });
}
function ensureAssets(){
  if(!loading)loading=Promise.all(LAZY_URLS.map((url,i)=>loadScript(url,()=>[globalThis.THREE,globalThis.MapCanvas,globalThis.MapPrefectureProfiles][i]))).catch(error=>{loading=null;throw error;});
  return loading;
}
// Stable canonical IDs determine each semantic building, independently of filters and simulation RNG.
function layout(view){
  const profile=globalThis.MapPrefectureProfiles.resolveProfile(view.prefID),hash=globalThis.MapCanvas.hash;
  const entities=[...view.entities].sort((a,b)=>hash(view.prefID+':'+a.id)-hash(view.prefID+':'+b.id)||a.id.localeCompare(b.id));
  const slots=[];for(let z=-30;z<=30;z+=10)for(let x=-30;x<=40;x+=10)slots.push({x,z});
  slots.sort((a,b)=>(a.x*a.x+a.z*a.z)-(b.x*b.x+b.z*b.z)||a.z-b.z||a.x-b.x);
  const buildings=entities.slice(0,56).map((entity,i)=>{
    const kind=entity.kind==='tenant'?'commercial':entity.kind==='competitor'?'commercial':entity.kind==='realestate'?(String(entity.propertyKind).includes('土地')?'site':'residential'):entity.kind;
    const h=kind==='site'?.3:kind==='store'?3.8:kind==='commercial'?5.4:kind==='office'?8+profile.highRiseBias*7:7.5;
    return {...slots[i],id:entity.id,kind,w:5.4,d:5.1,h,entity};
  });
  const used=new Set(buildings.map(a=>a.x+':'+a.z));
  const scenery=slots.filter(a=>!used.has(a.x+':'+a.z)).map(a=>{const n=hash(profile.layoutSeed+':'+a.x+':'+a.z);return {...a,id:null,kind:n%100<profile.greeneryBias*36?'park':n%4===0?'residential':'office',w:4.6+(n%4)*.4,d:4.6+(n%3)*.4,h:4+(n%8)*(0.5+profile.highRiseBias)};});
  return {buildings,blocks:[...buildings,...scenery],profile,overflow:Math.max(0,entities.length-56)};
}
function release(){if(current){current.dispose();current=null;}}
function retry(){failed=false;loading=null;release();}
function renderWorkspace(screen,g,options){
  // A genuine DOM canvas is required. Server-side/headless harnesses retain the tested Canvas2D fallback.
  if(failed||typeof globalThis.HTMLCanvasElement==='undefined')return false;
  let root=screen.querySelector('.city-lab-map');
  if(!root){
    release();let directory=screen.querySelector(':scope > .d-map-directory');
    if(!directory){const children=[...screen.children];directory=document.createElement('details');directory.className='d-map-directory';directory.open=Boolean(options.directoryOpen);directory.addEventListener('toggle',()=>options.onDirectoryToggle?.(directory.open));directory.innerHTML='<summary>出店候補・物件・オフィス一覧</summary><div class="d-map-directory-body"></div>';children.forEach(n=>directory.lastElementChild.appendChild(n));screen.appendChild(directory);}
    root=document.createElement('section');root.className='d-map-workspace city-lab-map';root.setAttribute('aria-label','都市マップ');
    root.innerHTML='<div class="d-map-stage city-lab-stage"><div class="city-lab-viewport"><canvas class="city-lab-canvas" aria-hidden="true"></canvas><div class="city-lab-labels"></div></div><header class="city-lab-hud"><label class="city-lab-location"><span>CAPITALISM TYCOON</span><select data-bind="selectedPref" aria-label="都道府県を切り替える"></select></label><div class="city-lab-balance"><small></small><strong></strong></div></header><div class="city-lab-context"></div><div class="city-lab-controls"><button type="button" data-city-camera="in" aria-label="ズームイン">＋</button><button type="button" data-city-camera="out" aria-label="ズームアウト">−</button><button type="button" data-city-camera="fit">全体</button><button type="button" data-city-camera="filter" aria-label="表示する拠点を選ぶ" aria-expanded="false">表示</button></div><footer class="city-lab-footer"><span class="city-lab-gesture">ドラッグ移動 / ピンチ</span><button type="button" data-action="advance-week">1週間進める</button></footer><p class="city-lab-load" role="status">都市を読み込み中です</p></div><aside class="d-context-panel city-lab-sheet" aria-label="建物の詳細" hidden></aside>';
    screen.insertBefore(root,directory);
    root.addEventListener('click',event=>{const button=event.target.closest('[data-city-camera]');if(button)current?.cameraAction(button.dataset.cityCamera);});
    ensureAssets().then(()=>{if(!root.isConnected)return;try{current=createCity(root,{...options,onUnavailable:fallback});update(root,g,options);}catch(error){fallback(error);}}).catch(fallback);
    function fallback(error){if(!root.isConnected)return;console.warn('City Lab renderer unavailable; using Canvas2D.',error);failed=true;release();root.remove();options.fallback();modules.uiEnhancerRegistry?.runUIEnhancers?.();const notice=document.createElement('p');notice.className='city-lab-fallback';notice.setAttribute('role','status');notice.innerHTML='この端末では2Dマップを表示しています。 <button type="button" data-d-ui-action="city-retry">3Dを再試行</button>';screen.prepend(notice);}
  }
  if(current?.root===root)update(root,g,options);
  return true;
}
function update(root,g,options){
  const view=modules.mapPhase2Canvas.buildMapViewModel(g,options.engine),chosen=view.entities.find(e=>e.id===options.selected)||null;
  const select=root.querySelector('[data-bind="selectedPref"]');select.innerHTML=(g.prefs||[]).map(p=>'<option value="'+esc(p.id)+'"'+(p.id===view.prefID?' selected':'')+'>'+esc(p.name)+'</option>').join('');
  root.querySelector('.city-lab-balance small').textContent='WEEK '+g.week;
  root.querySelector('.city-lab-balance strong').textContent=modules.dUIShell.money(g.companyCash);
  root.querySelector('.city-lab-context').innerHTML='<span>自社店舗 '+view.entities.filter(e=>e.kind==='store').length+'</span><button type="button" data-action="tab" data-tab="home">今週の経営判断 ›</button>';
  current.update(view,options);
  const sheet=root.querySelector('.city-lab-sheet');sheet.hidden=!chosen;root.dataset.sheet=chosen?'open':'closed';
  if(chosen){sheet.innerHTML='<button type="button" class="city-lab-handle" aria-label="建物の詳細を広げる" aria-expanded="false"><i></i></button><header><div><small>'+esc(KIND[chosen.kind])+'</small><h2>'+esc(chosen.name)+'</h2></div><button type="button" data-d-ui-action="clear-selection" aria-label="建物の詳細を閉じる">×</button></header>'+options.detail(chosen,g)+'<button type="button" class="city-lab-focus">建物に寄る</button>';
    sheet.querySelector('.city-lab-focus').onclick=()=>current?.cameraAction('focus');
    const handle=sheet.querySelector('.city-lab-handle');const expand=value=>{sheet.classList.toggle('expanded',value);handle.setAttribute('aria-expanded',String(value));handle.setAttribute('aria-label',value?'建物の詳細を折りたたむ':'建物の詳細を広げる');current?.schedule();};
    handle.onclick=()=>{if(performance.now()>sheetSuppress)expand(!sheet.classList.contains('expanded'));};
    let start=null,moved=false,sheetSuppress=0;handle.onpointerdown=e=>{start=e.clientY;moved=false;handle.setPointerCapture(e.pointerId);};handle.onpointermove=e=>{if(start!==null&&Math.abs(e.clientY-start)>10)moved=true;};handle.onpointerup=e=>{if(start===null)return;const d=e.clientY-start;start=null;if(moved){sheetSuppress=performance.now()+350;if(d<-30)expand(true);else if(d>45){if(sheet.classList.contains('expanded'))expand(false);else options.select(null);}e.preventDefault();}};handle.onpointercancel=()=>{start=null;};
  }
  root.querySelector('.city-lab-load').hidden=true;
}
function createCity(root,initialOptions){
  const T=globalThis.THREE,viewport=root.querySelector('.city-lab-viewport'),canvas=root.querySelector('canvas'),labels=root.querySelector('.city-lab-labels');
  let options=initialOptions,scene,camera,renderer,raycaster,selectionBox,sun,picks=[],blocks=[],urban={},buildingRows=[],viewKey='',frame=0,disposed=false,gesture=null;
  const state={width:1,height:1,zoom:.82,panX:-3,panZ:5,selected:null,pref:null},pointers=new Map();
  renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  camera=new T.OrthographicCamera(-30,30,30,-30,.1,220);raycaster=new T.Raycaster();
  function disposePicks(){const geometries=new Set(),materials=new Set();picks.forEach(p=>{geometries.add(p.geometry);materials.add(p.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());picks=[];}
  function buildScene(){
    disposePicks();
    if(scene){scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});const mats=new Set();scene.traverse(o=>{if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>mats.add(m));else mats.add(o.material);}});mats.forEach(m=>m.dispose());}
    scene=new T.Scene();const dark=false;
    const region={palette:0xe8efec};scene.background=new T.Color(dark?0x263d44:region.palette);scene.fog=new T.Fog(scene.background,90,190);
    const hemi=new T.HemisphereLight(0xe4f2fa,0x829888,2.1);scene.add(hemi);
    sun=new T.DirectionalLight(0xfff8eb,3.0);sun.position.set(-28,50,24);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-53;sun.shadow.camera.right=53;sun.shadow.camera.top=53;sun.shadow.camera.bottom=-53;sun.shadow.camera.near=1;sun.shadow.camera.far=120;sun.shadow.bias=-.0006;sun.shadow.normalBias=.08;scene.add(sun);
    const batch=new Map(),pickGeo=new T.BoxGeometry(1,1,1),pickMat=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false});picks=[];
    function cube(x,y,z,w,h,d,color,material='stone',rotation=0){const key=color+':'+material;if(!batch.has(key))batch.set(key,{color,material,items:[]});batch.get(key).items.push({x,y,z,w,h,d,rotation});}
    const colors={ground:urban.color,walk:0xe2e6df,road:0x939fa1,line:0xd4dbd7,stone:0xc5c9c4,light:0xe3e3d7,metal:0x71858a,glass:0x65868b,darkglass:0x435f6b,bronze:0x8b7861,green:0x6f9275,grass:0x9eae90,roof:0x6f7d7d,shop:0xbebcaa,red:0x765147};
    cube(0,-.45,0,86,.8,86,colors.ground);
    for(let i=-35;i<=35;i+=10){cube(i,-.005,0,2.35,.03,86,colors.road);cube(0,.005,i,86,.03,2.35,colors.road);for(let q=-41;q<42;q+=3.2){cube(i,.03,q,.08,.012,1.3,colors.line);cube(q,.04,i,1.3,.012,.08,colors.line);}for(let k=-30;k<=30;k+=10)for(let c=-2;c<=2;c++){cube(i+c*.36,.052,k+3.7,.2,.015,1.25,colors.line);cube(k+3.7,.054,i+c*.36,1.25,.015,.2,colors.line);}}
    
    if(urban.water){cube(urban.water===2?36:32,.07,0,urban.water===2?14:7,.035,86,0x759fac,'glass');cube(26,.12,0,2,.12,86,colors.walk);for(let z=-35;z<=35;z+=10){cube(28,.7,z,.09,1.2,.09,colors.metal);cube(28,1.35,z,.35,.14,.35,colors.light);}}
    const trees=[];const tree=(x,z,scale=1)=>{cube(x,.72*scale,z,.13*scale,1.35*scale,.13*scale,0x776e59);trees.push({x,y:1.6*scale,z,scale});};
    function facades(a,cx,cz,y,h,w,d,glass,spacing=.8){
      const floor=.74;
      cube(cx,y+h/2,cz,w,h,d,glass,'glass');
      for(let fy=y+.45;fy<y+h;fy+=floor){cube(cx,fy,cz+d/2+.018,w+.04,.058,.045,colors.metal);cube(cx,fy,cz-d/2-.018,w+.04,.058,.045,colors.metal);cube(cx+w/2+.018,fy,cz,.045,.058,d+.04,colors.metal);cube(cx-w/2-.018,fy,cz,.045,.058,d+.04,colors.metal);}
      for(let vx=-w/2;vx<=w/2+.01;vx+=spacing){cube(cx+vx,y+h/2,cz+d/2+.045,.055,h,.07,colors.light);cube(cx+vx,y+h/2,cz-d/2-.045,.055,h,.07,colors.light);}
      for(let vz=-d/2;vz<=d/2+.01;vz+=spacing){cube(cx+w/2+.045,y+h/2,cz+vz,.07,h,.055,colors.light);cube(cx-w/2-.045,y+h/2,cz+vz,.07,h,.055,colors.light);}
    }
    for(const a of blocks){
      const x=a.x,z=a.z,w=a.w,d=a.d,h=a.h;
      cube(x,.13,z,8.0,.26,8.0,colors.walk);cube(x,.30,z,w+.75,.12,d+.75,colors.light);
      if(a.kind==='park'){cube(x,.34,z,6.3,.10,6.3,colors.grass);cube(x,.41,z,.9,.045,6.4,colors.walk);cube(x,.42,z,6.4,.045,.9,colors.walk);for(let k=0;k<5;k++)tree(x-2.2+(k%2)*4.2,z-2.2+Math.floor(k/2)*1.9,1.2);cube(x-1.1,.65,z,.16,.45,1.4,colors.bronze);cube(x-1.1,.83,z,.55,.12,1.4,colors.bronze);continue;}
      if(a.kind==='site'){cube(x,.39,z,w,.06,d,0xabb4a5);for(let s=-w/2;s<=w/2;s+=1.1){cube(x+s,.72,z-d/2,.06,.9,.06,colors.metal);cube(x+s,.72,z+d/2,.06,.9,.06,colors.metal);}cube(x,.9,z-d/2,w,.09,.07,colors.metal);cube(x,.9,z+d/2,w,.09,.07,colors.metal);cube(x+1.6,1.1,z+1.8,1.1,1.25,.10,colors.light);cube(x+1.6,.6,z+1.8,.09,.8,.12,colors.metal);}
      else if(a.kind==='construction'){
        cube(x,.51,z,w,.28,d,colors.stone);for(let fy=.8;fy<h;fy+=1.2){cube(x,fy,z,w,.16,d,colors.light);for(let bx of[-w/2,w/2])for(let bz of[-d/2,d/2])cube(x+bx,fy+.5,z+bz,.16,1.1,.16,colors.metal);}
        cube(x+w/2+.5,4,z-1.5,.16,7.4,.16,colors.bronze);cube(x+.4,7.65,z-1.5,5.5,.16,.18,colors.bronze);cube(x-1.6,6.6,z-1.5,.05,1.9,.05,colors.metal);cube(x-1.6,5.62,z-1.5,.22,.25,.22,colors.roof);cube(x,1.1,z+d/2+.35,w+.65,1.4,.10,0x9aada7);
      }else if(a.kind==='store'){
        cube(x,.3+h/2,z,w,h,d,colors.light);cube(x,h+.34,z,w+.35,.22,d+.35,colors.red);cube(x,h-.45,z+d/2+.08,w,.48,.20,colors.bronze);cube(x,1.25,z+d/2+.05,w-.6,1.8,.08,colors.darkglass,'glass');for(let bx=-w/2+.4;bx<w/2;bx+=1.2)cube(x+bx,1.3,z+d/2+.1,.08,2,.12,colors.metal);cube(x,2.35,z+d/2+.57,w+.35,.12,1.15,colors.roof);cube(x-1.1,1.87,z+d/2+.32,1.8,.57,.06,0x4d6958);cube(x+.3,2.95,z+d/2+.22,2.2,.43,.11,colors.light);cube(x+w/2-.05,2.45,z+d/2+.37,.16,1.15,.45,colors.bronze);cube(x-1.35,h+.7,z-.7,1.15,.55,1.15,colors.metal);cube(x+.9,h+.65,z-.5,.7,.45,1.0,colors.roof);
      }else if(a.kind==='commercial'){
        cube(x,.3+h/2,z,w,h,d,colors.shop);facades(a,x,z,.5,h-.7,w-.5,d-.45,colors.glass,1.15);cube(x,2.3,z+d/2+.12,w+.28,.55,.25,colors.bronze);cube(x,.85,z+d/2+.37,w+.12,.12,.85,colors.roof);cube(x,h+.25,z,w+.15,.23,d+.15,colors.light);cube(x+.3,h+.65,z-.9,1.15,.55,1.4,colors.metal);
      }else if(a.kind==='residential'){
        cube(x,.3+h/2,z,w,h,d,colors.light);cube(x,.5+h/2,z+.08,w-.65,h-.4,d-.5,colors.darkglass,'glass');for(let fy=1.25;fy<h;fy+=1.1){cube(x,fy,z+d/2+.2,w+.1,.16,.78,colors.light);cube(x,fy+.35,z+d/2+.54,w-.16,.52,.055,colors.glass,'glass');cube(x+w/2+.11,fy,z,.52,.13,d+.2,colors.light);}for(let bx=-w/2;bx<=w/2;bx+=w/3)cube(x+bx,.4+h/2,z+d/2+.28,.22,h,.85,colors.light);cube(x,h+.3,z,w+.2,.2,d+.2,colors.roof);cube(x+.6,h+.7,z-.3,w*.4,.65,d*.4,colors.light);cube(x,1.25,z+d/2+.66,1.25,1.8,.08,colors.glass,'glass');cube(x,2.3,z+d/2+1.0,1.65,.12,1.2,colors.metal);
      }else{
        const main=a.entity?.kind==='office'&&Boolean(a.entity.office?.contracted),podium=main?2.7:1.8,glass=main?colors.darkglass:colors.glass;
        cube(x,.3+podium/2,z,w,podium,d,colors.light);facades(a,x,z,.48,podium-.3,w-.6,d-.6,glass,1.35);
        const tw=w-(main?1.05:.65),td=d-.65;
        facades(a,x,z+.05,podium+.3,h-podium-1.5,tw,td,glass,main?.75:1.1);
        cube(x-w/2+.18,.3+h/2,z,.38,h,d-.3,colors.light);cube(x+w/2-.18,.3+h/2,z,.38,h,d-.3,colors.light);
        cube(x,h-.65,z+.05,tw+.13,.2,td+.12,colors.light);cube(x-.15,h-.08,z-.1,tw-.7,1.0,td-.75,colors.metal);cube(x-.15,h+.51,z-.1,tw-.85,.16,td-.9,colors.light);cube(x-.3,h+.92,z-.4,tw*.46,.68,td*.4,colors.metal);
        cube(x,1.2,z+d/2+.075,1.35,1.8,.08,colors.darkglass,'glass');cube(x,2.3,z+d/2+.65,2.5,.13,1.6,colors.metal);cube(x,2.25,z+d/2+.55,2.2,.05,1.4,colors.glass,'glass');
        cube(x-1.35,podium+.47,z+d/2-.55,1.1,.33,.6,colors.grass);cube(x+1.3,podium+.47,z+d/2-.55,1.0,.33,.6,colors.grass);
        if(main){cube(x,h-2.4,z+td/2+.1,tw-.2,.6,.13,colors.bronze);cube(x+1.0,h+1.5,z-.4,.06,.8,.06,colors.metal);}
      }
      for(let tz of[-3.4,3.4]){tree(x-3.45,z+tz,.8);tree(x+3.45,z+tz,.9);}
      cube(x-3.4,.63,z,.28,.78,1.35,colors.grass);cube(x+3.4,.63,z,.28,.78,1.35,colors.grass);
      const pick=new T.Mesh(pickGeo,pickMat);pick.scale.set(w+1,Math.max(h+1,1.6),d+1);pick.position.set(x,.3+Math.max(h+1,1.6)/2,z);pick.userData.assetId=a.id;pick.updateMatrixWorld(true);if(a.id)picks.push(pick);
    }
    const geo=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();
    for(const entry of batch.values()){
      const mat=new T.MeshStandardMaterial({color:entry.color,roughness:entry.material==='glass'?.29:.82,metalness:entry.material==='glass'?.3:.04});
      const mesh=new T.InstancedMesh(geo,mat,entry.items.length);
      entry.items.forEach((b,i)=>{dummy.position.set(b.x,b.y,b.z);dummy.scale.set(b.w,b.h,b.d);dummy.rotation.set(0,b.rotation,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);
    }
    const treeMesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:colors.green,roughness:1}),trees.length);
    trees.forEach((t,i)=>{dummy.position.set(t.x,t.y,t.z);dummy.scale.set(.65*t.scale,.92*t.scale,.65*t.scale);dummy.rotation.set(0,0,0);dummy.updateMatrix();treeMesh.setMatrixAt(i,dummy.matrix);});treeMesh.instanceMatrix.needsUpdate=true;treeMesh.castShadow=true;treeMesh.receiveShadow=true;treeMesh.computeBoundingSphere();scene.add(treeMesh);
    const selectionSource=new T.Mesh(pickGeo,pickMat);selectionBox=new T.BoxHelper(selectionSource,0x387b91);selectionBox.visible=false;selectionBox.material.transparent=true;selectionBox.material.opacity=.9;selectionBox.material.depthTest=false;selectionBox.renderOrder=9;scene.add(selectionBox);
    renderer.shadowMap.needsUpdate=true;updateSelection();
  }
  function updateSelection(){if(!selectionBox)return;const p=picks.find(p=>p.userData.assetId===state.selected);selectionBox.visible=!!(state.selected&&p);if(p)selectionBox.setFromObject(p);}

  function applyCamera(){const span=state.width<500?43:48,aspect=state.width/state.height;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.zoom=state.zoom;const targetHeight=state.height<400?7:0;camera.position.set(state.panX+38,38+targetHeight,state.panZ+44);camera.lookAt(state.panX,targetHeight,state.panZ);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
  function project(a){const v=new T.Vector3(a.x,a.h+.65,a.z).project(camera);return {x:(v.x+1)*state.width/2,y:(1-v.y)*state.height/2,z:v.z};}
  function render(){frame=0;if(disposed||!root.isConnected)return;applyCamera();renderer.render(scene,camera);
    const r=viewport.getBoundingClientRect(),occupied=[...root.querySelectorAll('.city-lab-hud,.city-lab-context,.city-lab-controls,.city-lab-filters,.city-lab-footer')].filter(n=>n.offsetHeight>0).map(n=>{const b=n.getBoundingClientRect();return {x:b.left-r.left-6,y:b.top-r.top-6,w:b.width+12,h:b.height+12};}),sheet=root.querySelector('.city-lab-sheet'),bottom=sheet.hidden?72:sheet.offsetHeight+12;
    const rows=[...buildingRows].sort((a,b)=>Number(b.id===state.selected)-Number(a.id===state.selected));
    rows.forEach(a=>{const b=labels.querySelector('[data-city-index="'+a.index+'"]');if(!b)return;const p=project(a),width=Math.min(146,b.offsetWidth||130);const box={x:p.x-width/2,y:p.y-44,w:width,h:44};
      const visible=(options.filter==='all'||a.entity.kind===options.filter)&&p.z>=-1&&p.z<=1&&p.x>width/2+8&&p.x<state.width-width/2-8&&p.y>44&&p.y<state.height-bottom&&!occupied.some(o=>box.x<o.x+o.w&&box.x+box.w>o.x&&box.y<o.y+o.h&&box.y+box.h>o.y);
      b.hidden=!visible;if(visible){occupied.push(box);b.style.transform='translate('+p.x.toFixed(1)+'px,'+p.y.toFixed(1)+'px) translate(-50%,-100%)';}b.classList.toggle('selected',a.id===state.selected);b.setAttribute('aria-pressed',String(a.id===state.selected));
    });root.querySelector('.city-lab-gesture').textContent=Math.round(state.zoom*100)+'% · ドラッグ移動 / ピンチ';
  }
  function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(render);}
  function resize(){state.width=Math.max(1,viewport.clientWidth);state.height=Math.max(1,viewport.clientHeight);renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.65));renderer.setSize(state.width,state.height,false);schedule();}
  function ground(x,y){applyCamera();const r=viewport.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((x-r.left)/state.width*2-1,1-(y-r.top)/state.height*2),camera);return raycaster.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());}
  function zoomAt(next,x,y){const before=ground(x,y);state.zoom=clamp(next,.58,2.6);const after=ground(x,y);if(before&&after){state.panX=clamp(state.panX+before.x-after.x,-33,33);state.panZ=clamp(state.panZ+before.z-after.z,-33,33);}schedule();}
  function centroid(){const ps=[...pointers.values()];return {x:ps.reduce((s,p)=>s+p.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.y,0)/ps.length};}
  function distance(){const ps=[...pointers.values()];return ps.length<2?0:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);}
  function down(e){if(e.button>0)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{viewport.setPointerCapture(e.pointerId);}catch(_){}const c=centroid();gesture={x:c.x,y:c.y,moved:pointers.size>1,marker:e.target.closest('[data-d-ui-marker]')?.dataset.dUiMarker};}
  function move(e){if(!pointers.has(e.pointerId))return;e.preventDefault();const before=centroid(),d=distance();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const after=centroid();if(Math.hypot(after.x-gesture.x,after.y-gesture.y)>8||pointers.size>1)gesture.moved=true;if(!gesture.moved)return;
    const a=ground(before.x,before.y);if(pointers.size>1&&d>2)state.zoom=clamp(state.zoom*distance()/d,.58,2.6);const b=ground(after.x,after.y);if(a&&b){state.panX=clamp(state.panX+a.x-b.x,-33,33);state.panZ=clamp(state.panZ+a.z-b.z,-33,33);}schedule();}
  let suppressUntil=0;
  function up(e,cancelled=false){if(!pointers.has(e.pointerId))return;e.preventDefault();const tap=!cancelled&&!gesture?.moved&&pointers.size===1,marker=gesture?.marker;suppressUntil=performance.now()+350;pointers.delete(e.pointerId);if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);if(pointers.size){const c=centroid();gesture={x:c.x,y:c.y,moved:true,marker:null};}else gesture=null;
    if(tap){if(marker)options.select(marker);else{ground(e.clientX,e.clientY);const hit=raycaster.intersectObjects(picks,false).find(h=>options.filter==='all'||buildingRows.find(a=>a.id===h.object.userData.assetId)?.entity.kind===options.filter);options.select(hit?.object.userData.assetId||null);}}
  }
  function cancel(e){up(e,true);}
  function lost(e){if(pointers.has(e.pointerId))cancel(e);}
  function click(e){if(e.target.closest('[data-d-ui-marker]')&&e.detail!==0&&performance.now()<suppressUntil){e.preventDefault();e.stopPropagation();}}
  function wheel(e){e.preventDefault();zoomAt(state.zoom*Math.exp(-e.deltaY*.0015),e.clientX,e.clientY);}
  function contextLost(e){e.preventDefault();initialOptions.onUnavailable(new Error("WebGL context lost"));}
  viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',up);viewport.addEventListener('pointercancel',cancel);viewport.addEventListener('lostpointercapture',lost);viewport.addEventListener('click',click,true);viewport.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('webglcontextlost',contextLost);
  const observer=new ResizeObserver(resize);observer.observe(viewport);
  function update(view,nextOptions){options=nextOptions;state.selected=options.selected||null;
    labels.querySelectorAll('[data-d-ui-marker]').forEach(b=>b.classList.toggle('selected',b.dataset.dUiMarker===state.selected));
    const key=view.prefID+'|'+view.entities.map(e=>e.id+':'+e.kind).sort().join('|');
    if(key!==viewKey){viewKey=key;const derived=layout(view);buildingRows=derived.buildings.map((a,index)=>({...a,index}));blocks=derived.blocks;urban={color:0xd0dcd4,water:0};
      if(state.pref!==view.prefID){state.pref=view.prefID;state.zoom=.82;state.panX=-3;state.panZ=5;pointers.clear();gesture=null;}
      buildScene();labels.innerHTML=buildingRows.map(a=>'<button type="button" class="d-map-marker city-lab-marker '+esc(a.entity.kind)+'" data-city-index="'+a.index+'" data-d-ui-marker="'+esc(a.id)+'" aria-label="'+esc(KIND[a.entity.kind]+' '+a.entity.name)+'"><span><b>'+esc(a.entity.kind==='store'?'自':KIND[a.entity.kind])+'</b> '+esc(a.entity.name)+'</span></button>').join('');
    }else{buildingRows=buildingRows.map(a=>({...a,entity:view.entities.find(e=>e.id===a.id)||a.entity}));updateSelection();}
    let filters=root.querySelector('.city-lab-filters');if(!filters){filters=document.createElement('div');filters.className='city-lab-filters';filters.hidden=true;root.querySelector('.city-lab-stage').appendChild(filters);}filters.innerHTML=[['all','すべて'],...Object.entries(KIND)].map(([k,v])=>'<button type="button" data-d-ui-action="map-filter" data-kind="'+k+'" aria-pressed="'+String(options.filter===k)+'">'+v+'</button>').join('');
    resize();
  }
  function cameraAction(action){if(action==='filter'){const filters=root.querySelector('.city-lab-filters');filters.hidden=!filters.hidden;root.querySelector('[data-city-camera="filter"]').setAttribute('aria-expanded',String(!filters.hidden));schedule();return;}const r=viewport.getBoundingClientRect();if(action==='in'||action==='out')zoomAt(state.zoom*(action==='in'?1.22:1/1.22),r.left+r.width/2,r.top+r.height/2);if(action==='fit'){state.panX=-3;state.panZ=5;state.zoom=.82;options.select(null);}if(action==='focus'){const a=buildingRows.find(b=>b.id===state.selected);if(a){state.panX=a.x;state.panZ=a.z+9;state.zoom=1.65;}}schedule();}
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();pointers.clear();viewport.removeEventListener('pointerdown',down);viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerup',up);viewport.removeEventListener('pointercancel',cancel);viewport.removeEventListener('lostpointercapture',lost);viewport.removeEventListener('click',click,true);viewport.removeEventListener('wheel',wheel);canvas.removeEventListener('webglcontextlost',contextLost);disposePicks();if(scene){const geo=new Set(),mat=new Set();scene.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.material)mat.add(o.material);});geo.forEach(g=>g.dispose());mat.forEach(m=>m.dispose());}renderer.dispose();renderer.forceContextLoss();}
  return {root,update,schedule,cameraAction,dispose,getDiagnostics:()=>({...state,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,entities:buildingRows.length})};
}
modules.cityLabMap=Object.freeze({renderWorkspace,release,retry,layout,getDiagnostics:()=>current?.getDiagnostics()||null});
})();
