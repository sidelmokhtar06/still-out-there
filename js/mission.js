// The mission: one path through all ten machines (Moon, then Mars, then deep space, in data order).
// Finishing a machine's story marks it found. The path is a default for readers who do not know
// where to go next; every page can still be reached directly.
import { h, statusMark } from './ui/dom.js';
import { t } from './i18n.js';
import { db } from './data.js';

const KEY = 'still-out-there:found';

export function found() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
}

/** Marks a machine found. Returns true the first time, so the page can celebrate once. */
export function markFound(id) {
  const set = found();
  if (set.has(id)) return false;
  set.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* storage blocked: the path still works, it just forgets */ }
  return true;
}

/** The next machine to visit: finish the current world first (looking forward from `after`), then the
 *  first machine not found yet in path order. Null when all are found. */
export function nextMachine(after = null) {
  const list = db.artifacts, have = found();
  const from = list.findIndex((a) => a.id === after);
  if (from >= 0) {
    for (let i = 1; i < list.length; i++) {
      const a = list[(from + i) % list.length];
      if (a.body === list[from].body && !have.has(a.id)) return a;
    }
  }
  return list.find((a) => !have.has(a.id)) ?? null;
}

/** Ten badges in path order, lit when found. `fresh` is the machine just found: its badge stamps in. */
export function missionStrip(fresh = null) {
  const have = found(), list = db.artifacts;
  return h('div', { class: 'mission' },
    h('p', { class: 'mission-count' }, t('mission.count', { n: have.size, total: list.length })),
    h('ol', { class: 'mission-badges' }, ...list.map((a, i) => h('li', { class: i && a.body !== list[i - 1].body ? 'new-world' : null },
      h('a', { href: `#/m/${a.id}`, class: `badge status-${a.status}${have.has(a.id) ? ' found' : ''}${a.id === fresh ? ' fresh' : ''}`,
        'aria-label': t(have.has(a.id) ? 'mission.badge.found' : 'mission.badge.todo', { name: a.name }), title: a.name },
        statusMark(a.status))))));
}

const arrow = () => h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→');

/** The main button on a world page: start, continue, or (all found) the roll call. */
export function missionButton() {
  const next = nextMachine();
  if (!next) return h('a', { class: 'action', href: '#/rollcall' }, t('rollcall.start'), ' ', arrow());
  const label = found().size ? t('mission.continue', { name: next.name }) : t('mission.start');
  return h('a', { class: 'action mission-go', href: `#/m/${next.id}` }, label, ' ', arrow());
}

/** The main button at the end of a story: the next machine on the path, naming the next world when it changes. */
export function nextButton(from) {
  const next = nextMachine(from.id);
  if (!next) return null;
  const label = next.body === from.body ? t('mission.next', { name: next.name })
    : t('mission.nextStop', { world: t('world.' + next.body), name: next.name });
  return h('a', { class: 'action mission-go', href: `#/m/${next.id}` }, label, ' ', arrow());
}
