// ============================================================
//  CENAS DE MENU — Boot, Título/Conta, Seleção, Criação,
//  Vila (hub), Mochila, Loja, Mapa da Aventura
// ============================================================

// personagem animado (respirando) para os menus; scale é relativa à arte parada antiga (300px)
function charImage(scene, x, y, c, scale = 0.6) {
  const k = CLASSES[c.cls || c], key = charAnimKey(c, 'idle');
  if (scene.textures.exists(key)) {
    createAnims(scene);
    const m = ANIM_META[key];
    return scene.add.sprite(x, y, key).setOrigin(m.ox, m.oy).setScale(m.scale * scale * 300 / 216).play(key);
  }
  return scene.add.image(x, y, k.id).setOrigin(k.originX, 1).setScale(scale);
}

// ------------------------------------------------------------
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    const g = this.add.graphics();
    const t = txt(this, W / 2, H / 2 - 40, 'Carregando...', 28, COL.goldTxt, { origin: 0.5, title: true });
    this.load.on('progress', p => { g.clear().fillStyle(0x333333).fillRect(W / 2 - 200, H / 2, 400, 14).fillStyle(COL.gold).fillRect(W / 2 - 200, H / 2, 400 * p, 14); });
    this.load.image('forest', 'assets/forest.jpg');
    this.load.image('swamp', 'assets/swamp.jpg');
    this.load.image('plat_forest', 'assets/plat_forest.png');
    this.load.image('plat_swamp', 'assets/plat_swamp.png');
    this.load.image('arena', 'assets/arena.jpg');
    for (const k of ['caves', 'desert']) { this.load.image(k, `assets/${k}.jpg`); this.load.image('plat_' + k, `assets/plat_${k}.png`); }
    for (const k of ['warrior', 'hunter', 'mage']) {
      this.load.image(k, `assets/${k}.png`); this.load.image(k + '_art', `assets/${k}_art.png`); this.load.image(k + '_f_art', `assets/${k}_f_art.png`);
    }
    loadAnimSheets(this);
    loadUi(this);
    for (const k of PREMIUM_ICONS) this.load.image('pi_' + k, `assets/premium/${k}.png`);
    for (const c of ['warrior', 'hunter', 'mage']) for (const k of SKILL_ICON_KINDS) this.load.image(`sk_${c}_${k}`, `assets/skills/${c}_${k}.png`);
    loadAudio(this);
    for (const m of Object.values(MONSTERS)) if (m.key) this.load.image(m.key, `assets/monsters/${m.key.slice(2)}.png`);
  }
  create() {
    // Texturas de efeitos geradas por código
    const g = this.add.graphics();
    // flecha
    g.clear(); g.fillStyle(0x6b4a2b).fillRect(0, 5, 46, 3); g.fillStyle(0xd9d9d9).fillTriangle(46, 0, 58, 6.5, 46, 13);
    g.fillStyle(0xe8e0c8).fillTriangle(0, 1, 10, 6, 0, 12); g.generateTexture('fx_arrow', 58, 13);
    // orbe arcano
    g.clear(); for (let r = 22; r > 0; r -= 2) { g.fillStyle(0x9b7bff, 0.05 + (22 - r) * 0.04).fillCircle(24, 24, r); }
    g.fillStyle(0xe6f0ff, 1).fillCircle(24, 24, 7); g.generateTexture('fx_orb', 48, 48);
    // corte de espada (arco)
    g.clear(); g.lineStyle(10, 0xffffff, 0.9); g.beginPath(); g.arc(10, 70, 70, -1.25, 1.0); g.strokePath();
    g.lineStyle(4, 0xffe9a8, 1); g.beginPath(); g.arc(10, 70, 78, -1.1, 0.9); g.strokePath(); g.generateTexture('fx_slash', 100, 150);
    // faísca / partícula
    g.clear(); g.fillStyle(0xffffff).fillCircle(6, 6, 6); g.generateTexture('fx_dot', 12, 12);
    // seta verde "avance"
    g.clear(); g.fillStyle(0x0b3d10).fillTriangle(0, 6, 60, 6, 60, 0); g.fillStyle(0x3cff5a).fillRect(0, 20, 60, 36).fillTriangle(60, 0, 100, 38, 60, 76);
    g.lineStyle(4, 0x0b3d10).strokeRect(0, 20, 60, 36); g.generateTexture('fx_go', 102, 78);
    // brilho de fogo (gradiente radial laranja)
    g.clear(); for (let r = 60; r > 0; r -= 3) { const t = 1 - r / 60; g.fillStyle(Phaser.Display.Color.GetColor(255, 140 + t * 110, 40 + t * 180), 0.06 + t * 0.12).fillCircle(64, 64, r); }
    g.generateTexture('fx_glow', 128, 128);
    // anel de explosão
    g.clear(); g.lineStyle(14, 0xdddddd, 0.9).strokeCircle(130, 130, 118); g.lineStyle(5, 0xffffff, 1).strokeCircle(130, 130, 108);
    g.generateTexture('fx_ring', 260, 260);
    g.destroy();
    createAnims(this);
    Save.load();
    this.scene.start('Title');
  }
}

