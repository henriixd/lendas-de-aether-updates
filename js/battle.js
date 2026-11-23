// ============================================================
//  MODO AVENTURA — fase de combate 2D
//  Tela 1 (monstro) → seta verde → tela 2 (monstro) → Chefe
// ============================================================
const SEG = 2048;         // largura de cada "trecho" da fase (a câmera segue o personagem dentro dele)
const GRAVITY = 2350;
const JUMP_V = -930;
const MOVE_SPEED = 385;
// comportamento de cada monstro: alcance, avanço do golpe, pausa entre ataques
const MONSTER_AI = {
  goblin:   { reach: 70,  hitW: 95,  lunge: 70,  minWind: 0.36, cd: [0.25, 0.6], turn: 0.14 },
  wolf:     { reach: 190, hitW: 85,  lunge: 260, minWind: 0.40, cd: [0.35, 0.75], turn: 0.12, pounce: true },
  mushroom: { reach: 75,  hitW: 90,  lunge: 45,  minWind: 0.42, cd: [0.4, 0.85], turn: 0.18, spores: true },
  treant:   { reach: 90,  hitW: 120, lunge: 35,  minWind: 0.55, cd: [0.55, 1.0], turn: 0.25, wave: true, heavy: true },
  // Pântano Venenoso
  toad:     { reach: 210, hitW: 90,  lunge: 240, minWind: 0.42, cd: [0.35, 0.8], turn: 0.14, pounce: true },
  slime:    { reach: 80,  hitW: 95,  lunge: 40,  minWind: 0.45, cd: [0.45, 0.9], turn: 0.2, spores: true, heavy: true },
  lizard:   { reach: 120, hitW: 150, lunge: 95,  minWind: 0.38, cd: [0.25, 0.55], turn: 0.12 },
  // Cavernas de Cristal / Deserto Escarlate
  golem:    { reach: 95,  hitW: 130, lunge: 40,  minWind: 0.55, cd: [0.5, 0.95], turn: 0.24, wave: true, heavy: true },
  scorpion: { reach: 170, hitW: 120, lunge: 190, minWind: 0.40, cd: [0.3, 0.7], turn: 0.13, pounce: true },
  skeleton: { reach: 80,  hitW: 110, lunge: 80,  minWind: 0.36, cd: [0.25, 0.6], turn: 0.14 },
};
// golpes especiais dos chefes (um a cada ~5–7 s)
const BOSS_SKILLS = {
  goblin: ['bombs', 'summon'], wolf: ['charge', 'summon'], mushroom: ['rain'], treant: ['roots'],
  toad: ['leap'], slime: ['rain', 'summon'], lizard: ['spears', 'charge'],
  golem: ['leap', 'spears'], scorpion: ['charge', 'rain'], skeleton: ['summon', 'bombs'],
};
const SKILL_NAMES = { bombs: 'Bombas!', summon: 'Chamou reforços!', charge: 'Investida!', rain: 'Chuva de esporos!', roots: 'Raízes!', leap: 'Salto esmagador!', spears: 'Lanças!' };
const PLAT_TOP = { plat_forest: 0.17, plat_swamp: 0.23, plat_caves: 0.17, plat_desert: 0.17 }; // onde fica o "chão" da plataforma na imagem
const MONSTER_H = { goblin: 160, wolf: 135, mushroom: 160, treant: 205, toad: 120, slime: 125, lizard: 185, golem: 205, scorpion: 130, skeleton: 175 };
// variantes de cor (ex.: Goblin Mineiro) têm folhas próprias, mas lutam como o monstro base
for (const k in MONSTERS) { const b = MONSTERS[k].base; if (!b) continue;
  MONSTER_AI[k] = MONSTER_AI[b]; MONSTER_H[k] = MONSTER_H[b]; BOSS_SKILLS[k] = BOSS_SKILLS[b]; }

class BattleScene extends Phaser.Scene {
  constructor(key = 'Battle') { super(key); }
  init(data) { this.areaId = data.area || 'forest'; this.phase = data.phase || 1; }

  create() {
    this.cameras.main.fadeIn(300);
    Music.play(areaById(this.areaId).music || 'forest');
    this.ch = Save.cur();
    this.k = CLASSES[this.ch.cls];
    this.st = charStats(this.ch);
    this.area = areaById(this.areaId);
    const def = PHASES[this.areaId][this.phase - 1];
    this.segments = [...def.screens.map(s => ({ list: s })), { list: [def.boss.type], boss: def.boss }];
    this.seg = 0; this.state = 'play'; this.paused = false;
    this.monsters = []; this.shots = []; this.eShots = []; this.hz = []; this.hitstop = 0; this.potUsed = 0; this.revived = false;
    this.input.addPointer(3);

    // ---------- cenário (uma imagem por tela, espelhando para variar)
    const area = this.area;
    // cenário em faixas da largura da tela, espelhando uma sim outra não (as bordas casam)
    const total = SEG * this.segments.length;
    for (let i = 0, x = 0; x < total; i++, x += W) {
      const im = this.add.image(x + W / 2, H / 2, area.bg).setDisplaySize(W + 2, H + 4).setTint(area.tint);
      if (i % 2) im.setFlipX(true);
    }
    // escurece a floresta ("sombria") e vinheta
    this.add.rectangle(SEG * this.segments.length / 2, H / 2, SEG * this.segments.length, H, area.fog, 0.28);
    this.add.particles(0, 0, 'fx_dot', {
      x: { min: 0, max: SEG * this.segments.length }, y: area.rising ? H + 10 : -10, lifespan: 9000, speedY: area.rising ? { min: -45, max: -20 } : { min: 25, max: 60 },
      speedX: { min: -30, max: 30 }, scale: { min: 0.25, max: 0.6 }, tint: area.leaves,
      alpha: { start: 0.8, end: 0.2 }, frequency: 180, rotate: { min: 0, max: 360 },
    }).setDepth(50);
    // câmera: segue o personagem com suavidade e olha um pouco à frente
    this.camTarget = this.add.zone(160, H / 2, 1, 1);
    this.cameras.main.setBounds(0, 0, SEG, H);
    this.cameras.main.startFollow(this.camTarget, true, 0.09, 0.09);
    this.lookAhead = 0;

    // ---------- jogador
    this.makePlayer(160);
    this.buildPlatforms();
    this.stats = { t0: this.time.now, dmg: 0, paused: 0 };
    this.buildHud();
    this.buildControls();
    this.spawnSegment(0);
    this.banner(`${area.name} — Fase ${this.phase}`, 'Derrote os monstros para avançar');
  }
  // cria o personagem do jogador na posição x
  makePlayer(x0) {
    const p = this.p = {
      x: x0, y: GROUND_Y, vx: 0, vy: 0, face: 1, ground: true, hp: this.st.hp, maxHp: this.st.hp,
      mp: 0, cd: 0, inv: 0, busy: 0, walkT: 0, kvx: 0, sx: 1, sy: 1, plat: null, dropT: 0, cd2: 0, potCd: 0, combo: 0, lastAtk: 0, cancelAt: 0, hurtAt: 0, dashCd: 0, airDash: 1, coyote: 0, bJump: 0, bDash: 0, bAtk: 0, dash: null,
    };
    p.shadow = this.add.ellipse(p.x, GROUND_Y, 120, 22, 0x000000, 0.45).setDepth(9);
    // sprite animado (parado/andar/ataque/dano/especial gerados no SpriteCook)
    createAnims(this);
    this.animBase = animBaseFor(this.ch);
    p.spr = this.add.sprite(p.x, p.y, this.ak('idle')).setDepth(20);
    p.action = null; p.anim = null;
    this.playAnim('idle');
    p.spr.on('animationcomplete', (anim) => {
      if (/_(attack|special|hurt)$/.test(anim.key) && p.action !== 'dash') { p.action = null; }
    });

    // efeitos das armas premium (brilho próprio) e do Amuleto da Fênix
    this.wfx = premiumWeapon(this.ch) ? { warrior: 0xff5a2a, hunter: 0x7fd8ff, mage: 0xfff1a8 }[this.ch.cls] : null;
    this.phoenix = !!(this.ch.equip.joia && this.ch.equip.joia.id === 'p_phoenixamulet');
    this.fxT = 0;
    return p;
  }

  // ======================================================== HUD
  // fixa o elemento na tela (inclusive os filhos de botões/containers, senão o clique
  // é calculado na posição antiga depois que a câmera anda)
  hud(o) {
    const fix = (g) => { g.setScrollFactor(0); if (g.list) g.list.forEach(fix); };
    fix(o);
    o.setDepth(1000 + (o.depth || 0)); return o;
  }
  buildHud() {
    const c = this.ch;
    this.hud(panel(this, 14, 12, 430, 112, 0.8));
    this.hud(txt(this, 32, 22, `${c.name}`, 24, COL.text, { title: true }));
    this.hud(txt(this, 424, 26, `Nv.${c.level}`, 20, COL.goldTxt, { origin: [1, 0] }));
    this.hpBar = this.hud(bar(this, 32, 62, 390, 22, 0xd43b3b));
    this.hpTxt = this.hud(txt(this, 227, 73, '', 16, '#fff', { origin: 0.5 }));
    this.mpBar = this.hud(bar(this, 32, 94, 390, 14, 0x3d7bff));
    this.mpTxt = this.hud(txt(this, 227, 101, '', 12, '#fff', { origin: 0.5 }));

    this.hud(txt(this, W / 2, 20, `${this.area.name} • Fase ${this.phase}`, 22, COL.goldTxt, { origin: [0.5, 0], title: true }));
    this.dots = this.segments.map((s, i) => this.hud(txt(this, W / 2 + (i - 1) * 40, 58, s.boss ? '☠' : '●', 24, COL.dim, { origin: [0.5, 0] })));
    this.bossUi = this.add.container(0, 0).setScrollFactor(0).setDepth(1001).setVisible(false);
    this.bossName = txt(this, W / 2, 96, '', 20, '#ffb3b3', { origin: [0.5, 0] });
    this.bossBar = bar(this, W / 2 - 260, 124, 520, 18, 0xa52a2a);
    this.bossUi.add([this.bossName, this.bossBar]);

    const pb = button(this, W - 50, 44, 64, 56, 'II', () => this.togglePause(), { size: 24 });
    this.hud(pb);

    this.goArrow = this.hud(this.add.image(W - 120, 250, 'fx_go').setVisible(false));
    this.goTxt = this.hud(txt(this, W - 120, 310, 'AVANCE!', 26, '#7dff6a', { origin: 0.5 }).setVisible(false));
    this.tweens.add({ targets: [this.goArrow], x: W - 95, duration: 380, yoyo: true, repeat: -1 });
  }
  updateHud() {
    const p = this.p;
    this.hpBar.set(p.hp / p.maxHp); this.hpTxt.setText(`${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`);
    this.mpBar.set(p.mp / 100); this.mpTxt.setText(p.mp >= 100 ? 'ESPECIAL PRONTO!' : `MP ${Math.floor(p.mp)}`);
    this.dots.forEach((d, i) => d.setColor(i < this.seg ? COL.goldTxt : i === this.seg ? '#ffffff' : COL.dim));
    const boss = this.monsters.find(m => m.boss && m.hp > 0);
    this.bossUi.setVisible(!!boss);
    if (boss) { this.bossName.setText(`☠ ${boss.name}`); this.bossBar.set(boss.hp / boss.max); }
    if (this.slots) this.slots.forEach(sl => sl.refresh());
  }

