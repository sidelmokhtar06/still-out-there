// Sources and method: how accuracy is kept, and every source, official challenge resources first.
import { h } from './dom.js';
import { t } from '../i18n.js';
import { db } from '../data.js';
import { sourceLink } from './mythFact.js';

export function aboutPanel() {
  const all = [...db.sources.values()];
  const rank = (s) => (s.official_resource ? 0 : s.non_nasa ? 2 : 1);
  all.sort((a, b) => rank(a) - rank(b));
  return {
    title: t('about.title'),
    el: h('div', { class: 'pane pane-read' },
      h('h1', { tabindex: '-1' }, t('about.title')),
      h('h2', { class: 'eyebrow' }, t('about.why.title')),
      h('p', { class: 'lead' }, t('about.why')),
      h('p', {}, t('about.lead')),
      h('p', {}, t('about.sorted')),
      h('h2', { class: 'eyebrow' }, t('about.live')),
      h('ul', { class: 'plain' }, h('li', {}, t('about.live.mars')), h('li', {}, t('about.live.moon')), h('li', {}, t('about.live.deep'))),
      h('h2', { class: 'eyebrow' }, t('about.all')),
      h('ul', { class: 'plain' }, ...all.map((s) => h('li', {}, sourceLink(s)))),
      h('p', { class: 'fine' }, t('app.notNasa'))),
  };
}
