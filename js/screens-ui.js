// 시작, 성장, 리포트, 단계 상세, 여정, 트로피 화면.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RESULT = { win: ['승', 'up'], timeout: ['초과', 'dn'], dead: ['사망', 'dn'] };
  const STATUS = { clear: ['클리어', 'gold'], dead: ['사망', 'dn'], survived: ['생존', 'dim'] };
  const dot = (d) => (d ? d.replace(/-/g, '.') : '');
  const month = (d) => dot(d).slice(0, 7);

  let report = null;      // 보고 있는 리포트
  let reportSaved = false;
  let fromJourney = false;
  let trophyTab = 'trophy';

  // ---------- 확인 창 ----------

  function confirmBox(text, yes = '확인', no = '취소') {
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
    $('btnStart').textContent = saved ? '이어 하기' : '시작하기';
    $('btnNewRun').hidden = !saved;
    const mods = Meta.mods(UI.collection.meta);
    $('startSub').textContent = `초기 자금 ${Format.money(Rules.CONFIG.startHp + mods.startBonus)}`;
  }

  // ---------- 성장 ----------

  function pips(level, max) { return '●'.repeat(level) + '○'.repeat(max - level); }

  function renderGrowth() {
    const meta = UI.collection.meta;
    $('growthPoints').textContent = meta.points;
    $('growthNote').textContent = Meta.isFirstRun(meta)
      ? '첫 판입니다. 마지막 보스는 봉인되어 있어 이길 수 없습니다. 죽으면 내공이 쌓입니다.'
      : '죽어도 내공은 남습니다. 강화는 다음 판부터 계속 적용됩니다.';
    $('upgradeList').innerHTML = Meta.UPGRADES.map((u) => {
      const lv = Meta.level(meta, u.id);
      const price = Meta.cost(meta, u.id);
      const btn = price === null
        ? `<button data-buy="${u.id}" class="maxed" disabled>최대</button>`
        : `<button data-buy="${u.id}" ${meta.points < price ? 'disabled' : ''}>내공 ${price}</button>`;
      return `<div class="upgrade"><div><b>${u.name}</b> <span class="pips">${pips(lv, u.max)}</span><small>${u.desc}</small></div>${btn}</div>`;
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
    $('reportTitle').textContent = r.title;
    $('reportTitle').className = `reportTitle ${r.status === 'clear' ? '' : 'over'}`;
    $('reportSub').textContent = `${kills}마리 처치 · 시간 초과 ${timeouts} · 내공 +${r.points}`;
    $('reportFinal').textContent = Format.money(r.finalHp);
    $('reportPnl').textContent = `${Format.signed(r.pnl)} (${Format.pct(r.pnlPct)})`;
    $('reportPnl').className = r.pnl > 0 ? 'up' : r.pnl < 0 ? 'dn' : '';
    $('reportWin').textContent = `${Math.round(r.winRate * 100)}%`;
    $('reportCrit').textContent = `${r.crits}회`;
    $('reportHold').textContent = `${Format.pct(r.vsHoldPct).replace('%', '%p')}`;
    $('reportHold').className = r.vsHoldPct > 0 ? 'up' : r.vsHoldPct < 0 ? 'dn' : '';
    const badges = [];
    if (r.trophies.length) badges.push(`<span class="chip">새 트로피 ${r.trophies.length}</span>`);
    if (r.medals.length) badges.push(`<span class="chip">메달 ${r.medals.length}</span>`);
    $('reportBadges').innerHTML = badges.join('');
    // 이번 판에 받은 트로피와 메달의 이름
    const all = [...Achievements.TROPHIES, ...Achievements.MEDALS];
    const names = [...r.trophies, ...r.medals].map((id) => all.find((x) => x.id === id)).filter(Boolean);
    $('reportAwards').innerHTML = names.map((x) => `<span>${x.icon} ${esc(x.name)}</span>`).join('');
    $('reportAwards').hidden = names.length === 0;
    $('reportList').innerHTML = r.stages.map((s, i) => {
      const [label, cls] = RESULT[s.result] || ['-', 'dim'];
      return `<button class="line" data-stage="${i}"><span class="st ${cls}">${label}</span>`
        + `<div class="name">${esc(s.name)}${s.sealed ? ' 🔒' : ''}<small>${month(s.from)} ~ ${month(s.to)}</small></div>`
        + `<span class="tally2">공격 <span class="up">${Format.money(s.dealt)}</span><br>피해 <span class="dn">${Format.money(s.taken)}</span></span></button>`;
    }).join('');
    $('btnSaveReport').hidden = fromJourney;
    $('btnSaveReport').disabled = reportSaved;
    $('btnSaveReport').textContent = reportSaved ? '저장됨' : '리포트 저장';
    $('btnAgain').hidden = fromJourney;
    $('btnExit').textContent = fromJourney ? '← 여정으로' : '종료';
    App.show('report');
  }

  async function leaveReport(target) {
    if (!fromJourney && !reportSaved) {
      const ok = await confirmBox('리포트를 저장하지 않았습니다. 그래도 나갈까요?', '나가기', '취소');
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
    if (m.kind === 'attack') return m.crit > 1 ? `크리티컬 ×${m.crit}` : '공격';
    if (m.dot) return `물린 채 도트 (${m.to - m.from + 1}칸)`;
    if (m.timeout) return '시간 초과 피해';
    return m.crit > 1 ? `손실 크리티컬 ×${m.crit}` : '손실 매도';
  }

  function showStage(i) {
    const s = report.stages[i];
    const [label, cls] = RESULT[s.result] || ['-', 'dim'];
    $('stageTitle').textContent = `${i + 1}단계 · ${s.name}`;
    $('stageResult').textContent = label;
    $('stageResult').className = cls;
    $('stageDates').textContent = `${dot(s.from)} ~ ${dot(s.to)} · ${'★'.repeat(s.tier)}${'☆'.repeat(3 - s.tier)}`;
    $('stageDealt').textContent = Format.money(s.dealt);
    $('stageTaken').textContent = Format.money(s.taken);
    $('stageHold').textContent = Format.pct(s.holdPct);
    $('stageHold').className = s.holdPct > 0 ? 'up' : 'dn';
    const top = [...s.markers].sort((a, b) => b.amount - a.amount).slice(0, 5).sort((a, b) => a.cell - b.cell);
    $('stageMoments').innerHTML = top.length ? top.map((m) => `<div class="line"><span class="st ${m.kind === 'attack' ? 'up' : 'dn'}">${m.kind === 'attack' ? '⚔' : '✕'}</span>`
      + `<div>${momentText(m)}<small>${m.cell - Rules.CONFIG.preroll + 1}칸째</small></div><b class="${m.kind === 'attack' ? 'up' : 'dn'}">${Format.signed(m.kind === 'attack' ? m.amount : -m.amount)}</b></div>`).join('')
      : '<p class="dim">큰 공격이나 피해가 없었습니다.</p>';
    App.show('stage');
    const canvas = $('stageChart');
    const { w, h, dpr } = Chart.fit(canvas);
    Chart.draw(canvas.getContext('2d'), { prices: s.prices, cursor: s.cursorEnd, markers: s.markers, w, h, dpr, preroll: Rules.CONFIG.preroll });
  }

  // ---------- 여정 ----------

  async function showJourney() {
    App.show('journey');
    const reports = await Saves.listReports();
    $('journeyCount').textContent = `${reports.length}판 · 클리어 ${reports.filter((r) => r.status === 'clear').length}`;
    $('journeyEmpty').hidden = reports.length > 0;
    $('btnJourneyStart').textContent = UI.hasSavedRun() ? '이어 하기' : '시작하기';
    $('journeyList').hidden = reports.length === 0;
    $('journeyBest').hidden = reports.length === 0;
    if (reports.length) {
      const best = reports.reduce((a, b) => (b.finalHp > a.finalHp ? b : a));
      const bestPct = Math.max(...reports.map((r) => r.pnlPct));
      const kills = Math.max(...reports.map((r) => r.stages.filter((s) => s.result === 'win').length));
      $('journeyBest').innerHTML = `<div><small>최고 계좌</small><b>${Format.money(best.finalHp)}</b></div>`
        + `<div><small>최고 수익</small><b class="${bestPct > 0 ? 'up' : 'dn'}">${Format.pct(bestPct)}</b></div><div><small>최다 격파</small><b>${kills}마리</b></div>`;
    }
    $('journeyList').innerHTML = reports.map((r) => {
      const [label, cls] = STATUS[r.status] || ['-', 'dim'];
      const kills = r.stages.filter((s) => s.result === 'win').length;
      const last = r.stages[r.stages.length - 1];
      const title = r.status === 'dead' && last ? `${esc(last.name)}에서` : Format.money(r.finalHp);
      return `<button class="line" data-report="${esc(r.id)}"><span class="st ${cls}">${label}</span>`
        + `<div class="name">${title}<small>${r.createdAt.slice(0, 10).replace(/-/g, '.')} · ${kills}마리 처치</small></div>`
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
    $('backupMsg').textContent = '백업 파일을 내려받았습니다.';
  }

  // 백업 불러오기. 잘못된 파일이면 기존 기록을 건드리지 않는다.
  UI.importText = async (text) => {
    try {
      await Saves.importAll(text);
      UI.collection = await Saves.getCollection();
      $('backupMsg').textContent = '백업을 불러왔습니다.';
      if (App.current === 'journey') await showJourney();
    } catch (e) {
      $('backupMsg').textContent = `불러오기 실패: ${e.message.includes('JSON') ? '파일 내용이 올바르지 않습니다' : e.message}`;
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
      html = `<div class="groupLabel">처치한 기업 ${ms.filter((m) => dex[m.id] && dex[m.id].kills).length} / ${ms.length}</div><div class="grid">`
        + ms.map((m) => {
          const d = dex[m.id];
          const met = d && d.met;
          return `<button class="tile ${d && d.kills ? '' : 'off'}" data-dex="${esc(m.id)}"><i>${met ? esc(m.name[0]) : '?'}</i>${met ? esc(m.name) : '???'}</button>`;
        }).join('') + '</div>';
    } else {
      const list = trophyTab === 'trophy' ? Achievements.TROPHIES : Achievements.MEDALS;
      const owned = trophyTab === 'trophy' ? a.trophies : a.medals;
      const groups = [...new Set(list.map((x) => x.group))];
      html = groups.map((g) => `<div class="groupLabel">${g}</div><div class="grid">${list.filter((x) => x.group === g)
        .map((x) => `<button class="tile ${owned.includes(x.id) ? '' : 'off'}" data-ach="${x.id}"><i>${x.icon}</i>${esc(x.name)}</button>`).join('')}</div>`).join('');
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
      if (!(await confirmBox('진행 중인 판을 버리고 새로 시작할까요? 그 판의 내공은 받지 못합니다.', '새로 시작', '취소'))) return;
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
        $('btnSaveReport').textContent = '저장 실패 · 다시 시도';
        return;
      }
      reportSaved = true;
      $('btnSaveReport').disabled = true;
      $('btnSaveReport').textContent = '저장됨';
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
      if (!(await confirmBox('지금 기록을 지우고 백업으로 바꿀까요?', '불러오기', '취소'))) return;
      await UI.importText(await file.text());
    });
    $('trophyTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      trophyTab = b.dataset.tab;
      renderTrophy();
    });
    $('trophyPane').addEventListener('click', (e) => {
      const t = e.target.closest('[data-ach]');
      if (t) {
        const x = [...Achievements.TROPHIES, ...Achievements.MEDALS].find((y) => y.id === t.dataset.ach);
        const owned = [...UI.collection.achievements.trophies, ...UI.collection.achievements.medals].includes(x.id);
        showDetail(`<b>${x.icon} ${esc(x.name)}</b> <span class="${owned ? 'gold' : 'dim'}">${owned ? '받음' : '아직'}</span><br><span class="dim">${esc(x.desc)}</span>`);
        return;
      }
      const d = e.target.closest('[data-dex]');
      if (d) {
        const m = UI.data.monsters.find((y) => y.id === d.dataset.dex);
        const row = UI.collection.dex[m.id];
        showDetail(row && row.met
          ? `<b>${esc(m.name)}</b> <span class="dim">만난 횟수 ${row.met} · 처치 ${row.kills} · 최고 공격 ${Format.money(row.bestDealt)}</span>`
          : '<b>???</b> <span class="dim">아직 만나지 못한 기업입니다.</span>');
      }
    });
    $('btnTrophyBack').addEventListener('click', () => {
      renderStart();
      App.show('start');
    });
  }

  UI.bootScreens = () => {
    bind();
    UI.onRunEnd = onRunEnd;
    renderStart();
    App.show('start');
  };
})();
