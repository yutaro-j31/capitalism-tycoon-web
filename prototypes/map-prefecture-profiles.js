'use strict';
/*
 * Phase 2 map -- prefecture identity / regional variation data (2026-09).
 *
 * Pure data, no rendering, no RNG. This is Layer 1 (regional archetype) and
 * Layer 2 (prefecture-specific profile) of the 3-layer design described in
 * docs/map-prefecture-identity.md; Layer 3 (the deterministic per-prefecture
 * seed) is the `layoutSeed` field folded into the resolved profile below.
 *
 * Root cause this file exists to fix: prototypes/map-world-preview.js's
 * regionForBlock() used to be a pure function of block coordinates and grid
 * size ONLY -- no prefID input at all -- so every one of the 47 prefectures
 * produced a byte-identical zone/landmark skeleton; only sprite-level picks
 * (which exact office building renders) varied by prefecture. This file
 * supplies the per-prefecture weights and seed that map-world-preview.js's
 * anchor-based zone assignment now consumes instead of the old fixed
 * corners, so the *skeleton itself* -- not just which sprite fills it --
 * differs prefecture to prefecture.
 *
 * All 47 prefectures currently in g.prefs (js/data.js) have an explicit
 * entry in PREFECTURE_MAP_PROFILES below -- see resolveProfile()'s
 * `explicit` flag, which tests assert is true for all 47. The generic
 * fallback (DEFAULT_ARCHETYPE) exists only for a prefID that is not one of
 * the 47 (a corrupt/legacy save, or a future prefecture not yet added to
 * g.prefs) -- it must never be relied on for a real prefecture.
 */
