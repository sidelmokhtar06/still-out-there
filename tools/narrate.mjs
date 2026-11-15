// Generates recorded narration for the stories with ElevenLabs (free plan: credit "elevenlabs.io").
// The API key is read from the environment and never written to disk:
//   ELEVENLABS_API_KEY=... node tools/narrate.mjs [machine ...]      e.g. node tools/narrate.mjs opportunity
// Output: assets/audio/narration/en/<machine>-<chapter>.mp3 and data/narration/en.json
// (per-sentence start/end times, so the page can highlight each sentence as it is spoken).
// Files that already exist are skipped, so re-running only fills in what is missing.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { arabicSay } from './arabic-say.mjs';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY && !process.env.DRY) { console.error('Set ELEVENLABS_API_KEY first.'); process.exit(1); }

const LANG = process.env.LANG_CODE || 'en';     // en, fr or ar (LANG_CODE=ar node tools/narrate.mjs)
const MODEL = process.env.MODEL || 'eleven_turbo_v2_5';   // 0.5 credit/char; eleven_multilingual_v2 is 1 credit/char
const CHAPTERS = ['why', 'how', 'found', 'lastDay', 'carriesOn', 'sister', 'rollcall'];
// One voice per machine, matched to its personality (ElevenLabs default voices).
export const VOICES = {
  eagle: ['Brian', 'nPczCjzI2devNBz1zQrb'],
  lrv: ['Charlie', 'IKne3meq5aSn9XLyUdCD'],
  retro: ['Alice', 'Xb7hH8MSUJpSbSDYk0k2'],
  surveyor3: ['Daniel', 'onwK4e9ZLuTAKqWW03F9'],
  sojourner: ['Laura', 'FGY2WhTYpPnrIDTdsKH5'],
  opportunity: ['Matilda', 'XrExE9yKIg1WjnnlVkGX'],
  ingenuity: ['Jessica', 'cgSgspJ2msm6clMCkdW9'],
  insight: ['Eric', 'cjVigY5qzO86Huf0OWal'],
  pioneer10: ['George', 'JBFqnCBsd6RMkjVDRZzb'],
  kepler: ['Lily', 'pFZP5JQG7iQjIQuC4Bku'],
};

const root = new URL('..', import.meta.url);
// Optional per-language voices, e.g. native Arabic voices: data/narration/ar.voices.json = { "eagle": ["Name", "voiceId"], ... }
const voicesFile = new URL(`data/narration/${LANG}.voices.json`, root);
if (existsSync(voicesFile)) Object.assign(VOICES, JSON.parse(readFileSync(voicesFile, 'utf8')));

// What the voice reads can differ from what the page shows, to fix pronunciation (tools/arabic-say.mjs).
// The page text is untouched; `map` links each page character to the spoken text for sentence timings.
const say = (str) => (LANG === 'ar' ? arabicSay(str) : { spoken: str, map: [...str, ''].map((_, i) => i) });
const text = JSON.parse(readFileSync(new URL(`data/i18n/${LANG}.json`, root), 'utf8'));
const manifestUrl = new URL(`data/narration/${LANG}.json`, root);
const manifest = existsSync(manifestUrl) ? JSON.parse(readFileSync(manifestUrl, 'utf8')) : { voices: {}, clips: {} };
mkdirSync(new URL(`assets/audio/narration/${LANG}/`, root), { recursive: true });
mkdirSync(new URL('data/narration/', root), { recursive: true });

// Same sentence split as js/ui/story.js, so sentence i here is sentence i on the page.
const SENTENCE = /[^.!?…؟]+[.!?…؟]+["'’”»)]*\s*|[^.!?…؟]+$/g;
// Sentences are found in the page text, then looked up in the spoken text through `map`.
function sentenceTimes(page, { spoken, map }, align) {
  const starts = align.character_start_times_seconds, ends = align.character_end_times_seconds;
  const last = spoken.length - 1, out = [];
  for (const m of page.matchAll(SENTENCE)) {
    const raw = m[0], lead = raw.length - raw.trimStart().length, body = raw.trim();
    if (!body) continue;
    const a = m.index + lead, b = a + body.length - 1;
    const sa = Math.min(map[a], last);
    let sb = Math.max(Math.min(map[b + 1] - 1, last), sa);
    while (sb > sa && /\s/.test(spoken[sb])) sb--;
    out.push([+starts[sa].toFixed(2), +ends[sb].toFixed(2)]);
  }
  return out;
}

const only = process.argv.slice(2);
const machines = Object.keys(VOICES).filter((id) => !only.length || only.includes(id));
let chars = 0;
for (const id of machines) {
  const [voiceName, voiceId] = VOICES[id];
  manifest.voices[id] = voiceName;
  for (const chapter of CHAPTERS) {
    const key = `${id}.${chapter}`, story = text[chapter === 'rollcall' ? `rollcall.${id}` : `story.${key}`];
    if (!story) continue;
    const file = `assets/audio/narration/${LANG}/${id}-${chapter}.mp3`;
    if (existsSync(new URL(file, root)) && manifest.clips[key]) { console.log('skip', key); continue; }
    const said = say(story), spoken = said.spoken;
    if (process.env.DRY) { console.log(`${key}: ${spoken}\n`); continue; }   // DRY=1: print, send nothing
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: spoken, model_id: MODEL, language_code: LANG, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.25, speed: 0.95 } }),
    });
    const body = await res.json();
    if (!res.ok) { console.error(`FAILED ${key}: ${res.status} ${JSON.stringify(body.detail ?? body).slice(0, 300)}`); process.exit(1); }
    writeFileSync(new URL(file, root), Buffer.from(body.audio_base64, 'base64'));
    const sentences = sentenceTimes(story, said, body.alignment);
    manifest.clips[key] = { src: file, sentences };
    writeFileSync(manifestUrl, JSON.stringify(manifest, null, 1));   // save after every clip
    chars += spoken.length;
    console.log(`ok   ${key} (${voiceName}, ${spoken.length} chars, ${sentences.length} sentences, ${sentences.at(-1)?.[1]} s)`);
  }
}
console.log(`\nDone. ${chars} characters sent (about ${Math.round(chars * 0.5)} credits on ${MODEL}).`);
