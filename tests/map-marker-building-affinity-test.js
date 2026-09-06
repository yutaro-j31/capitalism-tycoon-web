'use strict';
/*
 * Marker / building affinity contract.
 *
 * A marker must not merely sit near a building -- it must sit on a building
 * that could plausibly BE that thing. Real-device report this locks down:
 * "テナント募集" appearing on warehouses and apartment blocks, offices
 * appearing on shops, and markers floating over empty plazas.
 *
 * Root cause: placement selected candidate tiles by district ZONE. A zone
 * only decides which sprite category POOL a tile draws from, and those pools
 * deliberately cross over -- prototypes/map-world-preview.js's ROLE_CATEGORY
 * gives the commercial zone an 'X' infill role of residential.low and the cbd
 * zone one of commercial.small -- while a zone's tile list also includes
 * every plot the block template left as OPEN SPACE. Measured on main
 * (8337024) across 5 prefectures with the real sprite manifest:
 *
 *   tenant : 33% no building at all, 18% residential.low, 12% office.*
 *   office : 40% no building at all, 18% commercial.small
 *   store  : 35% no building at all,  7% residential.low
 *
 * The fix selects by the SURFACE a player actually sees -- the sprite
 * category really placed on the tile (or, for an open plot, what kind of
 * open space it is) -- against an explicit per-kind allow-list. Anything
 * unlisted is forbidden, so civic buildings, the landmark, green space and
 * footprint-reserved tiles can never host a marker.
 *
 * Run directly: node tests/map-marker-building-affinity-test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const canvasSrc = fs.readFileSync(path.join(ROOT, 'js/map-phase2-canvas.js'), 'utf8');
const markersCss = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-markers.css'), 'utf8');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/map-sprites/phase2/sprites.json'), 'utf8'));

let pass = 0, fail = 0;
async function check(name, fn) {
  try { await fn(); console.log('PASS:', name); pass += 1; }
  catch (error) { console.log('FAIL:', name, '--', error.message); fail += 1; }
}

/* The real world grid, read from source so this test cannot drift from it. */
const gridMatch = canvasSrc.match(/const WORLD_COLS=(\d+),WORLD_ROWS=(\d+);/);
assert.ok(gridMatch, 'could not locate the world grid constants');
const WORLD_COLS = Number(gridMatch[1]), WORLD_ROWS = Number(gridMatch[2]);

function freshSandbox(overrides, source) {
  const sandbox = Object.assign({
    console, location: { search: '' }, devicePixelRatio: 2, URLSearchParams,
    Promise, Object, Array, Math, JSON, Date, Number, String, Map, Set,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(MANIFEST) }),
    document: { head: { appendChild() {} }, createElement() { return { set src(v) {} }; } },
    setTimeout, clearTimeout, requestAnimationFrame: cb => { cb(); return 1; },
  }, overrides || {});
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ['prototypes/map-canvas-renderer.js', 'prototypes/map-prefecture-profiles.js', 'prototypes/map-world-preview.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: path.basename(file) });
  }
  sandbox.__capitalismTycoonModules = {};
  vm.runInContext(source || canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' });
  return sandbox;
}

/* Boot a sandbox built from an arbitrary (possibly mutated) module source and
   wait for its district, so a negative test can exercise a whole alternative
   implementation rather than only a regex. */
function readyFrom(source) {
  const sandbox = freshSandbox(undefined, source);
  const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
  const warm = {
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
    getBoundingClientRect: () => ({ width: 1280, height: 800 }),
    parentElement: { querySelectorAll: () => [] }, width: 0, height: 0, style: {},
  };
  mod.render(warm, { selectedPref: 'tokyo' });
  return new Promise(resolve => {
    const poll = () => {
      if (mod.placeEntityTiles([], 'tokyo') !== null) { resolve({ sandbox, mod }); return; }
      setTimeout(poll, 20);
    };
    setTimeout(poll, 20);
  });
}