// ------------------------------------------------------------
class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    Music.play('town');
    this.cameras.main.fadeIn(300);
    bgForest(this, 0.25);
    this.add.rectangle(W / 2, 0, W, 300, 0x000000, 0.35).setOrigin(0.5, 0);
    Updater.check(this); // versão nova no servidor? (só no app Android / PC)
    // trio de heróis
    [['warrior_art', 300, 1.08], ['hunter_art', 650, 1.12], ['mage_art', 975, 1.04]].forEach(([k, x, sc], i) => {
      const im = this.add.image(x, H + 6, k).setOrigin(0.5, 1).setScale(sc);
      this.tweens.add({ targets: im, y: H, duration: 2200 + i * 350, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    // título com ornamentos
    const title = txt(this, W / 2, 92, GAME_TITLE.toUpperCase(), 76, '#f2c766', { origin: 0.5, title: true });
    title.setStroke('#3a2208', 9).setShadow(0, 4, '#000', 6, true, true);
    uiImg(this, W / 2 - title.width / 2 - 26, 92, 'tri_l', 34); uiImg(this, W / 2 + title.width / 2 + 26, 92, 'tri_r', 34);
    txt(this, W / 2, 156, 'RPG de Ação 2D', 24, COL.text, { origin: 0.5 });

    if (Cloud.enabled) return this.cloudPanel();
    const acc = Save.data.account;
    if (acc) {
      ui(this, W / 2 - 230, 574, 'divider', 460, 44);
      button(this, W / 2, 596, 330, 80, 'ENTRAR', () => fadeTo(this, 'CharSelect'), { size: 34, title: true, skin: 'btn_buy_long' });
      txt(this, W / 2, 664, `Conta: ${acc.nick}`, 20, COL.text, { origin: 0.5 });
    } else {
      panel(this, W / 2 - 270, H - 260, 540, 230);
      txt(this, W / 2, H - 222, 'Criar conta', 28, COL.goldTxt, { origin: 0.5, title: true });
      this.add.dom(W / 2, H - 162).createFromHTML(
        `<input id="nick" maxlength="14" placeholder="Seu apelido" style="width:360px;height:48px;font-size:24px;border-radius:10px;border:2px solid #8a6a2f;background:#0e0c09;color:#f3ead7;text-align:center;font-family:Nunito,sans-serif;outline:none">`);
      button(this, W / 2, H - 88, 280, 64, 'CRIAR', () => {
        const v = (document.getElementById('nick').value || '').trim();
        if (v.length < 3) return toast(this, 'Apelido precisa de pelo menos 3 letras', COL.red);
        Save.createAccount(v); fadeTo(this, 'CharSelect');
      }, { size: 28, title: true, skin: 'btn_buy_long' });
    }
    screenFrame(this);
  }
  init(data) { this.mode = (data && data.mode) || 'login'; }
  // ---------- conta na nuvem (e-mail e senha)
  cloudPanel() {
    if (Cloud.user) {
      ui(this, W / 2 - 230, 574, 'divider', 460, 44);
      button(this, W / 2, 596, 330, 80, 'ENTRAR', () => fadeTo(this, 'CharSelect'), { size: 34, title: true, skin: 'btn_buy_long' });
      txt(this, W / 2, 664, `Conta: ${Save.data.account.nick}`, 20, COL.text, { origin: 0.5 });
      button(this, W - 120, H - 46, 170, 50, 'Sair da conta', async () => { await Cloud.signOut(); this.scene.restart({ mode: 'login' }); }, { size: 18, skin: 'btn_dark3' });
      screenFrame(this);
      return;
    }
    const signup = this.mode === 'signup';
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.35);
    const top = signup ? 214 : 244, ph = signup ? 470 : 430;
    ui(this, W / 2 - 300, top, 'frame_big', 600, ph);
    const tab = (x, label, on, mode) => button(this, x, top + 46, 230, 54, label, () => { if (!on) this.scene.restart({ mode }); }, { size: 21, title: true, skin: on ? 'tab_sel' : 'tab_dark' });
    tab(W / 2 - 120, 'Entrar', !signup, 'login'); tab(W / 2 + 120, 'Criar conta', signup, 'signup');
    const css = 'width:420px;height:46px;font-size:21px;border-radius:10px;border:2px solid #8a6a2f;background:#0e0c09;color:#f3ead7;padding:0 14px;box-sizing:border-box;font-family:Nunito,sans-serif;outline:none;margin:0 0 14px 0;display:block';
    const fields = [`<input id="em" type="email" autocomplete="email" placeholder="E-mail" style="${css}">`,
      `<input id="pw" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="Senha${signup ? ' (mínimo 6)' : ''}" style="${css}">`];
    if (signup) fields.push(`<input id="nk" maxlength="14" placeholder="Apelido no jogo" style="${css}">`);
    const form = this.add.dom(W / 2, top + 106).createFromHTML(`<form id="lf" onsubmit="return false" style="margin:0">${fields.join('')}</form>`).setOrigin(0.5, 0);
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const msg = txt(this, W / 2, top + ph - 40, '', 18, COL.red, { origin: 0.5, wrap: 520, align: 'center' });
    let busy = false;
    const go = async () => {
      if (busy) return;
      const email = val('em'), pw = val('pw');
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { msg.setColor(COL.red).setText('Digite um e-mail válido'); return; }
      busy = true; msg.setColor(COL.dim).setText(signup ? 'Criando conta...' : 'Entrando...');
      const r = signup ? await Cloud.signUp(email, pw, val('nk')) : await Cloud.signIn(email, pw);
      busy = false;
      if (r.error) return msg.setColor(COL.red).setText(r.error);
      if (r.confirm) return msg.setColor(COL.green).setText('Conta criada! Abra o e-mail que enviamos para confirmar e depois entre aqui.');
      fadeTo(this, 'CharSelect');
    };
    const by = top + (signup ? 340 : 280);
    button(this, W / 2, by, 330, 70, signup ? 'CRIAR CONTA' : 'ENTRAR', go, { size: 28, title: true, skin: 'btn_buy_long' });
    form.node.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    if (!signup) {
      const fg = txt(this, W / 2, by + 62, 'Esqueci a senha', 18, '#9fc7ff', { origin: 0.5 }).setInteractive({ useHandCursor: true });
      fg.on('pointerup', async () => {
        const email = val('em').trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) return msg.setColor(COL.red).setText('Digite seu e-mail acima e toque de novo em "Esqueci a senha"');
        const r = await Cloud.resetPassword(email);
        msg.setColor(r.error ? COL.red : COL.green).setText(r.error || 'Enviamos um e-mail para você criar uma senha nova.');
      });
    }
    screenFrame(this);
  }
}

// ------------------------------------------------------------
class CharSelectScene extends Phaser.Scene {
  constructor() { super('CharSelect'); }
  create() {
    Music.play('town');
    this.cameras.main.fadeIn(250);
    bgForest(this, 0.35);
    txt(this, W / 2, 46, 'Escolha seu personagem', 42, '#f2c766', { origin: 0.5, title: true }).setStroke('#3a2208', 7);
    txt(this, W / 2, 88, `Até ${MAX_CHARS} personagens por conta`, 19, '#d8ccb0', { origin: 0.5 });
    const chars = Save.data.chars;
    for (let i = 0; i < MAX_CHARS; i++) {
      const cx = W / 2 + (i - 1) * 363, w = 318, h = 504, x = cx - w / 2, y = 118;
      ui(this, x, y, 'frame_tall', w, h);
      const c = chars[i];
      const current = c && c.id === Save.data.current;
      if (c) {
        const k = CLASSES[c.cls];
        ui(this, x + 12, y + 10, 'panel_header', w - 24, 84);
        txt(this, cx, y + 36, c.name, 28, '#f3e2b8', { origin: 0.5, title: true });
        txt(this, cx, y + 68, `${k.name} ${c.gender === 'f' ? '♀' : '♂'}  •  Nv. ${c.level}`, 19, COL.goldTxt, { origin: 0.5 });
        // área do personagem (pergaminho no último jogado)
        ui(this, x + 16, y + 98, current ? 'panel_parch' : 'slot_dark', w - 32, 268);
        // pedestal de grama
        this.add.ellipse(cx, y + 340, 190, 40, 0x4a3018);
        this.add.ellipse(cx, y + 333, 186, 34, 0x3f7a2a);
        this.add.ellipse(cx, y + 330, 170, 26, 0x5a9a38);
        charImage(this, cx, y + 336, c, 0.74);
        button(this, cx, y + 404, 262, 68, 'JOGAR', () => { Save.select(c.id); fadeTo(this, 'Hub'); },
          { size: 30, title: true, skin: current ? 'btn_long_steel' : 'btn_long_wood' });
        const del = button(this, cx, y + 466, 168, 42, 'Excluir', () => {
          if (del.armed) { Save.deleteChar(c.id); this.scene.restart(); }
          else { del.armed = true; del.label.setText('Confirmar?').setColor(COL.red); }
        }, { size: 18, skin: 'btn_dark3', textColor: '#d9a07a' });
      } else {
        ui(this, x + 16, y + 30, 'slot_dark', w - 32, h - 60);
        txt(this, cx, y + h / 2 - 30, '+', 110, COL.goldTxt, { origin: 0.5 });
        txt(this, cx, y + h / 2 + 50, 'Criar personagem', 22, '#d8ccb0', { origin: 0.5 });
        const z = this.add.zone(cx, y + h / 2, w, h).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => { Sfx.click(); fadeTo(this, 'CharCreate'); });
      }
    }
    button(this, 110, H - 46, 160, 54, '‹ Voltar', () => fadeTo(this, 'Title'), { size: 22, skin: 'btn_dark3' });
    if (Cloud.user) {
      cloudBadge(this, W / 2, H - 46);
      button(this, W - 300, H - 46, 170, 50, 'Sair da conta', async () => { await Cloud.signOut(); fadeTo(this, 'Title', { mode: 'login' }); }, { size: 18, skin: 'btn_dark3' });
      button(this, W - 115, H - 46, 170, 50, 'Excluir conta', () => this.confirmDelete(), { size: 18, skin: 'btn_dark3', textColor: '#ff9a8a' });
    }
    screenFrame(this);
  }
  // excluir a conta (Google Play exige essa opção dentro do app)
  confirmDelete() {
    const ov = []; const L = (o) => { ov.push(o.setDepth(3000 + ov.length)); return o; };
    const close = () => ov.forEach(o => o.destroy());
    L(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setInteractive());
    L(ui(this, W / 2 - 300, 190, 'frame_big', 600, 340));
    L(txt(this, W / 2, 236, 'Excluir conta', 32, '#ff9a8a', { origin: 0.5, title: true }));
    L(txt(this, W / 2, 300, `Isso apaga para sempre a conta ${Save.data.account.nick}, todos os personagens, itens e diamantes. Não dá para desfazer.`, 19, COL.text, { origin: 0.5, align: 'center', wrap: 500 }));
    const msg = L(txt(this, W / 2, 380, '', 18, COL.red, { origin: 0.5 }));
    L(button(this, W / 2 - 130, 450, 220, 60, 'Cancelar', close, { size: 22 }));
    L(button(this, W / 2 + 130, 450, 220, 60, 'EXCLUIR', async () => {
      msg.setColor(COL.dim).setText('Excluindo...');
      const r = await Cloud.deleteAccount();
      if (r.error) return msg.setColor(COL.red).setText(r.error);
      fadeTo(this, 'Title', { mode: 'signup' });
    }, { size: 22, title: true, skin: 'btn_brown', textColor: '#ffb0a0' }));
  }
}

