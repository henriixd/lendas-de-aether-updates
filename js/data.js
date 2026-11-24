// ============================================================
//  DADOS DO JOGO — classes, itens, áreas, progressão
//  Tudo que é "balanceamento" fica aqui para ajustar fácil.
// ============================================================

const GAME_TITLE = 'Lendas de Eldrin'; // nome do jogo (até a v0.5.8 era 'Lendas de Aether')
const GAME_VERSION = '0.5.9'; // tools/make_update.py atualiza sozinho
const SOULSHOT_MULT = 1.25; // Soulshot: +25% de dano no ataque básico (gasta 1 por ataque)
const DASH_COOLDOWN = 4000; // ms entre um desvio (Espaço) e outro — vale para todas as classes
const W = 1280, H = 720, GROUND_Y = 590;

const CLASSES = {
  warrior: {
    id: 'warrior', name: 'Guerreiro', weapon: 'Espada e Escudo', gearType: 'pesada',
    desc: 'Linha de frente. Muita vida e defesa (Pele de Ferro: recebe 25% menos dano), golpes corpo a corpo fortes.',
    base: { hp: 110, atk: 14, def: 10, crit: 5 },
    perLevel: { hp: 20, atk: 3, def: 3, crit: 0.3 },
    attack: { kind: 'melee', range: 175, cooldown: 430, mult: 1.0 },
    skill: { name: 'Escudada', mult: 2.6, stun: 1.0 },
    dmgTaken: 0.75, // Pele de Ferro
    originX: 0.58, color: 0xc0392b,
  },
  hunter: {
    id: 'hunter', name: 'Caçador', weapon: 'Arco e Flecha', gearType: 'leve',
    desc: 'Ataca de longe com flechas rápidas. Alta chance de crítico.',
    base: { hp: 100, atk: 12, def: 5, crit: 12 },
    perLevel: { hp: 11, atk: 3, def: 1, crit: 0.6 },
    attack: { kind: 'arrow', range: 900, cooldown: 360, mult: 0.85 },
    skill: { name: 'Chuva de Flechas', mult: 1.6, count: 5 },
    originX: 0.5, color: 0x27ae60,
  },
  mage: {
    id: 'mage', name: 'Mago', weapon: 'Cajado Mágico', gearType: 'magica',
    desc: 'Orbes arcanos de alto dano e magias em área. Pouca defesa.',
    base: { hp: 100, atk: 17, def: 4, crit: 8 },
    perLevel: { hp: 9, atk: 4, def: 1, crit: 0.4 },
    attack: { kind: 'orb', range: 800, cooldown: 620, mult: 1.15 },
    skill: { name: 'Bola de Fogo', mult: 3.4 },
    originX: 0.55, color: 0x8e44ad,
  },
};

// raridade dos itens que caem dos monstros (loja vende só Comum)
const RARITY = {
  comum: { name: 'Comum', mul: 1, color: '#e8dfc8', glow: null },
  raro:  { name: 'Raro', mul: 1.25, color: '#62a8ff', glow: 0x3d7bff },
  epico: { name: 'Épico', mul: 1.55, color: '#c77dff', glow: 0xa64dff },
};
// bonus: chance extra (3 estrelas, chefe final...)
function rollRarity(bonus = 0) {
  const r = Math.random();
  if (r < 0.07 + bonus) return 'epico';
  if (r < 0.35 + bonus * 2) return 'raro';
  return 'comum';
}
// ---------------- Habilidades por classe (árvore simples: nível 1 / 3 / 5)
// K = Especial (100 MP) • L = Habilidade (35 MP) • nível 5 = Maestria (passiva)
const CLASS_SKILLS = {
  warrior: [
    { lvl: 1, key: 'K', name: 'Escudada', desc: 'Avança com o escudo e acerta todos à frente: dano alto e deixa atordoado por 1 segundo (chefes também). Custa 100 MP.' },
    { lvl: 3, key: 'L', name: 'Investida de Escudo', desc: 'Avança com o escudo atravessando os inimigos: dano alto e quebra o ataque deles. 35 MP.' },
    { lvl: 5, key: '', name: 'Fúria', desc: 'Passiva: o 3º golpe do combo solta uma onda de choque pelo chão.' },
  ],
  hunter: [
    { lvl: 1, key: 'K', name: 'Chuva de Flechas', desc: 'Rajada de flechas que atravessam os inimigos. Custa 100 MP.' },
    { lvl: 3, key: 'L', name: 'Flecha Explosiva', desc: 'Flecha que explode no impacto, acertando todos por perto. 35 MP.' },
    { lvl: 5, key: '', name: 'Tiro Triplo', desc: 'Passiva: o 3º disparo do combo solta três flechas em leque.' },
  ],
  mage: [
    { lvl: 1, key: 'K', name: 'Bola de Fogo', desc: 'Bola de fogo gigante que atravessa a tela. Custa 100 MP.' },
    { lvl: 3, key: 'L', name: 'Prisão de Gelo', desc: 'Esfera de gelo que congela os inimigos atingidos por 2 segundos. 35 MP.' },
    { lvl: 5, key: '', name: 'Teleporte Arcano', desc: 'Passiva: o teleporte explode em energia arcana na saída e na chegada.' },
  ],
};
const SKILL2_MP = 35;
// ícones (assets/skills/<classe>_<tipo>.png): k = especial, l = habilidade, p = passiva, dash = esquiva
const SKILL_ICON_KINDS = ['k', 'l', 'p', 'dash'];
// ---------------- Loja Premium (diamantes 💎)
// gems = preço em diamantes. O servidor confere o mesmo preço (supabase/migrations/002).
// Itens são fixos (sem sorteio): o jogador sabe exatamente o que está comprando.
const PREMIUM_SHOP = {
  equip: [
    { id: 'p_dragonblade', gems: 120, cls: 'warrior' }, { id: 'p_lionplate', gems: 140, cls: 'warrior' },
    { id: 'p_stormbow', gems: 120, cls: 'hunter' }, { id: 'p_shadowcloak', gems: 140, cls: 'hunter' },
    { id: 'p_starstaff', gems: 120, cls: 'mage' }, { id: 'p_archrobe', gems: 140, cls: 'mage' },
    { id: 'p_phoenixamulet', gems: 100 },
  ],
  items: [
    { id: 'c_potion', gems: 15, qty: 3, name: '3 Poções de Vida' },
    { id: 'c_phoenix', gems: 40 },
    { id: 's_blessed', gems: 30 },
    { id: 'c_xp', gems: 35 },
    { id: 'c_gold', gems: 20 },
    { id: 'bag_plus', gems: 60, name: 'Mochila +8 espaços', info: 'Aumenta a mochila deste personagem em 8 espaços (até 40).', service: true },
  ],
  // pacotes de diamantes (dinheiro real, pela Google Play — liga quando o app estiver publicado)
  packs: [
    { id: 'gems_100', gems: 100, price: 'R$ 4,90', icon: 'gems_s' },
    { id: 'gems_550', gems: 550, bonus: '+10% bônus', price: 'R$ 19,90', icon: 'gems_m' },
    { id: 'gems_1200', gems: 1200, bonus: '+20% bônus', price: 'R$ 39,90', icon: 'gems_l', best: true },
  ],
};
const PREMIUM_ICONS = ['p_dragonblade', 'p_stormbow', 'p_starstaff', 'p_lionplate', 'p_shadowcloak', 'p_archrobe', 'p_phoenixamulet',
  'c_potion', 'c_phoenix', 's_blessed', 'c_xp', 'c_gold', 'bag_plus', 'gems_s', 'gems_m', 'gems_l'];
