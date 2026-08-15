/* Rising Star — career state, persistence, progression math */
(function (RS) {
  'use strict';

  var D = RS.Data;
  var SAVE_KEY = 'risingstar.career.v1';

  /* ---------- utility ---------- */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function rint(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
  function round1(v) { return Math.round(v * 10) / 10; }

  function fmtMoney(n) {
    n = Math.round(n);
    var s = n < 0 ? '-' : '';
    n = Math.abs(n);
    if (n >= 1000000) return s + '£' + (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + 'M';
    if (n >= 10000) return s + '£' + Math.round(n / 1000) + 'K';
    return s + '£' + n.toLocaleString('en-GB');
  }

  /* ---------- squads ---------- */

  var SQUAD_SHAPE = ['GK', 'DF', 'DF', 'DF', 'DF', 'CM', 'CM', 'AM', 'W', 'W', 'ST', 'ST',
    'GK', 'DF', 'CM', 'W', 'ST', 'AM'];

  function makeSquad(clubId, season) {
    var club = D.CLUBS[clubId];
    var rng = mulberry32(clubId * 7919 + season * 104729 + 13);
    var out = [];
    for (var i = 0; i < SQUAD_SHAPE.length; i++) {
      var spread = i < 11 ? rint(rng, -4, 6) : rint(rng, -12, 0);
      var rating = clamp(Math.round(club.str * 0.9 + 8 + spread), 12, 96);
      out.push({
        name: pick(rng, D.FIRST_NAMES) + ' ' + pick(rng, D.LAST_NAMES),
        pos: SQUAD_SHAPE[i],
        rating: rating,
        age: rint(rng, 18, 34),
        nation: pick(rng, D.NATIONS),
        goals: 0,
        friend: 50
      });
    }
    out.sort(function (a, b) { return b.rating - a.rating; });
    return out;
  }

  function makeManager(clubId, season) {
    var rng = mulberry32(clubId * 31337 + season * 977 + 5);
    var styles = ['old school', 'a players\' manager', 'a tactician', 'ruthless', 'a youth believer'];
    return {
      name: pick(rng, D.FIRST_NAMES) + ' ' + pick(rng, D.LAST_NAMES),
      style: pick(rng, styles),
      patience: rint(rng, 35, 80)
    };
  }

  /* ---------- career creation ---------- */

  function baseAttrs(posKey, traitKey, rng) {
    var attrs = {};
    D.ATTRS.forEach(function (a) { attrs[a.key] = rint(rng, 26, 34); });
    var pos = D.POSITIONS.filter(function (p) { return p.key === posKey; })[0];
    var trait = D.TRAITS.filter(function (t) { return t.key === traitKey; })[0];
    [pos.bias, trait.bias].forEach(function (b) {
      Object.keys(b).forEach(function (k) { attrs[k] = clamp(attrs[k] + b[k], 12, 70); });
    });
    return attrs;
  }

  var POS_WEIGHTS = {
    ST: { shooting: 3, technique: 2, pace: 2, strength: 1.5, dribbling: 1.5, composure: 1.5, passing: 1, stamina: 1, setPieces: 0.6, defending: 0.2 },
    W: { pace: 3, dribbling: 3, technique: 2, passing: 1.5, shooting: 1.5, stamina: 1.5, composure: 1, strength: 0.6, setPieces: 0.6, defending: 0.4 },
    AM: { passing: 3, technique: 3, dribbling: 2, composure: 2, shooting: 1.5, setPieces: 1.5, pace: 1, stamina: 1, strength: 0.6, defending: 0.5 },
    CM: { passing: 2.5, stamina: 2.5, defending: 2, strength: 2, technique: 1.5, composure: 1.5, dribbling: 1, shooting: 1, pace: 1, setPieces: 0.8 }
  };

  function overall(career) {
    var w = POS_WEIGHTS[career.pos];
    var sum = 0, tot = 0;
    Object.keys(w).forEach(function (k) {
      sum += career.attrs[k] * w[k];
      tot += w[k];
    });
    return Math.round(sum / tot);
  }

  function marketValue(career) {
    var ov = overall(career);
    var ageF = career.age <= 21 ? 1.5 : career.age <= 25 ? 1.3 : career.age <= 29 ? 1.0 : career.age <= 32 ? 0.55 : 0.25;
    var repF = 0.7 + career.reputation / 120;
    return Math.round(Math.pow(Math.max(1, ov - 22), 2.7) * 3.2 * ageF * repF);
  }

  function wageFor(career, clubId) {
    var club = D.CLUBS[clubId];
    var lg = D.LEAGUES[club.tier - 1];
    var ov = overall(career);
    var quality = Math.pow(clamp(ov / 55, 0.35, 2.6), 2.1);
    var rep = 0.75 + career.reputation / 130;
    var w = lg.wageBase * quality * rep * (0.85 + club.str / 260);
    if (career.perks.agent) w *= 1.18;
    return Math.max(180, Math.round(w / 10) * 10);
  }

  function newCareer(opts) {
    var rng = mulberry32(Date.now() & 0xffffffff);
    var career = {
      v: 1,
      first: opts.first,
      last: opts.last,
      name: opts.first + ' ' + opts.last,
      nation: opts.nation,
      pos: opts.pos,
      trait: opts.trait,
      kitNumber: opts.kitNumber || 10,
      age: 17,
      season: 1,
      seasonYear: 2026,
      week: 1,
      slots: 3,
      clubId: opts.clubId,
      attrs: baseAttrs(opts.pos, opts.trait, rng),
      xp: {},
      energy: 100,
      sharpness: 60,
      reputation: 6,
      money: 900,
      contract: {
        wage: 0,
        seasonsLeft: 2,
        goalBonus: 60,
        winBonus: 40,
        role: 'Prospect'
      },
      rel: { boss: 52, team: 50, fans: 45, sponsors: 20, partner: 60 },
      perks: {},
      owned: [],
      sponsorDeal: null,
      injuredWeeks: 0,
      selection: 'sub',
      form: [],
      stats: blankStats(),
      career: blankStats(),
      history: [],
      trophies: [],
      news: [],
      squad: [],
      manager: null,
      world: null,
      lastMatch: null,
      pendingOffers: null,
      tutorialSeen: false,
      retired: false
    };
    D.ATTRS.forEach(function (a) { career.xp[a.key] = 0; });
    career.contract.wage = Math.round(wageFor(career, opts.clubId) * 0.8);
    career.squad = makeSquad(opts.clubId, 1);
    career.manager = makeManager(opts.clubId, 1);
    return career;
  }

  function blankStats() {
    return { apps: 0, subApps: 0, goals: 0, assists: 0, motm: 0, ratingSum: 0, ratingN: 0, wins: 0, draws: 0, losses: 0, shots: 0, onTarget: 0, seasons: 0 };
  }

  /* ---------- progression ---------- */

  function ageFactor(age) {
    if (age <= 20) return 1.45;
    if (age <= 23) return 1.25;
    if (age <= 26) return 1.0;
    if (age <= 29) return 0.72;
    if (age <= 32) return 0.45;
    return 0.25;
  }

  function xpNeeded(value) {
    return Math.round(20 + Math.pow(value, 1.35) * 1.1);
  }

  // Returns array of attribute keys that levelled up
  function addXp(career, key, amount) {
    if (!career.attrs[key]) return [];
    var mult = ageFactor(career.age);
    if (career.perks.coach) mult *= 1.35;
    var gained = [];
    career.xp[key] = (career.xp[key] || 0) + amount * mult;
    var guard = 0;
    while (career.xp[key] >= xpNeeded(career.attrs[key]) && career.attrs[key] < 99 && guard++ < 6) {
      career.xp[key] -= xpNeeded(career.attrs[key]);
      career.attrs[key]++;
      gained.push(key);
    }
    return gained;
  }

  function changeRel(career, key, delta) {
    career.rel[key] = clamp(Math.round((career.rel[key] + delta) * 10) / 10, 0, 100);
  }

  function changeEnergy(career, delta) {
    var cap = 100;
    career.energy = clamp(Math.round(career.energy + delta), 0, cap);
  }

  function addMoney(career, amount) {
    career.money = Math.max(0, Math.round(career.money + amount));
  }

  function avgRating(stats) {
    if (!stats.ratingN) return 0;
    return round1(stats.ratingSum / stats.ratingN);
  }

  function pushNews(career, text, kind) {
    career.news.unshift({ text: text, kind: kind || 'info', week: career.week, season: career.season, read: false });
    if (career.news.length > 60) career.news.length = 60;
  }

  /* ---------- persistence ---------- */

  var memoryStore = null;

  function save() {
    if (!RS.career) return;
    var json;
    try { json = JSON.stringify(RS.career); } catch (e) { return; }
    memoryStore = json;
    try { window.localStorage.setItem(SAVE_KEY, json); } catch (e) { /* private mode: memory only */ }
  }

  function loadRaw() {
    try {
      var s = window.localStorage.getItem(SAVE_KEY);
      if (s) return s;
    } catch (e) { /* ignore */ }
    return memoryStore;
  }

  function hasSave() { return !!loadRaw(); }

  function load() {
    var raw = loadRaw();
    if (!raw) return null;
    try {
      var c = JSON.parse(raw);
      if (!c || c.v !== 1) return null;
      RS.career = c;
      return c;
    } catch (e) { return null; }
  }

  function wipe() {
    memoryStore = null;
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  RS.State = {
    mulberry32: mulberry32,
    clamp: clamp,
    rint: rint,
    pick: pick,
    round1: round1,
    fmtMoney: fmtMoney,
    makeSquad: makeSquad,
    makeManager: makeManager,
    newCareer: newCareer,
    blankStats: blankStats,
    overall: overall,
    marketValue: marketValue,
    wageFor: wageFor,
    addXp: addXp,
    xpNeeded: xpNeeded,
    ageFactor: ageFactor,
    changeRel: changeRel,
    changeEnergy: changeEnergy,
    addMoney: addMoney,
    avgRating: avgRating,
    pushNews: pushNews,
    save: save,
    load: load,
    hasSave: hasSave,
    wipe: wipe,
    POS_WEIGHTS: POS_WEIGHTS
  };
})(window.RS = window.RS || {});
