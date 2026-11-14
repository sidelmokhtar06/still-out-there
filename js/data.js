// Loads data/*.json once. Ephemeris tables are optional: if one is missing, its widget hides.
export const SHOWN_WORLDS = ['moon', 'mars'];
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

export async function loadData() {
  const [artifacts, sources, pioneer10, kepler, game, narration] = await Promise.all([
    json('data/artifacts.json'), json('data/sources.json'),
    json('data/pioneer10_ephemeris.json', true), json('data/kepler_ephemeris.json', true),
    json('data/game/opportunity.json', true),
    json('data/narration/en.json', true),
  ]);
  db.sources = new Map(sources.map((s) => [s.id, s]));
  db.ephemeris = { pioneer10, kepler };
  db.game = game;
  db.narration = narration;
  // Accuracy rule: a fact that is not verified against its source is never shown.
  for (const a of artifacts) a.facts = a.facts.filter((f) => f.verified === true && db.sources.has(f.source_id));
  // The site is about the Moon and Mars. The deep-space machines (Pioneer 10, Kepler) stay in
  // data/artifacts.json, fully sourced, but are not shown: add 'deep' here to bring them back.
  db.artifacts = artifacts.filter((a) => SHOWN_WORLDS.includes(a.body));
}

export const artifact = (id) => db.artifacts.find((a) => a.id === id);
export const byBody = (body) => db.artifacts.filter((a) => a.body === body);
export const factsOf = (a, ids = []) => ids.map((id) => a.facts.find((f) => f.id === id)).filter(Boolean);
export const CHAPTERS = ['why', 'how', 'found', 'lastDay', 'carriesOn'];
