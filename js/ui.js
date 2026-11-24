// ============================================================
//  UI — botões, painéis e textos no estilo do jogo
// ============================================================
const FONT_TITLE = '"Cinzel", Georgia, serif';
const FONT = '"Nunito", "Trebuchet MS", sans-serif';
const COL = {
  gold: 0xe8b64c, goldTxt: '#f2c766', panel: 0x15130f, panelEdge: 0x8a6a2f,
  btn: 0x2c2418, btnHi: 0x4a3a20, text: '#f3ead7', dim: '#a89c84', red: '#e5534b', green: '#6fcf6a', blue: '#62a8ff',
};

function txt(scene, x, y, str, size = 22, color = COL.text, opts = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: opts.title ? FONT_TITLE : FONT, fontSize: size + 'px', color,
    fontStyle: opts.bold === false ? 'normal' : 'bold', align: opts.align || 'left',
    stroke: '#000', strokeThickness: opts.stroke ?? Math.max(2, size / 7),
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined, lineSpacing: opts.lineSpacing || 2,
  });
  if (opts.origin !== undefined) t.setOrigin(...[].concat(opts.origin));
  return t;
}

// ---------- Peças da interface (assets/ui, extraídas do kit SpriteCook) ----------
const UI_KEYS = ["area_dark", "area_lock", "area_sel", "arrow_l", "arrow_r", "bar_blue", "bar_dark", "bar_gold", "bar_red", "bar_track", "bar_track_dark", "btn_back", "btn_blue", "btn_bronze", "btn_brown", "btn_buy", "btn_buy_long", "btn_dark", "btn_dark2", "btn_dark3", "btn_disabled", "btn_gold", "btn_green", "btn_hero", "btn_locked", "btn_long_steel", "btn_long_wood", "btn_next", "btn_sm_blue", "btn_sm_dark", "btn_sm_gold", "btn_sm_wood", "btn_wood", "card_dark", "card_parch", "circle_gold", "coin_c", "corner_bronze", "corner_gold", "corner_steel", "counter_coin", "counter_diamond", "counter_gold", "divider", "frame_big", "frame_tall", "icon_amulet", "icon_bag", "icon_bow", "icon_bow2", "icon_check", "icon_coin", "icon_coins", "icon_diamond", "icon_earring", "icon_gear", "icon_heart", "icon_helmet", "icon_leather", "icon_plate", "icon_potion", "icon_potion_red", "icon_ring", "icon_robe", "icon_scroll", "icon_shield", "icon_shield_round", "icon_skull", "icon_staff", "icon_sword", "icon_sword_green", "icon_sword_red", "icon_swords", "icon_trophy", "icon_x", "lock_dark", "lock_gold", "medal_bronze", "medal_dark", "medal_gold", "medal_green", "medal_green_big", "medal_lock", "oct_green", "oct_purple", "oct_red", "panel_header", "panel_ornate", "panel_parch", "panel_parch2", "slot_blue", "slot_brown", "slot_dark", "slot_gold", "slot_green", "slot_purple", "slot_red", "star", "star_dark", "tab_dark", "tab_olive", "tab_sel", "title_plate", "tri_l", "tri_r"];
function loadUi(scene) { for (const k of UI_KEYS) scene.load.image('ui_' + k, `assets/ui/${k}.png`); }

