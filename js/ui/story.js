// A machine tells its story: five chapters, one per screen, each with its "Real data" drawer.
import { h, s, statusMark } from './dom.js';
import { t, lang } from '../i18n.js';
import { db, artifact, factsOf, CHAPTERS, placeOf, noteOf } from '../data.js';
import { liveSummary } from '../live.js';
import { mythCard, sourceLink } from './mythFact.js';
import { machineRows } from './panel.js';
import { markFound, missionStrip, nextButton } from '../mission.js';
import { machineArt } from './art.js';
import { laserPanel } from './beam.js';
import { musicOn, setMusicOn, startMusic, stopMusic } from './ambience.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

// ---- Read aloud -------------------------------------------------------------------------
// Reads one sentence at a time (Chrome cuts long utterances off after ~15 s) and lights up
// the sentence being read, so young readers can follow along.
const sentences = (text) => text.match(/[^.!?…؟]+[.!?…؟]+["'’”»)]*\s*|[^.!?…؟]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [text];

/** Narration text split into sentence spans that the reader can highlight. */
function readable(tag, attrs, text) {
  return h(tag, attrs, ...sentences(text).flatMap((x, i) => [i ? ' ' : '', h('span', { class: 'sentence' }, x)]));
}

/** Resolves with the browser's voices, waiting briefly because some browsers load them late. */
function voices() {
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((done) => {
    const finish = () => done(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
    setTimeout(finish, 1500);
  });
}

function pickVoice(list) {
  const mine = list.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  return mine.find((v) => v.localService && v.default) || mine.find((v) => v.localService) || mine[0] || null;
}

/** Recorded narration for one block of text, if it was generated (tools/narrate.mjs). */
const clipFor = (key) => db.narration?.clips?.[key] ?? null;

/** Plays one recorded clip and lights up each sentence at the moment it is spoken. */
function playClip(block, clip, isCurrent, onAudio) {
  const spans = [...block.querySelectorAll('.sentence')];
  const times = clip.sentences.length === spans.length ? clip.sentences : null;   // mismatch: play without highlight
  const audio = new Audio(clip.src);
  onAudio(audio);
  return new Promise((done) => {
    let raf = 0;
    const paint = () => {
      if (!isCurrent()) { audio.pause(); done(false); return; }
      if (times) {
        const now = audio.currentTime;
        let i = times.findIndex(([, end], k) => now < (times[k + 1]?.[0] ?? Infinity) && now >= times[k][0] - 0.05);
        spans.forEach((x, k) => x.classList.toggle('reading', k === i));
      }
      raf = requestAnimationFrame(paint);
    };
    audio.addEventListener('ended', () => { cancelAnimationFrame(raf); spans.forEach((x) => x.classList.remove('reading')); done(true); });
    audio.addEventListener('error', () => { cancelAnimationFrame(raf); done(false); });
    audio.play().then(() => { raf = requestAnimationFrame(paint); }, () => done(false));
  });
}

/** Reads sentences with the device's own voice (used when no recording exists). */
async function speakSpans(spans, voice, isCurrent) {
  speechSynthesis.cancel();
  for (const span of spans) {
    if (!isCurrent()) return true;
    span.classList.add('reading');
    const ok = await new Promise((done) => {
      const u = new SpeechSynthesisUtterance(span.textContent);
      u.voice = voice; u.lang = voice.lang; u.rate = 0.92;
      u.onend = () => done(true);
      u.onerror = (e) => done(e.error === 'interrupted' || e.error === 'canceled');
      speechSynthesis.speak(u);
    });
    span.classList.remove('reading');
    if (!ok) return false;
  }
  return true;
}

function listenButton(container) {
  const blocks = [...container.querySelectorAll('[data-clip]')];
  const recorded = blocks.every((b) => clipFor(b.dataset.clip));
  const canSpeak = 'speechSynthesis' in window;
  if (!recorded && !canSpeak) return null;
  const label = h('span', {}, t('story.listen'));
  const note = h('span', { class: 'listen-note', role: 'status' });
  let run = 0, audio = null;                    // bumping run cancels a reading in progress
  const set = (on) => { btn.setAttribute('aria-pressed', String(on)); label.textContent = t(on ? 'story.stop' : 'story.listen'); };
  const clear = () => container.querySelectorAll('.sentence.reading').forEach((x) => x.classList.remove('reading'));
  const world = artifact(container.dataset.machine)?.body;
  const stop = () => { run++; audio?.pause(); if (canSpeak) speechSynthesis.cancel(); stopMusic(); clear(); set(false); };

  const btn = h('button', { class: 'action small', type: 'button', 'aria-pressed': 'false',
    async onclick() {
      if (btn.getAttribute('aria-pressed') === 'true') { stop(); return; }
      const id = ++run, isCurrent = () => id === run;
      set(true);
      for (const clip of document.querySelectorAll('audio')) clip.pause();   // don't talk over a Mars recording
      startMusic(world);
      try {
        let voice = null;
        if (!recorded) {
          voice = pickVoice(await voices());
          if (!isCurrent()) return;
          if (!voice) { note.textContent = t('story.noVoice'); btn.disabled = true; return; }
        }
        for (const block of blocks) {
          if (!isCurrent()) return;
          const clip = clipFor(block.dataset.clip);
          const ok = clip ? await playClip(block, clip, isCurrent, (x) => { audio = x; })
            : await speakSpans([...block.querySelectorAll('.sentence')], voice, isCurrent);
          if (!ok && isCurrent()) { note.textContent = t('story.voiceError'); break; }
        }
      } catch (err) {
        console.warn('read-aloud failed', err);
        note.textContent = t('story.voiceError');
      } finally {
        if (isCurrent()) { stopMusic(); clear(); set(false); }   // never leave the button stuck on "Stop"
      }
    } }, label);
  btn.stop = stop;
  const voiceName = recorded ? db.narration?.voices?.[container.dataset.machine] : null;
  // Soft music under the voice, which the reader can switch off.
  const music = h('button', { class: 'music-toggle', type: 'button', 'aria-pressed': String(musicOn()),
    title: t('story.music.title'),
    onclick() {
      const on = music.getAttribute('aria-pressed') !== 'true';
      music.setAttribute('aria-pressed', String(on));
      setMusicOn(on);
      if (on && btn.getAttribute('aria-pressed') === 'true') startMusic(world);
    } }, h('span', { 'aria-hidden': 'true' }, '♪ '), t('story.music'));
  return h('span', { class: 'listen' }, btn, voiceName ? h('span', { class: 'listen-voice' }, t('story.aiVoice', { name: voiceName })) : null, music, note);
}

/** A real, credited NASA photo, shown in the chapter where it matters most. */
function photo(a, m) {
  const source = db.sources.get(m.source_id);
  const tiny = m.width < 960 && m.src.endsWith('.png');   // raw data thumbnails: keep the pixels hard
  return h('figure', { class: `photo${tiny ? ' raw' : ''}` },
    h('img', { src: m.src, width: m.width, height: m.height, alt: t(m.alt_key), loading: 'lazy', decoding: 'async' }),
    h('figcaption', {},
      h('span', { class: 'eyebrow' }, t('media.real')),
      h('span', { class: 'photo-caption' }, t(m.caption_key)),
      h('span', { class: 'fine' }, t('media.credit', { credit: m.credit }), ' · ',
        h('a', { href: source.url, target: '_blank', rel: 'noopener' }, m.nasa_id))));
}

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** A real recording, drawn as its own waveform. Nothing downloads until Play is pressed. */
function sound(m) {
  const source = db.sources.get(m.source_id);
  const audio = h('audio', { src: m.src, preload: 'none' });
  const n = m.peaks.length;
  const bars = m.peaks.map((p, i) => {
    const hgt = Math.max(1.5, p * 38);
    return s('rect', { x: i * 4, y: 20 - hgt / 2, width: 2.4, height: hgt });
  });
  const wave = s('svg', { viewBox: `0 0 ${n * 4} 40`, preserveAspectRatio: 'none', class: 'wave', 'aria-hidden': 'true' }, ...bars);
  const time = h('span', { class: 'sound-time' }, `0:00 / ${clock(m.duration)}`);
  const label = h('span', {}, t('media.play'));
  const glyph = h('span', { class: 'sound-glyph', 'aria-hidden': 'true' }, '▶');
  const button = h('button', { type: 'button', class: 'sound-play', 'aria-pressed': 'false',
    onclick() { if (audio.paused) audio.play(); else audio.pause(); } }, glyph, h('span', { class: 'sr' }, label));
  const paint = () => {
    const k = audio.currentTime / (audio.duration || m.duration);
    bars.forEach((b, i) => b.classList.toggle('on', i / n < k));
    time.textContent = `${clock(audio.currentTime)} / ${clock(m.duration)}`;
  };
  const playing = (on) => {
    button.setAttribute('aria-pressed', String(on));
    label.textContent = t(on ? 'media.pause' : 'media.play');
    glyph.textContent = on ? '❚❚' : '▶';
  };
  audio.addEventListener('timeupdate', paint);
  audio.addEventListener('play', () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); stopMusic(); playing(true); });   // never mix music into a real recording
  audio.addEventListener('pause', () => playing(false));
  audio.addEventListener('ended', () => { playing(false); audio.currentTime = 0; paint(); });
  // Click on the waveform to jump.
  wave.addEventListener('click', (e) => {
    const r = wave.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * m.duration;
    if (audio.paused) audio.play();
  });
  return h('figure', { class: 'sound' },
    h('p', { class: 'eyebrow' }, t('media.realSound')),
    h('p', { class: 'sound-title' }, t(m.title_key)),
    h('div', { class: 'sound-player' }, button, wave, time),
    audio,
    h('figcaption', {},
      h('span', { class: 'photo-caption' }, t(m.caption_key)),
      h('details', { class: 'transcript' }, h('summary', {}, t('media.transcript')), h('p', {}, t(m.transcript_key))),
      h('span', { class: 'fine' }, t('media.audio.credit', { credit: m.credit }), ' · ',
        h('a', { href: source.url, target: '_blank', rel: 'noopener' }, source.publisher))));
}

function head(a) {
  const live = h('span', { class: 'story-live' });
  return {
    live,
    el: h('header', { class: `story-head status-${a.status}` },
      machineArt(a.id),
      h('div', {},
        h('p', { class: 'story-name' }, a.name),
        h('p', { class: 'eyebrow' }, statusMark(a.status), ' ', placeOf(a)), live),
      h('a', { class: 'close', href: `#/m/${a.id}`, 'aria-label': t('story.close') }, '×')),
  };
}

function endPanel(a) {
  const hd = head(a);
  const myth = mythCard(a);
  const others = machineRows(db.artifacts.filter((b) => b.id !== a.id));
  const fresh = markFound(a.id) ? a.id : null;     // the stamp animates only the first time
  const next = nextButton(a);
  return {
    title: `${a.name}: ${t('story.end.title')}`,
    el: h('div', { class: 'pane pane-read pane-story' }, hd.el,
      h('h1', { tabindex: '-1' }, t('story.end.title')),
      h('div', { class: `found-card status-${a.status}${fresh ? ' fresh' : ''}` },
        h('span', { class: 'found-stamp', 'aria-hidden': 'true' }, statusMark(a.status), t('mission.found')),
        h('p', {}, t('mission.foundLine', { name: a.name }))),
      missionStrip(fresh),
      next ? h('p', { class: 'story-nav' }, next)
        : h('div', { class: 'mission-done' }, h('h2', {}, t('mission.done.title')), h('p', {}, t('mission.done.text')),
          h('p', { class: 'story-nav' }, h('a', { class: 'action', href: '#/rollcall' }, t('rollcall.start'), ' ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')))),
      myth ? [h('h2', { class: 'eyebrow' }, t('myth.title')), myth] : null,
      h('h2', { class: 'eyebrow' }, t('mission.others')),
      others.el),
    tick(now) { hd.live.textContent = liveSummary(a, now); others.update(now); },
  };
}

