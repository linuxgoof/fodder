/**
 * Looping 8-bit chiptune background, plus event sounds (free-fall whoosh, ledge
 * bonk). The tune is the heartbeat of the game per the updated DESIGN.md;
 * silence is now reserved for specific narrative beats, not the default.
 */

const tuneUrl = new URL('./8bit_tune.wav', import.meta.url).href;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let tuneBuf: AudioBuffer | null = null;

let whooshSrc: AudioBufferSourceNode | null = null;
let whooshOut: GainNode | null = null;
let whooshTimeout: ReturnType<typeof setTimeout> | null = null;

const DEFAULT_VOLUME = 0.35;
const MAX_VOLUME = 0.5;

function ensureContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

async function loadTune(a: AudioContext): Promise<AudioBuffer> {
  if (tuneBuf) return tuneBuf;
  const res = await fetch(tuneUrl);
  const arr = await res.arrayBuffer();
  tuneBuf = await a.decodeAudioData(arr);
  return tuneBuf;
}

export function startAmbienceOnUserIntent(): void {
  const a = ensureContext();
  if (!a || master) return;
  master = a.createGain();
  master.gain.value = 0.0;
  master.connect(a.destination);

  void loadTune(a)
    .then((buf) => {
      if (!a || !master) return;
      const s = a.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(master);
      try {
        s.start();
      } catch {
        /* */
      }
      const now = a.currentTime;
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(DEFAULT_VOLUME, now + 1.2);
    })
    .catch((err) => {
      console.warn('fodder: failed to load 8bit_tune.wav', err);
    });
}

export function setAmbienceVolume(open: number): void {
  if (!master) return;
  const c = ensureContext();
  if (!c) return;
  const t = c.currentTime;
  const v = Math.max(0, Math.min(MAX_VOLUME, open));
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(v, t + 0.2);
}

/**
 * Latched free-fall whoosh. Call each frame is wasteful; Game only toggles when
 * the desired state flips.
 */
export function setFallWhooshState(active: boolean) {
  const a = ensureContext();
  if (!a) return;
  if (active) {
    if (whooshSrc) return;
    if (whooshTimeout) {
      clearTimeout(whooshTimeout);
      whooshTimeout = null;
    }
    const t0 = a.currentTime;
    const dur = 0.4;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      const w = Math.sin(t * Math.PI) ** 0.4;
      d[i] = (Math.random() * 2 - 1) * 0.5 * w;
    }
    const s = a.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const hp = a.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(180, t0);
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900 + Math.random() * 200, t0);
    f.Q.setValueAtTime(0.55, t0);
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, t0);
    const g = a.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.045, t0 + 0.12);
    s.connect(hp);
    hp.connect(f);
    f.connect(lp);
    lp.connect(g);
    g.connect(master || a.destination);
    try {
      s.start(t0);
    } catch {
      /* */
    }
    whooshSrc = s;
    whooshOut = g;
  } else {
    if (!whooshSrc) return;
    if (whooshTimeout) {
      clearTimeout(whooshTimeout);
    }
    const t0 = a.currentTime;
    if (whooshOut) {
      whooshOut.gain.cancelScheduledValues(t0);
      whooshOut.gain.setValueAtTime(whooshOut.gain.value, t0);
      whooshOut.gain.linearRampToValueAtTime(0, t0 + 0.07);
    }
    const sEnd = whooshSrc;
    whooshSrc = null;
    whooshOut = null;
    whooshTimeout = setTimeout(() => {
      whooshTimeout = null;
      try {
        sEnd.stop();
      } catch {
        /* */
      }
    }, 120);
  }
}

/**
 * Landing on the ledge / catch: short bonk (mass + click), scales with impact.
 */
export function playPlatformBonk(velocity: number = 2.5) {
  const a = ensureContext();
  if (!a) return;
  const imp = Math.max(0, Math.min(1, velocity / 8.5));
  const t0 = a.currentTime;

  const out = a.createGain();
  if (master) {
    out.connect(master);
  } else {
    out.connect(a.destination);
  }
  const peak = 0.05 + imp * 0.12;
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(peak, t0 + 0.012);
  out.gain.linearRampToValueAtTime(0, t0 + 0.18);

  const sub = a.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(52 + imp * 30, t0);
  const gSub = a.createGain();
  sub.connect(gSub);
  gSub.connect(out);
  gSub.gain.setValueAtTime(0, t0);
  gSub.gain.linearRampToValueAtTime(0.55 + imp * 0.25, t0 + 0.005);
  gSub.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  sub.start(t0);
  sub.stop(t0 + 0.13);

  const cl = a.createOscillator();
  cl.type = 'triangle';
  cl.frequency.setValueAtTime(180 + imp * 120, t0);
  const gCl = a.createGain();
  cl.connect(gCl);
  gCl.connect(out);
  gCl.gain.setValueAtTime(0, t0);
  gCl.gain.linearRampToValueAtTime(0.2 + imp * 0.15, t0 + 0.002);
  gCl.gain.linearRampToValueAtTime(0, t0 + 0.055);
  cl.start(t0);
  cl.stop(t0 + 0.06);

  const nSamp = Math.floor(a.sampleRate * 0.12);
  const buf = a.createBuffer(1, nSamp, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < nSamp; i += 1) {
    ch[i] = (Math.random() * 2 - 1) * (1 - i / nSamp) * 0.9;
  }
  const nSrc = a.createBufferSource();
  nSrc.buffer = buf;
  const low = a.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(520 + imp * 220, t0);
  const nGain = a.createGain();
  nGain.gain.value = 0.11 + imp * 0.14;
  nSrc.connect(low);
  low.connect(nGain);
  nGain.connect(out);
  nSrc.start(t0);
  nSrc.stop(t0 + 0.1);
}