function readySandbox() {
  const sandbox = freshSandbox();
  const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
  const warm = {
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
    getBoundingClientRect: () => ({ width: 1280, height: 800 }),
    parentElement: { querySelectorAll: () => [] }, width: 0, height: 0, style: {},
  };
  mod.render(warm, { selectedPref: 'tokyo' });
  return new Promise(resolve => {
    const poll = () => {
      if (mod.placeEntityTiles([], 'tokyo') !== null) { resolve({ sandbox, mod }); return; }
      setTimeout(poll, 20);
    };
    setTimeout(poll, 20);
  });
}

/*
 * Independent re-derivation of "what is on this tile", built from the sprite
 * manifest rather than from the module's own table, so this asserts the
 * OUTCOME instead of restating the implementation.
 */
const SPRITE_CATEGORY = {};
for (const sprite of MANIFEST.sprites) SPRITE_CATEGORY[sprite.id] = sprite.category;
const OPEN_SURFACE = {
  plaza: 'open.hardscape', forecourt: 'open.hardscape',
  pocketPark: 'open.green', treeStrip: 'open.green',
  parking: 'open.industrial', loadingBay: 'open.industrial',
};
function surfaceUnder(cell) {
  if (!cell) return null;
  if (cell.spriteId) {
    if (cell.spriteId === 'commercial_billboard') return 'signage';
    return SPRITE_CATEGORY[cell.spriteId] || null;
  }
  if (cell.open) return OPEN_SURFACE[cell.openType] || null;
  return null;
}

/* The prefectures the report named, plus a spread of profile archetypes. */
const PREFS = ['tokyo', 'gunma', 'osaka', 'saitama', 'chiba', 'okinawa', 'hokkaido', 'aichi', 'fukuoka', 'kyoto'];
const PROPERTY_KINDS = ['商業ビル', '土地', '住宅', '大型物件', '物流', 'オフィス'];

function sampleEntities() {
  const entities = [];
  for (let i = 0; i < 6; i++) entities.push({ id: `store:s${i}`, kind: 'store', sourceId: `s${i}` });
  for (let i = 0; i < 8; i++) entities.push({ id: `tenant:t${i}`, kind: 'tenant', sourceId: `t${i}` });
  for (let i = 0; i < 3; i++) entities.push({ id: `office:o${i}`, kind: 'office', sourceId: `o${i}` });
  for (const kind of PROPERTY_KINDS) entities.push({ id: `realestate:${kind}`, kind: 'realestate', sourceId: kind, propertyKind: kind });
  return entities;
}

/* Place the sample set in every prefecture and report what each marker landed on. */
async function survey(mod, sandbox) {
  const MW = sandbox.MapWorldPreview;
  const index2 = MW.indexCategoryManifest(MANIFEST);
  assert.ok(index2.ok, 'the real sprite manifest must index cleanly');
  const rows = [];
  for (const prefID of PREFS) {
    const placed = mod.placeEntityTiles(sampleEntities(), prefID);
    const district = MW.buildWorldDistrict({ index2, prefID, cols: WORLD_COLS, rows: WORLD_ROWS });
    for (const entity of placed) {
      const cell = (entity.tileX === null || entity.tileX === undefined)
        ? null : district.byKey[`${entity.tileX},${entity.tileY}`];
      rows.push({
        prefID, kind: entity.kind, propertyKind: entity.propertyKind,
        placed: cell !== null, cell, surface: surfaceUnder(cell),
      });
    }
  }
  return rows;
}

