// WebAudio sound effects + a text-to-speech announcer. Every call is a no-op until unlock() and when muted.

export function createAudio() {
  let ctx = null, master = null, noiseBuf = null;
  let muted = false;
  const hums = [null, null];
  let grindNode = null;
  let voice = null;

  function pickVoice() {
    try {
      const vs = window.speechSynthesis?.getVoices?.() || [];
      // an Indian English voice if the device has one, otherwise any English voice
      voice = vs.find((v) => /en[-_]IN/i.test(v.lang)) || vs.find((v) => /^en[-_]GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
    } catch { voice = null; }
  }

  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.8;
        master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        pickVoice();
        try { window.speechSynthesis?.addEventListener?.('voiceschanged', pickVoice); } catch { /* ignore */ }
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch { ctx = null; }
  }

  const ready = () => ctx && !muted;

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
    if (muted) { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
  }

  function noise(dur, type, freq, q, gain, when = 0, sweepTo = null) {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.4);
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
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // rubber thud + a steel "ting" ringing out of the plate
  function hit(impact) {
    const k = Math.min(1, impact / 2);
    tone(150 + Math.random() * 30, 0.12, 'sine', 0.25 + k * 0.35, 0, 60);
    noise(0.05, 'bandpass', 900, 1.2, 0.2 + k * 0.3);
    const base = 1800 + Math.random() * 500;
    [1, 1.52, 2.36, 3.1].forEach((m, i) => tone(base * m, 0.25 + k * 0.5 - i * 0.05, 'sine', (0.05 + k * 0.07) / (i + 1)));
  }

  function hum(i, frac) {
    if (!ctx) return;
    let h = hums[i];
    if (!h) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 2;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      const trem = ctx.createGain(); // whir: the hum pulses with the spin
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain).connect(trem.gain);
      trem.gain.value = 0.5;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(f);
      src.connect(bp).connect(f);
      f.connect(trem).connect(g).connect(master);
      o.start(); src.start(); lfo.start();
      h = hums[i] = { o, f, g, bp, lfo };
    }
    const t = ctx.currentTime;
    const v = Math.max(0, Math.min(1, frac));
    h.o.frequency.setTargetAtTime(60 + v * 150 + i * 9, t, 0.05);
    h.bp.frequency.setTargetAtTime(700 + v * 1600, t, 0.05);
    h.f.frequency.setTargetAtTime(300 + v * 1400, t, 0.05);
    h.lfo.frequency.setTargetAtTime(6 + v * 28, t, 0.05);
    h.g.gain.setTargetAtTime(v > 0.01 ? 0.03 + v * 0.04 : 0, t, 0.08);
  }

  function grind(on) {
    if (!ctx) return;
    if (on && !grindNode && !muted) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 4;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.1);
      src.connect(f).connect(g).connect(master);
      src.start();
      grindNode = { src, g, f };
    } else if (!on && grindNode) {
      const n = grindNode;
      grindNode = null;
      n.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
      n.src.stop(ctx.currentTime + 0.3);
    }
    if (on && grindNode) grindNode.f.frequency.setTargetAtTime(1100 + Math.random() * 900, ctx.currentTime, 0.03);
  }

  function silence() { hum(0, 0); hum(1, 0); grind(false); }

  function say(text, { rate = 0.95, pitch = 0.75 } = {}) {
    if (muted || !text) return;
    try {
      const s = window.speechSynthesis;
      if (!s) return;
      s.cancel(); // the newest call matters most
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || 'en-IN';
      u.rate = rate;
      u.pitch = pitch;
      u.volume = 1;
      s.speak(u);
    } catch { /* no speech on this device */ }
  }

  return {
    unlock,
    setMuted,
    get muted() { return muted; },
    hum,
    grind,
    silence,
    say,
    clack(impact) { if (ready()) hit(impact); },
    boom() {
      if (!ready()) return;
      tone(70, 0.6, 'sine', 0.5, 0, 38);
      noise(0.25, 'lowpass', 400, 0.7, 0.4);
    },
    snap() {
      if (!ready()) return;
      noise(0.08, 'highpass', 3500, 0.7, 0.8);
      tone(1600, 0.16, 'square', 0.1, 0, 300);
      noise(0.3, 'bandpass', 2400, 1, 0.25, 0.05, 900);
    },
    crumble() {
      if (!ready()) return;
      for (let k = 0; k < 9; k++) noise(0.05, 'bandpass', 1500 + Math.random() * 2500, 2, 0.25, k * 0.035);
      tone(110, 0.5, 'sine', 0.4, 0, 45);
    },
    stroke() {
      if (!ready()) return;
      noise(0.06, 'bandpass', 1300, 3, 0.1, 0, 2600); // rubber squeak
    },
    perfect() {
      if (!ready()) return;
      [880, 1320, 1760].forEach((f, k) => tone(f, 0.18, 'triangle', 0.12, k * 0.06));
    },
    go() {
      if (!ready()) return;
      tone(520, 0.12, 'square', 0.08);
      tone(780, 0.22, 'square', 0.08, 0.1);
    },
    special() {
      if (!ready()) return;
      tone(300, 0.3, 'sawtooth', 0.09, 0, 1100);
      noise(0.3, 'bandpass', 800, 1, 0.15, 0, 3000);
    },
    click() {
      if (!ready()) return;
      tone(660, 0.05, 'triangle', 0.08);
    },
    win() {
      if (!ready()) return;
      [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.24, 'triangle', 0.16, k * 0.11));
    },
    lose() {
      if (!ready()) return;
      [392, 330, 262].forEach((f, k) => tone(f, 0.32, 'triangle', 0.14, k * 0.16));
    },
  };
}
