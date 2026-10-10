# BD Quiz Arena — বাংলাদেশ কুইজ অ্যারেনা

A fully offline, bilingual (English/বাংলা) Bangladesh general-knowledge quiz
game. The factory's first **game**: 305 curated multiple-choice questions
across 8 categories, 4 game modes, streak scoring, lifelines, and XP/level
progression — all in a single static site with zero network requests.

**Live:** `https://fahad3235.github.io/bd-quiz-arena/`
**Repo:** `https://github.com/fahad3235/bd-quiz-arena`

## The problem

Most Bangladesh GK quiz apps are ad-stuffed, require accounts, or mix in
unverified trivia. Students and quiz lovers needed a clean, offline,
bilingual arena with a question bank they can trust.

## Features

- **305 bilingual questions** across 8 categories — every question, all 4
  options, and the explanation fully translated (EN + বাংলা)
- **4 game modes:** Quick Play (10 random), Category Challenge (10 from one
  category), Lightning (60-second blitz), Marathon (endless until 3 wrong)
- **Real scoring:** `points = 100 × difficulty + 50 × (streak − 1)` on a
  correct answer; streaks reset on wrong/timeout
- **Lifelines:** 50:50 and Skip, once per round each
- **Configurable question timer** (15 / 30 / 60 s) with visual countdown
- **Progression:** XP + levels, best scores per mode and per category,
  personal top-10 leaderboard, accuracy / games / best-streak stats —
  all persisted in `localStorage`
- **End-of-round review** with correct answers and explanations
- **Full BN ⇄ EN toggle** that re-renders even mid-game text
- **Accuracy-first bank:** schema-validated at load (bad entries are dropped
  with a console warning, never crash); disputed facts excluded — see
  [SOURCES.md](SOURCES.md)
- Responsive arena-style dark UI, mobile-safe at 390 px

## Tech stack

Vanilla HTML + CSS + JavaScript. No frameworks, no build step, no backend,
no external requests (questions load via same-origin `fetch` of local JSON;
fonts are system fonts).

## Prerequisites

Any modern browser, or Python 3 for the local dev server.

## Install

No install needed — it's a static site. To run locally:

```bash
cd bd-quiz-arena
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` directly via `file://` works for the shell, but
questions load via `fetch`, so a local server is required for the bank.)

## Dev commands

| Command | Purpose |
|---|---|
| `python3 -m http.server 8000` | Local dev server |
| `python3 /tmp/bqa-test/test.py` | Full test suite (needs Playwright + headless shell) |
| `node --check js/app.js` | JS syntax check |

## Environment

None. No API keys, no `.env`, no secrets of any kind.

## Testing

Real headless-Chromium tests via Playwright (`/tmp/bqa-test/test.py`,
kept outside the repo):

- **Bank integrity (305 checks):** every question validated — non-empty
  bilingual q/options/explanation, exactly 4 options per language, answer
  index 0–3, difficulty 1–3, unique ids, no duplicate question text;
  per-category minimums; answer-index spread check
- **Gameplay:** full 10-question round completes; score math verified exactly
  against the documented formula; first-correct = 100×difficulty;
  wrong resets streak; 50:50 hides exactly 2 wrong options (once per round);
  skip advances with no scoring and streak preserved (once per round);
  timeout counts as wrong; marathon ends after 3 wrong; lightning ends at 60 s
- **Persistence:** XP and best scores survive a page reload
- **i18n:** BN toggle rewrites the live question (mid-game), options,
  feedback, and review
- **Mobile:** 390 px viewport, zero horizontal overflow
- **Zero console/page errors** throughout

Result: **334/334 passed.** One real bug was found and fixed during testing
(language toggle did not re-render mid-game text); one test-side fix
(corrected Playwright headless-shell path); 3 duplicate questions removed
from the bank.

## Deployment

GitHub Pages compatible (static site, `main` branch, `/ (root)`).
No build step.

## Limitations

- The question bank is curated static content — see [SOURCES.md](SOURCES.md)
  for what's verified and what's deliberately excluded
- `fetch()` requires serving over HTTP(S); `file://` alone won't load questions
- Progress/XP is per-browser `localStorage` (no sync, no accounts)
- Sound effects need a first user gesture (browser autoplay policy)
- Timers pause when the tab is hidden (browser throttling)

## Status

Complete and tested. Built 2026-10-10 as MUSE PROJECT FACTORY Ω run #11.