// ------------------------------------------------------------
class CharCreateScene extends Phaser.Scene {
  constructor() { super('CharCreate'); }
  create() {
    Music.play('town');
    this.cameras.main.fadeIn(250);
    bgForest(this, 0.6);
    this.cls = 'warrior'; this.gender = 'm';
    txt(this, W / 2, 42, 'Criar personagem', 40, COL.goldTxt, { origin: 0.5, title: true });

    // Cartas das classes
    this.cards = {};
    Object.values(CLASSES).forEach((k, i) => {
      const x = 170 + i * 250, y = 380;
      const g = ui(this, x - 115, y - 230, 'frame_tall', 230, 440);
      const art = this.add.image(x, y + 150, k.id + '_art').setOrigin(0.5, 1).setScale(0.6);
      const name = txt(this, x, y + 175, k.name, 26, COL.text, { origin: 0.5, title: true });
      const z = this.add.zone(x, y, 230, 420).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => { Sfx.click(); this.pick(k.id); });
      this.cards[k.id] = { g, art, name, x, y };
    });

    // Painel de detalhes
    panel(this, 800, 90, 440, 540);
    this.dName = txt(this, 1020, 130, '', 36, COL.goldTxt, { origin: 0.5, title: true });
    this.dWeapon = txt(this, 1020, 172, '', 20, COL.text, { origin: 0.5 });
    this.dDesc = txt(this, 830, 200, '', 18, COL.dim, { wrap: 380, bold: false });
    this.dStats = txt(this, 830, 268, '', 20, COL.text, { lineSpacing: 6 });

    txt(this, 830, 400, 'Gênero', 20, COL.goldTxt);
    this.gBtns = {
      m: button(this, 920, 450, 170, 50, 'Masculino', () => this.setGender('m'), { size: 20, skin: 'tab_dark' }),
      f: button(this, 1110, 450, 170, 50, 'Feminino', () => this.setGender('f'), { size: 20, skin: 'tab_dark' }),
    };
    txt(this, 830, 486, 'Nome', 20, COL.goldTxt);
    this.add.dom(1020, 532).createFromHTML(
      `<input id="cname" maxlength="12" placeholder="Nome do personagem" style="width:380px;height:46px;font-size:22px;border-radius:10px;border:2px solid #8a6a2f;background:#0e0c09;color:#f3ead7;text-align:center;font-family:Nunito,sans-serif;outline:none">`);
    button(this, 1020, 595, 300, 58, 'CRIAR', () => this.create_(), { size: 26, title: true, color: 0x5a3a12 });
    button(this, 110, H - 46, 160, 54, '‹ Voltar', () => fadeTo(this, 'CharSelect'), { size: 22, skin: 'btn_dark3' });
    this.pick('warrior'); this.setGender('m');
    screenFrame(this);
  }
  pick(id) {
    this.cls = id; const k = CLASSES[id];
    for (const [cid, c] of Object.entries(this.cards)) {
      const on = cid === id;
      c.g.setTexture(nineTex(this, on ? 'panel_parch' : 'frame_tall', 230, 440));
      c.name.setColor(on ? '#4a2c0c' : '#f3ead7').setStroke(on ? '#e9d3a6' : '#000', on ? 1 : 4);
      c.art.setTexture(artKey(cid, this.gender));
      c.art.setTint(on ? 0xffffff : 0x777777); c.art.setScale(on ? 0.66 : 0.6);
    }
    this.dName.setText(k.name);
    this.dWeapon.setText(`${k.weapon}  •  Equip. ${GEAR_TYPE_LABEL[k.gearType]}`);
    this.dDesc.setText(k.desc);
    this.dStats.setText(`Vida: ${k.base.hp}     Ataque: ${k.base.atk}\nDefesa: ${k.base.def}    Crítico: ${k.base.crit}%\nEspecial: ${k.skill.name}`);
  }
  setGender(g) {
    this.gender = g;
    for (const [k, b] of Object.entries(this.gBtns)) { b.label.setColor(k === g ? '#f6e7c1' : COL.dim); b.setSkin(k === g ? 'tab_sel' : 'tab_dark'); }
    if (this.cls) this.pick(this.cls);
  }
  create_() {
    const name = (document.getElementById('cname').value || '').trim();
    if (name.length < 3) return toast(this, 'Nome precisa de pelo menos 3 letras', COL.red);
    if (Save.data.chars.some(c => c.name.toLowerCase() === name.toLowerCase())) return toast(this, 'Você já tem um personagem com esse nome', COL.red);
    Save.createChar(name, this.cls, this.gender);
    fadeTo(this, 'Hub');
  }
}