const BAG_MAX = 40;
const POTION_LIMIT = 3; // poções por fase
// Diamantes ganhos jogando (cada um só uma vez por conta):
//  cada estrela nova em uma fase = 2 💎 · conquistar uma área (chefe final) = 25 💎 · subir de nível = 5 💎
const GEM_REWARDS = { star: 2, area: 25, level: 5 };
const GEAR_TYPE_LABEL = { pesada: 'Pesada', leve: 'Leve', magica: 'Mágica', any: 'Qualquer' };
const SLOT_LABEL = { arma: 'Arma', armadura: 'Armadura', joia: 'Joia', pergaminho: 'Pergaminho', consumivel: 'Consumível' };

// type: pesada/leve/magica (restrição de classe) — joias e pergaminhos: 'any'
const ITEMS = {
  // ---------- iniciais
  w_train_sword: { name: 'Espada de Treino', slot: 'arma', type: 'pesada', atk: 4, price: 40, lvl: 1 },
  w_train_bow:   { name: 'Arco de Treino', slot: 'arma', type: 'leve', atk: 4, crit: 1, price: 40, lvl: 1 },
  w_train_staff: { name: 'Cajado de Aprendiz', slot: 'arma', type: 'magica', atk: 5, price: 40, lvl: 1 },
  a_chain:       { name: 'Cota de Malha', slot: 'armadura', type: 'pesada', def: 10, price: 40, lvl: 1 },
  a_leather:     { name: 'Gibão de Couro', slot: 'armadura', type: 'leve', def: 3, crit: 2, price: 40, lvl: 1 },
  a_robe:        { name: 'Manto de Aprendiz', slot: 'armadura', type: 'magica', def: 2, atk: 1, price: 40, lvl: 1 },
  // ---------- loja
  w_longsword:   { name: 'Espada Longa', slot: 'arma', type: 'pesada', atk: 10, price: 260, lvl: 2, shop: true },
  w_recurve:     { name: 'Arco Recurvo', slot: 'arma', type: 'leve', atk: 9, crit: 3, price: 260, lvl: 2, shop: true },
  w_oakstaff:    { name: 'Cajado de Carvalho', slot: 'arma', type: 'magica', atk: 11, price: 260, lvl: 2, shop: true },
  a_plate:       { name: 'Armadura de Placas', slot: 'armadura', type: 'pesada', def: 25, hp: 30, price: 300, lvl: 3, shop: true },
  a_hardleather: { name: 'Couro Reforçado', slot: 'armadura', type: 'leve', def: 7, hp: 15, crit: 3, price: 300, lvl: 3, shop: true },
  a_arcane:      { name: 'Túnica Arcana', slot: 'armadura', type: 'magica', def: 5, hp: 20, atk: 3, price: 300, lvl: 3, shop: true },
  j_ring_str:    { name: 'Anel de Força', slot: 'joia', type: 'any', atk: 3, price: 180, lvl: 1, shop: true },
  j_amulet_life: { name: 'Amuleto da Vida', slot: 'joia', type: 'any', hp: 25, price: 180, lvl: 1, shop: true },
  j_earring:     { name: 'Brinco do Falcão', slot: 'joia', type: 'any', crit: 5, price: 220, lvl: 2, shop: true },
  s_enchant:     { name: 'Pergaminho de Encantamento', slot: 'pergaminho', type: 'any', price: 120, lvl: 1, shop: true,
                   info: 'Encanta arma/armadura/joia equipada: +1 nível (+12% dos atributos).' },
  // ---------- drops da Floresta Sombria
  w_thornblade:  { name: 'Lâmina de Espinhos', slot: 'arma', type: 'pesada', atk: 14, crit: 2, price: 420, lvl: 4, drop: true },
  w_shadowbow:   { name: 'Arco das Sombras', slot: 'arma', type: 'leve', atk: 13, crit: 5, price: 420, lvl: 4, drop: true },
  w_rootstaff:   { name: 'Cajado de Raiz Ancestral', slot: 'arma', type: 'magica', atk: 16, price: 420, lvl: 4, drop: true },
  j_moss_ring:   { name: 'Anel de Musgo', slot: 'joia', type: 'any', hp: 15, def: 2, price: 200, lvl: 1, drop: true },
  // ---------- drops do Pântano Venenoso (nível 5+)
  w_venomblade:  { name: 'Espada Peçonhenta', slot: 'arma', type: 'pesada', atk: 22, crit: 3, price: 700, lvl: 6, drop: 'swamp' },
  w_reedbow:     { name: 'Arco de Junco Negro', slot: 'arma', type: 'leve', atk: 20, crit: 7, price: 700, lvl: 6, drop: 'swamp' },
  w_bogstaff:    { name: 'Cajado do Lodo', slot: 'arma', type: 'magica', atk: 25, price: 700, lvl: 6, drop: 'swamp' },
  a_scalemail:   { name: 'Cota de Escamas', slot: 'armadura', type: 'pesada', def: 42, hp: 55, price: 650, lvl: 7, drop: 'swamp' },
  a_toadhide:    { name: 'Couro de Sapo', slot: 'armadura', type: 'leve', def: 12, hp: 35, crit: 4, price: 650, lvl: 7, drop: 'swamp' },
  a_mirerobe:    { name: 'Manto do Pântano', slot: 'armadura', type: 'magica', def: 9, hp: 40, atk: 5, price: 650, lvl: 7, drop: 'swamp' },
  j_fang:        { name: 'Presa Venenosa', slot: 'joia', type: 'any', atk: 6, crit: 3, price: 420, lvl: 5, drop: 'swamp' },
  // ---------- drops das Cavernas de Cristal (nível 10+)
  w_crystalblade:{ name: 'Montante de Quartzo', slot: 'arma', type: 'pesada', atk: 32, crit: 4, price: 1200, lvl: 12, drop: 'caves' },
  w_prismbow:    { name: 'Arco Prismático', slot: 'arma', type: 'leve', atk: 29, crit: 9, price: 1200, lvl: 12, drop: 'caves' },
  w_geodestaff:  { name: 'Cajado de Geodo', slot: 'arma', type: 'magica', atk: 36, crit: 2, price: 1200, lvl: 12, drop: 'caves' },
  a_golemplate:  { name: 'Couraça de Golem', slot: 'armadura', type: 'pesada', def: 62, hp: 90, price: 1100, lvl: 14, drop: 'caves' },
  a_minervest:   { name: 'Colete do Mineiro', slot: 'armadura', type: 'leve', def: 18, hp: 60, crit: 6, price: 1100, lvl: 14, drop: 'caves' },
  a_gemrobe:     { name: 'Manto de Gemas', slot: 'armadura', type: 'magica', def: 14, hp: 65, atk: 8, price: 1100, lvl: 14, drop: 'caves' },
  j_geode:       { name: 'Anel de Geodo', slot: 'joia', type: 'any', hp: 45, def: 5, crit: 3, price: 800, lvl: 11, drop: 'caves' },
  // ---------- drops do Deserto Escarlate (nível 20+)
  w_sunsaber:    { name: 'Sabre do Sol', slot: 'arma', type: 'pesada', atk: 46, crit: 5, price: 2000, lvl: 22, drop: 'desert' },
  w_stingbow:    { name: 'Arco do Ferrão', slot: 'arma', type: 'leve', atk: 42, crit: 12, price: 2000, lvl: 22, drop: 'desert' },
  w_pharaohstaff:{ name: 'Cetro do Faraó', slot: 'arma', type: 'magica', atk: 52, crit: 3, price: 2000, lvl: 22, drop: 'desert' },
  a_sandplate:   { name: 'Armadura Escarlate', slot: 'armadura', type: 'pesada', def: 90, hp: 140, price: 1900, lvl: 24, drop: 'desert' },
  a_dunecloak:   { name: 'Capa das Dunas', slot: 'armadura', type: 'leve', def: 26, hp: 95, crit: 8, price: 1900, lvl: 24, drop: 'desert' },
  a_tombrobe:    { name: 'Túnica da Tumba', slot: 'armadura', type: 'magica', def: 20, hp: 100, atk: 12, price: 1900, lvl: 24, drop: 'desert' },
  j_scarab:      { name: 'Escaravelho Dourado', slot: 'joia', type: 'any', atk: 10, crit: 5, hp: 40, price: 1400, lvl: 21, drop: 'desert' },
  // ---------- drops dos Picos Gelados (nível 30+)
  w_frostbrand:  { name: 'Espada Glacial', slot: 'arma', type: 'pesada', atk: 64, crit: 6, price: 3000, lvl: 32, drop: 'peaks' },
  w_frostbow:    { name: 'Arco da Nevasca', slot: 'arma', type: 'leve', atk: 58, crit: 14, price: 3000, lvl: 32, drop: 'peaks' },
  w_icestaff:    { name: 'Cajado do Inverno', slot: 'arma', type: 'magica', atk: 72, crit: 4, price: 3000, lvl: 32, drop: 'peaks' },
  a_frostplate:  { name: 'Armadura Glacial', slot: 'armadura', type: 'pesada', def: 125, hp: 195, price: 2800, lvl: 34, drop: 'peaks' },
  a_furcoat:     { name: 'Casaco de Pele de Lobo', slot: 'armadura', type: 'leve', def: 36, hp: 135, crit: 10, price: 2800, lvl: 34, drop: 'peaks' },
  a_snowrobe:    { name: 'Manto da Nevasca', slot: 'armadura', type: 'magica', def: 28, hp: 140, atk: 17, price: 2800, lvl: 34, drop: 'peaks' },
  j_frostgem:    { name: 'Lágrima de Gelo', slot: 'joia', type: 'any', atk: 14, crit: 6, hp: 58, price: 2100, lvl: 31, drop: 'peaks' },
  // ---------- drops da Cidadela Infernal (nível 40+)
  w_hellblade:   { name: 'Lâmina Infernal', slot: 'arma', type: 'pesada', atk: 86, crit: 7, price: 4500, lvl: 42, drop: 'citadel' },
  w_emberbow:    { name: 'Arco de Brasa', slot: 'arma', type: 'leve', atk: 78, crit: 16, price: 4500, lvl: 42, drop: 'citadel' },
  w_demonstaff:  { name: 'Cetro Demoníaco', slot: 'arma', type: 'magica', atk: 97, crit: 5, price: 4500, lvl: 42, drop: 'citadel' },
  a_demonplate:  { name: 'Couraça Demoníaca', slot: 'armadura', type: 'pesada', def: 165, hp: 260, price: 4200, lvl: 44, drop: 'citadel' },
  a_ashcloak:    { name: 'Capa de Cinzas', slot: 'armadura', type: 'leve', def: 48, hp: 180, crit: 12, price: 4200, lvl: 44, drop: 'citadel' },
  a_flamerobe:   { name: 'Túnica das Chamas', slot: 'armadura', type: 'magica', def: 37, hp: 190, atk: 23, price: 4200, lvl: 44, drop: 'citadel' },
  j_hellheart:   { name: 'Coração de Magma', slot: 'joia', type: 'any', atk: 19, crit: 7, hp: 78, price: 3200, lvl: 41, drop: 'citadel' },
  // ---------- drops do Abismo do Vazio (nível 50+)
  w_voidblade:   { name: 'Espada do Vazio', slot: 'arma', type: 'pesada', atk: 112, crit: 8, price: 6500, lvl: 52, drop: 'abyss' },
  w_eclipsebow:  { name: 'Arco do Eclipse', slot: 'arma', type: 'leve', atk: 102, crit: 18, price: 6500, lvl: 52, drop: 'abyss' },
  w_voidstaff:   { name: 'Cajado do Abismo', slot: 'arma', type: 'magica', atk: 126, crit: 6, price: 6500, lvl: 52, drop: 'abyss' },
  a_voidplate:   { name: 'Armadura do Abismo', slot: 'armadura', type: 'pesada', def: 210, hp: 340, price: 6000, lvl: 54, drop: 'abyss' },
  a_wraithcloak: { name: 'Manto Espectral', slot: 'armadura', type: 'leve', def: 62, hp: 235, crit: 14, price: 6000, lvl: 54, drop: 'abyss' },
  a_eclipserobe: { name: 'Túnica do Eclipse', slot: 'armadura', type: 'magica', def: 48, hp: 245, atk: 30, price: 6000, lvl: 54, drop: 'abyss' },
  j_voideye:     { name: 'Olho do Vazio', slot: 'joia', type: 'any', atk: 25, crit: 8, hp: 100, price: 4600, lvl: 51, drop: 'abyss' },
  // ---------- Loja Premium (diamantes): já vêm Épicos e encantados +3
  p_dragonblade:   { name: 'Lâmina do Dragão', slot: 'arma', type: 'pesada', atk: 18, crit: 4, price: 900, lvl: 3, premium: true, look: '🔥 Rastro de fogo nos golpes' },
  p_stormbow:      { name: 'Arco da Tempestade', slot: 'arma', type: 'leve', atk: 16, crit: 9, price: 900, lvl: 3, premium: true, look: '⚡ Flechas com raios' },
  p_starstaff:     { name: 'Cajado Estelar', slot: 'arma', type: 'magica', atk: 20, crit: 2, price: 900, lvl: 3, premium: true, look: '✨ Brilho de estrelas no cajado' },
  p_lionplate:     { name: 'Armadura do Leão', slot: 'armadura', type: 'pesada', def: 32, hp: 50, price: 900, lvl: 4, premium: true, look: '👑 Muda o visual do personagem' },
  p_shadowcloak:   { name: 'Manto das Sombras', slot: 'armadura', type: 'leve', def: 9, hp: 35, crit: 5, price: 900, lvl: 4, premium: true, look: '👑 Muda o visual do personagem' },
  p_archrobe:      { name: 'Túnica do Arquimago', slot: 'armadura', type: 'magica', def: 7, hp: 35, atk: 5, price: 900, lvl: 4, premium: true, look: '👑 Muda o visual do personagem' },
  p_phoenixamulet: { name: 'Amuleto da Fênix', slot: 'joia', type: 'any', hp: 40, atk: 4, crit: 3, price: 700, lvl: 2, premium: true, look: '🔥 Aura de brasas' },
  // ---------- consumíveis
  c_soulshot: { name: 'Soulshot', slot: 'consumivel', type: 'any', price: 100, lvl: 1, shop: true, shopQty: 100, use: 'auto',
    info: '100 cargas. Cada ataque gasta 1: +25% de dano e pó mágico na arma (automático).' },
  c_potion:  { name: 'Poção de Vida', slot: 'consumivel', type: 'any', price: 60, lvl: 1, shop: true, use: 'battle', info: 'Na batalha (tecla Q ou botão da poção): recupera 40% da vida. Até 3 por fase.' },
  c_phoenix: { name: 'Pena da Fênix', slot: 'consumivel', type: 'any', price: 200, lvl: 1, use: 'auto', info: 'Se você cair na batalha, revive na hora com 50% da vida (gasta 1 pena).' },
  s_blessed: { name: 'Pergaminho Abençoado', slot: 'pergaminho', type: 'any', price: 240, lvl: 1, info: 'Encanta o item equipado: +1 nível com 100% de sucesso (até +10).' },
  c_xp:      { name: 'Elixir da Sabedoria', slot: 'consumivel', type: 'any', price: 150, lvl: 1, use: 'bag', info: 'Use na mochila: EXP em dobro nas próximas 3 fases vencidas.' },
  c_gold:    { name: 'Saco de Ouro', slot: 'consumivel', type: 'any', price: 250, lvl: 1, use: 'bag', info: 'Use na mochila: recebe 1500 de ouro.' },
};

