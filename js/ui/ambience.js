// Soft background music under a story while it is read aloud: one loop per world (tools/make-music.py).
// Web Audio, so the loop has no gap; each file is fetched only the first time it is needed.
const LOOP_S = { moon: 32, mars: 32, deep: 40 };   // exact loop lengths, as rendered
const LEVEL = 0.2;       // −14 dB on −26 LUFS files → about −40 LUFS, 20 dB under the −19.6 LUFS voices (WCAG 1.4.7)
const KEY = 'still-out-there:music';

let ctx = null, source = null, gain = null, wanted = null;
const buffers = {};

export function musicOn() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setMusicOn(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ }
  if (!on) stopMusic();
}

export async function startMusic(world) {
  if (!musicOn() || !LOOP_S[world] || source) return;
  wanted = world;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    buffers[world] ??= await fetch(`assets/audio/music-${world}.mp3`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b));
    if (source || wanted !== world) return;                    // started twice, or stopped while loading
    const buffer = buffers[world];
    // Some browsers keep the MP3 encoder's ~25 ms of leading silence: skip it so the loop stays seamless.
    const offset = buffer.duration > LOOP_S[world] + 0.02 ? 1105 / 44100 : 0;
    gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(LEVEL, ctx.currentTime + 2);
    gain.connect(ctx.destination);
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = offset;
    source.loopEnd = Math.min(offset + LOOP_S[world], buffer.duration);
    source.connect(gain);
    source.start(0, offset);
  } catch (err) {
    console.warn('background music unavailable', err);         // the story still plays without it
  }
}

export function stopMusic() {
  wanted = null;
  if (!source) return;
  const s = source, g = gain, now = ctx.currentTime;
  source = null; gain = null;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(0, now + 1.2);
  s.stop(now + 1.3);
}
