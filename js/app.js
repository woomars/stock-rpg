// 화면 전환과 시작. 각 화면의 동작은 battle-ui.js와 screens-ui.js가 맡는다.
(function () {
  const SCREENS = ['start', 'growth', 'battle', 'report', 'stage', 'journey', 'trophy'];
  const listeners = {};

  function show(name) {
    for (const s of SCREENS) document.getElementById(`screen-${s}`).hidden = s !== name;
    App.current = name;
    (listeners[name] || []).forEach((fn) => fn());
  }

  function onShow(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }

  const $ = (id) => document.getElementById(id);

  const App = { current: 'start', show, onShow, $ };
  globalThis.App = App;

  document.addEventListener('DOMContentLoaded', () => {
    if (globalThis.Backgrounds) {
      for (const el of document.querySelectorAll('.sky[data-board]')) el.innerHTML = Backgrounds.svg(el.dataset.board);
    }
    if (globalThis.UI && UI.boot) UI.boot();
    else show('start');
  });
})();