// bordas que não esticam (esq, cima, dir, baixo) — o resto usa um padrão proporcional
const NINE_BORDERS = {
  btn_hero: [44, 34, 118, 34], btn_locked: [86, 30, 30, 30], panel_header: [46, 46, 46, 46],
  panel_parch: [34, 34, 34, 34], panel_parch2: [40, 40, 40, 40], panel_ornate: [90, 50, 90, 50],
  frame_big: [46, 46, 46, 46], frame_tall: [42, 46, 42, 46], area_lock: [70, 26, 26, 26],
};
// gera (e guarda) uma textura no tamanho pedido com cantos preservados (9-slice);
// funciona tanto em WebGL quanto em Canvas
function nineTex(scene, key, w, h) {
  w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
  const src = 'ui_' + key, tk = `${src}@${w}x${h}`;
  if (scene.textures.exists(tk)) return tk;
  const img = scene.textures.get(src).getSourceImage(), sw = img.width, sh = img.height;
  const d = Math.max(8, Math.min(44, Math.round(Math.min(sw, sh) * 0.3)));
  let [l, t, r, b] = NINE_BORDERS[key] || [d, d, d, d];
  const k = Math.min(1, w / (l + r + 2), h / (t + b + 2)); // alvo menor que as bordas: reduz as bordas
  const L = l * k, R = r * k, T = t * k, B = b * k;
  const ct = scene.textures.createCanvas(tk, w, h), ctx = ct.context;
  const sx = [0, l, sw - r, sw], dx = [0, L, w - R, w], sy = [0, t, sh - b, sh], dy = [0, T, h - B, h];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const sW = sx[i + 1] - sx[i], sH = sy[j + 1] - sy[j], dW = dx[i + 1] - dx[i], dH = dy[j + 1] - dy[j];
    if (sW > 0 && sH > 0 && dW > 0 && dH > 0) ctx.drawImage(img, sx[i], sy[j], sW, sH, dx[i], dy[j], dW, dH);
  }
  ct.refresh();
  return tk;
}
function ui(scene, x, y, key, w, h) { // peça esticável, canto superior esquerdo em (x, y)
  return scene.add.image(x, y, nineTex(scene, key, w, h)).setOrigin(0, 0);
}
function uiImg(scene, x, y, key, size) { // peça fixa (ícones, medalhões); size = maior lado
  const im = scene.add.image(x, y, 'ui_' + key);
  if (size) im.setScale(size / Math.max(im.width, im.height));
  return im;
}

// painel: por padrão a pedra escura com cantoneiras de bronze
function panel(scene, x, y, w, h, alpha = 1, skin = 'panel_header') {
  return ui(scene, x, y, skin, w, h).setAlpha(alpha < 0.7 ? alpha : 1);
}

// moldura de pedra nos 4 cantos da tela (como nas telas de referência)
function screenFrame(scene, key = 'corner_steel', size = 92) {
  const s = size / 90;
  [[0, 0, false, false], [W, 0, true, false], [0, H, false, true], [W, H, true, true]].forEach(([x, y, fx, fy]) => {
    scene.add.image(x, y, 'ui_' + key).setOrigin(fx ? 1 : 0, fy ? 1 : 0).setScale(s).setFlip(fx, fy).setDepth(900).setScrollFactor(0);
  });
}

// escolhe a pele do botão (compatível com as chamadas antigas por cor)
function skinFor(opts) {
  if (opts.skin) return opts.skin;
  if (opts.disabled) return 'btn_disabled';
  const c = opts.color;
  if (c === 0x5a3a12 || c === 0x3a2a10) return 'btn_buy_long';
  if (c === 0x3a4a22) return 'btn_green';
  if (c === 0x1d2c44) return 'btn_blue';
  return 'btn_dark';
}

// Botão com pele, estado desabilitado e sub-título
function button(scene, x, y, w, h, label, onClick, opts = {}) {
  const c = scene.add.container(x, y);
  const disabled = !!opts.disabled;
  const skin = skinFor(opts);
  const bg = scene.add.image(0, 0, nineTex(scene, skin, w, h));
  if (disabled && skin !== 'btn_locked') bg.setTint(0x8a8a8a);
  const tx = opts.textX || 0;
  const t = txt(scene, tx, opts.sub ? -9 : -1, label, opts.size || 24, disabled ? '#9a927f' : (opts.textColor || '#f6e7c1'), { origin: 0.5, title: opts.title });
  c.add([bg, t]);
  if (opts.sub) c.add(txt(scene, tx, 17, opts.sub, 15, disabled ? '#857d6b' : COL.goldTxt, { origin: 0.5 }));
  c.setSize(w, h);
  const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: !disabled });
  c.add(zone);
  zone.on('pointerover', () => { if (!disabled) bg.setTint(0xfff1d6); });
  zone.on('pointerout', () => { if (!disabled) bg.clearTint(); c.setScale(1); });
  zone.on('pointerdown', () => { if (!disabled) c.setScale(0.96); });
  zone.on('pointerup', () => {
    c.setScale(1);
    if (disabled) { if (opts.onLocked) opts.onLocked(); return; }
    Sfx.click(); onClick && onClick();
  });
  c.label = t; c.bg = bg;
  c.redraw = () => {};
  c.setSkin = (k) => bg.setTexture(nineTex(scene, k, w, h));
  return c;
}

