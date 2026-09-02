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
  const SCALE_CLASSES = new Set(['xs', 's', 'm', 'l', 'xl']);

  /*
   * Returns { ok, errors, sprites }. An invalid entry is dropped rather than
   * throwing, so one bad row cannot take the whole map down; a structurally
   * invalid manifest (not an object, no sprite array) is rejected outright.
   */
  function validateManifest(manifest) {
    const errors = [];
    if (!manifest || typeof manifest !== 'object') {
      return { ok: false, errors: ['manifest must be an object'], sprites: [] };
    }
    if (!Array.isArray(manifest.sprites)) {
      return { ok: false, errors: ['manifest.sprites must be an array'], sprites: [] };
    }
    const tile = manifest.tile;
    if (!tile || !(tile.w > 0) || !(tile.h > 0)) {
      return { ok: false, errors: ['manifest.tile must declare positive w/h'], sprites: [] };
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
      if (!Array.isArray(sprite.zone) || !sprite.zone.length) { errors.push(`${label}: zone must be a non-empty array`); continue; }
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
      sprites.push(Object.assign({}, sprite, { footprint, weight }));
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
      tile: (manifest && manifest.tile) || { w: 64, h: 32 },
      set: (manifest && manifest.set) || 'phase1'
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
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      const alongX = at(cell.tileX - 1, cell.tileY) === 'road' || at(cell.tileX + 1, cell.tileY) === 'road';
      const alongY = at(cell.tileX, cell.tileY - 1) === 'road' || at(cell.tileX, cell.tileY + 1) === 'road';
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

  function blitSprites(ctx, district, transform, images, index, options) {
    const settings = options || {};
    const tile = index.tile;
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
      /* anchor is a fraction of the image; it marks the tile centre */
      const width = image.width / (meta.pixelRatio || 2);
      const height = image.height / (meta.pixelRatio || 2);
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
  /* share of buildable plots deliberately left open, so blocks are not solid */
  const OPEN_RATE = { cbd: 8, commercial: 10, residential: 14, industrial: 18, landmark: 0 };

  /*
   * Builds the tile model for a layout. Placement is data-driven: the caller
   * supplies rows of zone characters, and every buildable plot resolves a
   * sprite id deterministically. `expectsBuilding` marks plots that should
   * carry artwork, so a missing file still renders a placeholder in the right
   * spot instead of a hole.
   */
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
        if (BUILDABLE.has(zone)) {
          const isSecondaryLandmarkPlot = zone === 'landmark' &&
            ((rows[tileY - 1] && rows[tileY - 1][tileX] === 'X') || rows[tileY][tileX - 1] === 'X');
          const open = zone !== 'landmark' &&
            hash(`${prefID}:open:${tileX}:${tileY}`) % 100 < (OPEN_RATE[zone] || 0);
          if (!isSecondaryLandmarkPlot && !open) {
            cell.expectsBuilding = true;
            cell.spriteId = selectMapSprite({
              index, prefID, zoneType: zone, useType: ZONE_USE[zone],
              tileX, tileY, stableId: options.stableIds && options.stableIds[`${tileX},${tileY}`]
            });
          } else {
            cell.open = true;
          }
        }
        tiles.push(cell);
        byKey[`${tileX},${tileY}`] = cell;
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

  function overlayAnchors(district, transform, specs) {
    const list = specs || PIN_SPECS;
    const anchors = [];
    for (const spec of list) {
      const candidates = district.tiles.filter(cell => cell.zone === spec.zone && cell.expectsBuilding);
      if (!candidates.length) continue;
      const cell = candidates[hash(`${district.prefID}:pin:${spec.kind}`) % candidates.length];
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
    buildDistrict, createCityLayer,
    resolveDpr, sizeCanvas, MAX_DPR,
    overlayAnchors, PIN_SPECS,
    ZONE_LABEL, ZONE_USE, GROUND
  };

  root.MapCanvas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
