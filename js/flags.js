// woomars-hub/flags.js 를 그대로 복사했다. 고치지 말고 허브 쪽이 바뀌면 다시 복사한다.
// 언어 국기 아이콘(한국 · 미국 · 일본). 모든 게임 시작 화면의 언어 버튼이 이 그림을 같이 쓴다.
// 이모지 국기는 Windows 에서 글자(KR, US)로 나와서 SVG 로 그린다. id·<use> 가 없어 한 화면에 여러 번 넣어도 된다.
// 3:2 비율. 버튼에서는 22×15px 안팎으로 작게, 고른 언어만 또렷하게(나머지는 흐리게) 보인다.
// 새 게임은 이 문자열을 그대로 복사해 쓴다(woomars-hub/CLAUDE.md "번역 규칙").
var LANG_FLAGS = {
  ko: '<svg viewBox="-36 -24 72 48" aria-hidden="true"><rect x="-36" y="-24" width="72" height="48" fill="#fff"/>'
    + '<g transform="rotate(-56.31)"><path d="M-6-25H6M-6-22H6M-6-19H6M-6 19H6M-6 22H6M-6 25H6" stroke="#000" stroke-width="2"/>'
    + '<path d="M0 17v10" stroke="#fff"/><circle r="12" fill="#cd2e3a"/>'
    + '<path d="M0-12A6 6 0 0 0 0 0A6 6 0 0 1 0 12A12 12 0 0 1 0-12Z" fill="#0047a0"/></g>'
    + '<g transform="rotate(-123.69)"><path d="M-6-25H6M-6-22H6M-6-19H6M-6 19H6M-6 22H6M-6 25H6" stroke="#000" stroke-width="2"/>'
    + '<path d="M0-23.5v3M0 17v3.5M0 23.5v3" stroke="#fff"/></g></svg>',
  en: '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#b22234"/>'
    + '<path d="M0 2.31H30M0 5.38H30M0 8.46H30M0 11.54H30M0 14.62H30M0 17.69H30" stroke="#fff" stroke-width="1.54"/>'
    + '<rect width="12" height="10.77" fill="#3c3b6e"/>'
    + '<g fill="#fff"><circle cx="2" cy="1.8" r=".55"/><circle cx="6" cy="1.8" r=".55"/><circle cx="10" cy="1.8" r=".55"/>'
    + '<circle cx="4" cy="4.1" r=".55"/><circle cx="8" cy="4.1" r=".55"/>'
    + '<circle cx="2" cy="6.4" r=".55"/><circle cx="6" cy="6.4" r=".55"/><circle cx="10" cy="6.4" r=".55"/>'
    + '<circle cx="4" cy="8.7" r=".55"/><circle cx="8" cy="8.7" r=".55"/></g></svg>',
  ja: '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/></svg>',
};
// 버튼 이름(화면 읽기·툴팁)은 늘 그 언어로
var LANG_NAMES = { ko: '한국어', en: 'English', ja: '日本語' };

if (typeof module !== 'undefined') module.exports = { LANG_FLAGS: LANG_FLAGS, LANG_NAMES: LANG_NAMES };
