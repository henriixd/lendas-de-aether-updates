// ============================================================
//  ARENA — PvP 1 contra 1
//  • Arena (ranqueada): luta contra a cópia controlada pela IA de outro herói,
//    vale pontos e liga. Por enquanto os adversários são gerados no aparelho
//    (Etapa 2: adversários reais vindos do servidor).
//  • Duelo com amigo: sala com código, os dois jogando ao vivo (net.js).
// ============================================================
const PVP_HP = 4;          // vida multiplicada na arena (a luta dura mais que um combo)
const PVP_DMG = 0.6;       // dano multiplicado na arena
const ARENA_TIME = 90;     // segundos por luta
const ARENA_DAILY = 5;     // lutas valendo pontos por dia
const ARENA_START = 1000;  // pontos iniciais
const ARENA_LVL = 6;       // nível mínimo
const LEAGUES = [
  { id: 'bronze', name: 'Bronze', min: 0, color: '#d39552', tint: 0xd39552 },
  { id: 'prata', name: 'Prata', min: 1150, color: '#d4dbe6', tint: 0xd4dbe6 },
  { id: 'ouro', name: 'Ouro', min: 1300, color: '#f2c766', tint: 0xf2c766 },
  { id: 'diamante', name: 'Diamante', min: 1500, color: '#8fe3ff', tint: 0x8fe3ff },
  { id: 'lenda', name: 'Lenda', min: 1750, color: '#ff8af0', tint: 0xff8af0 },
];
function leagueOf(pts) { let l = LEAGUES[0]; for (const x of LEAGUES) if (pts >= x.min) l = x; return l; }
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function arenaData(c) {
  if (!c.arena) c.arena = { pts: ARENA_START, best: ARENA_START, w: 0, l: 0, day: '', fights: 0, opps: null, streak: 0 };
  const a = c.arena;
  if (a.day !== todayKey()) { a.day = todayKey(); a.fights = 0; a.opps = null; }
  return a;
}
// recompensa da luta ranqueada
function arenaReward(me, opp, win) {
  const diff = opp - me;
  return win ? Phaser.Math.Clamp(Math.round(22 + diff / 18), 10, 38) : -Phaser.Math.Clamp(Math.round(15 - diff / 25), 6, 22);
}

// ---------- adversários gerados (Etapa 1)
const BOT_NAMES = ['Kael', 'Lyra', 'Thorin', 'Selene', 'Ragnar', 'Aria', 'Dante', 'Nyx', 'Bruna', 'Iago', 'Mirela', 'Caio', 'Yara',
  'Vesper', 'Elora', 'Gael', 'Luna', 'Ravena', 'Tobias', 'Isis', 'Bento', 'Kira', 'Otto', 'Maya', 'Draven', 'Lia', 'Hugo', 'Zara', 'Ícaro', 'Nara'];
function makeBot(c, a, slot) {
  const level = Phaser.Math.Clamp(c.level + Phaser.Math.Between(-2, 1) + (slot - 1), ARENA_LVL, MAX_LEVEL);
  const cls = Phaser.Utils.Array.GetRandom(['warrior', 'hunter', 'mage']);
  const gender = Math.random() < 0.5 ? 'm' : 'f';
  const type = CLASSES[cls].gearType;
  const best = (slot0, t) => {
    const list = Object.entries(ITEMS).filter(([, d]) => d.slot === slot0 && (t === 'any' ? d.type === 'any' : d.type === t) && !d.premium && (d.lvl || 1) <= level);
    list.sort((x, y) => (y[1].lvl || 1) - (x[1].lvl || 1));
    const pick = list[Math.min(list.length - 1, Phaser.Math.Between(0, 2))];
    return pick ? pick[0] : null;
  };
  const mk = (id, plusMax) => id ? { id, rarity: rollRarity(level / 120), plus: Phaser.Math.Between(0, plusMax) } : null;
  const equip = { arma: mk(best('arma', type), 2 + slot), armadura: mk(best('armadura', type), 2 + slot), joia: Math.random() < 0.75 ? mk(best('joia', 'any'), 2) : null };
  // às vezes o adversário tem o visual premium (para mostrar a Loja)
  if (level >= 8 && Math.random() < 0.18) equip.armadura = { id: PREMIUM_ARMOR[cls], rarity: 'epico', plus: 3 };
  if (level >= 8 && Math.random() < 0.15) equip.arma = { id: PREMIUM_WEAPON[cls], rarity: 'epico', plus: 3 };
  const pts = Math.max(0, a.pts + [-70, 0, 90][slot] + Phaser.Math.Between(-30, 30));
  const name = Phaser.Utils.Array.GetRandom(BOT_NAMES) + (Math.random() < 0.35 ? Phaser.Math.Between(2, 99) : '');
  return { name, cls, gender, level, equip, pts, bot: true, ss: level >= 8 && Math.random() < 0.5 };
}
function botSkill(o) { return Phaser.Math.Clamp(0.25 + (o.pts - ARENA_START) / 900, 0.2, 0.92); }
// o que o outro aparelho precisa saber do meu herói
function fighterInfo(c) {
  const e = {};
  for (const k of ['arma', 'armadura', 'joia']) { const it = c.equip[k]; e[k] = it ? { id: it.id, rarity: it.rarity || 'comum', plus: it.plus || 0 } : null; }
  return { name: c.name, cls: c.cls, gender: c.gender, level: c.level, equip: e, st: charStats(c), pts: arenaData(c).pts };
}

// ============================================================
//  RIVAL — o outro lutador (IA na Arena, ou o amigo no duelo)
//  Também entra na lista this.monsters para que todos os golpes
//  do jogador já existentes acertem nele.
// ============================================================
const RIVAL_RANGE = { warrior: [0, 120], hunter: [360, 680], mage: [320, 600] };
class Rival {
  constructor(scene, info, x, mode) {
    const s = this.s = scene;
    this.c = info; this.mode = mode; this.cls = info.cls; this.k = CLASSES[info.cls];
    this.st = info.st || charStats(info);
    this.rival = true; this.name = info.name; this.kind = 'rival'; this.state = 'fight';
    this.hp = this.max = this.maxHp = Math.round(this.st.hp * PVP_HP);
    this.x = x; this.y = GROUND_Y; this.vx = 0; this.vy = 0; this.kvx = 0; this.face = x > SEG / 2 ? -1 : 1;
    this.ground = true; this.plat = null; this.mp = 0; this.inv = 0; this.dodging = false; this.frozen = 0;
    this.action = null; this.anim = null; this.dash = null; this.cd = 0; this.cd2 = 0; this.cd3 = 0; this.dashCd = 0; this.airDash = 1;
    this.guard = null; this.slowT = 0; this.slowMul = 1;
    this.combo = 0; this.lastAtk = 0; this.token = 0; this.cancelAt = 0; this.hurtAt = 0; this.dead = false;
    this.height = 205; this.halfW = 52; this.sx = 1;
    this.in = { dir: 0, jump: false, drop: false };
    this.skill = info.skill ?? 0.5; this.think = 0; this.dangerT = 0; this.dodgeCd = 0; this.jumpCd = 0; this.mood = 0; this.moodT = 0;
    this.base = animBaseFor(info);
    this.shadow = s.add.ellipse(x, GROUND_Y, 120, 22, 0x000000, 0.45).setDepth(9);
    this.spr = s.add.sprite(x, GROUND_Y, this.ak('idle')).setDepth(19);
    this.sm = new SpriteSmooth(s, this.spr); this.turn = this.face; this.breath = 0; this.stepPh = 0;
    this.spr.on('animationcomplete', (a) => { if (/_(attack|special|hurt)$/.test(a.key) && this.action !== 'dash') this.action = null; });
    this.tag = txt(s, x, GROUND_Y - 240, info.name, 17, '#ff9a8a', { origin: 0.5 }).setDepth(46);
    this.wfx = premiumWeapon(info) ? { warrior: 0xff5a2a, hunter: 0x7fd8ff, mage: 0xfff1a8 }[info.cls] : null;
    this.net = null; // último estado recebido do amigo
    this.play('idle', true);
  }
  ak(n) { return charAnimKey(this.c, n); }
  play(name, force = false) {
    const key = this.ak(name), m = ANIM_META[key];
    if (!m || (this.anim === name && !force)) return;
    this.anim = name; this.spr.setOrigin(m.ox, m.oy); this.baseScale = m.scale; this.spr.play(key, true);
  }
  airPose() {
    const key = this.ak('walk'), mt = ANIM_META[key], f = this.vy < -120 ? 2 : this.vy > 180 ? 6 : 4;
    if (this.anim !== 'air') { this.anim = 'air'; this.spr.anims.stop(); this.spr.setOrigin(mt.ox, mt.oy); this.baseScale = mt.scale; }
    if (this.airFrame !== f) { this.airFrame = f; this.spr.setTexture(key, f); }
  }
  rollDmg(mult) {
    const crit = Math.random() * 100 < this.st.crit;
    return Math.max(1, Math.round(this.st.atk * mult * Phaser.Math.FloatBetween(0.9, 1.1) * (crit ? 1.8 : 1) * PVP_DMG));
  }
  hitPlayer(mult, srcX, o) { return this.s.hurtPlayer(this.rollDmg(mult), srcX ?? this.x, o); }
  nearPlayer(rx, ry, dx0 = -40) { // o jogador está na área à frente?
    const p = this.s.p, fx = (p.x - this.x) * this.face;
    return fx > dx0 && fx < rx && Math.abs(p.y - this.y) < ry;
  }

