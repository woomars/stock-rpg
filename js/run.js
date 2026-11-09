// 한 판의 구성: 몬스터 뽑기, 구간 선택, 전투 사이 처리. 난수는 인자로 받는다.
(function () {
  const Rules = globalThis.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);

  const TIER_BY_ORDER = [1, 1, 1, 1, 2, 2, 2, 3, 3, 3];
  const MIDDLE_SEATS = [4, 5, 6];
  const MIN_PER_BOARD = 2;
  const ITEM_SLOTS = 3;
  const ITEM_WEIGHTS = { x2: 30, x3: 10, inv: 25, inv2: 10, foresee: 25 };
  const STATUSES = ['playing', 'clear', 'dead', 'survived'];

  // 재현할 수 있는 난수. 시험과 봇 시뮬레이션에서 쓴다.
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function takeRandom(list, count, rng) {
    const pool = [...list];
    const out = [];
    for (let i = 0; i < count && pool.length; i += 1) {
      out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return out;
  }

  function seatMiddleWithoutKosdaq(ordered) {
    for (const seat of MIDDLE_SEATS) {
      if (ordered[seat].board !== 'KOSDAQ') continue;
      let best = -1;
      ordered.forEach((m, i) => {
        if (m.board === 'KOSDAQ' || MIDDLE_SEATS.includes(i)) return;
        if (best < 0 || Math.abs(i - seat) < Math.abs(best - seat)) best = i;
      });
      [ordered[seat], ordered[best]] = [ordered[best], ordered[seat]];
    }
    return ordered;
  }

  function pickMonsters(monsters, rng) {
    const picked = [];
    for (const board of ['KOSDAQ', 'KOSPI', 'US']) {
      picked.push(...takeRandom(monsters.filter((m) => m.board === board), MIN_PER_BOARD, rng));
    }
    const rest = monsters.filter((m) => !picked.includes(m));
    picked.push(...takeRandom(rest, TIER_BY_ORDER.length - picked.length, rng));
    picked.sort((a, b) => a.marketCapKrw - b.marketCapKrw);
    return seatMiddleWithoutKosdaq(picked);
  }

  const seenKey = (id, tier, index) => `${id}:${tier}:${index}`;

  // 안 본 구간 중 무작위. 다 봤으면 가장 오래전에 본 구간.
  function pickSegment(monster, tier, seen, rng) {
    const indexes = monster.segments[tier].map((_, i) => i);
    const unseen = indexes.filter((i) => seen[seenKey(monster.id, tier, i)] === undefined);
    if (unseen.length) return unseen[Math.floor(rng() * unseen.length)];
    return indexes.reduce((a, b) => (seen[seenKey(monster.id, tier, b)] < seen[seenKey(monster.id, tier, a)] ? b : a));
  }

  function randomItem(rng) {
    const entries = Object.entries(ITEM_WEIGHTS);
    let roll = rng() * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [id, weight] of entries) {
      roll -= weight;
      if (roll < 0) return id;
    }
    return entries[0][0];
  }

  function monsterHp(monster, tier) {
    const h = Rules.CONFIG.hp;
    return h.base * (monster.marketCapKrw / h.capRef) ** h.exp * h.tierMult[tier];
  }

  function newRun(data, seen, rng, mods = Rules.NO_MODS, { sealed = false } = {}) {
    const player = Rules.newPlayer(mods);
    for (let i = 0; i < 1 + mods.startItems; i += 1) player.items.push(randomItem(rng));
    return {
      player, order: pickMonsters(data.monsters, rng).map((m) => m.id),
      stage: 0, battle: null, stages: [], status: 'playing', pendingItem: null, sealed,
    };
  }

  function startBattle(run, data, seen, rng) {
    const id = run.order[run.stage];
    const monster = data.monsters.find((m) => m.id === id);
    const tier = TIER_BY_ORDER[run.stage];
    const index = pickSegment(monster, tier, seen, rng);
    seen[seenKey(id, tier, index)] = Math.max(0, ...Object.values(seen)) + 1;
    const sealed = Boolean(run.sealed) && run.stage === TIER_BY_ORDER.length - 1;
    const hp = monsterHp(monster, tier) * (sealed ? Rules.CONFIG.sealMult : 1);
    run.battle = Rules.newBattle(run.player, id, tier, monster.segments[tier][index], hp);
    run.battle.sealed = sealed;
    return run.battle;
  }

  function dropItem(run, rng) {
    if (rng() >= Rules.CONFIG.itemChance) return null;
    const item = randomItem(rng);
    if (run.player.items.length < ITEM_SLOTS + (run.player.mods ? run.player.mods.slots : 0)) run.player.items.push(item);
    else run.pendingItem = item;
    return item;
  }

  // 끝난 전투를 기록하고 보상을 주고 다음 상태로 넘어간다.
  function finishBattle(run, rng) {
    const battle = run.battle;
    const last = run.stage === TIER_BY_ORDER.length - 1;
    const out = { money: 0, earned: 0, item: null, result: battle.result };
    run.stages.push(battle);
    run.battle = null;
    if (battle.result === 'dead') {
      run.status = 'dead';
      return out;
    }
    if (battle.result === 'win') {
      Object.assign(out, Rules.settleWin(run.player, battle));
      if (!last) out.item = dropItem(run, rng);
    }
    if (last) run.status = battle.result === 'win' ? 'clear' : 'survived';
    else run.stage += 1;
    return out;
  }

  function acceptItem(run, replaceIndex) {
    if (replaceIndex !== null && run.pendingItem) run.player.items[replaceIndex] = run.pendingItem;
    run.pendingItem = null;
  }

  // 저장에서 읽은 값이 게임을 이어 갈 수 있는 모양인지 본다.
  function isValid(run) {
    if (!run || typeof run !== 'object') return false;
    const p = run.player;
    if (!p || !Number.isFinite(p.hp) || !Number.isFinite(p.maxHp) || !Array.isArray(p.items)) return false;
    if (!Array.isArray(run.order) || run.order.length !== TIER_BY_ORDER.length) return false;
    if (!Number.isInteger(run.stage) || run.stage < 0 || run.stage >= TIER_BY_ORDER.length) return false;
    if (!Array.isArray(run.stages) || !STATUSES.includes(run.status)) return false;
    const b = run.battle;
    if (b && (!Array.isArray(b.prices) || !Number.isInteger(b.cursor) || b.cursor >= b.prices.length || !Number.isFinite(b.monsterHp))) return false;
    return true;
  }

  const Run = {
    TIER_BY_ORDER, ITEM_SLOTS, seeded, monsterHp, pickMonsters, pickSegment, randomItem, newRun, startBattle, finishBattle, acceptItem, isValid,
  };
  globalThis.Run = Run;
  if (typeof module !== 'undefined') module.exports = Run;
})();
