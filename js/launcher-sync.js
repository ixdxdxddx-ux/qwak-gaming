// js/launcher-sync.js — Sync session with QWAK Launcher API (localhost:7842)

'use strict';

const LAUNCHER_API = 'http://localhost:7842';
const SYNC_INTERVAL_MS = 5000;

const LauncherSync = {

  _online: false,
  _interval: null,

  isOnline() { return LauncherSync._online; },

  // ─── Init: start polling ─────────────────────────

  init() {
    LauncherSync._check();
    LauncherSync._interval = setInterval(LauncherSync._check, SYNC_INTERVAL_MS);
  },

  async _check() {
    try {
      const r = await fetch(LAUNCHER_API + '/api/session', {
        signal: AbortSignal.timeout(800),
      });
      if (!r.ok) throw new Error('not ok');
      const data = await r.json();
      LauncherSync._online = true;
      LauncherSync._updateStatus(true);

      // If launcher has active session but site doesn't — sync in
      if (data?.user && !Auth.isLoggedIn()) {
        const launchUser = data.user;
        // Make sure user exists locally
        if (!DB.getUserByUsername(launchUser.username)) {
          DB.addUser({ ...launchUser, password: launchUser.password || '' });
        }
        const session = { user: launchUser, token: data.token || Utils.genToken() };
        DB.saveSession(session);
        Auth._session = session;
        Auth.renderNav();
        Utils.toast(`Синхронизировано с лаунчером: ${launchUser.username}!`, 'info');
        window.dispatchEvent(new Event('qwak:auth'));
      }
    } catch {
      LauncherSync._online = false;
      LauncherSync._updateStatus(false);
    }
  },

  _updateStatus(online) {
    Utils.qsa('.launcher-status').forEach(el => {
      el.className = `launcher-status ${online ? 'online' : 'offline'}`;
      const dot  = el.querySelector('.launcher-status__dot');
      const text = el.querySelector('.launcher-status__text');
      if (text) text.textContent = online
        ? 'Лаунчер запущен и синхронизирован'
        : 'Лаунчер не запущен — запустите QWAK.exe';
    });
  },

  // ─── Outgoing sync calls ─────────────────────────

  async syncLogin(username, password) {
    await fetch(LAUNCHER_API + '/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
      signal:  AbortSignal.timeout(1000),
    });
  },

  async syncLogout() {
    await fetch(LAUNCHER_API + '/api/logout', {
      method: 'POST',
      signal: AbortSignal.timeout(800),
    });
  },

  async syncRegister(username, password) {
    await fetch(LAUNCHER_API + '/api/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
      signal:  AbortSignal.timeout(1000),
    });
  },

  // ─── Status widget HTML ──────────────────────────

  statusWidget() {
    return `
      <div class="launcher-status offline">
        <div class="launcher-status__dot"></div>
        <span class="launcher-status__text">Лаунчер не запущен — запустите QWAK.exe</span>
      </div>`;
  },
};

window.LauncherSync = LauncherSync;
