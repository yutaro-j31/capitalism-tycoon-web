const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const src = fs.readFileSync('js/real-estate-capex-roi.js', 'utf8');
const ui = fs.readFileSync('js/real-estate-capex-roi-ui.js', 'utf8');
const loader = fs.readFileSync('js/real-estate-rent-performance-ui.js', 'utf8');
assert.doesNotMatch(src, /Math\.random|Date\.now/);
assert.match(ui, /改修投資ROI/);
assert.match(loader, /real-estate-capex-roi\.js/);
assert.match(loader, /RealEstateCapexROIFailed/);

class Engine {
  constructor(g) { this.g = g; }
  runTransaction(fn) { return fn(); }
  normalize() { return this.g; }
}
Engine.prototype.updateParityWeekly = function updateParityWeekly() {};

const development = {
  ensure(g) {
    if (!g.realEstateDevelopment) g.realEstateDevelopment = { projects: [] };
    if (!Array.isArray(g.realEstateDevelopment.projects)) g.realEstateDevelopment.projects = [];
    return g.realEstateDevelopment;
  },
  activeProject(state, id) {
    return state.projects.find(
      project => project.propertyID === id && ['active', 'paused'].includes(project.status),
    ) || null;
  },
};
const pricing = {
  ensure: development.ensure,
  marketRent(property) {
    const value = property.value || 1;
    const condition = property.realEstate?.condition || 0.8;
    const occupancy = property.realEstate?.targetOccupancy || 0.9;
    return Math.round(
      Math.max(10000, value * 0.004 * (0.82 + condition * 0.18) * (0.9 + occupancy * 0.1)),
    );
  },
};
const modules = {
  engine: { TycoonEngine: Engine },
  realEstateDevelopment: development,
  realEstateRentPricing: pricing,
};
vm.runInNewContext(src, { globalThis: { __capitalismTycoonModules: modules } });
const mod = modules.realEstateCapexROI;

const g = {
  week: 10,
  companyCash: 1e9,
  personalCash: 1e9,
  properties: [
    {
      id: 'p1', name: '本社ビル', owner: 'company', value: 100000000,
      realEstate: { condition: 0.55, targetOccupancy: 0.9, marketMonthlyRent: 380000 },
    },
    {
      id: 'p2', name: '個人アパート', owner: 'personal', value: 40000000,
      realEstate: { condition: 0.85, targetOccupancy: 0.95, marketMonthlyRent: 155000 },
    },
  ],
  realEstateDevelopment: { projects: [] },
};
const e = new Engine(g);
const cashBefore = g.companyCash;
const valueBefore = g.properties[0].value;
e.normalize();
const quotes = e.getPropertyCapexROI('p1');
assert.equal(quotes.length, 2);
assert(quotes.every(quote => quote.cost > 0 && quote.projectedMarketRent >= quote.currentMarketRent));
assert(quotes.some(quote => quote.planID === 'renovation' && quote.durationWeeks === 8));
assert.equal(g.companyCash, cashBefore);
assert.equal(g.properties[0].value, valueBefore);
const all = e.getRealEstateCapexROI({ owner: 'all', sort: 'score' });
assert.equal(all.length, 4);
assert(all[0].score >= all[1].score);
assert.equal(e.getRealEstateCapexROI({ owner: 'personal' }).length, 2);
const first = mod.processWeek(e);
assert.equal(first.length, 1);
assert.equal(mod.processWeek(e).length, 0);
for (let i = 0; i < 280; i += 1) {
  g.week += 1;
  mod.processWeek(e);
}
assert.equal(g.realEstateDevelopment.capexROIHistory.length, 260);
const saved = JSON.parse(JSON.stringify(g));
const e2 = new Engine(saved);
e2.normalize();
assert.deepEqual(
  JSON.parse(JSON.stringify(e2.getRealEstateCapexROI())),
  JSON.parse(JSON.stringify(e.getRealEstateCapexROI())),
);
console.log('real-estate-capex-roi: ok');
