// js/forum.js — Forum: categories, threads, posts

'use strict';

const FORUM_CATS = [
  { id: 1, icon: '💬', name: 'Общее обсуждение', desc: 'Разговоры обо всём игровом' },
  { id: 2, icon: '📖', name: 'Гайды и советы',   desc: 'Стратегии и подсказки' },
  { id: 3, icon: '🔧', name: 'Техническая помощь', desc: 'Помощь с техническими проблемами' },
  { id: 4, icon: '🌐', name: 'Оффтопик',          desc: 'Всё остальное' },
];

const Forum = {

  getCat(id) { return FORUM_CATS.find(c => c.id === id); },

  // ─── Category list ───────────────────────────────

  renderCats(containerId) {
    const container = Utils.qs(`#${containerId}`);
    if (!container) return;
    container.innerHTML = '';
    FORUM_CATS.forEach(cat => {
      const threads = DB.getThreads().filter(t => t.catId === cat.id);
      const block = Utils.el('div', { class: 'forum-cat' });

      // Header
      const header = Utils.el('div', { class: 'forum-cat__header' });
      const info   = Utils.el('div', { class: 'forum-cat__info' });
      const icon   = Utils.el('span', { class: 'forum-cat__icon', text: cat.icon });
      const details = Utils.el('div');
      const nameEl = Utils.el('a', { class: 'forum-cat__name', href: `cat.html?id=${cat.id}`, text: cat.name });
      const descEl = Utils.el('div', { class: 'forum-cat__desc', text: cat.desc });
      details.append(nameEl, descEl);
      info.append(icon, details);

      const actions = Utils.el('div', { class: 'forum-cat__actions' });
      const count   = Utils.el('span', { class: 'forum-cat__count', text: `${threads.length} тем` });
      actions.append(count);
      if (Auth.isLoggedIn()) {
        const newBtn = Utils.el('button', { class: 'btn btn--outline btn--xs', text: '+ Тема' });
        newBtn.onclick = () => Forum.openNewThreadModal(cat.id, () => Forum.renderCats(containerId));
        actions.append(newBtn);
      }
      header.append(info, actions);
      block.append(header);

      // Thread preview (latest 3)
      const threadsWrap = Utils.el('div', { class: 'forum-cat__threads' });
      threads.slice(0, 3).forEach(t => threadsWrap.appendChild(Forum._threadRowEl(t)));
      if (!threads.length) {
        threadsWrap.innerHTML = `<div class="text-xs text-faint" style="padding:12px 18px">Нет тем — будь первым!</div>`;
      }
      block.append(threadsWrap);
      container.append(block);
    });
  },

  // ─── Thread list in category ─────────────────────

  renderCatThreads(containerId, catId) {
    const container = Utils.qs(`#${containerId}`);
    if (!container) return;
    const threads = DB.getThreads().filter(t => t.catId === catId);
    container.innerHTML = '';
    if (!threads.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">💬</div><div class="empty-state__title">Нет тем</div><div class="empty-state__desc">Создайте первую тему!</div></div>`;
      return;
    }
    const wrap = Utils.el('div', { class: 'glass', style: 'border-radius:var(--radius-lg);overflow:hidden' });
    threads.forEach(t => wrap.appendChild(Forum._threadRowEl(t)));
    container.append(wrap);
  },

  _threadRowEl(t) {
    const row = Utils.el('div', {
      class: `thread-row${t.pinned ? ' thread-row--pinned' : ''}`,
    });
    row.innerHTML = `
      <div class="thread-row__left">
        <div class="thread-row__title">${t.pinned ? '📌 ' : ''}${t.locked ? '🔒 ' : ''}${t.title}</div>
        <div class="thread-row__meta">${t.author} · ${t.date}</div>
      </div>
      <div class="thread-row__right">
        <div>${t.views || 0} просм.</div>
        <div class="thread-row__replies">${t.replies || 0} отв.</div>
      </div>`;
    row.onclick = () => { location.href = `thread.html?id=${t.id}`; };
    return row;
  },

  // ─── Thread posts ────────────────────────────────

  renderPosts(containerId, threadId) {
    const container = Utils.qs(`#${containerId}`);
    if (!container) return;
    const posts = DB.getPosts(threadId);
    container.innerHTML = '';
    if (!posts.length) {
      container.innerHTML = `<div class="text-muted text-sm" style="padding:20px">Нет постов</div>`;
      return;
    }
    posts.forEach(p => container.appendChild(Forum._postEl(p, threadId)));
  },

  _postEl(p, threadId) {
    const card = Utils.el('div', { class: 'post-card' });
    const actions = [];
    if (Auth.canModerate() && Auth.getCurrentUser()?.username !== p.author) {
      actions.push(`<button class="btn btn--red btn--xs del-post-btn" data-pid="${p.id}" data-tid="${threadId}">Удалить</button>`);
    }
    card.innerHTML = `
      <div class="post-card__header">
        <div class="post-card__author">
          <div class="post-card__avatar">${p.author[0].toUpperCase()}</div>
          <div>
            <div class="post-card__name">${p.author}</div>
            <div class="post-card__role-date">
              ${Utils.roleBadge(p.role)}
              <span class="post-card__date">${p.date}</span>
            </div>
          </div>
        </div>
        <div class="post-card__actions">
          <span class="post-card__likes">👍 ${p.likes || 0}</span>
          ${actions.join('')}
        </div>
      </div>
      <div class="post-card__body">${p.text.replace(/\n/g, '<br>')}</div>`;

    card.querySelectorAll('.del-post-btn').forEach(btn => {
      btn.onclick = async () => {
        if (await Utils.confirm('Удалить этот пост?')) {
          DB.deletePost(parseInt(btn.dataset.tid), parseInt(btn.dataset.pid));
          btn.closest('.post-card').remove();
          Utils.toast('Пост удалён');
        }
      };
    });
    return card;
  },

  // ─── New thread modal ─────────────────────────────

  openNewThreadModal(catId, onCreated) {
    if (!Auth.isLoggedIn()) { Utils.toast('Войдите чтобы создать тему', 'err'); return; }
    const user = Auth.getCurrentUser();
    if (DB.getUserById(user.id)?.muted) { Utils.toast('Вы заглушены', 'err'); return; }

    const cat = Forum.getCat(catId);
    const wrap = Utils.el('div');
    wrap.innerHTML = `
      <div class="modal__title">💬 Новая тема — ${cat?.name || ''}</div>
      <div class="field">
        <div class="field__label">Заголовок *</div>
        <input id="nt-title" placeholder="Тема обсуждения...">
      </div>
      <div class="field">
        <div class="field__label">Сообщение *</div>
        <textarea id="nt-text" style="min-height:120px" placeholder="Начните обсуждение..."></textarea>
        <div class="field__error hidden" id="nt-err"></div>
      </div>
      <button class="btn btn--primary btn--full mt-3" id="nt-submit">Создать тему</button>`;

    const { overlay, close } = Utils.openModal(wrap);
    Utils.qs('#nt-submit', overlay).onclick = () => {
      const title = Utils.qs('#nt-title', overlay).value.trim();
      const text  = Utils.qs('#nt-text',  overlay).value.trim();
      const err   = Utils.qs('#nt-err',   overlay);
      if (!title || !text) { err.textContent = 'Заполните все поля'; err.classList.remove('hidden'); return; }

      const thread = {
        id:      Utils.uid(),
        catId,
        title,
        author:  user.username,
        role:    user.role,
        date:    Utils.nowDate(),
        views:   1,
        replies: 1,
        pinned:  false,
        locked:  false,
      };
      const post = {
        id:     Utils.uid() + 1,
        author: user.username,
        role:   user.role,
        text,
        date:   Utils.nowDate(),
        likes:  0,
      };
      DB.addThread(thread);
      DB.savePosts(thread.id, [post]);
      close();
      Utils.toast('Тема создана!');
      onCreated?.(thread);
      location.href = `thread.html?id=${thread.id}`;
    };
  },

  // ─── Reply ───────────────────────────────────────

  submitReply(threadId, text, onAdded) {
    if (!Auth.isLoggedIn()) { Utils.toast('Войдите чтобы ответить', 'err'); return false; }
    const user = Auth.getCurrentUser();
    if (DB.getUserById(user.id)?.muted) { Utils.toast('Вы заглушены', 'err'); return false; }
    if (!text.trim()) { Utils.toast('Введите сообщение', 'err'); return false; }

    const post = {
      id:     Utils.uid(),
      author: user.username,
      role:   user.role,
      text:   text.trim(),
      date:   Utils.nowDate(),
      likes:  0,
    };
    DB.addPost(threadId, post);
    onAdded?.(post);
    return true;
  },
};

window.Forum = Forum;
window.FORUM_CATS = FORUM_CATS;
