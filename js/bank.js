/* BD Quiz Arena — question bank loader + schema validation.
   Bad entries are dropped with a console warning, never crash the app. */
const BANK_FILES = [
  "questions/cat_liberation.json",
  "questions/cat_language.json",
  "questions/cat_geography.json",
  "questions/cat_culture.json",
  "questions/cat_civics.json",
  "questions/cat_sports.json",
  "questions/cat_economy.json",
  "questions/cat_notable.json",
];

const Bank = {
  questions: [],      // all valid questions
  byCategory: {},     // slug -> [questions]
  dropped: 0,

  async load() {
    this.questions = [];
    this.byCategory = {};
    this.dropped = 0;
    const seenIds = new Set();
    const seenText = new Set();

    for (const file of BANK_FILES) {
      let data;
      try {
        const res = await fetch(file);
        if (!res.ok) throw new Error("HTTP " + res.status);
        data = await res.json();
      } catch (e) {
        console.warn("[bank] failed to load " + file + ": " + e.message);
        continue;
      }
      const slug = data.category;
      if (!CAT_ORDER.includes(slug)) {
        console.warn("[bank] unknown category slug in " + file + ": " + slug);
        continue;
      }
      if (!Array.isArray(data.questions)) {
        console.warn("[bank] no questions array in " + file);
        continue;
      }
      if (!this.byCategory[slug]) this.byCategory[slug] = [];

      for (const q of data.questions) {
        const err = this.validate(q);
        if (err) { this.dropped++; console.warn("[bank] dropped question: " + err); continue; }
        if (seenIds.has(q.id)) { this.dropped++; console.warn("[bank] dropped duplicate id: " + q.id); continue; }
        const tkey = q.q.en.trim().toLowerCase();
        if (seenText.has(tkey)) { this.dropped++; console.warn("[bank] dropped duplicate text: " + q.q.en.slice(0,60)); continue; }
        if (q.category && q.category !== slug) { this.dropped++; console.warn("[bank] dropped mismatched category: " + q.id); continue; }
        q.category = slug;
        seenIds.add(q.id);
        seenText.add(tkey);
        this.questions.push(q);
        this.byCategory[slug].push(q);
      }
    }
    return this.questions.length;
  },

  /* Returns null if valid, else a reason string. */
  validate(q) {
    if (!q || typeof q !== "object") return "not an object";
    if (typeof q.id !== "string" || !q.id.trim()) return "missing id";
    if (![1,2,3].includes(q.difficulty)) return "bad difficulty: " + q.id;
    for (const L of ["en","bn"]) {
      if (!q.q || typeof q.q[L] !== "string" || !q.q[L].trim()) return "missing q." + L + ": " + q.id;
      if (!q.explain || typeof q.explain[L] !== "string" || !q.explain[L].trim()) return "missing explain." + L + ": " + q.id;
      if (!q.options || !Array.isArray(q.options[L]) || q.options[L].length !== 4) return "options." + L + " not 4: " + q.id;
      for (const o of q.options[L]) {
        if (typeof o !== "string" || !o.trim()) return "empty option in " + L + ": " + q.id;
      }
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) return "answer out of range: " + q.id;
    return null;
  },

  countByCategory() {
    const out = {};
    for (const slug of CAT_ORDER) out[slug] = (this.byCategory[slug] || []).length;
    return out;
  },

  sample(n, pool) {
    const arr = (pool || this.questions).slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
  },
};
