function finite(n, fallback = 0) { return Number.isFinite(Number(n)) ? Number(n) : fallback; }
function legacyRamenStoreSales(g, b, store, randomValue = 0.5) {
  const p = g.prefs.find(x => x.id === store.prefID) || { traffic: 1, rent: 0, areaID: g.selectedArea || 'kanto' };
  const a = g.areas.find(x => x.id === p.areaID) || { traffic: 1, competition: .35 };
  const localCompetition = finite(a.competition, .35);
  const r = .88 + randomValue * (.26);
  let demand = b.demand * p.traffic * a.traffic * g.economy * g.season * (1 + b.quality / 100) * (1 + b.brand / 90) * (1 + b.dx / 140) * (1 - localCompetition * .55) * r;
  demand *= [0, .45, .75, 1, 1.17][store.operatingHours || 3] || 1;
  if (g.macroCrisis) demand *= g.macroCrisis.salesMultiplier;
  return Math.max(0, demand * b.price * g.inflation);
}
module.exports = { legacyRamenStoreSales };
