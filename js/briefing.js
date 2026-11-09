// 전투 시작 브리핑: 시작 날짜, 시장 분위기(직전 3개월 지수), 시대 분위기.
(function () {
  const MINUS = '−';
  const FLAT = 0.03;

  // 시장별 주요 시기. 날짜는 대략의 구간이다.
  const ERAS = [
    { from: '2000-03-01', to: '2002-10-31', markets: ['KR', 'US'], name: '닷컴 버블 붕괴', note: '기술주 거품이 꺼지며 긴 하락이 이어지던 때' },
    { from: '2001-09-11', to: '2001-10-31', markets: ['KR', 'US'], name: '9·11 테러 충격', note: '테러 직후 세계 증시가 급락했다' },
    { from: '2003-03-01', to: '2007-06-30', markets: ['KR'], name: '중국 성장과 대세 상승', note: '조선·철강·화학이 이끈 긴 상승장' },
    { from: '2007-07-01', to: '2008-08-31', markets: ['KR', 'US'], name: '서브프라임 위기', note: '미국 부동산 대출 부실이 터지기 시작했다' },
    { from: '2008-09-01', to: '2009-03-31', markets: ['KR', 'US'], name: '글로벌 금융위기', note: '리먼 브라더스 파산 뒤 세계 증시가 폭락했다' },
    { from: '2009-04-01', to: '2010-04-30', markets: ['KR', 'US'], name: '금융위기 뒤 반등', note: '각국의 돈 풀기로 가파르게 회복했다' },
    { from: '2010-05-01', to: '2012-07-31', markets: ['KR', 'US'], name: '유럽 재정위기', note: '그리스발 위기와 미국 신용등급 강등이 겹쳤다' },
    { from: '2015-06-01', to: '2016-02-29', markets: ['KR', 'US'], name: '중국 증시 폭락', note: '중국발 충격이 세계 시장을 흔들었다' },
    { from: '2018-03-01', to: '2018-12-31', markets: ['KR', 'US'], name: '미중 무역분쟁', note: '관세 전쟁으로 반도체와 수출주가 흔들렸다' },
    { from: '2020-02-15', to: '2020-03-31', markets: ['KR', 'US'], name: '코로나 폭락', note: '팬데믹 공포로 한 달 만에 30% 넘게 빠졌다' },
    { from: '2020-04-01', to: '2021-06-30', markets: ['KR', 'US'], name: '코로나 뒤 유동성 랠리', note: '돈 풀기와 개인 투자 열풍으로 급등했다' },
    { from: '2022-01-01', to: '2022-10-31', markets: ['KR', 'US'], name: '금리 인상 약세장', note: '물가를 잡으려는 급격한 금리 인상기' },
    { from: '2023-01-01', to: '2023-07-31', markets: ['KR'], name: '2차전지 열풍', note: '배터리 종목에 개인 매수가 몰렸다' },
    { from: '2023-01-01', to: '2024-07-31', markets: ['US'], name: 'AI 랠리', note: '생성형 AI 기대감에 반도체·빅테크가 급등했다' },
  ];

  function dateText(d) {
    const [y, m, day] = d.split('-').map(Number);
    return `${y}년 ${m}월 ${day}일`;
  }

  function pct(x) {
    const v = Math.round(Math.abs(x) * 100);
    if (v === 0) return '0%';
    return `${x > 0 ? '+' : MINUS}${v}%`;
  }

  function mood(m) {
    if (!m || !Number.isFinite(m.ret3m)) return null;
    const label = m.ret3m >= FLAT ? '상승장' : m.ret3m <= -FLAT ? '하락장' : '횡보';
    const cls = label === '상승장' ? 'up' : label === '하락장' ? 'dn' : 'dim';
    return { label, cls, text: `${m.index} 지난 3개월 ${pct(m.ret3m)}` };
  }

  // 그 날짜가 들어가는 시기 중 가장 짧은(구체적인) 것
  function era(date, market) {
    const hits = ERAS.filter((e) => e.markets.includes(market) && e.from <= date && date <= e.to);
    if (!hits.length) return null;
    return hits.reduce((a, b) => (b.to.localeCompare(b.from) && (Date.parse(b.to) - Date.parse(b.from)) < (Date.parse(a.to) - Date.parse(a.from)) ? b : a));
  }

  const Briefing = { ERAS, dateText, mood, era };
  globalThis.Briefing = Briefing;
  if (typeof module !== 'undefined') module.exports = Briefing;
})();
