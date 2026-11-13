// 금액과 비율 표기. 화면과 리포트가 함께 쓴다.
(function () {
  const MINUS = '−';
  const comma = (n) => Math.round(n).toLocaleString('en-US');
  const trim = (n) => String(Number(n.toFixed(1)));

  const lang = () => (globalThis.I18n ? globalThis.I18n.lang : 'ko');
  // 원화 단위. 일본어도 만·억·조를 쓰는 말이라 같은 틀에 글자만 바꾼다.
  const UNITS = { ko: ['만', '억', '조', '원', ' '], ja: ['万', '億', '兆', 'ウォン', ''] };

  // 표시 단위로 먼저 반올림한 뒤 단위를 고른다. "10,000만"이나 "1억 10,000만"이 나오지 않게 하기 위해서다.
  function won(abs) {
    if (lang() === 'en') return wonEn(abs);
    const [MAN, EOK, JO, WON, SP] = UNITS[lang()] || UNITS.ko;
    if (abs < 1e4) return `${comma(abs)}${WON}`;
    if (abs < 1e6) {
      const v = Number((abs / 1e4).toFixed(1));
      if (v < 100) return `${trim(v)}${MAN}`;
    }
    const man = Math.round(abs / 1e4);
    if (man < 1e4) return `${comma(man)}${MAN}`;
    if (man < 1e8) {
      const eok = Math.floor(man / 1e4);
      const rest = man % 1e4;
      return rest ? `${comma(eok)}${EOK}${SP}${comma(rest)}${MAN}` : `${comma(eok)}${EOK}`;
    }
    const eokTotal = Math.round(abs / 1e8);
    const jo = Math.floor(eokTotal / 1e4);
    const rest = eokTotal % 1e4;
    return rest ? `${comma(jo)}${JO}${SP}${comma(rest)}${EOK}` : `${comma(jo)}${JO}`;
  }

  // 영어: ₩5,000, ₩64.2K, ₩34.8M, ₩1.2B, ₩1.2T. 100 미만은 소수 한 자리, 반올림해서 1,000이 되면 다음 단위로 넘긴다.
  function wonEn(abs) {
    if (abs < 1e4) return `₩${comma(abs)}`;
    const units = [[1e3, 'K'], [1e6, 'M'], [1e9, 'B'], [1e12, 'T']];
    for (let i = 0; i < units.length; i += 1) {
      const [size, unit] = units[i];
      const v = abs / size;
      const shown = v < 99.95 ? trim(v) : comma(v);
      if (Number(shown.replace(/,/g, '')) < 1000 || i === units.length - 1) return `₩${shown}${unit}`;
    }
    return `₩${comma(abs)}`;
  }

  function money(n, currency = 'KRW') {
    const sign = n < 0 ? MINUS : '';
    const abs = Math.abs(n);
    return sign + (currency === 'USD' ? `$${abs.toFixed(2)}` : won(abs));
  }

  function price(n, currency = 'KRW') {
    if (currency !== 'USD') {
      if (lang() === 'en') return `₩${comma(n)}`;
      return `${comma(n)}${(UNITS[lang()] || UNITS.ko)[3]}`;
    }
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
  const SHARE = { ko: '주', en: ' sh', ja: '株' };
  function shares(q) {
    const unit = SHARE[lang()] || SHARE.ko;
    if (q >= 100) return `${comma(Math.floor(q))}${unit}`;
    if (q >= 0.01) return `${Number((Math.floor(q * 100) / 100).toFixed(2))}${unit}`;
    return `${Number(q.toPrecision(2))}${unit}`;
  }

  const Format = { money, price, signed, pct, shares };
  globalThis.Format = Format;
  if (typeof module !== 'undefined') module.exports = Format;
})();
