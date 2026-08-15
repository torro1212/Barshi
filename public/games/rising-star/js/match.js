/* Rising Star — interactive match engine (canvas, 2.5D perspective) */
(function (RS) {
  'use strict';

  var D = RS.Data;
  var S = RS.State;
  var A = RS.Audio;

  var M = null;
  var canvas = null, ctx = null, W = 0, H = 0, dpr = 1, raf = 0, lastTs = 0;
  var els = {};

  /* ================= camera ================= */

  // Pinhole camera with yaw. World: x = across the pitch, y = distance from the
  // attacking goal line, z = height. The camera always sits behind the action.
  function makeCam(cfg) {
    var cam = {
      x: cfg.x || 0,
      y: cfg.y,
      z: cfg.z,
      yaw: cfg.yaw || 0,
      focal: cfg.focal,
      horizon: cfg.horizon
    };
    var sy_ = Math.sin(cam.yaw), cy_ = Math.cos(cam.yaw);
    cam.project = function (x, y, z) {
      var dx = x - cam.x, dw = cam.y - y;
      var fwd = dx * sy_ + dw * cy_;
      if (fwd < 1.2) fwd = 1.2;
      var side = dx * cy_ - dw * sy_;
      var s = cam.focal / fwd;
      return { x: W / 2 + side * s, y: cam.horizon - (z - cam.z) * s, s: s, depth: fwd };
    };
    // screen point -> point on the goal plane (y = 0)
    cam.unprojectGoal = function (sx, sy) {
      var u = sx - W / 2;
      var denom = u * sy_ - cam.focal * cy_;
      if (Math.abs(denom) < 1e-6) denom = -1e-6;
      var dx = -cam.y * (cam.focal * sy_ + u * cy_) / denom;
      var fwd = dx * sy_ + cam.y * cy_;
      if (fwd < 1.2) fwd = 1.2;
      var s = cam.focal / fwd;
      return { x: cam.x + dx, z: cam.z - (sy - cam.horizon) / s };
    };
    // screen point -> point on the ground plane (z = 0)
    cam.unprojectGround = function (sx, sy) {
      var dy = sy - cam.horizon;
      if (dy < 6) dy = 6;
      var s = dy / cam.z;
      var fwd = cam.focal / s;
      var side = (sx - W / 2) / s;
      return { x: cam.x + fwd * sy_ + side * cy_, y: cam.y - (fwd * cy_ - side * sy_) };
    };
    return cam;
  }

  // Behind-the-striker camera: sits on the ball->goal line (nudged to one side)
  // and looks at the goal, so both the ball and the goal always frame up.
  function goalCam(ballY, ballX, opts) {
    opts = opts || {};
    var dist = Math.hypot(ballX, ballY) || 1;
    var ux = ballX / dist, uy = ballY / dist;
    var back = opts.back || 9, off = opts.off == null ? 2.2 : opts.off;
    var cx = ballX + ux * back - uy * off;
    var cy = Math.max(3, ballY + uy * back + ux * off);
    return makeCam({
      x: cx, y: cy, z: 3.6,
      yaw: Math.atan2(-cx, cy),
      focal: H * (opts.focal || 0.85),
      horizon: H * 0.20
    });
  }

  // High wide camera looking straight up the pitch towards the goal.
  function wideCam(centerY, centerX) {
    return makeCam({
      x: S.clamp((centerX || 0) * 0.7, -24, 24),
      y: centerY + 24,
      z: 13,
      yaw: 0,
      focal: H * 0.95,
      horizon: H * 0.12
    });
  }

  /* ================= drawing ================= */

  var crowdDots = null;
  function buildCrowd() {
    var rng = S.mulberry32(1234);
    crowdDots = [];
    for (var i = 0; i < 520; i++) {
      crowdDots.push({ x: rng(), y: rng(), r: 0.6 + rng() * 1.4, c: rng() });
    }
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = S.clamp(((n >> 16) & 255) + amt, 0, 255);
    var g = S.clamp(((n >> 8) & 255) + amt, 0, 255);
    var b = S.clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawStands(cam, farY) {
    // the far edge of the drawn pitch is where the stand begins
    var gl = cam.project(cam.x, farY == null ? -12 : farY, 0).y;
    var roof = Math.max(0, gl - H * 0.34);
    var g = ctx.createLinearGradient(0, roof, 0, gl);
    g.addColorStop(0, '#080d17');
    g.addColorStop(0.25, '#141c2c');
    g.addColorStop(1, '#1b2434');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, gl);
    // roof shadow + floodlight glow
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, W, roof);
    var fl = ctx.createRadialGradient(W * 0.22, roof, 2, W * 0.22, roof, H * 0.28);
    fl.addColorStop(0, 'rgba(191,219,254,0.30)');
    fl.addColorStop(1, 'rgba(191,219,254,0)');
    ctx.fillStyle = fl;
    ctx.fillRect(0, roof - H * 0.1, W, H * 0.4);
    var fl2 = ctx.createRadialGradient(W * 0.80, roof, 2, W * 0.80, roof, H * 0.28);
    fl2.addColorStop(0, 'rgba(191,219,254,0.24)');
    fl2.addColorStop(1, 'rgba(191,219,254,0)');
    ctx.fillStyle = fl2;
    ctx.fillRect(0, roof - H * 0.1, W, H * 0.4);

    if (!crowdDots) buildCrowd();
    var band = gl - roof;
    var t = (M ? M.time : 0);
    for (var i = 0; i < crowdDots.length; i++) {
      var d = crowdDots[i];
      var cx = d.x * W;
      var yy = d.y;
      var cy = roof + (0.10 + yy * 0.82) * band;
      var flick = Math.sin(t * 2.2 + i * 1.7) * 0.5 + 0.5;
      var alpha = (0.18 + flick * 0.30) * (0.5 + yy * 0.7);
      ctx.fillStyle = d.c < 0.35 ? 'rgba(226,232,240,' + alpha + ')'
        : d.c < 0.7 ? 'rgba(253,224,148,' + alpha * 0.85 + ')'
          : 'rgba(147,197,253,' + alpha * 0.8 + ')';
      ctx.beginPath();
      ctx.arc(cx, cy, d.r * (0.6 + yy * 0.8), 0, 6.283);
      ctx.fill();
    }
    // tier separators
    ctx.fillStyle = 'rgba(2,6,12,0.75)';
    ctx.fillRect(0, roof + band * 0.42, W, Math.max(2, band * 0.035));
    ctx.fillRect(0, roof + band * 0.76, W, Math.max(2, band * 0.03));
    // advertising hoarding at pitch level
    var hh = Math.max(9, H * 0.026);
    ctx.fillStyle = '#0a1120';
    ctx.fillRect(0, gl - hh, W, hh);
    for (var b = 0; b < 7; b++) {
      ctx.fillStyle = b % 2 ? 'rgba(96,165,250,0.30)' : 'rgba(61,220,132,0.22)';
      ctx.fillRect(b * (W / 7) + 5, gl - hh + 3, W / 7 - 10, hh - 6);
    }
  }

  function drawGrass(cam, farY, nearY) {
    var step = 4;
    for (var y = farY; y < nearY; y += step) {
      var p1 = cam.project(cam.x, y, 0);
      var p2 = cam.project(cam.x, Math.min(nearY, y + step), 0);
      var band = Math.floor(y / step) % 2 === 0;
      ctx.fillStyle = band ? '#1f7a3d' : '#1b6d36';
      ctx.beginPath();
      ctx.moveTo(0, p1.y);
      ctx.lineTo(W, p1.y);
      ctx.lineTo(W, p2.y);
      ctx.lineTo(0, p2.y);
      ctx.closePath();
      ctx.fill();
    }
    // vignette darkening far away
    var gl = cam.project(cam.x, farY, 0).y;
    var g = ctx.createLinearGradient(0, gl, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0.28)');
    g.addColorStop(0.35, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, gl, W, H - gl);
  }

  function line(cam, x1, y1, x2, y2, wpx) {
    var a = cam.project(x1, y1, 0), b = cam.project(x2, y2, 0);
    ctx.lineWidth = wpx || Math.max(1.5, (a.s + b.s) * 0.045);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function drawMarkings(cam) {
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    line(cam, -34, 0, 34, 0);            // goal line
    line(cam, -20.16, 16.5, 20.16, 16.5); // box edge
    line(cam, -20.16, 0, -20.16, 16.5);
    line(cam, 20.16, 0, 20.16, 16.5);
    line(cam, -9.16, 5.5, 9.16, 5.5);
    line(cam, -9.16, 0, -9.16, 5.5);
    line(cam, 9.16, 0, 9.16, 5.5);
    // penalty spot
    var ps = cam.project(0, 11, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(ps.x, ps.y, Math.max(1.5, ps.s * 0.09), 0, 6.283); ctx.fill();
    // D arc
    ctx.beginPath();
    for (var a = -1.0; a <= 1.0; a += 0.08) {
      var px = Math.sin(a) * 9.15, py = 11 + Math.cos(a) * 9.15;
      if (py < 16.5) continue;
      var p = cam.project(px, py, 0);
      if (a === -1.0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  function drawGoal(cam, netFlash) {
    var postX = 3.66, barZ = 2.44;
    var tl = cam.project(-postX, 0, barZ), tr = cam.project(postX, 0, barZ);
    var bl = cam.project(-postX, 0, 0), br = cam.project(postX, 0, 0);
    // net (behind)
    var backY = -1.9;
    var ntl = cam.project(-postX, backY, barZ * 0.86), ntr = cam.project(postX, backY, barZ * 0.86);
    var nbl = cam.project(-postX - 0.4, backY, 0), nbr = cam.project(postX + 0.4, backY, 0);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fillStyle = netFlash ? 'rgba(255,255,255,0.22)' : 'rgba(10,20,16,0.34)';
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,' + (netFlash ? 0.55 : 0.28) + ')';
    ctx.lineWidth = 1;
    var cols = 14, rows = 8;
    for (var i = 0; i <= cols; i++) {
      var t = i / cols;
      var ax = tl.x + (tr.x - tl.x) * t, ay = tl.y + (tr.y - tl.y) * t;
      var bx = ntl.x + (ntr.x - ntl.x) * t, by = ntl.y + (ntr.y - ntl.y) * t;
      var cx2 = nbl.x + (nbr.x - nbl.x) * t, cy2 = nbl.y + (nbr.y - nbl.y) * t;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx2, cy2); ctx.stroke();
    }
    for (var j = 0; j <= rows; j++) {
      var tt = j / rows;
      var x1 = ntl.x + (nbl.x - ntl.x) * tt, y1 = ntl.y + (nbl.y - ntl.y) * tt;
      var x2 = ntr.x + (nbr.x - ntr.x) * tt, y2 = ntr.y + (nbr.y - ntr.y) * tt;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
    // frame
    var lw = Math.max(2.5, tl.s * 0.11);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y); ctx.lineTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y);
    ctx.stroke();
  }

  function drawShadow(cam, x, y, z, size) {
    var p = cam.project(x, y, 0);
    var fade = S.clamp(1 - z / 6, 0.15, 1);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.30 * fade) + ')';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, size * p.s * (1 + z * 0.06), size * p.s * 0.38, 0, 0, 6.283);
    ctx.fill();
  }

  function drawBall(cam, x, y, z, spin) {
    drawShadow(cam, x, y, z, 0.22);
    var p = cam.project(x, y, z);
    var r = Math.max(2.2, 0.115 * p.s);
    var g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#c8cfd8');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(20,26,34,0.85)';
    var a = (spin || 0);
    for (var i = 0; i < 3; i++) {
      var ang = a + i * 2.094;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(ang) * r * 0.42, p.y + Math.sin(ang) * r * 0.42, r * 0.22, 0, 6.283);
      ctx.fill();
    }
    return p;
  }

  function drawPerson(cam, x, y, opt) {
    opt = opt || {};
    var h = opt.height || 1.82;
    var base = cam.project(x, y, 0);
    var head = cam.project(x, y, h);
    var px = base.x, py = base.y;
    var ph = py - head.y;
    if (ph < 6) ph = 6;
    var wBody = ph * 0.34;
    drawShadow(cam, x, y, 0, 0.42);
    var lean = opt.lean || 0;
    var swing = opt.anim ? Math.sin(opt.anim) : 0;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(lean);
    // legs
    ctx.strokeStyle = opt.shorts || '#f8fafc';
    ctx.lineWidth = Math.max(2, wBody * 0.30);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -ph * 0.44);
    ctx.lineTo(-wBody * 0.28 + swing * wBody * 0.5, 0);
    ctx.moveTo(0, -ph * 0.44);
    ctx.lineTo(wBody * 0.28 - swing * wBody * 0.5, 0);
    ctx.stroke();
    // body
    ctx.fillStyle = opt.shirt || '#e11d48';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-wBody / 2, -ph * 0.82, wBody, ph * 0.42, wBody * 0.25);
    } else {
      ctx.rect(-wBody / 2, -ph * 0.82, wBody, ph * 0.42);
    }
    ctx.fill();
    // arms
    ctx.strokeStyle = opt.skin || '#c68642';
    ctx.lineWidth = Math.max(1.6, wBody * 0.2);
    ctx.beginPath();
    ctx.moveTo(-wBody * 0.42, -ph * 0.78);
    ctx.lineTo(-wBody * (0.75 + (opt.armSpread || 0)), -ph * (0.5 - (opt.armLift || 0)));
    ctx.moveTo(wBody * 0.42, -ph * 0.78);
    ctx.lineTo(wBody * (0.75 + (opt.armSpread || 0)), -ph * (0.5 - (opt.armLift || 0)));
    ctx.stroke();
    // head
    ctx.fillStyle = opt.skin || '#c68642';
    ctx.beginPath();
    ctx.arc(0, -ph * 0.90, ph * 0.10, 0, 6.283);
    ctx.fill();
    ctx.restore();
    if (opt.label) {
      var fs = S.clamp(ph * 0.13, 8, 11);
      ctx.font = '600 ' + fs.toFixed(1) + 'px Inter, system-ui, sans-serif';
      var tw = ctx.measureText(opt.label).width;
      ctx.fillStyle = 'rgba(6,10,16,0.62)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(px - tw / 2 - 4, py + 3, tw + 8, fs + 5, 4);
        ctx.fill();
      } else {
        ctx.fillRect(px - tw / 2 - 4, py + 3, tw + 8, fs + 5);
      }
      ctx.fillStyle = opt.mine ? '#7dd3fc' : '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(opt.label, px, py + 5);
    }
    return base;
  }

  function drawKeeper(cam, k) {
    drawPerson(cam, k.x, k.y, {
      shirt: '#f59e0b', shorts: '#111827', skin: '#e0b48a',
      height: 1.9, lean: k.lean || 0, armSpread: 0.6, armLift: k.dive ? 0.5 : 0.15,
      anim: k.anim || 0
    });
  }

  /* ================= UI helpers ================= */

  function setOverlay(title, sub, kind) {
    els.title.textContent = title || '';
    els.sub.innerHTML = sub || '';
    els.overlay.className = 'mt-overlay' + (title || sub ? ' show' : '') + (kind ? ' ' + kind : '');
  }

  function flash(text, kind) {
    els.flash.textContent = text;
    els.flash.className = 'mt-flash show ' + (kind || '');
    setTimeout(function () { els.flash.className = 'mt-flash'; }, 1300);
  }

  function log(text) {
    M.log.unshift({ min: M.minute, text: text });
    if (M.log.length > 30) M.log.pop();
    els.ticker.textContent = M.minute + "' " + text;
    els.ticker.classList.remove('pulse');
    void els.ticker.offsetWidth;
    els.ticker.classList.add('pulse');
  }

  function updateHud() {
    els.score.textContent = M.score[0] + ' - ' + M.score[1];
    els.clock.textContent = M.minute + "'";
    els.rating.textContent = S.round1(M.rating).toFixed(1);
    els.rating.className = 'mt-rating ' + (M.rating >= 7.5 ? 'good' : M.rating < 5.8 ? 'bad' : '');
    var e = S.clamp(M.energy, 0, 100);
    els.energyFill.style.width = e + '%';
    els.energyFill.className = 'mt-energy-fill' + (e < 25 ? ' low' : '');
  }

  /* ================= match construction ================= */

  function poisson(lambda, rng) {
    var L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L && k < 12);
    return k - 1;
  }

  function opponentKeeperSkill() {
    var sq = S.makeSquad(M.themId, M.career.season);
    var gk = sq.filter(function (p) { return p.pos === 'GK'; })[0];
    return gk ? gk.rating : RS.World.clubStrength(M.career.world, M.themId);
  }

  function bestMate() {
    var mates = M.career.squad.filter(function (p) { return p.pos !== 'GK'; });
    return mates[Math.floor(Math.random() * Math.min(6, mates.length))] || { name: 'a teammate', rating: 50 };
  }

  function buildTimeline(career, fixture, playing, onFrom) {
    var rng = S.mulberry32((career.season * 733 + career.week * 97 + Date.now()) & 0xffffffff);
    var world = career.world;
    var usStr = RS.World.clubStrength(world, career.clubId) + (fixture.isHome ? 5 : 0);
    var themStr = RS.World.clubStrength(world, fixture.opponent) + (fixture.isHome ? 0 : 5);
    var tot = usStr + themStr;
    var lamUs = (0.45 + 2.0 * (usStr / tot)) * (playing ? 0.72 : 1.0);
    var lamThem = 0.45 + 2.1 * (themStr / tot);

    var events = [];
    var gUs = poisson(lamUs, rng);
    var gThem = poisson(lamThem, rng);
    var i, m;
    for (i = 0; i < gUs; i++) {
      events.push({ min: 3 + Math.floor(rng() * 86), kind: 'goalUs' });
    }
    for (i = 0; i < gThem; i++) {
      events.push({ min: 3 + Math.floor(rng() * 86), kind: 'goalThem' });
    }

    if (playing) {
      var att = career.attrs;
      var invBase = career.pos === 'ST' ? 5.2 : career.pos === 'W' ? 5.4 : career.pos === 'AM' ? 5.6 : 5.0;
      var inv = invBase + (att.pace + att.dribbling + att.passing) / 90 +
        (career.rel.team - 50) / 26 + (RS.World.formAvg(career) - 6.4) * 0.5;
      inv = S.clamp(Math.round(inv + rng() * 1.6), 3, 9);
      if (onFrom > 0) inv = Math.max(2, Math.round(inv * (90 - onFrom) / 90));
      var slots = [];
      var span = 90 - (onFrom || 0) - 6;
      for (i = 0; i < inv; i++) {
        m = (onFrom || 0) + 5 + Math.floor(span * (i + 0.35 + rng() * 0.3) / inv);
        slots.push(S.clamp(m, (onFrom || 1) + 2, 89));
      }
      slots.forEach(function (mm) {
        events.push({ min: mm, kind: 'scenario' });
      });
    }
    events.sort(function (a, b) { return a.min - b.min; });
    // avoid collisions
    for (i = 1; i < events.length; i++) {
      if (events[i].min <= events[i - 1].min) events[i].min = events[i - 1].min + 1;
    }
    return events.filter(function (e) { return e.min < 90; });
  }

  function pickScenarioKind(career, rng) {
    var r = rng();
    var pos = career.pos;
    var pool;
    if (pos === 'ST') pool = [['shot', 0.40], ['header', 0.16], ['pass', 0.16], ['dribble', 0.16], ['tackle', 0.04], ['freekick', 0.05], ['penalty', 0.03]];
    else if (pos === 'W') pool = [['dribble', 0.30], ['shot', 0.24], ['cross', 0.18], ['pass', 0.14], ['freekick', 0.06], ['tackle', 0.05], ['penalty', 0.03]];
    else if (pos === 'AM') pool = [['pass', 0.30], ['shot', 0.22], ['freekick', 0.14], ['dribble', 0.16], ['cross', 0.08], ['tackle', 0.07], ['penalty', 0.03]];
    else pool = [['pass', 0.28], ['tackle', 0.24], ['shot', 0.18], ['dribble', 0.14], ['freekick', 0.08], ['header', 0.06], ['penalty', 0.02]];
    var acc = 0;
    for (var i = 0; i < pool.length; i++) {
      acc += pool[i][1];
      if (r <= acc) return pool[i][0];
    }
    return 'shot';
  }

  /* ================= scenarios ================= */

  function attr(k) { return M.career.attrs[k]; }

  function pressureFactor() {
    var comp = attr('composure');
    var fatigue = S.clamp((60 - M.energy) / 60, 0, 1);
    return S.clamp(1.25 - comp / 160 + fatigue * 0.35, 0.55, 1.7);
  }

  function scenarioTime(base) {
    return base * (0.85 + attr('composure') / 260);
  }

  // ---- shared swipe tracking ----
  function trackReset(sc) {
    sc.pts = [];
    sc.dragging = false;
  }
  function trackPush(sc, x, y) {
    sc.pts.push({ x: x, y: y, t: performance.now() });
    if (sc.pts.length > 40) sc.pts.shift();
  }
  function swipeStats(sc) {
    var pts = sc.pts;
    if (pts.length < 2) return null;
    var a = pts[0], b = pts[pts.length - 1];
    var i = pts.length - 1;
    while (i > 0 && b.t - pts[i].t < 90) i--;
    var ref = pts[i];
    var dt = Math.max(16, b.t - ref.t);
    var speed = Math.hypot(b.x - ref.x, b.y - ref.y) / dt * 1000; // px/s
    // curvature: deviation of mid point from chord
    var mid = pts[Math.floor(pts.length / 2)];
    var vx = b.x - a.x, vy = b.y - a.y;
    var len = Math.hypot(vx, vy) || 1;
    var cross = ((mid.x - a.x) * vy - (mid.y - a.y) * vx) / len;
    return { start: a, end: b, speed: speed, len: len, curve: cross / Math.max(40, len) };
  }

  // Power comes mostly from how fast you flick, but a long deliberate drag still
  // carries weight — so careful aimers are not punished with a tap shot.
  function gesturePower(st) {
    if (!st) return 0.4;
    var speedF = S.clamp((st.speed - 240) / 2000, 0, 1);
    var lenF = S.clamp(st.len / (H * 0.55), 0, 1);
    return S.clamp(0.30 + speedF * 0.62 + lenF * 0.26, 0.15, 1);
  }

  /* ---------- SHOT / FREE KICK / PENALTY ---------- */

  function initShot(kind) {
    var rng = Math.random;
    var sc = { kind: kind, phase: 'aim', t: 0, pts: [], flight: null, keeper: null };
    var pos = M.career.pos;
    if (kind === 'penalty') {
      sc.bx = 0; sc.by = 11;
      sc.defenders = [];
    } else if (kind === 'freekick') {
      sc.bx = (rng() - 0.5) * 22;
      sc.by = 19 + rng() * 8;
      sc.defenders = [];
      // a four-man wall, 9.15m from the ball on the line to goal
      for (var i = 0; i < 4; i++) {
        var offset = (i - 1.5) * 0.75;
        var t = 9.15 / Math.hypot(sc.bx, sc.by);
        var px = sc.bx + (0 - sc.bx) * t + offset;
        var py = sc.by + (0 - sc.by) * t;
        sc.defenders.push({ x: px, y: Math.max(6.5, py), wall: true });
      }
    } else {
      sc.bx = (rng() - 0.5) * (pos === 'W' ? 34 : 22);
      sc.by = 9 + rng() * (pos === 'ST' ? 8 : 14);
      sc.defenders = [];
      var nd = rng() < 0.65 ? 1 : 2;
      for (var j = 0; j < nd; j++) {
        sc.defenders.push({
          x: sc.bx * 0.55 + (rng() - 0.5) * 10,
          y: Math.max(3.5, sc.by - 3 - rng() * 4),
          vx: (rng() - 0.5) * 1.4
        });
      }
    }
    sc.keeper = {
      x: sc.bx * 0.16 + (Math.random() - 0.5) * 0.6,
      y: 0.45, dive: 0, anim: 0, lean: 0, skill: opponentKeeperSkill()
    };
    sc.cam = goalCam(sc.by, sc.bx);
    sc.timeLimit = scenarioTime(kind === 'penalty' ? 8 : kind === 'freekick' ? 8 : 4.6);
    sc.timeLeft = sc.timeLimit;
    sc.dist = Math.hypot(sc.bx, sc.by);
    M.scenario = sc;

    var titles = { shot: 'SHOOT!', freekick: 'FREE KICK', penalty: 'PENALTY' };
    var subs = {
      shot: 'Swipe at the goal — <b>flick fast for power</b>, curve your swipe to bend it',
      freekick: 'Bend it over the wall — swipe in an arc',
      penalty: 'Pick your corner and swipe'
    };
    setOverlay(titles[kind], subs[kind], 'act');
    A.play('whistle');
  }

  function shotSolve(sc, targetX, targetZ, power, curve) {
    var dist = Math.hypot(sc.bx - targetX, sc.by);
    var speed = 15 + 17 * power + attr('shooting') * 0.06;
    var T = Math.max(0.28, dist / speed);
    var ax = curve * 46;
    var g = 9.81;
    return {
      x: sc.bx, y: sc.by, z: 0.12,
      vx: (targetX - sc.bx) / T - 0.5 * ax * T,
      vy: (0 - sc.by) / T,
      vz: (targetZ - 0.12) / T + 0.5 * g * T,
      ax: ax, T: T, spin: 0, t: 0,
      targetX: targetX, targetZ: targetZ, power: power
    };
  }

  function releaseShot(sc, sx, sy) {
    var st = swipeStats(sc);
    if (!st) return;
    var aim = sc.cam.unprojectGoal(sx, sy);
    var power = gesturePower(st);
    // aim error
    var acc = sc.kind === 'penalty' || sc.kind === 'freekick'
      ? (attr('setPieces') * 0.6 + attr('shooting') * 0.4)
      : attr('shooting') * 0.72 + attr('technique') * 0.28;
    var err = (1.15 - acc / 105) * pressureFactor() * (0.55 + power * 0.8);
    if (sc.kind === 'penalty') err *= 0.55;
    var tx = aim.x + (Math.random() - 0.5) * err * 3.0;
    var tz = S.clamp(aim.z + (Math.random() - 0.5) * err * 2.0, -0.4, 5.5);
    var maxCurve = 0.35 + attr('technique') / 150 + (sc.kind === 'freekick' ? attr('setPieces') / 190 : 0);
    var curve = S.clamp(st.curve, -maxCurve, maxCurve);
    sc.flight = shotSolve(sc, tx, tz, power, curve);
    sc.aimMark = { x: tx, z: tz };
    sc.phase = 'flight';
    sc.result = null;
    sc.trail = [];
    // keeper decision
    var k = sc.keeper;
    var kskill = k.skill;
    var reactErr = (1 - kskill / 120) * 4.2 + Math.abs(curve) * 5.5 + sc.flight.power * 1.4;
    k.guess = tx + (Math.random() - 0.5) * reactErr;
    k.reaction = S.clamp(0.30 - kskill / 700, 0.10, 0.30);
    k.startX = k.x;
    A.play('kick');
    setOverlay('', '');
    M.stats.shots++;
  }

  function updateShotFlight(sc, dt) {
    var f = sc.flight;
    var steps = 3;
    for (var i = 0; i < steps; i++) {
      var h = dt / steps;
      f.vz -= 9.81 * h;
      f.vx += f.ax * h;
      f.x += f.vx * h;
      f.y += f.vy * h;
      f.z += f.vz * h;
      f.t += h;
      f.spin += h * 14 * (1 + f.power);
      if (f.z < 0.11) { f.z = 0.11; f.vz = Math.abs(f.vz) * 0.42; }

      // keeper movement
      var k = sc.keeper;
      if (f.t > k.reaction) {
        var prog = S.clamp((f.t - k.reaction) / 0.42, 0, 1);
        k.x = k.startX + (k.guess - k.startX) * prog;
        k.dive = prog;
        k.lean = S.clamp((k.guess - k.startX) * 0.12, -0.9, 0.9) * prog;
      }

      // defender block check
      for (var d = 0; d < sc.defenders.length; d++) {
        var df = sc.defenders[d];
        if (!df.blocked && f.y <= df.y + 0.35 && f.y >= df.y - 0.6) {
          var hw = df.wall ? 0.55 : 0.62;
          var hh = df.wall ? 2.0 : 1.95;
          if (Math.abs(f.x - df.x) < hw && f.z < hh) {
            df.blocked = true;
            return finishShot(sc, 'blocked');
          }
        }
      }

      if (f.y <= 0.05) {
        // crossing the goal line plane
        var crossX = f.x, crossZ = f.z;
        if (Math.abs(crossX) > 3.66 + 0.12 || crossZ > 2.56 || crossZ < 0) {
          return finishShot(sc, 'wide', crossX, crossZ);
        }
        if (Math.abs(Math.abs(crossX) - 3.66) < 0.14 || Math.abs(crossZ - 2.44) < 0.12) {
          return finishShot(sc, 'post', crossX, crossZ);
        }
        var k2 = sc.keeper;
        var reach = 1.05 + k2.skill / 65;
        var travel = Math.min(1, Math.max(0, (f.t - k2.reaction) / 0.42));
        var kx = k2.startX + (k2.guess - k2.startX) * travel;
        var dx = Math.abs(crossX - kx);
        var zPenalty = crossZ < 0.45 ? 0.78 : crossZ > 1.85 ? 0.72 : 1.0;
        if (dx < reach * zPenalty * S.clamp(travel + 0.35, 0.35, 1)) {
          return finishShot(sc, 'save', crossX, crossZ);
        }
        return finishShot(sc, 'goal', crossX, crossZ);
      }
      if (f.t > 4) return finishShot(sc, 'wide', f.x, f.z);
    }
    sc.trail.push({ x: f.x, y: f.y, z: f.z });
    if (sc.trail.length > 22) sc.trail.shift();
  }

  function finishShot(sc, outcome, cx, cz) {
    sc.phase = 'done';
    sc.result = outcome;
    sc.crossX = cx; sc.crossZ = cz;
    var kindName = sc.kind === 'penalty' ? 'penalty' : sc.kind === 'freekick' ? 'free kick' : 'shot';
    var res = { xp: {}, energy: 3 };
    if (sc.kind === 'penalty' || sc.kind === 'freekick') res.xp.setPieces = 7;
    res.xp.shooting = 6;

    switch (outcome) {
      case 'goal':
        sc.netFlash = 1;
        A.play('goal');
        res.goal = true;
        res.rating = sc.kind === 'freekick' ? 1.5 : sc.kind === 'penalty' ? 1.05 : (sc.dist > 22 ? 1.55 : 1.3);
        res.text = 'GOAL!';
        res.detail = sc.kind === 'freekick' ? 'You bend the free kick past the wall and in!'
          : sc.kind === 'penalty' ? 'Cool as you like from the spot.'
            : 'You smash it past the keeper!';
        res.xp.shooting = 14; res.xp.composure = 6;
        break;
      case 'save':
        A.play('save');
        res.rating = 0.18;
        res.text = 'SAVED';
        res.detail = 'The keeper gets a strong hand to it.';
        res.onTarget = true;
        res.xp.shooting = 8;
        break;
      case 'post':
        A.play('post');
        res.rating = 0.1;
        res.text = 'OFF THE WOODWORK!';
        res.detail = 'Inches away — it rattles the frame.';
        res.onTarget = true;
        res.xp.shooting = 9;
        break;
      case 'blocked':
        A.play('tackle');
        res.rating = -0.12;
        res.text = 'BLOCKED';
        res.detail = 'A defender throws himself in the way.';
        res.xp.shooting = 4;
        break;
      case 'timeout':
        A.play('fail');
        res.rating = -0.35;
        res.text = 'TOO SLOW';
        res.detail = 'You dithered and the chance was gone.';
        res.xp.composure = 5;
        break;
      default:
        A.play('miss');
        res.rating = -0.3;
        res.text = 'OFF TARGET';
        res.detail = 'It sails past the ' + (Math.abs(cx || 9) > 3.66 ? 'post' : 'bar') + '.';
        res.xp.shooting = 5;
        break;
    }
    res.label = kindName;
    sc.pending = res;
    sc.holdT = 0;
    return res;
  }

  function drawShotScene(sc) {
    var cam = sc.cam;
    drawStands(cam, -14);
    drawGrass(cam, -14, sc.by + 12);
    drawMarkings(cam);
    drawGoal(cam, sc.netFlash > 0);
    if (sc.netFlash > 0) sc.netFlash -= 0.02;

    drawKeeper(cam, sc.keeper);
    sc.defenders.forEach(function (d) {
      drawPerson(cam, d.x, d.y, {
        shirt: D.CLUBS[M.themId].c1, shorts: D.CLUBS[M.themId].c2,
        armLift: d.wall ? 0.35 : 0, anim: M.time * 4 + d.x
      });
    });

    // shooter — stands just behind the ball on the ball-to-goal line
    if (sc.phase === 'aim' || sc.phase === 'flight') {
      var stepBack = sc.phase === 'aim' ? 1.5 : 1.0;
      var sd = Math.hypot(sc.bx, sc.by) || 1;
      drawPerson(cam, sc.bx + (sc.bx / sd) * stepBack - 0.5, sc.by + (sc.by / sd) * stepBack, {
        shirt: D.CLUBS[M.career.clubId].c1, shorts: D.CLUBS[M.career.clubId].c2,
        anim: sc.phase === 'flight' ? 2.2 : Math.sin(M.time * 3) * 0.6,
        label: M.career.last, mine: true
      });
    }

    // aim preview
    if (sc.phase === 'aim' && sc.dragging) {
      var st = swipeStats(sc);
      var last = sc.pts[sc.pts.length - 1];
      var aim = cam.unprojectGoal(last.x, last.y);
      var power = gesturePower(st);
      var curve = st ? S.clamp(st.curve, -0.5, 0.5) : 0;
      // trajectory preview
      var prev = shotSolve(sc, aim.x, aim.z, Math.max(0.35, power), curve);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      var px = prev.x, py = prev.y, pz = prev.z, vx = prev.vx, vy = prev.vy, vz = prev.vz;
      for (var i = 0; i < 60; i++) {
        var h = 0.02;
        vz -= 9.81 * h; vx += prev.ax * h;
        px += vx * h; py += vy * h; pz += vz * h;
        if (py < 0) break;
        var p = cam.project(px, py, Math.max(0.05, pz));
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // reticle
      var rp = cam.project(aim.x, 0, aim.z);
      var inGoal = Math.abs(aim.x) < 3.66 && aim.z < 2.44 && aim.z > 0;
      ctx.strokeStyle = inGoal ? '#4ade80' : '#f87171';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(rp.x, rp.y, 15, 0, 6.283); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rp.x - 22, rp.y); ctx.lineTo(rp.x - 8, rp.y);
      ctx.moveTo(rp.x + 8, rp.y); ctx.lineTo(rp.x + 22, rp.y); ctx.stroke();
      // power bar
      drawPowerBar(power);
      // swipe path
      ctx.strokeStyle = 'rgba(96,165,250,0.75)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      sc.pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
    }

    if (sc.phase === 'flight' || (sc.phase === 'done' && sc.flight)) {
      var f = sc.flight;
      if (sc.trail) {
        for (var t = 0; t < sc.trail.length; t++) {
          var tp = sc.trail[t];
          var pp = cam.project(tp.x, tp.y, tp.z);
          ctx.fillStyle = 'rgba(255,255,255,' + (t / sc.trail.length) * 0.28 + ')';
          ctx.beginPath(); ctx.arc(pp.x, pp.y, Math.max(1, 0.09 * pp.s), 0, 6.283); ctx.fill();
        }
      }
      drawBall(cam, f.x, f.y, f.z, f.spin);
    } else if (sc.phase === 'aim') {
      drawBall(cam, sc.bx, sc.by, 0.12, 0);
    }
  }

  function drawPowerBar(power) {
    var w = W * 0.5, h = 10, x = W / 2 - w / 2, y = H - 26;
    ctx.fillStyle = 'rgba(8,12,20,0.65)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); }
    else ctx.fillRect(x, y, w, h);
    var g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#38bdf8'); g.addColorStop(0.6, '#facc15'); g.addColorStop(1, '#ef4444');
    ctx.fillStyle = g;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w * power, h, 5); ctx.fill(); }
    else ctx.fillRect(x, y, w * power, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POWER', W / 2, y - 5);
  }

  /* ---------- PASS ---------- */

  function initPass(kind) {
    var sc = { kind: kind || 'pass', phase: 'aim', pts: [], t: 0 };
    sc.bx = (Math.random() - 0.5) * 30;
    sc.by = 26 + Math.random() * 22;
    sc.mates = [];
    var mates = M.career.squad.filter(function (p) { return p.pos !== 'GK'; });
    var offset = Math.floor(Math.random() * mates.length);
    var vc = sc.bx * 0.7; // keep options inside the camera's cone
    var n = 3;
    for (var i = 0; i < n; i++) {
      var mate = mates[(offset + i * 3) % mates.length];
      var quality = Math.random();
      sc.mates.push({
        x: S.clamp(vc + (i - 1) * 4.5 + (Math.random() - 0.5) * 4, -28, 28),
        y: S.clamp(sc.by - 6 - Math.random() * 20, 4, 46),
        name: mate.name.split(' ')[1] || mate.name,
        rating: mate.rating,
        marked: quality < 0.4,
        run: (Math.random() - 0.5) * 2.6
      });
    }
    sc.defs = [];
    for (var j = 0; j < 3; j++) {
      sc.defs.push({
        x: S.clamp(vc + (Math.random() - 0.5) * 15, -30, 30),
        y: S.clamp(sc.by - 3 - Math.random() * 18, 3, 44),
        vx: (Math.random() - 0.5) * 1.6
      });
    }
    sc.cam = wideCam(sc.by, sc.bx);
    sc.timeLimit = scenarioTime(4.4);
    sc.timeLeft = sc.timeLimit;
    M.scenario = sc;
    setOverlay('FIND A PASS', 'Swipe towards a teammate — <b>flick harder for a longer ball</b>', 'act');
  }

  function releasePass(sc, sx, sy) {
    var st = swipeStats(sc);
    if (!st) return;
    var target = sc.cam.unprojectGround(sx, sy);
    var power = gesturePower(st);
    // find nearest mate to target
    var best = null, bestD = 1e9;
    sc.mates.forEach(function (m) {
      var d = Math.hypot(m.x - target.x, m.y - target.y);
      if (d < bestD) { bestD = d; best = m; }
    });
    var dist = Math.hypot(sc.bx - target.x, sc.by - target.y);
    var acc = attr('passing') * 0.75 + attr('technique') * 0.25;
    var err = (1.25 - acc / 100) * pressureFactor() * (0.5 + dist / 34);
    var missBy = bestD + err * 4 * Math.random();
    sc.aimTarget = target;
    sc.phase = 'flight';
    sc.ball = { x: sc.bx, y: sc.by, z: 0.15, t: 0 };
    sc.travel = Math.max(0.35, dist / (13 + power * 16));
    sc.to = best;
    sc.hit = missBy < 3.6 + acc / 55;
    // interception?
    sc.intercepted = false;
    sc.defs.forEach(function (d) {
      var mid = { x: (sc.bx + target.x) / 2, y: (sc.by + target.y) / 2 };
      if (Math.hypot(d.x - mid.x, d.y - mid.y) < 3.2 && Math.random() < 0.42 - acc / 320) sc.intercepted = true;
    });
    sc.landing = sc.hit && !sc.intercepted ? { x: best.x, y: best.y } : {
      x: target.x + (Math.random() - 0.5) * err * 6,
      y: target.y + (Math.random() - 0.5) * err * 5
    };
    A.play('pass');
    setOverlay('', '');
  }

  function resolvePass(sc) {
    var res = { xp: { passing: 6 }, energy: 2 };
    if (sc.intercepted) {
      res.rating = -0.3;
      res.text = 'INTERCEPTED';
      res.detail = 'You played it straight into trouble.';
      A.play('fail');
    } else if (!sc.hit) {
      res.rating = -0.22;
      res.text = 'MISPLACED';
      res.detail = 'The pass runs away from ' + sc.to.name + '.';
      A.play('miss');
    } else {
      var mate = sc.to;
      var chanceQuality = S.clamp((46 - mate.y) / 46, 0, 1);
      var scoreChance = S.clamp(0.10 + chanceQuality * 0.42 + (mate.rating - 45) / 260 + (M.career.rel.team - 50) / 400, 0.05, 0.72);
      res.xp.passing = 12;
      res.xp.technique = 4;
      if (mate.marked === false && Math.random() < scoreChance) {
        res.assist = true;
        res.rating = 0.95;
        res.text = 'ASSIST!';
        res.detail = mate.name + ' finishes it off. That one is on you.';
        A.play('goal');
      } else if (chanceQuality > 0.55) {
        res.rating = 0.35;
        res.text = 'KEY PASS';
        res.detail = mate.name + ' gets the shot away but it comes to nothing.';
        A.play('cheer', 0.7, 0.15);
      } else {
        res.rating = 0.14;
        res.text = 'GOOD BALL';
        res.detail = 'Simple and clean to ' + mate.name + '.';
        A.play('tap');
      }
    }
    res.label = 'pass';
    M.stats.passes++;
    sc.pending = res;
    sc.phase = 'done';
    sc.holdT = 0;
    return res;
  }

  function drawPassScene(sc) {
    var cam = sc.cam;
    drawStands(cam, -14);
    drawGrass(cam, -14, sc.by + 22);
    drawMarkings(cam);
    drawGoal(cam, false);

    sc.defs.forEach(function (d) {
      d.x += d.vx * 0.016;
      if (Math.abs(d.x) > 32) d.vx *= -1;
      drawPerson(cam, d.x, d.y, {
        shirt: D.CLUBS[M.themId].c1, shorts: D.CLUBS[M.themId].c2, anim: M.time * 5 + d.y
      });
    });
    sc.mates.forEach(function (m) {
      m.x += m.run * 0.016;
      if (Math.abs(m.x) > 31) m.run *= -1;
      drawPerson(cam, m.x, m.y, {
        shirt: D.CLUBS[M.career.clubId].c1, shorts: D.CLUBS[M.career.clubId].c2,
        anim: M.time * 5 + m.x, label: m.name
      });
      // highlight ring
      var p = cam.project(m.x, m.y, 0);
      ctx.strokeStyle = m.marked ? 'rgba(248,113,113,0.65)' : 'rgba(74,222,128,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 1.3 * p.s, 0.5 * p.s, 0, 0, 6.283);
      ctx.stroke();
    });

    drawPerson(cam, sc.bx - 0.6, sc.by + 0.8, {
      shirt: D.CLUBS[M.career.clubId].c1, shorts: D.CLUBS[M.career.clubId].c2,
      anim: Math.sin(M.time * 4), label: M.career.last, mine: true
    });

    if (sc.phase === 'aim') {
      drawBall(cam, sc.bx, sc.by, 0.12, 0);
      if (sc.dragging && sc.pts.length) {
        var last = sc.pts[sc.pts.length - 1];
        var tgt = cam.unprojectGround(last.x, last.y);
        var bp = cam.project(sc.bx, sc.by, 0.1);
        var tp = cam.project(tgt.x, tgt.y, 0);
        ctx.strokeStyle = 'rgba(250,204,21,0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(bp.x, bp.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 10, 0, 6.283); ctx.stroke();
        var st = swipeStats(sc);
        drawPowerBar(gesturePower(st));
      }
    } else if (sc.ball) {
      drawBall(cam, sc.ball.x, sc.ball.y, sc.ball.z, sc.ball.t * 10);
    }
  }

  /* ---------- DRIBBLE ---------- */

  function initDribble() {
    var sc = { kind: 'dribble', phase: 'run', t: 0, stage: 0, stages: Math.random() < 0.45 ? 2 : 1 };
    sc.bx = (Math.random() - 0.5) * 26;
    sc.by = 30 + Math.random() * 12;
    sc.def = { x: sc.bx + (Math.random() - 0.5) * 2, y: sc.by - 12, closing: 1 };
    sc.window = 0.30 + attr('dribbling') / 340 + attr('composure') / 700;
    sc.cam = wideCam(sc.by, sc.bx);
    sc.timeLimit = 5;
    sc.timeLeft = sc.timeLimit;
    sc.progress = 0;
    M.scenario = sc;
    setOverlay('TAKE HIM ON', 'Swipe <b>left or right</b> the moment the ring turns green', 'act');
  }

  function dribbleAttempt(sc, dir) {
    var perfect = Math.abs(sc.progress - 0.72);
    var win = sc.window * 0.5;
    var success = perfect < win;
    // defender guesses side
    if (success && Math.random() < 0.18 - attr('dribbling') / 700) success = false;
    if (success) {
      sc.stage++;
      A.play('swipe');
      sc.def.beaten = true;
      sc.beatenDefs = (sc.beatenDefs || 0) + 1;
      if (sc.stage >= sc.stages) {
        return finishDribble(sc, true);
      }
      sc.progress = 0;
      sc.def = { x: sc.bx + (Math.random() - 0.5) * 6, y: sc.by - 10, closing: 1.25 };
      flash('BEATEN!', 'good');
    } else {
      A.play('tackle');
      return finishDribble(sc, false);
    }
  }

  function finishDribble(sc, success) {
    sc.phase = 'done';
    var res = { xp: { dribbling: success ? 13 : 5, pace: 4 }, energy: 4 };
    M.stats.dribbles++;
    if (success) {
      res.rating = 0.35 + (sc.beatenDefs > 1 ? 0.2 : 0);
      res.text = 'SKILLED PAST!';
      res.detail = 'You leave ' + (sc.beatenDefs > 1 ? 'two defenders' : 'the defender') + ' for dead. Chance on!';
      res.chain = 'shot';
      A.play('cheer', 0.8, 0.2);
    } else {
      res.rating = -0.28;
      res.text = 'DISPOSSESSED';
      res.detail = 'The defender reads it and nicks the ball.';
    }
    res.label = 'dribble';
    sc.pending = res;
    sc.holdT = 0;
    return res;
  }

  function drawDribbleScene(sc) {
    var cam = sc.cam;
    drawStands(cam, -14);
    drawGrass(cam, -14, sc.by + 20);
    drawMarkings(cam);
    drawGoal(cam, false);

    // the defender closes in as the ring shrinks — the green window is the
    // moment he commits and you can go past him
    var d = sc.def;
    var closeT = S.clamp(sc.progress, 0, 1);
    var dy = d.y + (sc.by - 2.2 - d.y) * closeT;
    var dx = d.x + (sc.bx - d.x) * closeT * 0.75;
    drawPerson(cam, dx, dy, {
      shirt: D.CLUBS[M.themId].c1, shorts: D.CLUBS[M.themId].c2,
      anim: M.time * 8, armSpread: 0.4 + closeT * 0.4, lean: -0.12 * closeT
    });
    drawPerson(cam, sc.bx, sc.by, {
      shirt: D.CLUBS[M.career.clubId].c1, shorts: D.CLUBS[M.career.clubId].c2,
      anim: M.time * 9, label: M.career.last, mine: true
    });
    drawBall(cam, sc.bx + 0.7, sc.by - 0.9, 0.12, M.time * 6);

    // timing ring around the player
    var p = cam.project(sc.bx, sc.by, 0);
    var r = 26 + (1 - sc.progress) * 70;
    var inWindow = Math.abs(sc.progress - 0.72) < sc.window * 0.5;
    // target ring (where the shrinking ring must be when you swipe)
    ctx.strokeStyle = 'rgba(250,204,21,0.85)';
    ctx.setLineDash([7, 7]);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y - 20, 26 + (1 - 0.72) * 70, 0, 6.283); ctx.stroke();
    ctx.setLineDash([]);
    if (inWindow) {
      ctx.fillStyle = 'rgba(74,222,128,0.16)';
      ctx.beginPath(); ctx.arc(p.x, p.y - 20, r, 0, 6.283); ctx.fill();
    }
    ctx.strokeStyle = inWindow ? '#4ade80' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = inWindow ? 7 : 3.5;
    ctx.beginPath(); ctx.arc(p.x, p.y - 20, r, 0, 6.283); ctx.stroke();

    // arrows
    ctx.font = '700 18px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('◀  SWIPE  ▶', W / 2, H - 30);
  }

  /* ---------- HEADER / CROSS / TACKLE (timing) ---------- */

  function initTiming(kind) {
    var sc = { kind: kind, phase: 'timing', t: 0, cursor: 0, dir: 1, done: false };
    var comp = attr('composure');
    if (kind === 'header') {
      sc.zone = 0.16 + attr('strength') / 500 + comp / 900;
      sc.speed = 1.25;
      sc.bx = (Math.random() - 0.5) * 8;
      sc.by = 6 + Math.random() * 6;
      sc.cam = goalCam(sc.by, sc.bx, { back: 14, focal: 0.55 });
      setOverlay('CROSS COMING IN', 'Tap when the marker hits the <b>green</b> to meet it', 'act');
    } else if (kind === 'cross') {
      sc.zone = 0.16 + attr('technique') / 480 + attr('passing') / 700;
      sc.speed = 1.35;
      sc.bx = (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 6);
      sc.by = 14 + Math.random() * 8;
      sc.cam = wideCam(sc.by, sc.bx);
      setOverlay('WHIP IT IN', 'Tap in the <b>green</b> for the perfect cross', 'act');
    } else {
      sc.zone = 0.15 + attr('defending') / 460 + comp / 900;
      sc.speed = 1.5;
      sc.bx = (Math.random() - 0.5) * 24;
      sc.by = 46 + Math.random() * 14;
      sc.cam = wideCam(sc.by, sc.bx);
      setOverlay('WIN IT BACK', 'Time your tackle — tap in the <b>green</b>', 'act');
    }
    sc.center = 0.42 + Math.random() * 0.22;
    sc.timeLimit = 6;
    sc.timeLeft = sc.timeLimit;
    M.scenario = sc;
    A.play('whistle');
  }

  function timingResolve(sc) {
    var off = Math.abs(sc.cursor - sc.center);
    var perfect = off < sc.zone * 0.28;
    var good = off < sc.zone * 0.65;
    var ok = off < sc.zone;
    var res = { xp: {}, energy: 3, label: sc.kind };
    sc.phase = 'done';
    sc.holdT = 0;
    if (sc.kind === 'header') {
      res.xp.strength = 7;
      if (perfect && Math.random() < 0.72) {
        res.goal = true; res.rating = 1.25; res.text = 'HEADER GOAL!';
        res.detail = 'You rise highest and bury it.'; res.xp.strength = 14; res.xp.shooting = 8;
        A.play('goal');
      } else if (good) {
        res.rating = 0.2; res.text = 'ON TARGET'; res.onTarget = true;
        res.detail = 'Good contact but the keeper claims it.'; res.xp.strength = 9;
        A.play('save');
      } else if (ok) {
        res.rating = -0.15; res.text = 'WIDE';
        res.detail = 'You get your head to it but glance it wide.';
        A.play('miss');
      } else {
        res.rating = -0.3; res.text = 'MISTIMED';
        res.detail = 'You jump too early and the ball sails over you.';
        A.play('fail');
      }
      M.stats.shots++;
    } else if (sc.kind === 'cross') {
      res.xp.passing = 8; res.xp.technique = 5;
      if (perfect && Math.random() < 0.55) {
        res.assist = true; res.rating = 0.95; res.text = 'ASSIST!';
        res.detail = 'Inch-perfect delivery and it is headed home!';
        res.xp.passing = 15;
        A.play('goal');
      } else if (good) {
        res.rating = 0.32; res.text = 'DANGEROUS BALL';
        res.detail = 'A brilliant cross but nobody gambles.';
        A.play('cheer', 0.6, 0.14);
      } else if (ok) {
        res.rating = 0.05; res.text = 'CLEARED';
        res.detail = 'The centre-half heads it away.';
      } else {
        res.rating = -0.25; res.text = 'OVERHIT';
        res.detail = 'Straight out for a goal kick.';
        A.play('miss');
      }
    } else {
      res.xp.defending = 8;
      M.stats.tackles++;
      if (perfect) {
        res.rating = 0.42; res.text = 'CLEAN TACKLE!';
        res.detail = 'Perfectly timed. The crowd loves that.';
        res.xp.defending = 15;
        A.play('cheer', 0.7, 0.18);
      } else if (good) {
        res.rating = 0.18; res.text = 'WON THE BALL';
        res.detail = 'Not pretty, but it is yours.';
        A.play('tackle');
      } else if (ok) {
        res.rating = -0.1; res.text = 'FOUL';
        res.detail = 'The referee blows up. Free kick against you.';
        A.play('whistle');
      } else {
        res.rating = -0.38; res.text = 'BOOKED';
        res.detail = 'Late and clumsy — that is a yellow card.';
        res.card = true;
        A.play('fail');
      }
    }
    sc.pending = res;
    return res;
  }

  function drawTimingScene(sc) {
    var cam = sc.cam;
    drawStands(cam, -14);
    drawGrass(cam, -14, sc.by + 20);
    drawMarkings(cam);
    drawGoal(cam, false);

    if (sc.kind === 'header') {
      drawKeeper(cam, { x: 0.4, y: 0.5, anim: M.time * 3 });
      drawPerson(cam, sc.bx + 1.8, sc.by + 0.4, {
        shirt: D.CLUBS[M.themId].c1, shorts: D.CLUBS[M.themId].c2, anim: M.time * 5
      });
      var jump = S.clamp(1 - Math.abs(sc.cursor - sc.center) * 5, 0, 1);
      drawPerson(cam, sc.bx, sc.by - jump * 0.3, {
        shirt: D.CLUBS[M.career.clubId].c1, shorts: D.CLUBS[M.career.clubId].c2,
        anim: M.time * 6, armLift: 0.35 + jump * 0.5, label: M.career.last, mine: true
      });
      // the cross arcs in from the wing and drops onto your head
      var t = sc.cursor;
      var ballX = sc.bx + 9 * (1 - t);
      var ballY = sc.by - 4 * (1 - t);
      var ballZ = 2.05 + Math.sin(t * Math.PI) * 1.8 + (1 - t) * 1.6;
      drawBall(cam, ballX, ballY, ballZ, M.time * 8);
    } else if (sc.kind === 'cross') {
      drawPerson(cam, sc.bx, sc.by, {
        shirt: D.CLUBS[M.career.clubId].c1, shorts: D.CLUBS[M.career.clubId].c2,
        anim: M.time * 8, label: M.career.last, mine: true
      });
      drawBall(cam, sc.bx + (sc.bx > 0 ? -0.8 : 0.8), sc.by - 0.8, 0.12, M.time * 5);
      // runners attacking the box — your targets
      for (var i = 0; i < 3; i++) {
        var tx = sc.bx * (0.75 - i * 0.16);
        var ty = sc.by - 7 - i * 3.5;
        drawPerson(cam, tx, ty, {
          shirt: D.CLUBS[M.career.clubId].c1, shorts: D.CLUBS[M.career.clubId].c2,
          anim: M.time * 6 + i * 2, armLift: 0.2
        });
        drawPerson(cam, tx + 1.6, ty - 0.8, {
          shirt: D.CLUBS[M.themId].c1, shorts: D.CLUBS[M.themId].c2, anim: M.time * 5 + i
        });
      }
    } else {
      drawPerson(cam, sc.bx + 1.4, sc.by - 1.5, {
        shirt: D.CLUBS[M.themId].c1, shorts: D.CLUBS[M.themId].c2, anim: M.time * 9
      });
      drawBall(cam, sc.bx + 2.2, sc.by - 2.2, 0.12, M.time * 7);
      drawPerson(cam, sc.bx, sc.by, {
        shirt: D.CLUBS[M.career.clubId].c1, shorts: D.CLUBS[M.career.clubId].c2,
        anim: M.time * 9, lean: -0.15, label: M.career.last, mine: true
      });
    }

    // timing bar
    var bw = W * 0.78, bh = 26, bx0 = (W - bw) / 2, by0 = H - 104;
    ctx.fillStyle = 'rgba(4,8,14,0.35)';
    ctx.fillRect(0, by0 - 16, W, bh + 56);
    ctx.fillStyle = 'rgba(8,12,20,0.75)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx0, by0, bw, bh, 12); ctx.fill(); }
    else ctx.fillRect(bx0, by0, bw, bh);
    var zx = bx0 + (sc.center - sc.zone / 2) * bw;
    var zw = sc.zone * bw;
    ctx.fillStyle = 'rgba(74,222,128,0.75)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(zx, by0, zw, bh, 8); ctx.fill(); }
    else ctx.fillRect(zx, by0, zw, bh);
    ctx.fillStyle = 'rgba(250,250,250,0.95)';
    var cx = bx0 + sc.cursor * bw;
    ctx.fillRect(cx - 2.5, by0 - 6, 5, bh + 12);
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('TAP', W / 2, by0 + bh + 22);
  }

  /* ---------- ambient (no scenario) ---------- */

  function initAmbient() {
    var amb = { cam: wideCam(38, 0), players: [], ball: { x: 0, y: 34, tx: 0, ty: 30 } };
    for (var i = 0; i < 10; i++) {
      amb.players.push({
        x: (Math.random() - 0.5) * 30,
        y: 6 + Math.random() * 38,
        tx: (Math.random() - 0.5) * 30,
        ty: 6 + Math.random() * 38,
        home: i < 5
      });
    }
    M.ambient = amb;
  }

  function updateAmbient(dt) {
    var amb = M.ambient;
    amb.players.forEach(function (p) {
      var dx = p.tx - p.x, dy = p.ty - p.y;
      var d = Math.hypot(dx, dy);
      if (d < 1.5) {
        p.tx = (Math.random() - 0.5) * 30;
        p.ty = 6 + Math.random() * 38;
      } else {
        p.x += dx / d * dt * 5.5;
        p.y += dy / d * dt * 5.5;
      }
    });
    var b = amb.ball;
    var bdx = b.tx - b.x, bdy = b.ty - b.y;
    var bd = Math.hypot(bdx, bdy);
    if (bd < 1.2) {
      var tgt = amb.players[Math.floor(Math.random() * amb.players.length)];
      b.tx = tgt.x; b.ty = tgt.y;
    } else {
      b.x += bdx / bd * dt * 18;
      b.y += bdy / bd * dt * 18;
    }
  }

  function drawAmbient() {
    var amb = M.ambient;
    var cam = amb.cam;
    drawStands(cam, -14);
    drawGrass(cam, -14, 60);
    drawMarkings(cam);
    drawGoal(cam, false);
    amb.players.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (p) {
      var c = p.home ? D.CLUBS[M.career.clubId] : D.CLUBS[M.themId];
      drawPerson(cam, p.x, p.y, { shirt: c.c1, shorts: c.c2, anim: M.time * 6 + p.x });
    });
    drawBall(cam, amb.ball.x, amb.ball.y, 0.12, M.time * 4);
  }

  /* ================= scenario lifecycle ================= */

  function beginScenario() {
    var rng = Math.random;
    var kind = M.chainNext || pickScenarioKind(M.career, rng);
    M.chainNext = null;
    M.state = 'scenario';
    if (kind === 'shot' || kind === 'freekick' || kind === 'penalty') initShot(kind);
    else if (kind === 'pass') initPass('pass');
    else if (kind === 'dribble') initDribble();
    else initTiming(kind);
    els.overlay.classList.add('show');
    els.timerWrap.classList.add('show');
  }

  function applyResult(res) {
    var career = M.career;
    M.rating = S.clamp(M.rating + (res.rating || 0), 1, 10);
    M.energy = S.clamp(M.energy - (res.energy || 2) * (1.35 - attr('stamina') / 150), 0, 100);
    Object.keys(res.xp || {}).forEach(function (k) {
      M.xp[k] = (M.xp[k] || 0) + res.xp[k];
    });
    if (res.goal) {
      M.score[0]++;
      M.stats.goals++;
      log('GOAL! ' + career.name + ' scores for ' + D.CLUBS[career.clubId].short + '!');
      M.momentum = 1;
    } else if (res.assist) {
      M.score[0]++;
      M.stats.assists++;
      log('Goal! Assisted by ' + career.name + '.');
      M.momentum = 1;
    } else if (res.text) {
      log(res.text.charAt(0) + res.text.slice(1).toLowerCase() + ' — ' + career.last + '.');
    }
    if (res.onTarget) M.stats.onTarget++;
    if (res.card) M.cards++;
    updateHud();
  }

  function endScenario() {
    var sc = M.scenario;
    var res = sc.pending;
    if (res) applyResult(res);
    els.timerWrap.classList.remove('show');
    if (res && res.chain) {
      M.chainNext = res.chain;
      setOverlay('', '');
      setTimeout(function () { if (M) beginScenario(); }, 350);
      return;
    }
    M.scenario = null;
    M.state = 'play';
    setOverlay('', '');
    // brief pause before clock resumes
    M.resumeDelay = 0.5;
  }

  function buzz(pattern) {
    if (navigator.vibrate && !A.isMuted()) {
      try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
    }
  }

  function showResultCard(res) {
    if (res.goal || res.assist) buzz([28, 60, 28, 60, 90]);
    else if ((res.rating || 0) < -0.2) buzz(35);
    else buzz(15);
    var cls = res.goal || res.assist ? 'great' : (res.rating || 0) > 0.1 ? 'good' : (res.rating || 0) < -0.15 ? 'bad' : '';
    setOverlay(res.text, res.detail + '<br><span class="mt-delta ' + ((res.rating || 0) >= 0 ? 'up' : 'down') + '">' +
      ((res.rating || 0) >= 0 ? '+' : '') + (res.rating || 0).toFixed(2) + ' rating</span>', 'result ' + cls);
    if (res.goal || res.assist) {
      els.big.textContent = res.goal ? 'GOAL!' : 'ASSIST!';
      els.big.className = 'mt-big show';
      setTimeout(function () { els.big.className = 'mt-big'; }, 1500);
    }
  }

  /* ================= main loop ================= */

  function simGoal(kind) {
    if (kind === 'goalUs') {
      M.score[0]++;
      var mate = bestMate();
      log(mate.name + ' scores for ' + D.CLUBS[M.career.clubId].short + '!');
      A.play('goal');
      flash('GOAL — ' + D.CLUBS[M.career.clubId].short, 'good');
    } else {
      M.score[1]++;
      log(D.CLUBS[M.themId].name + ' score.');
      A.play('cheer', 1.0, 0.16);
      flash('GOAL — ' + D.CLUBS[M.themId].short, 'bad');
    }
    updateHud();
  }

  function tick(dt) {
    M.time += dt;
    if (M.state === 'play') {
      if (M.resumeDelay > 0) { M.resumeDelay -= dt; return; }
      updateAmbient(dt);
      M.clockAcc += dt;
      var perMinute = 0.16;
      while (M.clockAcc > perMinute && M.state === 'play') {
        M.clockAcc -= perMinute;
        M.minute++;
        updateHud();
        if (M.minute === 45) {
          M.state = 'half';
          setOverlay('HALF TIME', D.CLUBS[M.usId].short + ' ' + M.score[0] + ' - ' + M.score[1] + ' ' + D.CLUBS[M.themId].short +
            '<br><span class="mt-note">Your rating: ' + S.round1(M.rating).toFixed(1) + '</span>', 'break');
          els.tapHint.textContent = 'Tap to continue';
          els.tapHint.classList.add('show');
          A.play('whistle');
          return;
        }
        if (M.minute >= 90) { finishMatch(); return; }
        // events
        while (M.evIdx < M.events.length && M.events[M.evIdx].min <= M.minute) {
          var ev = M.events[M.evIdx++];
          if (ev.kind === 'scenario') {
            if (M.energy < 8 && Math.random() < 0.5) { log('You are running on empty out there.'); continue; }
            beginScenario();
            return;
          }
          simGoal(ev.kind);
        }
        if (M.minute % 12 === 0) {
          var lines = ['Good tempo to this game.', D.CLUBS[M.themId].short + ' push forward.',
            'Chance goes begging at the other end.', 'The crowd are up for this.',
            D.CLUBS[M.usId].short + ' keeping the ball nicely.'];
          log(lines[Math.floor(Math.random() * lines.length)]);
        }
      }
    } else if (M.state === 'scenario') {
      var sc = M.scenario;
      sc.t += dt;
      if (sc.phase === 'aim' || sc.phase === 'timing' || sc.phase === 'run') {
        sc.timeLeft -= dt;
        els.timerFill.style.width = S.clamp(sc.timeLeft / sc.timeLimit * 100, 0, 100) + '%';
        els.timerFill.className = 'mt-timer-fill' + (sc.timeLeft / sc.timeLimit < 0.35 ? ' urgent' : '');
        if (sc.timeLeft <= 0) {
          if (sc.kind === 'shot' || sc.kind === 'freekick' || sc.kind === 'penalty') {
            finishShot(sc, 'timeout');
          } else if (sc.kind === 'pass') {
            sc.pending = {
              rating: -0.3, text: 'DISPOSSESSED', detail: 'You held on too long and lost it.',
              xp: { composure: 4 }, energy: 2, label: 'pass'
            };
            A.play('fail');
          } else if (sc.kind === 'dribble') {
            finishDribble(sc, false);
          } else {
            sc.cursor = -1;
            timingResolve(sc);
          }
          sc.phase = 'done';
          sc.holdT = 0;
          showResultCard(sc.pending);
        }
      }
      if (sc.phase === 'flight') {
        if (sc.kind === 'pass') {
          sc.ball.t += dt;
          var p = S.clamp(sc.ball.t / sc.travel, 0, 1);
          sc.ball.x = sc.bx + (sc.landing.x - sc.bx) * p;
          sc.ball.y = sc.by + (sc.landing.y - sc.by) * p;
          sc.ball.z = 0.12 + Math.sin(p * Math.PI) * 0.9;
          if (p >= 1) { resolvePass(sc); showResultCard(sc.pending); }
        } else {
          var r = updateShotFlight(sc, dt);
          if (r) showResultCard(r);
        }
      }
      if (sc.phase === 'run') {
        sc.progress += dt * (0.55 + sc.def.closing * 0.18);
        if (sc.progress >= 1) { finishDribble(sc, false); showResultCard(sc.pending); }
      }
      if (sc.phase === 'done') {
        sc.holdT += dt;
        if (sc.holdT > (sc.pending && (sc.pending.goal || sc.pending.assist) ? 2.4 : 1.7)) endScenario();
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    var sc = M.scenario;
    if (sc) {
      if (sc.kind === 'shot' || sc.kind === 'freekick' || sc.kind === 'penalty') drawShotScene(sc);
      else if (sc.kind === 'pass') drawPassScene(sc);
      else if (sc.kind === 'dribble') drawDribbleScene(sc);
      else drawTimingScene(sc);
    } else {
      drawAmbient();
    }
  }

  function loop(ts) {
    if (!M) return;
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    tick(dt);
    if (!M) return;
    render();
    raf = requestAnimationFrame(loop);
  }

  /* ================= input ================= */

  function canvasPoint(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e) {
    if (!M) return;
    A.unlock();
    e.preventDefault();
    if (M.state === 'half') {
      M.state = 'play';
      els.tapHint.classList.remove('show');
      setOverlay('', '');
      log('Second half under way.');
      return;
    }
    var sc = M.scenario;
    if (!sc) return;
    var p = canvasPoint(e);
    if (sc.phase === 'aim') {
      trackReset(sc);
      sc.dragging = true;
      trackPush(sc, p.x, p.y);
    } else if (sc.phase === 'timing') {
      timingResolve(sc);
      showResultCard(sc.pending);
    } else if (sc.phase === 'run') {
      sc.downX = p.x;
      sc.downT = performance.now();
    }
  }

  function onMove(e) {
    if (!M) return;
    var sc = M.scenario;
    if (!sc || !sc.dragging) return;
    e.preventDefault();
    var p = canvasPoint(e);
    trackPush(sc, p.x, p.y);
  }

  function onUp(e) {
    if (!M) return;
    var sc = M.scenario;
    if (!sc) return;
    var p = canvasPoint(e);
    if (sc.phase === 'aim' && sc.dragging) {
      sc.dragging = false;
      trackPush(sc, p.x, p.y);
      if (sc.kind === 'pass') releasePass(sc, p.x, p.y);
      else releaseShot(sc, p.x, p.y);
    } else if (sc.phase === 'run' && sc.downX != null) {
      var dx = p.x - sc.downX;
      if (Math.abs(dx) > 18 || performance.now() - sc.downT < 260) {
        var r = dribbleAttempt(sc, dx > 0 ? 1 : -1);
        if (r) showResultCard(r);
      }
      sc.downX = null;
    }
  }

  /* ================= finish ================= */

  function finishMatch() {
    M.state = 'end';
    A.play('whistle');
    A.stopCrowd();
    cancelAnimationFrame(raf);
    var career = M.career;
    var res = {
      fixture: M.fixture,
      home: M.fixture.home,
      away: M.fixture.away,
      hg: M.fixture.isHome ? M.score[0] : M.score[1],
      ag: M.fixture.isHome ? M.score[1] : M.score[0],
      myGoals: M.score[0],
      theirGoals: M.score[1],
      rating: S.round1(M.rating),
      stats: M.stats,
      xp: M.xp,
      energyLeft: M.energy,
      played: M.played,
      cards: M.cards,
      log: M.log.slice(0, 12)
    };
    var cb = M.onComplete;
    M = null;
    cb(res);
  }

  /* ================= entry ================= */

  function resize() {
    if (!canvas) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(rect.width);
    H = Math.round(rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function bind() {
    canvas = document.getElementById('pitch');
    els = {
      overlay: document.getElementById('mt-overlay'),
      title: document.getElementById('mt-title'),
      sub: document.getElementById('mt-sub'),
      score: document.getElementById('mt-score'),
      clock: document.getElementById('mt-clock'),
      rating: document.getElementById('mt-rating'),
      ticker: document.getElementById('mt-ticker'),
      energyFill: document.getElementById('mt-energy-fill'),
      timerWrap: document.getElementById('mt-timer'),
      timerFill: document.getElementById('mt-timer-fill'),
      flash: document.getElementById('mt-flash'),
      big: document.getElementById('mt-big'),
      tapHint: document.getElementById('mt-tap'),
      homeName: document.getElementById('mt-home'),
      awayName: document.getElementById('mt-away'),
      comp: document.getElementById('mt-comp')
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    window.addEventListener('resize', function () {
      resize();
      if (M && M.scenario && M.scenario.cam) {
        var sc = M.scenario;
        sc.cam = sc.kind === 'header' ? goalCam(sc.by, sc.bx, { back: 14, focal: 0.55 })
          : (sc.kind === 'shot' || sc.kind === 'freekick' || sc.kind === 'penalty')
            ? goalCam(sc.by, sc.bx) : wideCam(sc.by, sc.bx);
      }
      if (M && M.ambient) M.ambient.cam = wideCam(38, 0);
    });
  }

  function start(career, fixture, opts, onComplete) {
    if (!canvas) bind();
    resize();
    var playing = opts.playing;
    var onFrom = opts.onFrom || 0;
    M = {
      career: career,
      fixture: fixture,
      usId: career.clubId,
      themId: fixture.opponent,
      score: [0, 0],
      minute: 0,
      clockAcc: 0,
      time: 0,
      events: buildTimeline(career, fixture, playing, onFrom),
      evIdx: 0,
      rating: playing ? 6.4 : 0,
      energy: career.energy,
      xp: {},
      cards: 0,
      stats: { shots: 0, onTarget: 0, goals: 0, assists: 0, passes: 0, tackles: 0, dribbles: 0 },
      log: [],
      state: 'play',
      scenario: null,
      chainNext: null,
      resumeDelay: 0.6,
      played: playing,
      onComplete: onComplete,
      momentum: 0
    };
    initAmbient();
    els.homeName.textContent = D.CLUBS[fixture.home].short;
    els.awayName.textContent = D.CLUBS[fixture.away].short;
    els.comp.textContent = fixture.comp + (fixture.isHome ? ' • Home' : ' • Away');
    els.tapHint.classList.remove('show');
    setOverlay('', '');
    updateHud();
    log(playing ? 'Kick off. You are in the starting eleven.' : 'Kick off. You are watching from the bench.');
    A.play('whistle');
    A.startCrowd(0.045);
    lastTs = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function abort() {
    if (M) { M = null; cancelAnimationFrame(raf); A.stopCrowd(); }
  }

  // dev helper: force a specific key moment (used by the smoke tests)
  function force(kind) {
    if (!M) return false;
    M.chainNext = kind;
    beginScenario();
    return true;
  }

  RS.Match = { start: start, abort: abort, resize: resize, force: force };
})(window.RS = window.RS || {});
