/* Rising Star — screens, menus and the career loop glue */
(function (RS) {
  'use strict';

  var D = RS.Data;
  var S = RS.State;
  var A = RS.Audio;
  var Wd = RS.World;

  var tab = 'home';
  var pendingOffers = null;
  var seasonSummary = null;

  /* ---------- tiny helpers ---------- */

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function c(career) { return D.CLUBS[career.clubId]; }

  function show(id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    $(id).classList.add('active');
    window.scrollTo(0, 0);
    var body = $(id).querySelector('.scroll');
    if (body) body.scrollTop = 0;
  }

  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = msg;
    $('toasts').appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2700);
  }

  function modal(html, buttons, opts) {
    var wrap = $('modal');
    var btns = (buttons || [{ label: 'OK' }]).map(function (b, i) {
      return '<button class="btn ' + (b.kind || (i === 0 ? 'primary' : 'ghost')) + '" data-mi="' + i + '">' + b.label + '</button>';
    }).join('');
    wrap.innerHTML = '<div class="modal-card' + (opts && opts.wide ? ' wide' : '') + '">' + html +
      '<div class="modal-actions">' + btns + '</div></div>';
    wrap.classList.add('show');
    wrap.onclick = function (e) {
      var b = e.target.closest('[data-mi]');
      if (!b) return;
      var idx = +b.getAttribute('data-mi');
      A.play('click');
      wrap.classList.remove('show');
      wrap.innerHTML = '';
      var fn = (buttons || [])[idx] && buttons[idx].onClick;
      if (fn) fn();
    };
  }

  function bar(value, max, cls) {
    var pct = S.clamp(value / max * 100, 0, 100);
    return '<div class="bar ' + (cls || '') + '"><i style="width:' + pct.toFixed(1) + '%"></i></div>';
  }

  function badge(club, size) {
    return '<span class="badge ' + (size || '') + '" style="background:' + club.c1 + ';color:' + club.c2 + '">' +
      club.short + '</span>';
  }

  function relColor(v) { return v >= 70 ? 'good' : v >= 40 ? '' : 'bad'; }

  /* ---------- start screen ---------- */

  function renderStart() {
    var has = S.hasSave();
    $('start-continue').style.display = has ? 'block' : 'none';
    $('sound-toggle').textContent = A.isMuted() ? '🔇 Sound off' : '🔊 Sound on';
  }

  /* ---------- career creation ---------- */

  var create = { pos: 'ST', trait: 'finisher', clubId: null, nation: 'England' };

  function renderCreate() {
    var rng = S.mulberry32(Date.now() & 0xffff);
    var tier4 = D.clubsInTier(4).slice();
    for (var i = tier4.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = tier4[i]; tier4[i] = tier4[j]; tier4[j] = t;
    }
    create.clubs = tier4.slice(0, 3);
    create.clubId = create.clubs[0].id;

    $('create-nation').innerHTML = D.NATIONS.map(function (n) {
      return '<option' + (n === create.nation ? ' selected' : '') + '>' + n + '</option>';
    }).join('');

    $('create-positions').innerHTML = D.POSITIONS.map(function (p) {
      return '<button class="pick ' + (p.key === create.pos ? 'on' : '') + '" data-pos="' + p.key + '">' +
        '<span class="pick-main"><b>' + p.name + '</b><span>' + p.desc + '</span></span></button>';
    }).join('');

    $('create-traits').innerHTML = D.TRAITS.map(function (t2) {
      return '<button class="pick ' + (t2.key === create.trait ? 'on' : '') + '" data-trait="' + t2.key + '">' +
        '<span class="pick-main"><b>' + t2.name + '</b><span>' + t2.desc + '</span></span></button>';
    }).join('');

    $('create-clubs').innerHTML = create.clubs.map(function (cl) {
      var wage = Math.round(D.LEAGUES[3].wageBase * (0.7 + cl.str / 60));
      return '<button class="pick club ' + (cl.id === create.clubId ? 'on' : '') + '" data-club="' + cl.id + '">' +
        badge(cl) + '<span class="pick-main"><b>' + cl.name + '</b>' +
        '<span>' + D.LEAGUES[3].name + ' • Squad strength ' + cl.str + ' • ' + S.fmtMoney(wage) + '/wk</span></span></button>';
    }).join('');
  }

  function doCreate() {
    var first = ($('create-first').value || '').trim() || 'Alex';
    var last = ($('create-last').value || '').trim() || 'Rivera';
    var career = S.newCareer({
      first: first.slice(0, 14),
      last: last.slice(0, 16),
      nation: $('create-nation').value,
      pos: create.pos,
      trait: create.trait,
      clubId: create.clubId,
      kitNumber: 1 + Math.floor(Math.random() * 30)
    });
    career.injuredWeeks = 0;
    RS.career = career;
    career.world = Wd.buildWorld(career, {});
    career.selection = Wd.decideSelection(career);
    S.pushNews(career, 'You sign your first professional deal with ' + D.CLUBS[career.clubId].name +
      ' on ' + S.fmtMoney(career.contract.wage) + ' a week. Time to make a name.', 'great');
    S.save();
    tab = 'home';
    show('screen-hub');
    renderHub();
    setTimeout(function () {
      modal('<h3>Welcome to the first team</h3>' +
        '<p>Every week you get <b>3 actions</b> — train, rest, or work on the people around you — then a match.</p>' +
        '<p>In matches you play the <b>key moments</b>: swipe to shoot, pick out passes, beat your marker. ' +
        'Your rating drives everything — game time, contracts, transfers.</p>' +
        '<p class="muted">Energy is the currency of your body. Spend it wisely.</p>',
        [{ label: 'Let\'s go' }]);
    }, 400);
  }

  /* ---------- hub header ---------- */

  function renderHeader() {
    var career = RS.career;
    var club = c(career);
    var tier = Wd.tierOf(career.world, career.clubId);
    $('hub-badge').innerHTML = badge(club, 'lg');
    $('hub-name').textContent = career.name;
    $('hub-sub').textContent = club.name + ' • ' + D.LEAGUES[tier - 1].short + ' • ' + career.pos;
    $('hub-money').textContent = S.fmtMoney(career.money);
    $('hub-season').textContent = 'S' + career.season + ' W' + Math.min(career.week, Wd.SEASON_WEEKS);
    $('hub-ovr').textContent = S.overall(career);
    var e = career.energy;
    $('hub-energy-fill').style.width = e + '%';
    $('hub-energy-fill').className = 'meter-fill' + (e < 30 ? ' low' : e > 75 ? ' high' : '');
    $('hub-energy-val').textContent = Math.round(e);
    $('hub-slots').innerHTML = 'Actions: ' + Array.apply(null, Array(3)).map(function (_, i) {
      return '<i class="slot' + (i < career.slots ? ' on' : '') + '"></i>';
    }).join('');
  }

  /* ---------- tab: home ---------- */

  function selectionLabel(sel) {
    return sel === 'start' ? '<span class="tag good">In the starting XI</span>'
      : sel === 'sub' ? '<span class="tag warn">On the bench</span>'
        : sel === 'injured' ? '<span class="tag bad">Injured</span>'
          : '<span class="tag bad">Not in the squad</span>';
  }

  function renderHome() {
    var career = RS.career;
    var fx = Wd.fixtureForWeek(career, career.week);
    var html = '';

    if (!fx) {
      html += '<div class="card"><h3>Season complete</h3><p class="muted">Time to wrap up the campaign.</p>' +
        '<button class="btn primary big" data-action="season-end">Finish the season</button></div>';
    } else if (fx.type === 'free') {
      html += '<div class="card fixture free"><div class="fx-comp">Free week</div>' +
        '<h3>No fixture</h3><p class="muted">You are out of the cup — use the time. You have extra actions this week.</p>' +
        '<button class="btn primary big" data-action="skip-week">Skip to next week</button></div>';
    } else {
      var opp = D.CLUBS[fx.opponent];
      var myClub = c(career);
      html += '<div class="card fixture">' +
        '<div class="fx-comp">' + esc(fx.comp) + ' • ' + (fx.neutral ? 'Neutral ground' : (fx.isHome ? 'Home' : 'Away')) + '</div>' +
        '<div class="fx-teams">' +
        '<div class="fx-team">' + badge(D.CLUBS[fx.home], 'lg') + '<span>' + esc(D.CLUBS[fx.home].name) + '</span></div>' +
        '<div class="fx-v">v</div>' +
        '<div class="fx-team">' + badge(D.CLUBS[fx.away], 'lg') + '<span>' + esc(D.CLUBS[fx.away].name) + '</span></div>' +
        '</div>' +
        '<div class="fx-meta">' + selectionLabel(career.selection) +
        '<span class="tag">' + esc(opp.name) + ' strength ' + Wd.clubStrength(career.world, fx.opponent) + '</span></div>' +
        (career.energy < 35 ? '<p class="warn-line">⚠ You are low on energy — your legs will go early.</p>' : '') +
        '<button class="btn primary big" data-action="play">' +
        (career.selection === 'out' || career.selection === 'injured' ? 'Watch the match' : 'Play match') + '</button>' +
        '</div>';
    }

    // form + league snapshot
    var pos = Wd.leaguePosition(career.world, career.clubId);
    var tier = Wd.tierOf(career.world, career.clubId);
    html += '<div class="grid2">' +
      '<div class="card stat"><span class="k">League position</span><b>' + (pos || '-') + '<sup>' + ord(pos) + '</sup></b>' +
      '<span class="muted">' + D.LEAGUES[tier - 1].name + '</span></div>' +
      '<div class="card stat"><span class="k">Avg rating</span><b>' + (S.avgRating(career.stats) || '-') + '</b>' +
      '<span class="muted">' + career.stats.apps + ' starts • ' + career.stats.goals + ' goals</span></div>' +
      '</div>';

    html += '<div class="card"><h3>Form</h3><div class="form-row">' +
      (career.form.length ? career.form.slice(-6).map(function (r) {
        return '<span class="form-pill ' + (r >= 7.5 ? 'good' : r < 6 ? 'bad' : '') + '">' + r.toFixed(1) + '</span>';
      }).join('') : '<span class="muted">No matches played yet.</span>') + '</div></div>';

    html += '<div class="card"><h3>News</h3>' + (career.news.length ? career.news.slice(0, 8).map(function (n) {
      return '<div class="news ' + n.kind + '"><span class="news-wk">S' + n.season + ' W' + n.week + '</span>' + esc(n.text) + '</div>';
    }).join('') : '<p class="muted">Quiet week.</p>') + '</div>';

    return html;
  }

  function ord(n) {
    if (n % 10 === 1 && n !== 11) return 'st';
    if (n % 10 === 2 && n !== 12) return 'nd';
    if (n % 10 === 3 && n !== 13) return 'rd';
    return 'th';
  }

  /* ---------- tab: train ---------- */

  var TRAIN_COST = 14;

  function renderTrain() {
    var career = RS.career;
    var html = '<div class="card slim"><div class="row-between"><b>Training</b>' +
      '<span class="muted">' + TRAIN_COST + ' energy • 1 action</span></div>' +
      '<p class="muted small">Progress is fastest when you are young. Bank it now.</p></div>';

    html += '<div class="list">' + D.ATTRS.map(function (a) {
      var v = career.attrs[a.key];
      var need = S.xpNeeded(v);
      var have = career.xp[a.key] || 0;
      var can = career.slots > 0 && career.energy >= TRAIN_COST;
      return '<div class="attr-row">' +
        '<div class="attr-top"><b>' + a.name + '</b><span class="attr-val">' + v + '</span></div>' +
        bar(v, 99, 'attr') +
        '<div class="attr-xp">' + bar(have, need, 'xp') + '</div>' +
        '<div class="attr-bottom"><span class="muted small">' + a.desc + '</span>' +
        '<button class="btn small' + (can ? ' primary' : ' disabled') + '" data-action="train" data-attr="' + a.key + '">Train</button></div>' +
        '</div>';
    }).join('') + '</div>';
    return html;
  }

  function doTrain(key) {
    var career = RS.career;
    if (career.slots <= 0) return toast('No actions left this week — play your match.', 'bad');
    if (career.energy < TRAIN_COST) return toast('Too tired to train. Rest up.', 'bad');
    career.slots--;
    S.changeEnergy(career, -TRAIN_COST);
    var amount = 34 + Math.random() * 12;
    var ups = S.addXp(career, key, amount);
    S.changeRel(career, 'boss', 0.8);
    A.play(ups.length ? 'levelup' : 'click');
    var attrName = D.ATTRS.filter(function (a) { return a.key === key; })[0].name;
    if (ups.length) toast('<b>' + attrName + ' up!</b> Now ' + career.attrs[key], 'good');
    else toast('Good session. ' + attrName + ' progress made.');
    S.save();
    renderHub();
  }

  /* ---------- tab: life ---------- */

  function renderLife() {
    var career = RS.career;
    var rels = [
      ['boss', 'Manager', '🎩'], ['team', 'Teammates', '🤜'], ['fans', 'Fans', '📣'],
      ['sponsors', 'Sponsors', '💼'], ['partner', 'Family', '💛']
    ];
    var html = '<div class="card"><h3>Relationships</h3>' + rels.map(function (r) {
      return '<div class="rel"><span class="rel-name">' + r[2] + ' ' + r[1] + '</span>' +
        bar(career.rel[r[0]], 100, relColor(career.rel[r[0]])) +
        '<span class="rel-val">' + Math.round(career.rel[r[0]]) + '</span></div>';
    }).join('') + '<p class="muted small">Keep the manager happy for game time. Keep teammates happy and they will find you with the ball.</p></div>';

    html += '<div class="card"><h3>This week <span class="muted">(' + career.slots + ' actions left)</span></h3>' +
      '<div class="tiles">' + D.ACTIVITIES.map(function (a) {
        return '<button class="tile" data-action="activity" data-key="' + a.key + '">' +
          '<span class="tile-icon">' + a.icon + '</span><b>' + a.name + '</b>' +
          '<span class="muted small">' + (a.cost ? S.fmtMoney(a.cost) : 'Free') + '</span></button>';
      }).join('') + '</div></div>';

    html += '<div class="card"><h3>Spend your money</h3><div class="list">' + D.ITEMS.map(function (it) {
      var owned = career.owned.indexOf(it.key) >= 0;
      return '<div class="shop-row' + (owned ? ' owned' : '') + '">' +
        '<span class="shop-icon">' + it.icon + '</span>' +
        '<span class="shop-main"><b>' + it.name + '</b><span class="muted small">' + it.desc + '</span></span>' +
        (owned ? '<span class="tag good">Owned</span>' :
          '<button class="btn small ' + (career.money >= it.cost ? 'primary' : 'disabled') + '" data-action="buy" data-key="' + it.key + '">' +
          S.fmtMoney(it.cost) + '</button>') + '</div>';
    }).join('') + '</div></div>';

    if (career.sponsorDeal) {
      html += '<div class="card"><h3>Sponsor</h3><p><b>' + esc(career.sponsorDeal.name) + '</b> — ' +
        S.fmtMoney(career.sponsorDeal.weekly) + ' a week while your name is hot.</p></div>';
    }
    return html;
  }

  function doActivity(key) {
    var career = RS.career;
    var act = D.ACTIVITIES.filter(function (a) { return a.key === key; })[0];
    if (!act) return;
    if (career.slots <= 0) return toast('No actions left this week.', 'bad');
    if (act.cost && career.money < act.cost) return toast('You cannot afford that.', 'bad');
    career.slots--;
    if (act.cost) S.addMoney(career, -act.cost);
    var msg = '';
    switch (key) {
      case 'rest':
        S.changeEnergy(career, 26);
        msg = 'You feel fresh. +26 energy';
        break;
      case 'teammates':
        S.changeRel(career, 'team', 9);
        S.changeEnergy(career, -4);
        msg = 'The lads had a laugh. Teammates +9';
        break;
      case 'boss':
        S.changeRel(career, 'boss', 8);
        S.changeEnergy(career, -6);
        S.addXp(career, 'composure', 8);
        msg = 'The manager likes your attitude. Manager +8';
        break;
      case 'fans':
        S.changeRel(career, 'fans', 10);
        S.changeEnergy(career, -5);
        msg = 'Queues round the block. Fans +10';
        break;
      case 'partner':
        S.changeRel(career, 'partner', 14);
        S.changeEnergy(career, 6);
        msg = 'A proper evening off. Family +14';
        break;
      case 'sponsor':
        var pay = Math.round(180 + career.reputation * 55 + career.rel.fans * 12);
        S.addMoney(career, pay);
        S.changeRel(career, 'sponsors', 9);
        S.changeEnergy(career, -6);
        A.play('coin');
        msg = 'Shoot done. ' + S.fmtMoney(pay) + ' banked, Sponsors +9';
        break;
      case 'charity':
        S.changeRel(career, 'fans', 12);
        S.changeRel(career, 'sponsors', 5);
        S.changeEnergy(career, -6);
        msg = 'The community turned out. Fans +12';
        break;
      case 'gym':
        S.changeEnergy(career, -16);
        S.addXp(career, 'strength', 24);
        S.addXp(career, 'stamina', 24);
        msg = 'Brutal session. Strength & Stamina progress';
        break;
    }
    A.play(key === 'sponsor' ? 'coin' : 'click');
    toast(msg, 'good');
    maybeSponsorOffer();
    S.save();
    renderHub();
  }

  function doBuy(key) {
    var career = RS.career;
    var it = D.ITEMS.filter(function (i) { return i.key === key; })[0];
    if (!it || career.owned.indexOf(key) >= 0) return;
    if (career.money < it.cost) return toast('Not enough money.', 'bad');
    S.addMoney(career, -it.cost);
    career.owned.push(key);
    if (it.effect.attr) Object.keys(it.effect.attr).forEach(function (k) {
      career.attrs[k] = S.clamp(career.attrs[k] + it.effect.attr[k], 1, 99);
    });
    if (it.effect.perk) career.perks[it.effect.perk] = true;
    if (it.effect.rel) Object.keys(it.effect.rel).forEach(function (k) {
      S.changeRel(career, k, it.effect.rel[k]);
    });
    A.play('coin');
    toast('<b>' + it.name + '</b> — sorted.', 'good');
    S.save();
    renderHub();
  }

  function maybeSponsorOffer() {
    var career = RS.career;
    if (career.sponsorDeal || career.reputation < 18 || career.rel.sponsors < 45) return;
    if (Math.random() > 0.25) return;
    var names = ['Kestrel Sportswear', 'Volt Energy', 'Northbridge Bank', 'Apex Boots', 'Tidal Drinks'];
    var name = names[Math.floor(Math.random() * names.length)];
    var weekly = Math.round(career.reputation * 45 + 250);
    career.sponsorDeal = { name: name, weekly: weekly };
    S.pushNews(career, name + ' sign you up — ' + S.fmtMoney(weekly) + ' a week.', 'great');
  }

  /* ---------- tab: club ---------- */

  function renderClub() {
    var career = RS.career;
    var club = c(career);
    var tier = Wd.tierOf(career.world, career.clubId);
    var rival = Wd.rivalRating(career);
    var ov = S.overall(career);
    var html = '<div class="card club-head" style="--c1:' + club.c1 + ';--c2:' + club.c2 + '">' +
      badge(club, 'xl') + '<div><h3>' + esc(club.name) + '</h3>' +
      '<span class="muted">' + D.LEAGUES[tier - 1].name + ' • Strength ' + Wd.clubStrength(career.world, career.clubId) + '</span></div></div>';

    html += '<div class="card"><h3>Manager</h3><p><b>' + esc(career.manager.name) + '</b> — ' + career.manager.style + '.</p>' +
      '<div class="rel"><span class="rel-name">Standing</span>' + bar(career.rel.boss, 100, relColor(career.rel.boss)) +
      '<span class="rel-val">' + Math.round(career.rel.boss) + '</span></div>' +
      '<p class="muted small">' + (career.selection === 'start'
        ? 'You are first choice at ' + career.pos + '.'
        : career.selection === 'sub'
          ? 'He rates you but the shirt belongs to someone else right now.'
          : 'He does not fancy you. Ratings and training will change that.') + '</p></div>';

    html += '<div class="card"><h3>Your contract</h3>' +
      '<div class="kv"><span>Wage</span><b>' + S.fmtMoney(career.contract.wage) + '/wk</b></div>' +
      '<div class="kv"><span>Role</span><b>' + career.contract.role + '</b></div>' +
      '<div class="kv"><span>Length</span><b>' + career.contract.seasonsLeft + ' season' + (career.contract.seasonsLeft === 1 ? '' : 's') + ' left</b></div>' +
      '<div class="kv"><span>Goal bonus</span><b>' + S.fmtMoney(career.contract.goalBonus) + '</b></div>' +
      '<div class="kv"><span>Win bonus</span><b>' + S.fmtMoney(career.contract.winBonus) + '</b></div>' +
      '<div class="kv"><span>Market value</span><b>' + S.fmtMoney(S.marketValue(career)) + '</b></div></div>';

    html += '<div class="card"><h3>Squad</h3><div class="squad">' +
      '<div class="squad-row me"><span class="sq-pos">' + career.pos + '</span>' +
      '<span class="sq-name">' + esc(career.name) + ' <span class="tag">you</span></span>' +
      '<span class="sq-rat">' + ov + '</span></div>' +
      career.squad.slice(0, 14).map(function (p) {
        return '<div class="squad-row' + (p.pos === career.pos && p.rating >= rival ? ' rival' : '') + '">' +
          '<span class="sq-pos">' + p.pos + '</span><span class="sq-name">' + esc(p.name) +
          '<span class="muted small"> ' + p.age + '</span></span>' +
          '<span class="sq-rat">' + p.rating + '</span></div>';
      }).join('') + '</div></div>';
    return html;
  }

  /* ---------- tab: league ---------- */

  function renderLeague() {
    var career = RS.career;
    var tier = Wd.tierOf(career.world, career.clubId);
    var rows = Wd.standings(career.world, tier - 1);
    var html = '<div class="card"><h3>' + D.LEAGUES[tier - 1].name + '</h3>' +
      '<table class="table"><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        var cl = D.CLUBS[r.clubId];
        var zone = i < 2 && tier > 1 ? ' promo' : (i >= rows.length - 2 && tier < 4 ? ' releg' : '');
        return '<tr class="' + (r.clubId === career.clubId ? 'me' : '') + zone + '">' +
          '<td>' + (i + 1) + '</td><td class="tl">' + badge(cl) + ' <span class="cname">' + esc(cl.name) + '</span></td>' +
          '<td>' + r.p + '</td><td>' + r.w + '</td><td>' + r.d + '</td><td>' + r.l + '</td>' +
          '<td>' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td><b>' + r.pts + '</b></td></tr>';
      }).join('') + '</tbody></table></div>';

    // top scorers (with the player injected)
    var div = career.world.divisions[tier - 1];
    var scorers = div.scorers.map(function (s) { return { name: s.name, clubId: s.clubId, goals: s.goals }; });
    scorers.push({ name: career.name, clubId: career.clubId, goals: career.stats.goals, me: true });
    scorers.sort(function (a, b) { return b.goals - a.goals; });
    html += '<div class="card"><h3>Top scorers</h3><div class="list">' +
      scorers.slice(0, 8).map(function (s, i) {
        return '<div class="scorer' + (s.me ? ' me' : '') + '"><span class="rank">' + (i + 1) + '</span>' +
          badge(D.CLUBS[s.clubId]) + '<span class="sc-name">' + esc(s.name) + '</span><b>' + s.goals + '</b></div>';
      }).join('') + '</div></div>';

    // fixtures / results for the player's club
    var fxs = [];
    for (var w = 1; w <= Wd.SEASON_WEEKS; w++) {
      var f = Wd.fixtureForWeek(career, w);
      if (!f || f.type === 'free') continue;
      var score = null;
      if (f.type === 'league') {
        var round = career.world.divisions[tier - 1].fixtures[f.round];
        for (var i2 = 0; i2 < round.length; i2++) {
          if (round[i2].h === f.home && round[i2].a === f.away && round[i2].hg != null) {
            score = round[i2].hg + '-' + round[i2].ag;
          }
        }
      }
      fxs.push({ w: w, f: f, score: score });
    }
    html += '<div class="card"><h3>Your season</h3><div class="list fixtures">' + fxs.map(function (x) {
      var opp = D.CLUBS[x.f.opponent];
      var cls = '';
      if (x.score) {
        var parts = x.score.split('-');
        var mine = x.f.isHome ? +parts[0] : +parts[1];
        var theirs = x.f.isHome ? +parts[1] : +parts[0];
        cls = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
      }
      return '<div class="fx-row ' + cls + (x.w === career.week ? ' now' : '') + '">' +
        '<span class="fx-w">W' + x.w + '</span>' + badge(opp) +
        '<span class="fx-opp">' + (x.f.isHome ? 'v ' : '@ ') + esc(opp.name) + '</span>' +
        '<span class="fx-score">' + (x.score || (x.f.type === 'cup' ? 'CUP' : '')) + '</span></div>';
    }).join('') + '</div></div>';
    return html;
  }

  /* ---------- tab: me ---------- */

  function renderMe() {
    var career = RS.career;
    var ov = S.overall(career);
    var html = '<div class="card profile">' +
      '<div class="pf-top"><div class="pf-ovr"><b>' + ov + '</b><span>OVR</span></div>' +
      '<div class="pf-id"><h3>' + esc(career.name) + '</h3>' +
      '<span class="muted">' + career.pos + ' • Age ' + career.age + ' • ' + esc(career.nation) + '</span>' +
      '<span class="muted">Value ' + S.fmtMoney(S.marketValue(career)) + ' • Rep ' + career.reputation + '</span></div></div>' +
      '<div class="rel"><span class="rel-name">Reputation</span>' + bar(career.reputation, 100, 'gold') +
      '<span class="rel-val">' + career.reputation + '</span></div></div>';

    html += '<div class="card"><h3>Attributes</h3>' + D.ATTRS.map(function (a) {
      return '<div class="rel"><span class="rel-name">' + a.name + '</span>' +
        bar(career.attrs[a.key], 99, career.attrs[a.key] >= 70 ? 'good' : '') +
        '<span class="rel-val">' + career.attrs[a.key] + '</span></div>';
    }).join('') + '</div>';

    var st = career.stats, cs = career.career;
    html += '<div class="card"><h3>This season</h3><div class="statgrid">' +
      statCell('Apps', st.apps + st.subApps) + statCell('Goals', st.goals) + statCell('Assists', st.assists) +
      statCell('Avg rating', S.avgRating(st) || '-') + statCell('Star man', st.motm) +
      statCell('W-D-L', st.wins + '-' + st.draws + '-' + st.losses) + '</div></div>';

    html += '<div class="card"><h3>Career</h3><div class="statgrid">' +
      statCell('Seasons', cs.seasons) + statCell('Apps', cs.apps + cs.subApps) + statCell('Goals', cs.goals) +
      statCell('Assists', cs.assists) + statCell('Avg rating', S.avgRating(cs) || '-') + statCell('Star man', cs.motm) +
      '</div></div>';

    if (career.trophies.length) {
      html += '<div class="card"><h3>Trophy cabinet</h3><div class="tiles small">' + career.trophies.map(function (t) {
        return '<div class="trophy">🏆<b>' + esc(t.name) + '</b><span class="muted small">S' + t.season + ' • ' +
          D.CLUBS[t.clubId].short + '</span></div>';
      }).join('') + '</div></div>';
    }

    if (career.history.length) {
      html += '<div class="card"><h3>History</h3><div class="list">' + career.history.slice().reverse().map(function (h) {
        return '<div class="hist"><span class="hist-yr">S' + h.season + '</span>' + badge(D.CLUBS[h.clubId]) +
          '<span class="hist-main"><b>' + h.position + ord(h.position) + '</b> in ' + esc(h.leagueName) +
          '<span class="muted small"> • ' + h.apps + ' apps, ' + h.goals + ' goals, ' + (h.rating || '-') + ' avg</span></span></div>';
      }).join('') + '</div></div>';
    }

    html += '<div class="card"><h3>Options</h3><div class="tiles">' +
      '<button class="tile" data-action="help"><span class="tile-icon">❓</span><b>How to play</b>' +
      '<span class="muted small">Controls</span></button>' +
      '<button class="tile" data-action="mute"><span class="tile-icon">' + (A.isMuted() ? '🔇' : '🔊') + '</span><b>Sound</b><span class="muted small">' + (A.isMuted() ? 'Off' : 'On') + '</span></button>' +
      (career.age >= 30 ? '<button class="tile" data-action="retire"><span class="tile-icon">🎓</span><b>Retire</b><span class="muted small">Hang them up</span></button>' : '') +
      '<button class="tile danger" data-action="wipe"><span class="tile-icon">🗑️</span><b>New career</b><span class="muted small">Delete save</span></button>' +
      '</div></div>';
    return html;
  }

  function statCell(k, v) {
    return '<div class="statcell"><span>' + k + '</span><b>' + v + '</b></div>';
  }

  /* ---------- hub render ---------- */

  function renderHub() {
    if (!RS.career) return;
    renderHeader();
    var body = $('hub-body');
    var html = tab === 'home' ? renderHome()
      : tab === 'train' ? renderTrain()
        : tab === 'life' ? renderLife()
          : tab === 'club' ? renderClub()
            : tab === 'league' ? renderLeague()
              : renderMe();
    body.innerHTML = html;
    var navs = document.querySelectorAll('#hub-nav button');
    for (var i = 0; i < navs.length; i++) {
      navs[i].classList.toggle('on', navs[i].getAttribute('data-tab') === tab);
    }
  }

  /* ---------- match flow ---------- */

  function startMatch() {
    var career = RS.career;
    var fx = Wd.fixtureForWeek(career, career.week);
    if (!fx || fx.type === 'free') return;
    var sel = career.selection;
    if (sel === 'out' || sel === 'injured') {
      var rng = Math.random;
      var sc = Wd.simScore(career.world, fx.home, fx.away, rng);
      var res = {
        fixture: fx, home: fx.home, away: fx.away, hg: sc[0], ag: sc[1],
        myGoals: fx.isHome ? sc[0] : sc[1], theirGoals: fx.isHome ? sc[1] : sc[0],
        rating: 0, played: false, stats: { shots: 0, onTarget: 0, goals: 0, assists: 0, passes: 0, tackles: 0, dribbles: 0 },
        xp: {}, energyLeft: career.energy, cards: 0, log: []
      };
      showResult(res);
      return;
    }
    show('screen-match');
    setTimeout(function () {
      RS.Match.start(career, fx, {
        playing: true,
        onFrom: sel === 'sub' ? 55 + Math.floor(Math.random() * 15) : 0
      }, showResult);
    }, 60);
  }

  function showResult(res) {
    var career = RS.career;
    var fx = res.fixture;
    var won = res.myGoals > res.theirGoals;
    var drew = res.myGoals === res.theirGoals;

    // stats
    if (res.played) {
      if (career.selection === 'sub') career.stats.subApps++; else career.stats.apps++;
      career.stats.goals += res.stats.goals;
      career.stats.assists += res.stats.assists;
      career.stats.shots += res.stats.shots;
      career.stats.onTarget += res.stats.onTarget;
      career.stats.ratingSum += res.rating;
      career.stats.ratingN++;
      career.form.push(res.rating);
      career.energy = Math.round(res.energyLeft - 6 * (1.3 - career.attrs.stamina / 150));
      career.energy = S.clamp(career.energy, 0, 100);
    }
    if (won) career.stats.wins++; else if (drew) career.stats.draws++; else career.stats.losses++;

    // money
    var earned = 0;
    if (res.played) {
      earned += res.stats.goals * career.contract.goalBonus;
      if (won) earned += career.contract.winBonus;
      S.addMoney(career, earned);
    }

    // star man
    var motm = res.played && res.rating >= 8.0 && (won || res.rating >= 8.6);
    if (motm) career.stats.motm++;

    // xp
    var levelUps = [];
    Object.keys(res.xp || {}).forEach(function (k) {
      levelUps = levelUps.concat(S.addXp(career, k, res.xp[k] * 0.85));
    });

    // relationships
    if (res.played) {
      var perf = res.rating - 6.4;
      S.changeRel(career, 'boss', perf * 2.4 + (won ? 2 : drew ? 0 : -1.5));
      S.changeRel(career, 'fans', perf * 3 + res.stats.goals * 4 + (won ? 2 : 0));
      S.changeRel(career, 'team', perf * 1.6 + res.stats.assists * 3);
      S.changeRel(career, 'sponsors', perf * 1.2 + res.stats.goals * 1.5);
      S.changeRel(career, 'partner', -1);
      career.reputation = S.clamp(career.reputation + S.clamp(perf * 0.5 + res.stats.goals * 0.35, -1, 3), 1, 100);
    } else {
      S.changeRel(career, 'boss', -0.5);
    }

    // injury risk
    if (res.played && career.energy < 18 && Math.random() < 0.22) {
      career.injuredWeeks = 1 + Math.floor(Math.random() * 3);
      S.pushNews(career, 'You picked up a knock — out for ' + career.injuredWeeks + ' week(s).', 'bad');
    }

    // record + advance
    Wd.recordResult(career, fx, res.hg, res.ag);
    if (fx.type === 'league') Wd.simLeagueRound(career, fx.round);
    S.pushNews(career, D.CLUBS[fx.home].short + ' ' + res.hg + '-' + res.ag + ' ' + D.CLUBS[fx.away].short +
      (res.played ? ' — you rated ' + res.rating.toFixed(1) : ' — you did not feature'),
      won ? 'good' : drew ? 'info' : 'bad');
    Wd.endOfWeek(career);

    // render result screen
    var html = '<div class="res-score' + (won ? ' win' : drew ? ' draw' : ' loss') + '">' +
      '<div class="res-comp">' + esc(fx.comp) + '</div>' +
      '<div class="res-teams">' +
      '<div class="res-team">' + badge(D.CLUBS[fx.home], 'lg') + '<span>' + esc(D.CLUBS[fx.home].name) + '</span></div>' +
      '<div class="res-nums">' + res.hg + '<span>-</span>' + res.ag + '</div>' +
      '<div class="res-team">' + badge(D.CLUBS[fx.away], 'lg') + '<span>' + esc(D.CLUBS[fx.away].name) + '</span></div>' +
      '</div><div class="res-verdict">' + (won ? 'WIN' : drew ? 'DRAW' : 'DEFEAT') + '</div></div>';

    if (res.played) {
      html += '<div class="card rating-card' + (res.rating >= 7.5 ? ' good' : res.rating < 5.8 ? ' bad' : '') + '">' +
        '<span class="k">Your rating</span><b class="big-rating">' + res.rating.toFixed(1) + '</b>' +
        (motm ? '<span class="tag gold">★ Star Man</span>' : '') + '</div>';
      html += '<div class="card"><div class="statgrid">' +
        statCell('Goals', res.stats.goals) + statCell('Assists', res.stats.assists) +
        statCell('Shots', res.stats.shots) + statCell('Passes', res.stats.passes) +
        statCell('Dribbles', res.stats.dribbles) + statCell('Tackles', res.stats.tackles) +
        '</div></div>';
      if (earned) {
        html += '<div class="card earn"><span>Match earnings</span><b>+' + S.fmtMoney(earned) + '</b></div>';
      }
      if (levelUps.length) {
        var uniq = {};
        levelUps.forEach(function (k) { uniq[k] = (uniq[k] || 0) + 1; });
        html += '<div class="card levelups"><h3>Progress</h3>' + Object.keys(uniq).map(function (k) {
          var a = D.ATTRS.filter(function (x) { return x.key === k; })[0];
          return '<div class="lvl"><b>' + a.name + '</b> <span class="up">+' + uniq[k] + '</span> → ' + career.attrs[k] + '</div>';
        }).join('') + '</div>';
      }
    } else {
      html += '<div class="card"><p class="muted">You were not involved. The manager needs convincing.</p></div>';
    }

    if (res.log && res.log.length) {
      html += '<div class="card"><h3>Match report</h3><div class="list">' + res.log.slice(0, 8).map(function (l) {
        return '<div class="rep-line"><span class="rep-min">' + l.min + "'</span>" + esc(l.text) + '</div>';
      }).join('') + '</div></div>';
    }

    $('result-body').innerHTML = html;
    $('result-next').textContent = career.week > Wd.SEASON_WEEKS ? 'End of season' : 'Continue';
    show('screen-result');
    A.play(won ? 'cheer' : 'click', 1.4, 0.25);
    if (levelUps.length) setTimeout(function () { A.play('levelup'); }, 500);
    S.save();
  }

  function afterResult() {
    var career = RS.career;
    if (career.week > Wd.SEASON_WEEKS) {
      doSeasonEnd();
    } else {
      tab = 'home';
      show('screen-hub');
      renderHub();
    }
  }

  function skipWeek() {
    var career = RS.career;
    Wd.endOfWeek(career);
    if (career.week > Wd.SEASON_WEEKS) doSeasonEnd();
    else { renderHub(); toast('Week skipped.'); }
  }

  /* ---------- season end ---------- */

  function doSeasonEnd() {
    var career = RS.career;
    seasonSummary = Wd.endSeason(career);
    var s = seasonSummary;
    var html = '<div class="season-hero' + (s.champion ? ' champ' : s.promoted ? ' promo' : s.relegated ? ' releg' : '') + '">' +
      '<span class="muted">Season ' + s.season + ' • ' + esc(s.leagueName) + '</span>' +
      '<h2>' + s.position + ord(s.position) + ' place</h2>' +
      (s.awards.length ? '<div class="awards">' + s.awards.map(function (a) {
        return '<span class="tag gold">' + esc(a) + '</span>';
      }).join('') + '</div>' : '') + '</div>';

    html += '<div class="card"><h3>Your season</h3><div class="statgrid">' +
      statCell('Apps', s.apps) + statCell('Goals', s.goals) + statCell('Assists', s.assists) +
      statCell('Avg rating', s.rating || '-') + statCell('Star man', s.motm) +
      statCell('Reputation', career.reputation) + '</div></div>';

    var tier = Wd.tierOf(career.world, career.clubId);
    html += '<div class="card"><p class="muted">You are now ' + career.age + '. ' +
      (career.contract.seasonsLeft <= 1
        ? 'Your contract is up — time to decide where you play next.'
        : career.contract.seasonsLeft + ' seasons left on your deal at ' + esc(c(career).name) + '.') + '</p></div>';

    $('season-body').innerHTML = html;
    show('screen-season');
    A.play('levelup');
    S.save();
  }

  function doTransferWindow() {
    var career = RS.career;
    pendingOffers = Wd.generateOffers(career);
    var mustMove = career.contract.seasonsLeft <= 1;
    var html = '<div class="card"><h3>Transfer window</h3><p class="muted">' +
      (mustMove ? 'Your contract expires. Pick your next club.'
        : 'You have time left on your deal, but there is interest.') + '</p></div>';
    html += '<div class="list offers">' + pendingOffers.map(function (o, i) {
      var cl = D.CLUBS[o.clubId];
      return '<button class="offer" data-action="sign" data-i="' + i + '">' +
        badge(cl, 'lg') +
        '<span class="offer-main"><b>' + esc(cl.name) + (o.renewal ? ' <span class="tag">stay</span>' : '') + '</b>' +
        '<span class="muted small">' + D.LEAGUES[o.tier - 1].name + ' • ' + o.role + '</span>' +
        '<span class="offer-terms">' + S.fmtMoney(o.wage) + '/wk • ' + o.seasons + ' yrs • ' +
        S.fmtMoney(o.signOn) + ' signing fee</span></span></button>';
    }).join('') + '</div>';
    if (!mustMove) {
      html += '<button class="btn ghost big" data-action="stay">Stay and see out my contract</button>';
    }
    $('season-body').innerHTML = html;
    $('season-next').style.display = 'none';
  }

  function signOffer(i) {
    var offer = pendingOffers[i];
    Wd.signWith(RS.career, offer);
    A.play('coin');
    nextSeason();
  }

  function nextSeason() {
    var career = RS.career;
    if (career.age >= 38) { retire(); return; }
    if (career.age >= 34) {
      modal('<h3>Time to hang them up?</h3><p>You are ' + career.age +
        '. The legs are going, but the mind is sharp.</p>',
        [{ label: 'One more season', onClick: proceedNextSeason },
        { label: 'Retire', kind: 'ghost', onClick: retire }]);
      return;
    }
    proceedNextSeason();
  }

  function proceedNextSeason() {
    var career = RS.career;
    $('season-next').style.display = '';
    Wd.startNewSeason(career, seasonSummary);
    seasonSummary = null;
    pendingOffers = null;
    tab = 'home';
    show('screen-hub');
    renderHub();
    toast('Season ' + career.season + ' begins.', 'good');
  }

  function retire() {
    var career = RS.career;
    career.retired = true;
    var cs = career.career;
    var html = '<div class="season-hero champ"><span class="muted">Career complete</span>' +
      '<h2>' + esc(career.name) + '</h2><span class="muted">' + cs.seasons + ' seasons • ' +
      (cs.apps + cs.subApps) + ' appearances</span></div>' +
      '<div class="card"><div class="statgrid">' +
      statCell('Goals', cs.goals) + statCell('Assists', cs.assists) +
      statCell('Avg rating', S.avgRating(cs) || '-') + statCell('Star man', cs.motm) +
      statCell('Trophies', career.trophies.length) + statCell('Peak OVR', S.overall(career)) +
      '</div></div>';
    if (career.trophies.length) {
      html += '<div class="card"><h3>Honours</h3><div class="tiles small">' + career.trophies.map(function (t) {
        return '<div class="trophy">🏆<b>' + esc(t.name) + '</b><span class="muted small">S' + t.season + '</span></div>';
      }).join('') + '</div></div>';
    }
    html += '<div class="card"><p class="muted">Thanks for playing. Start again and go further.</p>' +
      '<button class="btn primary big" data-action="wipe">New career</button></div>';
    $('season-body').innerHTML = html;
    $('season-next').style.display = 'none';
    show('screen-season');
    S.save();
  }

  /* ---------- global click routing ---------- */

  function onClick(e) {
    var el = e.target.closest('[data-action], [data-tab], [data-pos], [data-trait], [data-club]');
    if (!el) return;
    var action = el.getAttribute('data-action');

    if (el.hasAttribute('data-tab')) {
      tab = el.getAttribute('data-tab');
      A.play('tap');
      renderHub();
      return;
    }
    if (el.hasAttribute('data-pos')) { create.pos = el.getAttribute('data-pos'); A.play('tap'); refreshPicks(); return; }
    if (el.hasAttribute('data-trait')) { create.trait = el.getAttribute('data-trait'); A.play('tap'); refreshPicks(); return; }
    if (el.hasAttribute('data-club')) { create.clubId = +el.getAttribute('data-club'); A.play('tap'); refreshPicks(); return; }

    switch (action) {
      case 'new':
        A.unlock(); A.play('click');
        if (S.hasSave()) {
          modal('<h3>Start a new career?</h3><p>Your current save will be deleted.</p>',
            [{ label: 'Yes, new career', onClick: function () { S.wipe(); renderCreate(); show('screen-create'); } },
            { label: 'Cancel', kind: 'ghost' }]);
        } else { renderCreate(); show('screen-create'); }
        break;
      case 'continue':
        A.unlock(); A.play('click');
        if (S.load()) {
          if (!RS.career.world) RS.career.world = Wd.buildWorld(RS.career, {});
          if (RS.career.retired) { retire(); return; }
          tab = 'home'; show('screen-hub'); renderHub();
        } else toast('No save found.', 'bad');
        break;
      case 'sound':
        A.setMuted(!A.isMuted());
        renderStart();
        break;
      case 'start-career': A.play('click'); doCreate(); break;
      case 'play': A.play('click'); startMatch(); break;
      case 'train': doTrain(el.getAttribute('data-attr')); break;
      case 'activity': doActivity(el.getAttribute('data-key')); break;
      case 'buy': doBuy(el.getAttribute('data-key')); break;
      case 'skip-week': A.play('click'); skipWeek(); break;
      case 'result-next': A.play('click'); afterResult(); break;
      case 'season-end': A.play('click'); doSeasonEnd(); break;
      case 'season-next': A.play('click'); doTransferWindow(); break;
      case 'sign': signOffer(+el.getAttribute('data-i')); break;
      case 'stay': A.play('click'); nextSeason(); break;
      case 'mute':
        A.setMuted(!A.isMuted());
        renderHub();
        break;
      case 'help':
        A.play('click');
        modal('<h3>How to play</h3>' +
          '<p><b>The week.</b> Three actions — train, rest, or work on the people around you — then a match. Energy pays for everything.</p>' +
          '<p><b>Shooting.</b> Swipe at the goal. Where you let go is where you aim, a faster flick means more power, and swiping in an arc bends the ball.</p>' +
          '<p><b>Passing.</b> Swipe towards a teammate — green ring means he is free.</p>' +
          '<p><b>Taking players on.</b> Swipe left or right the moment the shrinking ring hits the dashed one.</p>' +
          '<p><b>Headers, crosses, tackles.</b> Tap when the marker is in the green.</p>' +
          '<p class="muted">Your match rating drives game time, contracts and transfers. Miss too much and the manager drops you.</p>',
          [{ label: 'Got it' }]);
        break;
      case 'retire':
        modal('<h3>Retire now?</h3><p>Your career ends here and the story is written.</p>',
          [{ label: 'Retire', onClick: retire }, { label: 'Keep playing', kind: 'ghost' }]);
        break;
      case 'wipe':
        modal('<h3>Delete this career?</h3><p>Everything goes. No way back.</p>',
          [{
            label: 'Delete', onClick: function () {
              S.wipe(); RS.career = null; renderStart(); show('screen-start');
            }
          }, { label: 'Cancel', kind: 'ghost' }]);
        break;
      case 'quit-match':
        modal('<h3>Leave the match?</h3><p>The result will be simulated without you.</p>',
          [{
            label: 'Leave', onClick: function () {
              RS.Match.abort();
              var career = RS.career;
              var fx = Wd.fixtureForWeek(career, career.week);
              var sc = Wd.simScore(career.world, fx.home, fx.away, Math.random);
              showResult({
                fixture: fx, home: fx.home, away: fx.away, hg: sc[0], ag: sc[1],
                myGoals: fx.isHome ? sc[0] : sc[1], theirGoals: fx.isHome ? sc[1] : sc[0],
                rating: 0, played: false,
                stats: { shots: 0, onTarget: 0, goals: 0, assists: 0, passes: 0, tackles: 0, dribbles: 0 },
                xp: {}, energyLeft: career.energy, cards: 0, log: []
              });
            }
          }, { label: 'Stay', kind: 'ghost' }]);
        break;
    }
  }

  function refreshPicks() {
    ['pos', 'trait', 'club'].forEach(function (kind) {
      var nodes = document.querySelectorAll('[data-' + kind + ']');
      for (var i = 0; i < nodes.length; i++) {
        var v = nodes[i].getAttribute('data-' + kind);
        var cur = kind === 'club' ? String(create.clubId) : create[kind];
        nodes[i].classList.toggle('on', v === cur);
      }
    });
  }

  /* ---------- boot ---------- */

  function boot() {
    document.addEventListener('click', onClick);
    renderStart();
    show('screen-start');
    // keep the canvas sized when the match screen becomes visible
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { RS.Match.resize(); }, 250);
    });
  }

  RS.UI = { boot: boot, renderHub: renderHub, toast: toast, show: show };
})(window.RS = window.RS || {});
