// 금액과 비율 표기. 화면과 리포트가 함께 쓴다.
(function () {
  const MINUS = '−';
  const comma = (n) => Math.round(n).toLocaleString('en-US');
  const trim = (n) => String(Number(n.toFixed(1)));

  function won(abs) {
    if (abs >= 1e12) {
      const jo = Math.floor(abs / 1e12);
      const eok = Math.round((abs - jo * 1e12) / 1e8);
      return eok ? `${comma(jo)}조 ${comma(eok)}억` : `${comma(jo)}조`;
    }
    if (abs >= 1e8) {
      const eok = Math.floor(abs / 1e8);
      const man = Math.round((abs - eok * 1e8) / 1e4);
      return man ? `${comma(eok)}억 ${comma(man)}만` : `${comma(eok)}억`;
    }
    if (abs >= 1e6) return `${comma(abs / 1e4)}만`;
    if (abs >= 1e4) return `${trim(abs / 1e4)}만`;
    return `${comma(abs)}원`;
  }

  function money(n, currency = 'KRW') {
    const sign = n < 0 ? MINUS : '';
    const abs = Math.abs(n);
    return sign + (currency === 'USD' ? `$${abs.toFixed(2)}` : won(abs));
  }

  function price(n, currency = 'KRW') {
    return currency === 'USD' ? `$${n.toFixed(2)}` : `${comma(n)}원`;
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

  const Format = { money, price, signed, pct };
  globalThis.Format = Format;
  if (typeof module !== 'undefined') module.exports = Format;
})();
