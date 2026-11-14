// The map is the app. One stage (globe or distance line) stays on screen; the pane beside it
// changes with the route:
//   #/moon  #/mars  #/deep        a world, nothing selected
//   #/m/<id>                      one machine: the stage turns to it, the pane shows live telemetry
//   #/story/<id>/<1-5|end>        its story, as a reading sheet over the stage
//   #/play/opportunity[/<1-8|end>] the Save Opportunity game
//   #/rollcall                    every machine answers in turn; the stage follows
//   #/myths  #/sources            reading sheets
import { loadData, artifact, byBody } from './data.js';
import { loadLanguage, t } from './i18n.js';
import { h } from './ui/dom.js';
import { createGlobe } from './ui/globe.js';
import { createRuler } from './ui/ruler.js';
import { introPanel, briefPanel } from './ui/panel.js';
import { storyPanel } from './ui/story.js';
import { mythsPanel } from './ui/mythFact.js';
import { aboutPanel } from './ui/about.js';
import { gamePanel } from './game/opportunity.js';
import { rollCallPanel } from './ui/rollcall.js';
import { starfield } from './ui/space.js';

const shell = document.getElementById('shell');
const stageEl = document.getElementById('stage');
const paneEl = document.getElementById('app');
let stage = null, world = null, pane = null, firstRender = true;

function parse() {
  const [, name = '', a, b] = location.hash.split('/');
  if (name === 'moon' || name === 'mars' || name === 'deep') return { world: name, pane: () => introPanel(name), mode: 'brief' };
  const machine = artifact(a);
  if (name === 'm' && machine) return { world: machine.body, select: machine.id, pane: () => briefPanel(machine), mode: 'brief' };
  if (name === 'story' && machine) return { world: machine.body, select: machine.id, pane: () => storyPanel(a, b), mode: 'read' };
  if (name === 'play' && a === 'opportunity' && gamePanel(b)) return { world: 'mars', select: 'opportunity', pane: () => gamePanel(b), mode: 'read' };
  if (name === 'rollcall') return { world: world || 'moon', pane: () => rollCallPanel(focusOn), mode: 'brief', nav: 'rollcall' };
  if (name === 'myths') return { world: world || 'moon', pane: mythsPanel, mode: 'read', nav: 'myths' };
  if (name === 'sources') return { world: world || 'moon', pane: aboutPanel, mode: 'read', nav: 'sources' };
  return { world: 'moon', pane: () => introPanel('moon'), mode: 'brief' };
}

function setWorld(next, now) {
  if (next === world) return false;
  stage?.destroy();
  world = next;
  stage = next === 'deep' ? createRuler(byBody('deep')) : createGlobe(next, byBody(next));
  stageEl.replaceChildren(stage.el, ...stageEl.querySelectorAll(':scope > .stage-keep'));   // overlays like subtitles survive a world change
  shell.dataset.world = next;
  // Moon: the face we see from Earth. Mars: start on the sunlit side.
  if (next === 'mars') stage.lookAt(stage.subsolarLon(now), 0, false);
  return true;
}

/** Lets a pane move the stage to any machine without changing the page (used by the roll call). */
function focusOn(id) {
  const a = artifact(id);
  if (!a) return;
  const kind = a.body === world ? null : (WORLD_ORDER.indexOf(a.body) > WORLD_ORDER.indexOf(world) ? 'world-fwd' : 'world-back');
  transition(kind, () => {
    const now = new Date();
    const fresh = setWorld(a.body, now);
    stage.select(id, !fresh);
    stage.update(now);
  });
}

const WORLD_ORDER = ['moon', 'mars', 'deep'];
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastHash = '';

/** Which transition a route change deserves: a telescope slew between worlds, a page turn, or a fade. */
function transitionKind(nextWorld) {
  if (!world) return null;
  if (nextWorld !== world) return WORLD_ORDER.indexOf(nextWorld) > WORLD_ORDER.indexOf(world) ? 'world-fwd' : 'world-back';
  const [, n1, id1, s1] = lastHash.split('/'), [, n2, id2, s2] = location.hash.split('/');
  if (n1 === n2 && id1 === id2 && (n1 === 'story' || n1 === 'play')) {
    const num = (x) => (x === 'end' ? 99 : parseInt(x, 10) || 0);
    if (num(s2) !== num(s1)) return num(s2) > num(s1) ? 'page-next' : 'page-prev';
  }
  return 'fade';
}

