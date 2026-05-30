type SoundName = "tap" | "soft" | "nav" | "success" | "warning" | "enabled";

type BrowserAudioContext = AudioContext & { resume: () => Promise<void> };

let ctx: BrowserAudioContext | null = null;
let masterGain: GainNode | null = null;
let lastPlayedAt = 0;
let primed = false;
const htmlAudioCache = new Map<SoundName, HTMLAudioElement>();

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!ctx) {
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.95;
    masterGain.connect(ctx.destination);
  }

  return ctx;
}

const profiles: Record<SoundName, { freq: number; endFreq?: number; duration: number; gain: number; type?: OscillatorType }> = {
  tap: { freq: 780, endFreq: 520, duration: 0.07, gain: 0.08, type: "sine" },
  soft: { freq: 500, endFreq: 410, duration: 0.06, gain: 0.05, type: "triangle" },
  nav: { freq: 460, endFreq: 900, duration: 0.11, gain: 0.085, type: "sine" },
  success: { freq: 660, endFreq: 1080, duration: 0.16, gain: 0.095, type: "sine" },
  warning: { freq: 270, endFreq: 160, duration: 0.17, gain: 0.085, type: "triangle" },
  enabled: { freq: 560, endFreq: 980, duration: 0.18, gain: 0.1, type: "sine" },
};

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
}

function wavDataUrl(name: SoundName) {
  const p = profiles[name];
  const sampleRate = 22050;
  const samples = Math.max(1, Math.floor(sampleRate * p.duration));
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples * 2, true);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const progress = i / samples;
    const freq = p.endFreq ? p.freq + (p.endFreq - p.freq) * progress : p.freq;
    const attack = Math.min(1, progress / 0.16);
    const release = Math.min(1, (1 - progress) / 0.32);
    const envelope = Math.max(0, Math.min(attack, release));
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.28;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function htmlAudio(name: SoundName) {
  if (typeof Audio === "undefined") return null;
  let audio = htmlAudioCache.get(name);
  if (!audio) {
    audio = new Audio(wavDataUrl(name));
    audio.preload = "auto";
    audio.volume = 0.35;
    htmlAudioCache.set(name, audio);
  }
  return audio;
}

function playHtmlFallback(name: SoundName) {
  const audio = htmlAudio(name);
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  } catch {
    // ignored: browser rejected fallback playback
  }
}

export function primeAudio() {
  const ac = getAudioContext();

  for (const name of Object.keys(profiles) as SoundName[]) {
    const audio = htmlAudio(name);
    try { audio?.load(); } catch { /* noop */ }
  }

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
  primeAudio();
  if (!ac) return;

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
  unlockAudio();

  if (!ac) {
    playHtmlFallback(name);
    return;
  }

  if (ac.state === "suspended") {
    void ac.resume()
      .then(() => scheduleTone(ac, name))
      .catch(() => playHtmlFallback(name));
    return;
  }

  try {
    scheduleTone(ac, name);
  } catch {
    primed = false;
    playHtmlFallback(name);
  }
}