const STARTER_GEAR = {
  warrior: ['w_train_sword', 'a_chain'],
  hunter: ['w_train_bow', 'a_leather'],
  mage: ['w_train_staff', 'a_robe'],
};

// ---------------- Áreas do Modo Aventura
// tier = "dificuldade base" da área (a fase N da área vale como fase tier+N no cálculo dos monstros)
const AREAS = [
  { id: 'forest', name: 'Floresta Sombria', minLvl: 1, maxLvl: 5, phases: 10, bg: 'forest', tint: 0xb8c8c0, ready: true, tier: 0, music: 'forest',
    fog: 0x0a1410, leaves: [0x6b8f3a, 0x9a7a32, 0x4f6b2a], plat: 'plat_forest' },
  { id: 'swamp',  name: 'Pântano Venenoso', minLvl: 5, maxLvl: 10, phases: 10, bg: 'swamp', tint: 0xc8d0c0, ready: true, tier: 10, music: 'swamp',
    fog: 0x0c140a, leaves: [0x8fd34a, 0x5fa83a, 0xb3e26a], plat: 'plat_swamp', rising: true },
  { id: 'caves',  name: 'Cavernas de Cristal', minLvl: 10, maxLvl: 20, phases: 10, bg: 'caves', tint: 0xc8c8d8, ready: true, tier: 20, music: 'caves',
    fog: 0x080a18, leaves: [0x7fe8ff, 0xb48cff, 0xe0f4ff], plat: 'plat_caves', rising: true },
  { id: 'desert', name: 'Deserto Escarlate', minLvl: 20, maxLvl: 30, phases: 10, bg: 'desert', tint: 0xe0d0c8, ready: true, tier: 30, music: 'desert',
    fog: 0x1a0c06, leaves: [0xe0a060, 0xc87a40, 0xf0c890], plat: 'plat_desert' },
  { id: 'peaks',  name: 'Picos Gelados', minLvl: 30, maxLvl: 40, phases: 10, bg: 'peaks', tint: 0xe4ecf4, ready: true, tier: 40, music: 'peaks',
    fog: 0x0a1424, leaves: [0xffffff, 0xe4f2ff, 0xc8e0f8], plat: 'plat_peaks', snow: true },          // neve caindo
  { id: 'citadel',name: 'Cidadela Infernal', minLvl: 40, maxLvl: 50, phases: 10, bg: 'citadel', tint: 0xe8d8d0, ready: true, tier: 50, music: 'citadel',
    fog: 0x1a0604, leaves: [0xff8a3c, 0xffc040, 0xff4020], plat: 'plat_citadel', rising: true },       // brasas subindo
  { id: 'abyss',  name: 'Abismo do Vazio', minLvl: 50, maxLvl: 60, phases: 10, bg: 'abyss', tint: 0xe0d4e8, ready: true, tier: 60, music: 'abyss',
    fog: 0x0e0618, leaves: [0xc080ff, 0xff80e0, 0x8040ff], plat: 'plat_abyss', rising: true },
];
const areaById = (id) => AREAS.find(a => a.id === id) || AREAS[0];