  // ======================================================== CONTROLES
  buildControls() {
    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,Q,SPACE,SHIFT,L,C,J,K,X,Z,ESC');
    this.held = { left: false, right: false };
    this.tap = { atk: false, jump: false, skill: false, dash: false };
    const mk = (x, y, r, label, onDown, onUp, size = 30) => {
      const c = this.add.container(x, y).setScrollFactor(0).setDepth(1100);
      const g = this.add.graphics().fillStyle(0x000000, 0.35).fillCircle(0, 0, r).lineStyle(3, 0xffffff, 0.45).strokeCircle(0, 0, r);
      const t = txt(this, 0, 0, label, size, '#ffffff', { origin: 0.5 }).setAlpha(0.9);
      c.add([g, t]);
      const z = this.add.zone(x, y, r * 2.2, r * 2.2).setScrollFactor(0).setInteractive().setDepth(1101);
      z.on('pointerdown', () => { c.setScale(0.9); onDown(); });
      const up = () => { c.setScale(1); onUp && onUp(); };
      z.on('pointerup', up); z.on('pointerout', up);
      return c;
    };
    const touch = this.sys.game.device.input.touch || location.search.includes('touch');
    const cls = this.ch.cls, lvl = this.ch.level, p = this.p, sk = CLASS_SKILLS[cls];
    // estado de cada habilidade: pronta? quanto falta? bloqueada?
    const st = {
      dash: () => { const cd = Math.max(0, p.dashCd) / (p.dashCdMax || 400); const air = !p.ground && p.airDash <= 0;
        return { ready: cd <= 0 && !air && !p.dash, fill: air ? 0 : 1 - cd, secs: p.dashCd > 0 ? Math.ceil(p.dashCd / 1000) : 0 }; },
      k: () => ({ ready: p.mp >= 100, fill: Math.min(1, p.mp / 100), glow: p.mp >= 100 }),
      l: () => lvl < sk[1].lvl ? { locked: true } : (p.cd2 > 0 ? { ready: false, fill: 1 - p.cd2 / 900 } : { ready: p.mp >= SKILL2_MP, fill: Math.min(1, p.mp / SKILL2_MP) }),
      p: () => lvl < sk[2].lvl ? { locked: true } : { ready: true, fill: 1, passive: true },
      pot: () => { const n = Math.min(POTION_LIMIT - this.potUsed, countItem(this.ch, 'c_potion'));
        return { ready: n > 0 && p.potCd <= 0 && p.hp < p.maxHp, fill: p.potCd > 0 ? 1 - p.potCd / 1500 : 1, label: 'x' + Math.max(0, n) }; },
    };
    this.slots = [];
    if (!touch) {
      // PC: barra de habilidades embaixo, com a tecla de cada uma
      const items = [['dash', 'Espaço', ''], ['k', 'K', '100'], ['l', 'L', String(SKILL2_MP)], ['p', '', ''], ['pot', 'Q', 'x0']].slice(0, this.pvp ? 4 : 5);
      const size = 66, gap = 84, x0 = W / 2 - gap * 2;
      this.hud(this.add.rectangle(W / 2, H - 48, gap * 5 + 16, size + 22, 0x000000, 0.4).setStrokeStyle(2, 0x8a6a2f, 0.7));
      items.forEach(([k, key, cost], i2) => this.slots.push(this.skillSlot(x0 + i2 * gap, H - 48, size, k, key, cost, st[k])));
      this.hud(txt(this, 22, H - 22, 'A/D andar • W pular • S descer • J atacar • ESC pausar', 15, '#e8dfc8', { origin: [0, 0.5], bold: false }).setAlpha(0.8));
      return;
    }
    mk(105, H - 95, 64, '◀', () => this.held.left = true, () => this.held.left = false, 34);
    mk(255, H - 95, 64, '▶', () => this.held.right = true, () => this.held.right = false, 34);
    mk(W - 125, H - 110, 82, this.k.attack.kind === 'melee' ? '⚔' : this.k.attack.kind === 'arrow' ? '🏹' : '✦',
      () => { this.tap.atk = true; this.atkHeld = true; }, () => this.atkHeld = false, 44);
    mk(W - 275, H - 72, 56, '⤒', () => { this.tap.jump = true; this.jumpHeld = true; }, () => this.jumpHeld = false, 32);
    // celular: botões com o ícone de cada habilidade
    this.slots.push(this.skillSlot(W - 262, H - 222, 96, 'dash', '', '', st.dash, () => this.tap.dash = true));
    this.slots.push(this.skillSlot(W - 95, H - 268, 96, 'k', '', '100', st.k, () => this.tap.skill = true));
    if (lvl >= sk[1].lvl) this.slots.push(this.skillSlot(W - 215, H - 360, 82, 'l', '', String(SKILL2_MP), st.l, () => this.tap.skill2 = true));
    if (!this.pvp) this.slots.push(this.skillSlot(W - 360, H - 330, 72, 'pot', '', 'x0', st.pot, () => this.tap.pot = true));
  }

  // ícone de habilidade: escurece de cima para baixo enquanto carrega / recarrega,
  // fica cinza sem MP, brilha quando o especial está pronto e mostra cadeado se bloqueada
  skillSlot(x, y, size, kind, key, cost, state, onTap) {
    const c = this.add.container(x, y).setScrollFactor(0).setDepth(1100);
    const icon = this.add.image(0, 0, kind === 'pot' ? 'pi_c_potion' : `sk_${this.ch.cls}_${kind}`);
    icon.setScale(size / icon.width);
    const shade = this.add.graphics();
    const glow = this.add.rectangle(0, 0, size + 8, size + 8).setStrokeStyle(4, 0xffe27a, 1).setAlpha(0);
    c.add([glow, icon, shade]);
    if (key) {
      c.add(this.add.rectangle(size / 2 - 12, size / 2 - 10, key.length > 1 ? 58 : 26, 24, 0x000000, 0.75).setOrigin(key.length > 1 ? 0.75 : 0.5, 0.5));
      c.add(txt(this, size / 2 - 12 - (key.length > 1 ? 14 : 0), size / 2 - 10, key, 15, '#ffffff', { origin: 0.5 }));
    }
    const costTxt = cost ? txt(this, -size / 2 + 6, size / 2 - 10, cost, 14, '#8fc4ff', { origin: [0, 0.5] }) : null;
    if (costTxt) c.add(costTxt);
    const lock = uiImg(this, 0, -4, 'lock_gold', size * 0.42).setVisible(false); c.add(lock);
    const secs = txt(this, 0, -2, '', Math.round(size * 0.42), '#ffffff', { origin: 0.5, title: true, stroke: 5 }).setVisible(false); c.add(secs); // recarga em segundos
    const lockTxt = txt(this, 0, size / 2 - 14, '', 14, '#f2c766', { origin: 0.5 }).setVisible(false); c.add(lockTxt);
    if (onTap) {
      const z = this.add.zone(x, y, size * 1.2, size * 1.2).setScrollFactor(0).setInteractive().setDepth(1101);
      z.on('pointerdown', () => { c.setScale(0.9); onTap(); });
      const up = () => c.setScale(1); z.on('pointerup', up); z.on('pointerout', up);
    }
    const sk = CLASS_SKILLS[this.ch.cls];
    let pulse = null, wasReady = false;
    const slot = {
      refresh: () => {
        const s = state();
        shade.clear();
        if (s.locked) {
          icon.setTint(0x444444); lock.setVisible(true); if (costTxt) costTxt.setVisible(false);
          lockTxt.setVisible(true).setText(`Nv.${kind === 'l' ? sk[1].lvl : sk[2].lvl}`);
          return;
        }
        lock.setVisible(false); lockTxt.setVisible(false); if (costTxt) { costTxt.setVisible(true); if (s.label !== undefined && costTxt.text !== s.label) costTxt.setText(s.label); }
        if (s.ready) icon.clearTint(); else icon.setTint(0x808080);
        secs.setVisible(!!s.secs); if (s.secs && secs.text !== String(s.secs)) secs.setText(String(s.secs));
        const f = Phaser.Math.Clamp(s.fill ?? 1, 0, 1);
        if (f < 1) shade.fillStyle(0x000000, 0.55).fillRect(-size / 2, -size / 2, size, size * (1 - f));
        if (s.glow && !pulse) { pulse = this.tweens.add({ targets: glow, alpha: { from: 0.2, to: 1 }, duration: 450, yoyo: true, repeat: -1 }); }
        if (!s.glow && pulse) { pulse.stop(); pulse = null; glow.setAlpha(0); }
        if (s.ready && !wasReady && !s.passive) this.tweens.add({ targets: c, scale: { from: 1.15, to: 1 }, duration: 180 }); // "ficou pronto"
        wasReady = !!s.ready;
      },
    };
    slot.refresh();
    return slot;
  }

  // ======================================================== SPAWN
  spawnSegment(i) {
    const s = this.segments[i];
    s.list.forEach((type, j) => this.spawnMonster(type, i * SEG + (s.boss ? 1250 : 1050) + j * 190 + (j % 2 ? 0 : 0), s.boss));
    if (s.boss) {
      Music.play('boss');
      this.cameras.main.shake(400, 0.006);
      this.banner('⚠ CHEFE ⚠', s.boss.name, '#ff6b6b');
    }
  }
  spawnMonster(type, x, boss, opt = {}) {
    const t = MONSTERS[type], kind = type;
    const ms = monsterStats((this.area.tier || 0) + this.phase, kind, !!boss);
    const bossMul = boss ? (boss.final ? 1.9 : 1.45) : 1;
    const wm = ANIM_META[`${type}_walk`];
    const m = {
      type, kind, name: boss ? boss.name : t.name, boss: !!boss, final: boss && boss.final,
      hp: ms.hp, max: ms.hp, dmg: ms.dmg, speed: t.speed * (boss ? 0.95 : 1), baseSpeed: t.speed,
      ai: MONSTER_AI[type], look: -1, turnT: 0, stun: 0, poise: 0, combo: 0, yOff: 0,
      range: t.range * (boss ? 1.45 : 1) * (boss && boss.final ? 1.2 : 1),
      state: 'enter', t: 0.6, x, sizeMul: bossMul * (opt.add ? 0.8 : 1), fpsMul: boss ? 0.9 : 1, anim: null,
      add: !!opt.add, skillT: 3.5,
    };
    if (opt.add) { m.hp = m.max = Math.round(ms.hp * 0.45); m.dmg = Math.round(ms.dmg * 0.7); }
    m.height = MONSTER_H[type] * m.sizeMul;
    m.halfW = wm.w * wm.scale * m.sizeMul * 0.42;
    m.shadow = this.add.ellipse(x, GROUND_Y, m.halfW * 2.2, 20, 0x000000, 0.45).setDepth(9);
    m.spr = this.add.sprite(x + 120, GROUND_Y, `${type}_walk`).setDepth(15).setAlpha(0);
    m.tint = boss ? (boss.final ? 0xc9a0ff : 0xffc0b0) : null;
    if (m.tint) m.spr.setTint(m.tint);
    this.monAnim(m, 'walk');
    m.spr.setScale(m.baseScale, m.baseScale);
    this.tweens.add({ targets: m.spr, x, alpha: 1, duration: 550, ease: 'Quad.out' });
    if (!boss) m.bar = this.add.graphics().setDepth(30);
    this.monsters.push(m);
  }
  // troca a animação do monstro (walk / attack / death / idle = 1º quadro do andar)
  monAnim(m, name) {
    if (m.anim === name) return;
    let key = `${m.type}_${name === 'idle' ? 'walk' : name}`, mt = ANIM_META[key];
    if (!mt) { key = `${m.type}_walk`; mt = ANIM_META[key]; name = name === 'walk' ? 'walk' : 'idle'; } // animação ainda não existe: usa o andar
    m.anim = name;
    m.spr.setOrigin(mt.ox, mt.oy); m.baseScale = mt.scale * m.sizeMul;
    if (name === 'idle') { m.spr.anims.stop(); m.spr.setTexture(key, 0); return; }
    m.spr.play(key, true); m.spr.anims.timeScale = m.fpsMul;
  }

