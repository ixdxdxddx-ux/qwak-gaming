// js/main.js — Bootstrap: init all modules, wire up index page

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ─── Init core modules ───────────────────────────
  Auth.init();
  LauncherSync.init();
  Utils.setActiveNav();
  Utils.initBurger();

  // ─── Index page ──────────────────────────────────
  const isIndex = !location.pathname.includes('pages/');
  if (isIndex) {

    // Stats counters
    const updateStats = () => {
      const games   = DB.getGames();
      const users   = DB.getUsers();
      const threads = DB.getThreads();
      const files   = games.reduce((a, g) => a + (g.files?.length || 0), 0);

      const animateCount = (el, target) => {
        if (!el) return;
        let cur = 0;
        const step = Math.max(1, Math.floor(target / 40));
        const iv = setInterval(() => {
          cur = Math.min(cur + step, target);
          el.textContent = cur >= 1000 ? (cur / 1000).toFixed(1) + 'K' : cur;
          if (cur >= target) clearInterval(iv);
        }, 30);
      };

      animateCount(Utils.qs('#statGames'),   games.length);
      animateCount(Utils.qs('#statUsers'),   users.length);
      animateCount(Utils.qs('#statThreads'), threads.length);
      animateCount(Utils.qs('#statFiles'),   files);
    };

    updateStats();
    window.addEventListener('qwak:auth', updateStats);

    // Recent games (last 4)
    const renderRecent = () => {
      const games = DB.getGames().slice(-4).reverse();
      Games.renderGrid('recentGames', games);
      const sec = Utils.qs('#recentGamesSection');
      if (sec) sec.style.display = games.length ? '' : 'none';
    };
    renderRecent();

    // Recent threads (last 4)
    const renderThreads = () => {
      const threads = DB.getThreads().slice(-4).reverse();
      const container = Utils.qs('#recentThreads');
      const sec = Utils.qs('#recentForumSection');
      if (!container) return;
      if (!threads.length) { if (sec) sec.style.display = 'none'; return; }
      if (sec) sec.style.display = '';
      const wrap = Utils.el('div', { class: 'glass', style: 'border-radius:var(--radius-lg);overflow:hidden' });
      threads.forEach(t => {
        const row = Utils.el('div', { class: 'thread-row' });
        row.innerHTML = `
          <div class="thread-row__left">
            <div class="thread-row__title">${t.pinned ? '📌 ' : ''}${t.title}</div>
            <div class="thread-row__meta">${t.author} · ${t.replies || 0} ответов</div>
          </div>
          <div class="thread-row__right">${t.replies || 0} отв.</div>`;
        row.onclick = () => { location.href = `pages/thread.html?id=${t.id}`; };
        wrap.append(row);
      });
      container.innerHTML = '';
      container.append(wrap);
    };
    renderThreads();

    window.addEventListener('qwak:auth', () => { renderRecent(); renderThreads(); updateStats(); });
  }
});
