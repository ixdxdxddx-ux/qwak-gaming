// js/buttons.js — Инициализация кнопок входа и регистрации

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Ждём загрузку Auth модуля
  if (typeof Auth === 'undefined') {
    console.warn('Auth не загружен, повторяю попытку...');
    setTimeout(() => initButtons(), 500);
    return;
  }

  initButtons();
  
  // Переинициализируем кнопки при изменении статуса авторизации
  window.addEventListener('qwak:auth', () => {
    initButtons();
  });
});

function initButtons() {
  const loginBtn = document.getElementById('loginBtn');
  const regBtn = document.getElementById('regBtn');

  if (loginBtn) {
    loginBtn.onclick = (e) => {
      e.preventDefault();
      if (typeof Auth !== 'undefined' && typeof Auth.openLoginModal === 'function') {
        Auth.openLoginModal();
      } else {
        console.error('Auth.openLoginModal не доступен');
      }
    };
  }

  if (regBtn) {
    regBtn.onclick = (e) => {
      e.preventDefault();
      if (typeof Auth !== 'undefined' && typeof Auth.openRegisterModal === 'function') {
        Auth.openRegisterModal();
      } else {
        console.error('Auth.openRegisterModal не доступен');
      }
    };
  }

  console.log('✅ Кнопки входа/регистрации инициализированы');
}
