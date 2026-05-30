type SoundName = "tap" | "soft" | "nav" | "success" | "warning" | "enabled";

type BrowserAudioContext = AudioContext & { resume: () => Promise<void> };

let ctx: BrowserAudioContext | null = null;
let lastPlayed = 0;
let unlocked = false;

function audioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

const profiles: Record<SoundName, { freq: number; endFreq?: number; duration: number; gain: number; type?: OscillatorType }> = {
  tap: { freq: 820, endFreq: 540, duration: 0.075, gain: 0.055, type: "sine" },
  soft: { freq: 520, endFreq: 430, duration: 0.055, gain: 0.032, type: "triangle" },
  nav: { freq: 440, endFreq: 880, duration: 0.105, gain: 0.05, type: "sine" },
  success: { freq: 660, endFreq: 1040, duration: 0.16, gain: 0.058, type: "sine" },
  warning: { freq: 260, endFreq: 170, duration: 0.16, gain: 0.05, type: "triangle" },
  enabled: { freq: 560, endFreq: 960, duration: 0.18, gain: 0.06, type: "sine" },
};

export function unlockAudio() {
  const ac = audioContext();
  if (!ac) return;

  if (ac.state === "suspended") {
    // Do not await here. Safari/iOS requires this to be initiated directly from
    // the same user gesture stack; awaiting can make the next oscillator silent.
    void ac.resume().catch(() => undefined);
  }

  if (unlocked) return;
  unlocked = true;

  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const start = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.00001, start + 0.015);
    osc.frequency.setValueAtTime(440, start);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.02);
  } catch {
    unlocked = false;
  }
}

export function playSound(name: SoundName = "tap") {
  const nowTs = performance.now();
  if (nowTs - lastPlayed < 24) return;
  lastPlayed = nowTs;

  const ac = audioContext();
  if (!ac) return;
  unlockAudio();
  if (ac.state === "suspended") return;

  const p = profiles[name];
  const start = ac.currentTime + 0.002;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = p.type || "sine";
  osc.frequency.setValueAtTime(p.freq, start);
  if (p.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, p.endFreq), start + p.duration);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(4200, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(p.gain, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + p.duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  osc.start(start);
  osc.stop(start + p.duration + 0.02);
}