/** Runs a DOM update inside a View Transition when the browser supports it; otherwise just runs it. */
function transition(kind, update) {
  if (!kind || reducedMotion() || !document.startViewTransition) { update(); return; }
  const rtl = document.documentElement.dir === 'rtl';
  document.documentElement.dataset.vt = rtl ? kind.replace(/fwd|back|next|prev/, (m) => ({ fwd: 'back', back: 'fwd', next: 'prev', prev: 'next' })[m]) : kind;
  const vt = document.startViewTransition(update);
  vt.finished.finally(() => { delete document.documentElement.dataset.vt; });
}

function render() {
  const route = parse();
  const kind = firstRender ? null : transitionKind(route.world);
  transition(kind, () => renderNow(route));
  lastHash = location.hash;
}

function renderNow(route) {
  const now = new Date();
  const fresh = setWorld(route.world, now);
  stage.select(route.select ?? null, !fresh);
  if (!route.select && !fresh && world === 'moon') stage.lookAt(0, 0);
  if (!route.select && !fresh && world === 'mars' && !route.keepView) stage.lookAt(stage.subsolarLon(now), 0);

  pane?.destroy?.();
  pane = route.pane();
  paneEl.replaceChildren(pane.el);
  shell.dataset.mode = route.mode;
  // In the game, dust thickens over the globe as tau rises (NASA's published values only).
  shell.style.setProperty('--dust', pane.dust == null ? (shell.style.getPropertyValue('--dust') || 0) : Math.min(0.88, pane.dust / 11));
  stage.update(now);
  pane.tick?.(now);

  document.title = `${pane.title} · ${t('app.title')}`;
  const current = route.nav ?? (route.mode === 'read' && !route.select ? null : world);
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === current) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
  if (!firstRender) {          // move keyboard and screen-reader focus to the new heading
    paneEl.scrollTop = 0;
    if (matchMedia('(max-width: 859px)').matches && route.mode === 'read') window.scrollTo(0, 0);
    pane.el.querySelector('h1')?.focus({ preventScroll: true });
  }
  firstRender = false;
}

/** First visit in this tab: "Calculating where the Sun is right now…", then daylight sweeps on. */
function boot() {
  let seen = false;
  try { seen = sessionStorage.getItem('still-out-there:booted') === '1'; sessionStorage.setItem('still-out-there:booted', '1'); } catch { /* storage blocked */ }
  if (seen || reducedMotion() || world === 'deep') return;
  const overlay = h('button', { type: 'button', class: 'boot stage-keep', 'aria-label': t('boot.skip') },
    h('span', { class: 'boot-line' }, h('span', { class: 'boot-dot' }), t('boot.line')),
    h('span', { class: 'boot-time' }, new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'));
  stageEl.append(overlay);
  const finish = () => { stage.skipReveal(); overlay.classList.add('gone'); setTimeout(() => overlay.remove(), 600); };
  overlay.addEventListener('click', finish);
  stage.reveal(1500, 600).then(finish);
}

/** Bottom of the stage: a live clock on a glowing arc, in the spirit of a mission-control timeline. */
function timeBar() {
  const date = h('span', { class: 'tb-date' }), clock = h('span', { class: 'tb-clock' });
  const el = h('div', { class: 'timebar stage-keep', 'aria-hidden': 'true' },
    h('span', { class: 'tb-live' }, h('span', { class: 'tb-dot' }), t('timebar.live')),
    h('div', { class: 'tb-arc' },
      date, h('span', { class: 'tb-rate' }, t('timebar.rate')), clock,
      h('span', { class: 'tb-knob' })));
  const fmtDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const tick = (now) => { date.textContent = fmtDate.format(now).toUpperCase(); clock.textContent = fmtTime.format(now); };
  tick(new Date());
  return { el, tick };
}

async function start() {
  try {
    await Promise.all([loadLanguage('en'), loadData()]);
  } catch (err) {
    console.error(err);
    paneEl.replaceChildren(h('p', { class: 'loading', role: 'alert' },
      'The data could not be loaded. If you opened this file directly, run a small web server instead (see README).'));
    return;
  }
  document.body.prepend(starfield());
  const bar = timeBar();
  stageEl.append(bar.el);
  window.addEventListener('hashchange', render);
  render();
  boot();
  setInterval(() => {
    if (document.hidden) return;
    const now = new Date();
    stage?.update(now);
    pane?.tick?.(now);
    bar.tick(now);
  }, 1000);
}

start();
