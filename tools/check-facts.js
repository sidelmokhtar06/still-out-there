// node tools/check-facts.js — run before every deploy. Fails if the accuracy rules are broken:
//  - every fact is verified and has a real source
//  - every chapter exists, cites facts that exist, and its narration is 40–90 words
//  - every myth card and location cites a real source
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const artifacts = read('data/artifacts.json');
const sources = new Map(read('data/sources.json').map((s) => [s.id, s]));
const text = read('data/i18n/en.json');
const CHAPTERS = ['why', 'how', 'found', 'lastDay', 'carriesOn'];
const problems = [];
const bad = (msg) => problems.push(msg);

for (const s of sources.values()) {
  for (const field of ['title', 'url', 'publisher', 'accessed']) if (!s[field]) bad(`source ${s.id}: missing ${field}`);
  if (!/^https:\/\//.test(s.url || '')) bad(`source ${s.id}: url must be https`);
}

let factCount = 0;
const usedSources = new Set();
for (const a of artifacts) {
  const facts = new Map();
  for (const f of a.facts) {
    factCount++;
    if (facts.has(f.id)) bad(`${a.id}: duplicate fact id ${f.id}`);
    facts.set(f.id, f);
    if (f.verified !== true) bad(`${a.id}/${f.id}: not verified`);
    if (!sources.has(f.source_id)) bad(`${a.id}/${f.id}: unknown source "${f.source_id}"`);
    usedSources.add(f.source_id);
  }
  const cited = new Set();
  const cite = (where, ids = []) => {
    if (!ids.length) bad(`${a.id}/${where}: cites no facts`);
    for (const id of ids) { cited.add(id); if (!facts.has(id)) bad(`${a.id}/${where}: cites missing fact ${id}`); }
  };
  for (const c of CHAPTERS) {
    if (!a.chapters?.[c]) { bad(`${a.id}: missing chapter ${c}`); continue; }
    cite(c, a.chapters[c].fact_ids);
    const story = text[`story.${a.id}.${c}`];
    if (!story) { bad(`${a.id}/${c}: no narration text`); continue; }
    const words = story.trim().split(/\s+/).length;
    if (words < 40 || words > 90) bad(`${a.id}/${c}: narration is ${words} words (want 40–90)`);
  }
  if (a.mythFact) {
    cite('mythFact', a.mythFact.fact_ids);
    for (const side of ['myth', 'fact']) if (!text[`mythcard.${a.mythFact.key}.${side}`]) bad(`${a.id}: myth card text missing (${side})`);
  }
  if (a.sister) { cite('sister', a.sister.fact_ids); if (!text[`story.${a.id}.sister`]) bad(`${a.id}: sister text missing`); }
  for (const f of a.facts) if (!cited.has(f.id)) bad(`${a.id}/${f.id}: fact is never shown`);
  if (a.body !== 'deep') {
    if (typeof a.location?.lat !== 'number' || typeof a.location?.lon_east !== 'number') bad(`${a.id}: missing coordinates`);
    if (!sources.has(a.location?.source_id)) bad(`${a.id}: coordinates have no source`);
  } else if (!a.ephemeris) bad(`${a.id}: deep-space machine has no ephemeris table`);
  if (!['silent', 'still-working', 'drifting'].includes(a.status)) bad(`${a.id}: unknown status`);
  for (const m of a.media || []) {
    if (!sources.has(m.source_id)) bad(`${a.id}: photo ${m.src} has no source`);
    if (!m.credit) bad(`${a.id}: photo ${m.src} has no credit`);
    if (!CHAPTERS.includes(m.chapter)) bad(`${a.id}: photo ${m.src} is in unknown chapter ${m.chapter}`);
    if (!existsSync(new URL('../' + m.src, import.meta.url))) bad(`${a.id}: photo file missing: ${m.src}`);
    for (const k of m.kind === 'audio' ? [m.caption_key, m.transcript_key, m.title_key] : [m.caption_key, m.alt_key]) if (!text[k]) bad(`${a.id}: photo text missing: ${k}`);
  }
}

try {
  const game = read('data/game/opportunity.json');
  const opp = artifacts.find((a) => a.id === game.artifact);
  game.turns.forEach((turn, i) => {
    if (!turn.date || !turn.situation || !turn.choices?.length) bad(`game turn ${i + 1}: incomplete`);
    if (!turn.facts?.length) bad(`game turn ${i + 1}: no facts`);
    for (const f of turn.facts || []) if (!sources.has(f.source_id)) bad(`game turn ${i + 1}: unknown source ${f.source_id}`);
  });
  if (!sources.has(game.ending.song_source_id)) bad('game ending: song has no source');
  for (const id of game.ending.closing_fact_ids) if (!opp?.facts.some((f) => f.id === id)) bad(`game ending: missing fact ${id}`);
} catch (e) { bad('game data unreadable: ' + e.message); }

// Recorded narration (optional): every clip must exist and line up sentence-for-sentence with its text.
try {
  const narration = read('data/narration/en.json');
  const SENTENCE = /[^.!?…]+[.!?…]+["'’”)]*\s*|[^.!?…]+$/g;
  for (const [key, clip] of Object.entries(narration.clips)) {
    const [mid, part] = key.split('.');
    const story = text[part === 'rollcall' ? `rollcall.${mid}` : `story.${key}`];
    if (!story) { bad(`narration ${key}: no matching story text`); continue; }
    if (!existsSync(new URL('../' + clip.src, import.meta.url))) bad(`narration ${key}: missing ${clip.src}`);
    const n = [...story.matchAll(SENTENCE)].filter((m) => m[0].trim()).length;
    if (n !== clip.sentences.length) bad(`narration ${key}: ${clip.sentences.length} timings for ${n} sentences (text changed? re-run tools/narrate.mjs)`);
  }
} catch (e) { if (e.code !== 'ENOENT') bad('narration data unreadable: ' + e.message); }

if (problems.length) {
  console.error(`check-facts: ${problems.length} problem(s)\n - ` + problems.join('\n - '));
  process.exit(1);
}
const official = [...usedSources].filter((id) => sources.get(id).official_resource).length;
console.log(`check-facts: OK. ${artifacts.length} machines, ${factCount} verified facts, ${usedSources.size} sources cited (${official} official challenge resources).`);
