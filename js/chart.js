// Canvas 주가 그래프. 계산(scale)은 DOM 없이 시험한다.
(function () {
  const MARGIN = 0.03;

  // x축은 전체 칸에 고정해 남은 시간이 보이게 하고, y축은 현재 칸까지의 값만 본다.
  function scale(prices, cursor, { w, h, pad = 8, avg = null }) {
    const seen = prices.slice(0, cursor + 1);
    let lo = Math.min(...seen);
    let hi = Math.max(...seen);
    if (avg !== null) {
      lo = Math.min(lo, avg);
      hi = Math.max(hi, avg);
    }
    if (hi === lo) {
      hi += Math.abs(hi) * 0.05 || 1;
      lo -= Math.abs(lo) * 0.05 || 1;
    }
    const m = (hi - lo) * MARGIN;
    const min = lo - m;
    const max = hi + m;
    const last = Math.max(1, prices.length - 1);
    return {
      min, max,
      x: (i) => pad + (i / last) * (w - pad * 2),
      y: (p) => pad + ((max - p) / (max - min)) * (h - pad * 2),
    };
  }

  const COLORS = { line: '#f1eefb', avg: '#e8cf8e', up: '#ff6b64', down: '#5b9bff', grid: 'rgba(255,255,255,0.07)', future: 'rgba(255,255,255,0.04)' };

  // view: { prices, cursor, avg, markers, w, h, dpr, pnlSign, preroll }
  function draw(ctx, view) {
    const { prices, cursor, avg = null, markers = [], w, h, dpr = 1, pnlSign = 0, preroll = 20 } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = scale(prices, cursor, { w, h, pad: 10, avg });

    // 미리 보여 주는 앞 칸과 남은 칸
    ctx.fillStyle = COLORS.future;
    ctx.fillRect(s.x(cursor), 0, w - s.x(cursor), h);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x(preroll), 0);
    ctx.lineTo(s.x(preroll), h);
    ctx.stroke();

    if (avg !== null) {
      ctx.strokeStyle = COLORS.avg;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, s.y(avg));
      ctx.lineTo(w, s.y(avg));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= cursor; i += 1) {
      if (i === 0) ctx.moveTo(s.x(i), s.y(prices[i]));
      else ctx.lineTo(s.x(i), s.y(prices[i]));
    }
    ctx.stroke();

    for (const m of markers) {
      if (m.cell > cursor) continue;
      const x = s.x(m.cell);
      const y = s.y(prices[m.cell]);
      ctx.fillStyle = m.kind === 'attack' ? COLORS.up : COLORS.down;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.kind === 'attack' ? '⚔' : '✕', x, y + 0.5);
    }

    const nx = s.x(cursor);
    const ny = s.y(prices[cursor]);
    ctx.fillStyle = pnlSign > 0 ? COLORS.up : pnlSign < 0 ? COLORS.down : COLORS.line;
    ctx.beginPath();
    ctx.arc(nx, ny, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    return s;
  }

  // 캔버스를 부모 크기와 화면 배율에 맞춘다.
  function fit(canvas) {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    return { w, h, dpr };
  }

  const Chart = { scale, draw, fit };
  globalThis.Chart = Chart;
  if (typeof module !== 'undefined') module.exports = Chart;
})();
