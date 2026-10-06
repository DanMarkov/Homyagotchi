import { isCloudConfigured, initAuth, signIn, signUp, signOut, cloudSave, cloudLoad, getSession } from '../core/cloud.js';

export class CloudUI {
  constructor({ state, onSave, onLog, onRender }) {
    this.state = state;
    this.saveLocal = onSave;
    this.log = onLog;
    this.render = onRender;
    this.user = null;
  }

  async init() {
    if (!isCloudConfigured()) {
      this.renderPanel('<p class="cloud-msg">☁️ Облачная синхронизация не настроена — играем локально.</p>');
      return;
    }
    try {
      this.user = await initAuth();
    } catch (e) { this.user = null; }
    this.renderPanel(this.user ? this.loggedInHtml() : this.formHtml());
    this.bind();
  }

  formHtml() {
    return `
      <p class="cloud-h">☁️ СИНХРОНИЗАЦИЯ</p>
      <p class="cloud-msg">Войди, чтобы сохранять прогресс в облаке — играй с любого устройства!</p>
      <div class="cloud-form">
        <input id="cloudEmail" placeholder="email" autocomplete="email">
        <input id="cloudPass" placeholder="пароль" type="password" autocomplete="current-password">
        <button class="act" id="cloudLogin">ВОЙТИ</button>
        <button class="act" id="cloudSignup">РЕГИСТРАЦИЯ</button>
      </div>`;
  }

  loggedInHtml() {
    const email = this.user?.email || 'игрок';
    return `
      <p class="cloud-h">☁️ СИНХРОНИЗАЦИЯ</p>
      <p class="cloud-msg">Вы вошли как <b>${email}</b></p>
      <div class="cloud-form">
        <button class="act primary" id="cloudPush">⬆ ОТПРАВИТЬ В ОБЛАКО</button>
        <button class="act" id="cloudPull">⬇ ЗАГРУЗИТЬ ИЗ ОБЛАКА</button>
        <button class="act" id="cloudLogout">ВЫЙТИ</button>
      </div>`;
  }

  renderPanel(html) {
    const el = document.getElementById('cloudPanel');
    if (el) el.innerHTML = html;
  }

  bind() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };
    on('cloudLogin', () => this.doSignIn());
    on('cloudSignup', () => this.doSignUp());
    on('cloudPush', () => this.doPush());
    on('cloudPull', () => this.doPull());
    on('cloudLogout', () => this.doSignOut());
  }

  async doSignIn() {
    const email = document.getElementById('cloudEmail').value.trim();
    const pass = document.getElementById('cloudPass').value;
    try {
      this.user = await signIn(email, pass);
      this.log('☁️ вход выполнен: ' + (this.user.email || email));
      this.renderPanel(this.loggedInHtml());
      this.bind();
    } catch (e) {
      this.renderPanel(this.formHtml() + '<p class="cloud-err">⚠ ' + e.message + '</p>');
      this.bind();
    }
  }

  async doSignUp() {
    const email = document.getElementById('cloudEmail').value.trim();
    const pass = document.getElementById('cloudPass').value;
    try {
      this.user = await signUp(email, pass);
      this.log('☁️ аккаунт создан: ' + (this.user.email || email));
      this.renderPanel(this.loggedInHtml());
      this.bind();
    } catch (e) {
      this.renderPanel(this.formHtml() + '<p class="cloud-err">⚠ ' + e.message + '</p>');
      this.bind();
    }
  }

  async doPush() {
    try {
      await cloudSave(this.state);
      this.log('☁️ прогресс отправлен в облако');
      this.renderPanel(this.loggedInHtml() + '<p class="cloud-ok">✅ Сохранено в облаке</p>');
      this.bind();
    } catch (e) {
      this.log('⚠ облачная ошибка: ' + e.message);
    }
  }

  async doPull() {
    try {
      const remote = await cloudLoad();
      if (!remote) { this.log('☁️ в облаке пусто — отправь прогресс сначала'); return; }
      Object.assign(this.state, remote);
      this.saveLocal();
      this.render();
      this.log('☁️ прогресс загружен из облака');
      this.renderPanel(this.loggedInHtml() + '<p class="cloud-ok">✅ Загружено из облака</p>');
      this.bind();
    } catch (e) {
      this.log('⚠ облачная ошибка: ' + e.message);
    }
  }

  async doSignOut() {
    await signOut();
    this.user = null;
    this.log('☁️ выход выполнен');
    this.renderPanel(this.formHtml());
    this.bind();
  }
}
