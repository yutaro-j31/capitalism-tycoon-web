'use strict';

const assert = require('node:assert/strict');
const { PLAY_STYLES } = require('./exploration-case-matrix');
const { STYLE_LOGIC, createGame, applyWeeklyStyle, runSegment } = require('./exploration-runner');

assert.deepEqual(Object.keys(STYLE_LOGIC), PLAY_STYLES);
assert.equal(new Set(PLAY_STYLES.map(style => JSON.stringify(STYLE_LOGIC[style]))).size, 9, 'every play style must have distinct decision parameters');
assert.equal(STYLE_LOGIC.passive.tenant, 'cheapest');
assert.equal(STYLE_LOGIC.leveraged_growth.debt, true);
assert.equal(STYLE_LOGIC.turnaround.debt, true);
assert.equal(STYLE_LOGIC.discount_share.price < 1, true);
assert.equal(STYLE_LOGIC.premium_quality.price > 1, true);
assert.equal(STYLE_LOGIC.diversified_group.diversify, true);
assert.equal(STYLE_LOGIC.boundary_explorer.boundary, true);

const definition = playStyle => ({ caseId:`ramen--easy--${playStyle}--2119631105`, businessID:'ramen', difficulty:'easy', playStyle, seed:2119631105 });
const results = Object.fromEntries(PLAY_STYLES.map(playStyle => [playStyle, runSegment(definition(playStyle), null, 104).result]));
assert.equal(results.passive.stores, 1, 'passive must open exactly one initial store');
assert.ok(results.leveraged_growth.debt > 0 && results.leveraged_growth.stores > 0, 'leveraged growth must borrow and own a store');
assert.ok(results.premium_quality.actionCounts['quality-investment'] > 0, 'premium quality must invest in quality');
assert.ok(results.boundary_explorer.actionCounts['boundary-price'] > 0, 'boundary explorer must exercise price boundaries');

const growth = createGame(definition('leveraged_growth')).game;
growth.g.week = 13; growth.g.lastReport = { profit:1_000_000 }; growth.g.companyCash = 100_000_000;
for (const store of growth.g.stores) store.status = 'open';
const storesBefore = growth.g.stores.length; applyWeeklyStyle(growth, definition('leveraged_growth'));
assert.ok(growth.g.stores.length > storesBefore, 'leveraged growth must add a store when growth conditions hold');

const diversified = createGame(definition('diversified_group')).game;
diversified.g.companyCash = 500_000_000;
for (const week of [52,104]) { diversified.g.week = week; applyWeeklyStyle(diversified, definition('diversified_group')); }
assert.ok(new Set(diversified.g.stores.map(store => store.businessID)).size >= 3, 'diversified group must enter different businesses');

const turnaround = createGame(definition('turnaround')).game;
turnaround.g.week = 13; turnaround.g.lastReport = { profit:1_000_000 };
for (const store of turnaround.g.stores) store.status = 'open';
applyWeeklyStyle(turnaround, definition('turnaround'));
const growthActions = {...turnaround.g.explorationRuntime.actionCounts};
turnaround.g.playerCrisis.status = 'distressed'; turnaround.g.week = 14;
turnaround.g.stores[0].lastProfit = -1_000_000;
turnaround.crisisCostReductionOptions = undefined;
turnaround.crisisCreditorNegotiationOptions = undefined;
turnaround.requestEmergencyBridgeLoan = undefined;
applyWeeklyStyle(turnaround, definition('turnaround'));
assert.ok(growthActions['open-store'] > 0 && turnaround.g.explorationRuntime.turnaroundStartWeek === 14, 'turnaround must switch from growth to restructuring');
console.log('exploration play-style decision checks passed');
