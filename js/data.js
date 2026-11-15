import { lang, t } from './i18n.js';

// Loads data/*.json once. Ephemeris tables are optional: if one is missing, its widget hides.
export const db = { artifacts: [], sources: new Map(), ephemeris: {}, game: null, narration: null };

async function json(path, optional = false) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

/** Puts translated text over the English game data (numbers, dates and sources stay as they are). */
function overlay(game, text) {
  const out = structuredClone(game);
  Object.assign(out.ui, text.ui || {});
  Object.assign(out.ending, text.ending || {});
  (text.turns || []).forEach((tt, i) => {
    const turn = out.turns[i];
    if (!turn || !tt) return;
    if (tt.situation) turn.situation = tt.situation;
    if (tt.outcome) turn.outcome = tt.outcome;
    (tt.choices || []).forEach((c, k) => { if (turn.choices[k] && c) Object.assign(turn.choices[k], c); });
  });
  return out;
}

export async function loadData() {
  const [artifacts, sources, pioneer10, kepler, game, narration] = await Promise.all([
    json('data/artifacts.json'), json('data/sources.json'),
    json('data/pioneer10_ephemeris.json', true), json('data/kepler_ephemeris.json', true),
    json('data/game/opportunity.json', true),
    json(`data/narration/${lang}.json`, true),
  ]);
  const gameText = lang === 'en' ? null : await json(`data/game/opportunity.${lang}.json`, true);
  db.sources = new Map(sources.map((s) => [s.id, s]));
  db.ephemeris = { pioneer10, kepler };
  db.game = game && gameText ? overlay(game, gameText) : game;
  db.narration = narration;
  // Accuracy rule: a fact that is not verified against its source is never shown.
  for (const a of artifacts) a.facts = a.facts.filter((f) => f.verified === true && db.sources.has(f.source_id));
  db.artifacts = artifacts;
}

export const artifact = (id) => db.artifacts.find((a) => a.id === id);
export const byBody = (body) => db.artifacts.filter((a) => a.body === body);
export const factsOf = (a, ids = []) => ids.map((id) => a.facts.find((f) => f.id === id)).filter(Boolean);
export const CHAPTERS = ['why', 'how', 'found', 'lastDay', 'carriesOn'];

/** Place name and location note in the reader's language (English from the data file if missing). */
export const placeOf = (a) => { const k = `place.${a.id}`, v = t(k); return v === k ? a.location.label : v; };
export const noteOf = (a) => { if (!a.location.note) return null; const k = `note.${a.id}`, v = t(k); return v === k ? a.location.note : v; };