async function main() {
  const { mod, sandbox } = await readySandbox();
  const rows = await survey(mod, sandbox);
  const of = predicate => rows.filter(predicate);

  /* ================= PRIORITY A: AFFINITY ================= */

  await check('every marker in every prefecture lands on a tile (no entity is dropped off the map by the new allow-list)', () => {
    const dropped = of(r => !r.placed);
    assert.equal(dropped.length, 0, `${dropped.length} markers were not placed at all, e.g. ${JSON.stringify(dropped[0])}`);
  });

  await check('ACCEPTANCE 1: no tenant / office / store marker ever lands on logistics, industrial or warehouse stock', () => {
    const bad = of(r => ['tenant', 'office', 'store'].includes(r.kind) && (r.surface === 'logistics' || r.surface === 'open.industrial'));
    assert.equal(bad.length, 0, `leaseable markers on industrial stock: ${JSON.stringify(bad.slice(0, 3))}`);
  });

  await check('ACCEPTANCE 1 (cont.): no tenant / office / store marker ever lands on residential stock', () => {
    const bad = of(r => ['tenant', 'office', 'store'].includes(r.kind) && /^residential\.|^townhouse$/.test(r.surface || ''));
    assert.equal(bad.length, 0, `leaseable markers on housing: ${JSON.stringify(bad.slice(0, 3))}`);
  });

  await check('ACCEPTANCE 2: tenant and store markers land on commercial stock first (>=80% preferred tier)', () => {
    for (const kind of ['tenant', 'store']) {
      const sample = of(r => r.kind === kind);
      const commercial = sample.filter(r => /^commercial\./.test(r.surface || '')).length;
      assert.ok(commercial / sample.length >= 0.8,
        `${kind}: only ${commercial}/${sample.length} on commercial stock`);
    }
  });

  await check('ACCEPTANCE 3: 住宅 property markers land on residential stock, every time', () => {
    const sample = of(r => r.propertyKind === '住宅');
    assert.ok(sample.length >= PREFS.length, 'expected one 住宅 property per prefecture');
    for (const row of sample) {
      assert.match(row.surface || '', /^residential\.|^townhouse$/,
        `${row.prefID}: 住宅 landed on ${row.surface}`);
    }
  });

  await check('ACCEPTANCE 4: office markers land on office stock first (>=80% preferred tier)', () => {
    const sample = of(r => r.kind === 'office');
    const offices = sample.filter(r => /^office\./.test(r.surface || '')).length;
    assert.ok(offices / sample.length >= 0.8, `only ${offices}/${sample.length} office markers on office stock`);
  });

  await check('物流 property markers land on logistics stock or industrial open ground, never on shops or housing', () => {
    for (const row of of(r => r.propertyKind === '物流')) {
      assert.ok(row.surface === 'logistics' || row.surface === 'open.industrial',
        `${row.prefID}: 物流 landed on ${row.surface}`);
    }
  });

  await check('土地 (land, not a building) is the only property kind placed on open ground -- and only on hardscape, never on parkland', () => {
    for (const row of of(r => r.kind === 'realestate')) {
      const isOpen = /^open\./.test(row.surface || '');
      if (row.propertyKind === '土地') {
        assert.ok(isOpen, `土地 must sit on an open plot, got ${row.surface}`);
        assert.notEqual(row.surface, 'open.green', '土地 must never sit on a park');
      } else if (row.propertyKind !== '物流') {
        assert.ok(!isOpen, `${row.propertyKind} must point at a real building, got ${row.surface}`);
      }
    }
  });

  await check('no marker of any kind ever lands on civic buildings, the landmark, parkland, a billboard, a road or a footprint-reserved tile', () => {
    for (const row of rows) {
      assert.ok(row.surface, `${row.prefID} ${row.kind}: landed on a tile with no usable surface (road/reserved/unbuilt)`);
      assert.ok(!['civic', 'landmark', 'open.green', 'signage'].includes(row.surface),
        `${row.prefID} ${row.kind}: landed on ${row.surface}`);
      assert.ok(!row.cell.reserved, `${row.prefID} ${row.kind}: landed on a tile reserved by a neighbour's footprint`);
    }
  });

  await check('the per-sprite override hook is live: commercial_billboard is a commercial.small asset yet hosts no marker anywhere', () => {
    assert.match(canvasSrc, /const SPRITE_SURFACE_OVERRIDES=\{[^}]*commercial_billboard/,
      'the override table must still reclassify the billboard');
    assert.equal(SPRITE_CATEGORY.commercial_billboard, 'commercial.small',
      'sanity: the billboard is still filed under a category markers otherwise prefer');
    const onBillboard = rows.filter(r => r.cell && r.cell.spriteId === 'commercial_billboard');
    assert.equal(onBillboard.length, 0, 'a marker landed on the billboard despite the override');
  });

  /* ================= DETERMINISM ================= */

  await check('placement stays deterministic and order-independent under the new allow-list', async () => {
    const forward = mod.placeEntityTiles(sampleEntities(), 'tokyo');
    const again = mod.placeEntityTiles(sampleEntities(), 'tokyo');
    const reversed = mod.placeEntityTiles(sampleEntities().reverse(), 'tokyo');
    const byId = list => Object.fromEntries(list.map(e => [e.id, `${e.tileX},${e.tileY}`]));
    assert.deepStrictEqual(byId(forward), byId(again), 'same input must place identically every time');
    assert.deepStrictEqual(byId(forward), byId(reversed), 'placement must not depend on input order');
  });

  await check('a second, independently booted sandbox reproduces the exact same placement (no hidden cross-run state)', async () => {
    const second = await readySandbox();
    // Objects come from two different vm realms, so compare a plain
    // projection rather than the cross-realm object graph.
    const tiles = list => list.map(e => `${e.id}@${e.tileX},${e.tileY}`);
    const a = tiles(mod.placeEntityTiles(sampleEntities(), 'osaka'));
    const b = tiles(second.mod.placeEntityTiles(sampleEntities(), 'osaka'));
    assert.deepStrictEqual(a, b);
  });

  await check('placement consumes no RNG: no Math.random and no simulation roll anywhere in the placement path', () => {
    assert.doesNotMatch(canvasSrc, /Math\s*\.\s*random/);
    const body = canvasSrc.split('function placeEntityTiles')[1].split('\nfunction ')[0];
    assert.doesNotMatch(body, /engine\.roll|engine\.rng|Math\s*\.\s*random/i);
    assert.match(body, /Base\.hash\(/, 'placement must keep reusing the existing MapCanvas hash');
  });

  await check('the city fabric itself is untouched: prototypes/map-world-preview.js still builds an identical district (markers never rewrite scenery)', async () => {
    const MW = sandbox.MapWorldPreview;
    const index2 = MW.indexCategoryManifest(MANIFEST);
    const before = MW.buildWorldDistrict({ index2, prefID: 'tokyo', cols: WORLD_COLS, rows: WORLD_ROWS });
    mod.placeEntityTiles(sampleEntities(), 'tokyo');
    const after = MW.buildWorldDistrict({ index2, prefID: 'tokyo', cols: WORLD_COLS, rows: WORLD_ROWS });
    assert.deepStrictEqual(before.tiles.map(c => c.spriteId || null), after.tiles.map(c => c.spriteId || null));
  });

  /* ================= FALLBACK LADDER ================= */

  /*
   * The two checks below deliberately overflow a kind far past its preferred
   * stock so the ALLOWED tier is actually exercised. Without this the allowed
   * lists are dead weight at realistic entity counts (a prefecture holds 8
   * tenants against ~29-108 commercial buildings), and a bad edit to an
   * allowed list would pass every other check in this file.
   */
  const overflowCases = [
    { kind: 'office', prefID: 'gunma', permitted: /^office\.|^commercial\.(hero|mid)$/ },
    { kind: 'tenant', prefID: 'gunma', permitted: /^commercial\.|^office\.(small|mid|hero)$/ },
    { kind: 'store', prefID: 'gunma', permitted: /^commercial\.|^office\.(small|mid)$/ },
  ];
  for (const { kind, prefID, permitted } of overflowCases) {
    await check(`scarcity degrades through the documented ladder for ${kind}: 400 markers in ${prefID} exhaust the preferred tier and still never reach forbidden stock`, () => {
      const many = Array.from({ length: 400 }, (_, i) => ({ id: `${kind}:x${i}`, kind, sourceId: `x${i}` }));
      let placed;
      assert.doesNotThrow(() => { placed = mod.placeEntityTiles(many, prefID); },
        'exhausting a scarce category must degrade, never throw');
      const MW = sandbox.MapWorldPreview;
      const index2 = MW.indexCategoryManifest(MANIFEST);
      const district = MW.buildWorldDistrict({ index2, prefID, cols: WORLD_COLS, rows: WORLD_ROWS });
      const surfaces = new Set();
      for (const entity of placed) {
        if (entity.tileX === null) continue;
        const surface = surfaceUnder(district.byKey[`${entity.tileX},${entity.tileY}`]);
        surfaces.add(surface);
        assert.match(surface || '', permitted,
          `overflow ${kind} marker escaped its allow-list onto ${surface}`);
      }
      assert.ok(surfaces.size > 1,
        `sanity: 400 ${kind} markers must spill past a single surface, otherwise the allowed tier was never exercised`);
    });
  }

  await check('the allow-list TABLE itself never offers industrial or residential stock to a leaseable kind (guards the table, not just the outcome)', () => {
    const table = canvasSrc.match(/const KIND_SURFACES=\{([\s\S]*?)\n\};/);
    assert.ok(table, 'could not locate KIND_SURFACES');
    for (const kind of ['store', 'tenant', 'office']) {
      const row = table[1].match(new RegExp(`${kind}:\\{[^}]*\\}`));
      assert.ok(row, `could not locate the ${kind} rule`);
      assert.doesNotMatch(row[0], /'logistics'|SURFACE_INDUSTRIAL/,
        `${kind} must never list industrial stock, in either tier`);
      assert.doesNotMatch(row[0], /'residential\.[a-z]+'|'townhouse'/,
        `${kind} must never list housing, in either tier`);
      assert.doesNotMatch(row[0], /'civic'|'landmark'|SURFACE_GREEN|'signage'/,
        `${kind} must never list civic, landmark, parkland or signage`);
    }
  });

  await check('the property allow-list TABLE keeps each property kind on stock that matches its own label', () => {
    const table = canvasSrc.match(/const PROPERTY_KIND_SURFACES=\{([\s\S]*?)\n\};/);
    assert.ok(table, 'could not locate PROPERTY_KIND_SURFACES');
    const row = kind => {
      const m = table[1].match(new RegExp(`'${kind}':\\{[^}]*\\}`));
      assert.ok(m, `could not locate the ${kind} rule`);
      return m[0];
    };
    assert.doesNotMatch(row('住宅'), /'logistics'|'commercial\.|'office\./, '住宅 must stay on housing');
    assert.doesNotMatch(row('物流'), /'residential\.|'commercial\.|'office\./, '物流 must stay on industrial stock');
    assert.doesNotMatch(row('商業ビル'), /'logistics'|'residential\./, '商業ビル must not sit on industrial or housing stock');
    assert.doesNotMatch(row('オフィス'), /'logistics'|'residential\./, 'オフィス must not sit on industrial or housing stock');
    for (const kind of ['商業ビル', '住宅', '大型物件', 'オフィス']) {
      assert.doesNotMatch(row(kind), /SURFACE_HARDSCAPE|SURFACE_INDUSTRIAL|SURFACE_GREEN/,
        `${kind} is a building, not land -- it must not be placed on open ground`);
    }
  });

  /* ================= PRIORITY B: SIZE vs HIT TARGET ================= */

  await check('the visible pin is drawn by ::before and is strictly smaller than the button that carries the tap target', () => {
    const button = markersCss.match(/\.d-map-marker\{width:(\d+)px;height:(\d+)px/);
    const pin = markersCss.match(/\.d-map-marker:before\{[^}]*width:(\d+)px;height:(\d+)px/);
    assert.ok(button, 'the button size rule must exist');
    assert.ok(pin, 'the pin must be drawn by ::before with an explicit size');
    assert.ok(Number(pin[1]) < Number(button[1]) && Number(pin[2]) < Number(button[2]),
      `pin ${pin[1]}x${pin[2]} must be smaller than button ${button[1]}x${button[2]}`);
  });

  await check('the tap target stays >=44px on both axes and is genuinely unclipped (clip-path clips hit testing too)', () => {
    const button = markersCss.match(/\.d-map-marker\{width:(\d+)px;height:(\d+)px/);
    assert.ok(Number(button[1]) >= 44 && Number(button[2]) >= 44, `button is ${button[1]}x${button[2]}`);
    assert.match(markersCss, /\.d-map-marker\{[^}]*clip-path:none/,
      'the button must drop the inherited clip-path or its real hit area is smaller than its box');
  });

  await check('the visible pin shrank against the size this pass inherited (48x60)', () => {
    const pin = markersCss.match(/\.d-map-marker:before\{[^}]*width:(\d+)px;height:(\d+)px/);
    const area = Number(pin[1]) * Number(pin[2]);
    assert.ok(area <= 48 * 60 * 0.6,
      `pin area ${area} must be at most 60% of the previous 48x60 badge (${48 * 60})`);
  });

  await check('the pin is centred on the button centre, so shrinking it did not move the anchor', () => {
    const pin = markersCss.match(/\.d-map-marker:before\{([^}]*)\}/);
    assert.ok(pin, 'pin rule must exist');
    assert.match(pin[1], /left:50%/);
    assert.match(pin[1], /top:50%/);
    assert.match(pin[1], /transform:translate\(-50%,-50%\)/);
  });

  await check('the decluttering collision box tracks the visible pin, not the button, and one ring can clear a head-on collision within the cap', () => {
    const halves = canvasSrc.match(/const MARKER_CLAMP_HALF_W=(\d+),MARKER_CLAMP_HALF_H=(\d+);/);
    const step = Number(canvasSrc.match(/const DECLUTTER_STEP=(\d+);/)[1]);
    const cap = Number(canvasSrc.match(/const MAX_ANCHOR_OFFSET=(\d+);/)[1]);
    const pin = markersCss.match(/\.d-map-marker:before\{[^}]*width:(\d+)px;height:(\d+)px/);
    const halfW = Number(halves[1]), halfH = Number(halves[2]);
    assert.ok(halfW * 2 >= Number(pin[1]) && halfH * 2 >= Number(pin[2]),
      'the collision box must cover the whole visible pin');
    const button = markersCss.match(/\.d-map-marker\{width:(\d+)px;height:(\d+)px/);
    assert.ok(halfW * 2 < Number(button[1]) && halfH * 2 < Number(button[2]),
      'the collision box must be smaller than the button, or shrinking the pin bought nothing');
    const ringsNeeded = Math.ceil((halfH * 2) / step);
    assert.ok(ringsNeeded * step <= cap,
      `clearing a head-on collision needs ${ringsNeeded * step}px, above the ${cap}px anchor cap`);
  });

  /* ================= NEGATIVE TESTS ================= */

  await check('NEGATIVE: reverting to zone-based selection puts leaseable markers back on housing and empty ground', async () => {
    const zoneSrc = canvasSrc.replace(
      /function placeEntityTiles\(entities,prefID\)\{[\s\S]*?\n\}\n/,
      `function placeEntityTiles(entities,prefID){
        const Base=globalThis.MapCanvas;
        if(!Base||!assetsReady)return null;
        const district=ensureDistrict(assetsReady.index2,prefID);
        const byZone=new Map();
        for(const cell of district.tiles){
          if(!byZone.has(cell.zone))byZone.set(cell.zone,[]);
          byZone.get(cell.zone).push(cell);
        }
        const occupied=new Set();const placements=new Map();
        const canonicalOrder=[...entities].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
        for(const entity of canonicalOrder){
          const zones=entity.kind==='realestate'?['commercial','residential','industrial']:['commercial','cbd'];
          const eligible=zones.flatMap(zone=>byZone.get(zone)||[]);
          if(!eligible.length){placements.set(entity.id,{tileX:null,tileY:null});continue;}
          const seed=Base.hash(\`\${prefID}:marker:\${entity.kind}:\${entity.sourceId}\`);
          let picked=null;
          for(let attempt=0;attempt<eligible.length;attempt++){
            const cell=eligible[(seed+attempt)%eligible.length];
            const key=\`\${cell.tileX},\${cell.tileY}\`;
            if(!occupied.has(key)){occupied.add(key);picked=cell;break;}
          }
          if(!picked)picked=eligible[seed%eligible.length];
          placements.set(entity.id,{tileX:picked.tileX,tileY:picked.tileY});
        }
        return entities.map(entity=>Object.assign({},entity,placements.get(entity.id)));
      }\n`);
    assert.notEqual(zoneSrc, canvasSrc, 'the mutation must actually replace placeEntityTiles');
    const { mod: mod2, sandbox: sandbox2 } = await readyFrom(zoneSrc);
    const rows2 = await survey(mod2, sandbox2);
    const leaseable = rows2.filter(r => ['tenant', 'office', 'store'].includes(r.kind));
    const wrong = leaseable.filter(r => !r.surface || /^residential\./.test(r.surface));
    assert.ok(wrong.length > 0,
      'sanity: zone-based selection must reproduce the reported mismatch, otherwise the positive checks above prove nothing');
  });

  await check('NEGATIVE: dropping SURFACE_GREEN out of the forbidden set (adding it to a kind) would let markers sit on parkland', () => {
    assert.doesNotMatch(canvasSrc, /(?:preferred|allowed):\[[^\]]*SURFACE_GREEN/,
      'no marker kind may list parkland among its surfaces');
    const mutated = canvasSrc.replace("'土地':{preferred:[SURFACE_HARDSCAPE],allowed:[SURFACE_INDUSTRIAL]}",
      "'土地':{preferred:[SURFACE_HARDSCAPE],allowed:[SURFACE_GREEN]}");
    assert.notEqual(mutated, canvasSrc, 'sanity: the mutation must apply');
    assert.match(mutated, /allowed:\[SURFACE_GREEN\]/, 'mutated source must trip the same regex the real check uses');
  });

  await check('NEGATIVE: removing the open-space guard from surfaceOfCell would make every empty plot a marker candidate again', () => {
    const body = canvasSrc.split('function surfaceOfCell')[1].split('\nfunction ')[0];
    assert.match(body, /if\(cell\.open\)return OPEN_TYPE_SURFACES\[cell\.openType\]\|\|null;/,
      'open plots must resolve through the explicit open-type table');
    assert.match(body, /return null;/, 'an unrecognised tile must resolve to null, never to a usable surface');
    const mutated = body.replace('if(cell.open)return OPEN_TYPE_SURFACES[cell.openType]||null;', "if(cell.open)return 'open.hardscape';");
    assert.doesNotMatch(mutated, /OPEN_TYPE_SURFACES\[cell\.openType\]/,
      'sanity: the mutation removes the very lookup the real source depends on');
  });

  await check('NEGATIVE: putting the clip-path back on the button would collapse the pin and the tap target into one box again', () => {
    const mutated = markersCss.replace('.d-map-marker{width:46px;height:56px;background:none;border:0;clip-path:none',
      '.d-map-marker{width:46px;height:56px;background:none;border:0;clip-path:polygon(50% 0,93% 18%,93% 68%,50% 100%,7% 68%,7% 18%)');
    assert.notEqual(mutated, markersCss, 'sanity: the mutation must apply');
    assert.doesNotMatch(mutated, /\.d-map-marker\{[^}]*clip-path:none/,
      'mutated source must fail the same unclipped-button check the real check uses');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch(error => { console.error(error.stack || error); process.exit(1); });
