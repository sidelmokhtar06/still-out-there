#!/usr/bin/env python3
"""Renders the soft background music under the stories, one seamless loop per world.
Original music made here (no samples, no licences): slow chord pads, a soft bass and a few bell notes.
Everything is placed on a circle of time (notes and reverb wrap around), so the loop has no seam.

  python3 tools/make-music.py      ->  assets/audio/music-moon.mp3, music-mars.mp3, music-deep.mp3
"""
import subprocess, tempfile, wave
from pathlib import Path
import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'audio'

def hz(note):
    """'C4', 'F#3', 'Bb4' -> frequency."""
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    n = names[note[0]]; rest = note[1:]
    if rest[0] in '#b': n += 1 if rest[0] == '#' else -1; rest = rest[1:]
    return 440.0 * 2 ** ((n + 12 * (int(rest) + 1) - 69) / 12)

WORLDS = {
    # calm and bright: the Moon, sunlight and silence
    'moon': dict(chord_s=8, cutoff=2600, bells_per_s=0.30, bell_decay=2.6, wet=0.35, seed=11,
                 chords=[['C3', 'G3', 'E4', 'B4', 'D5'], ['A2', 'E3', 'C4', 'G4', 'B4'],
                         ['F2', 'C3', 'A3', 'E4', 'G4'], ['G2', 'D3', 'B3', 'E4', 'A4']],
                 bells=['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6']),
    # warmer, lower, a little mysterious: dust and red rock
    'mars': dict(chord_s=8, cutoff=1500, bells_per_s=0.20, bell_decay=3.2, wet=0.40, seed=23,
                 chords=[['D3', 'A3', 'F4', 'C5', 'E5'], ['Bb2', 'F3', 'D4', 'A4', 'C5'],
                         ['C3', 'G3', 'E4', 'A4', 'D5'], ['A2', 'E3', 'C4', 'G4', 'D5']],
                 bells=['D5', 'E5', 'F5', 'A5', 'C6', 'D6']),
    # slow and spacious, a little lonely: drifting between the stars
    'deep': dict(chord_s=10, cutoff=2000, bells_per_s=0.12, bell_decay=4.5, wet=0.55, seed=37,
                 chords=[['A2', 'E3', 'B3', 'C4', 'E4'], ['F2', 'C3', 'A3', 'B3', 'E4'],
                         ['C3', 'G3', 'B3', 'D4', 'E4'], ['E2', 'B2', 'G3', 'D4', 'F#4']],
                 bells=['E5', 'G5', 'A5', 'B5', 'D6', 'E6']),
}

def place(buf, sig, start):
    """Adds sig into the circular buffer at sample `start`, wrapping past the end."""
    n = len(buf); i = start % n
    while len(sig):
        k = min(len(sig), n - i)
        buf[i:i + k] += sig[:k]
        sig = sig[k:]; i = 0

def pad_note(f, dur, rng):
    t = np.arange(int(dur * SR)) / SR
    attack, release = 2.5, 3.0
    env = np.clip(t / attack, 0, 1) * np.clip((dur - t) / release, 0, 1)
    env = env ** 1.5
    sig = np.zeros_like(t)
    for detune in (-0.12, 0.0, 0.12):                       # three slightly detuned voices: a soft chorus
        ph = rng.uniform(0, 2 * np.pi)
        sig += np.sin(2 * np.pi * f * 2 ** (detune / 12) * t + ph)
        sig += 0.18 * np.sin(2 * np.pi * 2 * f * 2 ** (detune / 12) * t + ph)
    return sig * env / 3

def bell(f, decay):
    t = np.arange(int(decay * 3 * SR)) / SR
    env = np.exp(-t / decay) * np.clip(t / 0.01, 0, 1)
    return env * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / (decay / 3)))

def lowpass_circular(x, cutoff):
    """One-pole low-pass, run twice round the circle so the start and end agree."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); state = 0.0
    for _ in range(2):
        for i in range(len(x)):
            state = (1 - a) * x[i] + a * state
            y[i] = state
    return y

def render(cfg):
    rng = np.random.default_rng(cfg['seed'])
    L = cfg['chord_s'] * len(cfg['chords'])
    n = L * SR
    pads = np.zeros(n); bass = np.zeros(n); bells = np.zeros(n)
    for k, chord in enumerate(cfg['chords']):
        start = k * cfg['chord_s'] * SR
        for note in chord[1:]:
            place(pads, pad_note(hz(note), cfg['chord_s'] + 3.0, rng), start)
        place(bass, 0.9 * pad_note(hz(chord[0]), cfg['chord_s'] + 3.0, rng), start)
    pads = lowpass_circular(pads, cfg['cutoff'])
    for _ in range(int(L * cfg['bells_per_s'])):
        t0 = int(rng.uniform(0, L) * SR)
        place(bells, rng.uniform(0.25, 0.5) * bell(hz(rng.choice(cfg['bells'])), cfg['bell_decay']), t0)
    dry = pads * 0.55 + bass * 0.45 + bells * 0.35
    # Reverb: circular convolution with a decaying noise tail, so it wraps round the loop too.
    t = np.arange(int(3.5 * SR)) / SR
    ir = rng.standard_normal(len(t)) * np.exp(-t / 0.9)
    ir = np.pad(ir, (0, n - len(ir)))
    wet = np.real(np.fft.ifft(np.fft.fft(dry) * np.fft.fft(ir)))
    wet *= np.std(dry) / (np.std(wet) + 1e-12)
    mix = (1 - cfg['wet']) * dry + cfg['wet'] * wet
    return mix / np.max(np.abs(mix)) * 0.8, L

for name, cfg in WORLDS.items():
    audio, L = render(cfg)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / f'{name}.wav'
        with wave.open(str(wav), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((audio * 32767).astype('<i2').tobytes())
        # Loudness -26 LUFS: the page plays it a further 10 dB down, about 16 dB under the voices.
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-filter:a', 'loudnorm=I=-26:TP=-3:LRA=11:linear=true', '-ar', str(SR),
                        '-c:a', 'libmp3lame', '-b:a', '80k', '-ac', '1', str(OUT / f'music-{name}.mp3')], check=True)
    print(f'music-{name}.mp3  {L} s loop')
