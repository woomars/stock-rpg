// 시장별 배경 그림. 코스닥은 벤처 거리 야경, 코스피는 여의도, S&P는 월가다.
(function () {
  const VIEW = 'viewBox="0 0 360 160" preserveAspectRatio="xMidYMax slice" aria-hidden="true"';

  function windows(xs, ys, color, opacity) {
    let out = `<g fill="${color}" opacity="${opacity}">`;
    for (const [x, y] of xs.flatMap((x) => ys.map((y) => [x, y]))) out += `<rect x="${x}" y="${y}" width="3" height="4"/>`;
    return `${out}</g>`;
  }

  const ART = {
    KOSDAQ: `<svg ${VIEW}>
      <path fill="#170c2f" d="M0 160V95h28V70h34v40h26V52h38v70h22V80h30v32h26V58h36v56h28V84h30v24h34v52z"/>
      <path fill="#22123f" d="M0 160v-38h38v-16h44v24h36v-30h34v32h44v-22h38v22h36v-34h38v34h52v28z"/>
      <rect x="96" y="60" width="22" height="9" rx="2" fill="#ff4fa3" opacity=".85"/>
      <rect x="236" y="66" width="26" height="8" rx="2" fill="#3ee6ff" opacity=".8"/>
      <rect x="40" y="78" width="14" height="6" rx="2" fill="#b26bff" opacity=".8"/>
      ${windows([34, 44, 102, 110, 196, 252, 262, 300], [84, 96], '#ffdf7e', 0.7)}
    </svg>`,
    KOSPI: `<svg ${VIEW}>
      <path fill="#0b2140" d="M0 160V88h30V60h26v48h30V30h30v84h26V50h34v62h28V20h18l6-8 6 8v100h30V64h32v52h34V80h20v80z"/>
      <path fill="#d9a43a" opacity=".9" d="M196 20h18v100h-18z"/>
      <path fill="#12305a" d="M0 160v-30h50v-12h40v20h46v-16h40v18h60v-14h44v16h80v18z"/>
      <rect y="150" width="360" height="10" fill="#1d4a7a" opacity=".6"/>
      ${windows([66, 74, 92, 100, 238, 246, 300, 310], [44, 60, 76, 92], '#cfe8ff', 0.55)}
    </svg>`,
    US: `<svg ${VIEW}>
      <path fill="#2a2110" d="M0 160V70h26V40h30v80h20V24h34v96h22V56h30v64h24V30h12V18h12v12h12v90h30V62h28v58h24V76h26v84z"/>
      <path fill="#e8dcc0" opacity=".9" d="M110 120V84l40-18 40 18v36z"/>
      <g fill="#2a2110"><rect x="118" y="90" width="7" height="30"/><rect x="133" y="90" width="7" height="30"/><rect x="148" y="90" width="7" height="30"/><rect x="163" y="90" width="7" height="30"/><rect x="178" y="90" width="7" height="30"/></g>
      <path fill="#3b2f16" d="M0 160v-26h110v-6h80v8h70v-12h100v36z"/>
      ${windows([36, 44, 84, 92, 226, 234, 300, 310], [48, 62, 76], '#ffd890', 0.6)}
    </svg>`,
  };

  function svg(board) { return ART[board] || ART.KOSDAQ; }

  const Backgrounds = { svg, BOARDS: Object.keys(ART) };
  globalThis.Backgrounds = Backgrounds;
  if (typeof module !== 'undefined') module.exports = Backgrounds;
})();
