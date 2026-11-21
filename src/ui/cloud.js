import { t } from '../i18n.js?v=43';
import { isCloudConfigured, initAuth, signIn, signUp, signOut, cloudSave, cloudLoad, getSession } from '../core/cloud.js?v=4';

export class CloudUI {
  constructor({ state, onSave, onLog, onRender }) {
    this.state = state;
    this.saveLocal = onSave;
    this.log = onLog;
    this.render = onRender;
    this.user = null;
  }

  async init() {
    if (!isCloudConfigured()) return;
    if (!document.getElementById('cloudPanel')) return;
    try {
      this.user = await initAuth();
    } catch (e) { this.user = null; }
    this.renderPanel(this.user ? this.loggedInHtml() : this.formHtml());
    this.bind();
  }

  formHtml() {
    return `
      <p class="cloud-h">${t("h.sinhronizatsiya-2")}</p>
      <p class="cloud-msg">${t("h.voydi-chtoby-sohranyat-progress")}</p>
      <div class="cloud-form">
        <input id="cloudEmail" placeholder="email" autocomplete="email">
        <input id="cloudPass" placeholder="" data-i18n-ph="h.parol" type="password" autocomplete="current-password">
        <button class="act" id="cloudLogin">${t("h.voyti")}</button>
        <button class="act" id="cloudSignup">${t("h.registratsiya")}</button>
      </div>`;
  }

  loggedInHtml() {
    const email = this.user?.email || t("j.cloud.igrok-2");
    return `
      <p class="cloud-h">${t("h.sinhronizatsiya")}</p>
      <p class="cloud-msg">${t("h.vy-voshli-kak")}<b>${email}</b></p>
      <div class="cloud-form">
        <button class="act primary" id="cloudPush">${t("h.otpravit-v-oblako")}</button>
        <button class="act" id="cloudPull">${t("h.zagruzit-iz-oblaka")}</button>
        <button class="act" id="cloudLogout">${t("h.vyyti")}</button>
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
      this.log(t("j.cloud.vhod", { email: this.user.email || email }));
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
      this.log(t("j.cloud.akkaunt", { email: this.user.email || email }));
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
      this.log(t("j.cloud.progress-otpravlen-v-oblako-2"));
      this.renderPanel(this.loggedInHtml() + `<p class="cloud-ok">${t("h.sohraneno-v-oblake")}</p>`);
      this.bind();
    } catch (e) {
      this.log(t("j.cloud.oshibka", { msg: e.message }));
    }
  }

  async doPull() {
    try {
      const remote = await cloudLoad();
      if (!remote) { this.log(t("j.cloud.v-oblake-pusto-otprav-2")); return; }
      Object.assign(this.state, remote);
      this.saveLocal();
      this.render();
      this.log(t("j.cloud.progress-zagruzhen-iz-oblaka-2"));
      this.renderPanel(this.loggedInHtml() + `<p class="cloud-ok">${t("h.zagruzheno-iz-oblaka")}</p>`);
      this.bind();
    } catch (e) {
      this.log(t("j.cloud.oshibka", { msg: e.message }));
    }
  }

  async doSignOut() {
    await signOut();
    this.user = null;
    this.log(t("j.cloud.vyhod-vypolnen-2"));
    this.renderPanel(this.formHtml());
    this.bind();
  }
}
