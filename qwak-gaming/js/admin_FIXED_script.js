// 📋 ДОБАВЬ ЭТОТ КОД В КОНЕЦ admin.html скрипта
// Это обеспечит автоматическое обновление списка пользователей

// ✅ FIX: Автоматическое обновление панели при новой регистрации

document.addEventListener('DOMContentLoaded', () => {
  Auth.init(); 
  LauncherSync.init(); 
  Utils.setActiveNav(); 
  Utils.initBurger();

  let adminPanelActive = false;

  const render = () => {
    const cont = document.getElementById('adminContent');
    if (!Auth.canAdmin()) { 
      cont.innerHTML = '<div class="empty-state"><div class="empty-state__icon">&#x1F512;</div><div class="empty-state__title">Нет доступа</div><div class="empty-state__desc">Войдите как администратор</div></div>'; 
      return; 
    }

    adminPanelActive = true;
    let activeTab = 'users';
    
    const draw = () => {
      cont.innerHTML = '<div class="tabs" style="margin-bottom:20px"><button class="tab-btn'+(activeTab==='users'?' active':'')+'" data-t="users">&#x1F465; Пользователи</button><button class="tab-btn'+(activeTab==='games'?' active':'')+'" data-t="games">&#x1F3AE; Игры</button></div><div id="tabBody"></div>';
      cont.querySelectorAll('.tab-btn').forEach(b => { 
        b.onclick = () => { activeTab = b.dataset.t; draw(); }; 
      });
      
      const body = document.getElementById('tabBody');
      
      if (activeTab === 'users') {
        const users = DB.getUsers();
        const me = Auth.getCurrentUser();
        body.innerHTML = '<div style="overflow-x:auto"><table><thead><tr><th>Пользователь</th><th>Роль</th><th>Статус</th><th>Варны</th><th>Действия</th></tr></thead><tbody id="userTbody"></tbody></table></div>';
        const tbody = document.getElementById('userTbody');
        
        users.forEach(u => {
          const tr = document.createElement('tr');
          const statusBadge = u.banned 
            ? '<span class="badge badge--ban">БАН</span>' 
            : u.muted 
            ? '<span class="badge badge--mute">МУТ</span>' 
            : '<span style="font-size:10px;color:var(--color-green)">Активен</span>';
          const isMe = u.id === me?.id;
          const isOwner = u.role === 'owner';
          let actions = '<span style="font-size:11px;color:var(--color-text-3)">—</span>';
          
          if (!isOwner && !isMe) {
            actions = '<div class="action-cell">';
            if (!u.banned) actions += '<button class="btn btn--red btn--xs ban-btn" data-id="'+u.id+'">Бан</button>';
            else actions += '<button class="btn btn--green btn--xs unban-btn" data-id="'+u.id+'">Разбан</button>';
            actions += '<button class="btn btn--ghost btn--xs mute-btn" data-id="'+u.id+'">'+(u.muted?'Размут':'Мут')+'</button>';
            actions += '<button class="btn btn--ghost btn--xs warn-btn" data-id="'+u.id+'">Варн</button>';
            if (me?.role === 'owner') {
              actions += '<select class="role-select" data-id="'+u.id+'"><option value="user"'+(u.role==='user'?' selected':'')+'>user</option><option value="mod"'+(u.role==='mod'?' selected':'')+'>mod</option><option value="admin"'+(u.role==='admin'?' selected':'')+'>admin</option></select>';
            }
            actions += '</div>';
          }
          
          tr.innerHTML = '<td><div style="font-weight:600;color:#fff">'+u.username+'</div><div style="font-size:10px;color:var(--color-text-3)">с '+u.joined+'</div></td><td>'+Utils.roleBadge(u.role)+'</td><td>'+statusBadge+'</td><td style="color:'+(u.warns>0?'var(--color-orange)':'var(--color-text-2)')+'">'+u.warns+'</td><td>'+actions+'</td>';
          tbody.appendChild(tr);
        });
        
        // Wire actions
        tbody.querySelectorAll('.ban-btn').forEach(b => { 
          b.onclick = () => { 
            DB.updateUser(+b.dataset.id,{banned:true}); 
            Utils.toast('Пользователь заблокирован'); 
            draw(); 
          }; 
        });
        tbody.querySelectorAll('.unban-btn').forEach(b => { 
          b.onclick = () => { 
            DB.updateUser(+b.dataset.id,{banned:false}); 
            Utils.toast('Бан снят'); 
            draw(); 
          }; 
        });
        tbody.querySelectorAll('.mute-btn').forEach(b => { 
          b.onclick = () => { 
            const u=DB.getUserById(+b.dataset.id); 
            DB.updateUser(+b.dataset.id,{muted:!u?.muted}); 
            Utils.toast('Статус мута изменён'); 
            draw(); 
          }; 
        });
        tbody.querySelectorAll('.warn-btn').forEach(b => { 
          b.onclick = () => { 
            const u=DB.getUserById(+b.dataset.id); 
            DB.updateUser(+b.dataset.id,{warns:(u?.warns||0)+1}); 
            Utils.toast('Варн выдан'); 
            draw(); 
          }; 
        });
        tbody.querySelectorAll('.role-select').forEach(s => { 
          s.onchange = () => { 
            DB.updateUser(+s.dataset.id,{role:s.value}); 
            Utils.toast('Роль обновлена'); 
            draw(); 
          }; 
        });
      } else {
        // Games tab
        const games = DB.getGames();
        body.innerHTML = '<button class="btn btn--primary btn--sm" style="margin-bottom:14px" id="adminAddGame">&#x2795; Добавить игру</button><div class="admin-grid" id="gameAdminGrid"></div>';
        document.getElementById('adminAddGame').onclick = () => Games.openAddModal(() => draw());
        const grid = document.getElementById('gameAdminGrid');
        if (!games.length) { 
          grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state__title">Каталог пуст</div></div>'; 
          return; 
        }
        games.forEach(g => {
          const card = document.createElement('div');
          card.style.cssText = 'background:var(--color-surface);border:1px solid var(--color-border);border-radius:10px;overflow:hidden';
          const cover = g.sid ? '<img src="https://images.steampowered.com/app/'+g.sid+'/header.jpg" style="width:100%;height:120px;object-fit:cover">' : '<div style="width:100%;height:120px;background:var(--color-border);display:flex;align-items:center;justify-content:center;color:var(--color-text-2)">🎮</div>';
          card.innerHTML = cover+'<div style="padding:12px"><h4 style="margin:0 0 8px;font-size:13px;font-weight:600">'+g.title+'</h4><div style="display:flex;gap:6px"><button class="btn btn--ghost btn--xs edit-game" data-id="'+g.id+'">Редак</button><button class="btn btn--red btn--xs del-game" data-id="'+g.id+'">Удал</button></div></div>';
          grid.appendChild(card);
        });
        grid.querySelectorAll('.del-game').forEach(b => {
          b.onclick = () => {
            if (confirm('Удалить игру?')) {
              DB.deleteGame(+b.dataset.id);
              Utils.toast('Игра удалена');
              draw();
            }
          };
        });
      }
    };

    draw();
  };

  render();

  // ✅ LISTEN TO REGISTRATION EVENTS
  window.addEventListener('qwak:auth', () => {
    if (adminPanelActive && Auth.canAdmin()) {
      console.log('[Admin] Обновление списка пользователей...');
      render();
    }
  });

  // ✅ LISTEN TO NEW USER REGISTRATION EVENT
  window.addEventListener('qwak:userRegistered', (e) => {
    if (adminPanelActive && Auth.canAdmin()) {
      console.log('[Admin] Новый пользователь зарегистрирован:', e.detail.user.username);
      Utils.toast('📋 Новый пользователь: ' + e.detail.user.username, 'info');
      render();
    }
  });

  // ✅ PERIODIC CHECK: каждые 5 секунд проверяй наличие новых пользователей
  setInterval(() => {
    if (adminPanelActive && Auth.canAdmin()) {
      const currentUsers = DB.getUsers().length;
      if (!window._lastUserCount) window._lastUserCount = currentUsers;
      
      if (currentUsers > window._lastUserCount) {
        console.log('[Admin] Обнаружены новые пользователи!');
        window._lastUserCount = currentUsers;
        render();
      }
    }
  }, 5000);
});
