type SoundName = "tap" | "soft" | "nav" | "success" | "warning" | "enabled";

let ctx: AudioContext | null = null;
let lastPlayed = 0;

function audioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  return ctx;
}

const profiles: Record<SoundName, { freq: number; endFreq?: number; duration: number; gain: number; type?: OscillatorType }> = {
  tap: { freq: 760, endFreq: 520, duration: 0.045, gain: 0.018, type: "sine" },
  soft: { freq: 520, endFreq: 430, duration: 0.035, gain: 0.012, type: "triangle" },
  nav: { freq: 420, endFreq: 720, duration: 0.075, gain: 0.016, type: "sine" },
  success: { freq: 620, endFreq: 920, duration: 0.11, gain: 0.018, type: "sine" },
  warning: { freq: 260, endFreq: 190, duration: 0.13, gain: 0.016, type: "triangle" },
  enabled: { freq: 540, endFreq: 860, duration: 0.13, gain: 0.02, type: "sine" },
};

export async function playSound(name: SoundName = "tap") {
  const nowTs = performance.now();
  if (nowTs - lastPlayed < 28) return;
  lastPlayed = nowTs;

  const ac = audioContext();
  if (!ac) return;
  if (ac.state === "suspended") {
    try { await ac.resume(); } catch { return; }
  }

  const p = profiles[name];
  const start = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = p.type || "sine";
  osc.frequency.setValueAtTime(p.freq, start);
  if (p.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, p.endFreq), start + p.duration);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3600, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(p.gain, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + p.duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  osc.start(start);
  osc.stop(start + p.duration + 0.015);
}
