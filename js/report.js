// 투자 성과 리포트. 데이터가 바뀌어도 그대로 볼 수 있게 구간 가격까지 통째로 남긴다.
(function () {
  const load = (name, file) => globalThis[name] || (typeof require !== 'undefined' ? require(file) : null);
  const Rules = load('Rules', './rules.js');
  const Meta = load('Meta', './meta.js');

  const TITLES = { clear: 'GAME CLEAR', dead: 'GAME OVER', survived: '생존 종료', playing: '진행 중' };

  function holdPct(battle) {
    const start = battle.prices[Rules.CONFIG.preroll];
    return battle.prices[battle.prices.length - 1] / start - 1;
  }

  function stageOf(battle, data) {
    const m = data.monsters.find((x) => x.id === battle.monsterId) || { name: battle.monsterId, board: 'KOSPI', currency: 'KRW' };
    return {
      monsterId: battle.monsterId, name: m.name, board: m.board, currency: m.currency, tier: battle.tier,
      from: battle.from, to: battle.to, result: battle.result, sealed: Boolean(battle.sealed),
      dealt: battle.dealt, taken: battle.taken, earned: battle.earned, lost: battle.lost,
      monsterMax: battle.monsterMax, sells: battle.sells, wins: battle.wins, crits: battle.crits,
      itemsUsed: battle.itemsUsed || [], holdPct: holdPct(battle),
      prices: battle.prices, cursorEnd: battle.cursor, markers: Rules.markers(battle), events: battle.events,
      buys: battle.buys || [], sales: battle.sales || [], minHpRatio: battle.minHpRatio === undefined ? 1 : battle.minHpRatio,
    };
  }

  function make(run, data, { id, createdAt }) {
    const mods = run.player.mods || Rules.NO_MODS;
    const startHp = Rules.CONFIG.startHp + mods.startBonus;
    const finalHp = Math.max(0, run.player.hp);
    const stages = run.stages.map((b) => stageOf(b, data));
    const sells = stages.reduce((n, s) => n + s.sells, 0);
    const wins = stages.reduce((n, s) => n + s.wins, 0);
    const pnlPct = finalHp / startHp - 1;
    const holdAvgPct = stages.length ? stages.reduce((n, s) => n + s.holdPct, 0) / stages.length : 0;
    return {
      id, createdAt, status: run.status, title: TITLES[run.status], points: Meta.pointsFor(run),
      startHp, finalHp, maxHp: run.player.maxHp, level: Rules.levelFor(run.player.maxHp),
      pnl: finalHp - startHp, pnlPct, sells, winRate: sells ? wins / sells : 0,
      crits: stages.reduce((n, s) => n + s.crits, 0), holdAvgPct, vsHoldPct: pnlPct - holdAvgPct,
      sealedRun: Boolean(run.sealed), trophies: [], medals: [], stages,
    };
  }

  const Report = { make, TITLES };
  globalThis.Report = Report;
  if (typeof module !== 'undefined') module.exports = Report;
})();