  // ---------------------------------------------------------- AÇÕES (IA ou vindas da rede)
  doAttack(combo, face, ss) {
    if (this.dead) return;
    if (ss === undefined) ss = !!this.c.ss; // IA: usa Soulshot se tiver
    if (ss) soulshotFx(this.s, this.spr, this.cls, face || this.face, this.x, this.y, 0.3);
    const s = this.s, a = this.k.attack, cls = this.cls, cfg = ANIM_CFG[cls].attack, now = s.time.now;
    if (face) this.face = face;
    this.combo = combo ?? (now - this.lastAtk < 650 ? (this.combo + 1) % 3 : 0);
    this.lastAtk = now;
    const fin = this.combo === 2, hitMs = animFrameMs(cls, 'attack', cfg.hit);
    this.cancelAt = now + hitMs + 60;
    this.cd = Math.max(a.cooldown * 0.6, hitMs + 60);
    this.action = 'attack'; this.play('attack', true);
    if (this.ground && this.mode === 'ai') this.vx = this.face * MOVE_SPEED * 0.45;
    const tok = ++this.token, f = this.face, mult = a.mult * (fin ? 1.45 : 1) * (ss ? SOULSHOT_MULT : 1);
    s.time.delayedCall(hitMs, () => {
      if (this.dead || this.token !== tok || this.action !== 'attack' || s.state === 'ended') return;
      if (a.kind === 'melee') {
        if (fin) Sfx.play('swing_heavy', 0.6); else Sfx.swing();
        const fx = s.add.image(this.x + f * 95, this.y - 100, 'fx_slash').setDepth(25).setFlipX(f < 0).setScale(fin ? 1.25 : 1, fin ? 1.25 : (this.combo === 1 ? -1 : 1)).setAlpha(0.75).setTint(this.wfx || 0xffb0a0);
        s.tweens.add({ targets: fx, alpha: 0, scaleX: fx.scaleX * 1.3, duration: 160, onComplete: () => fx.destroy() });
        if (this.nearPlayer(a.range + 40, 210)) this.hitPlayer(mult);
        if (fin && this.c.level >= 5) { // Fúria
          const sh = this.fire('fx_ring', 760, 0, 0.8, { dy: -12, dx: 90, life: 0.75, r: 18, noAim: true });
          sh.s.setScale(0.3, 0.13).setTint(0xffd36b).setRotation(0);
        }
      } else if (a.kind === 'arrow') {
        Sfx.shoot(); this.fire('fx_arrow', fin ? 1600 : 1250, 0, mult, { dy: -128, dx: 110, scale: fin ? 1.3 : 1 });
        if (fin && this.c.level >= 5) for (const ang of [-9, 9]) this.fire('fx_arrow', 1450, ang, mult * 0.7, { dy: -128, dx: 110, noAim: true, scale: 1.1 });
      } else {
        Sfx.magic(); this.fire('fx_orb', fin ? 900 : 760, 0, mult, { dy: -138, dx: 105, scale: fin ? 1.45 : 1, trail: 0xb79bff });
      }
    });
  }
  doSpecial(face) {
    if (this.dead) return;
    const s = this.s, cls = this.cls, sk = this.k.skill, cfg = ANIM_CFG[cls].special;
    if (face) this.face = face;
    if (cls === 'warrior') { this.mp = 0; s.floatText(this.x, this.y - 250, sk.name, '#ff9a8a', 24); this.doDash('shieldbash', this.face); return; } // Escudada
    this.mp = 0; this.action = 'special'; this.token++; this.play('special', true);
    const dur = animDurMs(cls, 'special');
    this.inv = Math.max(this.inv, dur); this.cd = dur;
    s.floatText(this.x, this.y - 250, sk.name, '#ff9a8a', 24);
    const at = (frame, fn) => s.time.delayedCall(animFrameMs(cls, 'special', frame), () => { if (!this.dead && this.action === 'special' && s.state !== 'ended') fn(); });
    const f = this.face;
    if (cls === 'warrior') {
      cfg.hits.forEach((fr) => at(fr, () => {
        Sfx.play('spin', 0.8);
        const ring = s.add.image(this.x, this.y - 100, 'fx_ring').setTint(0xff8a6a).setDepth(25).setScale(0.3);
        s.tweens.add({ targets: ring, scale: 1.9, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
        const p = s.p;
        if (Math.abs(p.x - this.x) < sk.radius + 40 && Math.abs(p.y - this.y) < 280) this.hitPlayer(sk.mult / 2);
      }));
    } else if (cls === 'hunter') {
      cfg.shots.forEach((fr, i) => at(fr, () => { Sfx.shoot(); this.fire('fx_arrow', 1500, -6 + i * 3, sk.mult, { dy: -128, dx: 110, life: 1.2, pierce: true, noAim: true }); }));
    } else {
      at(2, () => Sfx.play('fire_cast', 0.8, 0));
      at(cfg.hit, () => {
        Sfx.play('swing_heavy', 0.7); Sfx.magic();
        const sh = this.fire('fireball', 820, 0, sk.mult, { dx: 150, dy: -128, scale: 1.7, life: 1.9, r: 30, trail: 0xff9a3c, face: f, noAim: true,
          onHit: (x, y) => s.explosion(x, y) });
        sh.s.setFlipX(f < 0);
      });
    }
  }
  doSkill2(face) {
    if (this.dead) return;
    const s = this.s, cls = this.cls, cfg = ANIM_CFG[cls].attack;
    if (face) this.face = face;
    this.mp = Math.max(0, this.mp - SKILL2_MP); this.cd2 = 900;
    s.floatText(this.x, this.y - 250, CLASS_SKILLS[cls][1].name, '#ff9a8a', 22);
    if (cls === 'warrior') { this.doDash('charge', this.face); return; }
    this.action = 'attack'; this.cancelAt = s.time.now + 9999; this.play('attack', true);
    const tok = ++this.token;
    s.time.delayedCall(animFrameMs(cls, 'attack', cfg.hit), () => {
      if (this.dead || this.token !== tok || s.state === 'ended') return;
      if (cls === 'hunter') {
        Sfx.shoot();
        const sh = this.fire('fx_arrow', 1350, 0, 2.0, { dy: -128, dx: 110, scale: 1.5, trail: 0xff9a3c, onHit: (x, y) => s.explosion(x, y) });
        sh.s.setTint(0xffb060);
      } else {
        Sfx.play('warp_in', 0.6);
        const sh = this.fire('fx_orb', 820, 0, 1.2, { dy: -138, dx: 105, scale: 1.5, trail: 0x9fdfff, onHit: (x, y) => {
          const fx = s.add.image(x, y, 'fx_ring').setTint(0x9fdfff).setScale(0.2).setDepth(28);
          s.tweens.add({ targets: fx, scale: 1.1, alpha: 0, duration: 380, onComplete: () => fx.destroy() });
          s.freezePlayer(0.9);
        } });
        sh.s.setTint(0x9fdfff);
      }
    });
  }
  // tecla I (nível 8): Muralha de Escudo / Salto Evasivo / Nova Gélida
  doSkill3(face) {
    if (this.dead) return;
    const s = this.s, cls = this.cls, cfg = SKILL3[cls];
    if (face) this.face = face;
    this.cd3 = cfg.cd;
    s.floatText(this.x, this.y - 250, CLASS_SKILLS[cls][3].name, '#ff9a8a', 22);
    if (cls === 'warrior') {
      this.action = 'guard'; this.token++; this.anim = 'guard';
      const k = this.ak('attack'), mt = ANIM_META[k]; this.spr.anims.stop(); this.spr.setTexture(k, 2).setOrigin(mt.ox, mt.oy); this.baseScale = mt.scale;
      const fx = s.guardFx(this.x + this.face * 70, this.y - 110, this.face);
      this.guard = { until: s.time.now + cfg.dur, face: this.face, fx };
      Sfx.play('bash', 0.5);
    } else if (cls === 'hunter') {
      const f = this.face;
      this.doDash('leap', -f);
      s.time.delayedCall(110, () => {
        if (this.dead || s.state === 'ended') return;
        Sfx.shoot();
        const sh = this.fire('fx_arrow', 1400, 0, 0.6, { dy: -128, dx: 90, face: f, scale: 1.2, trail: 0xe9ffd0, onHit: (x, y) => { s.netFx(x, y); s.slowPlayer(cfg.slow, cfg.slowT); } });
        sh.s.setTint(0xe9ffd0);
      });
    } else {
      this.action = 'attack'; this.cancelAt = s.time.now + 160; this.token++; this.play('attack', true);
      this.inv = Math.max(this.inv, 300);
      s.novaFx(this.x, this.y, cfg.radius);
      const p = s.p, dx = p.x - this.x;
      if (Math.abs(dx) < cfg.radius + 40 && Math.abs(p.y - this.y) < 260 && this.hitPlayer(cfg.mult, this.x)) {
        if (!p.guard) { p.kvx = (Math.sign(dx) || this.face) * cfg.push * 7; s.slowPlayer(cfg.slow, cfg.slowT); }
      }
    }
  }
  endGuard() {
    const g = this.guard; if (!g) return;
    this.guard = null; this.s.tweens.killTweensOf(g.fx);
    this.s.tweens.add({ targets: g.fx, alpha: 0, scaleX: 0.2, duration: 140, onComplete: () => g.fx.destroy() });
    if (this.action === 'guard') { this.action = null; this.anim = null; }
  }
  guardBlocks(srcX) { return !!this.guard && (srcX - this.x) * this.guard.face > -25; }
  // bloqueou: mostra e devolve um projétil dourado com dano fixo (já com a redução da Arena)
  blockFx() {
    const s = this.s, now = s.time.now;
    if (!this.lastBlock || now - this.lastBlock > 250) s.floatText(this.x, this.y - 230, 'BLOQUEIO!', '#ffd36b', 24);
    this.lastBlock = now;
    Sfx.play('bash', 0.8); s.burst(this.x + (this.guard ? this.guard.face : this.face) * 80, this.y - 120, 0xffe9a0, 10);
  }
  reflect(fixed, key) {
    this.blockFx();
    const k = key === 'fx_arrow' || key === 'fx_orb' ? key : 'fx_orb';
    const sh = this.fire(k, 1500, 0, 0, { dy: -120, dx: 60, life: 0.8, trail: 0xffd36b, noAim: true, face: this.guard ? this.guard.face : this.face });
    sh.fixed = fixed; sh.s.setTint(0xffd36b);
  }
  // projétil do rival (só acerta o jogador)
  fire(key, speed, angleDeg, mult, o = {}) {
    const s = this.s, face = o.face || this.face;
    let x = this.x + face * (o.dx ?? 70); const y = this.y + (o.dy ?? -100);
    { const p = s.p, d = (p.x - this.x) * face; if (d > -20 && d < (o.dx ?? 70) + 20 && Math.abs(p.y - this.y) < 200) x = this.x + face * Math.max(10, d - 10); }
    const spr = s.anims.exists(key) ? s.add.sprite(x, y, key).play(key) : s.add.image(x, y, key);
    spr.setDepth(26).setFlipX(face < 0).setScale(o.scale || 1);
    if (!angleDeg && !o.noAim) { // mira no jogador se ele estiver mais alto/baixo
      const p = s.p, dx = (p.x - x) * face, ty = p.y - 100;
      if (dx > 40 && Math.abs(ty - y) > 70) angleDeg = Phaser.Math.Clamp(Phaser.Math.RadToDeg(Math.atan2(ty - y, dx)), -40, 40);
    }
    const rad = Phaser.Math.DegToRad(angleDeg || 0);
    spr.rotation = face > 0 ? rad : -rad;
    if (this.wfx && (key === 'fx_orb' || key === 'fx_arrow')) spr.setTint(this.wfx);
    if (key === 'fx_orb') s.tweens.add({ targets: spr, scale: (o.scale || 1) * 1.25, duration: 120, yoyo: true, repeat: -1 });
    const sh = { s: spr, vx: Math.cos(rad) * speed * face, vy: Math.sin(rad) * speed, mult, life: o.life || 1.3, r: o.r || 0,
      pierce: !!o.pierce, onHit: o.onHit, trail: o.trail || (this.wfx && key !== 'fx_ring' ? this.wfx : null), owner: this };
    s.rShots.push(sh);
    return sh;
  }
  doDash(kind, dir, o = {}) {
    if (this.dead) return;
    const s = this.s, cls = this.cls, air = !this.ground;
    this.face = dir; this.action = 'dash'; this.token++;
    if (air) this.airDash = 0;
    const D = {
      roll: { dur: 360, speed: 940, iframes: 300, cd: 330, color: 0xff9a8a },
      bash: { dur: 260, speed: 1080, iframes: 260, cd: 380, color: 0xffd36b, hover: true },
      charge: { dur: 330, speed: 1180, iframes: 330, cd: 300, color: 0xffb040, hover: air },
      shieldbash: { dur: 240, speed: 900, iframes: 320, cd: 0, color: 0xfff09a, hover: air },
      airdash: { dur: 230, speed: 1150, iframes: 230, cd: 330, color: 0x9cff8a, hover: true },
      teleport: { dur: 240, dist: 290, iframes: 320, cd: 420, color: 0xc08cff, hover: true },
      leap: { dur: 650, speed: SKILL3.hunter.speed, iframes: 450, cd: 0, color: 0x9cff8a },
    }[kind];
    if (this.guard) this.endGuard();
    this.dash = { kind, t: 0, ...D, dir, hit: false, ghostT: 0 };
    if (kind !== 'charge' && kind !== 'shieldbash' && kind !== 'leap') this.dashCd = DASH_COOLDOWN;
    this.inv = Math.max(this.inv, D.iframes); this.dodging = true;
    s.time.delayedCall(D.iframes, () => { this.dodging = false; });
    if (D.hover && this.mode === 'ai') this.vy = 0;
    this.vx = 0; this.kvx = 0; this.spr.anims.stop(); this.anim = null; this.spr.setAlpha(1);
    if (kind === 'leap') {
      Sfx.play('jump', 0.6); Sfx.play('dash', 0.4); s.dust(this.x, 6, this.y);
      if (this.mode === 'ai') { this.vy = SKILL3.hunter.jump; this.ground = false; this.plat = null; }
      this.face = -dir;
    } else if (kind === 'roll') {
      const rk = `${this.base}_roll`;
      if (hasAnim(rk)) { const mt = ANIM_META[rk]; this.spr.setOrigin(mt.ox, mt.oy); this.baseScale = mt.scale; this.spr.play(rk); }
    } else if (kind === 'bash' || kind === 'charge' || kind === 'shieldbash') {
      Sfx.play('dash', 0.6);
      const k = this.ak('attack'), mt = ANIM_META[k]; this.spr.setTexture(k, 2).setOrigin(mt.ox, mt.oy); this.baseScale = mt.scale;
      this.dash.shield = s.add.image(this.x, this.y - 110, 'fx_glow').setTint(0xffd36b).setScale(0.55, 1.05).setAlpha(0.85).setDepth(21).setBlendMode('ADD');
    } else if (kind === 'airdash') {
      Sfx.play('dash', 0.5);
      const k = this.ak('walk'), mt = ANIM_META[k]; this.spr.setTexture(k, 4).setOrigin(mt.ox, mt.oy); this.baseScale = mt.scale;
    } else {
      Sfx.play('warp_out', 0.6); s.warpFx(this.x, this.y);
      if (this.c.level >= 5) this.burstArcane(this.x, this.y);
      this.dash.to = o.to ?? Phaser.Math.Clamp(this.x + dir * D.dist, 50, SEG - 50);
      const wk = `${this.base}_warp`;
      if (hasAnim(wk)) { const mt = ANIM_META[wk]; this.spr.setOrigin(mt.ox, mt.oy); this.baseScale = mt.scale; this.spr.play(wk); this.dash.vanishAt = 170; this.dash.dur = 330; }
    }
  }
  burstArcane(x, y) {
    const s = this.s, fx = s.add.image(x, y - 100, 'fx_ring').setTint(0xc08cff).setScale(0.2).setDepth(27).setBlendMode('ADD');
    s.tweens.add({ targets: fx, scale: 0.9, alpha: 0, duration: 320, onComplete: () => fx.destroy() });
    const p = s.p; if (Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < 240) this.hitPlayer(1.0, x);
  }
  updateDash(dt, delta) {
    const s = this.s, d = this.dash;
    d.t += delta; d.ghostT -= delta;
    const k = Math.min(1, d.t / d.dur), ai = this.mode === 'ai';
    if (d.kind === 'leap') {
      if (ai) this.vx = d.dir * d.speed * (1 - k * 0.3);
      this.face = -d.dir; this.airPose();
      if (d.t > 160 && this.ground) d.t = d.dur;
    } else if (d.kind === 'roll') { if (ai) this.vx = d.dir * d.speed * (1 - k * 0.6); }
    else if (d.kind === 'teleport') {
      if (ai) { this.vx = 0; this.vy = 0; }
      if (!d.moved && d.t >= (d.vanishAt || 90)) {
        d.moved = true;
        if (ai) this.x = d.to;
        s.warpFx(this.x, this.y); Sfx.play('warp_in', 0.6);
        if (this.c.level >= 5) this.burstArcane(this.x, this.y);
        const wk = `${this.base}_warp`; if (hasAnim(wk)) this.spr.playReverse(wk);
      }
    } else {
      if (ai) { this.vx = d.dir * d.speed * (1 - k * 0.35); this.vy = 0; }
      if (d.shield) { d.shield.x = this.x + d.dir * 70; d.shield.y = this.y - 110; }
      if (d.kind === 'shieldbash' && !d.hit && (this.nearPlayer(this.halfW + 90, 200, -30) || d.t >= d.dur - 20)) {
        d.hit = true; d.t = d.dur; // Escudada: impacto que atordoa
        Sfx.play('bash', 0.9); Sfx.play('slam', 0.6); s.cameras.main.shake(160, 0.008);
        const x = this.x + d.dir * 110, ring = s.add.image(x, this.y - 105, 'fx_ring').setTint(0xfff09a).setScale(0.25, 0.4).setDepth(28).setBlendMode('ADD');
        s.tweens.add({ targets: ring, scaleX: 1.2, scaleY: 1.5, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
        if (this.nearPlayer(this.halfW + 260, 260) && this.hitPlayer(this.k.skill.mult)) s.freezePlayer(0.8, true);
      } else if ((d.kind === 'bash' || d.kind === 'charge') && !d.hit && this.nearPlayer(this.halfW + 80, 180, -30)) {
        d.hit = true; this.hitPlayer(d.kind === 'charge' ? 1.7 : 0.7); Sfx.play('bash', 0.8);
      }
    }
    if (d.ghostT <= 0 && d.kind !== 'teleport') {
      d.ghostT = d.kind === 'roll' ? 70 : 35;
      const sp = this.spr, g = s.add.image(sp.x, sp.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY)
        .setScale(sp.scaleX, sp.scaleY).setTintFill(d.color).setAlpha(0.3).setDepth(18).setBlendMode('ADD');
      s.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
    }
    if (d.t >= d.dur) this.endDash();
  }
  endDash() {
    const d = this.dash; if (!d) return;
    if (d.shield) { const sh = d.shield; this.s.tweens.add({ targets: sh, alpha: 0, duration: 120, onComplete: () => sh.destroy() }); }
    this.dash = null; this.action = null; this.anim = null;
    if (this.mode === 'ai') { this.vx = d.dir * (d.kind === 'teleport' ? 0 : d.kind === 'leap' ? MOVE_SPEED * 0.2 : MOVE_SPEED * 0.8); if (d.hover) this.vy = d.kind === 'teleport' ? 0 : 60; }
  }
  // golpe do jogador acertou o rival (só na Arena contra a IA; no duelo quem decide é o aparelho do amigo)
  takeHit({ dmg, crit }, knock, opt = {}) {
    const s = this.s;
    if (this.dead || s.state !== 'play') return;
    if (this.dodging) { this.showDodge(); return; }
    if (!opt.noBlock && this.guardBlocks(opt.srcX ?? s.p.x)) { this.reflect(Math.max(1, Math.round(dmg * PVP_DMG * SKILL3.warrior.reflect)), opt.key); return; }
    if (this.inv > 0) return;
    const taken = Math.max(1, Math.round(dmg * PVP_DMG * (this.k.dmgTaken || 1) * (1 - this.st.def / (this.st.def + 150))));
    this.hp -= taken; this.inv = 350; this.mp = Math.min(100, this.mp + 4);
    this.showHurt(taken, crit, Math.sign(this.x - s.p.x) || 1, knock, opt.stagger);
    if (this.hp <= 0) { this.hp = 0; s.finish('win'); }
  }
  showDodge() {
    const now = this.s.time.now;
    if (this.lastDodge && now - this.lastDodge < 400) return;
    this.lastDodge = now; this.s.floatText(this.x, this.y - 230, 'ESQUIVA!', '#8fe9ff', 22);
  }
  showHurt(taken, crit, dir, knock = 30, heavy = false) {
    const s = this.s;
    if (crit || heavy) Sfx.play('hit_heavy', 0.8); else Sfx.hit();
    s.blood(this.x - dir * 20, this.y - 110, dir, crit || heavy ? 14 : 8);
    if (taken) s.floatText(this.x, this.y - 220, crit ? `${taken}!` : `${taken}`, crit ? '#ffd23f' : '#ffffff', crit ? 32 : 26);
    this.spr.setTintFill(0xffffff); s.time.delayedCall(70, () => { if (this.spr.active) { this.spr.clearTint(); if (this.frozen > 0) this.spr.setTint(0x9fdfff); } });
    s.burst(this.x - dir * 20, this.y - 110, 0xffe3a0, crit ? 10 : 5);
    if (this.mode === 'ai') this.kvx = dir * Math.min(520, knock * 9);
    if (this.action !== 'special' && !this.dead) {
      if (this.dash) this.endDash();
      if (this.guard) this.endGuard();
      this.token++; this.action = 'hurt'; this.hurtAt = s.time.now; this.play('hurt', true);
    }
    s.freeze(crit ? 75 : 45);
  }
  freeze(secs, stun = false) {
    if (this.dead) return;
    this.frozen = secs; this.spr.anims.pause(); this.spr.setTint(stun ? 0xfff0a0 : 0x9fdfff); this.token++; if (this.guard) this.endGuard(); this.action = null; if (this.dash) this.endDash();
    if (stun) this.s.floatText(this.x, this.y - 230, 'ATORDOADO!', '#ffe27a', 22); else Sfx.play('warp_out', 0.4);
  }
  die() {
    if (this.dead) return;
    this.dead = true; this.hp = 0; if (this.dash) this.endDash(); if (this.guard) this.endGuard();
    const s = this.s, dk = `${this.base}_death`;
    this.spr.clearTint().setAlpha(1).setAngle(0);
    if (hasAnim(dk)) { const mt = ANIM_META[dk]; this.spr.setOrigin(mt.ox, mt.oy).setScale(mt.scale * this.face, mt.scale).play(dk); }
    else s.tweens.add({ targets: this.spr, angle: -85 * this.face, alpha: 0.6, duration: 500 });
    this.y = this.floor(); this.spr.y = this.y;
  }
  floor() { return this.s.floorBelow(this.x, this.y); }

  // ---------------------------------------------------------- LOOP
  update(dt, delta) {
    const s = this.s;
    this.inv -= delta; this.cd -= delta; this.cd2 -= delta; this.cd3 -= delta; this.dashCd -= delta;
    this.dodgeCd -= dt; this.jumpCd -= dt;
    if (this.slowT > 0) { this.slowT -= dt; if (Math.random() < 0.3) s.iceDot(this.x, this.y); }
    if (this.guard) {
      if (this.dead || s.time.now >= this.guard.until || this.action !== 'guard') this.endGuard();
      else { this.face = this.guard.face; this.guard.fx.x = this.x + this.face * 70; this.guard.fx.y = this.y - 110; }
    }
    if (this.frozen > 0) { this.frozen -= dt; if (this.frozen <= 0) { this.spr.anims.resume(); this.spr.clearTint(); } }
    if (this.mode === 'net') this.followNet(dt);
    else if (!this.dead) {
      this.mp = Math.min(100, this.mp + 2.5 * dt);
      if (s.state === 'play' && this.frozen <= 0) this.brain(dt); else this.in.dir = 0;
      this.physics(dt, delta);
    }
    if (this.dash && !this.dead) this.updateDash(dt, delta);
    this.visual(dt);
  }
  physics(dt, delta) {
    const now = this.s.time.now;
    if (!this.dash) {
      if (this.action === 'hurt' && now - this.hurtAt > 260) { this.action = null; this.anim = null; }
      const dir = this.frozen > 0 ? 0 : this.in.dir;
      if (dir && this.action !== 'attack' && this.action !== 'special' && this.action !== 'guard') this.face = dir;
      const slow = this.action === 'special' || this.frozen > 0 ? 0 : this.action === 'guard' ? SKILL3.warrior.move : this.action === 'hurt' ? 0.4 : this.action === 'attack' ? (this.ground ? 0.72 : 1) : 1;
      const target = dir * MOVE_SPEED * slow * (this.slowT > 0 ? this.slowMul : 1);
      const acc = (this.ground ? (dir ? 4200 : 7000) : 3800) * dt;
      this.vx += Phaser.Math.Clamp(target - this.vx, -acc, acc);
      if (this.in.jump && this.ground && this.action !== 'special' && this.action !== 'hurt' && this.action !== 'guard') {
        this.vy = JUMP_V; this.ground = false; this.plat = null; Sfx.play('jump', 0.35); this.s.dust(this.x, 4, this.y);
      }
      if (this.in.drop && this.plat) { this.plat = null; this.ground = false; this.dropT = 180; }
    }
    this.in.jump = false; this.in.drop = false;
    this.x += (this.vx + this.kvx) * dt; this.kvx *= Math.pow(0.0008, dt);
    this.dropT = (this.dropT || 0) - delta;
    if (this.plat && (this.x < this.plat.x - this.plat.w / 2 + 6 || this.x > this.plat.x + this.plat.w / 2 - 6)) { this.plat = null; this.ground = false; }
    if (!this.ground && !(this.dash && this.dash.hover)) {
      const prevY = this.y;
      this.vy = Math.min(1500, this.vy + GRAVITY * (this.vy > 0 ? 1.3 : 1) * dt);
      this.y += this.vy * dt;
      let floor = GROUND_Y, plat = null;
      if (this.vy >= 0 && !(this.dropT > 0)) for (const pl of this.s.plats) {
        if (prevY <= pl.y + 2 && this.y >= pl.y && Math.abs(this.x - pl.x) < pl.w / 2 - 6) { floor = pl.y; plat = pl; break; }
      }
      if (this.y >= floor) { this.y = floor; this.vy = 0; this.ground = true; this.airDash = 1; this.plat = plat; }
    }
    this.x = Phaser.Math.Clamp(this.x, 50, SEG - 50);
  }
  // duelo: segue a posição que o aparelho do amigo manda (com uma pequena previsão)
  followNet(dt) {
    const n = this.net; if (!n) return;
    const age = Math.min(0.12, (this.s.time.now - n.at) / 1000);
    const tx = n.x + n.vx * age, ty = n.g ? n.y : n.y + n.vy * age;
    if (Math.abs(tx - this.x) > 160 || Math.abs(ty - this.y) > 220) { this.x = tx; this.y = ty; }
    else { const k = Math.min(1, dt * 16); this.x += (tx - this.x) * k; this.y += (ty - this.y) * k; }
    this.vx = n.vx; this.vy = n.vy; this.ground = !!n.g;
    if (!this.action && !this.dash) this.face = n.f;
    this.hp = n.hp; this.maxHp = this.max = n.mx; this.mp = n.mp;
    if (n.fz && !(this.frozen > 0)) { this.frozen = 0.25; this.spr.setTint(0x9fdfff); }
    else if (n.fz) this.frozen = 0.25;
  }
  visual(dt) {
    const s = this.s;
    if (!this.dead) {
      if (!this.action && !this.dash && !(this.frozen > 0)) {
        if (!this.ground) this.airPose();
        else this.play(Math.abs(this.vx) > 40 ? 'walk' : 'idle');
      }
      if (this.anim === 'walk') this.spr.anims.timeScale = Phaser.Math.Clamp(Math.abs(this.vx) / MOVE_SPEED, 0.55, 1.15);
      else if (this.spr.anims.timeScale !== 1) this.spr.anims.timeScale = 1;
      const d = this.dash;
      // virada suave, respiração, passos e esticar no ar (igual ao jogador)
      this.turn = d ? this.face : approachVal(this.turn, this.face, s.game.loop.delta / 1000 * 24);
      const tv = (this.turn < 0 ? -1 : 1) * Math.max(0.18, Math.abs(this.turn));
      const dt = Math.min(0.05, s.game.loop.delta / 1000); this.breath += dt;
      let bx = 1, by = 1, bob = 0;
      if (this.anim === 'idle' && this.ground) { const b = Math.sin(this.breath * 2.6); by += b * 0.014; bx -= b * 0.007; }
      if (this.anim === 'walk' && this.ground) { this.stepPh += Math.abs(this.vx) * dt * 0.026; bob = Math.abs(Math.sin(this.stepPh)) * 3; }
      if (!this.ground && !d) { const k = Phaser.Math.Clamp(Math.abs(this.vy) / 2600, 0, 0.07); by += k; bx -= k * 0.5; }
      this.spr.x = this.x; this.spr.y = this.y - bob;
      const lean = !d && !this.action ? Phaser.Math.Clamp(this.vx / MOVE_SPEED, -1, 1) * (this.ground ? 3 : 5) : 0;
      this.spr.angle = d && d.kind === 'leap' ? -d.dir * 12 * Math.sin(Math.min(1, d.t / d.dur) * Math.PI) : d && (d.kind === 'bash' || d.kind === 'airdash' || d.kind === 'charge' || d.kind === 'shieldbash') ? d.dir * 10 : Phaser.Math.Linear(this.spr.angle, lean, Math.min(1, dt * 14));
      this.spr.setScale(this.baseScale * tv * bx, this.baseScale * by);
      const blink = this.inv > 0 && this.action !== 'special' && !this.dash && this.action === 'hurt';
      this.spr.setAlpha(blink ? (Math.floor(s.time.now / 70) % 2 ? 0.5 : 1) : 1);
    }
    const fl = s.floorBelow(this.x, this.y);
    this.shadow.x = this.x; this.shadow.y = fl; this.shadow.setScale(Math.max(0.3, 1 - (fl - this.y) / 500));
    this.tag.x = this.x; this.tag.y = this.y - 245; this.tag.setVisible(!this.dead);
    this.sm.update(Math.min(0.05, s.game.loop.delta / 1000));
  }

  // ---------------------------------------------------------- IA
  brain(dt) {
    const s = this.s, p = s.p, now = s.time.now, sk = this.skill;
    this.in.dir = 0;
    if (this.dash || this.action === 'special' || (this.action === 'hurt' && now - this.hurtAt < 260)) return;
    const dx = p.x - this.x, dist = Math.abs(dx), dir = Math.sign(dx) || 1, dy = this.y - p.y;
    const melee = this.cls === 'warrior', [near, far] = RIVAL_RANGE[this.cls];
    if (this.guard) { if (dist > 200) this.in.dir = dir; return; } // segurando o escudo: só avança devagar
    const has3 = this.c.level >= CLASS_SKILLS[this.cls][3].lvl && this.cd3 <= 0;
    // muda de "humor" de vez em quando (mais agressivo / mais cauteloso) para não ficar previsível
    this.moodT -= dt; if (this.moodT <= 0) { this.moodT = Phaser.Math.FloatBetween(1.5, 3.5); this.mood = Math.random() < 0.5 ? 0 : Phaser.Math.FloatBetween(-120, 120); }

    // 1) perigo: golpe ou projétil chegando → esquiva (com tempo de reação conforme a habilidade)
    const danger = this.danger(dist, dir);
    this.dangerT = danger ? this.dangerT + dt : 0;
    const react = 0.42 - sk * 0.3;
    if (danger && this.dangerT >= react && this.dodgeCd <= 0) {
      // guerreiro: levanta a Muralha de Escudo virado para o perigo (às vezes no lugar do desvio)
      if (melee && has3 && this.ground && Math.random() < 0.25 + sk * 0.5) { this.dodgeCd = 0.6; this.doSkill3(dir); return; }
      // atiradores: inimigo colado → Salto Evasivo / Nova Gélida
      if (!melee && has3 && danger === 'melee' && dist < 300 && Math.random() < 0.3 + sk * 0.5) { this.dodgeCd = 0.6; this.doSkill3(dir); return; }
      this.dodgeCd = 0.6;
      if (Math.random() < 0.15 + sk * 0.7) {
        if (danger === 'shot' && this.ground && Math.random() < 0.45) { this.in.jump = true; return; }
        const cornered = (this.x < 260 && -dir < 0) || (this.x > SEG - 260 && -dir > 0);
        const through = melee || cornered || Math.random() < 0.3; // atravessa o jogador rolando
        if (this.tryDash(through ? dir : -dir)) return;
      }
    }
    if (this.action === 'attack' && now < this.cancelAt) return;
    if (this.action === 'attack' && !melee && dist > near) return; // termina a animação do tiro

    // 2) habilidades
    const level = this.c.level, aligned = Math.abs(dy) < (melee ? 110 : 160);
    if (this.mp >= 100 && aligned && ((melee && dist < 230) || (!melee && dist > 200 && dist < 900)) && Math.random() < dt * (1 + sk * 3)) {
      this.face = dir; this.doSpecial(); return;
    }
    if (level >= CLASS_SKILLS[this.cls][1].lvl && this.mp >= SKILL2_MP + 10 && this.cd2 <= 0 && aligned && Math.random() < dt * (0.4 + sk)) {
      if ((melee && dist > 260 && dist < 650) || (this.cls === 'hunter' && dist > 300) || (this.cls === 'mage' && dist < 560)) {
        this.face = dir; this.doSkill2(); return;
      }
    }

    // fuga: atirador com o inimigo perto demais
    if (!melee && has3 && dist < (this.cls === 'mage' ? 230 : 260) && Math.abs(dy) < 160 && Math.random() < dt * (0.8 + sk * 3)) {
      this.doSkill3(dir); return;
    }
    // 3) andar / pular / atacar
    const aggr = 0.55 + sk * 0.45;
    if (melee) {
      const want = near + Math.max(0, this.mood * 0.3);
      if (dist > want || !aligned) {
        this.in.dir = dir;
        if (dy > 100 && this.ground && dist < 300 && this.jumpCd <= 0) { this.in.jump = true; this.jumpCd = 0.8; }
        if (dy < -100 && this.plat) this.in.drop = true;
        if (dist > 520 && this.dashCd <= 0 && Math.random() < dt * sk) this.tryDash(dir);
      } else if (this.cd <= 0 && Math.random() < dt * 12 * aggr) { this.face = dir; this.doAttack(); }
      else if (this.cd > 0 && Math.random() < dt * 0.6) this.in.dir = -dir; // recua um passo
    } else {
      const lo = near + this.mood * 0.5, hi = far + this.mood * 0.5;
      const wallBehind = (-dir < 0 && this.x < 240) || (-dir > 0 && this.x > SEG - 240);
      if (dist < lo) {
        if (dist < 170 && this.cd <= 0 && Math.random() < dt * 6) { this.face = dir; this.doAttack(); return; }
        if (wallBehind) { if (this.dashCd <= 0 && Math.random() < dt * (1 + sk * 3)) this.tryDash(dir); else this.in.dir = dir; }
        else if (dist < 260 && this.dashCd <= 0 && Math.random() < dt * (0.5 + sk * 2.5)) this.tryDash(-dir);
        else this.in.dir = -dir;
        if (Math.random() < dt * 0.6 && this.ground) this.in.jump = true;
      } else if (dist > hi) this.in.dir = dir;
      else if (this.cd <= 0 && Math.abs(dy) < 300 && Math.random() < dt * 9 * aggr) { this.face = dir; this.doAttack(); }
      else if (Math.random() < dt * 0.8) this.in.dir = Math.random() < 0.5 ? dir : -dir;
    }
    // às vezes sobe na plataforma
    if (!melee && this.ground && this.jumpCd <= 0 && Math.random() < dt * 0.25) {
      const pl = s.plats.find(pl => Math.abs(pl.x - this.x) < pl.w / 2 + 40);
      if (pl) { this.in.jump = true; this.jumpCd = 1.5; }
    }
  }
  danger(dist, dir) {
    const s = this.s, p = s.p;
    for (const sh of s.shots) {
      if (!sh.s.active || sh.life <= 0) continue;
      const toward = Math.sign(sh.vx) === Math.sign(this.x - sh.s.x);
      if (toward && Math.abs(sh.s.x - this.x) < 340 && Math.abs(sh.s.y - (this.y - 100)) < 150) return 'shot';
    }
    const facing = p.face === -dir;
    if ((p.action === 'attack' && s.ch.cls === 'warrior' && dist < 260 && facing) || (p.action === 'special' && dist < 330) || (p.dash && p.dash.kind === 'charge' && facing && dist < 500)) return 'melee';
    return null;
  }
  tryDash(dir) {
    if (this.dashCd > 0 || this.action === 'special' || (!this.ground && this.airDash <= 0)) return false;
    const kind = this.cls === 'mage' ? 'teleport' : this.ground ? 'roll' : (this.cls === 'warrior' ? 'bash' : 'airdash');
    this.doDash(kind, dir); return true;
  }
  destroy() { this.sm.destroy(); [this.spr, this.shadow, this.tag].forEach(o => o && o.destroy()); }
}

// ============================================================
//  TELA DA ARENA (lobby)
// ============================================================
class ArenaScene extends Phaser.Scene {
  constructor() { super('Arena'); }
  create() {
    Music.play('town');
    this.cameras.main.fadeIn(220);
    const c = this.c = Save.cur(); if (!c) return this.scene.start('CharSelect');
    const a = arenaData(c);
    if (!a.opps) { a.opps = [0, 1, 2].map(i => makeBot(c, a, i)); Save.write(); }
    this.add.image(W / 2, H / 2, 'arena').setDisplaySize(W + 10, H + 6);
    this.add.rectangle(W / 2, H / 2, W, H, 0x07060a, 0.55);
    txt(this, W / 2, 40, 'Arena', 46, '#f2c766', { origin: 0.5, title: true }).setStroke('#3a2208', 7);
    // ---------- meu herói e liga
    const lg = leagueOf(a.pts);
    ui(this, 28, 86, 'frame_big', 360, 548);
    charImage(this, 208, 382, c, 0.78);
    txt(this, 208, 116, c.name, 28, '#f3e2b8', { origin: 0.5, title: true });
    txt(this, 208, 148, `${CLASSES[c.cls].name} • Nível ${c.level}`, 18, COL.dim, { origin: 0.5 });
    txt(this, 208, 412, `Liga ${lg.name}`, 32, lg.color, { origin: 0.5, title: true });
    txt(this, 208, 452, `${a.pts} pontos`, 24, '#f3e2b8', { origin: 0.5 });
    const nx = LEAGUES[LEAGUES.indexOf(lg) + 1];
    txt(this, 208, 482, nx ? `Próxima: ${nx.name} (${nx.min})` : 'Liga máxima!', 16, COL.dim, { origin: 0.5 });
    txt(this, 208, 516, `Vitórias ${a.w} • Derrotas ${a.l}`, 18, COL.text, { origin: 0.5 });
    const left = Math.max(0, ARENA_DAILY - a.fights);
    txt(this, 208, 552, left ? `Lutas valendo pontos hoje: ${left}/${ARENA_DAILY}` : 'Lutas de hoje acabaram — treinos não valem pontos', 15, left ? '#7dff6a' : '#ffb36b', { origin: 0.5, align: 'center', wrap: 320 });
    txt(this, 208, 596, `Recorde: ${a.best} pts`, 15, COL.dim, { origin: 0.5 });
    // ---------- adversários
    txt(this, 820, 98, 'Escolha seu adversário', 24, COL.goldTxt, { origin: 0.5, title: true });
    a.opps.forEach((o, i) => this.oppCard(o, 560 + i * 262, 126));
    button(this, 820, 536, 290, 52, '↻ Outros adversários', () => { a.opps = [0, 1, 2].map(i => makeBot(c, a, i)); Save.write(); this.scene.restart(); }, { size: 19, skin: 'btn_dark' });
    // ---------- duelo com amigo
    ui(this, 430, 572, 'panel_header', 780, 92).setAlpha(0.95);
    txt(this, 456, 598, 'Duelo com amigo', 22, '#f3e2b8', { title: true });
    txt(this, 456, 628, 'Ao vivo, com código de sala • não vale pontos', 15, COL.dim, { bold: false });
    button(this, 952, 618, 176, 58, 'CRIAR SALA', () => this.createRoom(), { size: 19, title: true, skin: 'btn_green' });
    button(this, 1124, 618, 150, 58, 'ENTRAR', () => this.joinRoom(), { size: 19, title: true, skin: 'btn_blue' });
    button(this, 110, H - 40, 160, 52, '‹ Vila', () => { Net.close(); fadeTo(this, 'Hub'); }, { size: 22, skin: 'btn_dark3' });
    screenFrame(this);
    this.events.once('shutdown', () => { if (this.waiting) Net.close(); });
  }
  oppCard(o, x, y) {
    const lg = leagueOf(o.pts);
    ui(this, x - 120, y, 'panel_parch', 240, 384);
    const g = this.add.image(x, y + 230, 'fx_glow').setTint(lg.tint).setScale(1.5, 2).setAlpha(0.25);
    charImage(this, x, y + 268, o, 0.5);
    txt(this, x, y + 26, o.name, 22, '#5a2a10', { origin: 0.5, title: true, stroke: 0 });
    txt(this, x, y + 54, `${CLASSES[o.cls].name} • Nv.${o.level}`, 16, '#3b2510', { origin: 0.5, stroke: 0 });
    txt(this, x, y + 292, `${lg.name} • ${o.pts} pts`, 16, '#3b2510', { origin: 0.5, stroke: 0 });
    const a = arenaData(this.c), win = arenaReward(a.pts, o.pts, true);
    txt(this, x, y + 314, a.fights < ARENA_DAILY ? `Vitória: +${win} pts` : 'Treino', 14, a.fights < ARENA_DAILY ? '#2f6b1e' : '#6a5a40', { origin: 0.5, stroke: 0 });
    button(this, x, y + 352, 180, 50, 'LUTAR', () => {
      fadeTo(this, 'ArenaBattle', { mode: 'ai', opp: Object.assign({ skill: botSkill(o) }, o), ranked: a.fights < ARENA_DAILY });
    }, { size: 21, title: true, skin: 'btn_bronze' });
  }
  // ---------- salas
  overlay() {
    const ov = []; const L = (o) => { ov.push(o.setDepth(3000 + ov.length)); return o; };
    L(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setInteractive());
    L(ui(this, W / 2 - 330, 150, 'frame_big', 660, 420));
    return { L, close: () => ov.forEach(o => o.destroy()) };
  }
  netReady(onFail) {
    if (Net.available()) return true;
    toast(this, 'Este aparelho não suporta o duelo online', COL.red); return false;
  }
  startDuel(L) {
    // troca de dados dos heróis; quando os dois tiverem o do outro, a luta começa
    const me = fighterInfo(this.c);
    let started = false;
    Net.on('hello', (d) => {
      if (started) return; started = true;
      this.waiting = false;
      if ((d.v || 0) !== 2) { toast(this, 'O amigo está com outra versão do jogo', COL.red); Net.close(); return; }
      fadeTo(this, 'ArenaBattle', { mode: 'net', opp: d.me, role: Net.role, code: Net.code });
    });
    Net.on('close', () => { if (!started) { toast(this, 'O amigo saiu da sala', COL.red); this.scene.restart(); } });
    Net.on('error', (e) => { toast(this, e.msg, COL.red); });
    Net.send('hello', { v: 2, me }); // v2 = tecla I (0.6.0)
  }
  createRoom() {
    if (!this.netReady()) return;
    const { L, close } = this.overlay();
    L(txt(this, W / 2, 196, 'Criar sala', 34, '#f3e2b8', { origin: 0.5, title: true }));
    const info = L(txt(this, W / 2, 262, 'Abrindo a sala...', 20, COL.dim, { origin: 0.5 }));
    const code = L(txt(this, W / 2, 340, '', 72, '#f2c766', { origin: 0.5, title: true, stroke: 8 }));
    const hint = L(txt(this, W / 2, 420, '', 18, COL.text, { origin: 0.5, align: 'center' }));
    const dots = L(txt(this, W / 2, 462, '', 22, COL.dim, { origin: 0.5 }));
    let n = 0; const tk = this.time.addEvent({ delay: 400, loop: true, callback: () => dots.setText('●'.repeat(1 + (n++ % 3))) });
    L(button(this, W / 2, 520, 220, 56, 'Cancelar', () => { tk.remove(); this.waiting = false; Net.close(); close(); }, { size: 20 }));
    this.waiting = true;
    Net.host().then((cd) => {
      if (!this.waiting) return;
      info.setText('Passe este código para o seu amigo:');
      code.setText(cd.split('').join(' '));
      hint.setText('Ele toca em ENTRAR na Arena e digita o código.\nA luta começa assim que ele entrar.');
      Net.on('open', () => { hint.setText('Amigo conectado! Preparando a luta...'); this.startDuel(L); });
    }).catch((e) => { info.setText(e.message).setColor('#ff8a8a'); });
  }
  joinRoom() {
    if (!this.netReady()) return;
    const { L, close } = this.overlay();
    L(txt(this, W / 2, 196, 'Entrar na sala', 34, '#f3e2b8', { origin: 0.5, title: true }));
    L(txt(this, W / 2, 256, 'Digite o código que seu amigo recebeu:', 20, COL.dim, { origin: 0.5 }));
    const dom = L(this.add.dom(W / 2, 330).createFromHTML(
      `<input id="room" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CÓDIGO" style="width:300px;height:70px;font-size:44px;letter-spacing:10px;text-transform:uppercase;border-radius:12px;border:2px solid #8a6a2f;background:#0e0c09;color:#f2c766;text-align:center;font-family:Cinzel,serif;outline:none">`));
    const msg = L(txt(this, W / 2, 400, '', 19, COL.dim, { origin: 0.5 }));
    let busy = false;
    const go = () => {
      if (busy) return;
      const el = document.getElementById('room'); const cd = (el && el.value || '').toUpperCase().trim();
      if (cd.length !== 5) { msg.setText('O código tem 5 letras/números').setColor('#ff8a8a'); return; }
      busy = true; msg.setText('Procurando a sala...').setColor(COL.dim); this.waiting = true;
      Net.join(cd).then(() => { msg.setText('Conectado! Preparando a luta...').setColor('#7dff6a'); this.startDuel(L); })
        .catch((e) => { busy = false; this.waiting = false; msg.setText(e.message).setColor('#ff8a8a'); });
    };
    setTimeout(() => { const el = document.getElementById('room'); if (el) { el.focus(); el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); } }, 50);
    L(button(this, W / 2 + 120, 500, 220, 58, 'ENTRAR', go, { size: 21, title: true, skin: 'btn_green' }));
    L(button(this, W / 2 - 120, 500, 220, 58, 'Cancelar', () => { this.waiting = false; Net.close(); close(); }, { size: 20 }));
  }
}

// ============================================================
//  LUTA NA ARENA
// ============================================================
class ArenaBattleScene extends BattleScene {
  constructor() { super('ArenaBattle'); }
  init(data) {
    this.mode = data.mode || 'ai'; this.opp = data.opp; this.ranked = !!data.ranked; this.role = data.role; this.code = data.code;
    // a mesma cena é reaproveitada na revanche: zera o estado da rodada anterior
    this.started = false; this.lastHeard = 0; this.iLeft = false; this.myRematch = false; this.otherRematch = false; this.menuUi = null; this.waitTxt = null; this.rmTxt = null; this.ping = 0;
    this.areaId = 'arena'; this.phase = 1; this.pvp = true; this.netMode = this.mode === 'net'; this.round = data.round || 1;
    this.exitLabel = 'Desistir'; this.exitTo = () => { this.togglePause(); this.finish('lose', 'Você desistiu'); };
  }
  create() {
    this.cameras.main.fadeIn(300);
    Music.play('boss');
    this.ch = Save.cur(); this.k = CLASSES[this.ch.cls]; this.st = charStats(this.ch);
    this.area = { name: 'Arena', bg: 'arena', tint: 0xffffff, fog: 0x14080a, leaves: [0xffd36b, 0xff9a3c, 0xffffff], plat: 'plat_desert' };
    this.segments = [{ list: [], boss: { name: 'Arena' } }];
    this.seg = 0; this.state = 'intro'; this.paused = false;
    this.monsters = []; this.shots = []; this.eShots = []; this.rShots = []; this.hz = []; this.hitstop = 0; this.potUsed = 0; this.revived = true;
    this.input.addPointer(3);
    for (let i = 0, x = 0; x < SEG; i++, x += W) { const im = this.add.image(x + W / 2, H / 2, 'arena').setDisplaySize(W + 2, H + 4); if (i % 2) im.setFlipX(true); }
    this.add.rectangle(SEG / 2, H / 2, SEG, H, this.area.fog, 0.18);
    this.add.particles(0, 0, 'fx_dot', { x: { min: 0, max: SEG }, y: H + 10, lifespan: 7000, speedY: { min: -40, max: -15 }, speedX: { min: -20, max: 20 },
      scale: { min: 0.2, max: 0.5 }, tint: this.area.leaves, alpha: { start: 0.7, end: 0 }, frequency: 260 }).setDepth(50);
    this.camTarget = this.add.zone(SEG / 2, H / 2, 1, 1);
    this.cameras.main.setBounds(0, 0, SEG, H);
    this.cameras.main.startFollow(this.camTarget, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(90, 400);
    this.lookAhead = 0;
    createAnims(this);
    // quem criou a sala começa na esquerda
    const leftSide = this.mode === 'ai' || this.role === 'host';
    const X1 = 640, X2 = SEG - 640;
    const p = this.makePlayer(leftSide ? X1 : X2);
    p.face = leftSide ? 1 : -1; p.maxHp = p.hp = Math.round(this.st.hp * PVP_HP);
    this.playAnim('idle', true);
    this.buildPlatforms();
    const opp = this.opp;
    if (!opp.st) opp.st = charStats(opp);
    this.rival = new Rival(this, opp, leftSide ? X2 : X1, this.mode);
    this.rival.face = leftSide ? -1 : 1;
    this.monsters.push(this.rival);
    this.stats = { t0: this.time.now, dmg: 0, paused: 0 };
    this.timeLeft = ARENA_TIME;
    this.buildHud();
    this.buildControls();
    this.camTarget.x = (p.x + this.rival.x) / 2;
    if (this.netMode) this.setupNet(); else this.countdown();
  }
  // ---------------------------------------------------------- HUD
  buildHud() {
    const c = this.ch, o = this.opp;
    this.hud(panel(this, 14, 12, 430, 112, 0.8));
    this.hud(txt(this, 32, 22, c.name, 24, COL.text, { title: true }));
    this.hud(txt(this, 424, 26, `Nv.${c.level}`, 20, COL.goldTxt, { origin: [1, 0] }));
    this.hpBar = this.hud(bar(this, 32, 62, 390, 22, 0x3fbf4a));
    this.hpTxt = this.hud(txt(this, 227, 73, '', 16, '#fff', { origin: 0.5 }));
    this.mpBar = this.hud(bar(this, 32, 94, 390, 14, 0x3d7bff));
    this.mpTxt = this.hud(txt(this, 227, 101, '', 12, '#fff', { origin: 0.5 }));
    this.ssTxt = this.hud(txt(this, 32, 132, '', 15, '#9fdfff', { origin: [0, 0.5] }));
    // adversário (direita)
    this.hud(panel(this, W - 444, 12, 430, 112, 0.8));
    this.hud(txt(this, W - 32, 22, o.name, 24, '#ff9a8a', { title: true, origin: [1, 0] }));
    this.hud(txt(this, W - 424, 26, `Nv.${o.level} • ${CLASSES[o.cls].name}`, 18, COL.goldTxt));
    this.rHpBar = this.hud(bar(this, W - 422, 62, 390, 22, 0xd43b3b));
    this.rHpTxt = this.hud(txt(this, W - 227, 73, '', 16, '#fff', { origin: 0.5 }));
    this.rMpBar = this.hud(bar(this, W - 422, 94, 390, 14, 0x3d7bff));
    // tempo
    this.timerTxt = this.hud(txt(this, W / 2, 46, String(ARENA_TIME), 48, '#ffffff', { origin: 0.5, title: true, stroke: 7 }));
    this.hud(txt(this, W / 2, 88, this.netMode ? `Duelo • Sala ${this.code || ''}` : (this.ranked ? `Arena • Liga ${leagueOf(arenaData(this.ch).pts).name}` : 'Arena • Treino'), 15, COL.goldTxt, { origin: 0.5 }));
    this.pingTxt = this.netMode ? this.hud(txt(this, W / 2, 110, '', 13, COL.dim, { origin: 0.5 })) : null;
    const pb = button(this, W / 2, 148, 64, 46, this.netMode ? '☰' : 'II', () => this.togglePause(), { size: 22 });
    this.hud(pb);
  }
  updateHud() {
    const p = this.p, r = this.rival;
    this.hpBar.set(p.hp / p.maxHp); this.hpTxt.setText(`${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`);
    this.mpBar.set(p.mp / 100); this.mpTxt.setText(p.mp >= 100 ? 'ESPECIAL PRONTO!' : `MP ${Math.floor(p.mp)}`);
    const ssn = this.ssCount(); if (this.ssTxt.text !== (ssn ? `✦ Soulshot x${ssn}` : '')) this.ssTxt.setText(ssn ? `✦ Soulshot x${ssn}` : '');
    this.rHpBar.set(r.hp / r.maxHp); this.rHpTxt.setText(`${Math.max(0, Math.ceil(r.hp))} / ${r.maxHp}`);
    this.rMpBar.set(r.mp / 100);
    const t = Math.max(0, Math.ceil(this.timeLeft));
    if (this.timerTxt.text !== String(t)) { this.timerTxt.setText(String(t)); this.timerTxt.setColor(t <= 10 ? '#ff6b6b' : '#ffffff'); }
    if (this.slots) this.slots.forEach(sl => sl.refresh());
  }

  // ---------------------------------------------------------- LOOP
  update(time, delta) {
    if (this.netMode) this.netTick(delta);
    super.update(time, delta);
  }
  // chamado pelo loop da batalha (respeita pausa e "hitstop")
  updateMonsters(dt, delta) {
    super.updateMonsters(dt, delta);
    const r = this.rival, p = this.p;
    r.update(dt, delta);
    this.updateRivalShots(dt);
    // câmera entre os dois lutadores
    this.camTarget.x = Phaser.Math.Clamp((p.x + r.x) / 2 + p.face * 60, W / 2, SEG - W / 2);
    if (p.frozen > 0) { p.frozen -= dt; if (p.frozen <= 0) { p.spr.anims.resume(); p.spr.clearTint(); } }
    if (this.state === 'play') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) this.timeUp();
    }
  }
  updateRivalShots(dt) {
    const p = this.p;
    for (const sh of this.rShots) {
      sh.s.x += sh.vx * dt; sh.s.y += sh.vy * dt; sh.life -= dt;
      if (sh.trail && Math.random() < 0.6) {
        const d = this.add.image(sh.s.x - Math.sign(sh.vx) * Phaser.Math.Between(0, 40), sh.s.y + Phaser.Math.Between(-14, 14), 'fx_dot').setTint(sh.trail).setScale(0.6).setDepth(24);
        this.tweens.add({ targets: d, alpha: 0, scale: 0.1, duration: 260, onComplete: () => d.destroy() });
      }
      if (!sh.done && !p.dead && Math.abs(sh.s.x - p.x) < 38 + sh.r && sh.s.y > p.y - 205 - sh.r && sh.s.y < p.y + 12 + sh.r) {
        const sx = sh.s.x - sh.vx * 0.05, o = { key: sh.s.texture.key, noBlock: !!sh.fixed };
        const ok = sh.fixed ? this.hurtPlayer(sh.fixed, sx, o) : sh.owner.hitPlayer(sh.mult, sx, o);
        if (ok) { if (sh.onHit) sh.onHit(sh.s.x, sh.s.y); else this.burst(sh.s.x, sh.s.y, 0xffe3a0, 5); if (!sh.pierce) sh.life = 0; sh.done = !sh.pierce ? true : sh.done; }
      }
      if (sh.life <= 0) sh.s.destroy();
    }
    this.rShots = this.rShots.filter(s => s.life > 0);
  }

  // ---------------------------------------------------------- DANO
  hitMonster(m, roll, knock, opt = {}) {
    if (!m.rival) return super.hitMonster(m, roll, knock, opt);
    if (this.state !== 'play' || m.dead) return;
    this.p.mp = Math.min(100, this.p.mp + 7);
    if (this.netMode) { // efeito na hora; o dano de verdade quem confirma é o aparelho do amigo
      if (m.dodging) return;
      if (!opt.noBlock && m.guardBlocks(opt.srcX ?? this.p.x)) { m.blockFx(); return; }
      m.spr.setTintFill(0xffffff); this.time.delayedCall(60, () => { if (m.spr.active) m.spr.clearTint(); });
      this.burst(m.x, m.y - 110, 0xffe3a0, roll.crit ? 8 : 4); Sfx.hit(); this.freeze(35);
      return;
    }
    m.takeHit(roll, knock, opt);
  }
  slowRival(m, mul, secs) { if (!this.netMode && !m.dead) { m.slowT = Math.max(m.slowT, secs); m.slowMul = mul; this.floatText(m.x, m.y - 250, 'LENTO!', '#9fdfff', 20); } }
  pushMonster(m, dir, dist) {
    if (!m.rival) return super.pushMonster(m, dir, dist);
    if (!this.netMode && !m.dead && !m.dodging && !m.guard) m.kvx = dir * dist * 7;
  }
  freezeMonster(m, secs, stun = false) {
    if (!m.rival) return super.freezeMonster(m, secs, stun);
    if (!this.netMode) m.freeze(stun ? 0.8 : secs * 0.6, stun);
  }
  freezePlayer(secs, stun = false) {
    const p = this.p;
    if (p.dead || p.action === 'special') return;
    p.frozen = secs; p.stunUntil = this.time.now + secs * 1000; p.vx = 0;
    if (p.dash) this.endDash();
    p.action = null; p.spr.anims.pause(); p.spr.setTint(stun ? 0xfff0a0 : 0x9fdfff);
    this.floatText(p.x, p.y - 230, stun ? 'ATORDOADO!' : 'CONGELADO!', stun ? '#ffe27a' : '#9fdfff', 22);
  }
  hurtPlayer(dmg, srcX, o) {
    const p = this.p, hp0 = p.hp, dodge0 = p.lastDodgeT, block0 = p.lastBlockT;
    const r = super.hurtPlayer(dmg, srcX, o);
    if (this.netMode) {
      if (p.lastBlockT !== block0) {} // bloqueou: o aviso ('refl') já foi
      else if (r) this.sendNow('hurt', { d: Math.round(hp0 - Math.max(0, p.hp)) });
      else if (p.lastDodgeT !== dodge0) this.ns('dodge');
    }
    return r;
  }
  defeat() { // a vida do jogador chegou a zero
    if (this.netMode) this.ns('ko');
    this.finish('lose');
  }
  timeUp() {
    if (this.state !== 'play') return;
    if (!this.netMode) return this.finish(this.judge());
    this.state = 'timeup';
    if (this.role === 'host') { const r = this.judge(); this.ns('end', { r: r === 'draw' ? 'draw' : r === 'win' ? 'host' : 'guest' }); this.finish(r); }
    else this.time.delayedCall(4000, () => { if (this.state === 'timeup') this.finish(this.judge()); });
  }
  judge() { // quem tem mais vida (em %) vence no tempo
    const a = this.p.hp / this.p.maxHp, b = this.rival.hp / this.rival.maxHp;
    return Math.abs(a - b) < 0.005 ? 'draw' : a > b ? 'win' : 'lose';
  }
  togglePause() {
    if (!this.netMode) return super.togglePause();
    if (this.state === 'ended') return;
    if (this.menuUi) { this.menuUi.forEach(o => o.destroy()); this.menuUi = null; this.showControls(); return; }
    this.hideControls();
    const L = (o) => { this.hud(o); this.menuUi.push(o); return o; };
    this.menuUi = [];
    L(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45));
    L(panel(this, W / 2 - 200, 220, 400, 260, 0.95));
    L(txt(this, W / 2, 262, 'Duelo', 32, COL.goldTxt, { origin: 0.5, title: true }));
    L(txt(this, W / 2, 300, '(a luta continua rolando! Sair = empate)', 15, COL.dim, { origin: 0.5 }));
    L(button(this, W / 2, 352, 260, 54, 'Voltar à luta', () => this.togglePause(), { size: 20 }));
    L(button(this, W / 2, 420, 260, 54, 'Sair da luta', () => this.leaveDuel(), { size: 20, color: 0x5a3a12 }));
  }

  // ---------------------------------------------------------- REDE (duelo)
  setupNet() {
    const r = this.rival;
    const on = (t, f) => Net.on(t, (d) => { if (d.rd !== undefined && d.rd !== this.round) return; f(d); });
    this.netT = 0; this.pingT = 0; this.ping = 0; this.ready = { me: false, other: false };
    on('s', (d) => { r.net = Object.assign(d, { at: this.time.now }); this.lastHeard = this.time.now; });
    // alguém saiu da luta (botão Sair, fechou o app ou ficou muito tempo minimizado): EMPATE
    on('quit', (d) => { if (this.state !== 'ended') this.finish('draw', d.why === 'timeout' ? 'Você ficou muito tempo fora do jogo' : `${this.opp.name} saiu do jogo`); else this.otherLeft(); });
    on('act', (d) => this.remoteAct(d));
    on('hurt', (d) => { if (!r.dead) r.showHurt(d.d, false, Math.sign(r.x - this.p.x) || 1); });
    on('dodge', () => r.showDodge());
    on('ko', () => { if (this.state === 'play' || this.state === 'timeup') this.finish('win', '', true); });
    on('end', (d) => { const me = this.role === 'host' ? 'host' : 'guest'; this.finish(d.r === 'draw' ? 'draw' : d.r === me ? 'win' : 'lose'); });
    on('ping', (d) => this.ns('pong', { at: d.at }));
    on('pong', (d) => { this.ping = Math.round(performance.now() - d.at); });
    Net.on('close', () => { if (this.state !== 'ended') this.finish('draw', `${this.opp.name} saiu do jogo`); else this.otherLeft(); });
    on('rematch', () => { this.otherRematch = true; this.tryRematch(); });
    on('ready', () => { this.ready.other = true; this.tryGo(); });
    on('go', () => { if (this.role !== 'host' && this.state === 'intro' && !this.started) { this.started = true; this.countdown(); } });
    this.waitTxt = this.hud(txt(this, W / 2, 300, 'Esperando o adversário...', 26, '#ffffff', { origin: 0.5 }));
    this.ready.me = true; this.ns('ready');
    this.tryGo();
    this.time.delayedCall(15000, () => { if (!this.started && this.state === 'intro') this.finish('draw', 'O adversário não respondeu'); });
  }
  tryGo() {
    if (this.role !== 'host' || this.started || !this.ready.me || !this.ready.other) return;
    this.started = true; this.ns('go'); this.countdown();
  }
  // 3, 2, 1, LUTEM!
  countdown() { if (this.waitTxt) { this.waitTxt.destroy(); this.waitTxt = null; } this._countdown(); }
  // sair do duelo: os dois veem EMPATE
  leaveDuel() {
    if (this.menuUi) { this.menuUi.forEach(o => o.destroy()); this.menuUi = null; }
    this.ns('quit'); this.iLeft = true;
    this.finish('draw', 'Você saiu do jogo');
    this.time.delayedCall(400, () => Net.close());
  }
  netTick(delta) {
    this.netT -= delta; this.pingT -= delta;
    if (this.netT <= 0 && this.state !== 'ended') { this.netT = 50; this.sendState(); }
    // o outro parou de mandar notícias (app minimizado / caiu a internet) por 10 s: empate
    if (this.state === 'play' && this.lastHeard && this.time.now - this.lastHeard > 10000) {
      this.ns('quit', { why: 'timeout' });
      this.finish('draw', `${this.opp.name} saiu do jogo`);
    }
    if (this.pingT <= 0) { this.pingT = 2000; this.ns('ping', { at: performance.now() }); if (this.pingTxt) this.pingTxt.setText(this.ping ? `ping ${this.ping} ms` : ''); }
  }
  sendState() {
    const p = this.p; if (!p) return;
    this.ns('s', { x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx + p.kvx), vy: Math.round(p.vy), f: p.face, g: p.ground ? 1 : 0,
      hp: Math.max(0, Math.round(p.hp)), mx: p.maxHp, mp: Math.round(p.mp), fz: p.frozen > 0 ? 1 : 0 });
  }
  sendNow(t, o) { this.sendState(); this.ns(t, o); }
  ns(t, o = {}) { Net.send(t, Object.assign({ rd: this.round }, o)); }
  emitAct(a) { if (this.netMode && this.state === 'play') this.sendNow('act', a); }
  remoteAct(d) {
    const r = this.rival;
    if (this.state !== 'play' || r.dead) return;
    if (d.x !== undefined) { r.x = d.x; r.y = d.y; }
    if (d.a === 'atk') r.doAttack(d.combo, d.face, !!d.ss);
    else if (d.a === 'sp') r.doSpecial(d.face);
    else if (d.a === 's2') r.doSkill2(d.face);
    else if (d.a === 'dash') r.doDash(d.kind, d.dir);
    else if (d.a === 's3') r.doSkill3(d.face);
    else if (d.a === 'refl') r.reflect(d.d, d.k);
  }

