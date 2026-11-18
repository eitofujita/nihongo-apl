// Glassy, bubbly UI sounds synthesised with Web Audio — no audio files, no network, no cost.
'use client';

const STORAGE_KEY = 'nihongo-sound';
let context: AudioContext | null = null;
let output: GainNode | null = null;

export function isSoundEnabled() {
  try {return localStorage.getItem(STORAGE_KEY) !== 'off';} catch {return true;}
}

export function setSoundEnabled(enabled: boolean) {
  try {localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');} catch {/* storage unavailable */}
}

function audio() {
  if (typeof window === 'undefined' || !isSoundEnabled()) return null;
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      output = context.createGain();
      output.gain.value = 0.22;
      // A short feedback echo gives the airy, "glass and water" shimmer.
      const delay = context.createDelay();
      delay.delayTime.value = 0.11;
      const feedback = context.createGain();
      feedback.gain.value = 0.28;
      const wet = context.createGain();
      wet.gain.value = 0.35;
      output.connect(context.destination);
      output.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(context.destination);
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {return null;}
}

/** Bell-like tone: a sine fundamental plus a quiet high partial, with a fast attack and soft decay. */
function bell(ctx: AudioContext, frequency: number, start: number, duration: number, volume = 1) {
  for (const [ratio, level, type] of [[1, 1, 'sine'], [2.76, 0.18, 'sine'], [4.07, 0.06, 'triangle']] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency * ratio, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level * volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain); gain.connect(output!);
    osc.start(start); osc.stop(start + duration + 0.05);
  }
}

/** Water-drop "bloop": a sine that sweeps in pitch. */
function bubble(ctx: AudioContext, from: number, to: number, start: number, duration: number, volume = 0.8) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain); gain.connect(output!);
  osc.start(start); osc.stop(start + duration + 0.05);
}

export type SoundName = 'tap' | 'correct' | 'wrong' | 'complete';

export function playSound(name: SoundName) {
  const ctx = audio();
  if (!ctx || !output) return;
  const now = ctx.currentTime + 0.01;
  switch (name) {
    case 'tap':
      bubble(ctx, 600, 1100, now, 0.09, 0.5);
      break;
    case 'correct': // rising major arpeggio, sparkling
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(ctx, f, now + i * 0.06, 0.7, 0.55));
      bubble(ctx, 900, 1800, now, 0.12, 0.35);
      break;
    case 'wrong': // soft, gentle descending double bloop — not harsh
      bubble(ctx, 520, 300, now, 0.18, 0.6);
      bubble(ctx, 420, 220, now + 0.13, 0.24, 0.5);
      break;
    case 'complete': // shimmering chord sweep
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(ctx, f, now + i * 0.07, 1.4, 0.45));
      break;
  }
}
