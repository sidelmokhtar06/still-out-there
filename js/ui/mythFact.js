// Myth-vs-Fact. Each claim has a real button that reveals what happened, with its sources.
import { h } from './dom.js';
import { t } from '../i18n.js';
import { db, factsOf } from '../data.js';

export function sourceLink(source) {
  return h('span', { class: 'source' },
    h('a', { href: source.url, target: '_blank', rel: 'noopener' }, source.title),
    `, ${source.publisher}`,
    source.official_resource ? h('span', { class: 'tag tag-official' }, t('story.official')) : null,
    source.non_nasa ? h('span', { class: 'tag' }, t('story.nonNasa')) : null);
}

/** Returns null when the claim's facts are not verified, so an unchecked claim is never shown. */
export function mythCard(a) {
  if (!a.mythFact) return null;
  const facts = factsOf(a, a.mythFact.fact_ids);
  if (facts.length !== a.mythFact.fact_ids.length) return null;
  const key = a.mythFact.key;
  const sources = [...new Set(facts.map((f) => f.source_id))].map((id) => db.sources.get(id));

  const answer = h('div', { class: 'myth-answer', hidden: true },
    h('p', { class: 'eyebrow' }, t('myth.fact')),
    h('p', { class: 'myth-fact' }, t(`mythcard.${key}.fact`)),
    h('p', { class: 'fine' }, t('myth.sources'), ': ', ...sources.flatMap((s, i) => [i ? '; ' : '', sourceLink(s)])));
  const label = h('span', {}, t('myth.check'));
  const button = h('button', { class: 'action small', type: 'button', 'aria-expanded': 'false',
    onclick() {
      const open = answer.hidden;
      answer.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      label.textContent = t(open ? 'myth.hide' : 'myth.check');
    } }, label);
  return h('article', { class: 'myth' },
    h('p', { class: 'eyebrow' }, t('myth.myth')),
    h('p', { class: 'myth-claim' }, t(`mythcard.${key}.myth`)),
    button, answer);
}

export function mythsPanel() {
  return {
    title: t('myth.title'),
    el: h('div', { class: 'pane pane-read' },
      h('h1', { tabindex: '-1' }, t('myth.title')),
      h('p', { class: 'lead' }, t('myth.lead')),
      ...db.artifacts.map(mythCard).filter(Boolean)),
  };
}
