/* BD Quiz Arena — game engine: modes, timer, scoring, lifelines, progression.
   SCORING (documented, testable): on a correct answer,
     points = 100 * difficulty + 50 * (streak - 1)
   where streak = consecutive-correct count INCLUDING this answer.
   Wrong/timeout resets streak to 0 and scores 0. Skip preserves streak.
   XP: after each game, xp += final score. level = 1 + floor(xp / 1000).
*/
const LS_KEY = "bqa_state_v1";

const Game = {
  state: null,       // persisted settings + progression
  round: null,       // current round
  timerId: null,
  timeLeft: 0,

  defaultState() {
    return {
      lang: "en", qtime: 30, sound: true, xp: 0,
      bests: {},            // "mode:quick" -> score ; "cat:geography" -> score
      board: [],            // [{score, mode, cat, date}]
      stats: { games: 0, answered: 0, correct: 0, bestStreak: 0 },
    };
  },

  loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return Object.assign(this.defaultState(), JSON.parse(raw));
    } catch (e) { /* corrupted -> reset */ }
    return this.defaultState();
  },

  saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.state)); } catch (e) {}
  },

  /* ---- round lifecycle ---- */
  newGame(mode, category) {
    let pool = Bank.questions;
    if (mode === "category") {
      if (!category || !(Bank.byCategory[category] || []).length) return null;
      pool = Bank.byCategory[category];
    }
    const count = (mode === "quick" || mode === "category") ? Math.min(10, pool.length) : pool.length;
    if (!pool.length) return null;
    const queue = Bank.sample(count, pool);
    this.round = {
      mode, category: category || null,
      queue, idx: 0,
      score: 0, streak: 0, bestStreak: 0,
      correct: 0, answered: 0, wrong: 0,
      fiftyUsed: false, skipUsed: false,
      results: [],           // {q, picked (index|-1), correct: bool, points}
      endsAt: mode === "lightning" ? Date.now() + 60000 : null,
      over: false,
      hiddenOptions: [],     // per-question 50:50 removals
    };
    return this.round;
  },

  currentQ() {
    const r = this.round;
    if (!r || r.over || r.idx >= r.queue.length) return null;
    return r.queue[r.idx];
  },

  /* ---- answering ---- */
  answer(pickedIdx) {
    const r = this.round, q = this.currentQ();
    if (!r || !q || r.over || r.locked) return null;
    r.locked = true;
    this.stopTimer();
    const correct = pickedIdx === q.answer;
    return this.resolveAnswer(q, pickedIdx, correct, false);
  },

  timeout() {
    const r = this.round, q = this.currentQ();
    if (!r || !q || r.over || r.locked) return null;
    r.locked = true;
    return this.resolveAnswer(q, -1, false, true);
  },

  resolveAnswer(q, pickedIdx, correct, timedOut) {
    const r = this.round;
    let points = 0;
    if (correct) {
      r.streak += 1;
      r.bestStreak = Math.max(r.bestStreak, r.streak);
      points = 100 * q.difficulty + 50 * (r.streak - 1);
      r.score += points;
      r.correct += 1;
    } else {
      r.streak = 0;
      r.wrong += 1;
    }
    r.answered += 1;
    r.results.push({ q, picked: pickedIdx, correct, points, timedOut });
    return { correct, points, timedOut, streak: r.streak };
  },

  /* 50:50 — returns the two option indices to hide. Once per round. */
  fiftyFifty() {
    const r = this.round, q = this.currentQ();
    if (!r || !q || r.fiftyUsed || r.locked) return null;
    const wrongs = [0,1,2,3].filter(i => i !== q.answer);
    // shuffle, take 2
    for (let i = wrongs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wrongs[i], wrongs[j]] = [wrongs[j], wrongs[i]];
    }
    r.fiftyUsed = true;
    r.hiddenOptions = wrongs.slice(0, 2);
    return r.hiddenOptions;
  },

  /* Skip — advance with no scoring, streak preserved. Once per round. */
  skip() {
    const r = this.round, q = this.currentQ();
    if (!r || !q || r.skipUsed || r.locked) return null;
    r.skipUsed = true;
    this.stopTimer();
    r.results.push({ q, picked: -2, correct: null, points: 0, skipped: true });
    return this.next();
  },

  /* Advance to next question; returns {done} or {question}. */
  next() {
    const r = this.round;
    if (!r || r.over) return { done: true };
    r.locked = false;
    r.hiddenOptions = [];
    // lightning global timer
    if (r.mode === "lightning" && Date.now() >= r.endsAt) return this.finish();
    // marathon: 3 wrong ends it
    if (r.mode === "marathon" && r.wrong >= 3) return this.finish();
    r.idx += 1;
    if (r.mode === "lightning" || r.mode === "marathon") {
      // endless: reshuffle more questions when queue exhausted
      if (r.idx >= r.queue.length) {
        const pool = r.mode === "marathon" && r.category ? Bank.byCategory[r.category] : Bank.questions;
        const more = Bank.sample(pool.length, pool);
        // avoid immediate repeat of last question
        if (more.length && r.queue.length && more[0].id === r.queue[r.queue.length-1].id && more.length > 1) {
          more.push(more.shift());
        }
        r.queue = r.queue.concat(more);
      }
    }
    if (r.idx >= r.queue.length) return this.finish();
    return { question: r.queue[r.idx], index: r.idx };
  },

  finish() {
    const r = this.round;
    if (!r || r.over) return { done: true, round: r };
    this.stopTimer();
    r.over = true;
    const s = this.state;
    const acc = r.answered ? r.correct / r.answered : 0;

    // bests
    const modeKey = "mode:" + r.mode + (r.mode === "category" ? ":" + r.category : "");
    const prevBest = s.bests[modeKey] || 0;
    const isNewBest = r.score > prevBest;
    if (isNewBest) s.bests[modeKey] = r.score;
    if (r.mode === "category" && r.category) {
      const ck = "cat:" + r.category;
      if (r.score > (s.bests[ck] || 0)) s.bests[ck] = r.score;
    }
    // leaderboard (top 10)
    s.board.push({ score: r.score, mode: r.mode, cat: r.category, date: new Date().toISOString().slice(0,10) });
    s.board.sort((a,b) => b.score - a.score);
    s.board = s.board.slice(0, 10);
    // stats + xp
    s.stats.games += 1;
    s.stats.answered += r.answered;
    s.stats.correct += r.correct;
    s.stats.bestStreak = Math.max(s.stats.bestStreak, r.bestStreak);
    s.xp += r.score;
    this.saveState();
    return { done: true, round: r, isNewBest, accuracy: acc };
  },

  level() { return 1 + Math.floor(this.state.xp / 1000); },
  xpProgress() { return (this.state.xp % 1000) / 1000; },

  /* ---- per-question timer ---- */
  startTimer(onTick, onExpire) {
    this.stopTimer();
    this.timeLeft = this.state.qtime;
    onTick(this.timeLeft);
    this.timerId = setInterval(() => {
      // lightning global timeout
      const r = this.round;
      if (r && r.mode === "lightning" && Date.now() >= r.endsAt) {
        this.stopTimer();
        onExpire("global");
        return;
      }
      this.timeLeft -= 1;
      onTick(this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        onExpire("question");
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
  },

  /* ---- tiny sound effects (WebAudio, no assets) ---- */
  beep(kind) {
    if (!this.state.sound) return;
    try {
      const ctx = this._ctx || (this._ctx = new (window.AudioContext || window.webkitAudioContext)());
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = kind === "good" ? 660 : kind === "bad" ? 180 : 440;
      o.type = "sine";
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  },
};
