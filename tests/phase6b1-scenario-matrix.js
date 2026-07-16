const { loadGame } = require('./harness');

let seed = 1;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const { engineModule } = loadGame({ random });

function tenantLabel(game, tenant) {
  const pref = game.pref(tenant.prefID);
  return `${pref?.name || tenant.prefID}/${tenant.name}`;
}

function chooseTenant(game, kind) {
  const rows = game.g.tenants.filter(row => !row.occupiedBy);
  if (kind === 'cheapest') return [...rows].sort((a, b) => a.deposit - b.deposit)[0];
  if (kind === 'score') return [...rows].sort((a, b) => (b.traffic / (1 + b.deposit)) - (a.traffic / (1 + a.deposit)))[0];
  if (kind === 'fukuoka') return rows.filter(row => row.prefID === 'fukuoka').sort((a, b) => b.traffic - a.traffic)[0];
  if (kind === 'tokyo') return rows.filter(row => row.prefID === 'tokyo').sort((a, b) => b.traffic - a.traffic)[0];
  if (kind === 'osaka') return rows.filter(row => row.prefID === 'osaka').sort((a, b) => b.traffic - a.traffic)[0];
  return rows[0];
}

for (const [index, kind] of ['cheapest', 'score', 'fukuoka', 'osaka', 'tokyo'].entries()) {
  seed = 0x6b110000 + index;
  const game = new engineModule.TycoonEngine();
  game.configure({ playerName: '診断', companyName: `診断${kind}`, difficulty: 'normal', scenario: 'standard', founderPrefID: 'fukuoka', founderTraitID: 'merchant' });
  const tenant = chooseTenant(game, kind);
  const initialCost = game.business('ramen').storeCost + tenant.deposit;
  const opened = game.openStore({ tenantID: tenant.id, businessID: 'ramen', name: `診断${kind}店`, operatingHours: 3 });
  const trace = [];
  for (let week = 0; week < 26 && !game.g.gameOver; week += 1) {
    game.advanceWeek(false);
    const store = game.g.stores[0];
    trace.push({
      week: game.g.week,
      cash: Math.round(game.g.companyCash),
      profit: Math.round(game.g.lastReport?.profit || 0),
      storeProfit: Math.round(store?.lastProfit || 0),
      sales: Math.round(store?.lastSales || 0),
      inventory: Math.round(Object.values(game.g.inventoryByStoreID?.[store?.id] || {}).reduce((sum, value) => sum + (Number(value) || 0), 0))
    });
  }
  console.log(`SCENARIO ${JSON.stringify({
    kind,
    tenant: tenantLabel(game, tenant),
    traffic: tenant.traffic,
    deposit: tenant.deposit,
    initialCost,
    opened,
    finalWeek: game.g.week,
    gameOver: game.g.gameOver,
    reason: game.g.gameOverReason,
    finalCash: Math.round(game.g.companyCash),
    companyValue: Math.round(game.companyValue()),
    trailingProfit: Math.round(game.g.reports.reduce((sum, row) => sum + Number(row.profit || 0), 0)),
    trace
  })}`);
}
