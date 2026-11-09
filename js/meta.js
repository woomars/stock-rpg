// 로그라이크 성장: 판이 끝나면 쌓이는 내공과, 내공으로 사는 영구 강화.
(function () {
  const UPGRADES = [
    { id: 'startBonus', name: '초기 자금', desc: '시작 자금 +500만', max: 10, step: 5e6, costs: [3, 4, 7, 10, 14, 18, 24, 32, 40, 51] },
    { id: 'capBonus', name: '비율 상한', desc: '사기/팔기 비율 상한 +10%p', max: 3, step: 10, costs: [6, 14, 24] },
    { id: 'slots', name: '아이템 칸', desc: '아이템 칸 +1', max: 2, step: 1, costs: [8, 18] },
    { id: 'startItems', name: '시작 아이템', desc: '시작 아이템 +1개', max: 2, step: 1, costs: [4, 12] },
    { id: 'crit', name: '크리티컬 확률', desc: '크리티컬 확률 +3%p', max: 5, step: 0.03, costs: [4, 7, 10, 15, 21] },
    { id: 'dotResist', name: '도트 저항', desc: '도트 피해 −10%', max: 5, step: 0.1, costs: [3, 5, 8, 12, 16] },
    { id: 'timeoutResist', name: '시간 초과 저항', desc: '시간 초과 피해 −10%', max: 5, step: 0.1, costs: [3, 5, 8, 12, 16] },
    { id: 'power', name: '공격력', desc: '몬스터에게 주는 피해 +20%', max: 10, step: 0.2, costs: [3, 4, 7, 10, 14, 18, 24, 32, 40, 51] },
  ];
  const KILL_POINTS = { 1: 10, 2: 20, 3: 30 };
  const TIMEOUT_POINTS = 5;
  const CLEAR_POINTS = 100;

  const byId = (id) => UPGRADES.find((u) => u.id === id);

  function empty() { return { points: 0, runs: 0, upgrades: {} }; }

  // 아직 끝낸 판이 없으면 첫 판이다. 첫 판의 마지막 보스는 봉인되어 있다.
  function isFirstRun(meta) { return !meta.runs; }

  function level(meta, id) { return meta.upgrades[id] || 0; }

  // 다음 단계 가격. 최대 단계면 null
  function cost(meta, id) {
    const u = byId(id);
    const lv = level(meta, id);
    return lv >= u.max ? null : u.costs[lv];
  }

  function buy(meta, id) {
    const price = cost(meta, id);
    if (price === null) return { ok: false, reason: 'max' };
    if (meta.points < price) return { ok: false, reason: 'points' };
    meta.points -= price;
    meta.upgrades[id] = level(meta, id) + 1;
    return { ok: true };
  }

  function mods(meta) {
    const out = {};
    for (const u of UPGRADES) out[u.id] = Math.round(level(meta, u.id) * u.step * 1e6) / 1e6;
    return out;
  }

  function pointsFor(run) {
    let points = run.status === 'clear' ? CLEAR_POINTS : 0;
    for (const s of run.stages) {
      if (s.result === 'win') points += KILL_POINTS[s.tier];
      else if (s.result === 'timeout') points += TIMEOUT_POINTS;
    }
    return points;
  }

  function award(meta, run) {
    const points = pointsFor(run);
    meta.points += points;
    meta.runs = (meta.runs || 0) + 1;
    return points;
  }

  const Meta = { UPGRADES, empty, isFirstRun, level, cost, buy, mods, pointsFor, award };
  globalThis.Meta = Meta;
  if (typeof module !== 'undefined') module.exports = Meta;
})();
