/* BD Quiz Arena — UI wiring. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const S = () => STRINGS[Game.state.lang];
  const L = () => Game.state.lang;

  function t(key) { return S()[key] || key; }

  function applyI18n() {
    document.documentElement.lang = L() === "bn" ? "bn" : "en";
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    $("btnLang").textContent = L() === "en" ? "বাং" : "EN";
    renderHomeBests();
    renderCategoryGrid();
    updateXpBadge();
  }

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $("screen-" + name).classList.add("active");
    window.scrollTo(0, 0);
  }

  function updateXpBadge() {
    $("xpLevel").textContent = Game.level();
    $("xpFill").style.width = Math.round(Game.xpProgress() * 100) + "%";
  }

  function catName(slug) {
    const m = CAT_META[slug] || {};
    return (L() === "bn" ? m.bn : m.en) || slug;
  }

  /* ---------- home ---------- */
  function renderCategoryGrid() {
    const grid = $("categoryGrid");
    grid.innerHTML = "";
    const counts = Bank.countByCategory();
    for (const slug of CAT_ORDER) {
      const b = document.createElement("button");
      b.className = "cat-card";
      b.dataset.cat = slug;
      const best = Game.state.bests["cat:" + slug];
      b.innerHTML =
        '<span class="cat-icon">' + CAT_META[slug].icon + "</span>" +
        '<span class="cat-name">' + esc(catName(slug)) + "</span>" +
        '<span class="cat-count">' + (counts[slug] || 0) + " Q</span>" +
        (best ? '<span class="cat-best">★ ' + best + "</span>" : "");
      b.addEventListener("click", () => startGame("category", slug));
      grid.appendChild(b);
    }
  }

  function renderHomeBests() {
    const box = $("homeBests");
    const keys = [
      ["mode:quick", t("modeQuick")],
      ["mode:lightning", t("modeLightning")],
      ["mode:marathon", t("modeMarathon")],
    ];
    const rows = keys
      .filter(([k]) => Game.state.bests[k])
      .map(([k, name]) => '<div class="best-row"><span>' + esc(name) + "</span><b>" + Game.state.bests[k] + "</b></div>");
    box.innerHTML = rows.length ? rows.join("") : '<p class="empty">' + esc(t("noScoresYet")) + "</p>";
  }

  /* ---------- game ---------- */
  let lightningInt = null;

  function startGame(mode, category) {
    const r = Game.newGame(mode, category);
    if (!r) return;
    $("categoryPicker").classList.add("hidden");
    showScreen("game");
    renderQuestion();
  }

  function hudText() {
    const r = Game.round;
    const modeNames = { quick: t("modeQuick"), category: t("modeCategory"), lightning: t("modeLightning"), marathon: t("modeMarathon") };
    $("hudMode").textContent = modeNames[r.mode] + (r.mode === "category" ? " · " + catName(r.category) : "");
    if (r.mode === "lightning") {
      $("hudProgress").textContent = "⏱ " + Math.max(0, Math.ceil((r.endsAt - Date.now()) / 1000)) + "s";
    } else if (r.mode === "marathon") {
      $("hudProgress").textContent = "❤️".repeat(Math.max(0, 3 - r.wrong)) + "🖤".repeat(r.wrong);
    } else {
      $("hudProgress").textContent = Math.min(r.idx + 1, r.queue.length) + " / " + r.queue.length;
    }
    $("scoreN").textContent = r.score;
    if (r.streak >= 2) {
      $("hudStreak").classList.remove("hidden");
      $("streakN").textContent = r.streak;
    } else {
      $("hudStreak").classList.add("hidden");
    }
  }

  function renderQuestion() {
    const r = Game.round, q = Game.currentQ();
    if (!q) { showResults(); return; }
    hudText();
    $("qCat").textContent = CAT_META[q.category].icon + " " + catName(q.category);
    $("qDiff").innerHTML = "★".repeat(q.difficulty) + '<span class="dim">' + "★".repeat(3 - q.difficulty) + "</span>";
    $("qText").textContent = q.q[L()];
    const grid = $("optGrid");
    grid.innerHTML = "";
    q.options[L()].forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "opt-btn";
      b.dataset.i = i;
      b.innerHTML = '<span class="opt-key">' + "ABCD"[i] + "</span><span>" + esc(opt) + "</span>";
      b.addEventListener("click", () => pick(i));
      grid.appendChild(b);
    });
    // lifeline states
    $("btnFifty").disabled = r.fiftyUsed;
    $("btnSkip").disabled = r.skipUsed;
    $("feedback").classList.add("hidden");
    // per-question timer
    const total = Game.state.qtime;
    const tick = (left) => {
      $("timerFill").style.width = Math.max(0, (left / total) * 100) + "%";
      $("timerFill").classList.toggle("danger", left <= 5);
      if (r.mode === "lightning") hudText();
    };
    Game.startTimer(tick, (kind) => {
      if (kind === "global") { showResults(); return; }
      resolve(Game.timeout());
    });
    if (lightningInt) clearInterval(lightningInt);
    if (r.mode === "lightning") lightningInt = setInterval(() => { if (!Game.round || Game.round.over) clearInterval(lightningInt); else hudText(); }, 1000);
  }

  function pick(i) {
    const res = Game.answer(i);
    if (res) resolve(res);
  }

  function resolve(res) {
    const r = Game.round, q = r.queue[r.idx];
    Game.beep(res.correct ? "good" : "bad");
    // mark options
    document.querySelectorAll("#optGrid .opt-btn").forEach(b => {
      const i = +b.dataset.i;
      b.disabled = true;
      if (i === q.answer) b.classList.add("right");
      else if (res.picked === i) b.classList.add("wrong");
    });
    const fb = $("feedback");
    fb.classList.remove("hidden");
    $("fbTitle").textContent = res.correct ? "✅ " + t("correct") : (res.timedOut ? "⏰ " + t("timeUp") : "❌ " + t("wrong"));
    $("fbTitle").className = "fb-title " + (res.correct ? "good" : "bad");
    $("fbPoints").textContent = res.correct ? "+" + res.points + " " + t("points") + (r.streak >= 2 ? " · 🔥×" + r.streak : "") : t("correctAnsWas") + ": " + q.options[L()][q.answer];
    $("fbExplain").textContent = q.explain[L()];
    $("btnNext").textContent = t("next");
    hudText();
    if (lightningInt) { clearInterval(lightningInt); lightningInt = null; }
  }

  /* ---------- results ---------- */
  function showResults() {
    const fin = Game.finish();
    const r = fin.round;
    if (lightningInt) { clearInterval(lightningInt); lightningInt = null; }
    showScreen("results");
    $("resScore").textContent = r.score;
    $("resCorrect").textContent = r.correct + "/" + r.answered;
    $("resAcc").textContent = r.answered ? Math.round((r.correct / r.answered) * 100) + "%" : "—";
    $("resStreak").textContent = r.bestStreak;
    $("resXP").textContent = "+" + r.score;
    $("resNewBest").classList.toggle("hidden", !fin.isNewBest);
    $("resEmoji").textContent = r.score >= 1500 ? "🏆" : r.score >= 800 ? "🥈" : r.score >= 300 ? "🥉" : "🎮";
    updateXpBadge();
    // review
    renderReview(r);
    renderHomeBests();
  }

  function renderReview(r) {
    const list = $("reviewList");
    list.innerHTML = "";
    r.results.forEach((res, n) => {
      const q = res.q;
      const div = document.createElement("div");
      div.className = "review-item " + (res.correct === true ? "ok" : res.correct === false ? "bad" : "skip");
      let detail;
      if (res.skipped) detail = "<em>" + esc(t("skip")) + "</em>";
      else {
        const you = res.picked >= 0 ? q.options[L()][res.picked] : t("noAnswer");
        detail = "<div>" + esc(t("yourAnswer")) + ": <b>" + esc(you) + "</b></div>" +
                 "<div>" + esc(t("correctAnsWas")) + ": <b>" + esc(q.options[L()][q.answer]) + "</b></div>";
      }
      div.innerHTML = "<div class='rev-q'>" + (n + 1) + ". " + esc(q.q[L()]) + "</div>" + detail +
        "<div class='rev-ex'>" + esc(q.explain[L()]) + "</div>";
      list.appendChild(div);
    });
  }

  /* Re-render dynamic game text after a language toggle, preserving timer & state. */
  function refreshGameLang() {
    const r = Game.round;
    if (!r || r.over || !$("screen-game").classList.contains("active")) return;
    const q = r.queue[r.idx];
    if (!q) return;
    $("qCat").textContent = CAT_META[q.category].icon + " " + catName(q.category);
    $("qText").textContent = q.q[L()];
    document.querySelectorAll("#optGrid .opt-btn").forEach(b => {
      const i = +b.dataset.i;
      const label = b.querySelector("span:last-child");
      if (label) label.textContent = q.options[L()][i];
    });
    if (!$("feedback").classList.contains("hidden")) {
      const res = r.results[r.results.length - 1];
      if (res) {
        $("fbTitle").textContent = res.correct ? "✅ " + t("correct") : (res.timedOut ? "⏰ " + t("timeUp") : "❌ " + t("wrong"));
        $("fbPoints").textContent = res.correct
          ? "+" + res.points + " " + t("points") + (r.streak >= 2 ? " · 🔥×" + r.streak : "")
          : t("correctAnsWas") + ": " + q.options[L()][q.answer];
        $("fbExplain").textContent = q.explain[L()];
        $("btnNext").textContent = t("next");
      }
    }
    hudText();
  }

  /* ---------- stats ---------- */
  function renderStats() {
    const s = Game.state;
    const acc = s.stats.answered ? Math.round(s.stats.correct / s.stats.answered * 100) + "%" : "—";
    $("statsGrid").innerHTML =
      stat(t("gamesPlayed"), s.stats.games) + stat(t("totalAnswered"), s.stats.answered) +
      stat(t("accuracy"), acc) + stat(t("bestStreak"), s.stats.bestStreak) +
      stat(t("xp"), s.stats.xp || s.xp) + stat(t("level"), Game.level());
    const modeRows = Object.keys(s.bests).filter(k => k.startsWith("mode:"))
      .map(k => '<div class="best-row"><span>' + esc(k.replace("mode:", "")) + "</span><b>" + s.bests[k] + "</b></div>");
    $("statsModes").innerHTML = modeRows.join("") || '<p class="empty">' + esc(t("noScoresYet")) + "</p>";
    const catRows = CAT_ORDER.filter(slug => s.bests["cat:" + slug])
      .map(slug => '<div class="best-row"><span>' + esc(catName(slug)) + "</span><b>" + s.bests["cat:" + slug] + "</b></div>");
    $("statsCats").innerHTML = catRows.join("") || '<p class="empty">' + esc(t("noScoresYet")) + "</p>";
    const board = s.board.map((e, i) =>
      '<div class="best-row"><span>#' + (i + 1) + " · " + esc(e.mode) + (e.cat ? " · " + esc(catName(e.cat)) : "") + " · " + esc(e.date) + "</span><b>" + e.score + "</b></div>");
    $("statsBoard").innerHTML = board.join("") || '<p class="empty">' + esc(t("noScoresYet")) + "</p>";
  }
  function stat(label, val) { return '<div><b>' + val + "</b><span>" + esc(label) + "</span></div>"; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  /* ---------- events ---------- */
  function bind() {
    document.querySelectorAll(".mode-card").forEach(b => {
      b.addEventListener("click", () => {
        if (b.dataset.mode === "category") {
          $("categoryPicker").classList.toggle("hidden");
          renderCategoryGrid();
        } else {
          startGame(b.dataset.mode);
        }
      });
    });
    $("btnLang").addEventListener("click", () => {
      Game.state.lang = L() === "en" ? "bn" : "en";
      Game.saveState();
      applyI18n();
      refreshGameLang();
      if ($("screen-results").classList.contains("active") && Game.round) renderReview(Game.round);
      if ($("screen-stats").classList.contains("active")) renderStats();
    });
    $("btnStats").addEventListener("click", () => { renderStats(); showScreen("stats"); });
    $("btnStatsBack").addEventListener("click", () => showScreen("home"));
    $("timerSeg").querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        $("timerSeg").querySelectorAll("button").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        Game.state.qtime = +b.dataset.t;
        Game.saveState();
      });
    });
    $("soundSeg").querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        $("soundSeg").querySelectorAll("button").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        Game.state.sound = b.dataset.s === "on";
        Game.saveState();
      });
    });
    $("btnFifty").addEventListener("click", () => {
      const hidden = Game.fiftyFifty();
      if (!hidden) return;
      Game.beep("mid");
      hidden.forEach(i => {
        const b = document.querySelector('#optGrid .opt-btn[data-i="' + i + '"]');
        if (b) { b.classList.add("hidden-opt"); b.disabled = true; }
      });
      $("btnFifty").disabled = true;
    });
    $("btnSkip").addEventListener("click", () => {
      const nx = Game.skip();
      if (nx) { Game.beep("mid"); renderQuestion(); }
    });
    $("btnNext").addEventListener("click", () => {
      const nx = Game.next();
      if (nx.done) showResults(); else renderQuestion();
    });
    $("btnAgain").addEventListener("click", () => {
      const r = Game.round;
      startGame(r.mode, r.category);
    });
    $("btnHome").addEventListener("click", () => { showScreen("home"); renderHomeBests(); });
  }

  /* ---------- boot ---------- */
  async function boot() {
    Game.state = Game.loadState();
    // restore settings UI
    document.querySelectorAll("#timerSeg button").forEach(b =>
      b.classList.toggle("on", +b.dataset.t === Game.state.qtime));
    document.querySelectorAll("#soundSeg button").forEach(b =>
      b.classList.toggle("on", (b.dataset.s === "on") === Game.state.sound));
    bind();
    applyI18n();
    const n = await Bank.load();
    if (!n) {
      document.querySelector(".hero .sub").textContent = t("bankError");
    }
    renderCategoryGrid();
    renderHomeBests();
    updateXpBadge();
    window.__arena = { Bank, Game, startGame, renderQuestion, showResults, CAT_ORDER, CAT_META };
    window.__arenaReady = true;
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
