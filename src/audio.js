// Tiny WebAudio synth. Every call is a no-op until unlock() and when muted.

export function createAudio() {
  let ctx = null, master = null, noiseBuf = null;
  let muted = false;
  const hums = [null, null];

  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.8;
        master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch { ctx = null; }
  }

  const ready = () => ctx && !muted;

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
  }

  function noise(dur, type, freq, q, gain, when = 0) {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function tone(freq, dur, type = 'triangle', gain = 0.15, when = 0, slideTo = null) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function hum(i, frac) {
    if (!ctx) return;
    let h = hums[i];
    if (!h) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(f).connect(g).connect(master);
      o.start();
      h = hums[i] = { o, f, g };
    }
    const t = ctx.currentTime;
    const v = Math.max(0, Math.min(1, frac));
    h.o.frequency.setTargetAtTime(55 + v * 140 + i * 7, t, 0.05);
    h.f.frequency.setTargetAtTime(250 + v * 900, t, 0.05);
    h.g.gain.setTargetAtTime(v > 0.01 ? 0.025 + v * 0.03 : 0, t, 0.08);
  }

  function silence() { hum(0, 0); hum(1, 0); }

  return {
    unlock,
    setMuted,
    get muted() { return muted; },
    hum,
    silence,
    clack(impact) {
      if (!ready()) return;
      const k = Math.min(1, impact / 2);
      noise(0.06 + k * 0.05, 'bandpass', 2200 + Math.random() * 800, 1.5, 0.25 + k * 0.5);
      tone(900 + Math.random() * 300, 0.05, 'square', 0.05 + k * 0.06);
    },
    snap() {
      if (!ready()) return;
      noise(0.12, 'highpass', 3000, 0.7, 0.7);
      tone(1400, 0.18, 'square', 0.12, 0, 300);
    },
    stroke() {
      if (!ready()) return;
      noise(0.05, 'bandpass', 1200, 3, 0.08);
    },
    perfect() {
      if (!ready()) return;
      [880, 1320].forEach((f, k) => tone(f, 0.16, 'triangle', 0.14, k * 0.07));
    },
    go() {
      if (!ready()) return;
      tone(520, 0.12, 'square', 0.08);
      tone(780, 0.22, 'square', 0.08, 0.1);
    },
    special() {
      if (!ready()) return;
      tone(300, 0.25, 'sawtooth', 0.09, 0, 900);
    },
    click() {
      if (!ready()) return;
      tone(660, 0.05, 'triangle', 0.08);
    },
    win() {
      if (!ready()) return;
      [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.22, 'triangle', 0.16, k * 0.11));
    },
    lose() {
      if (!ready()) return;
      [392, 330, 262].forEach((f, k) => tone(f, 0.3, 'triangle', 0.14, k * 0.16));
    },
  };
}
