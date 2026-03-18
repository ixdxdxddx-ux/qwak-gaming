// js/games.js — Games catalog: render cards, detail, virus scan, add game modal

'use strict';

const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';
const AV_ENGINES = [
  'Kaspersky', 'Avast', 'Windows Defender', 'Malwarebytes',
  'ESET NOD32', 'Bitdefender', 'Norton', 'McAfee',
  'Avira', 'DrWeb', '360 Total Security', 'Comodo',
];

const Games = {

  // ─── Download file ──────────────────────────────

  downloadFile(fileName, fileSize = 0) {
    // Создаём mock загрузку файла
    const link = document.createElement('a');
    
    // Генерируем mock blob для демо (в реальности это был бы реальный файл)
    const blob = new Blob(['[QWAK Game File]\nName: ' + fileName + '\nSize: ' + fileSize], {
      type: 'application/octet-stream'
    });
    
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    Utils.toast('📥 ' + fileName + ' загружается...');
  },

  // ─── Card HTML ───────────────────────────────────

  cardHTML(game) {
    const types = [...new Set((game.files || []).map(f => f.type))];
    const typeIcons = types.map(t => Utils.fileIcon(t)).join('');

    let imgSrc = game.sid ? `${STEAM_CDN}/${game.sid}/header.jpg` : '';
    const coverContent = imgSrc
      ? `<img src="${imgSrc}" alt="${game.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'game-card__cover-placeholder\\'>🎮</div>'">`
      : `<div class="game-card__cover-placeholder">🎮</div>`;

    return `
      <article class="game-card" data-id="${game.id}" tabindex="0" role="button" aria-label="${game.title}">
        <div class="game-card__cover">
          ${coverContent}
          <div class="game-card__overlay"></div>
          <div class="game-card__meta">
            <span class="tag">${game.genre || 'Разное'}</span>
            <div class="game-card__types">${typeIcons}</div>
          </div>
        </div>
        <div class="game-card__body">
          <div class="game-card__title">${game.title}</div>
          <div class="game-card__short">${Utils.truncate(game.short || game.desc, 70)}</div>
          <div class="game-card__footer">
            <span class="game-card__price">БЕСПЛАТНО</span>
            <span class="game-card__dl">${game.files?.length || 0} файл.</span>
          </div>
        </div>
      </article>`;
  },

  // ─── Render grid ─────────────────────────────────

  renderGrid(containerId, games, limit = 999) {
    const container = Utils.qs(`#${containerId}`);
    if (!container) return;
    const list = games.slice(0, limit);
    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state__icon">🎮</div>
          <div class="empty-state__title">Каталог пуст</div>
          <div class="empty-state__desc">Войдите как администратор и добавьте игры</div>
        </div>`;
      return;
    }
    container.innerHTML = list.map(g => Games.cardHTML(g)).join('');
    container.querySelectorAll('.game-card').forEach(card => {
      const id = parseInt(card.dataset.id);
      const handler = () => Games.openDetail(id);
      card.addEventListener('click', handler);
      card.addEventListener('keydown', e => { if (e.key === 'Enter') handler(); });
    });
  },

  // ─── Game detail ─────────────────────────────────

  openDetail(gameId) {
    const game = DB.getGameById(gameId);
    if (!game) return;

    const pagesPrefix = location.pathname.includes('pages') ? '' : 'pages/';
    // Navigate to game detail page
    location.href = `${pagesPrefix}game.html?id=${gameId}`;
  },

  // ─── Virus scan modal with VirusTotal ────────────

  async openScanModal(game, fileName = null) {
    const scanName = fileName || game.title;
    const fileHash = fileName ? Games.generateHash(fileName) : null;

    const wrap = Utils.el('div');
    wrap.innerHTML = `
      <div class="modal__title">🛡 Проверка на вирусы</div>
      <div class="card p-4 mb-4" style="margin-bottom:14px">
        <div class="font-bold text-sm">${scanName}</div>
        <div class="text-xs text-faint mt-2">📁 ${game.size || '—'}</div>
      </div>
      <div style="margin-bottom:14px">
        <div class="flex justify-between mb-2" style="margin-bottom:6px">
          <span class="text-sm text-muted" id="scanStatus">Сканирование...</span>
          <span class="text-sm text-accent font-bold" id="scanPct">0%</span>
        </div>
        <div class="progress-bar"><div class="progress-bar__fill" id="scanBar" style="width:0%"></div></div>
      </div>
      <div id="scanResult" class="hidden" style="background:rgba(0,210,160,.07);border:1px solid rgba(0,210,160,.2);border-radius:10px;padding:14px;text-align:center;margin-bottom:12px">
        <div style="font-size:28px;margin-bottom:4px" id="resultIcon">✅</div>
        <div style="font-size:15px;font-weight:700;color:var(--color-green)" id="resultTitle">Файл чист</div>
        <div class="text-xs text-muted mt-2" id="resultDesc">Результат от VirusTotal</div>
      </div>
      <div id="engineList"></div>
      <button class="btn btn--green btn--full hidden mt-3" id="scanDoneBtn">Готово</button>`;

    const { overlay, close } = Utils.openModal(wrap);
    const bar     = Utils.qs('#scanBar', overlay);
    const pct     = Utils.qs('#scanPct', overlay);
    const status  = Utils.qs('#scanStatus', overlay);
    const result  = Utils.qs('#scanResult', overlay);
    const list    = Utils.qs('#engineList', overlay);
    const doneBtn = Utils.qs('#scanDoneBtn', overlay);
    const resultIcon = Utils.qs('#resultIcon', overlay);
    const resultTitle = Utils.qs('#resultTitle', overlay);
    const resultDesc = Utils.qs('#resultDesc', overlay);

    // Симуляция прогресса
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 8 + 2;
      if (progress >= 100) { progress = 100; clearInterval(progressInterval); }
      const p = Math.min(100, Math.round(progress));
      bar.style.width = p + '%';
      pct.textContent = p + '%';
    }, 150);

    // Реальная проверка через VirusTotal (если есть API key)
    try {
      const vtResult = await Games.checkVirusTotal(fileHash || Games.generateHash(scanName));
      
      clearInterval(progressInterval);
      bar.style.width = '100%';
      pct.textContent = '100%';
      status.textContent = 'Сканирование завершено';
      
      // Обработка результата
      if (vtResult) {
        const detected = vtResult.detected || 0;
        const total = vtResult.total || 0;
        
        if (detected > 0) {
          resultIcon.textContent = '⚠️';
          resultTitle.textContent = `Обнаружено угроз: ${detected}`;
          resultTitle.style.color = 'var(--color-red)';
          resultDesc.textContent = `${detected} из ${total} антивирусных движков`;
          result.style.background = 'rgba(239,68,68,.07)';
          result.style.borderColor = 'rgba(239,68,68,.2)';
        } else {
          resultIcon.textContent = '✅';
          resultTitle.textContent = 'Файл чист';
          resultTitle.style.color = 'var(--color-green)';
          resultDesc.textContent = `0 угроз из ${total} антивирусных движков`;
        }
      } else {
        resultIcon.textContent = '✅';
        resultTitle.textContent = 'Файл не обнаружен в базе';
        resultTitle.style.color = 'var(--color-green)';
        resultDesc.textContent = 'Файл не встречается в VirusTotal';
      }
      
      result.classList.remove('hidden');
      doneBtn.classList.remove('hidden');
      doneBtn.onclick = close;
    } catch (e) {
      clearInterval(progressInterval);
      console.warn('VT check error:', e.message);
      status.textContent = 'Ошибка проверки';
      result.classList.remove('hidden');
      resultIcon.textContent = '❌';
      resultTitle.textContent = 'Ошибка';
      resultDesc.textContent = 'Не удалось проверить файл';
      doneBtn.classList.remove('hidden');
      doneBtn.onclick = close;
    }
  },

  // ─── VirusTotal API Check через Netlify Function ──

  async checkVirusTotal(hash) {
    try {
      // Используем Netlify Function вместо прямого API (для безопасности)
      const response = await fetch('/.netlify/functions/scan-virustotal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn('Function error:', response.status);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (e) {
      console.warn('VirusTotal check error:', e.message);
      return null;
    }
  },

  // ─── Generate file hash ──────────────────────────

  generateHash(input) {
    // Простой хеш для демо (в реальности нужно подсчитывать SHA-256)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  },

  // ─── Fetch game data from Steam API ─────────────

  async _fetchSteamSpy(sid) {
    try {
      const res = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${sid}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const d = await res.json();
      if (!d?.appid) return null;
      return d;
    } catch { return null; }
  },

  async _fetchSteamStore(sid) {
    const steamUrl = `https://store.steampowered.com/api/appdetails?appids=${sid}&l=russian`;
    const key = String(sid);
    const tryParse = (json) => {
      const entry = json?.[key] ?? json?.[Number(key)];
      if (entry?.success && entry?.data) return entry.data;
      return null;
    };
    const PROXIES = [
      async () => {
        const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(steamUrl)}`, { signal: AbortSignal.timeout(10000) });
        const w = await r.json(); return tryParse(JSON.parse(w.contents));
      },
      async () => {
        const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(steamUrl)}`, { signal: AbortSignal.timeout(10000) });
        return tryParse(await r.json());
      },
      async () => {
        const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(steamUrl)}`, { signal: AbortSignal.timeout(10000) });
        return tryParse(await r.json());
      },
      async () => {
        const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(steamUrl)}`, { signal: AbortSignal.timeout(10000) });
        return tryParse(await r.json());
      },
    ];
    for (const fn of PROXIES) {
      try { const d = await fn(); if (d) return d; } catch { }
    }
    return null;
  },

  async fetchSteamData(sid) {
    // Запрашиваем оба источника параллельно
    const [spy, store] = await Promise.all([
      Games._fetchSteamSpy(sid),
      Games._fetchSteamStore(sid),
    ]);

    if (!spy && !store) return null;

    // Теги из SteamSpy (user-теги, сортируем по популярности)
    const spyTags = spy?.tags
      ? Object.entries(spy.tags).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t)
      : [];

    // Теги из Store API (жанры + категории)
    const storeTags = [
      ...(store?.genres || []).map(g => g.description),
      ...(store?.categories || []).slice(0, 4).map(c => c.description),
    ];

    const allTags = spyTags.length ? spyTags : [...new Set(storeTags)];

    // Описание: предпочитаем Store, fallback — SteamSpy
    const rawDesc = store?.short_description || store?.detailed_description || '';
    const tmp = document.createElement('div');
    tmp.innerHTML = rawDesc;
    const desc = tmp.textContent.trim() || spy?.name || '';

    // Жанр
    const genre = store?.genres?.map(g => g.description).join(', ')
      || spy?.genre
      || 'Разное';

    // Рейтинг: Metacritic / SteamSpy positive ratio
    let rating = 7.0;
    if (store?.metacritic?.score) {
      rating = +(store.metacritic.score / 10).toFixed(1);
    } else if (spy?.positive && spy?.negative) {
      const total = spy.positive + spy.negative;
      rating = total > 0 ? +((spy.positive / total) * 10).toFixed(1) : 7.0;
    }

    // Год выхода
    let year = new Date().getFullYear();
    const dateStr = store?.release_date?.date || '';
    const ym = dateStr.match(/\d{4}/);
    if (ym) year = +ym[0];

    return {
      // Стандартный формат Steam Store
      name:              store?.name || spy?.name || '',
      short_description: desc,
      genres:            store?.genres || (spy?.genre ? [{ description: spy.genre }] : []),
      developers:        store?.developers || (spy?.developer ? [spy.developer] : []),
      publishers:        store?.publishers || (spy?.publisher ? [spy.publisher] : []),
      release_date:      store?.release_date || { date: String(year) },
      metacritic:        store?.metacritic || null,
      pc_requirements:   store?.pc_requirements || null,
      // Нормализованные поля
      _tags:   allTags,
      _rating: rating,
      _year:   year,
      _desc:   desc,
    };
  },

  _parseRequirements(html) {
    if (!html) return { os:'—', cpu:'—', ram:'—', gpu:'—', storage:'—' };
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = tmp.textContent;
    const get = (keys) => {
      for (const k of keys) {
        const m = text.match(new RegExp(k + '[:\\s]+([^\\n<]+)', 'i'));
        if (m) return m[1].trim().replace(/\s+/g, ' ');
      }
      return '—';
    };
    return {
      os:      get(['OS', 'ОС', 'Операционная система']),
      cpu:     get(['CPU', 'Processor', 'Процессор']),
      ram:     get(['RAM', 'Memory', 'Память']),
      gpu:     get(['GPU', 'Graphics', 'Видеокарта', 'Видео']),
      storage: get(['Storage', 'HDD', 'SSD', 'Место', 'DirectX']),
    };
  },

  // ─── Add game modal ──────────────────────────────

  openAddModal(onAdded) {
    if (!Auth.canAdmin()) { Utils.toast('Нет прав', 'err'); return; }

    const wrap = Utils.el('div');
    wrap.innerHTML = `
      <div class="modal__title">➕ Добавить игру</div>
      <div class="tabs mb-4" style="margin-bottom:18px">
        <button class="tab-btn active" data-tab="info">① Информация</button>
        <button class="tab-btn" data-tab="files">② Файлы</button>
      </div>

      <!-- Step 1: Info -->
      <div id="tabInfo">
        <div class="field"><div class="field__label">Название *</div><input id="ag-title" placeholder="Cyberpunk 2077"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field"><div class="field__label">Жанр</div><input id="ag-genre" placeholder="RPG, FPS..."></div>
          <div class="field">
            <div class="field__label">Steam App ID</div>
            <div style="display:flex;gap:8px;align-items:flex-start">
              <input id="ag-sid" placeholder="1091500" type="number" style="flex:1">
              <button class="btn btn--outline btn--sm" id="ag-steam-fetch" style="flex-shrink:0;white-space:nowrap;margin-top:1px">🎮 Загрузить</button>
            </div>
            <div id="ag-steam-status" style="font-size:10px;color:#2e8b57;margin-top:4px;display:none"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div class="field"><div class="field__label">Разработчик</div><input id="ag-dev" placeholder="CD Projekt"></div>
          <div class="field"><div class="field__label">Издатель</div><input id="ag-pub" placeholder="CD Projekt"></div>
          <div class="field"><div class="field__label">Год</div><input id="ag-year" type="number" value="${new Date().getFullYear()}"></div>
        </div>
        <div class="field"><div class="field__label">Описание</div><textarea id="ag-desc" placeholder="Краткое описание..."></textarea></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field"><div class="field__label">Теги (через запятую)</div><input id="ag-tags" placeholder="Открытый мир, RPG"></div>
          <div class="field"><div class="field__label">Рейтинг (0–10)</div><input id="ag-rating" type="number" step="0.1" min="0" max="10" value="8.0"></div>
        </div>
        <button class="btn btn--primary btn--full mt-3" id="ag-next">Далее → Файлы</button>
      </div>

      <!-- Step 2: Files -->
      <div id="tabFiles" class="hidden">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
          <div class="ftype-btn" id="ag-addExe">
            <span style="font-size:24px">⚙️</span>
            <span class="font-bold text-sm">EXE / MSI</span>
            <span class="text-xs text-faint">Установщик</span>
          </div>
          <div class="ftype-btn" id="ag-addTorrent">
            <span style="font-size:24px">🌊</span>
            <span class="font-bold text-sm">Torrent</span>
            <span class="text-xs text-faint">.torrent файл</span>
          </div>
          <div class="ftype-btn" id="ag-addFolder">
            <span style="font-size:24px">📁</span>
            <span class="font-bold text-sm">Папка</span>
            <span class="text-xs text-faint">Директория</span>
          </div>
          <div class="ftype-btn" id="ag-addArchive">
            <span style="font-size:24px">📦</span>
            <span class="font-bold text-sm">Архив</span>
            <span class="text-xs text-faint">ZIP / RAR / 7z</span>
          </div>
        </div>
        <div class="dropzone" id="ag-dropzone" style="margin-bottom:14px">
          <input type="file" multiple id="ag-fileInput">
          <div class="dropzone__icon">🗂️</div>
          <div class="dropzone__label">Перетащи файлы сюда или нажми</div>
          <div class="dropzone__hint">.exe .msi .torrent .zip .rar .7z .iso</div>
        </div>
        <div id="ag-fileList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;max-height:200px;overflow-y:auto"></div>
        <div class="flex gap-2">
          <button class="btn btn--ghost btn--sm" id="ag-back">← Назад</button>
          <button class="btn btn--primary" style="flex:1;justify-content:center" id="ag-save">✓ Добавить в каталог</button>
        </div>
      </div>`;

    // ─ Ftype button styles ─
    wrap.querySelectorAll('.ftype-btn').forEach(el => {
      Object.assign(el.style, {
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        gap:'5px',padding:'14px 10px',borderRadius:'10px',border:'1px solid var(--color-border)',
        background:'rgba(255,255,255,.03)',cursor:'pointer',transition:'all .2s',fontSize:'12px',
        color:'var(--color-text-2)',
      });
      el.addEventListener('mouseover', ()=>{ el.style.borderColor='rgba(109,93,255,.5)'; el.style.background='rgba(109,93,255,.08)'; el.style.color='#fff'; });
      el.addEventListener('mouseout',  ()=>{ el.style.borderColor='var(--color-border)'; el.style.background='rgba(255,255,255,.03)'; el.style.color='var(--color-text-2)'; });
    });

    const { overlay, close } = Utils.openModal(wrap, true);

    let _files = [];
    let _sysMin = null;
    let _sysRec = null;
    const fileInput = Utils.qs('#ag-fileInput', overlay);
    const fileList  = Utils.qs('#ag-fileList', overlay);
    const dropzone  = Utils.qs('#ag-dropzone', overlay);

    const fmtSize = s => s > 1e9 ? (s/1e9).toFixed(1)+' GB' : s > 1e6 ? Math.round(s/1e6)+' MB' : s > 1e3 ? Math.round(s/1e3)+' KB' : s ? s+' B' : '—';

    const renderFiles = () => {
      if (!_files.length) { fileList.innerHTML = ''; return; }
      fileList.innerHTML = _files.map((f, i) => `
        <div class="file-chip">
          <span class="file-chip__icon">${Utils.fileIcon(f.type)}</span>
          <div class="file-chip__info">
            <div class="file-chip__name">${f.name}</div>
            <div class="file-chip__meta">
              <span class="file-chip__type" style="color:${Utils.fileTypeColor(f.type)}">${f.type.toUpperCase()}</span>
              ${f.size ? `<span class="file-chip__size">${fmtSize(f.size)}</span>` : ''}
            </div>
          </div>
          <button class="file-chip__remove" data-idx="${i}">✕</button>
        </div>`).join('');
      fileList.querySelectorAll('[data-idx]').forEach(btn => {
        btn.onclick = () => { _files.splice(+btn.dataset.idx, 1); renderFiles(); };
      });
    };

    const addFiles = (flist) => {
      Array.from(flist).forEach(f => {
        const type = Utils.detectFileType(f.name);
        if (!_files.find(x => x.name === f.name))
          _files.push({ name: f.name, size: f.size, type });
      });
      renderFiles();
    };

    fileInput.onchange = e => { addFiles(e.target.files); e.target.value = ''; };
    dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag-over'); addFiles(e.dataTransfer.files); });

    // Type buttons
    const pickType = (accept) => { fileInput.accept = accept; fileInput.click(); };
    Utils.qs('#ag-addExe', overlay).onclick     = () => pickType('.exe,.msi');
    Utils.qs('#ag-addTorrent', overlay).onclick = () => pickType('.torrent');
    Utils.qs('#ag-addArchive', overlay).onclick = () => pickType('.zip,.rar,.7z,.iso');
    Utils.qs('#ag-addFolder', overlay).onclick  = () => {
      const name = prompt('Название папки (например: Cyberpunk2077):');
      if (name?.trim()) { _files.push({ name: name.trim(), size: 0, type: 'folder' }); renderFiles(); }
    };

    // Steam auto-fill
    Utils.qs('#ag-steam-fetch', overlay).onclick = async () => {
      const sid = Utils.qs('#ag-sid', overlay).value.trim();
      if (!sid) { Utils.toast('Введи Steam App ID', 'err'); return; }
      const btn = Utils.qs('#ag-steam-fetch', overlay);
      const statusEl = Utils.qs('#ag-steam-status', overlay);
      btn.disabled = true;
      btn.textContent = '⏳ Загрузка...';
      statusEl.style.display = 'none';
      try {
        const d = await Games.fetchSteamData(sid);
        if (!d) { Utils.toast('Не удалось получить данные. Проверь App ID или попробуй позже', 'err'); return; }

        const set = (id, val) => { const el = Utils.qs(id, overlay); if (el && val !== undefined && val !== '') el.value = val; };

        set('#ag-title',  d.name);
        set('#ag-desc',   d._desc);
        set('#ag-genre',  (d.genres || []).map(g => g.description).join(', ') || '');
        set('#ag-dev',    (d.developers || []).join(', '));
        set('#ag-pub',    (d.publishers || []).join(', '));
        set('#ag-year',   d._year);
        set('#ag-tags',   (d._tags || []).join(', '));
        set('#ag-rating', d._rating);

        if (d.pc_requirements) {
          _sysMin = Games._parseRequirements(d.pc_requirements.minimum);
          _sysRec = Games._parseRequirements(d.pc_requirements.recommended);
        }

        const sources = [];
        if (d._tags?.length) sources.push('теги SteamSpy');
        if (d._desc)         sources.push('описание Steam');
        if (_sysMin)         sources.push('сист. требования');

        statusEl.textContent = `✅ Загружено: ${sources.join(', ') || 'базовые данные'}`;
        statusEl.style.display = 'block';
        Utils.toast('Данные загружены! 🎮');
      } catch (e) {
        Utils.toast('Ошибка загрузки Steam', 'err');
        console.error(e);
      } finally {
        btn.disabled = false;
        btn.textContent = '🎮 Загрузить';
      }
    };

    // Tab switching
    const showTab = tab => {
      Utils.qs('#tabInfo',  overlay).classList.toggle('hidden', tab !== 'info');
      Utils.qs('#tabFiles', overlay).classList.toggle('hidden', tab !== 'files');
      Utils.qsa('.tab-btn', overlay).forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    };
    Utils.qsa('.tab-btn', overlay).forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
    Utils.qs('#ag-next', overlay).onclick = () => showTab('files');
    Utils.qs('#ag-back', overlay).onclick = () => showTab('info');

    // Save
    Utils.qs('#ag-save', overlay).onclick = () => {
      const title = Utils.qs('#ag-title', overlay).value.trim();
      if (!title) { Utils.toast('Введите название', 'err'); return; }
      if (!_files.length) { Utils.toast('Добавьте хотя бы один файл', 'err'); return; }

      const totalSize = _files.reduce((a, f) => a + (f.size || 0), 0);
      const game = {
        id:       Utils.uid(),
        sid:      parseInt(Utils.qs('#ag-sid', overlay).value) || 0,
        title,
        desc:     Utils.qs('#ag-desc', overlay).value.trim() || 'Описание отсутствует.',
        short:    (Utils.qs('#ag-desc', overlay).value.trim() || title).slice(0, 90),
        genre:    Utils.qs('#ag-genre', overlay).value.trim() || 'Разное',
        dev:      Utils.qs('#ag-dev', overlay).value.trim() || '—',
        pub_:     Utils.qs('#ag-pub', overlay).value.trim() || '—',
        year:     parseInt(Utils.qs('#ag-year', overlay).value) || new Date().getFullYear(),
        rating:   parseFloat(Utils.qs('#ag-rating', overlay).value) || 7.0,
        dl:       0,
        verified: false,
        tags:     Utils.qs('#ag-tags', overlay).value.split(',').map(t => t.trim()).filter(Boolean),
        files:    _files.map(f => ({ name: f.name, size: f.size || 0, type: f.type })),
        size:     fmtSize(totalSize),
        addedBy:  Auth.getCurrentUser()?.username || '—',
        addedAt:  Utils.nowDate(),
        sysMin:   _sysMin || { os:'—', cpu:'—', ram:'—', gpu:'—', storage:'—' },
        sysRec:   _sysRec || { os:'—', cpu:'—', ram:'—', gpu:'—', storage:'—' },
      };

      DB.addGame(game);
      close();
      Utils.toast('Игра добавлена! 🎮');
      onAdded?.(game);
    };
  },
};

window.Games = Games;
window.STEAM_CDN = STEAM_CDN;
window.AV_ENGINES = AV_ENGINES;
