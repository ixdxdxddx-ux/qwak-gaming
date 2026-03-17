// js/utils.js — Shared utilities

'use strict';

// ─── Format helpers ────────────────────────────────────────────────────────

const Utils = {

  fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(n);
  },

  fmtSize(bytes) {
    if (!bytes) return '—';
    if (bytes > 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
    if (bytes > 1e6) return Math.round(bytes / 1e6) + ' MB';
    return Math.round(bytes / 1e3) + ' KB';
  },

  fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU');
  },

  nowDate() {
    return new Date().toISOString().slice(0, 10);
  },

  uid() {
    return Date.now() + Math.floor(Math.random() * 1000);
  },

  // Simple SHA-256 via Web Crypto (async)
  async hashPassword(plain) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(plain));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  genToken() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11)
      .replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  },

  truncate(str, n = 80) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n) + '...' : str;
  },

  // ─── DOM helpers ────────────────────────────────

  qs(sel, ctx = document)  { return ctx.querySelector(sel); },
  qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; },

  el(tag, props = {}, ...children) {
    const elem = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class')           elem.className = v;
      else if (k === 'html')       elem.innerHTML = v;
      else if (k === 'text')       elem.textContent = v;
      else if (k.startsWith('on')) elem.addEventListener(k.slice(2), v);
      else                         elem.setAttribute(k, v);
    }
    for (const child of children) {
      if (child == null) continue;
      elem.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return elem;
  },

  // ─── Toast ──────────────────────────────────────

  toast(msg, type = 'ok') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { ok: ' ✓ ', err: '⚠ ', info: 'ℹ ' };
    const div = Utils.el('div', { class: `toast toast--${type}` },
      Utils.el('span', { text: icons[type] || ' ' }),
      Utils.el('span', { text: msg })
    );
    container.appendChild(div);
    setTimeout(() => div.remove(), 3200);
  },

  // ─── Modal ──────────────────────────────────────

  openModal(content, wide = false) {
    const overlay = Utils.el('div', { class: 'modal-overlay' });
    const modal   = Utils.el('div', { class: `modal${wide ? ' modal--wide' : ''}` });
    const closeBtn = Utils.el('button', {
      class: 'modal__close', html: '×',
      click: () => overlay.remove()
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    modal.appendChild(closeBtn);
    if (typeof content === 'string') modal.insertAdjacentHTML('beforeend', content);
    else modal.appendChild(content);
    overlay.appendChild(modal);
    document.getElementById('modalsContainer')?.appendChild(overlay) ?? document.body.appendChild(overlay);
    return { overlay, modal, close: () => overlay.remove() };
  },

  closeModals() {
    Utils.qsa('.modal-overlay').forEach(m => m.remove());
  },

  // ─── Confirm dialog ─────────────────────────────

  confirm(msg) {
    return new Promise(resolve => {
      const frag = Utils.el('div');
      frag.innerHTML = `
        <div class="modal__title">Подтверждение</div>
        <p class="text-sm text-muted" style="margin-bottom:20px">${msg}</p>
        <div class="flex gap-2">
          <button class="btn btn--red btn--sm" id="cfmYes">Да</button>
          <button class="btn btn--ghost btn--sm" id="cfmNo">Отмена</button>
        </div>`;
      const { overlay } = Utils.openModal(frag);
      frag.querySelector('#cfmYes').onclick = () => { overlay.remove(); resolve(true); };
      frag.querySelector('#cfmNo').onclick  = () => { overlay.remove(); resolve(false); };
    });
  },

  // ─── Role helpers ───────────────────────────────

  roleBadge(role) {
    const labels = { owner: 'OWNER', admin: 'ADMIN', mod: 'MOD', user: 'USER' };
    return `<span class="badge badge--${role}">${labels[role] || 'USER'}</span>`;
  },

  fileIcon(type) {
    return { exe: '⚙️', torrent: '🌊', folder: '📁', archive: '📦', iso: '💿' }[type] || '📄';
  },

  fileTypeColor(type) {
    return {
      exe:     'var(--color-file-exe)',
      torrent: 'var(--color-file-torrent)',
      folder:  'var(--color-file-folder)',
      archive: 'var(--color-file-archive)',
      iso:     'var(--color-file-iso)',
    }[type] || 'var(--color-text-2)';
  },

  detectFileType(name = '') {
    const ext = name.split('.').pop().toLowerCase();
    if (['exe', 'msi'].includes(ext)) return 'exe';
    if (ext === 'torrent') return 'torrent';
    if (ext === 'iso') return 'iso';
    if (['zip', 'rar', '7z'].includes(ext)) return 'archive';
    return 'other';
  },

  // ─── Active nav link ────────────────────────────

  setActiveNav() {
    const path = location.pathname.split('/').pop() || 'index.html';
    Utils.qsa('.nav-link').forEach(a => {
      const href = a.getAttribute('href')?.split('/').pop() || '';
      a.classList.toggle('active', href === path || (path === '' && href === 'index.html'));
    });
  },

  // ─── Burger menu ────────────────────────────────

  initBurger() {
    const btn   = Utils.qs('#burgerBtn');
    const links = Utils.qs('#navLinks');
    if (!btn || !links) return;
    btn.onclick = () => links.classList.toggle('open');
    document.addEventListener('click', e => {
      if (!btn.contains(e.target) && !links.contains(e.target)) links.classList.remove('open');
    });
  },
};

window.Utils = Utils;