function toast(scene, msg, color = COL.text) {
  const t = txt(scene, W / 2, H - 70, msg, 22, color, { origin: 0.5 }).setDepth(9999).setScrollFactor(0);
  scene.tweens.add({ targets: t, y: H - 110, alpha: 0, delay: 1300, duration: 600, onComplete: () => t.destroy() });
}

function bar(scene, x, y, w, h, color) {
  const g = scene.add.graphics();
  g.set = (pct) => {
    pct = Phaser.Math.Clamp(pct, 0, 1);
    g.clear();
    g.fillStyle(0x000000, 0.7).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, h / 2 + 2);
    g.fillStyle(0x2a2a2a, 1).fillRoundedRect(x, y, w, h, h / 2);
    if (pct > 0) {
      g.fillStyle(color, 1).fillRoundedRect(x, y, Math.max(h, w * pct), h, h / 2);
      g.fillStyle(0xffffff, 0.25).fillRoundedRect(x + 2, y + 2, Math.max(h - 4, w * pct - 4), h / 3, h / 6);
    }
  };
  g.set(1); return g;
}

function bgForest(scene, dark = 0.45) {
  scene.add.image(W / 2, H / 2, 'forest').setDisplaySize(W + 10, H + 6);
  scene.add.rectangle(W / 2, H / 2, W, H, 0x05080a, dark);
}

function fadeTo(scene, key, data) {
  scene.cameras.main.fadeOut(220, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

// ---------- Sons (assets/audio, gerados por tools/synth.py) ----------
// Sfx.play('nome') toca um efeito; se o arquivo não carregou, cai no bipe sintetizado.
const SFX_KEYS = ['arrow', 'bash', 'boss_roar', 'click', 'coin', 'dash', 'explosion', 'fire_cast', 'growl', 'hit', 'hit_heavy', 'hurt',
  'jump', 'land', 'levelup', 'lose', 'monster_die', 'orb', 'roll', 'slam', 'soulshot', 'spin', 'spores', 'step', 'swing', 'swing_heavy',
  'warn', 'warp_in', 'warp_out', 'win'];
const MUSIC_KEYS = ['forest', 'town', 'boss', 'swamp', 'caves', 'desert', 'peaks', 'citadel', 'abyss'];
function loadAudio(scene) {
  for (const k of SFX_KEYS) scene.load.audio('sfx_' + k, `assets/audio/${k}.ogg`);
  for (const k of MUSIC_KEYS) scene.load.audio('mus_' + k, `assets/audio/music_${k}.ogg`);
}
const Settings = {
  data: { sfx: true, music: true, blood: true },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('aether_settings') || '{}')); } catch (e) {} },
  save() { try { localStorage.setItem('aether_settings', JSON.stringify(this.data)); } catch (e) {} },
};
Settings.load();

const Music = {
  cur: null, key: null, vol: 0.3,
  play(key) {
    const g = window.game;
    if (!g || this.key === key) return;
    this.key = key;
    const old = this.cur; this.cur = null;
    if (old) this.fade(old, old.volume, 0, 600, () => old.destroy());
    if (!Settings.data.music || !g.cache.audio.exists('mus_' + key)) return;
    try {
      this.cur = g.sound.add('mus_' + key, { loop: true, volume: 0 });
      this.cur.play();
      this.fade(this.cur, 0, this.vol, 900);
    } catch (e) { this.cur = null; }
  },
  stop(ms = 600) { const o = this.cur; this.cur = null; this.key = null; if (o) this.fade(o, o.volume, 0, ms, () => o.destroy()); },
  duck(on) { if (this.cur) this.fade(this.cur, this.cur.volume, on ? this.vol * 0.35 : this.vol, 300); },
  fade(snd, from, to, ms, done) {
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      try { snd.setVolume(from + (to - from) * k); } catch (e) { return; }
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    };
    step();
  },
  toggle() {
    Settings.data.music = !Settings.data.music; Settings.save();
    const k = this.key; this.key = null;
    if (Settings.data.music && k) this.play(k); else { this.stop(200); this.key = k; }
  },
};

