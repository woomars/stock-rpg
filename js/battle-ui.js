// 전투 화면: 시간 흐름, 매매 버튼, 아이템, 일시정지, 전투 사이 처리.
// 주소에 ?test가 있으면 시간이 저절로 흐르지 않고 UI.step()으로만 진행한다.
(function () {
  const $ = (id) => document.getElementById(id);
  const TICK_MS = 700;
  const COUNTDOWN = 3;
  const BOARD_NAME = { KOSDAQ: '코스닥', KOSPI: '코스피', US: 'S&P' };
  const STARS = { 1: '★☆☆', 2: '★★☆', 3: '★★★' };
  const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(location.search);

  const UI = {
    TICK_MS, data: globalThis.RPG_DATA, run: null, collection: null, pct: 10, state: 'idle',
    autoplay: !TEST, fast: TEST, onRunEnd: null,
  };
  globalThis.UI = UI;

  const rng = Math.random;
  let last = 0;
  let acc = 0;
  let countTimer = null;
  let toastTimer = null;
  let itemsHtml = '';
  const LANDSCAPE = '(orientation: landscape) and (max-height: 500px)';
  const isLandscape = () => Boolean(window.matchMedia && window.matchMedia(LANDSCAPE).matches);

  const monsterOf = (id) => UI.data.monsters.find((m) => m.id === id);
  const battle = () => UI.run && UI.run.battle;
  const player = () => UI.run.player;
  const cap = () => Rules.pctCap(Rules.levelFor(player().maxHp), (player().mods || Rules.NO_MODS).capBonus);

  function persistCollection() { Saves.putCollection(UI.collection).catch(() => {}); }
  function save() { if (UI.run) Saves.saveRun(UI.run); }

  // ---------- 그리기 ----------

  function logoHtml(m) {
    if (m.logo) return `<img src="${m.logo}" alt="" onerror="this.parentNode.textContent='${m.name[0]}'">`;
    return m.name[0];
  }

  function renderStatic() {
    const b = battle();
    const m = monsterOf(b.monsterId);
    $('monsterName').textContent = m.name;
    $('monsterLogo').innerHTML = logoHtml(m);
    $('monsterLabel').querySelector('b').textContent = m.name;
    $('monsterLabel').querySelector('small').textContent = `${BOARD_NAME[m.board]} · 시총 ${Format.money(m.marketCapKrw)}`;
    $('sealTag').hidden = !b.sealed;
    document.querySelector('.battleScene').dataset.board = m.board;
    if (globalThis.Backgrounds) $('battleSky').innerHTML = Backgrounds.svg(m.board);
  }

  function render() {
    const b = battle();
    if (!b) return;
    const p = player();
    const m = monsterOf(b.monsterId);
    const left = b.prices.length - 1 - b.cursor;
    $('stageInfo').textContent = `${UI.run.stage + 1} / 10 · ${BOARD_NAME[m.board]} · ${STARS[b.tier]} · ${left}칸 남음`;
    $('monsterHpText').textContent = `${Format.money(Math.max(0, b.monsterHp))} / ${Format.money(b.monsterMax)}`;
    $('monsterHpBar').style.width = `${Math.max(0, b.monsterHp / b.monsterMax) * 100}%`;
    $('tally').innerHTML = `공격 <b class="up">${Format.money(b.dealt)}</b><br>피해 <b class="dn">${Format.money(b.taken)}</b>`;
    $('priceNow').textContent = Format.price(b.prices[b.cursor], m.currency);
    const u = Rules.unrealized(b);
    const pnl = $('pnlNow');
    if (b.lot) {
      pnl.textContent = `${Format.signed(u)} (${Format.pct(u / b.lot.cost)})`;
      pnl.className = u > 0 ? 'up' : u < 0 ? 'dn' : '';
    } else {
      pnl.textContent = '보유 없음';
      pnl.className = 'dim';
    }
    const conv = b.lot && b.lot.convPrice ? `${Rules.ITEMS[b.lot.item].name} · ` : '';
    $('holdInfo').textContent = b.lot
      ? `${conv}보유 ${Format.shares(b.lot.qty)} · 평단 ${Format.price(b.lot.avg, m.currency)} · 평가 ${Format.money(b.lot.cost + u)}`
      : `보유 없음 · 현금 ${Format.money(Rules.cash(p, b))}`;
    $('holdInfo').classList.toggle('gold', Boolean(conv));
    $('playerName').textContent = `나 · Lv.${Rules.levelFor(p.maxHp)}`;
    $('playerHpText').textContent = `${Format.money(Math.max(0, p.hp))} / ${Format.money(p.maxHp)}`;
    $('playerHpBar').style.width = `${Math.max(0, Math.min(1, p.hp / p.maxHp)) * 100}%`;
    const dot = u < 0 ? -u * b.dot * (1 - (p.mods || Rules.NO_MODS).dotResist) : 0;
    $('dotInfo').textContent = dot > 0 ? `물린 동안 도트 ${Format.signed(-dot)}/칸 (×${b.dot})` : '';
    renderControls();
    drawChart();
  }

  function renderControls() {
    const b = battle();
    const c = cap();
    UI.pct = Math.min(Math.max(10, UI.pct), c);
    $('pctVal').textContent = `${UI.pct}%`;
    $('pctCap').textContent = `최대 ${c}%`;
    $('pctDown').disabled = UI.pct <= 10;
    $('pctUp').disabled = UI.pct >= c;
    const running = UI.state === 'running';
    const amount = Rules.cash(player(), b) * UI.pct / 100;
    $('btnBuy').disabled = !running || b.boughtAt === b.cursor || amount < Rules.CONFIG.minOrder || Boolean(b.lot && b.lot.convPrice);
    $('btnSell').disabled = !running || !b.lot || b.soldAt === b.cursor;
    // 이번에 사고팔 주수와 금액을 버튼에 적는다. 팔기는 끝수가 남으면 전량이 된다.
    const price = b.prices[b.cursor];
    $('buyHint').textContent = amount >= Rules.CONFIG.minOrder ? `${Format.shares(amount / price)} · 약 ${Format.money(amount)}` : '현금 부족';
    if (b.lot && b.lot.convPrice) {
      $('buyHint').textContent = '전량 판 뒤 매수';
    }
    if (b.lot) {
      const all = Boolean(b.lot.convPrice) || b.lot.cost * (1 - UI.pct / 100) < Rules.CONFIG.minOrder;
      const f = all ? 1 : UI.pct / 100;
      $('sellHint').textContent = `${all ? '전량 ' : ''}${Format.shares(b.lot.qty * f)} · 약 ${Format.money((b.lot.cost + Rules.unrealized(b)) * f)}`;
    } else {
      $('sellHint').textContent = '보유 없음';
    }
    // 같은 종류는 버튼 하나로 묶고 개수를 작게 적는다. 아이템 줄의 크기는 고정이라 개수가 바뀌어도 배치가 움직이지 않는다.
    const items = player().items;
    const kinds = Object.keys(Rules.ITEMS).filter((id) => items.includes(id));
    const canConvert = Boolean(b.lot) && !b.lot.convPrice;
    const html = kinds.map((id) => {
      const usable = running && (id === 'foresee' || canConvert);
      const n = items.filter((x) => x === id).length;
      return `<button data-kind="${id}" ${usable ? '' : 'disabled'}>${Rules.ITEMS[id].name}<span class="count">${n}</span></button>`;
    }).join('') || '<span class="noItems">아이템 없음</span>';
    // 칸마다 버튼을 새로 만들면 칸이 넘어가는 순간의 터치가 사라지므로, 바뀐 경우에만 다시 그린다.
    if (html !== itemsHtml) {
      $('items').innerHTML = html;
      itemsHtml = html;
    }
  }

  function drawChart() {
    const b = battle();
    const canvas = $('chart');
    const { w, h, dpr } = Chart.fit(canvas);
    const u = Rules.unrealized(b);
    Chart.draw(canvas.getContext('2d'), {
      prices: b.prices, cursor: b.cursor, avg: b.lot ? b.lot.avg : null, markers: Rules.markers(b),
      w, h, dpr, pnlSign: Math.sign(u), preroll: Rules.CONFIG.preroll,
    });
  }

  function toast(text, cls = '') {
    const t = $('tradeToast');
    t.textContent = text;
    t.className = `toast ${cls}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1600);
  }

  function hit(damage, crit) {
    const el = $('hitText');
    el.innerHTML = `${crit > 1 ? `<small>크리티컬 ×${crit}</small>` : ''}${Format.signed(-damage)}`;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    $('monsterLogo').classList.remove('hurt');
    void $('monsterLogo').offsetWidth;
    $('monsterLogo').classList.add('hurt');
  }

  // 진동은 사용자가 누른 매도 손실에만 쓴다. 브라우저는 터치 전 진동을 막는다.
  function hurt(vibrate = false) {
    const s = $('screen-battle');
    s.classList.remove('hurtFlash');
    void s.offsetWidth;
    s.classList.add('hurtFlash');
    if (vibrate && navigator.vibrate) navigator.vibrate(40);
  }

  // ---------- 상태 ----------

  function setState(s) {
    UI.state = s;
    $('pauseCover').hidden = s !== 'paused';
    $('countdown').hidden = s !== 'countdown';
    if (battle()) renderControls();
  }

  function startCountdown(note) {
    clearInterval(countTimer);
    setState('countdown');
    let n = COUNTDOWN;
    $('countNum').textContent = n;
    $('countNote').textContent = note || '';
    countTimer = setInterval(() => {
      n -= 1;
      if (n <= 0) UI.finishCountdown();
      else $('countNum').textContent = n;
    }, 1000);
  }

  UI.finishCountdown = () => {
    clearInterval(countTimer);
    if (UI.state !== 'countdown') return;
    // 화면을 벗어난 사이에 카운트다운이 끝나면 일시정지로 둔다.
    if (document.hidden || isLandscape()) {
      setState('paused');
      return;
    }
    last = performance.now();
    acc = 0;
    setState('running');
  };

  UI.pause = () => {
    if (UI.state !== 'running' && UI.state !== 'countdown') return;
    clearInterval(countTimer);
    setState('paused');
    save();
  };

  UI.resume = () => {
    if (UI.state === 'paused') startCountdown('');
  };

  // ---------- 진행 ----------

  function tickOnce() {
    const b = battle();
    const before = player().hp;
    const out = Rules.tick(player(), b, rng);
    if (out.dot > 0 && player().hp < before) hurt();
    save();
    render();
    if (b.result) endBattle();
  }

  UI.step = () => { if (UI.state === 'running') tickOnce(); };

  function frame(now) {
    requestAnimationFrame(frame);
    if (UI.state !== 'running' || !UI.autoplay) {
      last = now;
      return;
    }
    acc += Math.min(now - last, TICK_MS * 2);
    last = now;
    while (acc >= TICK_MS && UI.state === 'running') {
      acc -= TICK_MS;
      tickOnce();
    }
  }

  let settleTimer = null;
  let settling = null;

  function endBattle() {
    const b = battle();
    setState('result');
    const text = { win: ['처치!', `${monsterOf(b.monsterId).name}을(를) 쓰러뜨렸습니다`], timeout: ['시간 초과', `남은 체력만큼 피해를 입었습니다`], dead: ['사망', '계좌가 바닥났습니다'] }[b.result];
    $('resultTitle').textContent = text[0];
    $('resultTitle').className = `coverTitle ${b.result === 'win' ? 'gold' : 'dn'}`;
    $('resultText').textContent = text[1];
    $('battleResult').hidden = false;
    // 보상과 다음 단계를 결과 화면을 띄우기 전에 정하고 저장한다. 결과 화면 중 새로고침으로 드롭을 다시 굴리지 못하게 하기 위해서다.
    const out = Run.finishBattle(UI.run, rng);
    save();
    if (out.item) $('resultText').textContent += UI.run.pendingItem ? '' : ` · 아이템 ${Rules.ITEMS[out.item].name}`;
    settling = true;
    settleTimer = setTimeout(UI.settle, UI.fast ? 60000 : 1400);
  }

  // 결과 화면을 닫고 다음 전투나 판의 끝으로 넘어간다. 시험에서는 바로 부를 수 있다.
  UI.settle = () => {
    if (!settling) return;
    settling = false;
    clearTimeout(settleTimer);
    $('battleResult').hidden = true;
    if (UI.run.pendingItem) {
      askItem();
      return;
    }
    afterBattle();
  };

  function askItem() {
    $('newItemName').textContent = Rules.ITEMS[UI.run.pendingItem].name;
    $('replaceList').innerHTML = player().items.map((id, i) => `<button data-replace="${i}" class="solid">${Rules.ITEMS[id].name} 대신</button>`).join('');
    $('itemChoice').hidden = false;
  }

  function chooseItem(index) {
    Run.acceptItem(UI.run, index);
    $('itemChoice').hidden = true;
    save();
    afterBattle();
  }

  function afterBattle() {
    if (UI.run.status !== 'playing') {
      setState('idle');
      const run = UI.run;
      // 리포트를 만든 뒤에 진행 저장을 지운다. 중간에 실패해도 판이 사라지지 않게 하기 위해서다.
      if (UI.onRunEnd) UI.onRunEnd(run);
      else App.show('start');
      Saves.clearRun();
      return;
    }
    const next = monsterOf(UI.run.order[UI.run.stage]);
    const go = () => enterBattle();
    if (UI.transitionTo && !UI.fast) UI.transitionTo(next.board).then(go);
    else go();
  }

  function enterBattle() {
    if (!battle()) {
      Run.startBattle(UI.run, UI.data, UI.collection.seen, rng);
      persistCollection();
      save();
    }
    App.show('battle');
    renderStatic();
    render();
    startCountdown('앞 20칸을 보고 준비하세요');
  }

  // 판 시작. 끝낸 판이 없으면 마지막 보스가 봉인된다.
  UI.startNewRun = () => {
    const meta = UI.collection.meta;
    UI.run = Run.newRun(UI.data, UI.collection.seen, rng, Meta.mods(meta), { sealed: Meta.isFirstRun(meta) });
    UI.pct = 10;
    save();
    enterBattle();
  };

  // 저장된 판으로 돌아온다. 전투 중이었다면 그 칸의 일시정지 상태로 연다.
  UI.continueRun = () => {
    if (!UI.run) return;
    // 판이 끝났는데 리포트를 만들기 전에 닫힌 경우
    if (UI.run.status !== 'playing') {
      afterBattle();
      return;
    }
    if (UI.run.pendingItem) {
      App.show('battle');
      askItem();
      return;
    }
    if (!battle()) {
      enterBattle();
      return;
    }
    if (battle().result) {
      App.show('battle');
      renderStatic();
      render();
      endBattle();
      return;
    }
    App.show('battle');
    renderStatic();
    render();
    setState('paused');
  };

  // 몬스터를 쓰러뜨린 뒤 다음 회사의 배경 쪽으로 걸어 들어가는 전환. 동작 줄이기 설정이면 바로 끝난다.
  UI.transitionTo = (board) => new Promise((resolve) => {
    const el = $('transition');
    $('transitionSky').innerHTML = globalThis.Backgrounds ? Backgrounds.svg(board) : '';
    el.dataset.board = board;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(() => { el.hidden = true; resolve(); }, reduce ? 0 : 1000);
  });

  // 진행 중이거나, 끝났지만 아직 리포트를 만들지 못한 판
  UI.hasSavedRun = () => Boolean(UI.run);

  function bind() {
    $('btnBuy').addEventListener('click', () => {
      if (UI.state !== 'running') return;
      const r = Rules.buy(player(), battle(), UI.pct);
      if (r.ok) toast(`매수 ${Format.price(battle().prices[battle().cursor], monsterOf(battle().monsterId).currency)}`);
      save();
      render();
    });
    $('btnSell').addEventListener('click', () => {
      if (UI.state !== 'running') return;
      const b = battle();
      const r = Rules.sell(player(), b, UI.pct, rng);
      if (r.ok) {
        if (r.pnl > 0) {
          hit(r.damage, r.crit);
          toast(`이익 ${Format.signed(r.pnl)}`, 'up');
        } else if (r.pnl < 0) {
          hurt(true);
          toast(`손실 ${Format.signed(r.pnl)}${r.crit > 1 ? ` · 크리티컬 ×${r.crit}` : ''}`, 'dn');
        }
      }
      save();
      render();
      if (b.result) endBattle();
    });
    $('pctDown').addEventListener('click', () => { UI.pct -= 10; renderControls(); });
    $('pctUp').addEventListener('click', () => { UI.pct += 10; renderControls(); });
    $('items').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-kind]');
      if (!btn || UI.state !== 'running') return;
      const r = Rules.useItem(player(), battle(), player().items.indexOf(btn.dataset.kind));
      if (!r.ok) toast(r.reason === 'noHolding' ? '주식을 가지고 있을 때 쓸 수 있습니다' : '이미 아이템으로 바꾼 주식입니다');
      else if (!r.foresight) toast(`가진 주식을 ${Rules.ITEMS[btn.dataset.kind].name}(으)로 바꿨습니다`, 'gold');
      else if (r.foresight) toast(`예지: 5칸 뒤 ${{ up: '오른다 ▲', down: '내린다 ▼', flat: '그대로 ―' }[r.foresight]}`, r.foresight === 'up' ? 'up' : 'dn');
      save();
      render();
    });
    $('btnPause').addEventListener('click', UI.pause);
    $('btnResume').addEventListener('click', UI.resume);
    $('btnForfeit').addEventListener('click', () => {
      if (UI.state !== 'paused') return;
      Rules.forfeit(player(), battle(), rng);
      save();
      render();
      endBattle();
    });
    $('replaceList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-replace]');
      if (btn) chooseItem(Number(btn.dataset.replace));
    });
    $('btnDiscard').addEventListener('click', () => chooseItem(null));
    document.addEventListener('visibilitychange', () => { if (document.hidden) UI.pause(); });
    // 가로로 돌리면 화면이 덮이므로 멈춘다.
    if (window.matchMedia) window.matchMedia(LANDSCAPE).addEventListener('change', (e) => { if (e.matches) UI.pause(); });
    window.addEventListener('pagehide', save);
    window.addEventListener('resize', () => { if (battle() && App.current === 'battle') drawChart(); });
  }

  async function boot() {
    bind();
    UI.collection = await Saves.getCollection();
    UI.run = Saves.loadRun(Run.isValid);
    requestAnimationFrame(frame);
    if (UI.bootScreens) UI.bootScreens();
    else {
      $('btnStart').addEventListener('click', () => (UI.hasSavedRun() ? UI.continueRun() : UI.startNewRun()));
      App.show('start');
    }
  }

  UI.ready = new Promise((resolve) => { UI.boot = () => boot().then(resolve); });
})();