(function (root) {
  /*
   * 9 regional archetypes. Weight fields (cbdWeight..openSpaceWeight) are on
   * a 0-10 scale and drive the anchor-based Voronoi zone assignment in
   * map-world-preview.js (a higher weight makes that zone's anchor "pull"
   * more surrounding blocks toward it). highRiseBias (0-1) biases cbd's
   * office.small/office.mid split; greeneryBias (0-1) biases open-lot type
   * toward green over hardscape. Every archetype keeps every weight >= 1 so
   * no zone is starved to exactly zero by design -- map-world-preview.js's
   * own block-assignment repair pass additionally guarantees each zone
   * captures at least one block even under an unlucky anchor placement.
   */
  const REGIONAL_ARCHETYPES = {
    /* e.g. Tokyo: dense high CBD, strong commercial, least open space */
    mega_core: {
      cbdWeight: 9, commercialWeight: 7, residentialWeight: 5, premiumResidentialWeight: 4,
      industrialWeight: 2, openSpaceWeight: 2, highRiseBias: 0.85, greeneryBias: 0.25
    },
    /* e.g. Osaka/Kanagawa/Aichi: high-ish CBD, more office/commercial mix */
    major_metro: {
      cbdWeight: 7, commercialWeight: 7, residentialWeight: 6, premiumResidentialWeight: 4,
      industrialWeight: 3, openSpaceWeight: 3, highRiseBias: 0.65, greeneryBias: 0.30
    },
    /* e.g. Saitama/Chiba/Shiga: mid-rise residential emphasis, weaker CBD */
    metro_suburban: {
      cbdWeight: 4, commercialWeight: 6, residentialWeight: 8, premiumResidentialWeight: 3,
      industrialWeight: 3, openSpaceWeight: 5, highRiseBias: 0.35, greeneryBias: 0.45
    },
    /* e.g. Miyagi/Hiroshima/Fukuoka/Kumamoto/Niigata: compact regional-capital core */
    regional_hub: {
      cbdWeight: 6, commercialWeight: 6, residentialWeight: 6, premiumResidentialWeight: 3,
      industrialWeight: 3, openSpaceWeight: 4, highRiseBias: 0.45, greeneryBias: 0.40
    },
    /* e.g. Ibaraki/Shizuoka/Okayama: warehouse/logistics-heavy, small commercial core */
    industrial_logistics: {
      cbdWeight: 3, commercialWeight: 4, residentialWeight: 5, premiumResidentialWeight: 2,
      industrialWeight: 7, openSpaceWeight: 4, highRiseBias: 0.25, greeneryBias: 0.35
    },
    /* e.g. Gunma/Tochigi/Yamanashi: low-to-mid density, more open space */
    inland_regional: {
      cbdWeight: 3, commercialWeight: 3, residentialWeight: 6, premiumResidentialWeight: 2,
      industrialWeight: 2, openSpaceWeight: 6, highRiseBias: 0.20, greeneryBias: 0.55
    },
    /* e.g. Kyoto/Nara/Ishikawa: suppressed high-rise, civic/open-space presence */
    historic_lowrise: {
      cbdWeight: 4, commercialWeight: 5, residentialWeight: 6, premiumResidentialWeight: 3,
      industrialWeight: 1, openSpaceWeight: 6, highRiseBias: 0.10, greeneryBias: 0.60
    },
    /* e.g. Hokkaido: wide block spacing feel via more open space, low density */
    northern_wide: {
      cbdWeight: 4, commercialWeight: 4, residentialWeight: 5, premiumResidentialWeight: 2,
      industrialWeight: 3, openSpaceWeight: 7, highRiseBias: 0.30, greeneryBias: 0.50
    },
    /* e.g. Okinawa: low/mid-rise centric, limited dense CBD */
    island_subtropical: {
      cbdWeight: 3, commercialWeight: 4, residentialWeight: 5, premiumResidentialWeight: 2,
      industrialWeight: 2, openSpaceWeight: 6, highRiseBias: 0.15, greeneryBias: 0.50
    }
  };

  const DEFAULT_ARCHETYPE = 'metro_suburban';

  /*
   * All 47 prefectures (matching js/data.js's g.prefs ids exactly -- see
   * docs/map-prefecture-identity.md for the coverage table). archetype
   * groups a prefecture shares a base weight profile with; landmarkPolicy
   * gates whether a prefecture-exclusive landmark sprite may be selected
   * for it ('dedicated') or must always fall back to the generic civic
   * pool ('generic') -- see map-world-preview.js's landmark selection and
   * the sprite manifest's `prefectureIds` field.
   */
  const PREFECTURE_MAP_PROFILES = {
    hokkaido: { archetype: 'northern_wide', landmarkPolicy: 'generic' },
    aomori: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    iwate: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    miyagi: { archetype: 'regional_hub', landmarkPolicy: 'generic' },
    akita: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    yamagata: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    fukushima: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    ibaraki: { archetype: 'industrial_logistics', landmarkPolicy: 'generic' },
    tochigi: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    gunma: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    saitama: { archetype: 'metro_suburban', landmarkPolicy: 'generic' },
    chiba: { archetype: 'metro_suburban', landmarkPolicy: 'generic' },
    tokyo: { archetype: 'mega_core', landmarkPolicy: 'dedicated' },
    kanagawa: { archetype: 'major_metro', landmarkPolicy: 'generic' },
    niigata: { archetype: 'regional_hub', landmarkPolicy: 'generic' },
    toyama: { archetype: 'regional_hub', landmarkPolicy: 'generic' },
    ishikawa: { archetype: 'historic_lowrise', landmarkPolicy: 'generic' },
    fukui: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    yamanashi: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    nagano: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    gifu: { archetype: 'industrial_logistics', landmarkPolicy: 'generic' },
    shizuoka: { archetype: 'industrial_logistics', landmarkPolicy: 'generic' },
    aichi: { archetype: 'major_metro', landmarkPolicy: 'generic' },
    mie: { archetype: 'industrial_logistics', landmarkPolicy: 'generic' },
    shiga: { archetype: 'metro_suburban', landmarkPolicy: 'generic' },
    kyoto: { archetype: 'historic_lowrise', landmarkPolicy: 'generic' },
    osaka: { archetype: 'major_metro', landmarkPolicy: 'generic' },
    hyogo: { archetype: 'regional_hub', landmarkPolicy: 'generic' },
    nara: { archetype: 'historic_lowrise', landmarkPolicy: 'generic' },
    wakayama: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    tottori: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    shimane: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    okayama: { archetype: 'industrial_logistics', landmarkPolicy: 'generic' },
    hiroshima: { archetype: 'regional_hub', landmarkPolicy: 'generic' },
    yamaguchi: { archetype: 'industrial_logistics', landmarkPolicy: 'generic' },
    tokushima: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    kagawa: { archetype: 'regional_hub', landmarkPolicy: 'generic' },
    ehime: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    kochi: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    fukuoka: { archetype: 'regional_hub', landmarkPolicy: 'generic' },
    saga: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    nagasaki: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    kumamoto: { archetype: 'regional_hub', landmarkPolicy: 'generic' },
    oita: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    miyazaki: { archetype: 'inland_regional', landmarkPolicy: 'generic' },
    kagoshima: { archetype: 'regional_hub', landmarkPolicy: 'generic' },
    okinawa: { archetype: 'island_subtropical', landmarkPolicy: 'generic' }
  };

  /*
   * Resolves a prefID into a fully-merged profile: the archetype's weight
   * fields plus this prefecture's own layoutSeed/landmarkPolicy/archetype
   * name, all in one object so map-world-preview.js never needs to look up
   * REGIONAL_ARCHETYPES itself. `explicit` is false only for a prefID
   * missing from PREFECTURE_MAP_PROFILES (not one of the 47) -- tests use
   * it to prove the generic fallback is never silently used for a real
   * prefecture.
   *
   * layoutSeed is derived from prefID alone (`${prefID}-layout`), not
   * stored per-entry above -- every one of the 47 already has a unique
   * prefID, so this is automatically unique per prefecture with no risk of
   * a copy-paste duplicate seed sneaking into the table.
   */
  function resolveProfile(prefID) {
    const entry = PREFECTURE_MAP_PROFILES[prefID];
    const archetypeKey = (entry && entry.archetype) || DEFAULT_ARCHETYPE;
    const archetype = REGIONAL_ARCHETYPES[archetypeKey] || REGIONAL_ARCHETYPES[DEFAULT_ARCHETYPE];
    const id = prefID || 'unknown';
    return Object.assign({}, archetype, {
      prefID: id,
      archetype: archetypeKey,
      layoutSeed: `${id}-layout`,
      landmarkPolicy: (entry && entry.landmarkPolicy) || 'generic',
      explicit: !!entry
    });
  }

  const api = { REGIONAL_ARCHETYPES, PREFECTURE_MAP_PROFILES, DEFAULT_ARCHETYPE, resolveProfile };
  root.MapPrefectureProfiles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
