'use strict';
/*
 * Phase 1 map renderer foundation: Canvas 2D static city + sprite blitting.
 *
 * POLICY (the whole point of this file):
 *   Buildings are NEVER drawn by this code. Building artwork is authored
 *   outside the repository and dropped into assets/map-sprites/<set>/ as PNG.
 *   This module only positions, orders and blits those images. When a sprite
 *   file is absent it draws an obvious development placeholder -- never a
 *   stand-in building -- so a missing asset can't quietly become the art.
 *
 * What this module owns:
 *   - the isometric transform (tile <-> screen) and anchor model
 *   - the sprite manifest schema check and loader/cache
 *   - deterministic sprite selection (pure hash; no RNG of any kind)
 *   - draw ordering (depth), terrain/road/park painting
 *   - an offscreen city cache keyed by prefecture + visual state, so changing
 *     the selected marker repaints the overlay only
 *   - screen coordinates for the DOM/SVG interactive overlay
 *
 * Not loaded by index.html: the shipped boot path is untouched.
 */

(function (root) {
  /* ---------------- deterministic hash (FNV-1a) ---------------- */
  /* The only source of variation in this file. No RNG, no engine state. */
  function hash(text) {
    let value = 2166136261;
    for (const char of String(text)) {
      value ^= char.codePointAt(0);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  /* ---------------- manifest ---------------- */
  const SCALE_CLASSES = new Set(['xs', 's', 'm', 'l', 'xl', 'landmark']);

  /*
   * Returns { ok, errors, sprites }. An invalid entry is dropped rather than
   * throwing, so one bad row cannot take the whole map down; a structurally
   * invalid manifest (not an object, no sprite array) is rejected outright.
   */
  /* the renderer owns tile geometry; an asset package need not declare it */
  const DEFAULT_TILE = { w: 64, h: 32 };

  function validateManifest(manifest) {
    const errors = [];
    if (!manifest || typeof manifest !== 'object') {
      return { ok: false, errors: ['manifest must be an object'], sprites: [] };
    }
    if (!Array.isArray(manifest.sprites)) {
      return { ok: false, errors: ['manifest.sprites must be an array'], sprites: [] };
    }
    const tile = manifest.tile || DEFAULT_TILE;
    if (!(tile.w > 0) || !(tile.h > 0)) {
      return { ok: false, errors: ['manifest.tile must declare positive w/h when present'], sprites: [] };
    }
    const seen = new Set();
    const sprites = [];
    for (const sprite of manifest.sprites) {
      const id = sprite && sprite.id;
      const label = id || '(missing id)';
      if (!id || typeof id !== 'string') { errors.push(`${label}: id must be a non-empty string`); continue; }
      if (seen.has(id)) { errors.push(`${label}: duplicate id`); continue; }
      if (!sprite.file || typeof sprite.file !== 'string') { errors.push(`${label}: file must be a string`); continue; }
      if (/[\\]|\.\.|^\//.test(sprite.file) || /^[a-z]+:/i.test(sprite.file)) {
        errors.push(`${label}: file must be a plain local filename`); continue;
      }
      if (!sprite.category || typeof sprite.category !== 'string') { errors.push(`${label}: category is required`); continue; }
      /* accept either `zone` (Phase 1's own convention) or `zones` (the
         asset pipeline's convention); normalise to `zone` everywhere else */
      const zoneList = Array.isArray(sprite.zone) ? sprite.zone : Array.isArray(sprite.zones) ? sprite.zones : null;
      if (!zoneList || !zoneList.length) { errors.push(`${label}: zone/zones must be a non-empty array`); continue; }
      const anchor = sprite.anchor;
      if (!anchor || !(anchor.x >= 0 && anchor.x <= 1) || !(anchor.y >= 0 && anchor.y <= 1)) {
        errors.push(`${label}: anchor x/y must be 0..1 fractions of the image`); continue;
      }
      const footprint = sprite.footprint || { w: 1, h: 1 };
      if (!(footprint.w > 0) || !(footprint.h > 0)) { errors.push(`${label}: footprint must be positive`); continue; }
      if (sprite.scaleClass && !SCALE_CLASSES.has(sprite.scaleClass)) {
        errors.push(`${label}: unknown scaleClass ${sprite.scaleClass}`); continue;
      }
      const weight = sprite.weight === undefined ? 1 : sprite.weight;
      if (!(weight > 0)) { errors.push(`${label}: weight must be positive`); continue; }
      seen.add(id);
      sprites.push(Object.assign({}, sprite, { zone: zoneList, footprint, weight }));
    }
    return { ok: errors.length === 0, errors, sprites };
  }

  function indexManifest(manifest) {
    const { ok, errors, sprites } = validateManifest(manifest);
    const byId = {};
    const byZone = {};
    for (const sprite of sprites) {
      byId[sprite.id] = sprite;
      for (const zone of sprite.zone) (byZone[zone] = byZone[zone] || []).push(sprite);
    }
    for (const zone of Object.keys(byZone)) byZone[zone].sort((a, b) => a.id.localeCompare(b.id));
    return {
      ok, errors, sprites, byId, byZone,
      tile: (manifest && manifest.tile) || DEFAULT_TILE,
      set: (manifest && manifest.set) || (manifest && manifest.phase) || 'phase1'
    };
  }

  /* ---------------- deterministic sprite selection ---------------- */
  /*
   * Pure function of the inputs. The same tile in the same prefecture always
   * resolves to the same sprite id, across reloads and across devices.
   * `grade` narrows the pool when the caller knows it; otherwise the whole
   * zone pool is used.
   */
  function selectMapSprite(options) {
    const index = options.index;
    const zone = options.zoneType;
    if (!index || !zone) return null;
    let pool = index.byZone[zone] || [];
    if (options.grade) {
      const graded = pool.filter(s => Array.isArray(s.grade) && s.grade.includes(options.grade));
      if (graded.length) pool = graded;
    }
    if (options.useType) {
      const scoped = pool.filter(s => s.category === options.useType);
      if (scoped.length) pool = scoped;
    }
    if (!pool.length) return null;
    /* avoid repeating a sprite that already sits nearby -- but only when
       candidates remain after excluding it; with as few as one archetype in
       a category (industrial today), forcing variety is impossible and the
       exclusion must not empty the pool */
    if (options.excludeIds && options.excludeIds.size) {
      const varied = pool.filter(s => !options.excludeIds.has(s.id));
      if (varied.length) pool = varied;
    }
    const key = [
      options.prefID || 'unknown', zone, options.useType || '-', options.grade || '-',
      options.stableId || '-', options.tileX, options.tileY
    ].join(':');
    const total = pool.reduce((sum, sprite) => sum + sprite.weight, 0);
    let roll = hash(key) % total;
    for (const sprite of pool) {
      if (roll < sprite.weight) return sprite.id;
      roll -= sprite.weight;
    }
    return pool[pool.length - 1].id;
  }

  /* ---------------- isometric transform ---------------- */
  /*
   * screenX = originX + (tileX - tileY) * tileW / 2
   * screenY = originY + (tileX + tileY) * tileH / 2
   * `scale` is applied by the caller through the canvas transform, so the
   * numbers here stay in authoring space and sprites are never resampled by
   * arithmetic in this module.
   */
  function createTransform(options) {
    const tileW = options.tileW;
    const tileH = options.tileH;
    const originX = options.originX;
    const originY = options.originY;
    const scale = options.scale === undefined ? 1 : options.scale;
    return {
      tileW, tileH, originX, originY, scale,
      toScreen(tileX, tileY) {
        return [originX + (tileX - tileY) * (tileW / 2), originY + (tileX + tileY) * (tileH / 2)];
      },
      toTile(screenX, screenY) {
        const dx = (screenX - originX) / (tileW / 2);
        const dy = (screenY - originY) / (tileH / 2);
        return [(dy + dx) / 2, (dy - dx) / 2];
      },
      /* screen position in CSS pixels, for placing DOM overlay elements */
      toCss(tileX, tileY) {
        const [x, y] = this.toScreen(tileX, tileY);
        return [x * scale, y * scale];
      }
    };
  }

  /*
   * Fits a district into the given CSS box. The scale is uniform so the
   * artwork keeps its authored proportions; the caller folds it into the
   * canvas transform.
   */
  function fitTransform(district, cssWidth, cssHeight, tile, headroom) {
    const diagonal = district.cols + district.rowsCount;
    const naturalWidth = diagonal * (tile.w / 2) + 32;
    const naturalHeight = diagonal * (tile.h / 2) + (headroom === undefined ? 240 : headroom);
    const scale = Math.min(cssWidth / naturalWidth, cssHeight / naturalHeight, 1);
    const spaceWidth = cssWidth / scale;
    const spaceHeight = cssHeight / scale;
    return createTransform({
      tileW: tile.w,
      tileH: tile.h,
      originX: spaceWidth / 2 + (district.rowsCount - district.cols) * (tile.w / 4),
      originY: spaceHeight - 20 - (diagonal - 2) * (tile.h / 2),
      scale
    });
  }

  /* ---------------- sprite loading / cache ---------------- */
  /*
   * Loads every sprite listed in the manifest. Individual failures are
   * collected rather than thrown, so one 404 leaves the rest of the city and
   * the whole interactive overlay working.
   */
  function loadSprites(index, basePath, options) {
    const settings = options || {};
    const ImageCtor = settings.Image || (typeof Image !== 'undefined' ? Image : null);
    if (!ImageCtor) return Promise.resolve({ images: {}, failed: index.sprites.map(s => s.id), loaded: [] });
    const images = {};
    const failed = [];
    const loaded = [];
    const jobs = index.sprites.map(sprite => new Promise(resolve => {
      const image = new ImageCtor();
      const done = ok => {
        if (ok) { images[sprite.id] = image; loaded.push(sprite.id); } else { failed.push(sprite.id); }
        if (settings.onProgress) settings.onProgress(loaded.length + failed.length, index.sprites.length);
        resolve();
      };
      image.onload = () => {
        if (typeof image.decode === 'function') image.decode().then(() => done(true), () => done(true));
        else done(true);
      };
      image.onerror = () => done(false);
      image.src = `${basePath}/${sprite.file}`;
    }));
    return Promise.all(jobs).then(() => ({ images, failed, loaded }));
  }

  /* ---------------- terrain / ground painting (daytime) ---------------- */
  const GROUND = {
    road: '#8e959c',
    intersection: '#969da4',
    cbd: '#b7b9b4',
    commercial: '#bcb9b2',
    residential: '#b9beb4',
    industrial: '#b0b3b2',
    park: '#7fa863',
    water: '#7fb0cb',
    landmark: '#b8bab5',
    plaza: '#c4c3bc'
  };
  const KERB = '#cdcdc6';
  const SIDEWALK = '#dad9d3';
  const SECONDARY_ROAD_WIDTH = 0.52;
  const PLAZA_PAVING = 'rgba(255,255,255,.28)';

  function tilePath(ctx, x, y, tile, inflate) {
    const hw = (tile.w / 2) * (inflate || 1);
    const hh = (tile.h / 2) * (inflate || 1);
    ctx.beginPath();
    ctx.moveTo(x, y - hh);
    ctx.lineTo(x + hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x - hw, y);
    ctx.closePath();
  }

  function paintTerrain(ctx, district, transform, tile) {
    for (const cell of district.tiles) {
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      tilePath(ctx, x, y, tile, 1.02);
      ctx.fillStyle = GROUND[cell.zone] || GROUND.plaza;
      ctx.fill();
      if (cell.zone === 'water') {
        ctx.strokeStyle = 'rgba(255,255,255,.32)';
        ctx.lineWidth = 1.1;
        if (hash(`${district.prefID}:wave:${cell.tileX}:${cell.tileY}`) % 3 === 0) {
          ctx.beginPath();
          ctx.moveTo(x - 11, y + 3);
          ctx.lineTo(x + 9, y + 3);
          ctx.stroke();
        }
      }
      /* a deliberately-open buildable plot reads as a small paved plaza
         rather than bare zone-coloured ground: a light paving lattice,
         Canvas primitives only */
      if (cell.open) {
        ctx.strokeStyle = PLAZA_PAVING;
        ctx.lineWidth = 1;
        for (const [ax, ay, bx, by] of [
          [x - tile.w * 0.28, y, x, y - tile.h * 0.28],
          [x, y - tile.h * 0.28, x + tile.w * 0.28, y],
          [x + tile.w * 0.28, y, x, y + tile.h * 0.28],
          [x, y + tile.h * 0.28, x - tile.w * 0.28, y]
        ]) {
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
      }
    }
    /* sidewalk: a light inset edge on the building side of every lot that
       faces a road, separating "street" from "lot" without extra tiles */
    for (const cell of district.tiles) {
      if (!BUILDABLE.has(cell.zone)) continue;
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      const edges = [
        [cell.tileX + 1, cell.tileY, [x + tile.w / 2, y], [x, y + tile.h / 2]],
        [cell.tileX, cell.tileY + 1, [x, y + tile.h / 2], [x - tile.w / 2, y]],
        [cell.tileX - 1, cell.tileY, [x - tile.w / 2, y], [x, y - tile.h / 2]],
        [cell.tileX, cell.tileY - 1, [x, y - tile.h / 2], [x + tile.w / 2, y]]
      ];
      ctx.strokeStyle = SIDEWALK;
      ctx.lineWidth = 3;
      for (const [nx, ny, a, b] of edges) {
        const neighbour = district.byKey[`${nx},${ny}`];
        if (!neighbour || neighbour.zone !== 'road') continue;
        const inset = 0.86;
        ctx.beginPath();
        ctx.moveTo(x + (a[0] - x) * inset, y + (a[1] - y) * inset);
        ctx.lineTo(x + (b[0] - x) * inset, y + (b[1] - y) * inset);
        ctx.stroke();
      }
    }
  }

  function paintRoads(ctx, district, transform, tile) {
    const at = (tx, ty) => {
      const cell = district.byKey[`${tx},${ty}`];
      return cell ? cell.zone : null;
    };
    for (const cell of district.tiles) {
      if (cell.zone !== 'road') continue;
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      const w = cell.roadPrimary ? 1 : SECONDARY_ROAD_WIDTH;
      /* a secondary street repaints a narrower carriageway over the tile;
         the tile's own ground fill (SIDEWALK-adjacent building colour)
         already shows through as the shoulder, widening the perceived
         sidewalk without adding tiles */
      if (!cell.roadPrimary) {
        tilePath(ctx, x, y, tile, SECONDARY_ROAD_WIDTH);
        ctx.fillStyle = GROUND.road;
        ctx.fill();
      }
      /* kerb along edges that face a block, so streets read as streets */
      const neighbours = [
        [cell.tileX + 1, cell.tileY, [x + tile.w / 2, y], [x, y + tile.h / 2]],
        [cell.tileX, cell.tileY + 1, [x, y + tile.h / 2], [x - tile.w / 2, y]],
        [cell.tileX - 1, cell.tileY, [x - tile.w / 2, y], [x, y - tile.h / 2]],
        [cell.tileX, cell.tileY - 1, [x, y - tile.h / 2], [x + tile.w / 2, y]]
      ];
      ctx.strokeStyle = KERB;
      ctx.lineWidth = 2.4;
      for (const [nx, ny, a, b] of neighbours) {
        const zone = at(nx, ny);
        if (zone === 'road' || zone === null) continue;
        const ia = [x + (a[0] - x) * w, y + (a[1] - y) * w];
        const ib = [x + (b[0] - x) * w, y + (b[1] - y) * w];
        ctx.beginPath();
        ctx.moveTo(ia[0], ia[1]);
        ctx.lineTo(ib[0], ib[1]);
        ctx.stroke();
      }
      const alongX = at(cell.tileX - 1, cell.tileY) === 'road' || at(cell.tileX + 1, cell.tileY) === 'road';
      const alongY = at(cell.tileX, cell.tileY - 1) === 'road' || at(cell.tileX, cell.tileY + 1) === 'road';
      /* only primary avenues get a dashed centre line; a secondary street
         reads as a narrow local lane instead */
      if (cell.roadPrimary) {
        ctx.strokeStyle = 'rgba(255,255,255,.72)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 7]);
        if (alongX && !alongY) {
          ctx.beginPath(); ctx.moveTo(x - tile.w / 2, y - tile.h / 2); ctx.lineTo(x + tile.w / 2, y + tile.h / 2); ctx.stroke();
        } else if (alongY && !alongX) {
          ctx.beginPath(); ctx.moveTo(x + tile.w / 2, y - tile.h / 2); ctx.lineTo(x - tile.w / 2, y + tile.h / 2); ctx.stroke();
        }
        ctx.setLineDash([]);
      }
    }
  }

  function paintGreenery(ctx, district, transform) {
    for (const cell of district.tiles) {
      if (cell.zone !== 'park') continue;
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      const count = 2 + hash(`${district.prefID}:trees:${cell.tileX}:${cell.tileY}`) % 3;
      for (let i = 0; i < count; i++) {
        const seed = hash(`${district.prefID}:tree:${cell.tileX}:${cell.tileY}:${i}`);
        const tx = x + ((seed % 30) - 15);
        const ty = y + (((seed >>> 5) % 14) - 7);
        ctx.fillStyle = 'rgba(40,60,35,.20)';
        ctx.beginPath(); ctx.ellipse(tx + 2, ty + 2, 7, 3.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4d7a3a';
        ctx.beginPath(); ctx.ellipse(tx - 2, ty - 7, 6, 5.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5d9046';
        ctx.beginPath(); ctx.ellipse(tx + 2, ty - 10, 6.2, 5.6, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  /* ---------------- placeholders ---------------- */
  /*
   * DEVELOPMENT ONLY. Deliberately reads as a marked-up plot, not as a
   * building: a flat hatched footprint plus the sprite id. If this ever
   * starts looking like architecture, it has drifted from its purpose.
   */
  function drawPlaceholder(ctx, x, y, tile, spriteId, label) {
    tilePath(ctx, x, y, tile, 0.86);
    ctx.fillStyle = 'rgba(124,92,255,.13)';
    ctx.fill();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(124,92,255,.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
    if (label !== false) {
      ctx.fillStyle = 'rgba(40,30,80,.9)';
      ctx.font = '7px ui-monospace,SFMono-Regular,Menlo,monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(spriteId || 'missing').slice(0, 22), x, y + 2);
      ctx.textAlign = 'start';
    }
  }

  /* ---------------- sprite pass ---------------- */
  /*
   * Painter's algorithm over depth = tileX + tileY, so a tall tower never
   * sits in front of a block that is nearer the camera. Ties break on tileX
   * to keep the order stable between runs.
   */
  function depthSorted(district) {
    return district.tiles
      .filter(cell => cell.spriteId || cell.expectsBuilding)
      .slice()
      .sort((a, b) => (a.tileX + a.tileY) - (b.tileX + b.tileY) || a.tileX - b.tileX);
  }

  /*
   * How wide a 1x1-footprint sprite renders relative to its tile. Real
   * building art is drawn with roofline overhang and perspective splay, so a
   * building is meant to run wider than its bare footprint diamond -- this
   * is the tuned amount of that overhang, not a retina/DPR concern.
   * Tuned against the Tokyo mini district screenshots (see
   * docs/map-phase1-canvas-foundation.md); adjust here, not per-sprite.
   */
  const SPRITE_WIDTH_FACTOR = 1.62;
  /* the Tokyo Tower landmark sprite is drawn larger than ordinary buildings
     so it reads as a skyline anchor from the default view */
  const LANDMARK_SCALE_BONUS = 1.3;
  /* cheap contact shadow so a sprite's base doesn't look like it is floating
     above the ground plane -- a single translucent ellipse, no blur/filter */
  const SHADOW_FILL = 'rgba(20,24,20,.22)';

  function spriteRenderSize(image, meta, tile, widthFactor, scaleVariant) {
    const footprint = meta.footprint || { w: 1, h: 1 };
    const variant = scaleVariant || 1;
    const landmarkBonus = meta.category === 'landmark' ? LANDMARK_SCALE_BONUS : 1;
    const targetWidth = footprint.w * tile.w * widthFactor * variant * landmarkBonus;
    const naturalAspect = (image.height && image.width) ? image.height / image.width : 1;
    return { width: targetWidth, height: targetWidth * naturalAspect };
  }

  function paintContactShadow(ctx, x, y, meta, width) {
    const footprint = meta.footprint || { w: 1, h: 1 };
    const rx = width * 0.24 * Math.max(1, footprint.w * 0.72);
    const ry = rx * 0.34;
    ctx.fillStyle = SHADOW_FILL;
    ctx.beginPath();
    ctx.ellipse(x, y + ry * 0.15, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function blitSprites(ctx, district, transform, images, index, options) {
    const settings = options || {};
    const tile = index.tile;
    const widthFactor = settings.spriteWidthFactor || SPRITE_WIDTH_FACTOR;
    let blitted = 0;
    let placeholders = 0;
    for (const cell of depthSorted(district)) {
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      const meta = cell.spriteId ? index.byId[cell.spriteId] : null;
      const image = meta && images[meta.id];
      if (!meta || !image || !image.width) {
        if (settings.showPlaceholders !== false) {
          drawPlaceholder(ctx, x, y, tile, cell.spriteId, settings.placeholderLabels);
          placeholders++;
        }
        continue;
      }
      /* anchor is a fraction of the (rendered) image; it marks the tile's
         ground point, independent of the image's native pixel size */
      const { width, height } = spriteRenderSize(image, meta, tile, widthFactor, cell.scaleVariant);
      if (settings.showShadows !== false) {
        paintContactShadow(ctx, x, y, meta, width);
      }
      ctx.drawImage(image, x - width * meta.anchor.x, y - height * meta.anchor.y, width, height);
      blitted++;
    }
    return { blitted, placeholders };
  }

  /* ---------------- district model ---------------- */
  const ZONE_OF = {
    '.': 'road', C: 'cbd', M: 'commercial', R: 'residential',
    L: 'industrial', P: 'park', W: 'water', X: 'landmark', ' ': 'plaza'
  };
  const ZONE_LABEL = {
    cbd: 'CBD・中心業務地区', commercial: '商業・繁華街', residential: '住宅街',
    industrial: '臨海・物流', park: '公園', water: '運河', landmark: 'ランドマーク',
    road: '街路', plaza: '広場'
  };
  const ZONE_USE = { cbd: 'office', commercial: 'commercial', residential: 'residential', industrial: 'industrial', landmark: 'landmark' };
  const BUILDABLE = new Set(['cbd', 'commercial', 'residential', 'industrial', 'landmark']);
  /* share of buildable plots deliberately left open, so blocks are not fully
     solid -- kept low so the district reads as continuous rather than
     island-like, per the Tokyo daytime visual target */
  const OPEN_RATE = { cbd: 4, commercial: 5, residential: 6, industrial: 8, landmark: 0 };
  /* how many tiles out a sprite id is considered "nearby" for the
     no-repeat-adjacent rule (Chebyshev distance, i.e. a square neighbourhood) */
  const NO_REPEAT_RADIUS = 2;
  /* small, deterministic per-plot scale jitter so identical sprites don't
     read as perfectly uniform copies; never distorts aspect ratio */
  const SCALE_VARIANTS = [0.94, 1.0, 1.06];

  /*
   * Builds the tile model for a layout. Placement is data-driven: the caller
   * supplies rows of zone characters, and every buildable plot resolves a
   * sprite id deterministically. `expectsBuilding` marks plots that should
   * carry artwork, so a missing file still renders a placeholder in the right
   * spot instead of a hole.
   *
   * A sprite with a footprint larger than 1x1 reserves the extra tiles it
   * needs (toward +tileX/+tileY, so the reservation only ever touches cells
   * this row-major scan has not assigned yet). A reserved cell renders as
   * plain ground -- the large sprite is drawn once, from its origin tile,
   * covering the visual space of the whole footprint.
   */
  /* Sprite ids already placed within `radius` tiles (Chebyshev) of (tileX,tileY),
     scanning only cells the row-major pass has already resolved -- this stays a
     pure function of already-committed state, so placement order never depends
     on tiles not yet visited. */
  function nearbySpriteIds(byKey, tileX, tileY, radius) {
    const ids = new Set();
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const neighbour = byKey[`${tileX + dx},${tileY + dy}`];
        if (neighbour && neighbour.spriteId) ids.add(neighbour.spriteId);
      }
    }
    return ids;
  }

  /*
   * A road tile is a "primary" avenue when it belongs to a road run that
   * spans the full width or height of the district (the boulevards that
   * separate whole bands of the layout); any other road tile is a narrower
   * "secondary" street. Purely geometric, computed once from the authored
   * layout -- no randomness involved.
   */
  function classifyRoads(rows, byKey) {
    const primaryRows = new Set();
    for (let y = 0; y < rows.length; y++) {
      if ([...rows[y]].every(ch => ZONE_OF[ch] === 'road')) primaryRows.add(y);
    }
    const primaryCols = new Set();
    for (let x = 0; x < rows[0].length; x++) {
      if (rows.every(row => ZONE_OF[row[x]] === 'road')) primaryCols.add(x);
    }
    for (const key of Object.keys(byKey)) {
      const cell = byKey[key];
      if (cell.zone !== 'road') continue;
      cell.roadPrimary = primaryRows.has(cell.tileY) || primaryCols.has(cell.tileX);
    }
  }

  function buildDistrict(options) {
    const rows = options.layout;
    const index = options.index;
    const prefID = options.prefID;
    const tiles = [];
    const byKey = {};
    for (let tileY = 0; tileY < rows.length; tileY++) {
      for (let tileX = 0; tileX < rows[tileY].length; tileX++) {
        const zone = ZONE_OF[rows[tileY][tileX]] || 'plaza';
        const cell = { tileX, tileY, zone, zoneLabel: ZONE_LABEL[zone], use: ZONE_USE[zone] || null };
        tiles.push(cell);
        byKey[`${tileX},${tileY}`] = cell;
      }
    }
    classifyRoads(rows, byKey);
    for (const cell of tiles) {
      if (!BUILDABLE.has(cell.zone) || cell.reserved) continue;
      const isSecondaryLandmarkPlot = cell.zone === 'landmark' &&
        ((rows[cell.tileY - 1] && rows[cell.tileY - 1][cell.tileX] === 'X') || rows[cell.tileY][cell.tileX - 1] === 'X');
      const open = cell.zone !== 'landmark' &&
        hash(`${prefID}:open:${cell.tileX}:${cell.tileY}`) % 100 < (OPEN_RATE[cell.zone] || 0);
      if (isSecondaryLandmarkPlot || open) { cell.open = true; continue; }
      cell.expectsBuilding = true;
      cell.spriteId = selectMapSprite({
        index, prefID, zoneType: cell.zone, useType: ZONE_USE[cell.zone],
        tileX: cell.tileX, tileY: cell.tileY,
        stableId: options.stableIds && options.stableIds[`${cell.tileX},${cell.tileY}`],
        excludeIds: nearbySpriteIds(byKey, cell.tileX, cell.tileY, NO_REPEAT_RADIUS)
      });
      cell.scaleVariant = SCALE_VARIANTS[hash(`${prefID}:scale:${cell.tileX}:${cell.tileY}`) % SCALE_VARIANTS.length];
      const meta = cell.spriteId && index.byId[cell.spriteId];
      const footprint = meta && meta.footprint;
      if (footprint && (footprint.w > 1 || footprint.h > 1)) {
        const claim = [];
        let fits = true;
        for (let dy = 0; dy < footprint.h && fits; dy++) {
          for (let dx = 0; dx < footprint.w && fits; dx++) {
            if (dx === 0 && dy === 0) continue;
            const neighbour = byKey[`${cell.tileX + dx},${cell.tileY + dy}`];
            if (!neighbour || neighbour.zone !== cell.zone || neighbour.reserved || BUILDABLE.has(neighbour.zone) === false) {
              fits = false;
              break;
            }
            claim.push(neighbour);
          }
        }
        if (fits) {
          for (const neighbour of claim) { neighbour.reserved = true; neighbour.occupiedBy = { tileX: cell.tileX, tileY: cell.tileY }; }
          cell.footprint = footprint;
        }
        /* not enough room to reserve the full footprint: the sprite is
           still drawn from this one tile (blitSprites always sizes it from
           its own footprint), it just isn't given exclusive neighbours --
           an edge-of-district compromise, not a placement bug. */
      }
    }
    return {
      prefID, tiles, byKey,
      layout: rows,
      cols: rows[0].length,
      rowsCount: rows.length
    };
  }

  /* ---------------- static city layer with an offscreen cache ---------------- */
  /*
   * The city is expensive relative to the overlay, and it only depends on the
   * prefecture, the layout and the view box -- not on which marker is
   * selected. Caching on that key is what stops a marker tap from repainting
   * the whole city.
   */
  function createCityLayer() {
    let cacheCanvas = null;
    let cacheKey = null;
    let stats = { blitted: 0, placeholders: 0, buildMs: 0, cacheHits: 0, cacheMisses: 0 };

    function keyFor(district, transform, index, dpr, images) {
      return [
        district.prefID, district.cols, district.rowsCount,
        transform.scale.toFixed(4), transform.originX.toFixed(2), transform.originY.toFixed(2),
        dpr, index.set, Object.keys(images).length
      ].join('|');
    }

    return {
      stats,
      invalidate() { cacheKey = null; },
      /* Paints the city, reusing the offscreen cache when nothing visual changed. */
      present(ctx, district, transform, images, index, options) {
        const settings = options || {};
        const dpr = settings.dpr || 1;
        const cssWidth = settings.cssWidth;
        const cssHeight = settings.cssHeight;
        const key = keyFor(district, transform, index, dpr, images);
        if (key !== cacheKey) {
          const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          const factory = settings.createCanvas;
          cacheCanvas = factory ? factory(Math.round(cssWidth * dpr), Math.round(cssHeight * dpr)) : null;
          const target = cacheCanvas ? cacheCanvas.getContext('2d') : ctx;
          target.setTransform(dpr, 0, 0, dpr, 0, 0);
          target.clearRect(0, 0, cssWidth, cssHeight);
          if (settings.sky) { target.fillStyle = settings.sky; target.fillRect(0, 0, cssWidth, cssHeight); }
          target.setTransform(dpr * transform.scale, 0, 0, dpr * transform.scale, 0, 0);
          paintTerrain(target, district, transform, index.tile);
          paintRoads(target, district, transform, index.tile);
          paintGreenery(target, district, transform);
          const result = blitSprites(target, district, transform, images, index, settings);
          target.setTransform(1, 0, 0, 1, 0, 0);
          stats.blitted = result.blitted;
          stats.placeholders = result.placeholders;
          stats.buildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
          stats.cacheMisses++;
          cacheKey = key;
        } else {
          stats.cacheHits++;
        }
        if (cacheCanvas) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, Math.round(cssWidth * dpr), Math.round(cssHeight * dpr));
          ctx.drawImage(cacheCanvas, 0, 0);
        }
        return stats;
      }
    };
  }

  /* ---------------- device pixel ratio ---------------- */
  /* iPhone Safari reports 3; backing stores at 3x cost memory for no visible
     gain at this art scale, so the ratio is clamped. */
  const MAX_DPR = 2;
  function resolveDpr(raw) {
    const value = Number(raw) || 1;
    return Math.max(1, Math.min(value, MAX_DPR));
  }
  function sizeCanvas(canvas, cssWidth, cssHeight, rawDpr) {
    const dpr = resolveDpr(rawDpr);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    return dpr;
  }

  /* ---------------- interactive overlay anchors ---------------- */
  /*
   * The overlay is the only part of the map that becomes DOM. Anchors are
   * returned in CSS pixels so the caller can place buttons over the canvas.
   * Placement is deterministic, and the anchor sits at the plot centre --
   * the caller lifts the pin by the sprite height once artwork exists.
   */
  const PIN_SPECS = [
    { kind: 'store', zone: 'commercial', label: '自社店舗' },
    { kind: 'tenant', zone: 'commercial', label: '出店候補' },
    { kind: 'office', zone: 'cbd', label: 'オフィス候補' },
    { kind: 'realestate', zone: 'residential', label: '売買可能物件' },
    { kind: 'landmark', zone: 'landmark', label: 'ランドマーク' }
  ];

  /*
   * Two pin kinds can legitimately share a zone (store/tenant both draw from
   * 'commercial'), and picked independently they can land on neighbouring
   * tiles -- close enough on a narrow iPhone canvas that their 44px hit
   * targets overlap and one becomes untappable. MIN_PIN_TILE_SPACING keeps
   * already-placed pins at arm's length; the exclusion is still a pure
   * function of the deterministic candidate order, so placement stays
   * reproducible.
   */
  const MIN_PIN_TILE_SPACING = 3;

  function overlayAnchors(district, transform, specs) {
    const list = specs || PIN_SPECS;
    const anchors = [];
    for (const spec of list) {
      const candidates = district.tiles.filter(cell => cell.zone === spec.zone && cell.expectsBuilding);
      if (!candidates.length) continue;
      const spaced = candidates.filter(cell => anchors.every(a =>
        Math.abs(a.tileX - cell.tileX) + Math.abs(a.tileY - cell.tileY) >= MIN_PIN_TILE_SPACING));
      const pool = spaced.length ? spaced : candidates;
      const cell = pool[hash(`${district.prefID}:pin:${spec.kind}`) % pool.length];
      const [cssX, cssY] = transform.toCss(cell.tileX, cell.tileY);
      anchors.push({
        kind: spec.kind, label: spec.label, zone: cell.zone, zoneLabel: cell.zoneLabel,
        use: cell.use, spriteId: cell.spriteId,
        tileX: cell.tileX, tileY: cell.tileY, x: cssX, y: cssY
      });
    }
    return anchors;
  }

  const api = {
    hash,
    validateManifest, indexManifest, selectMapSprite,
    createTransform, fitTransform,
    loadSprites,
    paintTerrain, paintRoads, paintGreenery, drawPlaceholder, blitSprites, depthSorted,
    spriteRenderSize, SPRITE_WIDTH_FACTOR, LANDMARK_SCALE_BONUS, SCALE_VARIANTS,
    buildDistrict, createCityLayer, nearbySpriteIds, NO_REPEAT_RADIUS,
    resolveDpr, sizeCanvas, MAX_DPR,
    overlayAnchors, PIN_SPECS,
    ZONE_LABEL, ZONE_USE, GROUND
  };

  root.MapCanvas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