// ---------------- Monstros (sprites em assets/monsters)
const MONSTERS = {
  goblin:   { name: 'Goblin', key: 'm_goblin', speed: 230,  range: 95,  scale: 1, hpMul: 1.0, dmgMul: 1.0 },
  wolf:     { name: 'Lobo Sombrio', key: 'm_wolf', speed: 320, range: 105, scale: 1, hpMul: 0.85, dmgMul: 1.1 },
  mushroom: { name: 'Cogumelo Venenoso', key: 'm_mushroom', speed: 175, range: 95, scale: 1, hpMul: 1.25, dmgMul: 1.0 },
  treant:   { name: 'Raiz Viva', key: 'm_treant', speed: 135, range: 120, scale: 1, hpMul: 1.5, dmgMul: 1.15 },
  // Pântano Venenoso
  toad:     { name: 'Sapo Venenoso', key: 'm_toad', speed: 250, range: 110, scale: 1, hpMul: 0.95, dmgMul: 1.1 },
  slime:    { name: 'Lodo Tóxico', key: 'm_slime', speed: 150, range: 95, scale: 1, hpMul: 1.3, dmgMul: 0.95 },
  lizard:   { name: 'Guerreiro Escamado', key: 'm_lizard', speed: 240, range: 140, scale: 1, hpMul: 1.15, dmgMul: 1.15 },
  // Cavernas de Cristal
  golem:    { name: 'Golem de Cristal', key: 'm_golem', speed: 150, range: 125, scale: 1, hpMul: 1.6, dmgMul: 1.2 },
  miner:    { name: 'Goblin Mineiro', base: 'goblin', speed: 250, range: 95, scale: 1, hpMul: 1.05, dmgMul: 1.05 },
  crystal:  { name: 'Lodo de Cristal', base: 'slime', speed: 160, range: 95, scale: 1, hpMul: 1.35, dmgMul: 1.0 },
  // Deserto Escarlate
  scorpion: { name: 'Escorpião Rubro', key: 'm_scorpion', speed: 270, range: 130, scale: 1, hpMul: 1.1, dmgMul: 1.2 },
  skeleton: { name: 'Esqueleto Guerreiro', key: 'm_skeleton', speed: 235, range: 115, scale: 1, hpMul: 1.0, dmgMul: 1.15 },
  jackal:   { name: 'Chacal das Dunas', base: 'wolf', speed: 330, range: 105, scale: 1, hpMul: 0.9, dmgMul: 1.15 },
  raider:   { name: 'Saqueador das Areias', base: 'lizard', speed: 245, range: 140, scale: 1, hpMul: 1.2, dmgMul: 1.2 },
  // Picos Gelados (um pouco mais fortes que o normal: +10% vida, +25% dano)
  snowgoblin: { name: 'Goblin das Neves', base: 'goblin', speed: 245, range: 95, scale: 1, hpMul: 1.1, dmgMul: 1.25 },
  frostwolf:  { name: 'Lobo da Nevasca', base: 'wolf', speed: 335, range: 105, scale: 1, hpMul: 0.95, dmgMul: 1.4 },
  icegolem:   { name: 'Golem de Gelo', base: 'golem', speed: 150, range: 125, scale: 1, hpMul: 1.75, dmgMul: 1.5 },
  frostbones: { name: 'Esqueleto Congelado', base: 'skeleton', speed: 240, range: 115, scale: 1, hpMul: 1.1, dmgMul: 1.45 },
  // Cidadela Infernal (+20% vida, +50% dano)
  imp:         { name: 'Diabrete', base: 'goblin', speed: 270, range: 95, scale: 1, hpMul: 1.2, dmgMul: 1.5 },
  hellhound:   { name: 'Cão Infernal', base: 'wolf', speed: 345, range: 105, scale: 1, hpMul: 1.0, dmgMul: 1.65 },
  demonknight: { name: 'Cavaleiro Demoníaco', base: 'lizard', speed: 250, range: 140, scale: 1, hpMul: 1.4, dmgMul: 1.7 },
  magmagolem:  { name: 'Golem de Magma', base: 'golem', speed: 155, range: 125, scale: 1, hpMul: 1.9, dmgMul: 1.8 },
  // Abismo do Vazio (+30% vida, +75% dano)
  voidscorp:  { name: 'Escorpião do Vazio', base: 'scorpion', speed: 280, range: 130, scale: 1, hpMul: 1.45, dmgMul: 2.1 },
  voidtreant: { name: 'Árvore Corrompida', base: 'treant', speed: 140, range: 120, scale: 1, hpMul: 1.95, dmgMul: 2.0 },
  voidshroom: { name: 'Fungo Abissal', base: 'mushroom', speed: 180, range: 95, scale: 1, hpMul: 1.6, dmgMul: 1.75 },
  wraith:     { name: 'Cavaleiro Espectral', base: 'skeleton', speed: 250, range: 115, scale: 1, hpMul: 1.3, dmgMul: 2.0 },
};

