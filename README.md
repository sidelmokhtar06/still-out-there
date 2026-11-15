# Still Out There

*They stopped talking. They never left.*

**NASA Space Apps Challenge 2026 · Challenge: "Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars"**

People have left machines all over the solar system, and most kids have never heard of them. Space history is usually told as finished events. *Still Out There* shows that these machines are still out there **right now**: the Sun still rises on them, the distance to them keeps changing, and one of them is still part of an experiment that is running today.

It is a live, story-driven map for ages 9–14 (and curious adults). Ten machines on the Moon, on Mars and in deep space each tell their own story in their own voice. Every fact they say is checked against a NASA source you can open.

## What you can do

| Feature | What it shows | Powered by |
|---|---|---|
| **Live globes** of the Moon and Mars | Where it is day and night at this moment; local time and Sun height at each machine | Mars24 algorithm (NASA GISS); Astronomy Engine; NASA/USGS surface maps |
| **Deep space line** | Pioneer 10 and Kepler placed at their real distance from Earth right now, with light travel time | JPL Horizons trajectory tables |
| **Stories** (10 machines × 5 chapters) | Each machine speaks in the first person: why it was sent, how it worked, what it found, its last day, who carries on | NSSDCA and science.nasa.gov facts, each shown with its source in a "Real data" drawer |
| **Roll call** | All ten answer in turn, in the order they went quiet. The last one: "Still working." | Recorded AI voices, sourced dates |
| **Can you save Opportunity?** | An 8-turn game through the real 2018–2019 recovery effort. Every choice is something the team really tried. None of them work. | JPL status reports, published dust opacity (tau) values, Earth–Mars light time |
| **Fire the laser** | A laser pulse to the Apollo mirrors that takes the true round-trip time (~2.5 s) | Earth–Moon distance computed live |
| **Real photos and sounds** | Opportunity's last images, Ingenuity's broken-blade shadow, the largest marsquake ever recorded, Ingenuity flying | NASA Image Library, JPL Photojournal |
| **Myth or fact?** | Opportunity's "last words", Surveyor 3's bacteria, the Apollo flags | Sourced fact checks |

## How we keep it accurate

- Every fact in `data/artifacts.json` points to an entry in `data/sources.json` and is marked `verified` only after it was checked against that page. The site refuses to display a fact that is not verified.
- `node tools/check-facts.js` fails if any fact is unverified or unsourced, if a chapter cites a missing fact, if narration is outside 40–90 words, if a photo or sound lacks a source, credit, caption or alt text, or if a recorded narration no longer matches its text.
- `node tools/test-time.js` checks the time engines against published references: NASA's Mars24 worked examples (to the second), the lunar phases, the Sun angle at the Apollo 11 landing, and the length of a lunar day.
- Live numbers that cannot be computed are hidden, never guessed. The dust gauge in the game shows only tau values NASA published.
- The challenge's resource list puts Dawn, NEAR Shoemaker, Pioneer and Kepler under "Mars". None of them are at Mars, so every machine is placed where it really is.
- Where NASA has not published a coordinate (Opportunity's and Ingenuity's final resting spots), the map shows the official landing site and says so.

## Run it

Plain HTML, CSS and JavaScript, no build step.

```sh
python3 -m http.server 8080      # then open http://localhost:8080
npm test                         # time-engine tests + fact checker
```

(Opening `index.html` straight from disk will not work: browsers block loading the data files from `file://`.)

Maintenance tools:
- `tools/fetch-ephemeris.sh`: re-download the JPL Horizons distance tables.
- `ELEVENLABS_API_KEY=… LANG_CODE=en|fr|ar node tools/narrate.mjs [machine]`: regenerate narration after editing a story (delete the old clip first). The key is read from the environment and never stored. Arabic numbers, dates, units and names are rewritten for the voice by `tools/arabic-say.mjs`; add `DRY=1` to print what would be read without spending credits.
- `python3 tools/make-music.py`: re-render the background music loops (Moon, Mars, deep space). Chords, bells and mood for each world are at the top of the file; playback volume is `LEVEL` in `js/ui/ambience.js`.

## Accessibility

Atkinson Hyperlegible typeface, text sized in rem, high contrast, visible focus, full keyboard use (arrow keys turn pages and rotate the globe), every globe marker also available as a plain list, status shown by marker shape as well as colour, alt text on every photo, a text description of every sound, read-aloud narration with sentence highlighting, and every animation switched off under `prefers-reduced-motion`.

## Project layout

```
index.html  css/style.css
js/main.js              router; the stage (globe or distance line) stays, the panel beside it changes
js/time/                marsTime.js (Mars24), moonTime.js, deepSpace.js
js/ui/                  globe, ruler, panel, story, rollcall, beam (laser/signal), mythFact, art, about
js/game/opportunity.js  Can you save Opportunity?
data/                   artifacts, sources, ephemeris tables, game, narration timings, i18n
tools/                  tests, fact checker, data and narration generators
```

## Use of AI

We used an AI coding assistant (Claude, by Anthropic) to help write code, gather and check facts against the linked sources, and draft the first versions of the story texts. Story narration voices are AI-generated with ElevenLabs (free plan, credited as elevenlabs.io). Every fact shown was verified against its source page, and the time calculations are tested against published reference values.

## Credits and licence

See [CREDITS.md](CREDITS.md) for every image, sound, font, library and data source. Code and our own text are released under the MIT licence ([LICENSE](LICENSE)). NASA images and audio are used under NASA's media guidelines with credit; narration audio follows ElevenLabs' free-plan terms (non-commercial, attribution).

This is a student project for the NASA Space Apps Challenge. It is not made or endorsed by NASA.
