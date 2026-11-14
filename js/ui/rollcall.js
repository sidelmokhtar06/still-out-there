// Roll call: every machine answers in its own voice, in the order it went quiet, and the stage
// flies to it. The retroreflector answers last: "Still working." Lines are in data/i18n
// (rollcall.<id>); their facts are the sourced dates in each machine's story.
import { h, statusMark } from './dom.js';
import { t } from '../i18n.js';
import { db, artifact } from '../data.js';
import { formatDate, daysSince } from '../live.js';

const number = new Intl.NumberFormat('en-US');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Order: when each went quiet; anything still working comes last. */
function lineup() {
  return [...db.artifacts].sort((a, b) =>
    (a.status === 'still-working') - (b.status === 'still-working') || a.since.date.localeCompare(b.since.date));
}

export function rollCallPanel(focusOn) {
  const order = lineup();
  const caption = h('p', { class: 'rc-caption', 'aria-live': 'polite' });
  const rows = order.map((a) => {
    const days = h('span', { class: 'rc-days' });
    return { a, days, el: h('li', { class: `rc-row status-${a.status}` },
      statusMark(a.status),
      h('a', { href: `#/m/${a.id}`, class: 'rc-name' }, a.name),
      h('span', { class: 'rc-year' }, a.since.date.slice(0, 4)),
      days) };
  });
  const end = h('p', { class: 'narration rc-end', hidden: true }, t('rollcall.end'));
  const label = h('span', {}, t('rollcall.start'));
  let run = 0, audio = null;
  const subtitle = h('p', { class: 'stage-subtitle stage-keep', 'aria-hidden': 'true' });   // the list caption is the accessible one
  const showSubtitle = (text) => { const stage = document.getElementById('stage'); if (!stage.contains(subtitle)) stage.append(subtitle); subtitle.textContent = text; subtitle.hidden = !text; };

  const reset = () => { for (const r of rows) r.el.classList.remove('speaking', 'done'); caption.textContent = ''; };
  const stop = () => { run++; audio?.pause(); subtitle.hidden = true; button.setAttribute('aria-pressed', 'false'); label.textContent = t('rollcall.again'); };

  async function play() {
    const id = ++run, live = () => id === run;
    reset(); end.hidden = true;
    button.setAttribute('aria-pressed', 'true'); label.textContent = t('rollcall.stop');
    for (const r of rows) {
      if (!live()) return;
      const { a } = r;
      if (a.status === 'still-working') await sleep(1400);        // a beat of silence before the one that answers
      if (!live()) return;
      focusOn(a.id);
      r.el.classList.add('speaking');
      r.el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      caption.textContent = t(`rollcall.${a.id}`);
      showSubtitle(caption.textContent);
      const clip = db.narration?.clips?.[`${a.id}.rollcall`];
      if (clip) {
        audio = new Audio(clip.src);
        await new Promise((done) => {
          audio.addEventListener('ended', done, { once: true });
          audio.addEventListener('error', () => sleep(2600).then(done), { once: true });
          audio.play().catch(() => sleep(2600).then(done));       // no sound allowed: keep going in silence
        });
      } else await sleep(2600);
      if (!live()) return;
      r.el.classList.replace('speaking', 'done');
      await sleep(450);
    }
    if (!live()) return;
    showSubtitle(t('rollcall.end'));
    end.hidden = false;
    button.setAttribute('aria-pressed', 'false'); label.textContent = t('rollcall.again');
  }

  const button = h('button', { type: 'button', class: 'action', 'aria-pressed': 'false',
    onclick: () => (button.getAttribute('aria-pressed') === 'true' ? stop() : play()) }, label);

  return {
    title: t('rollcall.title'),
    dust: 0,
    el: h('div', { class: 'pane pane-read pane-rollcall' },
      h('h1', { tabindex: '-1' }, t('rollcall.title')),
      h('p', { class: 'lead' }, t('rollcall.lead')),
      h('p', { class: 'story-nav' }, button),
      caption,
      h('ol', { class: 'rc-list' }, ...rows.map((r) => r.el)),
      end,
      h('p', { class: 'fine' }, t('rollcall.pick'), ' ', t('rollcall.note'))),
    tick(now) {
      for (const r of rows) {
        const n = number.format(daysSince(r.a.since.date, now));
        r.days.textContent = r.a.status === 'still-working' ? `${t('status.still-working')}` : `${n} d`;
        r.days.title = formatDate(r.a.since.date);
      }
    },
    destroy() { run++; audio?.pause(); subtitle.remove(); },
  };
}
