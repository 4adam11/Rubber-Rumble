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

  // a sound's left/right position: -1 left … 1 right
  function panned(node, pan) {
    if (!pan || !ctx.createStereoPanner) return node.connect(master);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p).connect(master);
    return p;
  }

  function burst(dur, type, freq, q, gain, pan = 0, when = 0, sweepTo = null) {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, gain), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
    panned(g, pan);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  function ping(freq, dur, gain, pan = 0, type = 'sine', when = 0, slideTo = null) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    panned(g, pan);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // two rubber tops smacking together on a steel plate
  function hit(impact, pan = 0, kind = 'rubber') {
    const k = Math.min(1, impact / 2);
    if (kind === 'metal') { // bouncing off the sharpener or the compass pin
      ping(2400 + Math.random() * 300, 0.5 + k * 0.4, 0.12 + k * 0.1, pan, 'triangle');
      ping(3900, 0.35, 0.06 + k * 0.05, pan);
      ping(6100, 0.2, 0.04, pan);
      burst(0.03, 'highpass', 4000, 0.7, 0.4 + k * 0.3, pan);
      return;
    }
    if (kind === 'shield') { // glassy graphite shield
      [1800, 2700, 4050].forEach((f, i) => ping(f, 0.4 - i * 0.08, 0.08 / (i + 1), pan, 'sine', i * 0.01));
      return;
    }
    ping(125 + Math.random() * 25, 0.14 + k * 0.08, 0.3 + k * 0.45, pan, 'sine', 0, 52);       // body thump
    burst(0.05 + k * 0.04, 'lowpass', 1700 + k * 900, 0.8, 0.35 + k * 0.45, pan);             // rubber slap
    burst(0.015, 'highpass', 5200, 0.7, 0.18 + k * 0.25, pan);                                // graphite tick
    const base = 1350 + Math.random() * 200;                                                  // the plate rings out
    [[1, 0.5], [2.76, 0.35], [5.4, 0.22], [8.93, 0.12]].forEach(([m, d]) =>
      ping(base * m, (0.25 + k * 0.6) * (0.4 + d), (0.035 + k * 0.06) * d, pan * 0.6));
  }

  // per-top spin voice: graphite scratching the steel, pulsing at the rotation rate
  const spinners = [null, null];
  let rattleClock = [0, 0];
  function spinVoice() {
    const out = ctx.createGain();
    out.gain.value = 0;
    let tail = out;
    let panNode = null;
    if (ctx.createStereoPanner) { panNode = ctx.createStereoPanner(); out.connect(panNode); tail = panNode; }
    tail.connect(master);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.3;
    const am = ctx.createGain(); am.gain.value = 0.55;                // rotation pulse
    const lfo = ctx.createOscillator(); lfo.type = 'triangle';
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.45;
    lfo.connect(lfoAmt).connect(am.gain);
    src.connect(hp).connect(bp).connect(am).connect(out);
    const ring = ctx.createBiquadFilter(); ring.type = 'bandpass'; ring.Q.value = 28; ring.frequency.value = 3100;
    const ringGain = ctx.createGain(); ringGain.gain.value = 0;      // steel plate singing along
    src.connect(ring).connect(ringGain).connect(out);
    const body = ctx.createOscillator(); body.type = 'triangle';     // low body hum
    const bodyGain = ctx.createGain(); bodyGain.gain.value = 0;
    body.connect(bodyGain).connect(out);
    src.start(); lfo.start(); body.start();
    return { out, panNode, bp, lfo, ringGain, body, bodyGain };
  }

  function spin(i, frac, { wobble = 0, pan = 0 } = {}) {
    if (!ctx) return;
    const v = Math.max(0, Math.min(1, frac));
    let s = spinners[i];
    if (!s) s = spinners[i] = spinVoice();
    const t = ctx.currentTime;
    const rot = 5 + v * 38;                                            // rotations per second
    s.bp.frequency.setTargetAtTime(1500 + v * 4200, t, 0.06);
    s.lfo.frequency.setTargetAtTime(rot, t, 0.06);
    s.ringGain.gain.setTargetAtTime(v * 0.5, t, 0.1);
    s.body.frequency.setTargetAtTime(55 + v * 110 + i * 7, t, 0.06);
    s.bodyGain.gain.setTargetAtTime(v > 0.01 ? 0.18 + v * 0.15 : 0, t, 0.08);
    s.out.gain.setTargetAtTime(v > 0.01 ? 0.05 + v * 0.11 : 0, t, 0.08);
    if (s.panNode) s.panNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05);
    // a wobbling top rattles: little irregular clicks of the tip hopping
    if (v > 0.01 && wobble > 0.35 && !muted) {
      rattleClock[i] -= 1 / 60;
      if (rattleClock[i] <= 0) {
        burst(0.02, 'bandpass', 2500 + Math.random() * 2000, 2, 0.06 + wobble * 0.12, pan);
        rattleClock[i] = 0.25 / (wobble * (0.6 + Math.random()));
      }
    }
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

  function silence() {
    hums.forEach((h, i) => h && hum(i, 0));
    spinners.forEach((s, i) => s && spin(i, 0));
    grind(false);
  }

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
    hit(impact, pan = 0, kind = 'rubber') { if (ready()) hit(impact, pan, kind); },
    spin,
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
