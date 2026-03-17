// js/design.js — Cursor + Dot Grid (shared across all pages)
'use strict';

(function () {

  /* ── DOT GRID ─────────────────────────────────────────────── */
  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, dots = [];
  const SPACING  = 36;
  const INFLUENCE = 155;
  const STRENGTH  = 26;
  const mouse = { x: -9999, y: -9999 };

  function build() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    const cols = Math.ceil(W / SPACING) + 2;
    const rows = Math.ceil(H / SPACING) + 2;
    dots = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ox = (c - .5) * SPACING;
        const oy = (r - .5) * SPACING;
        dots.push({ ox, oy, x: ox, y: oy });
      }
    }
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    const mx = mouse.x, my = mouse.y;

    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const dx = d.ox - mx;
      const dy = d.oy - my;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < INFLUENCE) {
        const force = 1 - dist / INFLUENCE;
        const angle = Math.atan2(dy, dx);
        const push  = force * STRENGTH;
        const tx = d.ox + Math.cos(angle) * push;
        const ty = d.oy + Math.sin(angle) * push;
        d.x += (tx - d.x) * .15;
        d.y += (ty - d.y) * .15;
      } else {
        d.x += (d.ox - d.x) * .07;
        d.y += (d.oy - d.y) * .07;
      }

      const proximity = Math.max(0, 1 - dist / (INFLUENCE * 1.5));
      const alpha  = .06 + proximity * .5;
      const radius = .8 + proximity * 1.1;

      ctx.beginPath();
      ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('resize', build);
  build();
  frame();

  /* ── CUSTOM CURSOR ────────────────────────────────────────── */
  const dot  = document.getElementById('cur');
  const ring = document.getElementById('cur-ring');
  if (!dot || !ring) return;

  Object.assign(dot.style, {
    width: '5px', height: '5px',
    background: '#fff', borderRadius: '50%',
    transform: 'translate(-50%,-50%)',
    pointerEvents: 'none',
    transition: 'transform .1s ease, background .1s ease',
  });
  Object.assign(ring.style, {
    width: '30px', height: '30px',
    border: '1px solid rgba(255,255,255,.35)',
    borderRadius: '50%',
    transform: 'translate(-50%,-50%)',
    pointerEvents: 'none',
  });

  let mx2 = 0, my2 = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', e => {
    mx2 = e.clientX; my2 = e.clientY;
    dot.style.left  = mx2 + 'px';
    dot.style.top   = my2 + 'px';
  });

  (function ringTick() {
    rx += (mx2 - rx) * .16;
    ry += (my2 - ry) * .16;
    ring.style.left = Math.round(rx) + 'px';
    ring.style.top  = Math.round(ry) + 'px';
    requestAnimationFrame(ringTick);
  })();

  // hover reactions
  function addHover(selector) {
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener('mouseenter', () => {
        dot.style.transform  = 'translate(-50%,-50%) scale(2)';
        dot.style.background = 'rgba(255,255,255,.4)';
        ring.style.transform = 'translate(-50%,-50%) scale(1.5)';
        ring.style.borderColor = 'rgba(255,255,255,.12)';
      });
      el.addEventListener('mouseleave', () => {
        dot.style.transform  = 'translate(-50%,-50%) scale(1)';
        dot.style.background = '#fff';
        ring.style.transform = 'translate(-50%,-50%) scale(1)';
        ring.style.borderColor = 'rgba(255,255,255,.35)';
      });
    });
  }

  // run once DOM is ready, then again after dynamic content loads
  function applyHovers() {
    addHover('a, button, .game-card, .thread-row, .stat, .ptag, .gc, .tr, .forum-cat__name, .card--hover, .ftype-btn');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyHovers);
  } else {
    applyHovers();
  }
  // re-apply after auth renders nav buttons etc.
  window.addEventListener('qwak:auth', () => setTimeout(applyHovers, 100));

})();
