# Still Out There

*They stopped talking. They never left.*

A live map of the machines humanity left on the Moon, on Mars and in deep space. Each globe shows where the Sun is shining **right now**. Pick a machine to see its local time, how high the Sun is, or how far away it is this second. Then hear it tell its own story in five short chapters.

NASA Space Apps Challenge 2026, challenge: *Abandoned but not Forgotten*.

## Run it

It's a static site with no build step. Any web server works:

```sh
python3 -m http.server 8080      # then open http://localhost:8080
npm test                         # time-engine tests + fact checker
```

Opening `index.html` directly from disk won't work because browsers block `fetch` on `file://`.

## What's live

| Where | What | How |
|---|---|---|
| Mars | Local solar time, Sun elevation, season | NASA GISS **Mars24** algorithm, tested against NASA's published worked examples (`tools/test-time.js`) |
| Moon | Day/night at each site, next sunrise/sunset | Astronomy Engine: Sun direction rotated into the Moon-fixed frame. Checked against lunar phases and the Apollo 11 landing Sun angle (about 10°) |
| Deep space | Distance from Earth and light time for Pioneer 10 and Kepler | Daily tables from **JPL Horizons** (`tools/fetch-ephemeris.sh`), interpolated. If a table is missing, the reading is hidden; the site never shows an invented number |

## How we keep it accurate

- Every fact in `data/artifacts.json` has a `source_id` pointing into `data/sources.json` and `verified: true`. Each fact was checked by hand against its page on 2026-11-14.
- `node tools/check-facts.js` fails the build if any fact is unverified or unsourced, if a chapter cites a missing fact, or if any narration falls outside 40–90 words.
- The machines speak in the first person, but every number in that voice also appears in the chapter's **Real data** drawer, next to its source.
- Sources are ranked in this order: the challenge's official resources (NSSDCA, science.nasa.gov), then other NASA/JPL pages, then non-NASA pages (labelled in the UI). Non-NASA sources are used only for the myth cards.
- The challenge's resource list puts Dawn, NEAR Shoemaker, Pioneer and Kepler under "Mars". None of them are at Mars, so each machine is placed where it really is.

## Accessibility

Atkinson Hyperlegible type, text sized in rem, WCAG AA contrast, visible focus, and every globe marker is also a link in a plain list. Status is shown by marker shape as well as colour. Narration can be read aloud (Web Speech API). Arrow keys or a swipe turn story pages, and the arrow keys also rotate the globe. Animation stops under `prefers-reduced-motion`.

## Project layout

```
index.html  css/style.css
js/main.js            router: the globe stays put, the pane beside it changes
js/time/              marsTime.js (Mars24), moonTime.js, deepSpace.js
js/ui/                globe.js, ruler.js, panel.js, story.js, mythFact.js, art.js, about.js
data/                 artifacts.json, sources.json, *_ephemeris.json, i18n/en.json
tools/                test-time.js, check-facts.js, fetch-ephemeris.sh
```

## AI use

Built with help from an AI coding assistant (Claude), which drafted code, gathered facts and wrote the first drafts of the narration. Every fact shown was checked against the linked source page, and the time engines are tested against published reference values. Team members should review all narration before submission.

Not made or endorsed by NASA. See [CREDITS.md](CREDITS.md).
