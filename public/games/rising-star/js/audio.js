/* Rising Star — procedural sound effects (no external assets) */
(function (RS) {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var crowdNode = null;
  var crowdGain = null;
  var noiseBuf = null;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.75;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function noise() {
    if (noiseBuf) return noiseBuf;
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function tone(opts) {
    if (!ensure()) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + opts.dur + 0.05);
  }

  function burst(opts) {
    if (!ensure()) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noise();
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.setValueAtTime(opts.f0 || 900, t0);
    if (opts.f1) f.frequency.exponentialRampToValueAtTime(opts.f1, t0 + opts.dur);
    f.Q.value = opts.q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.2, t0 + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }

  var SFX = {
    click: function () { tone({ type: 'triangle', f0: 620, f1: 380, dur: 0.07, vol: 0.10 }); },
    tap: function () { tone({ type: 'sine', f0: 900, f1: 700, dur: 0.05, vol: 0.07 }); },
    kick: function () {
      burst({ f0: 2200, f1: 300, dur: 0.16, vol: 0.35, q: 0.7 });
      tone({ type: 'sine', f0: 180, f1: 60, dur: 0.16, vol: 0.25 });
    },
    pass: function () { burst({ f0: 1500, f1: 500, dur: 0.1, vol: 0.18, q: 0.8 }); },
    whistle: function () {
      tone({ type: 'square', f0: 2100, f1: 2350, dur: 0.18, vol: 0.10 });
      tone({ type: 'square', f0: 2600, f1: 2400, dur: 0.16, vol: 0.05, delay: 0.02 });
    },
    post: function () { tone({ type: 'sine', f0: 1400, f1: 300, dur: 0.5, vol: 0.22 }); },
    save: function () { burst({ f0: 600, f1: 200, dur: 0.22, vol: 0.25, filter: 'lowpass' }); },
    tackle: function () { burst({ f0: 400, f1: 120, dur: 0.2, vol: 0.28, filter: 'lowpass' }); },
    goal: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone({ type: 'triangle', f0: f, f1: f, dur: 0.32, vol: 0.16, delay: i * 0.085 });
      });
      SFX.cheer(1.6, 0.34);
    },
    miss: function () { tone({ type: 'sawtooth', f0: 320, f1: 120, dur: 0.35, vol: 0.12 }); },
    cheer: function (dur, vol) {
      if (!ensure()) return;
      var t0 = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = noise(); src.loop = true;
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.6;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.25, t0 + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 1.2));
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + (dur || 1.2) + 0.1);
    },
    coin: function () {
      tone({ type: 'square', f0: 980, dur: 0.08, vol: 0.10 });
      tone({ type: 'square', f0: 1480, dur: 0.14, vol: 0.09, delay: 0.07 });
    },
    levelup: function () {
      [660, 880, 1180].forEach(function (f, i) {
        tone({ type: 'triangle', f0: f, f1: f * 1.02, dur: 0.22, vol: 0.14, delay: i * 0.08 });
      });
    },
    fail: function () {
      tone({ type: 'sawtooth', f0: 300, f1: 150, dur: 0.3, vol: 0.14 });
      tone({ type: 'sawtooth', f0: 220, f1: 100, dur: 0.35, vol: 0.10, delay: 0.06 });
    },
    swipe: function () { burst({ f0: 3000, f1: 900, dur: 0.09, vol: 0.10 }); }
  };

  RS.Audio = {
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },
    play: function (name, a, b) {
      if (muted) return;
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      var fn = SFX[name];
      if (fn) { try { fn(a, b); } catch (e) { /* ignore */ } }
    },
    startCrowd: function (level) {
      if (!ensure() || muted) return;
      this.stopCrowd();
      var src = ctx.createBufferSource();
      src.buffer = noise(); src.loop = true;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 700;
      crowdGain = ctx.createGain();
      crowdGain.gain.value = 0.0001;
      crowdGain.gain.exponentialRampToValueAtTime(level || 0.05, ctx.currentTime + 1.2);
      src.connect(f); f.connect(crowdGain); crowdGain.connect(master);
      src.start();
      crowdNode = src;
    },
    stopCrowd: function () {
      if (crowdNode) {
        try {
          crowdGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
          crowdNode.stop(ctx.currentTime + 0.5);
        } catch (e) { /* ignore */ }
        crowdNode = null; crowdGain = null;
      }
    },
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.75;
      if (muted) this.stopCrowd();
    },
    isMuted: function () { return muted; }
  };
})(window.RS = window.RS || {});