export function storyPanel(id, step) {
  const a = artifact(id);
  if (!a) return null;
  if (step === 'end') return endPanel(a);

  const total = CHAPTERS.length;
  const n = Math.min(total, Math.max(1, parseInt(step, 10) || 1));
  const chapter = CHAPTERS[n - 1];
  const text = t(`story.${a.id}.${chapter}`);
  const titleKey = chapter === 'lastDay' && a.status === 'still-working' ? 'story.lastDay.working' : `story.${chapter}`;
  const prev = n > 1 ? `#/story/${a.id}/${n - 1}` : `#/m/${a.id}`;
  const next = n < total ? `#/story/${a.id}/${n + 1}` : `#/story/${a.id}/end`;
  const hd = head(a);
  const laser = a.status === 'still-working' && chapter === 'how' ? laserPanel() : null;
  let listen = null;

  const hasSister = chapter === 'carriesOn' && a.sister && factsOf(a, a.sister.fact_ids).length === a.sister.fact_ids.length;
  const sisterText = hasSister ? t(`story.${a.id}.sister`) : '';
  const facts = factsOf(a, [...a.chapters[chapter].fact_ids, ...(hasSister ? a.sister.fact_ids : [])]);

  const el = h('div', { class: 'pane pane-read pane-story', 'data-machine': a.id },
    hd.el,
    h('ol', { class: 'progress', 'aria-label': t('story.chapter', { n, total }) },
      ...CHAPTERS.map((c, i) => h('li', {}, h('a', { href: `#/story/${a.id}/${i + 1}`, class: i + 1 === n ? 'here' : i + 1 < n ? 'done' : null,
        'aria-current': i + 1 === n ? 'step' : null, 'aria-label': `${i + 1}. ${t('story.' + c)}` })))),
    h('p', { class: 'eyebrow chapter-no' }, ROMAN[n - 1], h('span', { class: 'sr' }, ' ', t('story.chapter', { n, total }))),
    h('h1', { tabindex: '-1' }, t(titleKey)),
    readable('p', { class: 'narration', 'data-clip': `${a.id}.${chapter}` }, text),
    ...(a.media || []).filter((m) => m.chapter === chapter && db.sources.has(m.source_id))
      .map((m) => (m.kind === 'audio' ? sound(m) : photo(a, m))),
    a.id === 'opportunity' && chapter === 'lastDay' && db.game
      ? h('a', { class: 'game-invite', href: '#/play/opportunity' }, h('span', { class: 'eyebrow' }, t('game.invite')), h('strong', {}, db.game.ui.title), ' ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')) : null,
    laser?.el,
    hasSister ? h('aside', { class: 'sister' }, h('h2', { class: 'eyebrow' }, t('story.sister')), readable('p', { 'data-clip': `${a.id}.sister` }, sisterText)) : null,
    h('nav', { class: 'story-nav', 'aria-label': t('story.chapter', { n, total }) },
      h('a', { class: 'action small ghost', href: prev }, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '←'), ' ', t('story.back')),
      h('span', { class: 'listen-slot' }),
      h('a', { class: 'action small', href: next }, t(n < total ? 'story.next' : 'story.finish'), ' ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'))),
    h('details', { class: 'real-data' },
      h('summary', {}, t('story.realData'), h('span', { class: 'count' }, ` ${facts.length}`)),
      h('p', { class: 'fine' }, t('story.realData.lead'), lang === 'en' ? '' : ' ' + t('real.english')),
      h('ul', { class: 'plain' }, ...facts.map((f) => h('li', {}, f.text, ' ', sourceLink(db.sources.get(f.source_id)))))));

  // Read-aloud reads every sentence span in this chapter, in order.
  listen = listenButton(el);
  if (listen) el.querySelector('.story-nav .listen-slot')?.replaceWith(listen);

  // Arrow keys and sideways swipes turn the page.
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('summary, .globe')) return;
    if (e.key === 'ArrowRight') location.hash = next;
    if (e.key === 'ArrowLeft') location.hash = prev;
  };
  let x0 = null, y0 = 0;
  el.addEventListener('touchstart', (e) => { x0 = e.changedTouches[0].clientX; y0 = e.changedTouches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
    const forward = document.documentElement.dir === 'rtl' ? dx > 0 : dx < 0;
    location.hash = forward ? next : prev;
  }, { passive: true });
  document.addEventListener('keydown', onKey);

  return {
    el, title: `${a.name}: ${t(titleKey)}`,
    tick(now) { hd.live.textContent = liveSummary(a, now); },
    destroy() {
      document.removeEventListener('keydown', onKey);
      listen?.querySelector('button').stop();
      for (const clip of el.querySelectorAll('audio')) clip.pause();
      laser?.destroy();
    },
  };
}