  // ---------------------------------------------------------- FIM
  finish(res, reason = '', ko = false) {
    if (this.state === 'ended') return;
    const wasPlay = this.state;
    this.state = 'ended';
    this.hideControls();
    if (this.menuUi) { this.menuUi.forEach(o => o.destroy()); this.menuUi = null; }
    Music.stop(500); this.clearHazards();
    const p = this.p, r = this.rival;
    if (res === 'lose') this.playerDown(); else p.vx = 0;
    if (res === 'win' && (r.hp <= 0 || ko)) r.die();
    if (this.netMode) Net.clear(['close', 'rematch', 'ping', 'pong', 's', 'quit']);
    if (res === 'win') Sfx.win(); else if (res === 'lose') this.time.delayedCall(250, () => Sfx.lose());
    // pontos e ouro (só na Arena ranqueada)
    const c = this.ch; let pts = 0, gold = 0, a = null, lg0 = null, lg1 = null;
    if (!this.netMode) {
      a = arenaData(c); lg0 = leagueOf(a.pts);
      if (this.ranked) {
        a.fights++;
        if (res !== 'draw') pts = arenaReward(a.pts, this.opp.pts, res === 'win');
        a.pts = Math.max(0, a.pts + pts); a.best = Math.max(a.best, a.pts);
        if (res === 'win') { a.w++; a.streak = (a.streak || 0) + 1; } else if (res === 'lose') { a.l++; a.streak = 0; }
        gold = res === 'win' ? 60 + c.level * 12 : res === 'draw' ? 30 + c.level * 5 : 15 + c.level * 3;
        c.gold += gold;
        a.opps = [0, 1, 2].map(i => makeBot(c, a, i)); // novos adversários depois de cada luta valendo
      }
      lg1 = leagueOf(a.pts);
      Save.write();
    }
    this.time.delayedCall(res === 'lose' ? 1100 : 900, () => {
      const L = (o) => this.hud(o);
      L(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6));
      L(panel(this, W / 2 - 320, 120, 640, 470, 0.95));
      const title = res === 'win' ? 'VITÓRIA!' : res === 'lose' ? 'DERROTA' : 'EMPATE';
      L(txt(this, W / 2, 172, title, 54, res === 'win' ? COL.goldTxt : res === 'lose' ? COL.red : '#d4dbe6', { origin: 0.5, title: true }));
      L(txt(this, W / 2, 222, reason || (wasPlay === 'timeup' || this.timeLeft <= 0 ? 'Acabou o tempo — venceu quem tinha mais vida' : `${this.ch.name} vs ${this.opp.name}`), 18, COL.dim, { origin: 0.5 }));
      let y = 276;
      if (!this.netMode) {
        if (this.ranked) {
          L(txt(this, W / 2, y, `${pts >= 0 ? '+' : ''}${pts} pontos   •   +${gold} 🪙`, 30, pts >= 0 ? '#7dff6a' : '#ff8a8a', { origin: 0.5 })); y += 46;
          L(txt(this, W / 2, y, `Liga ${lg1.name} • ${a.pts} pts`, 24, lg1.color, { origin: 0.5, title: true })); y += 40;
          if (lg1 !== lg0) L(txt(this, W / 2, y, LEAGUES.indexOf(lg1) > LEAGUES.indexOf(lg0) ? `⬆ Subiu para a Liga ${lg1.name}!` : `⬇ Caiu para a Liga ${lg1.name}`, 22, lg1.color, { origin: 0.5 }));
          y += 36;
          L(txt(this, W / 2, y, `Lutas valendo pontos hoje: ${Math.max(0, ARENA_DAILY - a.fights)}/${ARENA_DAILY}`, 17, COL.dim, { origin: 0.5 }));
        } else L(txt(this, W / 2, y + 20, 'Treino: esta luta não vale pontos', 22, COL.dim, { origin: 0.5 }));
        const pcKeys = !(this.sys.game.device.input.touch || location.search.includes('touch'));
        L(button(this, W / 2 - 150, 520, 260, 60, pcKeys ? 'ARENA (J)' : 'ARENA', () => fadeTo(this, 'Arena'), { size: 22, title: true }));
        this.keyShortcut(() => fadeTo(this, 'Arena'));
        L(button(this, W / 2 + 150, 520, 260, 60, 'VILA', () => fadeTo(this, 'Hub'), { size: 22, title: true }));
      } else {
        L(txt(this, W / 2, y + 10, 'Duelo amistoso: não vale pontos', 20, COL.dim, { origin: 0.5 }));
        this.rmTxt = L(txt(this, W / 2, y + 70, '', 19, COL.goldTxt, { origin: 0.5 }));
        this.rmBtn = L(button(this, W / 2 - 150, 520, 260, 60, 'REVANCHE', () => {
          if (!Net.open) return;
          this.myRematch = true; this.ns('rematch'); this.rmTxt.setText('Esperando o amigo aceitar a revanche...'); this.tryRematch();
        }, { size: 22, title: true, color: 0x3a4a22 }));
        L(button(this, W / 2 + 150, 520, 260, 60, 'SAIR', () => { Net.close(); fadeTo(this, 'Arena'); }, { size: 22, title: true }));
        if (this.otherRematch) this.rmTxt.setText('O amigo quer revanche!');
        if (!Net.open) this.otherLeft();
      }
    });
  }
  otherLeft() { if (this.iLeft) return; if (this.rmTxt && this.rmTxt.active) this.rmTxt.setText('O amigo saiu da sala').setColor('#ff8a8a'); }
  tryRematch() {
    if (this.state !== 'ended') return;
    if (this.rmTxt && this.rmTxt.active && !this.myRematch) this.rmTxt.setText('O amigo quer revanche!');
    if (this.myRematch && this.otherRematch) {
      Net.clear(['close']);
      fadeTo(this, 'ArenaBattle', { mode: 'net', opp: this.opp, role: this.role, code: this.code, round: this.round + 1 });
    }
  }
  playerDown() {
    const p = this.p;
    p.dead = true;
    if (p.dash) { const d = p.dash; if (d.shield) d.shield.destroy(); p.dash = null; }
    this.tweens.killTweensOf(p.spr);
    const dk = `${this.animBase}_death`;
    p.spr.setAlpha(1).setAngle(0).clearTint();
    if (hasAnim(dk)) { const mt = ANIM_META[dk]; p.spr.setOrigin(mt.ox, mt.oy); p.baseScale = mt.scale; p.spr.play(dk); p.spr.setScale(mt.scale * p.face, mt.scale); }
    else { p.spr.anims.pause(); this.tweens.add({ targets: p.spr, angle: -85 * p.face, alpha: 0.6, duration: 500 }); }
  }
}
// contagem regressiva (separada para o duelo poder chamar depois do "go")
ArenaBattleScene.prototype._countdown = function () {
  this.state = 'intro';
  const steps = ['3', '2', '1', 'LUTEM!'];
  steps.forEach((t, i) => this.time.delayedCall(250 + i * 700, () => {
    const last = i === steps.length - 1;
    const o = this.hud(txt(this, W / 2, 300, t, last ? 84 : 110, last ? '#ffd36b' : '#ffffff', { origin: 0.5, title: true, stroke: 10 })).setScale(1.6).setAlpha(0);
    this.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 180, ease: 'Back.out', hold: 380, yoyo: true, onComplete: () => o.destroy() });
    Sfx.play(last ? 'boss_roar' : 'warn', last ? 0.6 : 0.4);
    if (last && this.state === 'intro') { this.state = 'play'; this.startT = this.time.now; }
  }));
};
