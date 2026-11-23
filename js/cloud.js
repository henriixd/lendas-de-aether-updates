// ============================================================
//  NUVEM (Supabase) — conta com e-mail e senha + save sincronizado
//  Sem CONFIG preenchido o jogo funciona só no aparelho (modo offline).
// ============================================================
const Cloud = {
  sb: null,
  user: null,
  profile: null,
  rev: 0,            // versão do save que este aparelho conhece
  dirty: false,      // tem mudança local ainda não enviada
  timer: null,
  sending: false,
  status: 'off',     // off | ok | sync | offline | erro
  listeners: [],

  get enabled() { return !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase); },

  async init() {
    if (!this.enabled) return;
    try {
      this.sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'aether_auth' },
      });
      const { data } = await this.sb.auth.getSession();
      this.user = data.session ? data.session.user : null;
      if (this.user) await this.afterLogin();
    } catch (e) { console.warn('Nuvem indisponível', e); this.setStatus('offline'); }
    // reenvia quando a internet volta / quando o app vai para segundo plano
    window.addEventListener('online', () => this.flush());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flush(); });
  },

  setStatus(s) { this.status = s; this.listeners.forEach(f => { try { f(s); } catch (e) {} }); },
  onStatus(f) { this.listeners.push(f); return () => { this.listeners = this.listeners.filter(x => x !== f); }; },

  // ---------- conta
  async signUp(email, password, nick) {
    nick = (nick || '').trim();
    if (nick.length < 3 || nick.length > 14) return { error: 'O apelido precisa ter de 3 a 14 letras' };
    if (!/^[\p{L}\p{N}_ .-]+$/u.test(nick)) return { error: 'Use só letras, números, espaço, ponto, _ ou -' };
    if ((password || '').length < 6) return { error: 'A senha precisa ter pelo menos 6 caracteres' };
    const ok = await this.sb.rpc('nick_available', { p_nick: nick });
    if (ok.error) return { error: traduzErro(ok.error) };
    if (!ok.data) return { error: 'Esse apelido já está em uso' };
    const { data, error } = await this.sb.auth.signUp({ email: email.trim(), password, options: { data: { nick } } });
    if (error) return { error: traduzErro(error) };
    if (!data.session) return { confirm: true }; // projeto pede confirmação por e-mail
    this.user = data.session.user;
    await this.afterLogin();
    return { ok: true };
  },
  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: traduzErro(error) };
    this.user = data.user;
    await this.afterLogin();
    return { ok: true };
  },
  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim());
    return error ? { error: traduzErro(error) } : { ok: true };
  },
  async signOut() {
    await this.flush();
    try { await this.sb.auth.signOut(); } catch (e) {}
    this.user = null; this.profile = null; this.rev = 0; this.dirty = false;
    Save.data = { account: null, chars: [], current: null, uid: 1 };
  },
  async deleteAccount() {
    const { error } = await this.sb.rpc('delete_account');
    if (error) return { error: traduzErro(error) };
    try { localStorage.removeItem(this.cacheKey()); } catch (e) {}
    try { await this.sb.auth.signOut(); } catch (e) {}
    this.user = null; this.profile = null; this.rev = 0; this.dirty = false;
    Save.data = { account: null, chars: [], current: null, uid: 1 };
    return { ok: true };
  },

  // ---------- save
  cacheKey() { return 'aether_cloud_' + (this.user ? this.user.id : 'x'); },
  // depois de entrar: baixa perfil, diamantes e save; decide entre nuvem e cópia local
  async afterLogin() {
    this.setStatus('sync');
    const uid = this.user.id;
    const [prof, wal, sv] = await Promise.all([
      this.sb.from('profiles').select('nick').eq('id', uid).maybeSingle(),
      this.sb.from('wallets').select('diamonds').eq('user_id', uid).maybeSingle(),
      this.sb.from('saves').select('data, rev').eq('user_id', uid).maybeSingle(),
    ]);
    const nick = (prof.data && prof.data.nick) || (this.user.user_metadata && this.user.user_metadata.nick) || 'Herói';
    this.profile = { nick };
    let local = null;
    try { local = JSON.parse(localStorage.getItem(this.cacheKey())); } catch (e) {}
    const cloud = sv.data;
    let data;
    if (local && local.dirty && (!cloud || local.rev >= cloud.rev)) {
      // mudanças feitas sem internet neste aparelho: elas valem
      data = local.data; this.rev = cloud ? cloud.rev : 0; this.dirty = true;
    } else if (cloud && cloud.data && cloud.data.chars) {
      data = cloud.data; this.rev = cloud.rev; this.dirty = false;
    } else {
      // conta nova: traz os personagens que já existiam neste aparelho (só uma vez)
      const old = Save.loadOffline();
      const migrated = localStorage.getItem('aether_migrated');
      data = (old && old.chars && old.chars.length && !migrated) ? old : { chars: [], current: null, uid: 1 };
      if (data === old) { try { localStorage.setItem('aether_migrated', uid); } catch (e) {} }
      this.rev = 0; this.dirty = true;
    }
    data.account = { nick, diamonds: (wal.data && wal.data.diamonds) || 0, email: this.user.email };
    Save.data = data;
    Save.write();
    await this.flush();
    if (!this.dirty) this.setStatus('ok');
  },
  // chamado a cada Save.write(): guarda no aparelho e agenda o envio
  saved() {
    if (!this.user) return;
    this.dirty = true;
    this.cacheLocal();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 2500);
  },
  cacheLocal() {
    try { localStorage.setItem(this.cacheKey(), JSON.stringify({ data: Save.data, rev: this.rev, dirty: this.dirty })); } catch (e) {}
  },
  async flush() {
    if (!this.user || !this.dirty || this.sending) return;
    if (navigator.onLine === false) { this.setStatus('offline'); return; }
    this.sending = true; this.setStatus('sync');
    clearTimeout(this.timer);
    try {
      const payload = Object.assign({}, Save.data); delete payload.account; // diamantes/apelido vêm do servidor
      const { data, error } = await this.sb.rpc('save_game', { p_data: payload, p_base_rev: this.rev });
      if (error) throw error;
      if (data < 0) {
        // outro aparelho gravou depois: a nuvem vence
        const sv = await this.sb.from('saves').select('data, rev').eq('user_id', this.user.id).maybeSingle();
        if (sv.data) { const acc = Save.data.account; Save.data = sv.data.data; Save.data.account = acc; this.rev = sv.data.rev; }
        this.dirty = false; this.cacheLocal();
        this.conflict = true;
      } else { this.rev = data; this.dirty = false; this.cacheLocal(); }
      this.setStatus('ok');
    } catch (e) {
      console.warn('Falha ao salvar na nuvem', e);
      this.setStatus(navigator.onLine === false ? 'offline' : 'erro');
      clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 15000); // tenta de novo
    }
    this.sending = false;
  },
  // compra na Loja Premium: o servidor confere o preço no catálogo dele e desconta os diamantes
  async buyPremium(itemId) {
    const { data, error } = await this.sb.rpc('buy_premium', { p_item: itemId });
    if (error) return { error: /insuficientes/i.test(error.message) ? 'Diamantes insuficientes' : traduzErro(error) };
    return { balance: data };
  },
  // diamantes ganhos jogando (o servidor só paga cada recompensa uma vez)
  async claimReward(kind, key) {
    const { data, error } = await this.sb.rpc('claim_reward', { p_kind: kind, p_key: String(key) });
    if (error) return { error: traduzErro(error) };
    return { balance: data.balance, added: data.added };
  },
  async refreshDiamonds() {
    if (!this.user) return;
    const { data } = await this.sb.from('wallets').select('diamonds').eq('user_id', this.user.id).maybeSingle();
    if (data && Save.data.account) Save.data.account.diamonds = data.diamonds;
  },
};

function traduzErro(e) {
  const m = ((e && (e.message || e.error_description)) || String(e)).toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada)';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Esse e-mail já tem conta. Use "Entrar"';
  if (m.includes('password') && m.includes('6')) return 'A senha precisa ter pelo menos 6 caracteres';
  if (m.includes('weak') && m.includes('password')) return 'Senha muito fraca. Use letras e números';
  if (m.includes('invalid') && m.includes('email')) return 'E-mail inválido';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere um pouco e tente de novo';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor';
  if (m.includes('database error saving new user')) return 'Esse apelido já está em uso';
  return 'Erro: ' + ((e && e.message) || e);
}
