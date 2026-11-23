// ============================================================
//  CONFIGURAÇÃO DO SERVIDOR (Supabase)
//  Deixe em branco para jogar só no aparelho (sem conta na nuvem).
//  A "anon key" é pública por natureza: a segurança está nas regras (RLS) do banco.
// ============================================================
const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  // Duelo com amigo (código de sala): em branco usa o servidor gratuito do PeerJS para
  // apresentar os dois aparelhos. Para lançar, use um servidor próprio, ex.:
  // PEER: { host: 'salas.seujogo.com', port: 443, path: '/aether', secure: true },
  PEER: null,
  // Atualização pelo app: endereço do update.json da versão mais nova (pasta gerada por tools/make_update.py --out).
  // Em branco = sem atualização pelo app.
  UPDATE_URL: 'https://henriixd.github.io/lendas-de-aether-updates/update.json',
};
