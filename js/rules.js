// 전투 규칙. DOM을 쓰지 않고, 난수는 인자로 받는다. 상태는 JSON으로 저장할 수 있는 값만 둔다.
(function () {
  const CONFIG = {
    startHp: 1e7,
    levelStep: 1.3,
    maxLevel: 10,
    tiers: { 1: { dot: 0.05 }, 2: { dot: 0.08 }, 3: { dot: 0.12 } },
    // 몬스터 체력 = base × (시가총액 / capRef)^exp × tierMult
    hp: { base: 5e5, capRef: 2e12, exp: 0.55, tierMult: { 1: 1, 2: 1.2, 3: 1.5 } },
    crit: { chance: 0.15, x3Share: 0.2 },
    moneyRatio: 0.2,
    itemChance: 0.6,
    minOrder: 10000,
    preroll: 20,
    // 첫 판의 마지막 보스 체력 배수. 첫 판은 절대 깰 수 없게 한다.
    sealMult: 50,
  };

  // 영구 강화 효과. 강화가 없을 때의 값이다.
  const NO_MODS = { startBonus: 0, capBonus: 0, slots: 0, startItems: 0, crit: 0, dotResist: 0, timeoutResist: 0, power: 0 };
  const modsOf = (player) => player.mods || NO_MODS;

  function newPlayer(mods = NO_MODS) {
    const hp = CONFIG.startHp + mods.startBonus;
    return { hp, maxHp: hp, items: [], mods: { ...mods } };
  }

  function levelFor(maxHp) {
    const steps = Math.floor(Math.log(maxHp / CONFIG.startHp) / Math.log(CONFIG.levelStep) + 1e-9);
    return Math.min(CONFIG.maxLevel, Math.max(1, steps + 1));
  }

  function pctCap(level, capBonus = 0) { return Math.min(100, level * 10 + capBonus); }

  function newBattle(player, monsterId, tier, segment, monsterMax) {
    const t = CONFIG.tiers[tier];
    return {
      monsterId, tier, prices: segment.prices, from: segment.from, to: segment.to, mood: segment.mood || null,
      cursor: CONFIG.preroll, monsterMax, monsterHp: monsterMax, dot: t.dot,
      lot: null, earned: 0, lost: 0, dealt: 0, taken: 0, sells: 0, wins: 0, manualSells: 0, manualWins: 0, crits: 0,
      boughtAt: -1, soldAt: -1, startMaxHp: player.maxHp, itemsUsed: [], events: [], buys: [], sales: [], minHpRatio: 1, result: null,
    };
  }

  const price = (battle) => battle.prices[battle.cursor];

  function cash(player, battle) {
    return Math.max(0, player.hp - (battle.lot ? battle.lot.cost : 0));
  }

  function unrealized(battle) {
    const lot = battle.lot;
    if (!lot) return 0;
    // 아이템으로 바꾼 주식: 바꾸기 전 평가손익(base)은 1배로 두고, 바꾼 가격(convPrice) 뒤의 움직임만 배수와 방향을 곱한다.
    const raw = lot.convPrice
      ? lot.base + lot.qty * (price(battle) - lot.convPrice) * lot.mult * lot.dir
      : lot.qty * price(battle) - lot.cost;
    return Math.max(raw, -lot.cost);
  }

  function validPct(player, pct) {
    return pct >= 10 && pct % 10 === 0 && pct <= pctCap(levelFor(player.maxHp), modsOf(player).capBonus);
  }

  function buy(player, battle, pct) {
    if (battle.result) return { ok: false, reason: 'ended' };
    if (!validPct(player, pct)) return { ok: false, reason: 'pctCap' };
    if (battle.boughtAt === battle.cursor) return { ok: false, reason: 'thisCell' };
    if (battle.lot && battle.lot.convPrice) return { ok: false, reason: 'converted' };
    const amount = cash(player, battle) * pct / 100;
    if (amount < CONFIG.minOrder) return { ok: false, reason: 'noCash' };
    const p = price(battle);
    const lot = battle.lot;
    battle.buys.push({ cell: battle.cursor, price: p, amount, underwater: Boolean(lot) && unrealized(battle) < 0, above: Boolean(lot) && unrealized(battle) > 0 });
    if (lot) {
      const qty = lot.qty + amount / p;
      lot.avg = (lot.cost + amount) / qty;
      lot.cost += amount;
      lot.qty = qty;
    } else {
      battle.lot = { cost: amount, qty: amount / p, avg: p, mult: 1, dir: 1 };
    }
    battle.boughtAt = battle.cursor;
    return { ok: true };
  }

  function rollCrit(rng, bonus) {
    if (rng() >= CONFIG.crit.chance + bonus) return 1;
    return rng() < CONFIG.crit.x3Share ? 3 : 2;
  }

  // 물량의 fraction만큼 손익을 확정한다.
  function realize(player, battle, fraction, rng) {
    const lot = battle.lot;
    const pnl = unrealized(battle) * fraction;
    const crit = rollCrit(rng, modsOf(player).crit);
    const damage = Math.abs(pnl) * crit * (pnl > 0 ? 1 + (modsOf(player).power || 0) : 1);
    if (pnl > 0) {
      battle.monsterHp -= damage;
      battle.dealt += damage;
      battle.earned += pnl;
      battle.wins += 1;
    } else if (pnl < 0) {
      player.hp -= damage;
      battle.taken += damage;
      battle.lost += -pnl;
    }
    battle.sells += 1;
    battle.sales.push({ cell: battle.cursor, price: price(battle), pnl, crit });
    battle.minHpRatio = Math.min(battle.minHpRatio, player.hp / player.maxHp);
    if (crit > 1 && pnl !== 0) battle.crits += 1;
    if (pnl !== 0) {
      battle.events.push({ cell: battle.cursor, type: pnl > 0 ? 'attack' : 'hurt', amount: damage, crit });
    }
    if (fraction >= 1) {
      battle.lot = null;
    } else {
      lot.cost *= 1 - fraction;
      lot.qty *= 1 - fraction;
      if (lot.convPrice) lot.base *= 1 - fraction;
    }
    return { pnl, crit, damage };
  }

  function finishIfOver(player, battle, rng) {
    if (player.hp <= 0) {
      battle.lot = null;
      battle.result = 'dead';
      return;
    }
    if (battle.monsterHp <= 0) {
      if (battle.lot) realize(player, battle, 1, rng);
      battle.result = player.hp <= 0 ? 'dead' : 'win';
    }
  }

  function sell(player, battle, pct, rng) {
    if (battle.result) return { ok: false, reason: 'ended' };
    if (!validPct(player, pct)) return { ok: false, reason: 'pctCap' };
    const lot = battle.lot;
    if (!lot) return { ok: false, reason: 'noHolding' };
    if (battle.soldAt === battle.cursor) return { ok: false, reason: 'thisCell' };
    // 아이템으로 바꾼 주식은 한 번에 전량 판다. 끝수만 남아도 전량 판다.
    const fraction = lot.convPrice || lot.cost * (1 - pct / 100) < CONFIG.minOrder ? 1 : pct / 100;
    const out = realize(player, battle, fraction, rng);
    // 자동 매도와 구분해 직접 누른 매도만 센다. 매매 승률과 원샷 메달이 쓴다.
    battle.manualSells = (battle.manualSells || 0) + 1;
    if (out.pnl > 0) battle.manualWins = (battle.manualWins || 0) + 1;
    battle.soldAt = battle.cursor;
    finishIfOver(player, battle, rng);
    return { ok: true, ...out };
  }

  // 시간 초과와 포기: 보유를 자동 매도하고, 살아 있는 몬스터의 남은 체력만큼 맞는다.
  function endByTime(player, battle, rng) {
    if (battle.lot) realize(player, battle, 1, rng);
    finishIfOver(player, battle, rng);
    if (battle.result) return;
    const left = battle.monsterHp * (1 - modsOf(player).timeoutResist);
    player.hp -= left;
    battle.taken += left;
    battle.minHpRatio = Math.min(battle.minHpRatio === undefined ? 1 : battle.minHpRatio, player.hp / player.maxHp);
    battle.events.push({ cell: battle.cursor, type: 'hurt', amount: left, crit: 1, timeout: true });
    battle.result = player.hp <= 0 ? 'dead' : 'timeout';
  }

  function tick(player, battle, rng) {
    if (battle.result) return { dot: 0 };
    battle.cursor += 1;
    const loss = Math.max(0, -unrealized(battle));
    const dot = loss * battle.dot * (1 - modsOf(player).dotResist);
    if (dot > 0) {
      player.hp -= dot;
      battle.minHpRatio = Math.min(battle.minHpRatio, player.hp / player.maxHp);
      battle.taken += dot;
      battle.events.push({ cell: battle.cursor, type: 'dot', amount: dot, crit: 1 });
    }
    finishIfOver(player, battle, rng);
    if (!battle.result && battle.cursor >= battle.prices.length - 1) endByTime(player, battle, rng);
    return { dot };
  }

  function forfeit(player, battle, rng) {
    if (!battle.result) endByTime(player, battle, rng);
  }

  // 번 금액만큼 체력이 오른다. 손실은 매도 때 이미 깎였으므로 현재 체력에서 다시 빼지 않는다.
  function settleWin(player, battle) {
    player.hp += battle.earned;
    player.maxHp += Math.max(0, battle.earned - battle.lost);
    const money = battle.monsterMax * CONFIG.moneyRatio;
    player.hp = Math.min(player.maxHp, player.hp + money);
    return { earned: battle.earned, money };
  }

  const ITEMS = {
    x2: { id: 'x2', name: 'X2', mult: 2, dir: 1 },
    x3: { id: 'x3', name: 'X3', mult: 3, dir: 1 },
    inv: { id: 'inv', name: '인버스', mult: 1, dir: -1 },
    inv2: { id: 'inv2', name: 'X2 인버스', mult: 2, dir: -1 },
    foresee: { id: 'foresee', name: '예지' },
  };
  const FORESEE_CELLS = 5;

  function foresight(battle) {
    const at = Math.min(battle.cursor + FORESEE_CELLS, battle.prices.length - 1);
    const now = price(battle);
    if (battle.prices[at] > now) return 'up';
    return battle.prices[at] < now ? 'down' : 'flat';
  }

  function useItem(player, battle, index) {
    if (battle.result) return { ok: false, reason: 'ended' };
    const item = ITEMS[player.items[index]];
    if (!item) return { ok: false, reason: 'noItem' };
    if (item.id === 'foresee') {
      player.items.splice(index, 1);
      battle.itemsUsed.push(item.id);
      return { ok: true, foresight: foresight(battle) };
    }
    // 배수·방향 아이템은 가진 주식을 같은 수량 그대로 바꾼다. 다 팔 때까지 더 살 수 없다.
    const lot = battle.lot;
    if (!lot) return { ok: false, reason: 'noHolding' };
    if (lot.convPrice) return { ok: false, reason: 'converted' };
    lot.base = unrealized(battle);
    lot.convPrice = price(battle);
    lot.mult = item.mult;
    lot.dir = item.dir;
    lot.item = item.id;
    player.items.splice(index, 1);
    battle.itemsUsed.push(item.id);
    return { ok: true };
  }

  const MARKER_LIMIT = 12;
  const ATTACK_MARK = 0.1;
  const HURT_MARK = 0.03;

  // 그래프에 찍을 주요 공격과 피해. 큰 것부터 고르고, 칸 순서로 돌려준다.
  function markers(battle) {
    const out = [];
    const hurtLine = battle.startMaxHp * HURT_MARK;
    let run = null;
    const closeRun = () => {
      if (run && run.amount >= hurtLine) out.push({ cell: run.to, kind: 'hurt', amount: run.amount, from: run.from, to: run.to, dot: true });
      run = null;
    };
    for (const e of battle.events) {
      if (e.type === 'dot') {
        if (run && e.cell !== run.to + 1) closeRun();
        if (!run) run = { from: e.cell, to: e.cell, amount: 0 };
        run.to = e.cell;
        run.amount += e.amount;
      } else if (e.type === 'attack' && e.amount >= battle.monsterMax * ATTACK_MARK) {
        out.push({ cell: e.cell, kind: 'attack', amount: e.amount, crit: e.crit });
      } else if (e.type === 'hurt' && e.amount >= hurtLine) {
        out.push({ cell: e.cell, kind: 'hurt', amount: e.amount, crit: e.crit, timeout: Boolean(e.timeout) });
      }
    }
    closeRun();
    return out.sort((a, b) => b.amount - a.amount).slice(0, MARKER_LIMIT).sort((a, b) => a.cell - b.cell);
  }

  const Rules = {
    CONFIG, NO_MODS, newPlayer, levelFor, pctCap, newBattle, cash, unrealized, buy, sell, tick, forfeit, settleWin, ITEMS, useItem, markers,
  };
  globalThis.Rules = Rules;
  if (typeof module !== 'undefined') module.exports = Rules;
})();
