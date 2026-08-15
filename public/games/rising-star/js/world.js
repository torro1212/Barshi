/* Rising Star — leagues, fixtures, cup, week & season progression */
(function (RS) {
  'use strict';

  var D = RS.Data;
  var S = RS.State;

  var SEASON_WEEKS = 27;
  var CUP_WEEKS = [4, 9, 15, 21, 25];
  var CUP_NAMES = ['Cup First Round', 'Cup Second Round', 'Cup Quarter-Final', 'Cup Semi-Final', 'Cup Final'];

  /* ---------- helpers ---------- */

  function rngFor(seed) { return S.mulberry32(seed | 0); }

  function roundRobin(ids) {
    // circle method; returns array of rounds, each round an array of [home, away]
    var list = ids.slice();
    var n = list.length;
    var rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var pairs = [];
      for (var i = 0; i < n / 2; i++) {
        var a = list[i], b = list[n - 1 - i];
        if (r % 2 === 0) pairs.push([a, b]); else pairs.push([b, a]);
      }
      rounds.push(pairs);
      list.splice(1, 0, list.pop());
    }
    // second half: reversed venues
    var second = rounds.map(function (rd) {
      return rd.map(function (p) { return [p[1], p[0]]; });
    });
    return rounds.concat(second);
  }

  function shuffled(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function blankRow() { return { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }

  /* ---------- world building ---------- */

  function buildWorld(career, keepStr) {
    var rng = rngFor(career.season * 7717 + 991);
    var world = {
      season: career.season,
      divisions: [],
      strAdj: keepStr || {},
      cup: { roundIdx: 0, alive: true, out: false, winner: null, opponent: null },
      calendar: [],
      playerClubGoals: 0
    };
    for (var t = 1; t <= 4; t++) {
      var ids;
      if (career.world && career.world.divisions) {
        ids = career.world.divisions[t - 1].clubIds.slice();
      } else {
        ids = D.clubsInTier(t).map(function (c) { return c.id; });
      }
      var fixtures = roundRobin(shuffled(ids, rngFor(career.season * 31 + t)));
      var table = {};
      ids.forEach(function (id) { table[id] = blankRow(); });
      world.divisions.push({
        tier: t,
        clubIds: ids,
        table: table,
        fixtures: fixtures.map(function (rd) {
          return rd.map(function (p) { return { h: p[0], a: p[1], hg: null, ag: null }; });
        }),
        scorers: ids.map(function (id) {
          var sq = S.makeSquad(id, career.season);
          var st = sq.filter(function (p) { return p.pos === 'ST'; })[0] || sq[0];
          return { name: st.name, clubId: id, goals: 0 };
        })
      });
    }
    // calendar
    var leagueRound = 0;
    for (var w = 1; w <= SEASON_WEEKS; w++) {
      var ci = CUP_WEEKS.indexOf(w);
      if (ci >= 0) {
        world.calendar.push({ type: 'cup', cupRound: ci });
      } else {
        world.calendar.push({ type: 'league', round: leagueRound++ });
      }
    }
    return world;
  }

  function tierOf(world, clubId) {
    for (var i = 0; i < world.divisions.length; i++) {
      if (world.divisions[i].clubIds.indexOf(clubId) >= 0) return i + 1;
    }
    return D.CLUBS[clubId].tier;
  }

  function clubStrength(world, clubId) {
    var base = D.CLUBS[clubId].str;
    var adj = (world.strAdj && world.strAdj[clubId]) || 0;
    return S.clamp(base + adj, 12, 99);
  }

  /* ---------- match simulation (non-player) ---------- */

  function sampleGoals(lambda, rng) {
    var L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L && k < 12);
    return k - 1;
  }

  function simScore(world, homeId, awayId, rng) {
    var sh = clubStrength(world, homeId) + 5;
    var sa = clubStrength(world, awayId);
    var total = sh + sa;
    var lh = 0.55 + 2.3 * (sh / total);
    var la = 0.45 + 2.1 * (sa / total);
    return [sampleGoals(lh, rng), sampleGoals(la, rng)];
  }

  function applyToTable(div, fx) {
    var th = div.table[fx.h], ta = div.table[fx.a];
    if (!th || !ta) return;
    th.p++; ta.p++;
    th.gf += fx.hg; th.ga += fx.ag;
    ta.gf += fx.ag; ta.ga += fx.hg;
    if (fx.hg > fx.ag) { th.w++; th.pts += 3; ta.l++; }
    else if (fx.hg < fx.ag) { ta.w++; ta.pts += 3; th.l++; }
    else { th.d++; ta.d++; th.pts++; ta.pts++; }
  }

  function creditScorers(div, clubId, goals, rng, excludeClub) {
    if (goals <= 0) return;
    var entry = div.scorers.filter(function (s) { return s.clubId === clubId; })[0];
    if (!entry) return;
    for (var i = 0; i < goals; i++) {
      if (rng() < 0.42) entry.goals++;
    }
    if (excludeClub) { /* player's own club handled elsewhere */ }
  }

  function simLeagueRound(career, roundIdx) {
    var world = career.world;
    var rng = rngFor(career.season * 9001 + roundIdx * 131 + career.week * 7);
    world.divisions.forEach(function (div) {
      var round = div.fixtures[roundIdx];
      if (!round) return;
      round.forEach(function (fx) {
        if (fx.hg != null) return;
        if (fx.h === career.clubId || fx.a === career.clubId) return; // resolved by player's match
        var sc = simScore(world, fx.h, fx.a, rng);
        fx.hg = sc[0]; fx.ag = sc[1];
        applyToTable(div, fx);
        creditScorers(div, fx.h, sc[0], rng);
        creditScorers(div, fx.a, sc[1], rng);
      });
    });
  }

  function standings(world, tierIdx) {
    var div = world.divisions[tierIdx];
    var rows = div.clubIds.map(function (id) {
      var r = div.table[id];
      return {
        clubId: id, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga,
        gd: r.gf - r.ga, pts: r.pts
      };
    });
    rows.sort(function (a, b) {
      return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
        D.CLUBS[a.clubId].name.localeCompare(D.CLUBS[b.clubId].name);
    });
    return rows;
  }

  function leaguePosition(world, clubId) {
    var t = tierOf(world, clubId) - 1;
    var rows = standings(world, t);
    for (var i = 0; i < rows.length; i++) if (rows[i].clubId === clubId) return i + 1;
    return 0;
  }

  /* ---------- fixtures for the player ---------- */

  function cupOpponent(career, roundIdx) {
    var rng = rngFor(career.season * 4441 + roundIdx * 733 + career.clubId);
    var myTier = tierOf(career.world, career.clubId);
    var pool = [];
    D.CLUBS.forEach(function (c) {
      var t = tierOf(career.world, c.id);
      if (c.id === career.clubId) return;
      var weight = 1;
      // later rounds favour stronger clubs
      var pull = roundIdx - 1;
      weight = 1 / (1 + Math.abs(t - S.clamp(myTier - pull, 1, 4)));
      for (var i = 0; i < Math.round(weight * 6); i++) pool.push(c.id);
    });
    return pool.length ? pool[Math.floor(rng() * pool.length)] : (career.clubId + 1) % 48;
  }

  function fixtureForWeek(career, week) {
    var world = career.world;
    var cal = world.calendar[week - 1];
    if (!cal) return null;
    if (cal.type === 'league') {
      var t = tierOf(world, career.clubId) - 1;
      var div = world.divisions[t];
      var round = div.fixtures[cal.round];
      if (!round) return null;
      for (var i = 0; i < round.length; i++) {
        var fx = round[i];
        if (fx.h === career.clubId || fx.a === career.clubId) {
          return {
            type: 'league',
            comp: D.LEAGUES[t].name,
            round: cal.round,
            home: fx.h, away: fx.a,
            isHome: fx.h === career.clubId,
            opponent: fx.h === career.clubId ? fx.a : fx.h,
            played: fx.hg != null
          };
        }
      }
      return null;
    }
    // cup
    if (world.cup.out) return { type: 'free', comp: 'No fixture' };
    var opp = cupOpponent(career, cal.cupRound);
    var homeRng = rngFor(career.season * 17 + cal.cupRound * 53 + career.clubId);
    var isHome = cal.cupRound === 4 ? true : homeRng() < 0.5;
    return {
      type: 'cup',
      comp: CUP_NAMES[cal.cupRound],
      cupRound: cal.cupRound,
      home: isHome ? career.clubId : opp,
      away: isHome ? opp : career.clubId,
      isHome: isHome,
      opponent: opp,
      neutral: cal.cupRound === 4,
      played: false
    };
  }

  /* ---------- selection ---------- */

  function rivalRating(career) {
    var same = career.squad.filter(function (p) { return p.pos === career.pos; });
    if (!same.length) return clubStrength(career.world, career.clubId) * 0.9;
    return same[0].rating;
  }

  function formAvg(career) {
    if (!career.form.length) return 6.4;
    var last = career.form.slice(-4);
    var s = 0;
    last.forEach(function (f) { s += f; });
    return s / last.length;
  }

  function decideSelection(career) {
    if (career.injuredWeeks > 0) return 'injured';
    var ov = S.overall(career);
    var rival = rivalRating(career);
    var score = ov + (career.rel.boss - 50) * 0.32 + (formAvg(career) - 6.4) * 4.5;
    if (career.energy < 35) score -= 9;
    if (career.contract.role === 'Star Player') score += 6;
    if (career.contract.role === 'Key Player') score += 3;
    var diff = score - rival;
    if (diff >= -1.5) return 'start';
    if (diff >= -9) return 'sub';
    return 'out';
  }

  /* ---------- weekly progression ---------- */

  function weeklyIncome(career) {
    var income = career.contract.wage;
    var notes = [];
    notes.push(['Wages', career.contract.wage]);
    if (career.sponsorDeal) {
      var s = Math.round(career.sponsorDeal.weekly * (0.7 + career.rel.fans / 150));
      income += s;
      notes.push([career.sponsorDeal.name, s]);
    }
    var upkeep = 0;
    if (career.owned.indexOf('car') >= 0) upkeep += 60;
    if (career.owned.indexOf('house') >= 0) upkeep += 220;
    if (upkeep) { income -= upkeep; notes.push(['Upkeep', -upkeep]); }
    return { total: income, notes: notes };
  }

  function endOfWeek(career) {
    // money
    var inc = weeklyIncome(career);
    S.addMoney(career, inc.total);

    // energy recovery
    var rec = 16;
    if (career.perks.nutritionist) rec += 6;
    if (career.perks.house) rec += 10;
    if (career.rel.partner > 70) rec += 5;
    if (career.rel.partner < 30) rec -= 6;
    S.changeEnergy(career, rec);

    // relationship drift
    S.changeRel(career, 'fans', -1.2);
    S.changeRel(career, 'team', -0.8);
    S.changeRel(career, 'partner', -2.4);
    S.changeRel(career, 'sponsors', -0.6);

    if (career.injuredWeeks > 0) {
      career.injuredWeeks--;
      if (career.injuredWeeks === 0) S.pushNews(career, 'You are passed fit and back in training.', 'good');
    }

    career.week++;
    career.slots = 3;
    var nextFx = career.week <= SEASON_WEEKS ? fixtureForWeek(career, career.week) : null;
    if (nextFx && nextFx.type === 'free') career.slots = 5;
    career.selection = decideSelection(career);
    S.save();
  }

  /* ---------- applying the player's match ---------- */

  function recordResult(career, fixture, hg, ag) {
    var world = career.world;
    if (fixture.type === 'league') {
      var t = tierOf(world, career.clubId) - 1;
      var div = world.divisions[t];
      var round = div.fixtures[fixture.round];
      for (var i = 0; i < round.length; i++) {
        var fx = round[i];
        if (fx.h === fixture.home && fx.a === fixture.away && fx.hg == null) {
          fx.hg = hg; fx.ag = ag;
          applyToTable(div, fx);
          break;
        }
      }
      var rng = rngFor(career.week * 61 + career.season * 13);
      creditScorers(div, fixture.opponent, fixture.isHome ? ag : hg, rng);
    } else if (fixture.type === 'cup') {
      var myGoals = fixture.isHome ? hg : ag;
      var theirGoals = fixture.isHome ? ag : hg;
      if (myGoals < theirGoals || (myGoals === theirGoals && rngFor(career.week * 77)() < 0.5)) {
        world.cup.out = true;
        world.cup.alive = false;
        S.pushNews(career, 'Knocked out of the cup by ' + D.CLUBS[fixture.opponent].name + '.', 'bad');
      } else if (fixture.cupRound === 4) {
        career.trophies.push({ name: 'National Cup', season: career.season, clubId: career.clubId });
        S.pushNews(career, 'CUP WINNERS! You lift the National Cup with ' + D.CLUBS[career.clubId].name + '.', 'great');
      } else {
        S.pushNews(career, 'Through to the next round of the cup.', 'good');
      }
    }
  }

  /* ---------- season end ---------- */

  function simRemaining(career) {
    // finish any unplayed rounds (e.g. the player's club after retirement/injury)
    var world = career.world;
    var rng = rngFor(career.season * 55 + 3);
    world.divisions.forEach(function (div) {
      div.fixtures.forEach(function (round) {
        round.forEach(function (fx) {
          if (fx.hg == null) {
            var sc = simScore(world, fx.h, fx.a, rng);
            fx.hg = sc[0]; fx.ag = sc[1];
            applyToTable(div, fx);
            creditScorers(div, fx.h, sc[0], rng);
            creditScorers(div, fx.a, sc[1], rng);
          }
        });
      });
    });
  }

  function endSeason(career) {
    simRemaining(career);
    var world = career.world;
    var myTier = tierOf(world, career.clubId);
    var rows = standings(world, myTier - 1);
    var pos = leaguePosition(world, career.clubId);
    var summary = {
      season: career.season,
      seasonYear: career.seasonYear,
      clubId: career.clubId,
      tier: myTier,
      leagueName: D.LEAGUES[myTier - 1].name,
      position: pos,
      apps: career.stats.apps + career.stats.subApps,
      goals: career.stats.goals,
      assists: career.stats.assists,
      motm: career.stats.motm,
      rating: S.avgRating(career.stats),
      awards: [],
      promoted: false,
      relegated: false,
      champion: false
    };

    if (pos === 1) {
      summary.champion = true;
      career.trophies.push({ name: D.LEAGUES[myTier - 1].name + ' Title', season: career.season, clubId: career.clubId });
      summary.awards.push('League Champions');
    }
    if (myTier > 1 && pos <= 2) { summary.promoted = true; summary.awards.push('Promoted'); }
    if (myTier < 4 && pos >= rows.length - 1) { summary.relegated = true; summary.awards.push('Relegated'); }

    // player awards
    var div = world.divisions[myTier - 1];
    var topScorer = div.scorers.slice().sort(function (a, b) { return b.goals - a.goals; })[0];
    if (career.stats.goals >= (topScorer ? topScorer.goals : 0) && career.stats.goals > 4) {
      summary.awards.push('Golden Boot (' + career.stats.goals + ' goals)');
      career.trophies.push({ name: 'Golden Boot', season: career.season, clubId: career.clubId });
    }
    if (S.avgRating(career.stats) >= 7.6 && career.stats.apps >= 10) {
      summary.awards.push('Player of the Season');
      career.trophies.push({ name: 'Player of the Season', season: career.season, clubId: career.clubId });
    }

    // promotions / relegations across all divisions
    var moves = [];
    for (var t = 0; t < 4; t++) {
      var st = standings(world, t);
      if (t > 0) moves.push({ up: [st[0].clubId, st[1].clubId], fromTier: t + 1 });
    }
    var newDivs = world.divisions.map(function (d) { return d.clubIds.slice(); });
    for (var t2 = 1; t2 < 4; t2++) {
      var below = standings(world, t2);
      var above = standings(world, t2 - 1);
      var up = [below[0].clubId, below[1].clubId];
      var down = [above[above.length - 1].clubId, above[above.length - 2].clubId];
      newDivs[t2 - 1] = newDivs[t2 - 1].filter(function (id) { return down.indexOf(id) < 0; }).concat(up);
      newDivs[t2] = newDivs[t2].filter(function (id) { return up.indexOf(id) < 0; }).concat(down);
      up.forEach(function (id) { world.strAdj[id] = (world.strAdj[id] || 0) + 4; });
      down.forEach(function (id) { world.strAdj[id] = (world.strAdj[id] || 0) - 3; });
    }

    // reputation
    var repGain = (S.avgRating(career.stats) - 6.4) * 6 + career.stats.goals * 0.55 + career.stats.assists * 0.3;
    repGain += (5 - myTier) * 1.2;
    if (summary.champion) repGain += 6;
    career.reputation = S.clamp(Math.round(career.reputation + S.clamp(repGain, -6, 26)), 1, 100);

    // ageing
    career.age++;
    if (career.age >= 31) {
      ['pace', 'stamina', 'strength', 'dribbling'].forEach(function (k) {
        var drop = career.age >= 34 ? 3 : career.age >= 32 ? 2 : 1;
        career.attrs[k] = S.clamp(career.attrs[k] - drop, 10, 99);
      });
    }

    // history
    career.history.push(summary);
    career.career.apps += career.stats.apps;
    career.career.subApps += career.stats.subApps;
    career.career.goals += career.stats.goals;
    career.career.assists += career.stats.assists;
    career.career.motm += career.stats.motm;
    career.career.ratingSum += career.stats.ratingSum;
    career.career.ratingN += career.stats.ratingN;
    career.career.wins += career.stats.wins;
    career.career.draws += career.stats.draws;
    career.career.losses += career.stats.losses;
    career.career.seasons++;

    summary.newDivs = newDivs;
    return summary;
  }

  function startNewSeason(career, summary) {
    career.season++;
    career.seasonYear++;
    career.week = 1;
    career.slots = 3;
    career.stats = S.blankStats();
    career.form = [];
    var keepStr = career.world.strAdj;
    var newDivs = summary.newDivs;
    career.world = {
      divisions: newDivs.map(function (ids, i) { return { clubIds: ids, tier: i + 1 }; })
    };
    var w = buildWorld(career, keepStr);
    career.world = w;
    career.squad = S.makeSquad(career.clubId, career.season);
    career.manager = S.makeManager(career.clubId, career.season);
    career.contract.seasonsLeft--;
    career.selection = decideSelection(career);
    S.changeEnergy(career, 100);
    S.pushNews(career, 'Pre-season done. ' + D.LEAGUES[tierOf(w, career.clubId) - 1].name + ' campaign ' +
      (career.seasonYear) + ' starts now.', 'info');
    S.save();
  }

  /* ---------- transfers & contracts ---------- */

  function interestScore(career, clubId) {
    var world = career.world;
    var t = tierOf(world, clubId);
    var ov = S.overall(career);
    var need = clubStrength(world, clubId) * 0.92;
    var score = ov - need + (career.reputation - 40) * 0.35 + (S.avgRating(career.stats) - 6.5) * 8;
    score += career.stats.goals * 0.5;
    if (career.perks.agent) score += 5;
    if (career.age > 31) score -= 10;
    return score;
  }

  function generateOffers(career) {
    var offers = [];
    var world = career.world;
    var myTier = tierOf(world, career.clubId);
    var candidates = D.CLUBS.filter(function (c) { return c.id !== career.clubId; });
    candidates.forEach(function (c) {
      var sc = interestScore(career, c.id);
      if (sc > 4) {
        var t = tierOf(world, c.id);
        offers.push({ clubId: c.id, score: sc + (4 - t) * 2 });
      }
    });
    offers.sort(function (a, b) { return b.score - a.score; });
    offers = offers.slice(0, 3).map(function (o) {
      var wage = Math.round(S.wageFor(career, o.clubId) * (0.9 + Math.min(0.5, o.score / 45)));
      var t = tierOf(world, o.clubId);
      return {
        clubId: o.clubId,
        tier: t,
        wage: wage,
        seasons: o.score > 25 ? 4 : 3,
        signOn: Math.round(wage * (o.score > 20 ? 8 : 4)),
        goalBonus: Math.round(wage * 0.05) + 40,
        winBonus: Math.round(wage * 0.03) + 30,
        role: o.score > 26 ? 'Star Player' : o.score > 14 ? 'Key Player' : 'Squad Player'
      };
    });
    // renewal from current club
    var renewWage = Math.round(S.wageFor(career, career.clubId) * (career.rel.boss > 65 ? 1.12 : 0.98));
    offers.unshift({
      clubId: career.clubId,
      tier: myTier,
      wage: renewWage,
      seasons: 3,
      signOn: Math.round(renewWage * 3),
      goalBonus: Math.round(renewWage * 0.05) + 40,
      winBonus: Math.round(renewWage * 0.03) + 30,
      role: career.rel.boss > 70 ? 'Key Player' : 'Squad Player',
      renewal: true
    });
    return offers;
  }

  function signWith(career, offer) {
    var moving = offer.clubId !== career.clubId;
    career.clubId = offer.clubId;
    career.contract = {
      wage: offer.wage,
      seasonsLeft: offer.seasons,
      goalBonus: offer.goalBonus,
      winBonus: offer.winBonus,
      role: offer.role
    };
    S.addMoney(career, offer.signOn);
    if (moving) {
      career.squad = S.makeSquad(offer.clubId, career.season);
      career.manager = S.makeManager(offer.clubId, career.season);
      career.rel.team = 45;
      career.rel.boss = 55;
      career.rel.fans = 40;
      S.pushNews(career, 'You sign for ' + D.CLUBS[offer.clubId].name + ' on ' +
        S.fmtMoney(offer.wage) + '/week.', 'great');
    } else {
      S.pushNews(career, 'New deal signed at ' + D.CLUBS[offer.clubId].name + '.', 'good');
      S.changeRel(career, 'fans', 6);
    }
    career.selection = decideSelection(career);
    S.save();
  }

  RS.World = {
    SEASON_WEEKS: SEASON_WEEKS,
    CUP_NAMES: CUP_NAMES,
    buildWorld: buildWorld,
    tierOf: tierOf,
    clubStrength: clubStrength,
    simLeagueRound: simLeagueRound,
    simScore: simScore,
    standings: standings,
    leaguePosition: leaguePosition,
    fixtureForWeek: fixtureForWeek,
    decideSelection: decideSelection,
    formAvg: formAvg,
    rivalRating: rivalRating,
    weeklyIncome: weeklyIncome,
    endOfWeek: endOfWeek,
    recordResult: recordResult,
    endSeason: endSeason,
    startNewSeason: startNewSeason,
    generateOffers: generateOffers,
    signWith: signWith,
    interestScore: interestScore
  };
})(window.RS = window.RS || {});
