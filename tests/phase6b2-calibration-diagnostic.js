const { loadGame } = require('./harness');
const { engineModule, modules } = loadGame({ random: () => 0.5 });
console.log(`MODULE ${JSON.stringify({ present: Boolean(modules.strategyBalance), version: modules.strategyBalance?.VERSION, installed: engineModule.TycoonEngine.prototype.__strategyBalanceInstalled })}`);
for (const id of ['cafe','bakery','cramSchool','webAgency','appStudio']) {
  const game = new engineModule.TycoonEngine();
  const before = game.business(id)?.demand;
  const versionBefore = game.g.strategyBalanceVersion;
  game.configure({ playerName:'診断', companyName:'診断', difficulty:'normal', scenario:'standard' });
  console.log(`CALIBRATION ${JSON.stringify({ id, before, versionBefore, after:game.business(id)?.demand, versionAfter:game.g.strategyBalanceVersion })}`);
}
