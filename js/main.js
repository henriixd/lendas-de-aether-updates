// ============================================================
//  INICIALIZAÇÃO DO PHASER
// ============================================================
const config = {
  type: location.search.includes('canvas') ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0d0a',
  width: W, height: H,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  dom: { createContainer: true },
  input: { activePointers: 4 },
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, TitleScene, CharSelectScene, CharCreateScene, HubScene, BagScene, ShopScene, PremiumScene, MapScene, BattleScene, ArenaScene, ArenaBattleScene],
};
window.addEventListener('load', () => {
  let started = false;
  const boot = () => { if (!started) { started = true; window.game = new Phaser.Game(config); } };
  // entra na conta da nuvem (se configurada) antes de abrir o jogo — no máximo 6 s de espera
  const start = () => { Promise.race([Cloud.init(), new Promise(r => setTimeout(r, 6000))]).then(boot, boot); };
  // espera as fontes (se não carregarem, segue com as fontes do sistema)
  if (document.fonts && document.fonts.load) {
    Promise.race([
      Promise.all([document.fonts.load('bold 20px Cinzel'), document.fonts.load('bold 20px Nunito')]),
      new Promise(r => setTimeout(r, 1500)),
    ]).then(start, start);
  } else start();
});