// ------------------------------------------------------------
//  VILA (hub): acesso a todos os modos
// ------------------------------------------------------------
class HubScene extends Phaser.Scene {
  constructor() { super('Hub'); }
  create() {
    Music.play('town');
    this.cameras.main.fadeIn(250);
    const c = Save.cur(); if (!c) return this.scene.start('CharSelect');
    bgForest(this, 0.2);
    const k = CLASSES[c.cls], s = charStats(c);
    // cabeçalho: nome, classe, nível e EXP
    ui(this, 22, 8, 'panel_header', 584, 128);
    txt(this, 52, 22, c.name, 34, '#f3e2b8', { title: true });
    txt(this, 54, 66, `${k.name}  •  Nível ${c.level}`, 22, COL.goldTxt);
    const need = xpToNext(c.level), bw = 390;
    ui(this, 52, 100, 'bar_track_dark', bw, 18);
    const fill = ui(this, 52, 100, 'bar_blue', bw, 18); fill.setCrop(0, 0, Math.max(10, bw * Math.min(1, c.xp / need)), 18);
    txt(this, 456, 98, `EXP ${c.xp}/${need}`, 16, '#d8ccb0');
    // contadores de ouro e diamante
    this.add.image(W - 278, 46, 'ui_counter_gold').setScale(0.8);
    txt(this, W - 300, 46, `${c.gold}`, 26, '#f3e2b8', { origin: [0, 0.5] });
    this.add.image(W - 104, 46, 'ui_counter_diamond').setScale(0.8);
    txt(this, W - 126, 46, `${Wallet.gems()}`, 26, '#9fe3ff', { origin: [0, 0.5] });

    // personagem
    this.add.ellipse(300, 650, 280, 44, 0x000000, 0.45);
    if (premiumLook(c)) { // visual premium: mostra o próprio sprite do jogo, igual à batalha
      const glow = this.add.image(300, 470, 'fx_glow').setTint(0xffd36b).setScale(2.6, 3.2).setAlpha(0.35).setBlendMode('ADD');
      this.tweens.add({ targets: glow, alpha: 0.18, duration: 1400, yoyo: true, repeat: -1 });
      charImage(this, 300, 652, c, 1.2);
    } else {
      const art = this.add.image(300, 660, artKey(k.id, c.gender)).setOrigin(0.5, 1).setScale(0.98);
      this.tweens.add({ targets: art, y: 654, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    // status no pergaminho
    ui(this, 540, 150, 'panel_parch', 240, 212);
    const ink = '#3b2510';
    txt(this, 566, 172, 'Status', 23, '#7a4a14', { title: true, stroke: 0 });
    [['Vida', s.hp], ['Ataque', s.atk], ['Defesa', s.def], ['Crítico', s.crit + '%']].forEach(([a, v], i) => {
      txt(this, 566, 210 + i * 34, a, 21, ink, { stroke: 0 });
      txt(this, 752, 210 + i * 34, String(v), 21, ink, { origin: [1, 0], stroke: 0 });
    });

    // modos de jogo
    const locked = c.level <= 5, bx = 1042;
    const lockMsg = () => toast(this, 'Do nível 1 ao 5 somente o Modo Aventura está liberado', COL.red);
    button(this, bx, 172, 436, 96, 'MODO AVENTURA', () => fadeTo(this, 'Map'), { size: 30, title: true, sub: 'Floresta Sombria e além', skin: 'btn_hero', textX: -34 });
    const modeOpts = (sub) => locked ? { size: 20, title: true, sub, skin: 'btn_locked', textX: 26, disabled: true, onLocked: lockMsg } : { size: 22, title: true, sub, skin: 'btn_bronze' };
    button(this, bx - 112, 290, 212, 88, 'DUNGEON', () => toast(this, 'Modo Dungeon em breve', COL.blue), modeOpts('Trio • Nível 6+'));
    button(this, bx + 112, 290, 212, 88, 'ARENA', () => fadeTo(this, 'Arena'), modeOpts(locked ? 'PvP • Nível 6+' : `Liga ${leagueOf(arenaData(c).pts).name} • ${arenaData(c).pts}`));
    button(this, bx - 112, 396, 212, 84, 'LOJA', () => fadeTo(this, 'Shop'), { size: 26, title: true, sub: 'Ouro', skin: 'btn_wood' });
    const prem = button(this, bx + 112, 396, 212, 84, 'LOJA', () => fadeTo(this, 'Premium'), { size: 26, title: true, sub: 'Diamantes', skin: 'btn_blue', textX: -14 });
    prem.add(uiImg(this, 42, -9, 'icon_diamond', 30));
    button(this, bx, 500, 436, 78, 'MOCHILA E EQUIPAMENTOS', () => fadeTo(this, 'Bag'), { size: 23, title: true, skin: 'btn_long_wood' });
    button(this, bx, 600, 306, 58, 'Trocar personagem', () => fadeTo(this, 'CharSelect'), { size: 21, skin: 'btn_dark' });
    if (Cloud.user) cloudBadge(this, 1042, 652);
    const nNew = CLASS_SKILLS[c.cls].filter(sk => sk.lvl <= c.level).length;
    button(this, 660, 410, 240, 66, 'HABILIDADES', () => this.showSkills(c), { size: 21, title: true, skin: 'btn_bronze', sub: `${nNew}/3 liberadas` });
    screenFrame(this);
  }
  // árvore de habilidades da classe (1 → 3 → 5)
  showSkills(c) {
    const ov = []; const L = (o) => { ov.push(o.setDepth(2000 + ov.length)); return o; };
    const close = () => ov.forEach(o => o.destroy());
    L(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setInteractive());
    L(ui(this, 140, 70, 'frame_big', 1000, 580));
    L(txt(this, W / 2, 112, `Habilidades — ${CLASSES[c.cls].name}`, 34, '#f3e2b8', { origin: 0.5, title: true }));
    const list = CLASS_SKILLS[c.cls];
    list.forEach((sk, i) => {
      const x = 300 + i * 340, y = 360, on = c.level >= sk.lvl;
      if (i < 2) L(this.add.image(x + 170, y - 40, nineTex(this, c.level >= list[i + 1].lvl ? 'bar_gold' : 'bar_dark', 90, 14)));
      const card = L(ui(this, x - 140, y - 170, 'panel_parch', 280, 330)); if (!on) card.setTint(0x6a6458);
      const ic = L(this.add.image(x, y - 100, `sk_${c.cls}_${SKILL_ICON_KINDS[i]}`)); ic.setScale(104 / ic.width);
      if (!on) { ic.setTint(0x555555); L(uiImg(this, x, y - 100, 'lock_gold', 44)); }
      else if (sk.key) L(txt(this, x + 40, y - 62, sk.key, 22, '#ffffff', { origin: 0.5, title: true, stroke: 5 }));
      const ink = on ? '#3b2510' : '#2a2218';
      L(txt(this, x, y - 30, sk.name, 23, on ? '#7a4a14' : '#3a2a14', { origin: 0.5, title: true, stroke: 0 }));
      L(txt(this, x, y + 2, on ? (sk.key ? `Tecla ${sk.key}` : 'Passiva') : `Libera no nível ${sk.lvl}`, 17, on ? '#2f6b1e' : '#8a2a10', { origin: 0.5, stroke: 0 }));
      L(txt(this, x, y + 30, sk.desc, 16, ink, { origin: [0.5, 0], align: 'center', wrap: 240, bold: false, stroke: 0 }));
    });
    L(button(this, W / 2, 610, 240, 58, 'Fechar', close, { size: 22 }));
  }
}

// ------------------------------------------------------------
//  MOCHILA / EQUIPAMENTOS
// ------------------------------------------------------------
function statsLine(inst) {
  const st = itemStats(inst), parts = [];
  if (st.atk) parts.push(`ATQ +${st.atk}`); if (st.def) parts.push(`DEF +${st.def}`);
  if (st.hp) parts.push(`VIDA +${st.hp}`); if (st.crit) parts.push(`CRIT +${st.crit}%`);
  return parts.join('   ');
}
const TYPE_COLOR = { pesada: 0xc0392b, leve: 0x27ae60, magica: 0x8e44ad, any: 0xc9a227 };
const TYPE_SLOT = { pesada: 'slot_red', leve: 'slot_green', magica: 'slot_purple', any: 'slot_gold' };
// [moldura, ícone, o ícone já vem com moldura?]
const ITEM_ICON = {
  w_train_sword: [null, 'icon_sword_red', true], w_longsword: [null, 'icon_sword_red', true], w_thornblade: [null, 'icon_sword_red', true],
  w_train_bow: ['slot_green', 'icon_bow'], w_recurve: ['slot_green', 'icon_bow2'], w_shadowbow: ['slot_green', 'icon_bow2'],
  w_train_staff: [null, 'icon_staff', true], w_oakstaff: [null, 'icon_staff', true], w_rootstaff: [null, 'icon_staff', true],
  a_chain: ['slot_red', 'icon_plate'], a_plate: ['slot_red', 'icon_plate'],
  a_leather: ['slot_green', 'icon_leather'], a_hardleather: ['slot_green', 'icon_leather'],
  a_robe: ['slot_purple', 'icon_robe'], a_arcane: ['slot_purple', 'icon_robe'],
  j_ring_str: ['slot_gold', 'icon_ring'], j_moss_ring: ['slot_gold', 'icon_ring'], j_amulet_life: ['slot_gold', 'icon_amulet'],
  j_earring: ['slot_gold', 'icon_earring'], s_enchant: ['slot_gold', 'icon_scroll'],
  w_venomblade: ['slot_red', 'icon_sword_green'], w_reedbow: ['slot_green', 'icon_bow'], w_bogstaff: ['slot_purple', 'icon_staff'],
  a_scalemail: ['slot_red', 'icon_shield'], a_toadhide: ['slot_green', 'icon_leather'], a_mirerobe: ['slot_purple', 'icon_robe'],
  j_fang: ['slot_gold', 'icon_skull'],
  w_crystalblade: ['slot_red', 'icon_sword_green'], w_prismbow: ['slot_green', 'icon_bow2'], w_geodestaff: [null, 'icon_staff', true],
  a_golemplate: ['slot_red', 'icon_plate'], a_minervest: ['slot_green', 'icon_leather'], a_gemrobe: ['slot_purple', 'icon_robe'],
  j_geode: ['slot_gold', 'icon_ring'],
  w_sunsaber: [null, 'icon_sword_red', true], w_stingbow: ['slot_green', 'icon_bow'], w_pharaohstaff: ['slot_purple', 'icon_staff'],
  a_sandplate: ['slot_red', 'icon_shield'], a_dunecloak: ['slot_green', 'icon_leather'], a_tombrobe: ['slot_purple', 'icon_robe'],
  j_scarab: ['slot_gold', 'icon_amulet'],
};
const TYPE_TXT = (t) => '#' + TYPE_COLOR[t].toString(16).padStart(6, '0');

function itemIcon(scene, x, y, inst, size = 74) {
  const d = ITEMS[inst.id];
  const c = scene.add.container(x, y);
  const [slot, icon, framed] = ITEM_ICON[inst.id] || [TYPE_SLOT[d.type], 'icon_bag'];
  if (scene.textures.exists('pi_' + inst.id)) { const im = scene.add.image(0, 0, 'pi_' + inst.id); im.setScale(size / im.width); c.add(im); } // ícone da Loja Premium
  else if (framed) c.add(uiImg(scene, 0, 0, icon, size));
  else { c.add(uiImg(scene, 0, 0, slot || TYPE_SLOT[d.type], size)); c.add(uiImg(scene, 0, 0, icon, size * 0.72)); }
  if (inst.plus) c.add(txt(scene, size / 2 - 4, -size / 2 + 2, '+' + inst.plus, 17, COL.goldTxt, { origin: [1, 0] }));
  if ((inst.qty || 1) > 1) c.add(txt(scene, size / 2 - 5, size / 2 - 4, 'x' + inst.qty, 17, '#ffffff', { origin: [1, 1] }));
  // borda colorida pela raridade (azul = Raro, roxo = Épico)
  const rr = inst.rarity && RARITY[inst.rarity];
  if (rr && rr.glow) {
    const g = scene.add.graphics().lineStyle(4, rr.glow, 0.95).strokeRoundedRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6, 10);
    c.addAt(g, 0); c.add(scene.add.graphics().lineStyle(2, 0xffffff, 0.5).strokeRoundedRect(-size / 2 + 5, -size / 2 + 5, size - 10, size - 10, 8));
    if (inst.rarity === 'epico') { const st = uiImg(scene, -size / 2 + 12, -size / 2 + 12, 'star', 20); c.add(st); }
  }
  return c;
}

class BagScene extends Phaser.Scene {
  constructor() { super('Bag'); }
  create() {
    Music.play('town');
    this.cameras.main.fadeIn(200);
    this.c = Save.cur();
    bgForest(this, 0.72);
    txt(this, W / 2, 36, 'Mochila e Equipamentos', 36, COL.goldTxt, { origin: 0.5, title: true });
    button(this, 110, H - 46, 160, 54, '‹ Vila', () => fadeTo(this, 'Hub'), { size: 22, skin: 'btn_dark3' });
    screenFrame(this);
    this.layer = this.add.container(0, 0);
    this.sel = null;
    this.draw();
  }
  draw() {
    this.layer.removeAll(true);
    const L = (o) => { this.layer.add(o); return o; };
    const c = this.c, k = CLASSES[c.cls], s = charStats(c);
    L(panel(this, 20, 70, 400, 560));
    L(this.add.ellipse(220, 388, 180, 26, 0x000000, 0.5));
    L(charImage(this, 220, 392, c, 0.74));
    L(txt(this, 220, 92, `${c.name} • Nv.${c.level}`, 24, COL.text, { origin: [0.5, 0], title: true }));
    L(txt(this, 220, 122, `${k.name} — usa itens ${GEAR_TYPE_LABEL[k.gearType]}s`, 17, COL.goldTxt, { origin: [0.5, 0] }));
    L(txt(this, 50, 408, `Vida ${s.hp}    Ataque ${s.atk}\nDefesa ${s.def}   Crítico ${s.crit}%\nOuro 🪙 ${c.gold}`, 20, COL.text, { lineSpacing: 6 }));
    ['arma', 'armadura', 'joia'].forEach((slot, i) => {
      const x = 95 + i * 125, y = 555;
      L(txt(this, x, y - 52, SLOT_LABEL[slot], 15, COL.dim, { origin: 0.5 }));
      const it = c.equip[slot];
      if (it) {
        const ic = L(itemIcon(this, x, y, it));
        ic.setSize(74, 74).setInteractive({ useHandCursor: true }).on('pointerup', () => { this.sel = { inst: it, equipped: slot }; this.draw(); });
        if (this.sel && this.sel.inst === it) L(this.add.rectangle(x, y, 82, 82).setStrokeStyle(3, 0xffffff));
      } else {
        L(uiImg(this, x, y, 'slot_dark', 74).setAlpha(0.8));
      }
    });

    // mochila
    L(panel(this, 440, 70, 470, 560));
    const cap = bagCap(c), pages = Math.ceil(cap / 25);
    this.page = Math.min(this.page || 0, pages - 1);
    L(txt(this, 460, 86, `Mochila (${c.bag.length}/${cap})`, 22, COL.goldTxt, { title: true }));
    if (pages > 1) {
      L(txt(this, 790, 92, `Página ${this.page + 1}/${pages}`, 16, COL.dim, { origin: [0.5, 0] }));
      if (this.page > 0) L(button(this, 730, 100, 44, 36, '‹', () => { this.page--; this.draw(); }, { size: 20 }));
      if (this.page < pages - 1) L(button(this, 852, 100, 44, 36, '›', () => { this.page++; this.draw(); }, { size: 20 }));
    }
    const first = this.page * 25;
    for (let i = first; i < Math.min(cap, first + 25); i++) {
      const j = i - first, x = 495 + (j % 5) * 88, y = 165 + Math.floor(j / 5) * 88;
      const it = c.bag[i];
      if (!it) { L(uiImg(this, x, y, 'slot_dark', 74).setAlpha(0.8)); continue; }
      const ic = L(itemIcon(this, x, y, it));
      ic.setSize(74, 74).setInteractive({ useHandCursor: true }).on('pointerup', () => { Sfx.click(); this.sel = { inst: it }; this.draw(); });
      if (this.sel && this.sel.inst === it) L(this.add.rectangle(x, y, 82, 82).setStrokeStyle(3, 0xffffff));
    }

    // detalhe
    L(panel(this, 930, 70, 330, 560));
    if (!this.sel) { L(txt(this, 1095, 330, 'Toque em um item\npara ver detalhes', 20, COL.dim, { origin: 0.5, align: 'center' })); return; }
    const it = this.sel.inst, d = ITEMS[it.id];
    L(itemIcon(this, 1095, 140, it, 90));
    L(txt(this, 1095, 200, itemLabel(it), 22, itemColor(it), { origin: [0.5, 0], align: 'center', wrap: 300, title: true }));
    if (it.rarity) L(txt(this, 1095, 240, RARITY[it.rarity].name, 16, itemColor(it), { origin: [0.5, 0] }));
    L(txt(this, 1095, 266, `${SLOT_LABEL[d.slot]} • ${GEAR_TYPE_LABEL[d.type]}${d.lvl > 1 ? ' • Nv.' + d.lvl : ''}`, 17, '#' + TYPE_COLOR[d.type].toString(16).padStart(6, '0'), { origin: [0.5, 0] }));
    L(txt(this, 1095, 292, d.info || statsLine(it) + (d.look ? '\n' + d.look : ''), 18, COL.text, { origin: [0.5, 0], align: 'center', wrap: 290, bold: false }));
    const ce = canEquip(c, it);
    let by = 430;
    if (this.sel.equipped) {
      L(button(this, 1095, by, 260, 52, 'Desequipar', () => {
        if (c.bag.length >= bagCap(c)) return toast(this, 'Mochila cheia', COL.red);
        c.bag.push(it); c.equip[this.sel.equipped] = null; Save.write(); this.sel = null; this.draw();
      }, { size: 20 }));
      by += 64;
      const scroll = c.bag.find(b => b.id === 's_enchant'), blessed = c.bag.find(b => b.id === 's_blessed');
      L(button(this, 1095, by, 260, 52, `Encantar (${c.bag.filter(b => b.id === 's_enchant').length} 📜)`, () => this.enchant(it, scroll), { size: 19, disabled: !scroll || it.plus >= 10, onLocked: () => toast(this, it.plus >= 10 ? 'Encantamento máximo (+10)' : 'Compre Pergaminhos na Loja', COL.red) }));
      if (blessed) { by += 60; L(button(this, 1095, by, 260, 52, `Abençoado 100% (${c.bag.filter(b => b.id === 's_blessed').length})`, () => this.enchant(it, blessed, true), { size: 18, skin: 'btn_blue', disabled: it.plus >= 10, onLocked: () => toast(this, 'Encantamento máximo (+10)', COL.red) })); }
    } else if (d.slot === 'consumivel') {
      if (d.use === 'bag') {
        L(button(this, 1095, by, 260, 52, 'Usar', () => this.useItem(it), { size: 20, skin: 'btn_green' }));
        by += 64;
      } else L(txt(this, 1095, 395, d.use === 'auto' ? 'Funciona sozinho na batalha' : 'Use durante a batalha', 16, COL.goldTxt, { origin: 0.5 }));
    } else if (d.slot !== 'pergaminho') {
      if (!ce.ok) L(txt(this, 1095, 380, ce.why, 17, COL.red, { origin: 0.5, align: 'center', wrap: 290 }));
      L(button(this, 1095, by, 260, 52, 'Equipar', () => {
        const old = c.equip[d.slot];
        c.bag.splice(c.bag.indexOf(it), 1); if (old) c.bag.push(old);
        c.equip[d.slot] = it; Save.write(); Sfx.coin(); this.sel = { inst: it, equipped: d.slot }; this.draw();
      }, { size: 20, disabled: !ce.ok, onLocked: () => toast(this, ce.why, COL.red) }));
      by += 64;
    }
    if (!this.sel.equipped) {
      const val = Math.floor(d.price / 4 * (RARITY[it.rarity || 'comum'] || RARITY.comum).mul);
      L(button(this, 1095, by, 260, 52, `Vender (🪙 ${val})`, () => {
        c.bag.splice(c.bag.indexOf(it), 1); c.gold += val; Save.write(); Sfx.coin(); this.sel = null; this.draw();
      }, { size: 19 }));
    }
  }
  useItem(it) {
    const c = this.c, d = ITEMS[it.id];
    if (it.id === 'c_xp') { c.buffs = c.buffs || {}; c.buffs.xp2 = (c.buffs.xp2 || 0) + 3; toast(this, `EXP em dobro nas próximas ${c.buffs.xp2} fases!`, COL.green); Sfx.play('levelup', 0.7, 0); }
    else if (it.id === 'c_gold') { c.gold += 1500; toast(this, '+1500 de ouro!', COL.goldTxt); Sfx.coin(); }
    else return;
    takeItem(c, it.id); if (!c.bag.includes(it)) this.sel = null;
    Save.write(); this.draw();
  }
  enchant(it, scroll, blessed) {
    const c = this.c;
    const chance = blessed ? 100 : ([100, 100, 100, 80, 65, 50, 40, 30, 20, 10][it.plus] ?? 5);
    c.bag.splice(c.bag.indexOf(scroll), 1);
    if (Math.random() * 100 < chance) { it.plus++; Sfx.win(); toast(this, `Sucesso! ${itemLabel(it)}`, COL.green); }
    else { Sfx.lose(); toast(this, `Falhou (chance ${chance}%). O item não foi perdido.`, COL.red); }
    Save.write(); this.draw();
  }
}

// ------------------------------------------------------------
//  LOJA (ouro)
// ------------------------------------------------------------
class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }
  create() {
    Music.play('town');
    this.cameras.main.fadeIn(200);
    this.c = Save.cur(); this.tab = 'arma';
    bgForest(this, 0.3);
    txt(this, W / 2, 40, 'Loja', 46, '#f2c766', { origin: 0.5, title: true }).setStroke('#3a2208', 7);
    this.add.image(W - 118, 42, 'ui_counter_coin').setScale(0.62);
    this.goldT = txt(this, W - 60, 42, '', 26, '#f3e2b8', { origin: [1, 0.5] });
    const tabs = [['arma', 'Armas'], ['armadura', 'Armaduras'], ['joia', 'Joias'], ['pergaminho', 'Pergaminhos']];
    this.tabBtns = {};
    tabs.forEach(([id, label], i) => {
      this.tabBtns[id] = button(this, 275 + i * 255, 108, 234, 56, label, () => { this.tab = id; this.draw(); }, { size: 22, skin: 'tab_dark' });
    });
    this.layer = this.add.container();
    button(this, 110, H - 46, 160, 54, '‹ Vila', () => fadeTo(this, 'Hub'), { size: 22, skin: 'btn_dark3' });
    screenFrame(this);
    this.draw();
  }
  draw() {
    this.layer.removeAll(true);
    const c = this.c, myType = CLASSES[c.cls].gearType;
    this.goldT.setText(`${c.gold}`);
    for (const [id, b] of Object.entries(this.tabBtns)) {
      b.setSkin(id === this.tab ? 'tab_sel' : 'tab_dark');
      b.label.setColor(id === this.tab ? '#f6e7c1' : '#b9ae95');
    }
    const list = Object.entries(ITEMS).filter(([, d]) => d.shop && d.slot === this.tab);
    const L = (o) => { this.layer.add(o); return o; };
    list.forEach(([id, d], i) => {
      const x = 78 + (i % 3) * 400, y = 172 + Math.floor(i / 3) * 222, w = 372, h = 200;
      const mine = d.type === 'any' || d.type === myType;
      L(ui(this, x, y, mine ? 'panel_parch2' : 'panel_header', w, h));
      const ink = mine ? '#3b2510' : '#f3e2b8';
      L(itemIcon(this, x + 66, y + 66, { id, plus: 0 }, 84));
      L(txt(this, x + 122, y + 26, d.name, 20, ink, { wrap: 236, title: true, stroke: mine ? 0 : 3 }));
      L(txt(this, x + 122, y + 82, `${GEAR_TYPE_LABEL[d.type]}${d.lvl > 1 ? ' • Nv.' + d.lvl : ''}`, 16, TYPE_TXT(d.type), { stroke: mine ? 0 : 3 }));
      L(txt(this, x + 26, y + 112, d.info || statsLine({ id, plus: 0 }), 15, mine ? '#5a4128' : '#cfc3a6', { wrap: 330, bold: false, stroke: 0 }));
      if (!mine) L(txt(this, x + w - 28, y + 112, 'Outra classe', 15, '#ff6b5e', { origin: [1, 0], stroke: 3 }));
      const buy = L(button(this, x + w / 2, y + h - 34, 214, 50, 'Comprar', () => {
        if (c.gold < d.price) return toast(this, 'Ouro insuficiente', COL.red);
        if (c.bag.length >= bagCap(c)) return toast(this, 'Mochila cheia', COL.red);
        c.gold -= d.price; c.bag.push(Save.makeItem(id)); Save.write(); Sfx.coin();
        toast(this, `${d.name} foi para a mochila`, COL.green); this.draw();
      }, { size: 19, skin: 'btn_buy', textX: -36 }));
      buy.add(uiImg(this, 26, -1, 'coin_c', 24));
      buy.add(txt(this, 42, -1, String(d.price), 19, '#f6e7c1', { origin: [0, 0.5] }));
    });
  }
}

