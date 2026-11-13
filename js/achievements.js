// 트로피(한 판의 결과), 메달(플레이 중 행동), 몬스터 도감. 게임 규칙에는 영향을 주지 않는다.
(function () {
  const load = (name, file) => globalThis[name] || (typeof require !== 'undefined' ? require(file) : null);
  const Meta = load('Meta', './meta.js');

  const PREROLL = 20;
  const TIER_ICON = { bronze: '🥉', silver: '🥈', gold: '🏆', plat: '👑', dia: '💎', sad: '🥀' };

  const wins = (c) => c.stages.filter((s) => s.result === 'win');
  const clear = (c) => c.r.status === 'clear';
  const windowOf = (s) => s.prices.slice(PREROLL);
  const anyStage = (fn) => (c) => c.stages.some(fn);
  const anyWin = (fn) => (c) => wins(c).some(fn);

  function longestDotRunThenAttack(s) {
    let run = 0;
    let prev = -2;
    let best = 0;
    for (const e of s.events) {
      if (e.type === 'dot') {
        run = e.cell === prev + 1 ? run + 1 : 1;
        prev = e.cell;
      } else if (e.type === 'attack' && run > best) {
        best = run;
      }
    }
    return best;
  }

  // group은 화면 문구 키(group.*)다. 이름과 설명의 영어·일본어는 i18n.js의 ACH에 있다.
  const trophy = (group) => (id, name, desc, tier, test, icon) => ({ id, name, desc, tier, group, icon: icon || TIER_ICON[tier], test });
  const T1 = trophy('profit');
  const T2 = trophy('clearStyle');
  const T3 = trophy('tears');
  const multiple = (n, name, tier) => T1(`x${n}`, name, `Clear하고 시작 자금의 ${n}배 이상`, tier, (c) => clear(c) && c.r.finalHp >= c.r.startHp * n);

  const TROPHIES = [
    T1('plus0', '본전 탈출', 'Clear하고 수익이 플러스', 'bronze', (c) => clear(c) && c.r.pnlPct > 0),
    T1('plus10', '일할', 'Clear하고 +10% 이상', 'bronze', (c) => clear(c) && c.r.pnlPct >= 0.1),
    multiple(2, '두 배', 'silver'),
    multiple(3, '세 배', 'silver'),
    multiple(5, '다섯 배', 'gold'),
    multiple(10, '열 배', 'gold'),
    multiple(20, '스무 배', 'plat'),
    multiple(50, '오십 배', 'plat'),
    multiple(100, '백 배', 'dia'),
    T2('finish', '완주', 'Clear', 'gold', clear),
    T2('allWins', '전승', '10마리 모두 처치', 'plat', (c) => c.stages.length === 10 && wins(c).length === 10),
    T2('noItems', '무아이템', '아이템 없이 Clear', 'plat', (c) => clear(c) && c.stages.every((s) => !s.itemsUsed.length)),
    T2('noCritHurt', '무크리티컬 피해', '손실 크리티컬 없이 Clear', 'gold', (c) => clear(c) && c.stages.every((s) => !s.sales.some((x) => x.pnl < 0 && x.crit > 1))),
    T2('threeInRow', '무사망 3연속 Clear', 'Clear를 3판 연속', 'dia', (c) => c.life.clearsInRow >= 3),
    T2('narrow', '간신히', '체력 10% 이하로 Clear', 'silver', (c) => clear(c) && c.r.finalHp <= c.r.maxHp * 0.1),
    T2('maxLevel', '만렙', 'Lv.10 도달', 'plat', (c) => c.r.level >= 10),
    T2('sealedBoss', '봉인된 보스', '첫 판에서 10번째 보스까지 도달', 'silver', (c) => c.r.sealedRun && c.stages.length === 10, '🔒'),
    T3('tuition', '수업료', '손실로 끝남', 'sad', (c) => c.r.pnl < 0),
    T3('half', '고등어', '시작 자금의 절반 이하로 끝남', 'sad', (c) => c.r.finalHp <= c.r.startHp / 2, '🐟'),
    T3('third', '갈치', '시작 자금의 1/3 이하로 끝남', 'sad', (c) => c.r.finalHp <= c.r.startHp / 3, '🎣'),
    T3('nearZero', '깡통 직전', '시작 자금의 20% 이하로 끝남', 'sad', (c) => c.r.finalHp <= c.r.startHp * 0.2, '🥫'),
    T3('diedFirst', '첫판 사망', '첫 몬스터에게 사망', 'sad', (c) => c.r.status === 'dead' && c.stages.length === 1),
    T3('diedLast', '문턱에서', '10번째 몬스터에게 사망', 'sad', (c) => c.r.status === 'dead' && c.stages.length === 10),
    T3('beggar', '거지왕자', '누적 사망 10회', 'sad', (c) => c.life.deaths >= 10, '🪙'),
  ];

  const medal = (group) => (id, icon, name, desc, test) => ({ id, icon, name, desc, group, test });
  const M1 = medal('first');
  const M2 = medal('battle');
  const M3 = medal('trade');
  const M4 = medal('crit');
  const M5 = medal('item');
  const M6 = medal('market');
  const M7 = medal('meme');
  const M8 = medal('growth');
  const usedInWin = (id) => anyWin((s) => s.itemsUsed.includes(id));
  const boardDone = (board) => (c) => {
    const ids = c.data.monsters.filter((m) => m.board === board).map((m) => m.id);
    return ids.length > 0 && ids.every((id) => c.life.killed[id]);
  };
  const upgradeCount = (meta) => (meta ? Object.values(meta.upgrades).reduce((a, b) => a + b, 0) : 0);

  const MEDALS = [
    M1('firstBuy', '🛒', '첫 매수', '처음으로 삼', (c) => c.life.buys >= 1),
    M1('firstSell', '💰', '첫 매도', '처음으로 팖', (c) => c.life.sells >= 1),
    M1('firstKill', '⚔️', '첫 처치', '몬스터를 처음 쓰러뜨림', (c) => c.life.kills >= 1),
    M1('firstCrit', '💥', '첫 크리티컬', '크리티컬이 처음 터짐', (c) => c.life.crits >= 1),
    M1('firstDeath', '💀', '첫 사망', '처음으로 죽음', (c) => c.life.deaths >= 1),
    M1('firstTimeout', '⏰', '첫 시간 초과', '처음으로 시간 초과', (c) => c.life.timeouts >= 1),
    M1('firstItem', '🎒', '첫 아이템', '아이템을 처음 씀', (c) => c.life.itemKinds.length >= 1),
    M1('firstClear', '🏁', '첫 Clear', '처음으로 Clear', (c) => c.life.clears >= 1),

    M2('oneShot', '🎯', '원샷', '매도 한 번으로 처치', anyWin((s) => s.sells === 1)),
    M2('speedrun', '⚡', '스피드런', '30칸 안에 처치', anyWin((s) => s.cursorEnd - PREROLL <= 30)),
    M2('buzzer', '🔔', '막판 뒤집기', '마지막 10칸에서 처치', anyWin((s) => s.cursorEnd >= s.prices.length - 11)),
    M2('noDamageWin', '🛡️', '무피해 승리', '피해 없이 처치', anyWin((s) => s.taken === 0)),
    M2('kills10', '🗡️', '사냥꾼', '누적 처치 10', (c) => c.life.kills >= 10),
    M2('kills50', '🏹', '베테랑', '누적 처치 50', (c) => c.life.kills >= 50),
    M2('kills100', '🐉', '용사', '누적 처치 100', (c) => c.life.kills >= 100),
    M2('kills500', '👹', '마왕', '누적 처치 500', (c) => c.life.kills >= 500),

    M3('trades100', '🖐️', '단타 입문', '누적 매매 100회', (c) => c.life.buys + c.life.sells >= 100),
    M3('trades1000', '🔥', '손이 빠른 사람', '누적 매매 1,000회', (c) => c.life.buys + c.life.sells >= 1000),
    M3('bottomBuy', '🎣', '저점 사냥', '구간 최저가 5% 이내에서 매수', anyStage((s) => s.buys.some((b) => b.price <= Math.min(...windowOf(s)) * 1.05))),
    M3('topSell', '🏔️', '천장 매도', '구간 최고가 5% 이내에서 매도', anyStage((s) => s.sales.some((x) => x.price >= Math.max(...windowOf(s)) * 0.95))),
    M3('cutLoss', '✂️', '손절의 미학', '손실 매도 뒤 같은 전투에서 처치', anyWin((s) => s.sales.some((x, i) => x.pnl < 0 && s.sales.slice(i + 1).some((y) => y.pnl > 0)))),
    M3('hodl', '🧘', '존버왕', '평가손실을 40칸 넘게 버틴 뒤 이익', anyStage((s) => longestDotRunThenAttack(s) > 40)),

    M4('crit3', '🎆', '불꽃놀이', '한 전투에서 크리티컬 3회', anyStage((s) => s.crits >= 3)),
    M4('critX3', '☄️', '×3 터뜨리기', '×3 크리티컬', anyStage((s) => s.sales.some((x) => x.crit === 3 && x.pnl > 0))),
    M4('critHurt', '🩸', '치명타 피해', '손실에 크리티컬', anyStage((s) => s.sales.some((x) => x.crit > 1 && x.pnl < 0))),
    M4('crit10Run', '🌋', '크리티컬 폭풍', '한 판에 크리티컬 10회', (c) => c.r.crits >= 10),

    M5('leverage', '📈', '레버리지 입문', 'X2를 씀', anyStage((s) => s.itemsUsed.includes('x2'))),
    M5('allIn', '🚀', '영끌', 'X3를 쓴 전투에서 처치', usedInWin('x3')),
    M5('inverse2Win', '🐻', '곱버스', 'X2 인버스를 쓴 전투에서 처치', usedInWin('inv2')),
    M5('inverse', '🔄', '인버스 입문', '인버스를 씀', anyStage((s) => s.itemsUsed.includes('inv'))),
    M5('prophet', '🔮', '예언자', '예지를 쓴 전투에서 처치', usedInWin('foresee')),
    M5('allItems', '🧰', '만물상', '모든 종류의 아이템을 씀', (c) => c.life.itemKinds.length >= 5),

    M6('conquerKosdaq', '🌃', '코스닥 정벌', '코스닥 기업을 모두 처치', boardDone('KOSDAQ')),
    M6('conquerKospi', '🏙️', '코스피 정벌', '코스피 기업을 모두 처치', boardDone('KOSPI')),
    M6('conquerUs', '🗽', 'S&P 정벌', '미국 기업을 모두 처치', boardDone('US')),
    M6('zigzag', '〰️', '와리가리 승리', '★★★ 누적 처치 10', (c) => c.life.tier3Wins >= 10),
    M6('tooBig', '🏛️', '대마불사', '시가총액 1위 기업 처치', (c) => {
      const top = c.data.monsters.reduce((a, b) => (b.marketCapKrw > a.marketCapKrw ? b : a));
      return wins(c).some((s) => s.monsterId === top.id);
    }),

    M7('averageDown', '💧', '물타기 장인', '평가손실 중 3번 추가 매수', anyStage((s) => s.buys.filter((b) => b.underwater).length >= 3)),
    M7('pyramid', '🔥', '불타기 장인', '평가이익 중 3번 추가 매수', anyStage((s) => s.buys.filter((b) => b.above).length >= 3)),
    M7('hanRiver', '🌉', '한강 전망', '체력 1% 이하에서 살아남음', (c) => c.r.status !== 'dead' && c.stages.some((s) => s.minHpRatio <= 0.01)),
    M7('alwaysRight', '🍰', '익절은 항상 옳다', '누적 이익 매도 100회', (c) => c.life.profitSells >= 100),
    M7('antEscape', '🐜', '개미 탈출', '최대 체력 1억 도달', (c) => c.life.maxHpEver >= 1e8),

    M8('firstUpgrade', '🌱', '첫 강화', '영구 강화를 처음 삼', (c) => upgradeCount(c.meta) >= 1),
    M8('upgrade20', '🌿', '수련', '영구 강화 20단계', (c) => upgradeCount(c.meta) >= 20),
    M8('upgradeAll', '🌳', '득도', '모든 강화를 최대 단계로', (c) => Boolean(c.meta) && Meta.UPGRADES.every((u) => (c.meta.upgrades[u.id] || 0) >= u.max)),
  ];

  function emptyLife() {
    return {
      runs: 0, clears: 0, deaths: 0, timeouts: 0, kills: 0, buys: 0, sells: 0, crits: 0, profitSells: 0,
      clearsInRow: 0, itemKinds: [], killed: {}, tier3Wins: 0, maxHpEver: 0,
    };
  }

  function updateLife(life, r) {
    life.runs += 1;
    if (r.status === 'clear') life.clears += 1;
    if (r.status === 'dead') life.deaths += 1;
    life.clearsInRow = r.status === 'clear' ? life.clearsInRow + 1 : 0;
    life.crits += r.crits;
    life.maxHpEver = Math.max(life.maxHpEver, r.maxHp);
    for (const s of r.stages) {
      if (s.result === 'timeout') life.timeouts += 1;
      if (s.result === 'win') {
        life.kills += 1;
        life.killed[s.monsterId] = true;
        if (s.tier === 3) life.tier3Wins += 1;
      }
      life.buys += s.buys.length;
      life.sells += s.sells;
      life.profitSells += s.sales.filter((x) => x.pnl > 0).length;
      for (const id of s.itemsUsed) if (!life.itemKinds.includes(id)) life.itemKinds.push(id);
    }
  }

  // 판이 끝나면 부른다. state는 모음의 achievements이고 그 자리에서 고친다. 새로 받은 것만 돌려준다.
  function evaluate(report, state, data, meta) {
    state.life = { ...emptyLife(), ...(state.life || {}) };
    updateLife(state.life, report);
    const c = { r: report, stages: report.stages, life: state.life, data, meta };
    const fresh = (list, owned) => list.filter((x) => !owned.includes(x.id) && x.test(c)).map((x) => x.id);
    const trophies = fresh(TROPHIES, state.trophies);
    const medals = fresh(MEDALS, state.medals);
    state.trophies.push(...trophies);
    state.medals.push(...medals);
    return { trophies, medals };
  }

  function updateDex(dex, report) {
    for (const s of report.stages) {
      const row = dex[s.monsterId] || { kills: 0, met: 0, bestDealt: 0 };
      row.met += 1;
      if (s.result === 'win') row.kills += 1;
      row.bestDealt = Math.max(row.bestDealt, s.dealt);
      dex[s.monsterId] = row;
    }
    return dex;
  }

  const Achievements = { TROPHIES, MEDALS, TIER_ICON, evaluate, updateDex, emptyLife };
  globalThis.Achievements = Achievements;
  if (typeof module !== 'undefined') module.exports = Achievements;
})();