// Composição de cada fase: [trecho 1, trecho 2, chefe]. Cada trecho é a lista de monstros que aparecem juntos.
const FOREST_PHASES = [
  /* 1 */ { screens: [['goblin'], ['goblin']], boss: { type: 'goblin', name: 'Chefe Goblin' } },
  /* 2 */ { screens: [['goblin'], ['wolf']], boss: { type: 'goblin', name: 'Goblin Saqueador' } },
  /* 3 */ { screens: [['wolf'], ['goblin', 'goblin']], boss: { type: 'wolf', name: 'Lobo Alfa' } },
  /* 4 */ { screens: [['wolf'], ['mushroom', 'goblin']], boss: { type: 'wolf', name: 'Lobo da Névoa' } },
  /* 5 */ { screens: [['mushroom', 'goblin'], ['wolf']], boss: { type: 'mushroom', name: 'Cogumelo Rei' } },
  /* 6 */ { screens: [['mushroom', 'goblin'], ['goblin', 'wolf']], boss: { type: 'mushroom', name: 'Esporo Ancião' } },
  /* 7 */ { screens: [['treant'], ['wolf', 'goblin']], boss: { type: 'treant', name: 'Raiz Furiosa' } },
  /* 8 */ { screens: [['treant', 'goblin'], ['mushroom', 'wolf']], boss: { type: 'wolf', name: 'Lobo Fantasma' } },
  /* 9 */ { screens: [['mushroom', 'treant'], ['wolf', 'goblin', 'goblin']], boss: { type: 'treant', name: 'Guardião do Bosque' } },
  /*10 */ { screens: [['wolf', 'wolf'], ['treant', 'mushroom', 'goblin']], boss: { type: 'treant', name: 'Ent Sombrio', final: true } },
];
const SWAMP_PHASES = [
  /* 1 */ { screens: [['slime'], ['toad']], boss: { type: 'slime', name: 'Lodo Rei' } },
  /* 2 */ { screens: [['toad'], ['slime', 'toad']], boss: { type: 'toad', name: 'Sapo Gigante' } },
  /* 3 */ { screens: [['lizard'], ['toad', 'slime']], boss: { type: 'lizard', name: 'Batedor Escamado' } },
  /* 4 */ { screens: [['slime', 'slime'], ['lizard']], boss: { type: 'toad', name: 'Sapo Ancião' } },
  /* 5 */ { screens: [['lizard', 'toad'], ['slime', 'lizard']], boss: { type: 'slime', name: 'Lodo Pestilento' } },
  /* 6 */ { screens: [['toad', 'toad'], ['lizard', 'slime']], boss: { type: 'lizard', name: 'Guerreiro da Lama' } },
  /* 7 */ { screens: [['lizard', 'lizard'], ['toad', 'slime', 'toad']], boss: { type: 'toad', name: 'Rei dos Sapos' } },
  /* 8 */ { screens: [['slime', 'lizard', 'slime'], ['lizard', 'toad']], boss: { type: 'slime', name: 'Grande Lodo' } },
  /* 9 */ { screens: [['lizard', 'toad', 'lizard'], ['slime', 'lizard', 'toad']], boss: { type: 'lizard', name: 'Xamã Escamado' } },
  /*10 */ { screens: [['toad', 'lizard', 'slime'], ['lizard', 'lizard', 'toad']], boss: { type: 'lizard', name: 'Rei Lagarto', final: true } },
];
const CAVES_PHASES = [
  /* 1 */ { screens: [['miner'], ['crystal']], boss: { type: 'miner', name: 'Capataz Goblin' } },
  /* 2 */ { screens: [['miner', 'miner'], ['golem']], boss: { type: 'golem', name: 'Golem Rachado' } },
  /* 3 */ { screens: [['crystal', 'miner'], ['golem']], boss: { type: 'crystal', name: 'Geodo Vivo' } },
  /* 4 */ { screens: [['golem'], ['miner', 'crystal']], boss: { type: 'miner', name: 'Chefe da Mina' } },
  /* 5 */ { screens: [['golem', 'miner'], ['crystal', 'crystal']], boss: { type: 'golem', name: 'Golem de Ametista' } },
  /* 6 */ { screens: [['miner', 'crystal', 'miner'], ['golem']], boss: { type: 'crystal', name: 'Lodo Prismático' } },
  /* 7 */ { screens: [['golem', 'crystal'], ['miner', 'golem']], boss: { type: 'miner', name: 'Dinamitador' } },
  /* 8 */ { screens: [['crystal', 'golem', 'miner'], ['golem', 'miner']], boss: { type: 'golem', name: 'Sentinela de Quartzo' } },
  /* 9 */ { screens: [['golem', 'golem'], ['miner', 'crystal', 'miner']], boss: { type: 'crystal', name: 'Coração da Caverna' } },
  /*10 */ { screens: [['miner', 'golem', 'crystal'], ['golem', 'golem', 'miner']], boss: { type: 'golem', name: 'Colosso de Cristal', final: true } },
];
const DESERT_PHASES = [
  /* 1 */ { screens: [['jackal'], ['skeleton']], boss: { type: 'jackal', name: 'Chacal Alfa' } },
  /* 2 */ { screens: [['skeleton', 'jackal'], ['scorpion']], boss: { type: 'scorpion', name: 'Escorpião Gigante' } },
  /* 3 */ { screens: [['raider'], ['skeleton', 'skeleton']], boss: { type: 'skeleton', name: 'Capitão Ossudo' } },
  /* 4 */ { screens: [['scorpion', 'jackal'], ['raider']], boss: { type: 'raider', name: 'Líder Saqueador' } },
  /* 5 */ { screens: [['skeleton', 'raider'], ['scorpion', 'jackal']], boss: { type: 'scorpion', name: 'Ferrão Carmesim' } },
  /* 6 */ { screens: [['jackal', 'jackal'], ['skeleton', 'scorpion']], boss: { type: 'skeleton', name: 'Guardião da Tumba' } },
  /* 7 */ { screens: [['raider', 'scorpion'], ['skeleton', 'jackal', 'skeleton']], boss: { type: 'raider', name: 'Senhor das Dunas' } },
  /* 8 */ { screens: [['scorpion', 'skeleton', 'jackal'], ['raider', 'scorpion']], boss: { type: 'jackal', name: 'Chacal Fantasma' } },
  /* 9 */ { screens: [['skeleton', 'raider', 'skeleton'], ['scorpion', 'scorpion', 'jackal']], boss: { type: 'skeleton', name: 'Faraó Esquecido' } },
  /*10 */ { screens: [['raider', 'scorpion', 'jackal'], ['skeleton', 'scorpion', 'raider']], boss: { type: 'scorpion', name: 'Rei Escorpião', final: true } },
];
const PEAKS_PHASES = [
  /* 1 */ { screens: [['snowgoblin'], ['frostwolf']], boss: { type: 'snowgoblin', name: 'Chefe da Tribo Gelada' } },
  /* 2 */ { screens: [['frostwolf', 'snowgoblin'], ['frostbones']], boss: { type: 'frostwolf', name: 'Lobo Branco' } },
  /* 3 */ { screens: [['frostbones', 'snowgoblin'], ['icegolem']], boss: { type: 'frostbones', name: 'Sentinela Congelado' } },
  /* 4 */ { screens: [['icegolem'], ['frostwolf', 'frostwolf']], boss: { type: 'icegolem', name: 'Golem da Avalanche' } },
  /* 5 */ { screens: [['snowgoblin', 'frostbones'], ['icegolem', 'snowgoblin']], boss: { type: 'snowgoblin', name: 'Xamã das Neves' } },
  /* 6 */ { screens: [['frostwolf', 'frostbones'], ['icegolem', 'frostwolf']], boss: { type: 'frostbones', name: 'Rei Sem Calor' } },
  /* 7 */ { screens: [['icegolem', 'snowgoblin'], ['frostbones', 'frostwolf', 'snowgoblin']], boss: { type: 'frostwolf', name: 'Matilha da Nevasca' } },
  /* 8 */ { screens: [['frostbones', 'icegolem', 'frostwolf'], ['snowgoblin', 'icegolem']], boss: { type: 'icegolem', name: 'Colosso de Gelo Eterno' } },
  /* 9 */ { screens: [['frostwolf', 'frostwolf', 'snowgoblin'], ['icegolem', 'frostbones', 'frostbones']], boss: { type: 'frostbones', name: 'Lorde do Inverno' } },
  /*10 */ { screens: [['icegolem', 'frostbones', 'frostwolf'], ['icegolem', 'icegolem', 'snowgoblin']], boss: { type: 'icegolem', name: 'Titã dos Picos', final: true } },
];
const CITADEL_PHASES = [
  /* 1 */ { screens: [['imp'], ['hellhound']], boss: { type: 'imp', name: 'Diabrete Chefe' } },
  /* 2 */ { screens: [['imp', 'imp'], ['demonknight']], boss: { type: 'hellhound', name: 'Cérbero Jovem' } },
  /* 3 */ { screens: [['hellhound', 'imp'], ['magmagolem']], boss: { type: 'demonknight', name: 'Guarda do Portão' } },
  /* 4 */ { screens: [['demonknight'], ['imp', 'hellhound']], boss: { type: 'magmagolem', name: 'Fornalha Viva' } },
  /* 5 */ { screens: [['magmagolem', 'imp'], ['demonknight', 'hellhound']], boss: { type: 'imp', name: 'Arquidiabrete' } },
  /* 6 */ { screens: [['hellhound', 'hellhound'], ['demonknight', 'magmagolem']], boss: { type: 'hellhound', name: 'Cão do Abismo de Fogo' } },
  /* 7 */ { screens: [['demonknight', 'imp', 'demonknight'], ['magmagolem', 'hellhound']], boss: { type: 'demonknight', name: 'Comandante Demoníaco' } },
  /* 8 */ { screens: [['magmagolem', 'hellhound', 'imp'], ['demonknight', 'magmagolem']], boss: { type: 'magmagolem', name: 'Golem do Vulcão' } },
  /* 9 */ { screens: [['demonknight', 'demonknight', 'hellhound'], ['magmagolem', 'imp', 'imp']], boss: { type: 'hellhound', name: 'Cérbero' } },
  /*10 */ { screens: [['magmagolem', 'demonknight', 'hellhound'], ['demonknight', 'magmagolem', 'imp']], boss: { type: 'demonknight', name: 'Senhor da Cidadela', final: true } },
];
const ABYSS_PHASES = [
  /* 1 */ { screens: [['voidshroom'], ['wraith']], boss: { type: 'voidshroom', name: 'Esporo do Vazio' } },
  /* 2 */ { screens: [['wraith', 'voidshroom'], ['voidscorp']], boss: { type: 'wraith', name: 'Cavaleiro Perdido' } },
  /* 3 */ { screens: [['voidscorp', 'wraith'], ['voidtreant']], boss: { type: 'voidscorp', name: 'Ferrão Sombrio' } },
  /* 4 */ { screens: [['voidtreant'], ['voidshroom', 'voidscorp']], boss: { type: 'voidtreant', name: 'Raiz do Esquecimento' } },
  /* 5 */ { screens: [['wraith', 'wraith'], ['voidtreant', 'voidshroom']], boss: { type: 'wraith', name: 'Lorde Espectral' } },
  /* 6 */ { screens: [['voidscorp', 'voidshroom'], ['wraith', 'voidtreant']], boss: { type: 'voidshroom', name: 'Mãe dos Fungos' } },
  /* 7 */ { screens: [['voidtreant', 'wraith', 'voidscorp'], ['voidshroom', 'wraith']], boss: { type: 'voidscorp', name: 'Rainha Escorpião do Vazio' } },
  /* 8 */ { screens: [['wraith', 'voidscorp', 'voidshroom'], ['voidtreant', 'voidtreant']], boss: { type: 'voidtreant', name: 'Árvore do Fim' } },
  /* 9 */ { screens: [['voidscorp', 'voidscorp', 'wraith'], ['voidtreant', 'voidshroom', 'wraith']], boss: { type: 'wraith', name: 'Rei dos Espectros' } },
  /*10 */ { screens: [['voidtreant', 'wraith', 'voidscorp'], ['wraith', 'voidscorp', 'voidtreant']], boss: { type: 'voidscorp', name: 'Devorador do Vazio', final: true } },
];
const PHASES = { forest: FOREST_PHASES, swamp: SWAMP_PHASES, caves: CAVES_PHASES, desert: DESERT_PHASES,
  peaks: PEAKS_PHASES, citadel: CITADEL_PHASES, abyss: ABYSS_PHASES };

