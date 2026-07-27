'use strict';

const assert = require('node:assert/strict');
const { PLAY_STYLES } = require('./exploration-case-matrix');
const { STYLE_LOGIC } = require('./exploration-runner');

assert.deepEqual(Object.keys(STYLE_LOGIC), PLAY_STYLES);
assert.equal(new Set(PLAY_STYLES.map(style => JSON.stringify(STYLE_LOGIC[style]))).size, 9, 'every play style must have distinct decision parameters');
assert.equal(STYLE_LOGIC.passive.tenant, 'none');
assert.equal(STYLE_LOGIC.leveraged_growth.debt, true);
assert.equal(STYLE_LOGIC.turnaround.debt, 'crisis');
assert.equal(STYLE_LOGIC.discount_share.price < 1, true);
assert.equal(STYLE_LOGIC.premium_quality.price > 1, true);
assert.equal(STYLE_LOGIC.diversified_group.diversify, true);
assert.equal(STYLE_LOGIC.boundary_explorer.boundary, true);
console.log('exploration play-style decision checks passed');
