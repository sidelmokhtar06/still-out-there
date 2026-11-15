# Space Apps submission kit

Copy each section into the matching field on the Space Apps project page. Replace anything in [square brackets].

---

## Project name
Still Out There

## High-level summary (short field)

One machine humanity left on the Moon is still part of an experiment running today. Scientists fire lasers at the reflector Apollo 14 left there in 1971. *Still Out There* is a live, story-driven map for ages 9–14 of ten machines on the Moon, on Mars and in deep space. Each one tells its own story in its own voice, in English, French and Arabic. Pupils see whether it is day or night where each machine sits right now. They search real orbital photos for the machines as they are today, and play an unwinnable game to save the Opportunity rover. Every fact links to the NASA source it was checked against.

## Project details

### The problem
Space history is taught as finished events: a landing, a date, a photo. Most children have never heard of the machines we left behind, and they never think of them as still being somewhere. Most space material for children is also in English only.

### What we made
A website that runs on any phone or computer, with nothing to install:

- **Live globes of the Moon and Mars.** Day and night are drawn for this exact second, with local time and Sun height at every machine. Pioneer 10 and Kepler are placed at their real distance from Earth right now.
- **Ten machines, five chapters each, in the first person:** why I was sent, how I worked, what I found, my last day, who carries on. Narrated with read-along highlighting.
- **Seen from orbit, today.** Real LRO and HiRISE photos of Eagle, the Apollo 14 site, Opportunity and InSight, taken years after they went quiet. Zoom in and the view locks on. InSight has turned from blue to Mars-red under the dust. Opportunity is one faint dot, and the reader has to find it.
- **Can you save Opportunity?** Eight turns through the real 2018–2019 recovery effort. Every choice is something the team really tried. None of them work. The game teaches that failure is part of exploration, then ends with the search for Oppy from orbit.
- **The roll call.** All ten machines answer in the order they went quiet. The last one says: "Still working."
- **Fire the laser** at the Apollo 14 reflector and wait the true ~2.5-second round trip.
- **Myth or fact?** "My battery is low and it's getting dark", the Surveyor 3 bacteria, and the Apollo flags, each answered with sources.

### How it answers the challenge
| The challenge asks for | Where it is |
|---|---|
| Stories of hardware NASA left on the Moon | Eagle, Lunar Roving Vehicle, Laser Retroreflector, Surveyor 3 |
| …on Mars | Sojourner, Opportunity, Ingenuity, InSight |
| …and in deep space | Pioneer 10, Kepler, placed at their live distances |
| The science each machine made possible | Chapter 3, "What I found", for every machine, with sourced facts |
| For school-age space enthusiasts | Written for ages 9–14, read-aloud narration, a game, a search, and a [40-minute teacher guide](teacher-guide.md) |
| Uses NASA data | NSSDCA, science.nasa.gov, JPL Horizons, Mars24, LRO and HiRISE imagery, the NASA Image Library ([full list](../data/sources.json)) |

### Why we trust our own facts (validity)
- 102 facts, each linked to a NASA source and marked verified only after it was checked against that page. The site refuses to show an unverified fact.
- An automated checker fails the build if any fact, photo, sound, translation or narration loses its source or drifts from its text. Translations must contain exactly the same numbers as the English.
- The time engines are tested against NASA's published Mars24 worked examples, to the second, and against lunar phases and the Sun angle at the Apollo 11 landing.
- When something can't be computed, it is hidden, never guessed. The dust gauge in the game shows only tau values NASA published.
- We corrected the challenge's own resource list: it files Kepler, Pioneer, Dawn and NEAR under "Mars", so we placed every machine where it really is.

### Local impact
We are a team from Mauritania. Here, school is taught in Arabic and French, and there is little space-science material for children in either language. Every story, game turn, caption and voice is available in Arabic, French and English, with a proper right-to-left layout and Western digits as used in Mauritanian schools. The site is a plain web page with no install and no account, so it works on low-cost phones.

### Tools
Plain HTML, CSS and JavaScript (no framework, no build step). Astronomy Engine for lunar geometry. Our own implementation of NASA's Mars24 algorithm. JPL Horizons tables for spacecraft distances. Python for the original background music. ElevenLabs for the narration voices.

### Use of AI
We used Claude (Anthropic) to help write code, collect and cross-check facts against the linked sources, and draft first versions of story texts and translations. Narration voices are AI-generated with ElevenLabs. Every fact shown was checked against its source by the team, and the time calculations are tested against NASA's published reference values.

## Demo
[link to the 30-second video, or to the 7 slides]

## Project link
[live site URL] · [GitHub repository URL]

## References
See [CREDITS.md](../CREDITS.md) and [data/sources.json](../data/sources.json) (also shown on the site's Sources page).

---

# 30-second video script

Record at 1920×1080 in a desktop browser with the language set to English. Clear the session first so the opening daylight sweep plays. Add English subtitles for every line.

| Time | On screen | Voice-over / subtitle |
|---|---|---|
| 0–4 s | Moon page loads; daylight sweeps across the globe; the "Right now" line ticks. | "Right now, the Sun is rising on machines we left on the Moon." |
| 4–9 s | Click **Eagle** → scroll to **Seen from orbit** → **Zoom in**. Brackets lock on. "Still there." | "They stopped talking. They never left." |
| 9–15 s | Mars → Opportunity → its "My last day" chapter, narration playing, sentence highlighted. | "Each one tells its own story, checked against NASA sources." |
| 15–21 s | The game: dust thickens over Mars → **NO SIGNAL** → the ending → tap the dot → *You found me!* | "Try to save Opportunity. Nothing works. That really happened." |
| 21–26 s | The roll call reaches the reflector: "Still working." → **Fire the laser**, 2.5 s round trip. | "And one of them is still working." |
| 26–30 s | Switch to **عربي**, then **FR**; the Moon page mirrors. End card: *Still Out There*, the URL. | "Still Out There, in Arabic, French and English." |

**Tips:** cut hard between scenes, with no slow scrolling. Keep the cursor still while text is on screen. Record each scene separately, then edit.
