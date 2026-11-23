// ============================================================
//  SAVE — personagens, mochila e progresso.
//  Com conta: guarda no aparelho e envia para a nuvem (cloud.js). Sem conta: só no aparelho.
// ============================================================
const SAVE_KEY = 'aether_save_v1';
const MAX_CHARS = 3;
const BAG_SIZE = 24;

const Save = {
  data: null,
  // save do modo offline (sem conta na nuvem)
  loadOffline() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } },
  load() {
    // com nuvem ligada, quem preenche Save.data é Cloud.afterLogin()
    if (!(typeof Cloud !== 'undefined' && Cloud.enabled)) this.data = this.loadOffline();
    if (!this.data) this.data = { account: null, chars: [], current: null, uid: 1 };
    return this.data;
  },
  write() {
    if (typeof Cloud !== 'undefined' && Cloud.user) { Cloud.saved(); return; }
    if (typeof Cloud !== 'undefined' && Cloud.enabled) return; // nuvem ligada mas sem login: não grava por cima do save offline
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
  },
  createAccount(nick) { this.data.account = { nick, diamonds: 0, created: Date.now() }; this.write(); },
  newUid() { this.data.uid = (this.data.uid || 1) + 1; return 'i' + this.data.uid; },
  makeItem(id, rarity = 'comum') { const it = { uid: this.newUid(), id, plus: 0 }; if (rarity !== 'comum') it.rarity = rarity; return it; },

  createChar(name, cls, gender) {
    if (this.data.chars.length >= MAX_CHARS) return null;
    const [w, a] = STARTER_GEAR[cls];
    const c = {
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name, cls, gender, level: 1, xp: 0, gold: 100,
      equip: { arma: this.makeItem(w), armadura: this.makeItem(a), joia: null },
      bag: [this.makeItem('s_enchant')],
      progress: { forest: 0 }, // fases concluídas por área
    };
    this.data.chars.push(c); this.data.current = c.id; this.write(); return c;
  },
  deleteChar(id) {
    this.data.chars = this.data.chars.filter(c => c.id !== id);
    if (this.data.current === id) this.data.current = null;
    this.write();
  },
  cur() { return this.data.chars.find(c => c.id === this.data.current) || null; },
  select(id) { this.data.current = id; this.write(); },
};

// Atributos de um item considerando o encantamento (+12% por nível, mínimo +1)
function itemStats(inst) {
  const d = ITEMS[inst.id]; const out = {};
  for (const k of ['hp', 'atk', 'def', 'crit']) {
    if (!d[k]) continue;
    const base = Math.round(d[k] * (RARITY[inst.rarity || 'comum'] || RARITY.comum).mul * 10) / 10; // raridade multiplica o atributo
    out[k] = Math.round((base + (inst.plus ? Math.max(inst.plus, d[k] * 0.12 * inst.plus) : 0)) * 10) / 10;
    if (k !== 'crit') out[k] = Math.round(out[k]);
  }
  return out;
}
function itemLabel(inst) { return ITEMS[inst.id].name + (inst.plus ? ' +' + inst.plus : ''); }
function itemColor(inst) { return (RARITY[inst.rarity || 'comum'] || RARITY.comum).color; }
function canEquip(c, inst) {
  const d = ITEMS[inst.id];
  if (d.slot === 'pergaminho' || d.slot === 'consumivel') return { ok: false, why: 'Não equipável' };
  if (d.type !== 'any' && d.type !== CLASSES[c.cls].gearType)
    return { ok: false, why: `Só ${CLASSES[c.cls].name} pode usar ${GEAR_TYPE_LABEL[CLASSES[c.cls].gearType]}` };
  if (c.level < d.lvl) return { ok: false, why: `Requer nível ${d.lvl}` };
  return { ok: true };
}