const Sfx = {
  ctx: null,
  get on() { return Settings.data.sfx; },
  vol: 0.75,
  lastAt: {},
  // toca um efeito gravado; variação leve de tom para não cansar o ouvido
  play(key, vol = 1, vary = 0.06) {
    const g = window.game;
    if (!this.on) return true;
    if (!g || !g.cache.audio.exists('sfx_' + key)) return false;
    const now = performance.now();
    if (this.lastAt[key] && now - this.lastAt[key] < 35) return true; // evita empilhar o mesmo som no mesmo quadro
    this.lastAt[key] = now;
    try { g.sound.play('sfx_' + key, { volume: vol * this.vol, rate: 1 + (Math.random() * 2 - 1) * vary }); } catch (e) {}
    return true;
  },
  ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } return this.ctx; },
  tone(freq, dur = 0.08, type = 'square', vol = 0.06, slide = 0) {
    if (!this.on || !this.ensure()) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  },
  click() { this.play('click', 0.8, 0.03) || this.tone(660, 0.05, 'triangle', 0.05); },
  swing() { this.play('swing', 0.7) || this.tone(300, 0.1, 'sawtooth', 0.04, -200); },
  shoot() { this.play('arrow', 0.85, 0.05) || this.tone(900, 0.07, 'triangle', 0.05, -500); },
  magic() { this.play('orb', 0.6) || this.tone(500, 0.18, 'sine', 0.07, 400); },
  hit() { this.play('hit', 0.8) || this.tone(140, 0.08, 'square', 0.06, -60); },
  hurt() { this.play('hurt', 0.9, 0.04) || this.tone(220, 0.15, 'sawtooth', 0.07, -150); },
  coin() { this.play('coin', 0.5, 0.02) || (this.tone(988, 0.06, 'square', 0.04), setTimeout(() => this.tone(1319, 0.12, 'square', 0.04), 70)); },
  win() { this.play('win', 0.8, 0) || [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.06), i * 120)); },
  lose() { this.play('lose', 0.8, 0) || [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.06), i * 180)); },
  toggle() { Settings.data.sfx = !Settings.data.sfx; Settings.save(); },
};

// ---------- som em segundo plano: app minimizado / tela bloqueada = silêncio
// (o app Android também chama AetherBg ao ir para o segundo plano, antes de pausar o jogo)
window.AetherBg = function (hidden) {
  const g = window.game;
  try {
    const ctx = g && g.sound && g.sound.context;
    if (ctx) { if (hidden) ctx.suspend(); else ctx.resume(); }
    if (g && g.sound) g.sound.mute = !!hidden;
    if (Sfx.ctx) { if (hidden) Sfx.ctx.suspend(); else Sfx.ctx.resume(); }
  } catch (e) {}
};
document.addEventListener('visibilitychange', () => window.AetherBg(document.hidden));
window.addEventListener('pagehide', () => window.AetherBg(true));
window.addEventListener('pageshow', () => { if (!document.hidden) window.AetherBg(false); });

// indicador do salvamento na nuvem (☁ Salvo / Salvando / sem internet)
function cloudBadge(scene, x, y) {
  const t = txt(scene, x, y, '', 16, COL.dim, { origin: 0.5 });
  const show = (s) => {
    const m = { ok: ['☁ Progresso salvo na nuvem', '#8fd88a'], sync: ['☁ Salvando...', '#d8ccb0'],
      offline: ['Sem internet — salvo no aparelho, envia depois', '#ffcc66'], erro: ['Não foi possível salvar na nuvem — tentando de novo', '#ff9a8a'] }[s];
    if (m && t.active) t.setText(m[0]).setColor(m[1]);
  };
  show(Cloud.status);
  const off = Cloud.onStatus(show);
  scene.events.once('shutdown', off);
  if (Cloud.conflict) { Cloud.conflict = false; toast(scene, 'Progresso atualizado com o de outro aparelho', COL.blue); }
  return t;
}
