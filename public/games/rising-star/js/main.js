/* Rising Star — boot */
(function (RS) {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    // when embedded in a host page that has no viewport meta, phones would lay
    // the game out at desktop width and scale it down — add one if it is missing
    if (!document.querySelector('meta[name="viewport"]')) {
      var mv = document.createElement('meta');
      mv.name = 'viewport';
      mv.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
      document.head.appendChild(mv);
    }

    // lock the visual viewport height on mobile browsers with dynamic toolbars
    function setVH() {
      document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
    }
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', function () { setTimeout(setVH, 200); });

    // stop double-tap zoom / rubber banding inside the match stage
    document.addEventListener('touchmove', function (e) {
      if (e.target.closest && e.target.closest('.mt-stage')) e.preventDefault();
    }, { passive: false });

    // first user gesture unlocks WebAudio
    var unlock = function () {
      RS.Audio.unlock();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);

    RS.UI.boot();
  });
})(window.RS = window.RS || {});
