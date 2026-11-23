// ============================================================
//  ATUALIZAÇÃO PELO APP — ao abrir o jogo, confere se existe versão nova
//  no servidor (CONFIG.UPDATE_URL → update.json) e baixa só os arquivos
//  que mudaram. Funciona no APK (Android) e no PC (Electron); no navegador
//  não precisa (a página já é sempre a mais nova).
// ============================================================
const Updater = {
  checked: false, listener: null,
  get app() { return window.AetherApp || null; },
  async info() {
    const r = await this.app.info();
    return typeof r === 'string' ? JSON.parse(r) : r;
  },
  // a versão abriu certinho (se não confirmar, o app volta para a versão anterior na próxima abertura)
  confirm() { try { if (this.app && this.app.confirm) this.app.confirm(); } catch (e) {} },
  onEvent(e) { if (this.listener) this.listener(e); },
  async check(scene) {
    this.confirm(); // chegou na tela de título: esta versão funciona
    if (this.checked || !this.app || !CONFIG.UPDATE_URL) return;
    this.checked = true;
    if (this.app.onEvent) this.app.onEvent((e) => this.onEvent(e)); // PC (Electron)
    let info, j;
    try {
      info = await this.info();
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 7000);
      const r = await fetch(CONFIG.UPDATE_URL + (CONFIG.UPDATE_URL.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store', signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) return;
      j = await r.json();
    } catch (e) { return; } // sem internet: joga a versão que já tem
    if (!j || !(j.build > info.build)) return;
    const base = j.base || CONFIG.UPDATE_URL.replace(/[^/]*$/, '');
    const sc = scene.sys.isActive() ? scene : (game.scene.getScenes(true)[0] || scene);
    this.show(sc, j, info, base);
  },
  show(scene, j, info, base) {
    const dom = scene.game.domContainer; if (dom) dom.style.display = 'none'; // esconde campos de texto da tela de título
    const ov = []; const L = (o) => { ov.push(o.setDepth(5000 + ov.length).setScrollFactor(0)); return o; };
    const close = () => { ov.forEach(o => o.destroy()); if (dom) dom.style.display = ''; };
    L(scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82).setInteractive());
    L(ui(scene, W / 2 - 330, 150, 'frame_big', 660, 420));
    L(txt(scene, W / 2, 200, 'Nova versão disponível!', 34, '#f2c766', { origin: 0.5, title: true }));
    L(txt(scene, W / 2, 246, `${info.version ? 'v' + info.version + '  →  ' : ''}v${j.version}`, 20, COL.dim, { origin: 0.5 }));
    if (j.notes) L(txt(scene, W / 2, 278, j.notes, 18, COL.text, { origin: [0.5, 0], align: 'center', wrap: 560, bold: false }));
    const needStore = (j.minNative || 1) > (info.native || 1);
    const msg = L(txt(scene, W / 2, 380, needStore ? 'Esta versão precisa do app novo.\nAtualize pela loja para continuar jogando.' : 'Atualize para continuar jogando.', 20, '#ffffff', { origin: 0.5, align: 'center' }));
    const track = L(scene.add.rectangle(W / 2, 424, 460, 18, 0x000000, 0.7).setStrokeStyle(2, 0x8a6a2f)).setVisible(false);
    const fill = L(scene.add.rectangle(W / 2 - 228, 424, 456, 12, 0x3fbf4a).setOrigin(0, 0.5)).setVisible(false); fill.scaleX = 0.002;
    const btns = [];
    const B = (x, label, fn, opts) => { const b = L(button(scene, x, 500, 260, 62, label, fn, Object.assign({ size: 22, title: true }, opts))); btns.push(b); return b; };
    const mb = (n) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0).replace('.', ',') + ' MB';
    const start = () => {
      btns.forEach(b => b.destroy()); btns.length = 0;
      msg.setText('Conectando...'); track.setVisible(true); fill.setVisible(true);
      this.listener = (e) => {
        if (e.type === 'start') msg.setText(e.files ? `Baixando ${e.files} arquivo${e.files > 1 ? 's' : ''} (${mb(e.bytes)})` : 'Instalando...');
        else if (e.type === 'progress') { const k = e.total ? e.done / e.total : 1; fill.scaleX = Math.max(0.002, k); msg.setText(`Baixando... ${mb(e.done)} de ${mb(e.total)}`); }
        else if (e.type === 'ready') { fill.scaleX = 1; msg.setText('Pronto! Reiniciando o jogo...').setColor('#7dff6a'); Sfx.win && Sfx.win(); setTimeout(() => this.app.restart(), 900); }
        else if (e.type === 'error') {
          msg.setText('Não foi possível baixar a atualização.\nConfira a internet e tente de novo.').setColor('#ff9a8a');
          track.setVisible(false); fill.setVisible(false); fill.scaleX = 0.002;
          B(W / 2, 'TENTAR DE NOVO', start, { color: 0x3a4a22 });
          console.warn('Atualização falhou:', e.msg);
        }
      };
      try { this.app.update(base); } catch (e) { this.listener({ type: 'error', msg: String(e) }); }
    };
    if (needStore) B(W / 2, 'ABRIR A LOJA', () => this.app.openStore && this.app.openStore(j.store || 'https://play.google.com/store/apps/details?id=com.lendasdeaether.jogo'), { color: 0x3a4a22 });
    else if (j.mandatory === false) { B(W / 2 + 140, 'ATUALIZAR', start, { color: 0x3a4a22 }); B(W / 2 - 140, 'Depois', close); }
    else B(W / 2, 'ATUALIZAR', start, { color: 0x3a4a22 });
  },
};
window.AetherUpdate = Updater;
