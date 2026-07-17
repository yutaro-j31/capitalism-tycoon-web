'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const { ctx, engineModule: engine } = loadGame();
const valid = state => state.businesses.every(business => business && typeof business.id === 'string' && business.id.trim().length > 0);

const instance = new engine.TycoonEngine();
assert.equal(valid(instance.g), true, 'fresh engine must not expose incomplete business records');

instance.g.businesses.push({ segmentFit: {} }, {}, null, { id: '' });
instance.save();
assert.equal(valid(instance.g), true, 'save must repair the in-memory business collection');
const saved = JSON.parse(ctx.__localStorageData.get(engine.SAVE_KEY));
assert.equal(valid(saved), true, 'save must not persist incomplete business records');

instance.configure({ playerName: 'Sanitizer Tester', companyName: 'Sanitizer Holdings', difficulty: 'normal', scenario: 'free' });
assert.equal(valid(instance.g), true, 'configured game must repair master-data placeholders');
const configured = JSON.parse(ctx.__localStorageData.get(engine.SAVE_KEY));
assert.equal(valid(configured), true, 'configured save must contain only identified businesses');
assert.ok(configured.businesses.length >= 30, 'valid business catalog must remain intact');

console.log('business record sanitizer tests passed');
