// 시작, 성장, 리포트, 단계 상세, 여정, 트로피 화면.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const t = (key, p) => I18n.t(key, p);
  const RESULT_CLS = { win: 'up', timeout: 'dn', dead: 'dn' };
  const STATUS_CLS = { clear: 'gold', dead: 'dn', survived: 'dim' };
  const resultOf = (r) => (RESULT_CLS[r] ? [t(`result.short.${r}`), RESULT_CLS[r]] : ['-', 'dim']);
  const statusOf = (st) => (STATUS_CLS[st] ? [t(`status.${st}`), STATUS_CLS[st]] : ['-', 'dim']);
  // 리포트에는 그때의 한국어 이름이 남아 있으므로 기업 id로 지금 언어의 이름을 찾는다.
  const stageName = (s) => I18n.monsterName(s.monsterId, s.name);
  const dot = (d) => (d ? d.replace(/-/g, '.') : '');
  const month = (d) => dot(d).slice(0, 7);

  let report = null;      // 보고 있는 리포트
  let reportSaved = false;
  let fromJourney = false;
  let trophyTab = 'trophy';

  // ---------- 확인 창 ----------

  function confirmBox(text, yes = t('common.ok'), no = t('common.cancel')) {
    $('confirmText').textContent = text;
    $('confirmYes').textContent = yes;
    $('confirmNo').textContent = no;
    $('confirmBox').hidden = false;
    return new Promise((resolve) => {
      const done = (v) => {
        $('confirmBox').hidden = true;
        $('confirmYes').onclick = null;
        $('confirmNo').onclick = null;
        resolve(v);
      };
      $('confirmYes').onclick = () => done(true);
      $('confirmNo').onclick = () => done(false);
    });
  }

  function persist() { return Saves.putCollection(UI.collection).catch(() => {}); }

  // ---------- 시작 ----------

  function renderStart() {
    const saved = UI.hasSavedRun();
    $('btnStart').textContent = saved ? t('start.continue') : t('start.start');
    $('btnNewRun').hidden = !saved;
    const mods = Meta.mods(UI.collection.meta);
    $('startSub').textContent = t('start.funds', { money: Format.money(Rules.CONFIG.startHp + mods.startBonus) });
    renderIOSReport();
  }

  // 아이폰일 때만 시작 화면 맨 아래의 작은 「문제 신고」 버튼(허브 공통 ios.js 의 WoomarsIOS, 글자는 지금 언어).
  // ios.js 는 defer 라 이 스크립트보다 늦게 온다 → woomars-ios-ready 때 다시 그린다. 없거나 실패하면 숨긴 채.
  function renderIOSReport() {
    const b = $('btnIOSReport');
    const ios = window.WoomarsIOS;
    if (!b) return;
    b.hidden = !(ios && ios.isIOS);
    if (!b.hidden) b.textContent = ios.reportLabel();
  }

  // ---------- 성장 ----------

  function pips(level, max) { return '●'.repeat(level) + '○'.repeat(max - level); }

  function renderGrowth() {
    const meta = UI.collection.meta;
    $('growthPoints').textContent = meta.points;
    $('growthNote').textContent = Meta.isFirstRun(meta) ? t('growth.first') : t('growth.note');
    $('upgradeList').innerHTML = Meta.UPGRADES.map((u) => {
      const lv = Meta.level(meta, u.id);
      const price = Meta.cost(meta, u.id);
      const btn = price === null
        ? `<button data-buy="${u.id}" class="maxed" disabled>${t('growth.max')}</button>`
        : `<button data-buy="${u.id}" ${meta.points < price ? 'disabled' : ''}>${t('growth.cost', { n: price })}</button>`;
      const desc = I18n.upgradeDesc(u, Format.money(u.step));
      return `<div class="upgrade"><div><b>${esc(I18n.upgradeName(u))}</b> <span class="pips">${pips(lv, u.max)}</span><small>${esc(desc)}</small></div>${btn}</div>`;
    }).join('');
  }

  function buyUpgrade(id) {
    if (Meta.buy(UI.collection.meta, id).ok) {
      persist();
      renderGrowth();
    }
  }

  // ---------- 리포트 ----------

  function onRunEnd(run) {
    const r = Report.make(run, UI.data, { id: `r${Date.now()}`, createdAt: new Date().toISOString() });
    Meta.award(UI.collection.meta, run);
    const got = Achievements.evaluate(r, UI.collection.achievements, UI.data, UI.collection.meta);
    r.trophies = got.trophies;
    r.medals = got.medals;
    Achievements.updateDex(UI.collection.dex, r);
    persist();
    UI.run = null;
    reportSaved = false;
    fromJourney = false;
    showReport(r);
  }

  function showReport(r) {
    report = r;
    const kills = r.stages.filter((s) => s.result === 'win').length;
    const timeouts = r.stages.filter((s) => s.result === 'timeout').length;
    $('reportTitle').textContent = Report.TITLES[r.status] ? t(`report.title.${r.status}`) : r.title;
    $('reportTitle').className = `reportTitle ${r.status === 'clear' ? '' : 'over'}`;
    $('reportSub').textContent = t('report.sub', { kills, timeouts, points: r.points });
    $('reportFinal').textContent = Format.money(r.finalHp);
    $('reportPnl').textContent = `${Format.signed(r.pnl)} (${Format.pct(r.pnlPct)})`;
    $('reportPnl').className = r.pnl > 0 ? 'up' : r.pnl < 0 ? 'dn' : '';
    $('reportWin').textContent = `${Math.round(r.winRate * 100)}%`;
    $('reportCrit').textContent = t('report.critCount', { n: r.crits });
    $('reportHold').textContent = `${Format.pct(r.vsHoldPct).replace('%', '%p')}`;
    $('reportHold').className = r.vsHoldPct > 0 ? 'up' : r.vsHoldPct < 0 ? 'dn' : '';
    const badges = [];
    if (r.trophies.length) badges.push(`<span class="chip">${t('report.newTrophies', { n: r.trophies.length })}</span>`);
    if (r.medals.length) badges.push(`<span class="chip">${t('report.medals', { n: r.medals.length })}</span>`);
    $('reportBadges').innerHTML = badges.join('');
    // 이번 판에 받은 트로피와 메달의 이름
    const all = [...Achievements.TROPHIES, ...Achievements.MEDALS];
    const names = [...r.trophies, ...r.medals].map((id) => all.find((x) => x.id === id)).filter(Boolean);
    $('reportAwards').innerHTML = names.map((x) => `<span>${x.icon} ${esc(I18n.achName(x))}</span>`).join('');
    $('reportAwards').hidden = names.length === 0;
    $('reportList').innerHTML = r.stages.map((s, i) => {
      const [label, cls] = resultOf(s.result);
      return `<button class="line" data-stage="${i}"><span class="st ${cls}">${label}</span>`
        + `<div class="name">${esc(stageName(s))}${s.sealed ? ' 🔒' : ''}<small>${month(s.from)} ~ ${month(s.to)}</small></div>`
        + `<span class="tally2">${t('battle.dealt')} <span class="up">${Format.money(s.dealt)}</span><br>${t('battle.taken')} <span class="dn">${Format.money(s.taken)}</span></span></button>`;
    }).join('');
    $('btnSaveReport').hidden = fromJourney;
    $('btnSaveReport').disabled = reportSaved;
    $('btnSaveReport').textContent = reportSaved ? t('report.saved') : t('report.save');
    $('btnAgain').hidden = fromJourney;
    $('btnExit').textContent = fromJourney ? t('report.toJourney') : t('report.exit');
    App.show('report');
  }

  async function leaveReport(target) {
    if (!fromJourney && !reportSaved) {
      const ok = await confirmBox(t('report.leaveAsk'), t('report.leave'), t('common.cancel'));
      if (!ok) return;
    }
    if (target === 'growth') {
      renderGrowth();
      App.show('growth');
    } else if (fromJourney) {
      showJourney();
    } else {
      renderStart();
      App.show('start');
    }
  }

  // ---------- 단계 상세 ----------

  function momentText(m) {
    if (m.kind === 'attack') return m.crit > 1 ? t('battle.crit', { n: m.crit }) : t('stage.attack');
    if (m.dot) return t('stage.dot', { n: m.to - m.from + 1 });
    if (m.timeout) return t('stage.timeout');
    return m.crit > 1 ? t('stage.lossCrit', { n: m.crit }) : t('stage.loss');
  }

  function showStage(i) {
    const s = report.stages[i];
    const [label, cls] = resultOf(s.result);
    $('stageTitle').textContent = t('stage.title', { n: i + 1, name: stageName(s) });
    $('stageResult').textContent = label;
    $('stageResult').className = cls;
    $('stageDates').textContent = `${dot(s.from)} ~ ${dot(s.to)} · ${'★'.repeat(s.tier)}${'☆'.repeat(3 - s.tier)}`;
    $('stageDealt').textContent = Format.money(s.dealt);
    $('stageTaken').textContent = Format.money(s.taken);
    $('stageHold').textContent = Format.pct(s.holdPct);
    $('stageHold').className = s.holdPct > 0 ? 'up' : 'dn';
    const top = [...s.markers].sort((a, b) => b.amount - a.amount).slice(0, 5).sort((a, b) => a.cell - b.cell);
    $('stageMoments').innerHTML = top.length ? top.map((m) => `<div class="line"><span class="st ${m.kind === 'attack' ? 'up' : 'dn'}">${m.kind === 'attack' ? '⚔' : '✕'}</span>`
      + `<div>${momentText(m)}<small>${t('stage.cell', { n: m.cell - Rules.CONFIG.preroll + 1 })}</small></div><b class="${m.kind === 'attack' ? 'up' : 'dn'}">${Format.signed(m.kind === 'attack' ? m.amount : -m.amount)}</b></div>`).join('')
      : `<p class="dim">${t('stage.none')}</p>`;
    App.show('stage');
    const canvas = $('stageChart');
    const { w, h, dpr } = Chart.fit(canvas);
    Chart.draw(canvas.getContext('2d'), { prices: s.prices, cursor: s.cursorEnd, markers: s.markers, w, h, dpr, preroll: Rules.CONFIG.preroll });
  }

  // ---------- 여정 ----------

  async function showJourney() {
    App.show('journey');
    const reports = await Saves.listReports();
    $('journeyCount').textContent = t('journey.count', { runs: reports.length, clears: reports.filter((r) => r.status === 'clear').length });
    $('journeyEmpty').hidden = reports.length > 0;
    $('btnJourneyStart').textContent = UI.hasSavedRun() ? t('start.continue') : t('start.start');
    $('journeyList').hidden = reports.length === 0;
    $('journeyBest').hidden = reports.length === 0;
    if (reports.length) {
      const best = reports.reduce((a, b) => (b.finalHp > a.finalHp ? b : a));
      const bestPct = Math.max(...reports.map((r) => r.pnlPct));
      const kills = Math.max(...reports.map((r) => r.stages.filter((s) => s.result === 'win').length));
      $('journeyBest').innerHTML = `<div><small>${t('journey.bestHp')}</small><b>${Format.money(best.finalHp)}</b></div>`
        + `<div><small>${t('journey.bestPct')}</small><b class="${bestPct > 0 ? 'up' : 'dn'}">${Format.pct(bestPct)}</b></div>`
        + `<div><small>${t('journey.mostKills')}</small><b>${t('journey.killCount', { n: kills })}</b></div>`;
    }
    $('journeyList').innerHTML = reports.map((r) => {
      const [label, cls] = statusOf(r.status);
      const kills = r.stages.filter((s) => s.result === 'win').length;
      const last = r.stages[r.stages.length - 1];
      const title = r.status === 'dead' && last ? esc(t('journey.diedAt', { name: stageName(last) })) : Format.money(r.finalHp);
      return `<button class="line" data-report="${esc(r.id)}"><span class="st ${cls}">${label}</span>`
        + `<div class="name">${title}<small>${r.createdAt.slice(0, 10).replace(/-/g, '.')} · ${t('journey.kills', { n: kills })}</small></div>`
        + `<b class="${r.pnl > 0 ? 'up' : 'dn'}">${Format.pct(r.pnlPct)}</b></button>`;
    }).join('');
    UI.journeyReports = reports;
  }

  async function exportBackup() {
    const text = await Saves.exportAll();
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stock-rpg-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $('backupMsg').textContent = t('journey.exported');
  }

  // 백업 불러오기. 잘못된 파일이면 기존 기록을 건드리지 않는다.
  UI.importText = async (text) => {
    try {
      await Saves.importAll(text);
      UI.collection = await Saves.getCollection();
      $('backupMsg').textContent = t('journey.imported');
      if (App.current === 'journey') await showJourney();
    } catch (e) {
      const why = e.code ? t(`backup.${e.code}`) : e instanceof SyntaxError || e.message.includes('JSON') ? t('backup.bad') : e.message;
      $('backupMsg').textContent = t('journey.importFailed', { why });
    }
  };

  // ---------- 트로피 ----------

  function renderTrophy() {
    const a = UI.collection.achievements;
    const total = Achievements.TROPHIES.length + Achievements.MEDALS.length;
    $('trophyCount').textContent = `${a.trophies.length + a.medals.length} / ${total}`;
    for (const b of document.querySelectorAll('#trophyTabs button')) b.classList.toggle('on', b.dataset.tab === trophyTab);
    $('trophyDetail').hidden = true;
    let html = '';
    if (trophyTab === 'dex') {
      const dex = UI.collection.dex;
      const ms = [...UI.data.monsters].sort((x, y) => x.marketCapKrw - y.marketCapKrw);
      html = `<div class="groupLabel">${t('trophy.dexCount', { kills: ms.filter((m) => dex[m.id] && dex[m.id].kills).length, total: ms.length })}</div><div class="grid">`
        + ms.map((m) => {
          const d = dex[m.id];
          const met = d && d.met;
          const name = I18n.monster(m).name;
          return `<button class="tile ${d && d.kills ? '' : 'off'}" data-dex="${esc(m.id)}"><i>${met ? esc(name[0]) : '?'}</i>${met ? esc(name) : '???'}</button>`;
        }).join('') + '</div>';
    } else {
      const list = trophyTab === 'trophy' ? Achievements.TROPHIES : Achievements.MEDALS;
      const owned = trophyTab === 'trophy' ? a.trophies : a.medals;
      const groups = [...new Set(list.map((x) => x.group))];
      html = groups.map((g) => `<div class="groupLabel">${t(`group.${g}`)}</div><div class="grid">${list.filter((x) => x.group === g)
        .map((x) => `<button class="tile ${owned.includes(x.id) ? '' : 'off'}" data-ach="${x.id}"><i>${x.icon}</i>${esc(I18n.achName(x))}</button>`).join('')}</div>`).join('');
    }
    $('trophyPane').innerHTML = html;
  }

  function showDetail(html) {
    $('trophyDetail').innerHTML = html;
    $('trophyDetail').hidden = false;
  }

  function startOrContinue() {
    if (UI.hasSavedRun()) UI.continueRun();
    else {
      renderGrowth();
      App.show('growth');
    }
  }

  // ---------- 연결 ----------

  function bind() {
    $('btnStart').addEventListener('click', startOrContinue);
    $('btnNewRun').addEventListener('click', async () => {
      if (!(await confirmBox(t('start.newRunAsk'), t('start.newRun'), t('common.cancel')))) return;
      Saves.clearRun();
      UI.run = null;
      renderGrowth();
      App.show('growth');
    });
    $('btnJourney').addEventListener('click', showJourney);
    $('btnTrophy').addEventListener('click', () => {
      trophyTab = 'trophy';
      renderTrophy();
      App.show('trophy');
    });
    $('upgradeList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy]');
      if (b && !b.disabled) buyUpgrade(b.dataset.buy);
    });
    $('btnDepart').addEventListener('click', () => UI.startNewRun());
    $('btnGrowthBack').addEventListener('click', () => {
      renderStart();
      App.show('start');
    });
    $('btnSaveReport').addEventListener('click', async () => {
      try {
        await Saves.putReport(report);
      } catch {
        $('btnSaveReport').textContent = t('report.saveFailed');
        return;
      }
      reportSaved = true;
      $('btnSaveReport').disabled = true;
      $('btnSaveReport').textContent = t('report.saved');
    });
    $('btnAgain').addEventListener('click', () => leaveReport('growth'));
    $('btnExit').addEventListener('click', () => leaveReport('start'));
    $('reportList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-stage]');
      if (b) showStage(Number(b.dataset.stage));
    });
    $('btnStageBack').addEventListener('click', () => App.show('report'));
    $('journeyList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-report]');
      if (!b) return;
      fromJourney = true;
      showReport(UI.journeyReports.find((r) => r.id === b.dataset.report));
    });
    // 진행 중인 판이 있으면 시작 화면의 버튼처럼 이어 한다. 확인 없이 판을 버리지 않기 위해서다.
    $('btnJourneyStart').addEventListener('click', startOrContinue);
    $('btnJourneyBack').addEventListener('click', () => {
      renderStart();
      App.show('start');
    });
    $('btnExport').addEventListener('click', exportBackup);
    $('importFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (!(await confirmBox(t('journey.importAsk'), t('journey.importYes'), t('common.cancel')))) return;
      await UI.importText(await file.text());
    });
    $('trophyTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      trophyTab = b.dataset.tab;
      renderTrophy();
    });
    $('trophyPane').addEventListener('click', (e) => {
      const tile = e.target.closest('[data-ach]');
      if (tile) {
        const x = [...Achievements.TROPHIES, ...Achievements.MEDALS].find((y) => y.id === tile.dataset.ach);
        const owned = [...UI.collection.achievements.trophies, ...UI.collection.achievements.medals].includes(x.id);
        showDetail(`<b>${x.icon} ${esc(I18n.achName(x))}</b> <span class="${owned ? 'gold' : 'dim'}">${owned ? t('trophy.owned') : t('trophy.notYet')}</span><br><span class="dim">${esc(I18n.achDesc(x))}</span>`);
        return;
      }
      const d = e.target.closest('[data-dex]');
      if (d) {
        const m = UI.data.monsters.find((y) => y.id === d.dataset.dex);
        const row = UI.collection.dex[m.id];
        const local = I18n.monster(m);
        showDetail(row && row.met
          ? `<b>${esc(local.name)}</b> <span class="dim">${t('trophy.dexRow', { met: row.met, kills: row.kills, best: Format.money(row.bestDealt) })}</span><br>${esc(local.desc)}`
          : `<b>???</b> <span class="dim">${t('trophy.unmet')}</span>`);
      }
    });
    $('btnTrophyBack').addEventListener('click', () => {
      renderStart();
      App.show('start');
    });
  }

  UI.bootScreens = () => {
    bind();
    $('btnIOSReport').addEventListener('click', () => { if (window.WoomarsIOS) window.WoomarsIOS.report(); });
    window.addEventListener('woomars-ios-ready', renderIOSReport);
    // 언어 고르기는 시작 화면과 일시정지 화면에 있다. 시작 화면은 바로 다시 그린다.
    I18n.onChange(() => { if (App.current === 'start') renderStart(); });
    UI.onRunEnd = onRunEnd;
    renderStart();
    App.show('start');
  };
})();