// ------------------------------------------------------------
//  MAPA DO MODO AVENTURA
// ------------------------------------------------------------
class MapScene extends Phaser.Scene {
  constructor() { super('Map'); }
  init(data) { this.areaSel = data && data.area; }
  create() {
    Music.play('town');
    this.cameras.main.fadeIn(220);
    const c = Save.cur();
    c.progress = c.progress || {}; c.stars = c.stars || {};
    const isOpen = (a) => a.ready && c.level >= a.minLvl;
    // área mostrada: a pedida, senão a última liberada
    if (!this.areaSel || !isOpen(areaById(this.areaSel))) this.areaSel = [...AREAS].reverse().find(isOpen).id;
    const area = areaById(this.areaSel), phases = PHASES[area.id];
    if (this.textures.exists(area.bg)) { this.add.image(W / 2, H / 2, area.bg).setDisplaySize(W + 10, H + 6); this.add.rectangle(W / 2, H / 2, W, H, 0x05080a, 0.3); }
    else bgForest(this, 0.3);
    txt(this, W / 2, 38, 'Modo Aventura', 44, '#f2c766', { origin: 0.5, title: true }).setStroke('#3a2208', 7);

    // lista de áreas
    ui(this, 30, 76, 'frame_tall', 336, 566);
    AREAS.forEach((a, i) => {
      const unlocked = isOpen(a), sel = a.id === area.id;
      const sub = `Nível ${a.minLvl}–${a.maxLvl}${a.ready ? '' : ' • em breve'}`;
      const b = button(this, 198, 136 + i * 86, 288, 74, a.name, () => { if (!sel) this.scene.restart({ area: a.id }); }, {
        size: 20, sub, skin: unlocked ? (sel ? 'area_sel' : 'area_dark') : 'area_lock', textX: unlocked ? 0 : 16, disabled: !unlocked,
        onLocked: () => toast(this, a.ready ? `Requer nível ${a.minLvl}` : `${a.name} chega na próxima atualização`, COL.red),
      });
      if (unlocked && !sel) b.setAlpha(0.85);
    });

    const done = c.progress[area.id] || 0, stars = c.stars[area.id] || {};
    const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
    ui(this, 384, 76, 'frame_big', 870, 566);
    txt(this, 819, 104, area.name, 32, '#f3e2b8', { origin: [0.5, 0], title: true });
    txt(this, 819, 146, `${done}/${area.phases} fases concluídas  •  ★ ${totalStars}/${area.phases * 3}`, 18, '#d8ccb0', { origin: [0.5, 0] });
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const row = Math.floor(i / 5), col = row ? 4 - (i % 5) : i % 5;
      pts.push({ x: 486 + col * 173, y: 262 + row * 200 });
    }
    // trilha entre as fases
    for (let i = 0; i < 9; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
      const seg = this.add.image((a.x + b.x) / 2, (a.y + b.y) / 2, nineTex(this, i < done ? 'bar_gold' : 'bar_dark', len, 14));
      seg.setRotation(Math.atan2(b.y - a.y, b.x - a.x));
    }
    pts.forEach((p, i) => {
      const n = i + 1, open = n <= done + 1, cleared = n <= done, current = n === done + 1, boss = phases[i].boss.final;
      let key = cleared ? (i % 2 ? 'medal_bronze' : 'medal_gold') : current ? 'medal_green_big' : 'medal_lock';
      if (boss && open && !cleared) key = 'medal_dark';
      const size = current ? 104 : 86;
      if (current) {
        const glow = uiImg(this, p.x, p.y, 'medal_green_big', size + 18).setAlpha(0.35);
        this.tweens.add({ targets: glow, scale: glow.scale * 1.18, alpha: 0, duration: 900, repeat: -1 });
      }
      uiImg(this, p.x, p.y, key, size);
      if (open) txt(this, p.x, p.y - 1, boss ? '☠' : String(n), boss ? 40 : 38, '#f6e7c1', { origin: 0.5, title: !boss, stroke: 6 });
      if (cleared) {
        const st = stars[n] || 1;
        for (let k = 0; k < 3; k++) uiImg(this, p.x + (k - 1) * 26, p.y + size / 2 + 12, k < st ? 'star' : 'star_dark', 26);
      }
      const z = this.add.zone(p.x, p.y, size + 10, size + 10).setInteractive({ useHandCursor: open });
      z.on('pointerup', () => {
        if (!open) return toast(this, 'Conclua a fase anterior primeiro', COL.red);
        Sfx.click(); fadeTo(this, 'Battle', { area: area.id, phase: n });
      });
    });
    const nx = Math.min(10, done + 1), rw = phaseRewards(nx, area.id);
    txt(this, 819, 608, done >= 10 ? `${area.name} concluída! Repita fases para ganhar estrelas, EXP, ouro e itens.` :
      `Próxima: Fase ${nx} — recompensa ${rw.xp} EXP e ${rw.gold} de ouro  •  ★ vença com pouco dano e rápido`, 18, COL.goldTxt, { origin: 0.5 });
    button(this, 110, H - 40, 160, 54, '‹ Vila', () => fadeTo(this, 'Hub'), { size: 22, skin: 'btn_dark3' });
    screenFrame(this);
  }
}