// Status do monstro. "phase" já é a fase global (tier da área + fase). Fase 1: 10 de dano por golpe.
function monsterStats(phase, typeId, isBoss) {
  const t = MONSTERS[typeId];
  let hp = Math.round((45 + 16 * (phase - 1) + (phase > 10 ? 6 * (phase - 10) : 0)) * t.hpMul);
  let dmg = Math.round((10 + 1.6 * (phase - 1)) * t.dmgMul);
  if (phase === 1 && !isBoss) dmg = 10;
  if (isBoss) { hp = Math.round(hp * 3.6); dmg = Math.round(dmg * 1.5); }
  return { hp, dmg };
}

// ---------------- Progressão
// EXP necessária para passar do nível L para L+1
function xpToNext(lvl) {
  if (lvl < 5) return 50 + 50 * lvl;          // 100,150,200,250 => 700 até o nível 5
  return 250 + 120 * (lvl - 4);
}
// EXP e ouro ao completar a fase N (Floresta: soma das 10 fases = 730 => nível 5;
// Pântano: soma ≈ 2680 => nível 9, e repetindo fases chega ao 10)
function phaseRewards(phase, area = 'forest') {
  if (area === 'swamp') return { xp: 180 + 16 * phase, gold: 60 + 10 * phase };
  if (area === 'caves') return { xp: 800 + 60 * phase, gold: 150 + 20 * phase };   // soma ≈ 11300 (nível 10 → ~17)
  if (area === 'desert') return { xp: 1700 + 120 * phase, gold: 300 + 30 * phase }; // soma ≈ 23600 (nível 20 → ~27)
  if (area === 'peaks') return { xp: 2600 + 180 * phase, gold: 420 + 40 * phase };   // soma ≈ 35900 (nível 30 → ~38)
  if (area === 'citadel') return { xp: 3300 + 220 * phase, gold: 560 + 50 * phase }; // soma ≈ 45100 (nível 40 → ~48)
  if (area === 'abyss') return { xp: 4000 + 280 * phase, gold: 720 + 60 * phase };   // soma ≈ 55400 (nível 50 → ~58)
  return { xp: 40 + 6 * phase, gold: 20 + 6 * phase };
}
// estrelas: 1 por vencer, +1 por pouco dano, +1 por terminar rápido
function parTime(phase, area = 'forest') { return Math.round(55 + phase * 6 + ({ swamp: 20, caves: 30, desert: 40, peaks: 45, citadel: 50, abyss: 55 }[area] || 0)); }
const MAX_LEVEL = 60;