  // ======================================================== LOOP
  update(time, delta) {
    if (this.paused) return;
    const K = this.keys;
    if (Phaser.Input.Keyboard.JustDown(K.ESC)) this.togglePause();
    // hitstop: congela tudo por alguns ms quando um golpe conecta (dá peso ao impacto)
    if (this.hitstop > 0) {
      this.hitstop -= delta;
      if (this.hitstop <= 0) this.anims.resumeAll();
      return;
    }
    const dt = Math.min(delta, 50) / 1000;
    const p = this.p;
    const JD = (k) => Phaser.Input.Keyboard.JustDown(k);

    // ---------- entrada com "buffer" (o comando apertado um pouco antes ainda vale)
    if (this.tap.jump || JD(K.W) || JD(K.UP)) p.bJump = 140;
    if ((JD(K.S) || JD(K.DOWN)) && p.plat) p.dropT = 180;
    if (this.tap.dash || JD(K.SPACE) || JD(K.SHIFT)) p.bDash = 140;
    if (this.tap.atk || JD(K.J) || JD(K.Z)) p.bAtk = 160;
    const wantSkill = this.tap.skill || JD(K.K) || JD(K.X);
    const wantSkill2 = this.tap.skill2 || JD(K.L) || JD(K.C);
    const wantPot = this.tap.pot || JD(K.Q);
    const jumpHeld = this.jumpHeld || K.W.isDown || K.UP.isDown;
    const atkHeld = this.atkHeld || K.J.isDown || K.Z.isDown;
    this.tap.atk = this.tap.jump = this.tap.skill = this.tap.dash = this.tap.skill2 = this.tap.pot = false;
    p.bJump -= delta; p.bDash -= delta; p.bAtk -= delta;
    p.cd -= delta; p.inv -= delta; p.dashCd -= delta; p.coyote -= delta; p.cd2 -= delta; p.potCd -= delta;
    p.mp = Math.min(100, p.mp + 2.5 * dt);

    if (this.state === 'play' && !p.dead && !(p.stunUntil > this.time.now)) {
      if (p.dash) this.updateDash(dt, delta);
      else {
        const left = this.held.left || K.LEFT.isDown || K.A.isDown;
        const right = this.held.right || K.RIGHT.isDown || K.D.isDown;
        const dir = (right ? 1 : 0) - (left ? 1 : 0);
        const now = this.time.now;
        // depois que o golpe sai, o resto da animação pode ser cancelado por qualquer comando
        // (andar, pular, atacar de novo = combo). Antes disso o lado fica travado.
        if (p.action === 'attack' && now >= p.cancelAt && (dir || p.bJump > 0 || p.bAtk > 0 || atkHeld)) { p.action = null; p.anim = null; }
        if (p.action === 'hurt' && now - p.hurtAt > 190 && (dir || p.bJump > 0 || p.bAtk > 0)) { p.action = null; p.anim = null; }
        if (dir && p.action !== 'attack' && p.action !== 'special') p.face = dir;
        const slow = p.action === 'special' ? 0 : p.action === 'hurt' ? 0.55 : p.action === 'attack' ? (p.ground ? 0.72 : 1) : 1;
        const target = dir * MOVE_SPEED * slow;
        // acelera rápido, freia ainda mais rápido (resposta imediata)
        const acc = (p.ground ? (dir && Math.sign(target) === Math.sign(p.vx || target) ? 4200 : 7000) : 3800) * dt;
        if (p.ground && dir && p.vx * dir < -220) this.skid(); // virada brusca levanta poeira
        p.vx += Phaser.Math.Clamp(target - p.vx, -acc, acc);

        // pulo (W / ↑) com "coyote time" e altura variável (soltar cedo = pulo baixo)
        if (p.bJump > 0 && (p.ground || p.coyote > 0) && p.action !== 'special' && p.action !== 'hurt') {
          p.vy = JUMP_V; p.ground = false; p.coyote = 0; p.bJump = 0; p.jumpCut = false;
          Sfx.play('jump', 0.6);
          this.dust(p.x, 6);
          this.squash(0.86, 1.14, 160);
        }
        if (!jumpHeld && !p.ground && p.vy < -260 && !p.jumpCut) { p.vy *= 0.5; p.jumpCut = true; }

        // dash (Espaço) — cancela o ataque, mas não o especial
        if (p.bDash > 0 && p.dashCd <= 0 && p.action !== 'special' && (p.ground || p.airDash > 0)) this.startDash(dir || p.face);
        else if ((p.bAtk > 0 || atkHeld) && p.cd <= 0 && !p.action) { p.bAtk = 0; this.attack(); }
        if (wantSkill) this.skill();
        if (wantSkill2) this.skill2();
        if (wantPot) this.drinkPotion();
      }
    } else if (this.state !== 'transition') p.vx = 0;

    // ---------- física
    if (this.state !== 'transition') p.x += (p.vx + p.kvx) * dt;
    p.kvx *= Math.pow(0.0008, dt);
    // sair da plataforma pela borda / descer com S ou ↓
    if (p.plat && (p.x < p.plat.x - p.plat.w / 2 + 6 || p.x > p.plat.x + p.plat.w / 2 - 6 || p.dropT > 0)) { p.plat = null; p.ground = false; p.coyote = p.dropT > 0 ? 0 : 90; }
    p.dropT -= delta;
    if (!p.ground && !(p.dash && p.dash.hover)) {
      const prevY = p.y;
      p.vy += GRAVITY * (p.vy > 0 ? 1.3 : 1) * dt;
      p.vy = Math.min(p.vy, 1500);
      p.y += p.vy * dt;
      let floor = GROUND_Y, plat = null;
      if (p.vy >= 0 && !(p.dropT > 0)) for (const pl of this.plats) {
        if (prevY <= pl.y + 2 && p.y >= pl.y && Math.abs(p.x - pl.x) < pl.w / 2 - 6) { floor = pl.y; plat = pl; break; }
      }
      if (p.y >= floor) {
        const impact = p.vy;
        p.y = floor; p.vy = 0; p.ground = true; p.airDash = 1; p.plat = plat;
        this.dust(p.x, 4, floor);
        if (impact > 500) { this.squash(1.14, 0.86, 140); Sfx.play('land', 0.6); }
      }
    }
    if (p.ground) p.coyote = 100;
    const segL = this.seg * SEG, cleared = this.monsters.length === 0;
    if (this.state === 'play') {
      p.x = Phaser.Math.Clamp(p.x, segL + 50, segL + SEG - (cleared ? 20 : 50));
      if (cleared && this.seg < this.segments.length - 1 && p.x >= segL + SEG - 70) this.nextSegment();
    }

    // ---------- visual do jogador
    if (!p.dead && !p.dash) {
      const moving = this.state === 'transition' || (Math.abs(p.vx) > 40 && p.ground);
      if (!p.action) {
        if (!p.ground) this.airPose();
        else this.playAnim(moving ? 'walk' : 'idle');
      }
      // passada acompanha a velocidade
      if (p.anim === 'walk') p.spr.anims.timeScale = this.state === 'transition' ? 1 : Phaser.Math.Clamp(Math.abs(p.vx) / MOVE_SPEED, 0.55, 1.15);
      else if (p.spr.anims.timeScale !== 1) p.spr.anims.timeScale = 1;
      p.spr.x = p.x; p.spr.y = p.y;
      // inclinação: no ar acompanha a subida/queda; correndo, leve inclinação para frente
      const lean = !p.ground ? Phaser.Math.Clamp(p.vx / MOVE_SPEED, -1, 1) * 5 + (p.vy < 0 ? -2 : 3) * p.face
        : (!p.action && moving ? Phaser.Math.Clamp(p.vx / MOVE_SPEED, -1, 1) * 3 : 0);
      p.spr.angle = Phaser.Math.Linear(p.spr.angle, lean, Math.min(1, dt * 14));
      p.spr.setScale(p.baseScale * p.face * p.sx, p.baseScale * p.sy);
      p.spr.setAlpha(p.inv > 0 && p.action !== 'special' ? (Math.floor(time / 70) % 2 ? 0.45 : 1) : 1);
    }
    const fl = this.floorBelow(p.x, p.y);
    p.shadow.x = p.x; p.shadow.y = fl; p.shadow.setScale(Math.max(0.3, 1 - (fl - p.y) / 500));
    // alvo da câmera: um pouco à frente para onde o personagem olha
    this.lookAhead = Phaser.Math.Linear(this.lookAhead, p.face * 150, Math.min(1, dt * 2.5));
    this.camTarget.x = p.x + this.lookAhead; this.camTarget.y = H / 2;

    this.updateMonsters(dt, delta);
    this.updateShots(dt);
    this.updateEnemyShots(dt);
    this.updateHazards(dt);
    this.weaponFx(dt);
    this.updateHud();
  }

