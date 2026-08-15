# Rising Star — a mobile-first football career game

A complete, self-contained football career game in vanilla HTML/CSS/JS. You control one
player — not the team — from a fourth-tier debut at 17 to (hopefully) the top flight:
play the key moments of each match, train, manage energy and relationships, earn and
spend money, negotiate contracts and move clubs across seasons.

Everything is original: clubs, players, leagues, art and audio are all generated or drawn
in code. No external assets, no network calls, no build step.

## Run it

From the repo root:

```bash
npm run dev
# then open http://localhost:3000/games/rising-star/index.html
```

Or serve the folder with anything static:

```bash
cd public/games/rising-star
python3 -m http.server 8080
# open http://localhost:8080
```

It also opens straight from the filesystem (`file://.../index.html`) — the scripts are
plain classic scripts, not ES modules.

**On a phone:** serve over your LAN (`python3 -m http.server 8080 --bind 0.0.0.0`) and open
`http://<your-computer-ip>:8080` on the device. The layout is built phone-first; on desktop
it renders inside a centred phone-sized frame.

## How to play

**The week.** Each week you get **3 actions** (train an attribute, rest, gym, or spend time
on the people around you), then a match. Energy limits everything — training and matches
burn it, rest and lifestyle purchases restore it.

**The match.** The clock runs quickly and stops whenever you are involved. Each key moment
is a short interactive situation with a countdown (the countdown is longer if your
Composure is high):

| Moment | Control |
|---|---|
| Shot / Free kick / Penalty | Swipe at the goal. Where you release is where you aim, **how fast you flick sets the power**, and **swiping in an arc bends the ball**. |
| Find a pass | Swipe towards a teammate. Green ring = free, red ring = marked. Flick harder for a longer ball. |
| Take him on | Swipe left or right the instant the shrinking ring hits the dashed target ring. Beat your man and you get a shot out of it. |
| Header / Cross / Tackle | Tap when the moving marker is inside the green zone. |

Every moment moves your **match rating**, which drives everything else: game time,
the manager's opinion, fan and sponsor interest, wages and transfer offers.

**The career.** 4 divisions × 12 clubs, 22 league rounds plus 5 cup rounds per season.
Finish top two and your club goes up; finish bottom two and it goes down. At the end of a
season you get awards, ageing, and a transfer window with concrete offers (wage, length,
signing fee, squad role). Attributes grow fastest before 24 and start to decay after 31.

## Files

```
index.html      screens and layout
styles.css      all styling (dark, phone-first)
js/data.js      clubs, leagues, names, positions, traits, shop items
js/audio.js     procedural WebAudio sound effects (no audio files)
js/state.js     career object, progression maths, save/load
js/world.js     fixtures, tables, cup, weekly + season progression, transfers
js/match.js     the match engine: 2.5D canvas renderer + interactive moments
js/ui.js        screens, menus, and the career loop glue
js/main.js      boot
```

Progress saves to `localStorage` after every action and falls back to in-memory saving if
storage is unavailable.