// ------------------------------------------------------------
//  LOJA PREMIUM (diamantes 💎)
// ------------------------------------------------------------
// entrega o que foi comprado para o personagem atual
function premiumNeedSlots(c, e) {
  if (e.service) return 0;
  if (e.bundle) return e.bundle.length;
  return isStack(e.id) && c.bag.some(b => b.id === e.id) ? 0 : 1;
}
function grantPremium(c, e) {
  if (e.id === 'bag_plus') { c.bagExtra = Math.min(BAG_MAX - BAG_SIZE, (c.bagExtra || 0) + 8); return; }
  const ids = e.bundle || [e.id];
  for (const id of ids) {
    const d = ITEMS[id];
    if (d.premium) addItem(c, id, { rarity: 'epico', plus: 3 });
    else addItem(c, id, { qty: e.qty || 1 });
  }
}
function premiumCatalog(c) {
  const mine = PREMIUM_SHOP.equip.filter(e => !e.cls || e.cls === c.cls);
  const set = mine.map(e => e.id);
  const full = mine.reduce((n, e) => n + e.gems, 0);
  const bundle = { id: 'bundle_' + c.cls, gems: 300, bundle: set, name: 'Pacote do Herói', icon: 'gems_m',
    info: `${set.map(id => ITEMS[id].name).join(' + ')}. Economize ${full - 300} 💎. Visual completo!` };
  return { equip: [...mine, bundle], items: PREMIUM_SHOP.items, packs: PREMIUM_SHOP.packs };
}

