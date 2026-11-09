// 효과음. 음원 파일 없이 Web Audio로 합성한다. 켜고 끈 설정은 브라우저에 기억한다.
(function () {
  const KEY = 'stock-rpg-sound';
  let ctx = null;

  function readEnabled() {
    try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
  }

  function audio() {
    if (ctx) return ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try { ctx = new AC(); } catch { ctx = null; }
    return ctx;
  }

  // 한 음: 주파수에서 끝 주파수로 미끄러지는 짧은 소리
  function tone(c, { freq, to = freq, dur = 0.12, type = 'square', gain = 0.12, delay = 0 }) {
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    buy: [{ freq: 660, to: 880, dur: 0.07, type: 'triangle' }],
    hit: [{ freq: 520, to: 180, dur: 0.12 }, { freq: 900, to: 300, dur: 0.08, delay: 0.03, gain: 0.08 }],
    crit: [{ freq: 300, to: 1200, dur: 0.1 }, { freq: 1200, to: 200, dur: 0.22, delay: 0.1, gain: 0.14 }],
    hurt: [{ freq: 160, to: 60, dur: 0.22, type: 'sawtooth', gain: 0.14 }],
    item: [{ freq: 500, dur: 0.06, type: 'triangle' }, { freq: 750, dur: 0.06, type: 'triangle', delay: 0.07 }, { freq: 1000, dur: 0.1, type: 'triangle', delay: 0.14 }],
    tick: [{ freq: 880, dur: 0.05, type: 'sine', gain: 0.1 }],
    go: [{ freq: 1320, dur: 0.15, type: 'sine', gain: 0.12 }],
    kill: [523, 659, 784, 1047].map((f, i) => ({ freq: f, dur: 0.14, type: 'square', delay: i * 0.1, gain: 0.1 })),
    dead: [392, 330, 262, 196].map((f, i) => ({ freq: f, to: f * 0.97, dur: 0.24, type: 'sawtooth', delay: i * 0.18, gain: 0.1 })),
    timeout: [{ freq: 300, to: 150, dur: 0.35, type: 'triangle', gain: 0.12 }],
  };

  const Sound = {
    enabled: readEnabled(),
    last: null,
    play(name) {
      Sound.last = name;
      if (!Sound.enabled || !SOUNDS[name]) return;
      const c = audio();
      if (!c) return;
      if (c.state === 'suspended') c.resume().catch(() => {});
      try { for (const n of SOUNDS[name]) tone(c, n); } catch { /* 소리는 게임을 멈추지 않는다 */ }
    },
    setEnabled(on) {
      Sound.enabled = on;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* 무시 */ }
    },
    // 핸드폰은 첫 터치 뒤에만 소리를 낼 수 있다.
    unlock() {
      const c = audio();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    },
  };

  globalThis.Sound = Sound;
  if (typeof document !== 'undefined') document.addEventListener('pointerdown', Sound.unlock, { once: true, passive: true });
})();
