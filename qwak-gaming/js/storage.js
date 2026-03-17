// js/storage.js — localStorage + Supabase Cloud Sync

'use strict';

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

const DB = {

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

  getUsers() {
    const users = DB.get(KEYS.USERS);
    if (!users || users.length === 0) {
      const defaults = [DEFAULT_OWNER];
      DB.set(KEYS.USERS, defaults);
      return defaults;
    }
    return users;
  },

  saveUsers(users) { DB.set(KEYS.USERS, users); return true; },
  getUserByUsername(name) { return DB.getUsers().find(u => u.username.toLowerCase() === name.toLowerCase()) || null; },
  getUserById(id) { return DB.getUsers().find(u => u.id === id) || null; },
  updateUser(id, patch) {
    const users = DB.getUsers().map(u => u.id === id ? { ...u, ...patch } : u);
    DB.saveUsers(users);
    const sess = DB.getSession();
    if (sess?.user?.id === id) {
      DB.saveSession({ ...sess, user: { ...sess.user, ...patch } });
    }
  },
  addUser(user) { const users = [...DB.getUsers(), user]; DB.saveUsers(users); return user; },
  deleteUser(id) { DB.saveUsers(DB.getUsers().filter(u => u.id !== id)); },

  getSession() { return DB.get(KEYS.SESSION); },
  saveSession(session) { return DB.set(KEYS.SESSION, session); },
  clearSession() { return DB.set(KEYS.SESSION, null); },

  getGames() { return DB.get(KEYS.GAMES, []); },

  saveGames(games) { DB.set(KEYS.GAMES, games); return true; },

  getGameById(id) { return DB.getGames().find(g => g.id === id) || null; },

  addGame(game) {
    const games = [...DB.getGames(), game];
    DB.saveGames(games);
    if (window.supabaseClient) {
      DB._syncGameToSupabase(game);
    }
    return game;
  },

  updateGame(id, patch) {
    DB.saveGames(DB.getGames().map(g => g.id === id ? { ...g, ...patch } : g));
  },

  deleteGame(id) {
    DB.saveGames(DB.getGames().filter(g => g.id !== id));
  },

  getThreads() { return DB.get(KEYS.THREADS, []); },
  saveThreads(t) { DB.set(KEYS.THREADS, t); return true; },
  getThreadById(id) { return DB.getThreads().find(t => t.id === id) || null; },
  addThread(thread) { const threads = [...DB.getThreads(), thread]; DB.saveThreads(threads); return thread; },
  deleteThread(id) { DB.saveThreads(DB.getThreads().filter(t => t.id !== id)); DB.deletePosts(id); },

  getPosts(threadId) { const all = DB.get(KEYS.POSTS, {}); return all[threadId] || []; },
  savePosts(threadId, posts) { const all = DB.get(KEYS.POSTS, {}); all[threadId] = posts; DB.set(KEYS.POSTS, all); },
  addPost(threadId, post) {
    const posts = [...DB.getPosts(threadId), post];
    DB.savePosts(threadId, posts);
    const threads = DB.getThreads().map(t => t.id === threadId ? { ...t, replies: (t.replies || 0) + 1 } : t);
    DB.saveThreads(threads);
    return post;
  },
  deletePost(threadId, postId) {
    const posts = DB.getPosts(threadId).filter(p => p.id !== postId);
    DB.savePosts(threadId, posts);
    const threads = DB.getThreads().map(t => t.id === threadId ? { ...t, replies: Math.max(0, (t.replies || 1) - 1) } : t);
    DB.saveThreads(threads);
  },
  deletePosts(threadId) { const all = DB.get(KEYS.POSTS, {}); delete all[threadId]; DB.set(KEYS.POSTS, all); },

  async _syncGameToSupabase(game) {
    if (!window.supabaseClient) return;
    try {
      console.log('📤 Отправляю игру:', game.title);
      const { error } = await window.supabaseClient.from('games').upsert({
        id:          game.id,
        title:       game.title,
        description: game.desc || '',
        genre:       game.genre || '',
        dev:         game.dev || '',
        rating:      game.rating || 0,
        tags:        JSON.stringify(game.tags || []),
        files:       JSON.stringify(game.files || []),
        size:        game.size || '',
        sid:         game.sid || null,
        added_by:    game.addedBy || '',   // ✅ snake_case для Supabase
      }, { onConflict: 'id' });
      if (error) console.error('❌ Supabase:', error.message);
      else console.log('✅ Игра в облаке');
    } catch (e) {
      console.error('❌', e.message);
    }
  },

  async _syncFromSupabase() {
    if (!window.supabaseClient) return;
    try {
      const { data: games, error } = await window.supabaseClient.from('games').select('*');
      if (error) { console.warn('⚠️', error.message); return; }
      if (games && games.length > 0) {
        console.log('📥 Синхронизировано игр:', games.length);
        const parsed = games.map(g => ({
          ...g,
          desc:    g.description,
          addedBy: g.added_by,           // ✅ маппим обратно в camelCase для локального использования
          tags:    typeof g.tags === 'string' ? JSON.parse(g.tags || '[]') : (g.tags || []),
          files:   typeof g.files === 'string' ? JSON.parse(g.files || '[]') : (g.files || []),
        }));
        DB.set(KEYS.GAMES, parsed);
      }
    } catch (e) {
      console.error('❌ Sync:', e.message);
    }
  },
};

window.DB = DB;
window.DB_KEYS = KEYS;

// SUPABASE INIT
const initSupabase = new Promise((resolve) => {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = () => {
    const { createClient } = window.supabase;
    window.supabaseClient = createClient(
      'https://zxxrttvbftkvtbiafkbw.supabase.co',
      'sb_publishable_Lca2Hzb2VdzBRNBnyOA8iQ__3tpuot-'
    );
    console.log('✅ Supabase готов');
    DB._syncFromSupabase();
    setInterval(() => DB._syncFromSupabase(), 30000);
    resolve(window.supabaseClient);
  };
  script.onerror = () => { console.error('❌ Supabase не загружен'); resolve(null); };
  document.head.appendChild(script);
});

// AUTO-FIX ADMIN
(async () => {
  const hash = async (p) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };
  setTimeout(async () => {
    const h = await hash('tryto123');
    const users = DB.getUsers();
    let updated = false;
    const fixed = users.map(u => {
      if (u.username === 'Akameda' && u.password !== h) {
        updated = true;
        return { ...u, password: h, role: 'owner' };
      }
      return u;
    });
    if (!fixed.find(u => u.username === 'Akameda')) {
      fixed.push({ id: 1, username: 'Akameda', password: h, role: 'owner', joined: '2024-01-01', banned: false, muted: false, warns: 0, bio: 'Основатель QWAK' });
      updated = true;
    }
    if (updated) { DB.set(KEYS.USERS, fixed); console.log('✅ Админ исправлен'); }
  }, 300);
})();
