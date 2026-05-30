type SoundName = "tap" | "soft" | "nav" | "success" | "warning" | "enabled";

type BrowserAudioContext = AudioContext & { resume: () => Promise<void> };

let ctx: BrowserAudioContext | null = null;
let masterGain: GainNode | null = null;
let lastPlayedAt = 0;
let primed = false;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!ctx) {
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);
  }

  return ctx;
}

const profiles: Record<SoundName, { freq: number; endFreq?: number; duration: number; gain: number; type?: OscillatorType }> = {
  tap: { freq: 780, endFreq: 520, duration: 0.07, gain: 0.07, type: "sine" },
  soft: { freq: 500, endFreq: 410, duration: 0.06, gain: 0.045, type: "triangle" },
  nav: { freq: 460, endFreq: 900, duration: 0.11, gain: 0.075, type: "sine" },
  success: { freq: 660, endFreq: 1080, duration: 0.16, gain: 0.08, type: "sine" },
  warning: { freq: 270, endFreq: 160, duration: 0.17, gain: 0.075, type: "triangle" },
  enabled: { freq: 560, endFreq: 980, duration: 0.18, gain: 0.085, type: "sine" },
};

export function primeAudio() {
  const ac = getAudioContext();
  if (!ac || primed) return;

  try {
    const source = ac.createBufferSource();
    source.buffer = ac.createBuffer(1, 1, 22050);
    source.connect(masterGain || ac.destination);
    source.start(0);
    primed = true;
  } catch {
    primed = false;
  }
}

export function unlockAudio() {
  const ac = getAudioContext();
  if (!ac) return;

  primeAudio();
  if (ac.state === "suspended") {
    void ac.resume().catch(() => undefined);
  }
}

function scheduleTone(ac: BrowserAudioContext, name: SoundName) {
  const p = profiles[name];
  const destination = masterGain || ac.destination;
  const start = ac.currentTime + 0.001;
  const end = start + p.duration;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = p.type || "sine";
  osc.frequency.setValueAtTime(p.freq, start);
  if (p.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, p.endFreq), end);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(4400, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, p.gain), start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  osc.start(start);
  osc.stop(end + 0.02);
}

export function playSound(name: SoundName = "tap") {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastPlayedAt < 28) return;
  lastPlayedAt = now;

  const ac = getAudioContext();
  if (!ac) return;

  unlockAudio();

  if (ac.state === "suspended") {
    void ac.resume().then(() => scheduleTone(ac, name)).catch(() => undefined);
    return;
  }

  try {
    scheduleTone(ac, name);
  } catch {
    primed = false;
  }
}