class PremiumScene extends Phaser.Scene {
  constructor() { super('Premium'); }
  create() {
    Music.play('town');
    this.cameras.main.fadeIn(200);
    this.c = Save.cur(); this.tab = this.tab || 'equip';
    bgForest(this, 0.45);
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a0d2e, 0.35);
    txt(this, W / 2, 40, 'Loja Premium', 46, '#c9a6ff', { origin: 0.5, title: true }).setStroke('#22103a', 7);
    this.add.image(W - 104, 42, 'ui_counter_diamond').setScale(0.8);
    this.gemT = txt(this, W - 126, 42, '', 26, '#9fe3ff', { origin: [0, 0.5] });
    if (typeof Cloud !== 'undefined' && Cloud.user) Cloud.refreshDiamonds().then(() => this.gemT.active && this.gemT.setText(String(Wallet.gems())));
    this.tabBtns = {};
    [['equip', 'Equipamentos'], ['items', 'Itens'], ['packs', 'Diamantes']].forEach(([id, label], i) => {
      this.tabBtns[id] = button(this, W / 2 + (i - 1) * 270, 108, 250, 56, label, () => { this.tab = id; this.draw(); }, { size: 22, skin: 'tab_dark' });
    });
    button(this, 110, H - 46, 160, 54, '‹ Vila', () => fadeTo(this, 'Hub'), { size: 22, skin: 'btn_dark3' });
    screenFrame(this);
    this.layer = this.add.container(0, 0);
    this.draw();
  }
  draw() {
    this.layer.removeAll(true);
    const L = (o) => { this.layer.add(o); return o; };
    const c = this.c, cat = premiumCatalog(c);
    this.gemT.setText(String(Wallet.gems()));
    for (const k in this.tabBtns) this.tabBtns[k].setSkin(k === this.tab ? 'tab_sel' : 'tab_dark');
    if (this.tab === 'packs') return this.drawPacks(L, cat.packs);
    const list = cat[this.tab];
    const tall = this.tab === 'equip';               // equipamentos: 4 cartas altas; itens: 3 por linha, deitadas
    const cols = tall ? 4 : 3, cw = tall ? 286 : 380, ch = tall ? 440 : 238, x0 = W / 2 - (cols - 1) * cw / 2;
    list.forEach((e, i) => {
      const x = x0 + (i % cols) * cw, y = (tall ? 375 : 268) + Math.floor(i / cols) * (ch + 12);
      const d = ITEMS[e.id];
      L(ui(this, x - cw / 2 + 8, y - ch / 2, 'panel_parch', cw - 16, ch));
      const name = e.name || (d ? d.name : e.id);
      const sub = e.info || (d && (d.info || (d.premium ? statsLine({ id: e.id, plus: 3, rarity: 'epico' }) + (d.look ? '\n' + d.look : '') : ''))) || '';
      const owned = e.service ? `Mochila: ${bagCap(c)}/${BAG_MAX}` : (d && d.slot === 'consumivel' ? `Você tem: ${countItem(c, e.id)}` : '');
      const maxed = e.service && bagCap(c) >= BAG_MAX;
      const icon = (ix, iy, sz) => { const im = L(this.add.image(ix, iy, 'pi_' + (e.icon || e.id))); im.setScale(sz / im.width); return im; };
      if (tall) {
        icon(x, y - 140, 120);
        if (e.bundle) e.bundle.forEach((id, k) => { const s = L(this.add.image(x - 40 + k * 40, y - 58, 'pi_' + id)); s.setScale(36 / s.width); });
        L(txt(this, x, y - (e.bundle ? 28 : 62), name, 21, '#4a2a0a', { origin: [0.5, 0], title: true, stroke: 0, align: 'center', wrap: 240 }));
        if (d && d.premium) L(txt(this, x, y - 30, `Épico +3 • ${GEAR_TYPE_LABEL[d.type]} • Nv.${d.lvl}`, 15, '#7a2fb0', { origin: [0.5, 0], stroke: 0 }));
        L(txt(this, x, y + (e.bundle ? 4 : -4), sub, 15, '#3b2510', { origin: [0.5, 0], align: 'center', wrap: 240, bold: false, stroke: 0, lineSpacing: 4 }));
        L(button(this, x, y + ch / 2 - 44, 220, 52, `💎 ${e.gems}`, () => this.confirm(e, name), { size: 23, skin: 'btn_blue' }));
      } else {
        icon(x - 118, y - 30, 108);
        if (owned) L(txt(this, x - 118, y + 38, owned, 14, '#5a3a14', { origin: 0.5, stroke: 0 }));
        L(txt(this, x + 50, y - ch / 2 + 22, name, 20, '#4a2a0a', { origin: [0.5, 0], title: true, stroke: 0, align: 'center', wrap: 220 }));
        L(txt(this, x + 50, y - ch / 2 + 74, sub, 15, '#3b2510', { origin: [0.5, 0], align: 'center', wrap: 220, bold: false, stroke: 0, lineSpacing: 3 }));
        L(button(this, x, y + ch / 2 - 40, 220, 50, maxed ? 'Máximo' : `💎 ${e.gems}`, () => this.confirm(e, name), {
          size: 22, skin: 'btn_blue', disabled: maxed, onLocked: () => toast(this, 'Já está no máximo', COL.red) }));
      }
      if (e.bundle) L(txt(this, x + cw / 2 - 20, y - ch / 2 + 10, 'OFERTA', 15, '#ffffff', { origin: [1, 0] }).setBackgroundColor('#c0392b').setPadding(8, 3));
    });
    if (this.tab === 'equip') L(txt(this, W / 2, 616, `Itens para ${CLASSES[c.cls].name} • chegam Épicos e já encantados +3 na mochila de ${c.name}`, 17, '#e8dfc8', { origin: 0.5 }));
    else L(txt(this, W / 2, 664, `Os itens vão para a mochila de ${c.name}. Diamantes valem para todos os personagens da conta.`, 17, '#e8dfc8', { origin: 0.5 }));
  }
  drawPacks(L, packs) {
    packs.forEach((p, i) => {
      const x = W / 2 + (i - 1) * 300, y = 300;
      L(ui(this, x - 135, y - 140, 'panel_parch', 270, 300));
      if (p.best) L(txt(this, x, y - 150, 'MELHOR OFERTA', 16, '#ffffff', { origin: 0.5 }).setBackgroundColor('#c0392b').setPadding(10, 4));
      const im = L(this.add.image(x, y - 50, 'pi_' + p.icon)); im.setScale(130 / im.width);
      L(txt(this, x, y + 32, `💎 ${p.gems}`, 30, '#2a6fd6', { origin: 0.5, title: true, stroke: 0 }));
      if (p.bonus) L(txt(this, x, y + 64, p.bonus, 16, '#2f6b1e', { origin: 0.5, stroke: 0 }));
      L(button(this, x, y + 112, 200, 50, p.price, () => this.buyPack(p), { size: 22, skin: 'btn_green' }));
    });
    L(ui(this, 170, 486, 'panel_header', 940, 150));
    L(txt(this, W / 2, 506, 'Ganhe diamantes jogando', 22, '#9fe3ff', { origin: [0.5, 0], title: true }));
    L(txt(this, W / 2, 544, `Cada estrela nova em uma fase: ${GEM_REWARDS.star} 💎   •   Conquistar uma área: ${GEM_REWARDS.area} 💎   •   Subir de nível: ${GEM_REWARDS.level} 💎`, 18, COL.text, { origin: [0.5, 0] }));
    L(txt(this, W / 2, 580, 'Compra com dinheiro real: disponível quando o jogo estiver na Google Play.', 16, COL.dim, { origin: [0.5, 0] }));
  }
  buyPack(p) {
    // Google Play Billing (app Android publicado) — ponte nativa "AetherBilling"
    if (window.AetherBilling && window.AetherBilling.buy) { window.AetherBilling.buy(p.id); return; }
    toast(this, 'Compras com dinheiro real chegam quando o jogo estiver na Google Play', COL.blue);
  }
  confirm(e, name) {
    const c = this.c;
    if (Wallet.gems() < e.gems) return this.noGems(e);
    if (premiumNeedSlots(c, e) > bagCap(c) - c.bag.length) return toast(this, 'Mochila cheia — libere espaço primeiro', COL.red);
    const ov = []; const L = (o) => { ov.push(o.setDepth(3000 + ov.length)); return o; };
    const close = () => ov.forEach(o => o.destroy());
    L(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setInteractive());
    L(ui(this, W / 2 - 280, 210, 'frame_big', 560, 300));
    L(txt(this, W / 2, 256, 'Confirmar compra', 30, '#c9a6ff', { origin: 0.5, title: true }));
    L(txt(this, W / 2, 320, `${name}\npor 💎 ${e.gems}?`, 24, COL.text, { origin: 0.5, align: 'center' }));
    L(txt(this, W / 2, 380, `Você ficará com 💎 ${Wallet.gems() - e.gems}`, 17, COL.dim, { origin: 0.5 }));
    let busy = false;
    L(button(this, W / 2 - 125, 450, 210, 58, 'Cancelar', close, { size: 21 }));
    L(button(this, W / 2 + 125, 450, 210, 58, 'COMPRAR', async () => {
      if (busy) return; busy = true;
      const r = await Wallet.spend(e.id, e.gems);
      close();
      if (r.error) return toast(this, r.error, COL.red);
      grantPremium(c, e); Save.write();
      Sfx.play('levelup', 0.7, 0);
      toast(this, `Comprado: ${name}!`, COL.green);
      this.draw();
    }, { size: 22, title: true, skin: 'btn_blue' }));
  }
  noGems(e) {
    toast(this, `Faltam 💎 ${e.gems - Wallet.gems()} — veja a aba Diamantes`, COL.red);
  }
}