// Status final do personagem (base + nível + equipamentos)
function charStats(c) {
  const k = CLASSES[c.cls], L = c.level - 1;
  const s = {
    hp: Math.round(k.base.hp + k.perLevel.hp * L),
    atk: Math.round(k.base.atk + k.perLevel.atk * L),
    def: Math.round(k.base.def + k.perLevel.def * L),
    crit: +(k.base.crit + k.perLevel.crit * L).toFixed(1),
  };
  for (const slot of ['arma', 'armadura', 'joia']) {
    const it = c.equip[slot]; if (!it) continue;
    const st = itemStats(it); for (const key in st) s[key] += st[key];
  }
  s.crit = Math.min(60, +s.crit.toFixed(1));
  return s;
}

// Aplica EXP; retorna quantos níveis subiu
function addXp(c, amount) {
  let ups = 0; c.xp += amount;
  while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) { c.xp -= xpToNext(c.level); c.level++; ups++; }
  return ups;
}

// ---------- Mochila: tamanho, empilhar consumíveis
function bagCap(c) { return Math.min(BAG_MAX, BAG_SIZE + (c.bagExtra || 0)); }
function isStack(id) { return ITEMS[id] && ITEMS[id].slot === 'consumivel'; }
function countItem(c, id) { return c.bag.filter(b => b.id === id).reduce((n, b) => n + (b.qty || 1), 0); }
// cabe na mochila? (consumível empilha num espaço só)
function bagFits(c, id, n = 1) {
  if (isStack(id) && c.bag.some(b => b.id === id)) return true;
  return c.bag.length + (isStack(id) ? 1 : n) <= bagCap(c);
}
function addItem(c, id, opts = {}) {
  const n = opts.qty || 1;
  if (isStack(id)) {
    const st = c.bag.find(b => b.id === id);
    if (st) { st.qty = (st.qty || 1) + n; return st; }
    if (c.bag.length >= bagCap(c)) return null;
    const it = Save.makeItem(id); it.qty = n; c.bag.push(it); return it;
  }
  let last = null;
  for (let i = 0; i < n; i++) {
    if (c.bag.length >= bagCap(c)) break;
    const it = Save.makeItem(id, opts.rarity || 'comum'); if (opts.plus) it.plus = opts.plus;
    c.bag.push(it); last = it;
  }
  return last;
}
function takeItem(c, id) {
  const it = c.bag.find(b => b.id === id); if (!it) return false;
  if ((it.qty || 1) > 1) it.qty--; else c.bag.splice(c.bag.indexOf(it), 1);
  return true;
}

// ---------- Diamantes (da conta, valem para todos os personagens)
// Com conta na nuvem quem decide é o servidor (preço e recompensas conferidos lá).
const Wallet = {
  gems() { return (Save.data.account && Save.data.account.diamonds) || 0; },
  set(v) { if (Save.data.account) Save.data.account.diamonds = Math.max(0, v | 0); },
  // compra um item da Loja Premium; devolve { ok } ou { error }
  async spend(shopId, gems) {
    if (gems > this.gems()) return { error: 'Diamantes insuficientes' };
    if (typeof Cloud !== 'undefined' && Cloud.user) {
      const r = await Cloud.buyPremium(shopId);
      if (r.error) return r;
      this.set(r.balance);
    } else this.set(this.gems() - gems);
    Save.write();
    return { ok: true };
  },
  // recompensa por jogar (uma vez por chave): kind = star | area | level
  async earn(kind, key) {
    const claims = Save.data.claims || (Save.data.claims = {});
    const k = kind + ':' + key;
    if (claims[k]) return 0;
    const amount = GEM_REWARDS[kind] || 0;
    if (typeof Cloud !== 'undefined' && Cloud.user) {
      const r = await Cloud.claimReward(kind, key);
      if (r.error) return 0;
      claims[k] = 1; this.set(r.balance); Save.write();
      return r.added;
    }
    claims[k] = 1; this.set(this.gems() + amount); Save.write();
    return amount;
  },
};