  // partículas da arma premium e da aura da Fênix
  weaponFx(dt) {
    const p = this.p;
    if ((!this.wfx && !this.phoenix) || p.dead || p.spr.alpha < 0.3) return;
    this.fxT -= dt; if (this.fxT > 0) return;
    this.fxT = 0.06;
    const h = (ANIM_META[p.spr.texture.key] ? ANIM_META[p.spr.texture.key].size : 216) * Math.abs(p.spr.scaleY);
    const cls = this.ch.cls, f = p.face;
    if (this.wfx) {
      // ponto aproximado da arma em relação aos pés (fração da altura do quadro)
      const at = { warrior: [0.28, 0.32], hunter: [0.22, 0.5], mage: [0.3, 0.88] }[cls];
      const x = p.x + f * h * at[0] + Phaser.Math.Between(-14, 14), y = p.y - h * at[1] + Phaser.Math.Between(-16, 16);
      const d = this.add.image(x, y, cls === 'mage' ? 'fx_glow' : 'fx_dot').setTint(this.wfx).setDepth(21).setBlendMode('ADD')
        .setScale(cls === 'mage' ? 0.12 : Phaser.Math.FloatBetween(0.35, 0.7)).setAlpha(0.9);
      const tw = cls === 'warrior' ? { y: y - Phaser.Math.Between(30, 60), x: x - f * 10 }      // brasas subindo
        : cls === 'hunter' ? { x: x + Phaser.Math.Between(-22, 22), y: y + Phaser.Math.Between(-22, 22) } // faíscas
        : { scale: 0.32, angle: 90 };                                                            // estrela piscando
      this.tweens.add(Object.assign({ targets: d, alpha: 0, duration: cls === 'hunter' ? 140 : 380, onComplete: () => d.destroy() }, tw));
      if (cls === 'hunter' && Math.random() < 0.18) { // pequeno raio
        const r = this.add.rectangle(x, y, 3, Phaser.Math.Between(18, 34), 0xbfeaff).setAngle(Phaser.Math.Between(-40, 40)).setDepth(21).setBlendMode('ADD');
        this.tweens.add({ targets: r, alpha: 0, duration: 90, onComplete: () => r.destroy() });
      }
    }
    if (this.phoenix && Math.random() < 0.45) {
      const x = p.x + Phaser.Math.Between(-40, 40), y = p.y - Phaser.Math.Between(0, 30);
      const e = this.add.image(x, y, 'fx_dot').setTint(Math.random() < 0.5 ? 0xff9a2a : 0xffd36b).setScale(0.4).setDepth(19).setBlendMode('ADD');
      this.tweens.add({ targets: e, y: y - Phaser.Math.Between(50, 90), alpha: 0, scale: 0.1, duration: 600, onComplete: () => e.destroy() });
    }
  }
  // pose no ar: quadro "subindo" e quadro "caindo" da corrida
  airPose() {
    const p = this.p, key = this.ak('walk'), mt = ANIM_META[key];
    const frame = p.vy < -120 ? 2 : p.vy > 180 ? 6 : 4;
    if (p.anim !== 'air') { p.anim = 'air'; p.spr.anims.stop(); p.spr.setOrigin(mt.ox, mt.oy); p.baseScale = mt.scale; }
    if (p.airFrame !== frame) { p.airFrame = frame; p.spr.setTexture(key, frame); }
  }
  // estica / achata o corpo (impulso do pulo e impacto da queda)
  squash(sx, sy, ms) {
    const p = this.p;
    this.tweens.killTweensOf(p, ['sx', 'sy']);
    p.sx = sx; p.sy = sy;
    this.tweens.add({ targets: p, sx: 1, sy: 1, duration: ms, ease: 'Back.out' });
  }
  skid() {
    const p = this.p, now = this.time.now;
    if (p.skidAt && now - p.skidAt < 250) return;
    p.skidAt = now; this.dust(p.x + p.face * 20, 3);
  }
  freeze(ms) {
    if (ms <= 0) return;
    if (!(this.hitstop > 0)) this.anims.pauseAll();
    this.hitstop = Math.max(this.hitstop || 0, ms);
  }
  dust(x, n, y = GROUND_Y) {
    for (let i = 0; i < n; i++) {
      const d = this.add.image(x + Phaser.Math.Between(-30, 30), y - 4, 'fx_dot').setTint(0xb9a98a).setScale(Phaser.Math.FloatBetween(0.4, 0.9)).setAlpha(0.7).setDepth(18);
      this.tweens.add({ targets: d, x: d.x + Phaser.Math.Between(-50, 50), y: d.y - Phaser.Math.Between(8, 30), alpha: 0, scale: 0.1, duration: 360, onComplete: () => d.destroy() });
    }
  }
  // cópia do personagem que some aos poucos (rastro do dash)
  ghost(tint, alpha = 0.45) {
    const s = this.p.spr;
    const g = this.add.image(s.x, s.y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY)
      .setScale(s.scaleX, s.scaleY).setAngle(s.angle).setTintFill(tint).setAlpha(alpha).setDepth(19).setBlendMode('ADD');
    this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  // ======================================================== DASH (Espaço)
  // Guerreiro: cambalhota no chão / avanço de escudo no ar
  // Caçador:   cambalhota no chão / avanço rápido no ar
  // Mago:      teleporte (chão e ar)
  startDash(dir, force) {
    const p = this.p, cls = this.ch.cls, air = !p.ground;
    p.bDash = 0; p.bAtk = 0;
    p.face = dir;
    p.action = 'dash'; p.actionToken = (p.actionToken || 0) + 1; // cancela o golpe pendente
    if (air) p.airDash = 0;
    p.vx = 0; p.kvx = 0;
    let kind;
    if (force) kind = force;
    else if (cls === 'mage') kind = 'teleport';
    else if (!air) kind = 'roll';
    else kind = cls === 'warrior' ? 'bash' : 'airdash';
    const D = {
      roll:     { dur: 360, speed: 940, iframes: 300, cd: 330, color: cls === 'warrior' ? 0xffd36b : 0x9cff8a },
      bash:     { dur: 260, speed: 1080, iframes: 260, cd: 380, color: 0xffd36b, hover: true },
      charge:   { dur: 330, speed: 1180, iframes: 330, cd: 300, color: 0xffb040, hover: air },
      airdash:  { dur: 230, speed: 1150, iframes: 230, cd: 330, color: 0x9cff8a, hover: true },
      teleport: { dur: 240, dist: 290, iframes: 320, cd: 420, color: 0xc08cff, hover: true },
    }[kind];
    p.dash = { kind, t: 0, ...D, dir, hit: new Set(), ghostT: 0 };
    this.emitAct({ a: 'dash', kind, dir, x: Math.round(p.x), y: Math.round(p.y) });
    // desvio: 4 s de recarga. A Investida de Escudo (habilidade L) não mexe na recarga do desvio
    if (kind !== 'charge') { p.dashCd = DASH_COOLDOWN; p.dashCdMax = DASH_COOLDOWN; }
    p.inv = Math.max(p.inv, D.iframes); p.dodging = true;
    this.time.delayedCall(D.iframes, () => { p.dodging = false; });
    p.vy = D.hover ? 0 : p.vy;
    p.spr.anims.stop(); p.anim = null;
    p.spr.setAlpha(1).clearTint();

    if (kind === 'roll') {
      Sfx.play('roll', 0.8);
      this.dust(p.x, 8);
      // gira em torno do centro do corpo
      const base = this.animBase;
      if (hasAnim(`${base}_roll`)) { // cambalhota desenhada (SpriteCook)
        const mt = ANIM_META[`${base}_roll`];
        p.spr.setOrigin(mt.ox, mt.oy); p.baseScale = mt.scale; p.spr.play(`${base}_roll`);
        p.dash.sheet = true;
      } else { // sem animação própria: gira o quadro da corrida
        const mt = ANIM_META[`${base}_walk`];
        p.spr.setTexture(`${base}_walk`, 2).setOrigin(mt.ox, 0.6);
        p.dash.lift = mt.size * mt.scale * 0.4 * 0.8;
      }
    } else if (kind === 'bash' || kind === 'charge') {
      Sfx.play('dash', 0.75);
      const ak = this.ak('attack'), mt = ANIM_META[ak];
      p.spr.setTexture(ak, 2).setOrigin(mt.ox, mt.oy);
      p.baseScale = mt.scale;
      p.dash.shield = this.add.image(p.x, p.y - 110, 'fx_glow').setTint(0xffd36b).setScale(0.55, 1.05).setAlpha(0.85).setDepth(21).setBlendMode('ADD');
      this.cameras.main.shake(90, 0.004);
    } else if (kind === 'airdash') {
      Sfx.play('dash', 0.7);
      const wk = this.ak('walk'), mt = ANIM_META[wk];
      p.spr.setTexture(wk, 4).setOrigin(mt.ox, mt.oy);
      p.baseScale = mt.scale;
    } else {
      // teleporte: some aqui...
      Sfx.play('warp_out', 0.8);
      this.warpFx(p.x, p.y);
      if (this.ch.level >= 5) this.arcaneBurst(p.x, p.y);
      const segL = this.seg * SEG;
      p.dash.from = p.x;
      p.dash.to = Phaser.Math.Clamp(p.x + dir * D.dist, segL + 50, segL + SEG - 50);
      const wk = `${this.animBase}_warp`;
      if (hasAnim(wk)) { // dissolve em partículas (SpriteCook) e reaparece com a animação ao contrário
        const mt = ANIM_META[wk];
        p.spr.setOrigin(mt.ox, mt.oy); p.baseScale = mt.scale; p.spr.play(wk);
        p.dash.sheet = true; p.dash.vanishAt = 170; p.dash.dur = 330;
      } else this.tweens.add({ targets: p.spr, scaleX: 0, scaleY: p.baseScale * 1.25, alpha: 0, duration: 90, ease: 'Quad.in' });
    }
  }
  warpFx(x, y) {
    const ring = this.add.image(x, y - 4, 'fx_ring').setTint(0xc08cff).setScale(0.35, 0.1).setDepth(17).setBlendMode('ADD');
    this.tweens.add({ targets: ring, scaleX: 0.75, scaleY: 0.2, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    const col = this.add.rectangle(x, y - 110, 16, 230, 0xd6b8ff, 0.8).setDepth(22).setBlendMode('ADD');
    this.tweens.add({ targets: col, scaleX: 5, alpha: 0, duration: 230, onComplete: () => col.destroy() });
    for (let i = 0; i < 14; i++) {
      const d = this.add.image(x + Phaser.Math.Between(-30, 30), y - Phaser.Math.Between(20, 200), 'fx_dot')
        .setTint(Phaser.Utils.Array.GetRandom([0xc08cff, 0x8fd0ff, 0xffffff])).setScale(Phaser.Math.FloatBetween(0.3, 0.7)).setDepth(23).setBlendMode('ADD');
      this.tweens.add({ targets: d, y: d.y - Phaser.Math.Between(30, 90), alpha: 0, scale: 0.05, duration: Phaser.Math.Between(300, 520), onComplete: () => d.destroy() });
    }
  }
  updateDash(dt, delta) {
    const p = this.p, d = p.dash;
    d.t += delta;
    const k = Math.min(1, d.t / d.dur);
    d.ghostT -= delta;
    if (d.kind === 'roll') {
      p.vx = d.dir * d.speed * (1 - k * 0.6);
      if (d.sheet) { p.spr.x = p.x; p.spr.y = p.y; p.spr.angle = 0; p.spr.setScale(p.baseScale * d.dir, p.baseScale); }
      if (d.sheet && d.ghostT <= 0) { this.ghost(d.color, 0.22); d.ghostT = 70; }
      else {
        p.spr.x = p.x; p.spr.y = p.y - d.lift;
        p.spr.angle = d.dir * 360 * Phaser.Math.Easing.Sine.Out(k);
        p.spr.setScale(p.baseScale * 0.82 * d.dir, p.baseScale * 0.82);
      }
      if (!d.sheet && d.ghostT <= 0) { this.ghost(d.color, 0.35); d.ghostT = 45; }
    } else if (d.kind === 'bash' || d.kind === 'airdash' || d.kind === 'charge') {
      p.vx = d.dir * d.speed * (1 - k * 0.35); p.vy = 0;
      p.spr.x = p.x; p.spr.y = p.y;
      p.spr.angle = d.dir * (d.kind === 'airdash' ? 14 : 10);
      p.spr.setScale(p.baseScale * d.dir, p.baseScale);
      if (d.ghostT <= 0) { this.ghost(d.color); d.ghostT = 30; }
      if (d.shield) { d.shield.x = p.x + d.dir * 70; d.shield.y = p.y - 110; }
      if (d.kind === 'bash' || d.kind === 'charge') {
        // o escudo empurra e machuca quem estiver no caminho
        for (const m of this.monsters) {
          if (d.hit.has(m) || m.hp <= 0) continue;
          const dx = (m.x - p.x) * d.dir;
          if (dx > -30 && dx < m.halfW + 80 && Math.abs((m.y ?? GROUND_Y) - p.y) < m.height + 40) {
            d.hit.add(m);
            this.hitMonster(m, this.rollDmg(d.kind === 'charge' ? 1.7 : 0.7), d.kind === 'charge' ? 140 : 90, { stagger: true });
            this.cameras.main.shake(120, 0.007);
            Sfx.play('bash', 0.9);
          }
        }
      }
    } else { // teleporte
      p.vx = 0; p.vy = 0;
      if (d.sheet) { p.spr.x = p.x; p.spr.y = p.y; p.spr.setScale(p.baseScale * d.dir, p.baseScale); }
      if (!d.moved && d.t >= (d.vanishAt || 90)) {
        // ...e aparece lá
        d.moved = true;
        p.x = d.to; p.spr.x = p.x; p.spr.y = p.y;
        this.warpFx(p.x, p.y);
        Sfx.play('warp_in', 0.8);
        if (this.ch.level >= 5) this.arcaneBurst(p.x, p.y);
        if (d.sheet) p.spr.playReverse(`${this.animBase}_warp`);
        else {
          p.spr.setScale(0, p.baseScale * 1.25).setAlpha(0);
          this.tweens.add({ targets: p.spr, scaleX: p.baseScale * d.dir, scaleY: p.baseScale, alpha: 1, duration: 120, ease: 'Back.out' });
        }
      }
      if (!d.moved && d.ghostT <= 0 && !d.sheet) { this.ghost(d.color, 0.4); d.ghostT = 30; }
    }
    if (d.t >= d.dur) this.endDash();
  }
  endDash() {
    const p = this.p, d = p.dash;
    if (!d) return;
    if (d.shield) { const s = d.shield; this.tweens.add({ targets: s, alpha: 0, duration: 120, onComplete: () => s.destroy() }); }
    this.tweens.killTweensOf(p.spr);
    p.dash = null; p.action = null; p.anim = null;
    p.spr.angle = 0; p.spr.setAlpha(1);
    p.vx = d.dir * (d.kind === 'teleport' ? 0 : MOVE_SPEED * 0.8);
    if (d.hover) p.vy = d.kind === 'teleport' ? 0 : 60;
    this.playAnim(p.ground ? 'walk' : 'idle', true);
  }

  // ======================================================== ATAQUES
  emitAct() {} // na arena online, avisa o outro jogador de cada ação (ArenaBattleScene)
  rollDmg(mult) {
    const crit = Math.random() * 100 < this.st.crit;
    return { dmg: Math.max(1, Math.round(this.st.atk * mult * Phaser.Math.FloatBetween(0.9, 1.1) * (crit ? 1.8 : 1))), crit };
  }
  // chave da animação (usa o visual premium quando equipado)
  ak(name) { return charAnimKey(this.ch, name); }
  playAnim(name, force = false) {
    const p = this.p, key = this.ak(name), m = ANIM_META[key];
    if (!m || (p.anim === name && !force)) return;
    p.anim = name;
    p.spr.setOrigin(m.ox, m.oy); p.baseScale = m.scale;
    p.spr.play(key, true);
    p.spr.setScale(p.baseScale * p.face, p.baseScale);
  }
  // executa fn no quadro N da animação atual, se ela ainda estiver tocando
  onFrame(name, frame, fn) {
    const p = this.p, token = p.actionToken = (p.actionToken || 0) + 1;
    this.time.delayedCall(animFrameMs(this.ch.cls, name, frame), () => {
      if (p.dead || this.state === 'ended') return;
      if (p.action === name && (p.actionToken === token || name === 'special')) fn();
    });
  }
  attack() {
    const p = this.p, a = this.k.attack, cls = this.ch.cls, cfg = ANIM_CFG[cls].attack;
    const now = this.time.now;
    // combo de 3 golpes: o 3º é mais forte (empurra e treme a tela)
    p.combo = now - p.lastAtk < 650 ? (p.combo + 1) % 3 : 0;
    p.lastAtk = now;
    this.emitAct({ a: 'atk', combo: p.combo, face: p.face });
    const fin = p.combo === 2;
    const hitMs = animFrameMs(cls, 'attack', cfg.hit);
    p.cancelAt = now + hitMs + 60;
    p.cd = Math.max(a.cooldown * 0.6, hitMs + 60);
    p.action = 'attack'; this.playAnim('attack', true);
    const face = p.face; p.atkFace = face;
    const mult = a.mult * (fin ? 1.45 : 1);
    if (p.ground) p.vx = face * MOVE_SPEED * 0.45; // pequeno passo junto do golpe
    this.onFrame('attack', cfg.hit, () => {
      if (a.kind === 'melee') {
        if (fin) Sfx.play('swing_heavy', 0.8); else Sfx.swing();
        p.x += face * (fin ? 22 : 10);
        const fx = this.add.image(p.x + face * 95, p.y - 100, 'fx_slash').setDepth(25).setFlipX(face < 0)
          .setScale(fin ? 1.25 : 1.0, fin ? 1.25 : (p.combo === 1 ? -1 : 1)).setAlpha(0.75);
        this.tweens.add({ targets: fx, alpha: 0, scaleX: fx.scaleX * 1.3, duration: 160, onComplete: () => fx.destroy() });
        if (this.wfx) { // rastro de fogo da Lâmina do Dragão
          fx.setTint(this.wfx);
          const fx2 = this.add.image(fx.x, fx.y, 'fx_slash').setDepth(25).setFlipX(face < 0).setScale(fx.scaleX * 1.12, fx.scaleY * 1.12)
            .setTint(0xffb23a).setBlendMode('ADD').setAlpha(0.8);
          this.tweens.add({ targets: fx2, alpha: 0, scaleX: fx2.scaleX * 1.35, duration: 240, onComplete: () => fx2.destroy() });
          this.burst(fx.x, fx.y, this.wfx, 5);
        }
        for (const m of this.monsters) {
          const dx = (m.x - p.x) * face;
          if (dx > -40 && dx < a.range + m.halfW && Math.abs(p.y - (m.y ?? GROUND_Y)) < 210) this.hitMonster(m, this.rollDmg(mult), fin ? 70 : 26, { stagger: fin });
        }
        if (fin) this.cameras.main.shake(90, 0.005);
        if (fin && this.ch.level >= 5) { // Fúria: onda de choque pelo chão
          const sh = this.shoot('fx_ring', 760, 0, 0.8, true, 0, { face, dx: 90, dy: -12, noAim: true, life: 0.75, knock: 40 });
          sh.s.setScale(0.3, 0.13).setTint(0xffd36b).setRotation(0); Sfx.play('slam', 0.5);
        }
      } else if (a.kind === 'arrow') {
        Sfx.shoot(); this.shoot('fx_arrow', fin ? 1600 : 1250, 0, mult, fin, 0, { face, dy: -128, dx: 110, knock: fin ? 45 : 10, scale: fin ? 1.3 : 1 });
        if (fin && this.ch.level >= 5) for (const ang of [-9, 9]) this.shoot('fx_arrow', 1450, ang, mult * 0.7, true, 0, { face, dy: -128, dx: 110, noAim: true, scale: 1.1 }); // Tiro Triplo
      } else {
        Sfx.magic(); this.shoot('fx_orb', fin ? 900 : 760, 0, mult, false, fin ? 130 : 80, { face, dy: -138, dx: 105, scale: fin ? 1.45 : 1 });
      }
    });
  }
  shoot(key, speed, angleDeg, mult, pierce, splash = 0, o = {}) {
    const p = this.p, face = o.face || p.face;
    let x = p.x + face * (o.dx ?? 70); const y = p.y + (o.dy ?? -100);
    // arena: rival colado no jogador — o tiro sai já em cima dele (senão nasceria atrás)
    if (this.rival) { const r = this.rival, d = (r.x - p.x) * face; if (d > -20 && d < (o.dx ?? 70) + 20 && Math.abs(r.y - p.y) < 200) x = p.x + face * Math.max(10, d - 10); }
    const s = this.anims.exists(key) ? this.add.sprite(x, y, key).play(key) : this.add.image(x, y, key);
    s.setDepth(26).setFlipX(face < 0).setScale(o.scale || 1);
    // atirando de cima (pulo / plataforma): mira para baixo no monstro mais perto à frente
    // (na arena também mira para cima, no rival em cima da plataforma)
    if (!angleDeg && !o.noAim && (GROUND_Y - p.y > 60 || this.pvp)) {
      let best = null;
      for (const m of this.monsters) { const dx = (m.x - x) * face; if (m.hp > 0 && dx > 40 && dx < 1000 && (!best || dx < best.dx)) best = { m, dx }; }
      if (best) {
        const ty = (best.m.y ?? GROUND_Y) - best.m.height * 0.5;
        if (!this.pvp || Math.abs(ty - y) > 70) angleDeg = Phaser.Math.Clamp(Phaser.Math.RadToDeg(Math.atan2(ty - y, best.dx)), this.pvp ? -40 : 0, 40);
      }
    }
    const rad = Phaser.Math.DegToRad(angleDeg);
    const sh = { s, vx: Math.cos(rad) * speed * face, vy: Math.sin(rad) * speed, mult, pierce, splash, hit: new Set(),
      life: o.life || 1.3, trail: o.trail, knock: o.knock ?? 10, hitR: o.hitR || 0, onHit: o.onHit };
    s.rotation = face > 0 ? rad : -rad;
    if (key === 'fx_orb') { this.tweens.add({ targets: s, scale: (o.scale || 1) * 1.25, duration: 120, yoyo: true, repeat: -1 }); sh.trail = 0xb79bff; }
    if (this.wfx && (key === 'fx_orb' || key === 'fx_arrow')) { sh.trail = this.wfx; s.setTint(this.wfx); } // arma premium
    this.shots.push(sh);
    return sh;
  }
  updateShots(dt) {
    for (const sh of this.shots) {
      sh.s.x += sh.vx * dt; sh.s.y += sh.vy * dt; sh.life -= dt;
      if (sh.trail && Math.random() < 0.6) {
        const d = this.add.image(sh.s.x - Math.sign(sh.vx) * Phaser.Math.Between(0, 40), sh.s.y + Phaser.Math.Between(-14, 14), 'fx_dot').setTint(sh.trail).setScale(0.6).setDepth(24);
        this.tweens.add({ targets: d, alpha: 0, scale: 0.1, duration: 260, onComplete: () => d.destroy() });
      }
      for (const m of this.monsters) {
        if (m.hp <= 0 || sh.hit.has(m) || m.dodging) continue;
        const my = m.y ?? GROUND_Y;
        if (Math.abs(sh.s.x - m.x) < m.halfW + sh.hitR && sh.s.y > my - m.height - 10 - sh.hitR && sh.s.y < my + 10) {
          sh.hit.add(m);
          if (sh.onHit) sh.onHit(m);
          else if (sh.splash) {
            this.burst(sh.s.x, sh.s.y, 0xb79bff, 10);
            for (const o of this.monsters) if (Math.abs(o.x - sh.s.x) < sh.splash + o.halfW) this.hitMonster(o, this.rollDmg(sh.mult), 14);
          } else this.hitMonster(m, this.rollDmg(sh.mult), sh.knock);
          if (!sh.pierce) { sh.life = 0; break; }
        }
      }
      if (sh.life <= 0) sh.s.destroy();
    }
    this.shots = this.shots.filter(s => s.life > 0);
  }
  // ---------- Habilidade da tecla L (nível 3+)
  skill2() {
    const p = this.p, cls = this.ch.cls, sk = CLASS_SKILLS[cls][1];
    if (p.action === 'special' || p.dash) return;
    if (this.ch.level < sk.lvl) { toast(this, `${sk.name} libera no nível ${sk.lvl}`, '#9fb4d8'); return; }
    if (p.cd2 > 0) return;
    if (p.mp < SKILL2_MP) { toast(this, `MP insuficiente (${SKILL2_MP})`, '#9fb4d8'); return; }
    p.mp -= SKILL2_MP; p.cd2 = 900;
    if (cls !== 'warrior') this.emitAct({ a: 's2', face: p.face });
    this.floatText(p.x, p.y - 230, sk.name, '#ffd36b', 22);
    if (cls === 'warrior') { this.startDash(p.face, 'charge'); Sfx.play('bash', 0.7); return; }
    p.action = 'attack'; p.cancelAt = this.time.now + 9999; this.playAnim('attack', true);
    const face = p.face, cfg = ANIM_CFG[cls].attack;
    this.onFrame('attack', cfg.hit, () => {
      if (cls === 'hunter') {
        Sfx.shoot();
        const sh = this.shoot('fx_arrow', 1350, 0, 2.0, false, 0, { face, dy: -128, dx: 110, scale: 1.5, trail: 0xff9a3c,
          onHit: (m) => { this.explosion(m.x, GROUND_Y - m.height * 0.5); for (const o of this.monsters) if (Math.abs(o.x - m.x) < 150 + o.halfW) this.hitMonster(o, this.rollDmg(2.0), 50); } });
        sh.s.setTint(0xffb060);
      } else {
        Sfx.play('warp_in', 0.7);
        const sh = this.shoot('fx_orb', 820, 0, 1.2, false, 0, { face, dy: -138, dx: 105, scale: 1.5, trail: 0x9fdfff,
          onHit: (m) => {
            const fx = this.add.image(m.x, GROUND_Y - m.height * 0.5, 'fx_ring').setTint(0x9fdfff).setScale(0.2).setDepth(28);
            this.tweens.add({ targets: fx, scale: 1.1, alpha: 0, duration: 380, onComplete: () => fx.destroy() });
            for (const o of this.monsters) if (Math.abs(o.x - m.x) < 110 + o.halfW) { this.hitMonster(o, this.rollDmg(1.2), 10); this.freezeMonster(o, o.boss ? 0.9 : 2); }
          } });
        sh.s.setTint(0x9fdfff);
      }
    });
  }
  // ---------- itens da Loja Premium na batalha
  drinkPotion() {
    const p = this.p;
    if (p.potCd > 0 || p.dead) return;
    if (this.pvp) return toast(this, 'Sem poções na Arena', COL.dim);
    if (this.potUsed >= POTION_LIMIT) return toast(this, `Máximo de ${POTION_LIMIT} poções por fase`, COL.red);
    if (!countItem(this.ch, 'c_potion')) return toast(this, 'Sem Poções de Vida — compre na Loja Premium', '#9fb4d8');
    if (p.hp >= p.maxHp) return toast(this, 'Vida cheia', COL.dim);
    takeItem(this.ch, 'c_potion'); this.potUsed++; p.potCd = 1500; Save.write();
    const heal = Math.round(p.maxHp * 0.4); p.hp = Math.min(p.maxHp, p.hp + heal);
    this.floatText(p.x, p.y - 220, `+${heal}`, '#7dff6a', 30);
    Sfx.play('warp_in', 0.6);
    for (let i = 0; i < 14; i++) {
      const d = this.add.image(p.x + Phaser.Math.Between(-40, 40), p.y - Phaser.Math.Between(0, 160), 'fx_dot').setTint(0x7dff6a).setScale(0.6).setDepth(30).setBlendMode('ADD');
      this.tweens.add({ targets: d, y: d.y - 80, alpha: 0, duration: 600, delay: i * 20, onComplete: () => d.destroy() });
    }
  }
  revive() {
    const p = this.p;
    takeItem(this.ch, 'c_phoenix'); this.revived = true; Save.write();
    p.hp = Math.round(p.maxHp * 0.5); p.inv = 2200; p.kvx = 0;
    if (p.dash) this.endDash();
    p.action = null; p.anim = null;
    this.banner('PENA DA FÊNIX', 'Você renasceu das chamas!', '#ffb347');
    this.explosion(p.x, p.y - 100);
    for (const m of this.monsters) if (Math.abs(m.x - p.x) < 260) { m.x += Math.sign(m.x - p.x || 1) * 160; m.state = m.state === 'dead' ? 'dead' : 'cool'; m.t = 0.8; }
    Sfx.play('levelup', 0.9, 0);
  }
  freezeMonster(m, secs) {
    if (m.hp <= 0 || m.state === 'dead') return;
    m.frozen = secs; this.clearWarn(m);
    if (m.state === 'windup' || m.state === 'strike' || m.state === 'skill') { m.state = 'cool'; m.t = 0.3; m.yOff = 0; m.skillUpd = null; }
    m.spr.anims.pause(); m.spr.setTint(0x9fdfff);
    Sfx.play('warp_out', 0.4);
  }
  arcaneBurst(x, y) {
    const fx = this.add.image(x, y - 100, 'fx_ring').setTint(0xc08cff).setScale(0.2).setDepth(27).setBlendMode('ADD');
    this.tweens.add({ targets: fx, scale: 0.9, alpha: 0, duration: 320, onComplete: () => fx.destroy() });
    for (const m of this.monsters) if (Math.abs(m.x - x) < 120 + m.halfW && Math.abs(y - (m.y ?? GROUND_Y)) < 240) this.hitMonster(m, this.rollDmg(1.0), 40);
  }
  skill() {
    const p = this.p, sk = this.k.skill, cls = this.ch.cls, cfg = ANIM_CFG[cls].special;
    if (p.action === 'special') return;
    if (p.mp < 100) { toast(this, 'MP insuficiente — acerte monstros para carregar', '#9fb4d8'); return; }
    p.mp = 0; p.cd = animDurMs(cls, 'special');
    this.emitAct({ a: 'sp', face: p.face });
    p.action = 'special'; this.playAnim('special', true);
    p.inv = Math.max(p.inv, animDurMs(cls, 'special')); // invencível durante o especial
    this.banner(sk.name, '', '#9fe3ff', 700);
    const face = p.face;
    if (cls === 'warrior') {
      // Golpe Giratório: dois cortes em área durante o giro
      cfg.hits.forEach((f, i) => this.onFrame('special', f, () => {
        Sfx.play('spin', 0.9);
        const ring = this.add.image(p.x, p.y - 100, 'fx_ring').setTint(0xffd36b).setDepth(25).setScale(0.3);
        this.tweens.add({ targets: ring, scale: 1.9, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
        this.cameras.main.shake(180, 0.009);
        for (const m of this.monsters) if (Math.abs(m.x - p.x) < sk.radius + m.halfW && Math.abs((m.y ?? GROUND_Y) - p.y) < 280) this.hitMonster(m, this.rollDmg(sk.mult / 2), i ? 60 : 20);
      }));
    } else if (cls === 'hunter') {
      // Chuva de Flechas: uma flecha perfurante por quadro de disparo
      cfg.shots.forEach((f, i) => this.onFrame('special', f, () => {
        Sfx.shoot(); this.shoot('fx_arrow', 1500, -6 + i * 3, sk.mult, true, 0, { face, dy: -128, dx: 110, life: 1.2 });
      }));
    } else {
      // Bola de Fogo: o mago acende o fogo na mão e lança uma bola de fogo que atravessa a tela
      this.time.delayedCall(animFrameMs(cls, 'special', 2), () => { if (p.action === 'special') Sfx.play('fire_cast', 0.9, 0); });
      this.onFrame('special', cfg.hit, () => this.fireball(face));
    }
  }
  fireball(face) {
    const p = this.p, sk = this.k.skill;
    Sfx.play('swing_heavy', 0.8); Sfx.magic();
    this.cameras.main.shake(220, 0.006);
    const flash = this.add.image(p.x + face * 120, p.y - 128, 'fx_glow').setScale(0.8).setDepth(27);
    this.tweens.add({ targets: flash, alpha: 0, scale: 2.2, duration: 300, onComplete: () => flash.destroy() });
    const sh = this.shoot('fireball', 820, 0, sk.mult, true, 0, {
      face, dx: 150, dy: -128, scale: 1.7, life: 1.9, trail: 0xff9a3c, hitR: 30, knock: 70,
      onHit: (m) => {
        this.hitMonster(m, this.rollDmg(sk.mult), 70);
        this.explosion(m.x, GROUND_Y - m.height * 0.55);
      },
    });
    sh.s.setBlendMode('NORMAL');
    // brasas caindo atrás da bola de fogo
    sh.embers = this.time.addEvent({ delay: 40, loop: true, callback: () => {
      if (!sh.s.active) { sh.embers.remove(); return; }
      const e = this.add.image(sh.s.x - face * Phaser.Math.Between(40, 120), sh.s.y + Phaser.Math.Between(-30, 30), 'fx_dot')
        .setTint(Phaser.Utils.Array.GetRandom([0xffd36b, 0xff7a1a, 0xff4a1a])).setScale(Phaser.Math.FloatBetween(0.3, 0.7)).setDepth(25).setBlendMode('ADD');
      this.tweens.add({ targets: e, y: e.y + Phaser.Math.Between(20, 70), alpha: 0, scale: 0.05, duration: 500, onComplete: () => e.destroy() });
    } });
  }
  explosion(x, y) {
    this.cameras.main.shake(260, 0.012);
    Sfx.play('explosion', 0.9);
    const ring = this.add.image(x, y, 'fx_ring').setTint(0xff8a2a).setDepth(28).setScale(0.2);
    this.tweens.add({ targets: ring, scale: 1.4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    const core = this.add.image(x, y, 'fx_glow').setScale(0.6).setDepth(28);
    this.tweens.add({ targets: core, scale: 2.6, alpha: 0, duration: 340, onComplete: () => core.destroy() });
    this.burst(x, y, 0xff9a3c, 22);
  }

  // ======================================================== DANO
  hitMonster(m, { dmg, crit }, knock, opt = {}) {
    if (m.hp <= 0) return;
    m.hp -= dmg;
    this.p.mp = Math.min(100, this.p.mp + 7);
    if (crit || opt.stagger) Sfx.play('hit_heavy', 0.9); else Sfx.hit();
    this.floatText(m.x, GROUND_Y - m.height - 10, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd23f' : '#ffffff', crit ? 34 : 26);
    m.spr.setTintFill(0xffffff);
    this.time.delayedCall(70, () => { if (m.spr.active) { m.spr.clearTint(); if (m.frozen > 0) m.spr.setTint(0x9fdfff); else if (m.tint) m.spr.setTint(m.tint); } });
    if (m.state === 'enter') { this.tweens.killTweensOf(m.spr); m.spr.setAlpha(1); m.state = 'cool'; m.t = 0.3; }
    const dir = Math.sign(m.x - this.p.x) || 1;
    const armored = m.state === 'windup' || m.state === 'strike';
    m.x += dir * knock * (m.boss ? 0.25 : armored ? 0.35 : 1);
    this.freeze(crit ? 75 : 45);
    if (armored) {
      // o monstro aguenta alguns golpes sem largar o ataque (chefe nunca larga)
      m.poise += opt.stagger ? 3 : 1;
      if (!m.boss && m.poise >= 3) { this.clearWarn(m); m.state = 'cool'; m.t = 0.45; m.yOff = 0; this.monAnim(m, 'idle'); }
    } else if (m.state === 'approach' || m.state === 'recover' || m.state === 'cool') {
      m.stun = m.boss ? 0.05 : 0.2;
      // monstro comum se encolhe com o golpe (animação de dano)
      if (!m.boss && m.hp > 0 && !(m.frozen > 0) && hasAnim(`${m.type}_hurt`)) { m.anim = null; this.monAnim(m, 'hurt'); }
    }
    this.burst(m.x - dir * m.halfW * 0.5, GROUND_Y - m.height * 0.55, 0xffe3a0, crit ? 10 : 5);
    if (m.hp <= 0) this.killMonster(m);
  }
  killMonster(m) {
    Sfx.play('monster_die', m.boss ? 0.9 : 0.6);
    m.state = 'dead'; this.clearWarn(m); m.yOff = 0;
    if (m.bar) m.bar.destroy();
    // animação de morte, depois some aos poucos
    this.tweens.killTweensOf(m);
    m.spr.clearTint(); if (m.tint) m.spr.setTint(m.tint);
    this.monAnim(m, 'death'); m.spr.anims.timeScale = 1;
    m.spr.x = m.x; m.spr.y = GROUND_Y;
    m.spr.setScale(m.baseScale * (this.p.x > m.x ? -1 : 1), m.baseScale);
    this.tweens.add({ targets: [m.spr, m.shadow], alpha: 0, delay: monsterDeathMs(m.type) + 250, duration: 450,
      onComplete: () => { m.spr.destroy(); m.shadow.destroy(); } });
    this.burst(m.x, GROUND_Y - m.height / 2, 0x9b8a6a, 16);
    for (let i = 0; i < (m.boss ? 10 : 4); i++) this.coin(m.x, GROUND_Y - m.height / 2);
    this.monsters = this.monsters.filter(o => o !== m);
    if (this.monsters.length === 0) this.time.delayedCall(450, () => this.segmentCleared());
  }
  hurtPlayer(dmg, srcX) {
    const p = this.p;
    if (this.state !== 'play') return false;
    if (p.dodging) { // esquivou na cambalhota / teleporte
      if (!p.lastDodgeT || this.time.now - p.lastDodgeT > 400) {
        p.lastDodgeT = this.time.now;
        this.floatText(p.x, p.y - 210, 'ESQUIVA!', '#8fe9ff', 24);
        Sfx.tone(1200, 0.06, 'triangle', 0.04);
      }
      return false;
    }
    if (p.inv > 0) return false;
    const taken = Math.max(1, Math.round(dmg * (1 - this.st.def / (this.st.def + 150))));
    p.hp -= taken; p.inv = this.pvp ? 350 : 700; this.stats.dmg += taken;
    Sfx.hurt();
    this.floatText(p.x, p.y - 200, `-${taken}`, '#ff5a5a', 30);
    p.spr.setTint(0xff7070); this.time.delayedCall(160, () => p.spr.clearTint());
    if (srcX !== undefined) p.kvx = Math.sign(p.x - srcX || 1) * 520;
    if (p.action !== 'special' && p.hp > 0) {
      if (p.dash) this.endDash();
      p.action = 'hurt'; p.hurtAt = this.time.now; p.actionToken = (p.actionToken || 0) + 1; this.playAnim('hurt', true);
    }
    this.cameras.main.shake(160, 0.008);
    this.freeze(70);
    if (p.hp <= 0) {
      // Pena da Fênix: revive uma vez por fase
      if (!this.pvp && !this.revived && countItem(this.ch, 'c_phoenix') > 0) { this.revive(); return true; }
      p.hp = 0; this.defeat();
    }
    return true;
  }

  // ======================================================== IA DOS MONSTROS
  // cada monstro: aproxima rápido → avisa (!) → golpe com avanço → recupera
  updateMonsters(dt, delta) {
    const p = this.p, segL = this.seg * SEG;
    const alive = this.monsters.filter(m => m.state !== 'dead' && !m.rival);
    // não deixa os monstros ficarem um em cima do outro
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j], gap = (a.halfW + b.halfW) * 0.7, d = b.x - a.x;
      if (Math.abs(d) < gap && a.state !== 'strike' && b.state !== 'strike') {
        const push = (gap - Math.abs(d)) * 0.5 * Math.min(1, dt * 10), s = Math.sign(d) || 1;
        a.x -= s * push; b.x += s * push;
      }
    }
    for (const m of alive) {
      const ai = m.ai, dx = p.x - m.x, dist = Math.abs(dx), want = Math.sign(dx) || 1;
      m.t -= dt; m.stun -= dt;
      let moving = false;
      if (this.state !== 'play' && m.state !== 'enter') { if (m.state !== 'cool') { m.state = 'cool'; this.clearWarn(m); } m.t = Math.max(m.t, 0.3); }
      if (m.frozen > 0) {
        m.frozen -= dt;
        if (m.frozen <= 0) { m.spr.anims.resume(); m.spr.clearTint(); if (m.tint) m.spr.setTint(m.tint); }
      }
      switch (m.frozen > 0 ? 'frozen' : m.state) {
        case 'enter': if (m.t <= 0) m.state = 'approach'; moving = true; break;
        case 'approach': {
          if (m.stun > 0) break;
          if (m.boss && this.state === 'play') { m.skillT -= dt; if (m.skillT <= 0) { m.skillT = Phaser.Math.FloatBetween(5, 7) * (m.final ? 0.75 : 1); if (this.bossSkill(m)) break; } }
          // vira com um pequeno atraso (passar por trás dele com a cambalhota dá uma brecha)
          if (want !== m.look) { m.turnT += dt; if (m.turnT > ai.turn) { m.look = want; m.turnT = 0; } break; }
          m.turnT = 0;
          const reach = m.halfW + ai.reach;
          if (dist > reach) {
            const sp = m.speed * (dist > reach + 200 ? 1 : 0.75);
            m.x += want * sp * dt; moving = true;
          } else this.monWindup(m);
          break;
        }
        case 'windup':
          if (ai.pounce) m.x -= m.face * 40 * dt; // lobo se agacha recuando
          if (m.t <= 0) this.monStrike(m);
          break;
        case 'strike': {
          const k = m.strikeT / m.strikeDur;
          m.strikeT += dt;
          m.x += m.face * (m.lunge / m.strikeDur) * dt;
          if (ai.pounce || m.hop) m.yOff = -Math.sin(Math.min(1, k) * Math.PI) * (m.hop ? m.hop : 95);
          // janela de acerto do golpe
          if (!m.didHit && m.strikeT <= m.strikeDur + 0.05) {
            const fx = (p.x - m.x) * m.face, h = GROUND_Y - p.y;
            const inX = fx > -40 && fx < m.halfW + ai.hitW;
            const inY = (ai.pounce || m.hop) ? h < 240 : h < 85; // golpes baixos: pular desvia
            if (inX && inY) { m.didHit = true; this.hurtPlayer(m.dmg, m.x); }
          }
          if (m.strikeT >= m.strikeDur) {
            m.yOff = 0;
            m.state = 'recover';
            const left = Math.max(0, monsterAttackMs(m.type) / 1000 / m.fpsMul - m.windDur - m.strikeDur);
            m.t = left + Phaser.Math.FloatBetween(...ai.cd) * (m.boss ? 0.6 : 1);
            if (m.boss && Math.random() < 0.45 && m.combo < 1) { m.combo++; m.t = 0.12; m.state = 'recombo'; }
            else m.combo = 0;
          }
          break;
        }
        case 'recombo': if (m.t <= 0) { m.look = want; this.monWindup(m, 0.7); } break;
        case 'skill':
          if (m.skillUpd) m.skillUpd(dt);
          else if (m.t <= 0) { m.state = 'recover'; m.t = 0.35; m.yOff = 0; this.monAnim(m, 'idle'); }
          break;
        case 'recover':
          if (!m.spr.anims.isPlaying && m.anim === 'attack') this.monAnim(m, 'idle');
          if (m.t <= 0) { m.state = 'approach'; m.look = want; }
          break;
        case 'cool': if (m.t <= 0) m.state = 'approach'; break;
      }
      m.x = Phaser.Math.Clamp(m.x, segL + 60, segL + SEG - 60);
      const flinching = m.anim === 'hurt' && m.spr.anims.isPlaying;
      if (!flinching && !(m.frozen > 0) && (m.state === 'approach' || m.state === 'cool' || m.state === 'enter' || (m.state === 'recover' && m.anim === 'hurt'))) this.monAnim(m, moving ? 'walk' : 'idle');
      if (m.anim === 'walk') m.spr.anims.timeScale = m.fpsMul * Phaser.Math.Clamp(m.speed / m.baseSpeed, 0.8, 1.6);
      const look = (m.state === 'windup' || m.state === 'strike' || m.state === 'recover' || m.state === 'recombo' || m.state === 'skill') ? m.face : m.look;
      if (m.state !== 'enter') { m.spr.x = m.x; m.spr.y = GROUND_Y + (m.yOff || 0); m.spr.angle = ai.pounce && m.state === 'strike' ? -m.face * 8 : 0; }
      m.spr.setScale(m.baseScale * (look > 0 ? -1 : 1), m.baseScale);
      m.shadow.x = m.x; m.shadow.setScale(1 + (m.yOff || 0) / 300);
      if (m.warn) { m.warn.x = m.x; m.warn.y = GROUND_Y - m.height - 40 + (m.yOff || 0); }
      if (m.bar) {
        const w = 90, x = m.x - w / 2, y = GROUND_Y - m.height - 22;
        m.bar.clear().fillStyle(0x000000, 0.7).fillRect(x - 2, y - 2, w + 4, 11).fillStyle(0xd43b3b).fillRect(x, y, w * Math.max(0, m.hp / m.max), 7);
      }
    }
  }
  monWindup(m, speedMul = 1) {
    const ai = m.ai;
    m.state = 'windup'; m.face = m.look; m.poise = 0; m.didHit = false;
    // jogador em cima da plataforma: monstros ágeis pulam para alcançar; os pesados usam o golpe de área
    const ph = GROUND_Y - this.p.y;
    m.hop = (!ai.pounce && !ai.heavy && ph > 90) ? Math.min(230, ph + 60) : 0;
    // tempo até o quadro do golpe (mínimo para dar tempo de reagir)
    const hitS = monsterHitMs(m.type) / 1000 / m.fpsMul;
    m.windDur = Math.max(hitS, ai.minWind * speedMul * (m.boss ? 1.1 : 1));
    m.t = m.windDur;
    this.monAnim(m, 'attack');
    m.spr.anims.timeScale = m.fpsMul * hitS / m.windDur;
    // aviso vermelho
    m.spr.setTint(0xff8a8a);
    this.time.delayedCall(140, () => { if (m.spr.active && m.state !== 'dead') { m.spr.clearTint(); if (m.tint) m.spr.setTint(m.tint); } });
    this.clearWarn(m);
    m.warn = txt(this, m.x, GROUND_Y - m.height - 40, '!', 44, '#ff4040', { origin: 0.5, stroke: 6 }).setDepth(45).setScale(0.6);
    this.tweens.add({ targets: m.warn, scale: 1.15, duration: 140, ease: 'Back.out' });
    Sfx.play(m.boss ? 'boss_roar' : 'warn', m.boss ? 0.55 : 0.5);
  }
  clearWarn(m) { if (m.warn) { m.warn.destroy(); m.warn = null; } }
  monStrike(m) {
    const ai = m.ai;
    this.clearWarn(m);
    m.state = 'strike'; m.strikeT = 0;
    m.spr.anims.timeScale = m.fpsMul;
    m.strikeDur = (ai.pounce || m.hop) ? 0.32 : 0.14;
    if (m.hop) m.lunge = Phaser.Math.Clamp(Math.abs(this.p.x - m.x) - 20, 30, 260);
    if (!m.hop) m.lunge = ai.lunge * (m.boss ? 1.2 : 1);
    Sfx.play(ai.pounce || m.type === 'goblin' ? 'growl' : 'swing_heavy', 0.6);
    if (m.boss || ai.wave) this.cameras.main.shake(130, m.boss ? 0.007 : 0.004);
    if (ai.wave) { this.shockwave(m); if (GROUND_Y - this.p.y > 90) this.hazard(this.p.x, { w: 60, h: 260, delay: 0.45, life: 0.35, dmg: m.dmg * 0.8, color: 0xc08040, fx: (z) => this.rootsFx(z.x) }); }
    if (ai.spores) this.spores(m);
  }
  // Raiz Viva: onda de terra pelo chão — pule por cima!
  shockwave(m) {
    Sfx.play('slam', 0.8);
    const x = m.x + m.face * (m.halfW + 20);
    const s = this.add.image(x, GROUND_Y - 6, 'fx_ring').setTint(0xa07a3a).setScale(0.28, 0.12).setDepth(16);
    this.eShots.push({ s, vx: m.face * 560, life: 1.1, dmg: m.dmg * 0.8, h: 70, w: 45, kind: 'wave' });
  }
  // Cogumelo: nuvem de esporos que fica um tempinho no lugar
  spores(m) {
    Sfx.play('spores', 0.7);
    const x = m.x + m.face * (m.halfW + 50);
    const s = this.add.image(x, GROUND_Y - 70, 'fx_glow').setTint(0x9bd34a).setScale(0.2).setAlpha(0.75).setDepth(24);
    this.tweens.add({ targets: s, scale: 1.0, duration: 260, ease: 'Quad.out' });
    this.eShots.push({ s, vx: m.face * 40, life: 1.3, dmg: m.dmg * 0.5, h: 215, w: 60, kind: 'cloud' });
  }
  updateEnemyShots(dt) {
    const p = this.p;
    for (const e of this.eShots) {
      e.life -= dt; e.s.x += e.vx * dt;
      if (e.kind === 'wave' && Math.random() < 0.7) this.dust(e.s.x, 1);
      if (e.kind === 'cloud') e.s.setAlpha(Math.min(0.75, e.life));
      const ph = GROUND_Y - p.y;
      const inY = e.band !== undefined ? (e.band >= ph - 10 && e.band <= ph + 150) : ph < e.h;
      if (!e.done && Math.abs(p.x - e.s.x) < e.w + 30 && inY) {
        if (this.hurtPlayer(e.dmg, e.s.x - e.vx)) e.done = true;
      }
      if (e.life <= 0) e.s.destroy();
    }
    this.eShots = this.eShots.filter(e => e.life > 0);
  }

  // ======================================================== PLATAFORMAS
  buildPlatforms() {
    this.plats = [];
    const PY = GROUND_Y - 165;
    const layouts = [
      [{ x: 640, w: 300 }],
      [{ x: 520, w: 280 }, { x: 1300, w: 300 }],
      [{ x: 950, w: 340 }],
    ];
    this.segments.forEach((sg, i) => {
      const lay = sg.boss ? [{ x: 430, w: 280 }, { x: 1620, w: 280 }] : layouts[(this.phase + i) % layouts.length];
      for (const l of lay) {
        const pl = { x: i * SEG + l.x, y: PY, w: l.w };
        const key = this.area.plat;
        if (key && this.textures.exists(key)) {
          const im = this.add.image(pl.x, PY, key).setDepth(8);
          const k = (l.w + 30) / im.width; im.setScale(k).setOrigin(0.5, PLAT_TOP[key] || 0.18);
        } else {
          const g = this.add.graphics().setDepth(8);
          g.fillStyle(0x3b2f22).fillRoundedRect(pl.x - l.w / 2, PY, l.w, 30, 8).fillStyle(0x4f7a2e).fillRoundedRect(pl.x - l.w / 2 - 4, PY - 4, l.w + 8, 12, 6);
        }
        this.add.ellipse(pl.x, GROUND_Y, l.w * 0.9, 18, 0x000000, 0.25).setDepth(7);
        this.plats.push(pl);
      }
    });
  }
  floorBelow(x, y) {
    let f = GROUND_Y;
    for (const pl of this.plats) if (Math.abs(x - pl.x) < pl.w / 2 && y <= pl.y + 2 && pl.y < f) f = pl.y;
    return f;
  }

  // ======================================================== PERIGOS (zonas avisadas no chão)
  // zona: aviso vermelho no chão → depois de "delay" s machuca quem estiver dentro (até a altura h)
  hazard(x, o) {
    const z = { x, w: o.w || 70, h: o.h || 200, delay: o.delay ?? 0.7, life: o.life ?? 0.35, dmg: o.dmg, done: false, on: false, fx: o.fx };
    z.tele = this.add.ellipse(x, GROUND_Y - 2, z.w * 2, 22, o.color || 0xff3030, 0.35).setDepth(9).setStrokeStyle(3, o.color || 0xff3030, 0.9);
    this.tweens.add({ targets: z.tele, alpha: 0.85, duration: 140, yoyo: true, repeat: -1 });
    this.hz.push(z);
    return z;
  }
  updateHazards(dt) {
    const p = this.p;
    for (const z of this.hz) {
      if (!z.on) {
        z.delay -= dt;
        if (z.delay <= 0) { z.on = true; this.tweens.killTweensOf(z.tele); z.tele.destroy(); if (z.fx) z.fx(z); }
        continue;
      }
      z.life -= dt;
      if (!z.done && Math.abs(p.x - z.x) < z.w + 25 && GROUND_Y - p.y < z.h && this.hurtPlayer(z.dmg, z.x)) z.done = true;
    }
    this.hz = this.hz.filter(z => z.on ? z.life > 0 : true);
  }
  clearHazards() { for (const z of this.hz) if (z.tele && z.tele.active) z.tele.destroy(); this.hz = []; }

  // ======================================================== GOLPES DOS CHEFES
  bossSkill(m) {
    const list = BOSS_SKILLS[m.type] || [];
    if (!list.length) return false;
    const adds = this.monsters.filter(o => o.add && o.state !== 'dead').length;
    let opts = list.filter(k => k !== 'summon' || adds < 2);
    if (!opts.length) return false;
    const k = Phaser.Utils.Array.GetRandom(opts);
    m.state = 'skill'; m.skill = k; m.skillUpd = null; m.face = m.look;
    this.clearWarn(m);
    m.spr.setTint(0xffa0ff); this.time.delayedCall(180, () => { if (m.spr.active && m.state !== 'dead') { m.spr.clearTint(); if (m.tint) m.spr.setTint(m.tint); } });
    this.floatText(m.x, GROUND_Y - m.height - 50, SKILL_NAMES[k], '#ffb0ff', 26);
    const p = this.p, dmg = m.dmg;
    const alive = () => m.state !== 'dead' && this.state === 'play';
    if (k === 'bombs') {
      this.monAnim(m, 'attack'); m.t = 1.3; Sfx.play('swing_heavy', 0.7);
      [-170, 0, 170].forEach((off, i) => this.time.delayedCall(220 + i * 160, () => {
        if (!alive()) return;
        const tx = Phaser.Math.Clamp(p.x + off, this.seg * SEG + 60, this.seg * SEG + SEG - 60);
        const z = this.hazard(tx, { w: 85, h: 150, delay: 0.75, dmg: dmg * 0.9, fx: (zz) => this.explosion(zz.x, GROUND_Y - 40) });
        // bomba voando até o alvo
        const b = this.add.circle(m.x, GROUND_Y - m.height * 0.7, 12, 0x222222).setStrokeStyle(3, 0xffa040).setDepth(26);
        this.tweens.add({ targets: b, x: tx, duration: 750, ease: 'Linear' });
        this.tweens.add({ targets: b, y: GROUND_Y - m.height - 160, duration: 375, ease: 'Quad.out', yoyo: true, onComplete: () => b.destroy() });
      }));
    } else if (k === 'summon') {
      this.monAnim(m, 'attack'); m.t = 1.0; Sfx.play('boss_roar', 0.8, 0);
      this.cameras.main.shake(300, 0.006);
      const n = m.type === 'slime' ? 2 : 1;
      for (let i = 0; i < n; i++) this.time.delayedCall(350 + i * 200, () => {
        if (!alive()) return;
        const x = Phaser.Math.Clamp(m.x + (i ? -1 : 1) * 160, this.seg * SEG + 80, this.seg * SEG + SEG - 80);
        this.spawnMonster(m.kind || m.type, x, null, { add: true });
        this.burst(x, GROUND_Y - 60, 0xb07aff, 14);
      });
    } else if (k === 'charge') {
      // agacha e avisa, depois atravessa a arena correndo — pule por cima ou role
      this.monAnim(m, 'idle'); m.t = 3; Sfx.play('growl', 0.8);
      const dir = m.look, segL = this.seg * SEG, endX = dir > 0 ? segL + SEG - 120 : segL + 120;
      const line = this.add.rectangle((m.x + endX) / 2, GROUND_Y - 30, Math.abs(endX - m.x), 50, 0xff3030, 0.22).setDepth(9);
      this.tweens.add({ targets: line, alpha: 0.5, duration: 120, yoyo: true, repeat: 3, onComplete: () => line.destroy() });
      let tt = 0, hit = false;
      m.skillUpd = (dt) => {
        tt += dt;
        if (tt < 0.65) { m.x -= dir * 30 * dt; return; }
        if (m.anim !== 'walk') { this.monAnim(m, 'walk'); m.spr.anims.timeScale = 2.2; Sfx.play('dash', 0.8); }
        m.x += dir * 1150 * dt;
        if (Math.random() < 0.5) this.dust(m.x - dir * m.halfW, 1);
        if (!hit && Math.abs(p.x - m.x) < m.halfW + 30 && GROUND_Y - p.y < m.height * 0.7) { hit = true; this.hurtPlayer(dmg * 1.2, m.x - dir * 50); }
        if ((dir > 0 && m.x >= endX) || (dir < 0 && m.x <= endX)) { m.t = 0.5; m.skillUpd = null; this.monAnim(m, 'idle'); this.cameras.main.shake(120, 0.005); }
      };
    } else if (k === 'rain') {
      this.monAnim(m, 'attack'); m.t = 1.4; Sfx.play('spores', 0.9);
      const offs = Phaser.Utils.Array.Shuffle([-260, -130, 0, 130, 260]);
      offs.forEach((off, i) => {
        const tx = Phaser.Math.Clamp(p.x + off, this.seg * SEG + 60, this.seg * SEG + SEG - 60);
        this.hazard(tx, { w: 60, h: 230, delay: 0.7 + i * 0.12, life: 0.5, dmg: dmg * 0.7, color: 0x9bd34a, fx: (z) => {
          const c = this.add.image(z.x, GROUND_Y - 90, 'fx_glow').setTint(0x9bd34a).setScale(0.3, 1).setAlpha(0.8).setDepth(24);
          this.tweens.add({ targets: c, scaleX: 0.9, scaleY: 1.6, alpha: 0, duration: 520, onComplete: () => c.destroy() });
          Sfx.play('spores', 0.4);
        } });
      });
    } else if (k === 'roots') {
      this.monAnim(m, 'attack'); m.t = 1.7; Sfx.play('slam', 0.7);
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 420, () => {
        if (!alive()) return;
        this.hazard(p.x, { w: 70, h: 260, delay: 0.55, life: 0.4, dmg: dmg, color: 0xc08040, fx: (z) => this.rootsFx(z.x) });
      });
    } else if (k === 'leap') {
      // salto gigante até onde o jogador está; ao cair, onda para os dois lados
      this.monAnim(m, 'attack'); m.t = 3; Sfx.play('growl', 0.8);
      const x0 = m.x, tx = Phaser.Math.Clamp(p.x, this.seg * SEG + 100, this.seg * SEG + SEG - 100);
      const z = this.hazard(tx, { w: 120, h: 160, delay: 0.85, life: 0.15, dmg: dmg * 1.1 });
      let tt = 0;
      m.skillUpd = (dt) => {
        tt += dt; const k2 = Math.min(1, tt / 0.85);
        m.x = x0 + (tx - x0) * k2; m.yOff = -Math.sin(k2 * Math.PI) * 300;
        if (k2 >= 1) {
          m.yOff = 0; m.skillUpd = null; m.t = 0.6;
          this.cameras.main.shake(260, 0.012); Sfx.play('slam', 0.9);
          for (const d of [-1, 1]) {
            const s = this.add.image(m.x + d * 60, GROUND_Y - 6, 'fx_ring').setTint(0x7fbf3a).setScale(0.28, 0.12).setDepth(16);
            this.eShots.push({ s, vx: d * 560, life: 1.0, dmg: dmg * 0.7, h: 70, w: 45, kind: 'wave' });
          }
          this.dust(m.x, 12);
        }
      };
    } else if (k === 'spears') {
      // três lanças: baixa (pule) / alta (fique no chão ou role) / baixa
      this.monAnim(m, 'attack'); m.t = 1.6;
      ['low', 'high', 'low'].forEach((h, i) => this.time.delayedCall(250 + i * 380, () => {
        if (!alive()) return;
        Sfx.play('arrow', 0.8);
        const y = h === 'low' ? GROUND_Y - 45 : GROUND_Y - 165;
        const s = this.add.rectangle(m.x + m.face * 60, y, 110, 8, 0xc9b48a).setDepth(26).setStrokeStyle(2, 0x5a4020);
        this.eShots.push({ s, vx: m.face * 820, life: 2.2, dmg: dmg * 0.8, band: GROUND_Y - y, w: 55, kind: 'spear' });
      }));
    }
    return true;
  }
  rootsFx(x) {
    Sfx.play('slam', 0.6); this.cameras.main.shake(140, 0.006);
    const g = this.add.graphics().setDepth(17);
    for (let i = 0; i < 5; i++) {
      const bx = x + (i - 2) * 26, h = 120 + Math.random() * 120;
      g.fillStyle(i % 2 ? 0x5a3a1a : 0x7a5228).fillTriangle(bx - 14, GROUND_Y, bx + 14, GROUND_Y, bx + Phaser.Math.Between(-8, 8), GROUND_Y - h);
    }
    g.setScale(1, 0.1); g.y = GROUND_Y * 0.9;
    this.tweens.add({ targets: g, scaleY: 1, y: 0, duration: 120, ease: 'Back.out', hold: 260, yoyo: true, onComplete: () => g.destroy() });
    this.dust(x, 8);
  }

  // ======================================================== FLUXO DA FASE
  segmentCleared() {
    if (this.state !== 'play') return;
    if (this.seg === this.segments.length - 1) return this.victory();
    this.goArrow.setVisible(true); this.goTxt.setVisible(true);
    this.tweens.add({ targets: this.goTxt, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    Sfx.play('levelup', 0.5, 0);
  }
  nextSegment() {
    this.state = 'transition';
    this.goArrow.setVisible(false); this.goTxt.setVisible(false); this.tweens.killTweensOf(this.goTxt);
    const nx = (this.seg + 1) * SEG, cam = this.cameras.main;
    cam.setBounds(this.seg * SEG, 0, SEG * 2, H); // libera a câmera para o próximo trecho durante a travessia
    this.p.face = 1;
    this.tweens.add({
      targets: this.p, x: nx + 220, duration: 1000, ease: 'Sine.inOut',
      onComplete: () => {
        this.p.vx = 0; this.seg++; this.state = 'play';
        cam.setBounds(nx, 0, SEG, H);
        this.spawnSegment(this.seg);
      },
    });
  }
  victory() {
    this.state = 'ended';
    Music.stop(500);
    this.clearHazards();
    const c = this.ch, first = this.phase > (c.progress[this.areaId] || 0);
    const rw = phaseRewards(this.phase, this.areaId);
    // estrelas: vencer + pouco dano + rápido
    const secs = Math.round((this.time.now - this.stats.t0 - this.stats.paused) / 1000), par = parTime(this.phase, this.areaId);
    const lowDmg = this.stats.dmg <= this.p.maxHp * 0.3, fast = secs <= par;
    const stars = 1 + (lowDmg ? 1 : 0) + (fast ? 1 : 0);
    c.stars = c.stars || {}; c.stars[this.areaId] = c.stars[this.areaId] || {};
    const best = c.stars[this.areaId][this.phase] || 0, newBest = stars > best;
    if (newBest) c.stars[this.areaId][this.phase] = stars;
    const gold = rw.gold + (stars === 3 ? Math.round(rw.gold * 0.5) : 0);
    const lvlBefore = c.level;
    const xpBuff = c.buffs && c.buffs.xp2 > 0;
    if (xpBuff) c.buffs.xp2--;
    const xpGain = rw.xp * (xpBuff ? 2 : 1);
    const ups = addXp(c, xpGain);
    // diamantes por jogar: estrelas novas, área conquistada, nível novo (cada um só uma vez)
    const gemJobs = [];
    for (let s2 = best + 1; s2 <= stars; s2++) gemJobs.push(Wallet.earn('star', `${this.areaId}-${this.phase}-${s2}`));
    if (PHASES[this.areaId][this.phase - 1].boss.final && first) gemJobs.push(Wallet.earn('area', this.areaId));
    for (let lv = lvlBefore + 1; lv <= c.level; lv++) gemJobs.push(Wallet.earn('level', lv));
    const gemsP = Promise.all(gemJobs).then(a => a.reduce((n, v) => n + (v || 0), 0));
    c.gold += gold;
    if (first) c.progress[this.areaId] = this.phase;
    // drops (raridade melhora com 3 estrelas e no chefe final)
    const drops = [];
    const isFinal = PHASES[this.areaId][this.phase - 1].boss.final;
    if (Math.random() < (isFinal && first ? 1 : 0.3 + (stars === 3 ? 0.15 : 0))) {
      const pool = Object.keys(ITEMS).filter(id => this.areaId === 'forest' ? ITEMS[id].drop === true : ITEMS[id].drop === this.areaId);
      const own = pool.filter(id => ITEMS[id].type === this.k.gearType);
      const id = isFinal && first && own.length ? Phaser.Utils.Array.GetRandom(own) : Phaser.Utils.Array.GetRandom(pool);
      drops.push([id, ITEMS[id].slot === 'pergaminho' ? 'comum' : rollRarity((stars === 3 ? 0.05 : 0) + (isFinal ? 0.08 : 0))]);
    }
    if (Math.random() < 0.35) drops.push(['s_enchant', 'comum']);
    const got = [];
    for (const [id, r] of drops) if (c.bag.length < bagCap(c)) { const it = Save.makeItem(id, r); c.bag.push(it); got.push(it); }
    Save.write();
    Sfx.win();
    if (ups) this.time.delayedCall(900, () => Sfx.play('levelup', 0.8, 0));

    this.time.delayedCall(700, () => {
      const L = (o) => this.hud(o);
      L(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6));
      L(panel(this, W / 2 - 340, 70, 680, 560, 0.95));
      L(txt(this, W / 2, 110, 'FASE CONCLUÍDA!', 44, COL.goldTxt, { origin: 0.5, title: true }));
      L(txt(this, W / 2, 156, `${this.area.name} • Fase ${this.phase}`, 20, COL.dim, { origin: 0.5 }));
      // estrelas aparecendo uma a uma
      for (let k = 0; k < 3; k++) {
        const on = k < stars, st = L(uiImg(this, W / 2 + (k - 1) * 78, 214, on ? 'star' : 'star_dark', 62)).setScale(0);
        const sc = 62 / Math.max(st.width, st.height);
        this.tweens.add({ targets: st, scale: sc, duration: 260, delay: 250 + k * 260, ease: 'Back.out', onStart: () => { if (on) Sfx.play('coin', 0.6, 0); } });
      }
      const ok = (b) => b ? '#7dff6a' : '#8a8270';
      L(txt(this, W / 2 - 170, 262, `✔ Vitória`, 17, '#7dff6a', { origin: 0.5 }));
      L(txt(this, W / 2, 262, `${lowDmg ? '✔' : '✖'} Pouco dano`, 17, ok(lowDmg), { origin: 0.5 }));
      L(txt(this, W / 2 + 170, 262, `${fast ? '✔' : '✖'} Rápido (${secs}s / ${par}s)`, 17, ok(fast), { origin: 0.5 }));
      if (newBest && best) L(txt(this, W / 2, 290, 'Novo recorde de estrelas!', 16, COL.goldTxt, { origin: 0.5 }));
      let y = 324;
      L(txt(this, W / 2, y, `+${xpGain} EXP${xpBuff ? ' (x2)' : ''}      +${gold} 🪙${stars === 3 ? '  (bônus ★★★)' : ''}`, 28, COL.text, { origin: 0.5 }));
      const gT = L(txt(this, W / 2 + 290, y, '', 24, '#9fe3ff', { origin: [0, 0.5] }));
      gemsP.then(g => { if (g > 0 && gT.active) { gT.setText(`+${g} 💎`); Sfx.coin(); } });
      y += 46;
      if (ups) { L(txt(this, W / 2, y, `⬆ SUBIU DE NÍVEL!  ${lvlBefore} → ${c.level}`, 26, '#7dff6a', { origin: 0.5, title: true })); y += 42; }
      const need = xpToNext(c.level);
      const xb = L(bar(this, W / 2 - 200, y, 400, 16, 0x4fa3ff)); xb.set(c.xp / need);
      L(txt(this, W / 2, y + 30, `Nível ${c.level} • EXP ${c.xp}/${need}`, 17, COL.dim, { origin: 0.5 })); y += 64;
      if (!got.length) L(txt(this, W / 2, y, 'Nenhum item desta vez', 19, COL.dim, { origin: 0.5 }));
      else got.forEach((it, k) => {
        const tag = it.rarity ? ` (${RARITY[it.rarity].name})` : '';
        L(txt(this, W / 2, y + k * 28, `Item: ${ITEMS[it.id].name}${tag}`, 19, itemColor(it), { origin: 0.5 }));
      });
      const next = this.phase < 10;
      const goNext = () => fadeTo(this, 'Battle', { area: this.areaId, phase: this.phase + 1 });
      const pcKeys = !(this.sys.game.device.input.touch || location.search.includes('touch'));
      if (next) L(button(this, W / 2 + 150, 580, 260, 60, pcKeys ? 'PRÓXIMA FASE (J)' : 'PRÓXIMA FASE ▶', goNext, { size: pcKeys ? 20 : 22, title: true, color: 0x3a4a22 }));
      // atalho: a tecla de ataque (J / Z) ou Enter aperta o botão principal (próxima fase, ou mapa na última)
      this.keyShortcut(next ? goNext : () => fadeTo(this, 'Map', { area: this.areaId }));
      L(button(this, next ? W / 2 - 150 : W / 2, 580, 260, 60, !next && pcKeys ? 'MAPA (J)' : 'MAPA', () => fadeTo(this, 'Map', { area: this.areaId }), { size: 22, title: true }));
      if (isFinal && first) L(txt(this, W / 2, 530, `Você conquistou: ${this.area.name}!`, 22, '#7dff6a', { origin: 0.5 }));
    });
  }
  defeat() {
    this.state = 'ended';
    this.clearHazards();
    this.time.delayedCall(250, () => Sfx.lose());
    const p = this.p;
    p.dead = true; Music.stop(400);
    if (p.dash) { const d = p.dash; if (d.shield) d.shield.destroy(); p.dash = null; }
    this.tweens.killTweensOf(p.spr);
    const dk = `${this.animBase}_death`;
    p.spr.setAlpha(1).setAngle(0);
    if (hasAnim(dk)) { // cai de verdade (SpriteCook)
      const mt = ANIM_META[dk];
      p.spr.setOrigin(mt.ox, mt.oy); p.baseScale = mt.scale; p.spr.play(dk);
      p.spr.y = GROUND_Y; p.y = GROUND_Y;
      p.spr.setScale(mt.scale * p.face, mt.scale);
    } else {
      p.spr.anims.pause();
      this.tweens.add({ targets: p.spr, angle: -85 * p.face, y: p.y + 10, alpha: 0.6, duration: 500 });
    }
    this.time.delayedCall(800, () => {
      const L = (o) => this.hud(o);
      L(this.add.rectangle(W / 2, H / 2, W, H, 0x200000, 0.6));
      L(panel(this, W / 2 - 300, 180, 600, 330, 0.95));
      L(txt(this, W / 2, 240, 'VOCÊ FOI DERROTADO', 40, COL.red, { origin: 0.5, title: true }));
      L(txt(this, W / 2, 310, 'Dica: use o dash (Espaço) para esquivar dos golpes\ne melhore seus equipamentos na Loja.', 20, COL.dim, { origin: 0.5, align: 'center' }));
      const retry = () => fadeTo(this, 'Battle', { area: this.areaId, phase: this.phase });
      L(button(this, W / 2 + 140, 430, 240, 62, 'TENTAR DE NOVO', retry, { size: 20, title: true, color: 0x5a3a12 }));
      this.keyShortcut(retry);
      L(button(this, W / 2 - 140, 430, 240, 62, 'MAPA', () => fadeTo(this, 'Map', { area: this.areaId }), { size: 20, title: true }));
    });
  }
  togglePause() {
    if (this.state === 'ended') return;
    this.paused = !this.paused;
    Music.duck(this.paused);
    if (this.paused) this.pauseAt = this.time.now; else this.stats.paused += this.time.now - (this.pauseAt || this.time.now);
    if (this.paused) {
      this.tweens.pauseAll();
      const L = (o) => { this.hud(o); this.pauseUi.push(o); return o; };
      this.pauseUi = [];
      L(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6));
      L(panel(this, W / 2 - 220, 170, 440, 380, 0.95));
      L(txt(this, W / 2, 220, 'Pausado', 38, COL.goldTxt, { origin: 0.5, title: true }));
      L(button(this, W / 2, 300, 300, 60, 'Continuar', () => this.togglePause(), { size: 22 }));
      const lbl = () => [`Música: ${Settings.data.music ? 'Sim' : 'Não'}`, `Efeitos: ${Settings.data.sfx ? 'Sim' : 'Não'}`];
      const bm = L(button(this, W / 2 - 77, 375, 146, 56, lbl()[0], () => { Music.toggle(); bm.label.setText(lbl()[0]); }, { size: 17 }));
      const bs = L(button(this, W / 2 + 77, 375, 146, 56, lbl()[1], () => { Sfx.toggle(); bs.label.setText(lbl()[1]); }, { size: 17 }));
      L(button(this, W / 2, 455, 300, 60, this.exitLabel || 'Sair da fase', () => { if (this.exitTo) return this.exitTo(); this.paused = false; this.tweens.resumeAll(); fadeTo(this, 'Map', { area: this.areaId }); }, { size: 22 }));
    } else {
      this.tweens.resumeAll();
      (this.pauseUi || []).forEach(o => o.destroy());
    }
  }

  // tecla de ataque (J / Z) ou Enter ativa o botão principal da tela de fim de fase.
  // Só vale depois de um instante, para quem ainda estava apertando J não pular a tela sem querer.
  keyShortcut(fn) {
    const kb = this.input.keyboard; if (!kb) return;
    const at = this.time.now + 700;
    let used = false;
    const h = (e) => {
      if (used || this.time.now < at || e.repeat) return;
      if (e.code === 'KeyJ' || e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'NumpadEnter') { used = true; Sfx.click(); fn(); }
    };
    kb.on('keydown', h);
    this.events.once('shutdown', () => kb.off('keydown', h));
  }

  // ======================================================== EFEITOS
  banner(title, sub = '', color = COL.goldTxt, hold = 1300) {
    const t = this.hud(txt(this, W / 2, 250, title, 46, color, { origin: 0.5, title: true, stroke: 7 }));
    const s = sub ? this.hud(txt(this, W / 2, 305, sub, 22, COL.text, { origin: 0.5 })) : null;
    [t, s].filter(Boolean).forEach(o => { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 200, hold, yoyo: true, onComplete: () => o.destroy() }); });
  }
  floatText(x, y, str, color, size) {
    const t = txt(this, x + Phaser.Math.Between(-15, 15), y, str, size, color, { origin: 0.5 }).setDepth(60);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 750, ease: 'Quad.out', onComplete: () => t.destroy() });
  }
  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const d = this.add.image(x, y, 'fx_dot').setTint(color).setScale(Phaser.Math.FloatBetween(0.3, 0.8)).setDepth(40);
      const a = Math.random() * Math.PI * 2, r = Phaser.Math.Between(25, 80);
      this.tweens.add({ targets: d, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0, scale: 0.1, duration: 380, onComplete: () => d.destroy() });
    }
  }
  coin(x, y) {
    const c = this.add.circle(x, y, 7, 0xf5c542).setStrokeStyle(2, 0x8a6a10).setDepth(41);
    const tx = x + Phaser.Math.Between(-90, 90);
    this.tweens.add({ targets: c, x: tx, duration: 500 });
    this.tweens.add({ targets: c, y: y - Phaser.Math.Between(40, 100), duration: 250, ease: 'Quad.out', yoyo: true,
      onComplete: () => this.tweens.add({ targets: c, x: this.p.x, y: this.p.y - 100, alpha: 0, duration: 350, delay: 200, onComplete: () => { c.destroy(); Sfx.coin(); } }) });
  }
}
