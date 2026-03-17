// js/storage.js — Supabase Cloud Storage & Sync

'use strict';

// ============================================================================
// SUPABASE CONFIG
// ============================================================================

const SUPABASE_URL = 'https://zxxrttvbftkvtbiafkbw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Lca2Hzb2VdzBRNBnyOA8iQ__3tpuot-';

const KEYS = {
  USERS:   'qw_users',
  SESSION: 'qw_session',
  GAMES:   'qw_games',
  THREADS: 'qw_threads',
  POSTS:   'qw_posts',
};

const DEFAULT_OWNER = {
  id: 1,
  username: 'Akameda',
  password: 'ef92b778bafe771207340a706a4a22a41c4d9b59e32cf26e3e2e5f8177e5e5a',
  role: 'owner',
  joined: '2024-01-01',
  banned: false,
  muted: false,
  warns: 0,
  bio: 'Основатель QWAK',
};

// ============================================================================
// SUPABASE HELPER
// ============================================================================

const Supabase = {
  async request(table, method = 'GET', data = null) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/${table}`;
      const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      };

      const options = { method, headers };
      if (method !== 'GET') {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        console.warn(`Supabase error (${table}):`, response.status);
        return null;
      }

      return await response.json();
    } catch (e) {
      console.warn('Supabase error:', e.message);
      return null;
    }
  },

  async getAll(table) {
    const data = await Supabase.request(table, 'GET');
    return Array.isArray(data) ? data : [];
  },

  async insert(table, record) {
    return await Supabase.request(table, 'POST', record);
  },

  async upsert(table, record) {
    return await Supabase.request(table, 'POST', record);
  },
};

// ============================================================================
// DB OBJECT — Main API
// ============================================================================

const DB = {

  _syncTimer: null,
  _lastSync: 0,

  // ─── Init & Sync ────────────────────────────────

  async init() {
    // First sync immediately
    await DB.syncFromCloud();
    // Then every 15 seconds
    this._syncTimer = setInterval(() => DB.syncFromCloud(), 15000);
  },

  async syncFromCloud() {
    if (Date.now() - DB._lastSync < 8000) return;
    DB._lastSync = Date.now();

    if (!navigator.onLine) return;

    try {
      const [users, games, threads, posts] = await Promise.all([
        Supabase.getAll('users'),
        Supabase.getAll('games'),
        Supabase.getAll('threads'),
        Supabase.getAll('posts'),
      ]);

      if (users && users.length > 0) {
        DB.set(KEYS.USERS, users);
      }

      if (games && games.length > 0) {
        // Parse JSON fields
        const parsed = games.map(g => ({
          ...g,
          tags: typeof g.tags === 'string' ? JSON.parse(g.tags || '[]') : g.tags,
          files: typeof g.files === 'string' ? JSON.parse(g.files || '[]') : g.files,
        }));
        DB.set(KEYS.GAMES, parsed);
      }

      if (threads && threads.length > 0) {
        DB.set(KEYS.THREADS, threads);
      }

      if (posts && posts.length > 0) {
        const postsObj = {};
        posts.forEach(p => {
          if (!postsObj[p.threadId]) postsObj[p.threadId] = [];
          postsObj[p.threadId].push(p);
        });
        DB.set(KEYS.POSTS, postsObj);
      }
    } catch (e) {
      console.warn('Cloud sync error:', e.message);
    }
  },

  // ─── Raw get/set (localStorage) ──────────────────

  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },

  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },

  // ─── Users ──────────────────────────────────────

  getUsers() {
    const users = DB.get(KEYS.USERS);
    if (!users || users.length === 0) {
      const defaults = [DEFAULT_OWNER];
      DB.set(KEYS.USERS, defaults);
      Supabase.insert('users', DEFAULT_OWNER).catch(() => {});
      return defaults;
    }
    return users;
  },

  saveUsers(users) { 
    DB.set(KEYS.USERS, users);
    users.forEach(u => {
      Supabase.upsert('users', {
        id: u.id,
        username: u.username,
        role: u.role,
        joined: u.joined,
        banned: u.banned,
        muted: u.muted,
        warns: u.warns,
      }).catch(() => {});
    });
    return true;
  },

  getUserByUsername(name) {
    return DB.getUsers().find(u => u.username.toLowerCase() === name.toLowerCase()) || null;
  },

  getUserById(id) {
    return DB.getUsers().find(u => u.id === id) || null;
  },

  updateUser(id, patch) {
    const users = DB.getUsers().map(u => u.id === id ? { ...u, ...patch } : u);
    DB.saveUsers(users);

    const sess = DB.getSession();
    if (sess?.user?.id === id) {
      DB.saveSession({ ...sess, user: { ...sess.user, ...patch } });
    }
  },

  addUser(user) {
    const users = [...DB.getUsers(), user];
    DB.saveUsers(users);
    return user;
  },

  deleteUser(id) {
    DB.saveUsers(DB.getUsers().filter(u => u.id !== id));
  },

  // ─── Session ────────────────────────────────────

  getSession() { return DB.get(KEYS.SESSION); },

  saveSession(session) { return DB.set(KEYS.SESSION, session); },

  clearSession() { return DB.set(KEYS.SESSION, null); },

  // ─── Games ──────────────────────────────────────

  getGames() { return DB.get(KEYS.GAMES, []); },

  saveGames(games) { 
    DB.set(KEYS.GAMES, games);
    games.forEach(g => {
      Supabase.upsert('games', {
        id: g.id,
        title: g.title,
        desc: g.desc,
        genre: g.genre,
        dev: g.dev,
        rating: g.rating,
        tags: JSON.stringify(g.tags || []),
        files: JSON.stringify(g.files || []),
        size: g.size,
        sid: g.sid,
        addedBy: g.addedBy,
        addedAt: g.addedAt,
      }).catch(() => {});
    });
    return true;
  },

  getGameById(id) { return DB.getGames().find(g => g.id === id) || null; },

  addGame(game) {
    const games = [...DB.getGames(), game];
    DB.saveGames(games);
    return game;
  },

  updateGame(id, patch) {
    DB.saveGames(DB.getGames().map(g => g.id === id ? { ...g, ...patch } : g));
  },

  deleteGame(id) {
    DB.saveGames(DB.getGames().filter(g => g.id !== id));
  },

  // ─── Threads ────────────────────────────────────

  getThreads() { return DB.get(KEYS.THREADS, []); },

  saveThreads(t) { 
    DB.set(KEYS.THREADS, t);
    t.forEach(thread => {
      Supabase.upsert('threads', {
        id: thread.id,
        catId: thread.catId,
        title: thread.title,
        author: thread.author,
        date: thread.date,
        replies: thread.replies || 0,
        locked: thread.locked || false,
      }).catch(() => {});
    });
    return true;
  },

  getThreadById(id) { return DB.getThreads().find(t => t.id === id) || null; },

  addThread(thread) {
    const threads = [...DB.getThreads(), thread];
    DB.saveThreads(threads);
    return thread;
  },

  deleteThread(id) {
    DB.saveThreads(DB.getThreads().filter(t => t.id !== id));
    DB.deletePosts(id);
  },

  // ─── Posts ──────────────────────────────────────

  getPosts(threadId) {
    const all = DB.get(KEYS.POSTS, {});
    return all[threadId] || [];
  },

  savePosts(threadId, posts) {
    const all = DB.get(KEYS.POSTS, {});
    all[threadId] = posts;
    DB.set(KEYS.POSTS, all);
    posts.forEach(p => {
      Supabase.upsert('posts', {
        id: p.id,
        threadId,
        author: p.author,
        text: p.text,
        date: p.date,
        likes: p.likes || 0,
      }).catch(() => {});
    });
  },

  addPost(threadId, post) {
    const posts = [...DB.getPosts(threadId), post];
    DB.savePosts(threadId, posts);
    
    const threads = DB.getThreads().map(t =>
      t.id === threadId ? { ...t, replies: (t.replies || 0) + 1 } : t
    );
    DB.saveThreads(threads);
    return post;
  },

  deletePost(threadId, postId) {
    const posts = DB.getPosts(threadId).filter(p => p.id !== postId);
    DB.savePosts(threadId, posts);
    
    const threads = DB.getThreads().map(t =>
      t.id === threadId ? { ...t, replies: Math.max(0, (t.replies || 1) - 1) } : t
    );
    DB.saveThreads(threads);
  },

  deletePosts(threadId) {
    const all = DB.get(KEYS.POSTS, {});
    delete all[threadId];
    DB.set(KEYS.POSTS, all);
  },
};

window.DB = DB;
window.DB_KEYS = KEYS;

// Auto-init on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DB.init());
} else {
  DB.init();
}
