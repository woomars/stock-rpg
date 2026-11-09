// 금액과 비율 표기. 화면과 리포트가 함께 쓴다.
(function () {
  const MINUS = '−';
  const comma = (n) => Math.round(n).toLocaleString('en-US');
  const trim = (n) => String(Number(n.toFixed(1)));

  // 표시 단위로 먼저 반올림한 뒤 단위를 고른다. "10,000만"이나 "1억 10,000만"이 나오지 않게 하기 위해서다.
  function won(abs) {
    if (abs < 1e4) return `${comma(abs)}원`;
    if (abs < 1e6) {
      const v = Number((abs / 1e4).toFixed(1));
      if (v < 100) return `${trim(v)}만`;
    }
    const man = Math.round(abs / 1e4);
    if (man < 1e4) return `${comma(man)}만`;
    if (man < 1e8) {
      const eok = Math.floor(man / 1e4);
      const rest = man % 1e4;
      return rest ? `${comma(eok)}억 ${comma(rest)}만` : `${comma(eok)}억`;
    }
    const eokTotal = Math.round(abs / 1e8);
    const jo = Math.floor(eokTotal / 1e4);
    const rest = eokTotal % 1e4;
    return rest ? `${comma(jo)}조 ${comma(rest)}억` : `${comma(jo)}조`;
  }

  function money(n, currency = 'KRW') {
    const sign = n < 0 ? MINUS : '';
    const abs = Math.abs(n);
    return sign + (currency === 'USD' ? `$${abs.toFixed(2)}` : won(abs));
  }

  function price(n, currency = 'KRW') {
    if (currency !== 'USD') return `${comma(n)}원`;
    // 분할을 보정한 옛 달러 가격은 1달러보다 작을 수 있어 유효 숫자를 살린다.
    const digits = n < 1 ? 4 : n < 10 ? 3 : 2;
    return `$${n.toFixed(digits)}`;
  }

  function signed(n, currency = 'KRW') {
    const body = money(Math.abs(n), currency);
    if (n > 0) return `+${body}`;
    return n < 0 ? MINUS + body : body;
  }

  function pct(x) {
    const value = Math.abs(x) * 100;
    const body = value >= 100 ? comma(value) : trim(value);
    if (body === '0') return '0%';
    return `${x > 0 ? '+' : MINUS}${body}%`;
  }

  // 보유 수량. 자동 매매로 소수 주가 생길 수 있다.
  function shares(q) {
    if (q >= 100) return `${comma(Math.floor(q))}주`;
    if (q >= 0.01) return `${Number((Math.floor(q * 100) / 100).toFixed(2))}주`;
    return `${Number(q.toPrecision(2))}주`;
  }

  const Format = { money, price, signed, pct, shares };
  globalThis.Format = Format;
  if (typeof module !== 'undefined') module.exports = Format;
})();
