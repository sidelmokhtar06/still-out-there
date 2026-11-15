// "Can you save Opportunity?" — eight real days from the 2018 dust storm to the last command.
// Every choice is something the real team did, and none of them work. Text and numbers come
// from data/game/opportunity.json, where every fact names its source.
import { h, statusMark } from '../ui/dom.js';
import { t } from '../i18n.js';
import { db, artifact, factsOf, placeOf } from '../data.js';
import { sourceLink } from '../ui/mythFact.js';
import { formatDate } from '../live.js';
import { signalTrack } from '../ui/beam.js';
import { orbitView } from '../ui/orbit.js';

const TAU_MAX = 12;
const LOG_KEY = 'still-out-there:opportunity-log';
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const days = (from, to) => Math.round((new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400e3);

// The player's choices, kept only in this browser tab (never sent anywhere).
const log = {
  read() { try { return JSON.parse(sessionStorage.getItem(LOG_KEY)) || {}; } catch { return {}; } },
  write(entries) { try { sessionStorage.setItem(LOG_KEY, JSON.stringify(entries)); } catch { /* storage blocked: the log just stays empty */ } },
  add(n, entry) { const all = this.read(); all[n] = entry; this.write(all); },
  clear() { this.write({}); },
};

/** The most recent published tau on or before turn n (1-based), or null. */
function lastReading(game, n) {
  for (let i = n - 1; i >= 0; i--) if (typeof game.turns[i].tau === 'number') return game.turns[i];
  return null;
}

function factList(items) {
  return h('ul', { class: 'plain' }, ...items.map((f) => h('li', {}, f.text, ' ', sourceLink(db.sources.get(f.source_id)))));
}

/** Tau gauge: published values only. On a day without one it says so and names the last published value. */
function gauge(game, n) {
  const ui = game.ui, turn = game.turns[n - 1], at = (v) => `${(Math.min(v, TAU_MAX) / TAU_MAX) * 100}%`;
  const has = typeof turn.tau === 'number';
  const prev = has ? null : lastReading(game, n);
  const note = prev ? fill(ui.lastReading, { tau: `${prev.tauBelow ? '< ' : ''}${prev.tau}`, date: formatDate(prev.date) }) : null;
  return h('div', { class: 'gauge' },
    h('div', { class: 'gauge-head' },
      h('span', { class: 'eyebrow' }, ui.tau),
      h('span', { class: 'gauge-value' }, has ? `${turn.tauBelow ? '< ' : ''}${turn.tau}` : '—')),
    h('div', { class: 'gauge-track', role: 'img', 'aria-label': has ? `${ui.tau}: ${turn.tauBelow ? 'below ' : ''}${turn.tau}` : `${ui.tau}: ${note}` },
      has ? h('span', { class: 'gauge-fill', style: `width:${at(turn.tau)}` }) : null,
      prev ? h('span', { class: 'gauge-ghost', style: `left:${at(prev.tau)}` }) : null,
      h('span', { class: 'gauge-mark', style: `left:${at(game.tauNormal)}` }, h('span', {}, 'A')),
      h('span', { class: 'gauge-mark', style: `left:${at(game.tauRecharge)}` }, h('span', {}, 'B'))),
    h('p', { class: 'gauge-legend' }, `A  ${game.tauNormal} ${ui.tauNormal}`, h('br'), `B  ${game.tauRecharge} ${ui.tauRecharge}`),
    note ? h('p', { class: 'fine' }, note) : null);
}

/** The days-without-signal counter. It runs up from the previous turn so the silence is felt. */
function silenceCounter(game, n) {
  const ui = game.ui, now = days(game.lastContact, game.turns[n - 1].date);
  const before = n > 1 ? days(game.lastContact, game.turns[n - 2].date) : now;
  const big = h('span', { class: 'big' }, String(now));
  const el = h('div', { class: 'silent-days' },
    n > 1 ? h('span', { class: 'eyebrow later' }, fill(ui.later, { n: now - before })) : null,
    big, h('span', { class: 'eyebrow' }, ui.silent));
  if (n > 1 && !reducedMotion()) {
    big.textContent = String(before);
    const start = performance.now() + 250, span = 1400;
    const step = (time) => {
      const k = Math.max(0, Math.min(1, (time - start) / span)), e = 1 - Math.pow(1 - k, 3);
      big.textContent = String(Math.round(before + (now - before) * e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  return el;
}

function introPanel(game) {
  const a = artifact(game.artifact);
  return {
    title: game.ui.title, dust: 0,
    el: h('div', { class: 'pane pane-read pane-game' },
      h('p', { class: 'eyebrow' }, statusMark(a.status), ' ', a.name, ' · ', placeOf(a)),
      h('h1', { tabindex: '-1' }, game.ui.title),
      h('p', { class: 'narration' }, game.ui.intro),
      h('p', { class: 'story-nav' }, h('a', { class: 'action', href: '#/play/opportunity/1', onclick: () => log.clear() },
        game.ui.start, ' ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')))),
  };
}

function turnPanel(game, n) {
  const turn = game.turns[n - 1], ui = game.ui, total = game.turns.length;
  const result = h('div', { class: 'game-result', 'aria-live': 'polite' });
  const choices = h('div', { class: 'choices' }, ...turn.choices.map((c) =>
    h('button', { type: 'button', class: 'choice', onclick: () => choose(c) }, c.label)));
  const nextHref = n < total ? `#/play/opportunity/${n + 1}` : '#/play/opportunity/end';
  let timer = 0;

  function choose(choice) {
    for (const b of choices.querySelectorAll('button')) {
      b.disabled = true;
      if (b.textContent === choice.label) b.classList.add('picked');
    }
    const outcome = turn.outcome || ui.noSignal;
    log.add(n, { label: choice.label, outcome });
    const listening = h('p', { class: 'listening' }, ui.listening, h('span', { class: 'dots', 'aria-hidden': 'true' }));
    const signal = signalTrack(turn.date, { from: ui.signalFrom, to: ui.signalTo, time: ui.signalTime, note: ui.signalNote });
    result.replaceChildren(h('p', { class: 'reply' }, choice.reply), signal.el, listening);
    signal.send(1.6);
    const finish = () => {
      listening.replaceWith(h('p', { class: turn.outcome ? 'no-signal got-signal' : 'no-signal' }, outcome));
      result.append(
        h('details', { class: 'real-data' }, h('summary', {}, ui.real, h('span', { class: 'count' }, ` ${turn.facts.length}`)), factList(turn.facts)),
        h('p', { class: 'story-nav' }, h('a', { class: 'action', href: nextHref }, n < total ? ui.next : ui.end, ' ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'))));
      result.querySelector('.action').focus({ preventScroll: true });
    };
    if (reducedMotion()) finish(); else timer = setTimeout(finish, 3000);
  }

  const reading = lastReading(game, n);
  return {
    title: `${ui.title} ${fill(ui.turn, { n, total })}`,
    dust: reading ? reading.tau : 0,           // the globe shows the last published value, as the gauge says
    destroy() { clearTimeout(timer); },
    el: h('div', { class: 'pane pane-read pane-game' },
      h('ol', { class: 'progress steps-8', 'aria-label': fill(ui.turn, { n, total }) },
        ...game.turns.map((_, i) => h('li', {}, h('span', { class: i + 1 === n ? 'here' : i + 1 < n ? 'done' : null })))),
      h('p', { class: 'eyebrow chapter-no' }, fill(ui.turn, { n, total })),
      h('h1', { tabindex: '-1' }, formatDate(turn.date)),
      h('div', { class: 'game-readout' }, silenceCounter(game, n), gauge(game, n)),
      h('p', { class: 'narration' }, turn.situation),
      choices, result),
  };
}

function missionLog(game) {
  const entries = log.read(), ui = game.ui;
  const rows = game.turns.map((turn, i) => [turn, entries[i + 1]]).filter(([, e]) => e);
  if (!rows.length) return h('p', { class: 'fine' }, ui.logEmpty);
  return h('div', {},
    h('ol', { class: 'mission-log' }, ...rows.map(([turn, e]) =>
      h('li', {},
        h('span', { class: 'log-date' }, formatDate(turn.date)),
        h('span', { class: 'log-choice' }, e.label),
        h('span', { class: turn.outcome ? 'log-outcome got-signal' : 'log-outcome' }, e.outcome)))),
    h('p', { class: 'fine' }, ui.logNote));
}

function lastPhoto(game, a) {
  const m = (a.media || []).find((x) => x.kind === 'image');
  const source = m && db.sources.get(m.source_id);
  if (!source) return null;
  return h('figure', { class: 'photo raw' },
    h('p', { class: 'eyebrow' }, game.ui.lastPhoto),
    h('img', { src: m.src, width: m.width, height: m.height, alt: t(m.alt_key), loading: 'lazy', decoding: 'async' }),
    h('figcaption', {},
      h('span', { class: 'photo-caption' }, t(m.caption_key)),
      h('span', { class: 'fine' }, t('media.credit', { credit: m.credit }), ' · ',
        h('a', { href: source.url, target: '_blank', rel: 'noopener' }, m.nasa_id))));
}

function endPanel(game) {
  const e = game.ending, a = artifact(game.artifact);
  const closingFacts = factsOf(a, e.closing_fact_ids);
  const song = db.sources.get(e.song_source_id);
  return {
    title: `${game.ui.title} ${e.title}`, dust: 0,
    el: h('div', { class: 'pane pane-read pane-game' },
      h('p', { class: 'eyebrow chapter-no' }, formatDate(game.turns.at(-1).date)),
      h('h1', { tabindex: '-1' }, e.title),
      h('p', { class: 'narration' }, e.lead),
      h('h2', { class: 'eyebrow' }, game.ui.logTitle),
      missionLog(game),
      lastPhoto(game, a),
      h('p', { class: 'lead' }, e.song),
      song ? h('p', { class: 'fine' }, sourceLink(song)) : null,
      h('p', { class: 'lead' }, e.closing),
      orbitView(a)?.el,                 // the game ends with a search: find Oppy from orbit
      h('details', { class: 'real-data' }, h('summary', {}, game.ui.real), factList(closingFacts)),
      h('p', { class: 'story-nav' },
        h('a', { class: 'action small ghost', href: '#/play/opportunity/1', onclick: () => log.clear() }, e.replay),
        h('a', { class: 'action small', href: `#/story/${a.id}/5` }, e.story, ' ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')))),
  };
}

export function gamePanel(step) {
  const game = db.game;
  if (!game) return null;
  if (!step) return introPanel(game);
  if (step === 'end') return endPanel(game);
  const n = Math.min(game.turns.length, Math.max(1, parseInt(step, 10) || 1));
  return turnPanel(game, n);
}
