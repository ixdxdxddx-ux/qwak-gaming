// js/auth.js — Authentication: login, register, logout, session
// ✅ FIXED: Event dispatch и обновление после регистрации

'use strict';

const Auth = {

  _session: null,

  // ─── Session ─────────────────────────────────────

  init() {
    Auth._session = DB.getSession();
    Auth.renderNav();
  },

  getSession()   { return Auth._session; },
  getCurrentUser() { return Auth._session?.user || null; },
  isLoggedIn()   { return !!Auth._session?.user; },
  isRole(...roles) {
    const role = Auth.getCurrentUser()?.role;
    return role && roles.includes(role);
  },
  canModerate()  { return Auth.isRole('owner', 'admin', 'mod'); },
  canAdmin()     { return Auth.isRole('owner', 'admin'); },

  // ─── Login ───────────────────────────────────────

  async login(username, password) {
    const hashed = await Utils.hashPassword(password);
    const users  = DB.getUsers();
    const user   = users.find(u =>
      u.username === username && u.password === hashed
    );
    if (!user)          return { ok: false, error: 'Неверный логин или пароль' };
    if (user.banned)    return { ok: false, error: 'Аккаунт заблокирован' };

    const session = { user, token: Utils.genToken() };
    DB.saveSession(session);
    Auth._session = session;
    Auth.renderNav();

    // Sync to launcher
    LauncherSync.syncLogin(username, password).catch(() => {});

    // ✅ DISPATCH EVENT TO UPDATE ALL LISTENERS
    setTimeout(() => {
      window.dispatchEvent(new Event('qwak:auth'));
    }, 100);

    return { ok: true, user };
  },

  // ─── Register ────────────────────────────────────

  async register(username, password, password2) {
    if (!username.trim() || !password.trim())
      return { ok: false, error: 'Заполните все поля' };
    if (password !== password2)
      return { ok: false, error: 'Пароли не совпадают' };
    if (password.length < 4)
      return { ok: false, error: 'Пароль минимум 4 символа' };
    if (DB.getUserByUsername(username))
      return { ok: false, error: 'Имя уже занято' };

    const hashed = await Utils.hashPassword(password);
    const user = {
      id:       Utils.uid(),
      username: username.trim(),
      password: hashed,
      role:     'user',
      joined:   Utils.nowDate(),
      banned:   false,
      muted:    false,
      warns:    0,
      bio:      '',
    };
    DB.addUser(user);

    const session = { user, token: Utils.genToken() };
    DB.saveSession(session);
    Auth._session = session;
    Auth.renderNav();

    // Sync to launcher
    LauncherSync.syncRegister(username, password).catch(() => {});

    // ✅ CRITICAL: DISPATCH EVENT WITH DELAY TO ENSURE PROPER PROPAGATION
    setTimeout(() => {
      window.dispatchEvent(new Event('qwak:auth'));
      // Also dispatch custom event with details
      window.dispatchEvent(new CustomEvent('qwak:userRegistered', { 
        detail: { user } 
      }));
    }, 100);

    return { ok: true, user };
  },

  // ─── Logout ────────────────────────────────────

  logout() {
    DB.clearSession();
    Auth._session = null;
    Auth.renderNav();
    LauncherSync.syncLogout().catch(() => {});
    Utils.toast('Вы вышли из аккаунта');

    // ✅ DISPATCH EVENT
    setTimeout(() => {
      window.dispatchEvent(new Event('qwak:auth'));
    }, 100);
  },

  // ─── Render navbar auth section ──────────────────

  renderNav() {
    const navAuth = Utils.qs('#navAuth');
    if (!navAuth) return;

    if (Auth.isLoggedIn()) {
      const u = Auth.getCurrentUser();
      navAuth.innerHTML = `
        <div class="navbar__user">
          ${Utils.roleBadge(u.role)}
          <span class="navbar__username">${u.username}</span>
          <button class="btn btn--outline btn--sm" id="logoutBtn">Выйти</button>
        </div>`;
      Utils.qs('#logoutBtn')?.addEventListener('click', () => Auth.logout());

      // Show admin link if applicable
      if (Auth.canAdmin()) {
        const links = Utils.qs('#navLinks');
        if (links && !links.querySelector('.admin')) {
          const a = Utils.el('a', {
            class: 'nav-link admin',
            href: (location.pathname.includes('pages') ? '' : 'pages/') + 'admin.html',
            text: 'Панель'
          });
          links.appendChild(a);
        }
      }
    } else {
      navAuth.innerHTML = `
        <button class="btn btn--outline btn--sm" id="loginBtn">Войти</button>
        <button class="btn btn--primary btn--sm" id="regBtn">Регистрация</button>`;
      Utils.qs('#loginBtn')?.addEventListener('click', Auth.openLoginModal);
      Utils.qs('#regBtn')?.addEventListener('click', Auth.openRegisterModal);
    }
  },

  // ─── Login modal ─────────────────────────────────

  openLoginModal() {
    const frag = document.createDocumentFragment();
    const wrap = Utils.el('div');
    wrap.innerHTML = `
      <div class="modal__center">
        <div class="modal__logo-wrap">
          <img src="${location.pathname.includes('pages') ? '../' : ''}assets/img/logo.svg" alt="QWAK" style="width:44px;height:44px">
        </div>
        <div class="modal__title" style="margin-bottom:4px">QWAK</div>
        <div class="modal__subtitle">Войдите в аккаунт</div>
      </div>
      <div class="field">
        <div class="field__label">Логин</div>
        <input id="loginUser" type="text" placeholder="Ваш логин" autocomplete="username">
      </div>
      <div class="field">
        <div class="field__label">Пароль</div>
        <input id="loginPass" type="password" placeholder="Ваш пароль" autocomplete="current-password">
        <div class="field__error hidden" id="loginErr"></div>
      </div>
      <button class="btn btn--primary btn--full mt-3" id="loginSubmit">Войти</button>
      <div style="text-align:center;margin-top:14px;font-size:12px;color:var(--color-text-2)">
        Нет аккаунта? <a href="#" id="switchToReg" class="text-accent">Регистрация</a>
      </div>`;
    frag.appendChild(wrap);

    const { overlay, close } = Utils.openModal(wrap);

    const doLogin = async () => {
      const u = Utils.qs('#loginUser', overlay).value.trim();
      const p = Utils.qs('#loginPass', overlay).value;
      const err = Utils.qs('#loginErr', overlay);
      const result = await Auth.login(u, p);
      if (result.ok) {
        close();
        Utils.toast(`Добро пожаловать, ${result.user.username}!`);
        // ✅ Event already dispatched in login()
      } else {
        err.textContent = result.error;
        err.classList.remove('hidden');
      }
    };

    Utils.qs('#loginSubmit', overlay).onclick = doLogin;
    Utils.qs('#loginPass', overlay).addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    Utils.qs('#switchToReg', overlay).onclick = e => {
      e.preventDefault();
      close();
      Auth.openRegisterModal();
    };
  },

  // ─── Register modal ──────────────────────────────

  openRegisterModal() {
    const wrap = Utils.el('div');
    wrap.innerHTML = `
      <div class="modal__center">
        <div class="modal__logo-wrap">
          <img src="${location.pathname.includes('pages') ? '../' : ''}assets/img/logo.svg" alt="QWAK" style="width:44px;height:44px">
        </div>
        <div class="modal__title" style="margin-bottom:4px">QWAK</div>
        <div class="modal__subtitle">Создайте аккаунт</div>
      </div>
      <div class="field">
        <div class="field__label">Логин</div>
        <input id="regUser" type="text" placeholder="Придумайте логин" autocomplete="username">
      </div>
      <div class="field">
        <div class="field__label">Пароль</div>
        <input id="regPass" type="password" placeholder="Минимум 4 символа" autocomplete="new-password">
      </div>
      <div class="field">
        <div class="field__label">Повторите пароль</div>
        <input id="regPass2" type="password" placeholder="Ещё раз" autocomplete="new-password">
        <div class="field__error hidden" id="regErr"></div>
      </div>
      <button class="btn btn--primary btn--full mt-3" id="regSubmit">Создать аккаунт</button>
      <div style="text-align:center;margin-top:14px;font-size:12px;color:var(--color-text-2)">
        Уже есть аккаунт? <a href="#" id="switchToLogin" class="text-accent">Войти</a>
      </div>`;

    const { overlay, close } = Utils.openModal(wrap);

    const doRegister = async () => {
      const u = Utils.qs('#regUser', overlay).value.trim();
      const p = Utils.qs('#regPass', overlay).value;
      const p2 = Utils.qs('#regPass2', overlay).value;
      const err = Utils.qs('#regErr', overlay);
      const result = await Auth.register(u, p, p2);
      if (result.ok) {
        close();
        Utils.toast(`Добро пожаловать, ${result.user.username}!`);
        // ✅ Event already dispatched in register()
      } else {
        err.textContent = result.error;
        err.classList.remove('hidden');
      }
    };

    Utils.qs('#regSubmit', overlay).onclick = doRegister;
    Utils.qs('#regPass2', overlay).addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
    Utils.qs('#switchToLogin', overlay).onclick = e => {
      e.preventDefault();
      close();
      Auth.openLoginModal();
    };
  },
};
