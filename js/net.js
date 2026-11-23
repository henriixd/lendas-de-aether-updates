// ============================================================
//  REDE — Duelo com amigo por código de sala
//  Conexão direta entre os dois aparelhos (WebRTC) usando PeerJS.
//  O servidor do PeerJS só apresenta um aparelho ao outro; a luta
//  em si vai direto de um celular para o outro.
//  Para usar um servidor próprio: CONFIG.PEER = { host, port, path, secure }
// ============================================================
const NET_PREFIX = 'lendas-aether-v1-';
const Net = {
  peer: null, conn: null, role: null, code: null,
  handlers: {}, pending: [],
  get open() { return !!(this.conn && this.conn.open); },
  available() { return typeof Peer !== 'undefined' && !!window.RTCPeerConnection; },
  opts() { return Object.assign({ debug: 0 }, (typeof CONFIG !== 'undefined' && CONFIG.PEER) || {}); },
  makeCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I para não confundir
    let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  },
  // cria a sala e espera o amigo entrar. Resolve com o código assim que a sala existe.
  host(tries = 3) {
    this.close();
    return new Promise((resolve, reject) => {
      const code = this.makeCode();
      const peer = this.peer = new Peer(NET_PREFIX + code, this.opts());
      const t = setTimeout(() => reject(new Error('Sem resposta do servidor de salas')), 12000);
      peer.on('open', () => { clearTimeout(t); this.role = 'host'; this.code = code; resolve(code); });
      peer.on('connection', (c) => {
        if (this.conn) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; }
        this.attach(c);
      });
      peer.on('error', (e) => {
        clearTimeout(t);
        if (e.type === 'unavailable-id' && tries > 0) { this.host(tries - 1).then(resolve, reject); return; }
        if (!this.code) reject(new Error(netErr(e))); else this.emit('error', { msg: netErr(e) });
      });
      peer.on('disconnected', () => { if (this.conn && this.conn.open) return; try { peer.reconnect(); } catch (e) {} });
    });
  },
  // entra na sala do amigo
  join(code) {
    this.close();
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return new Promise((resolve, reject) => {
      const peer = this.peer = new Peer(undefined, this.opts());
      let done = false;
      const fail = (msg) => { if (done) return; done = true; clearTimeout(t); this.close(); reject(new Error(msg)); };
      const t = setTimeout(() => fail('Sala não encontrada (confira o código)'), 15000);
      peer.on('open', () => {
        const c = peer.connect(NET_PREFIX + code, { reliable: true, serialization: 'json' });
        this.role = 'guest'; this.code = code;
        this.attach(c);
        c.on('open', () => { if (done) return; done = true; clearTimeout(t); resolve(code); });
      });
      peer.on('error', (e) => fail(e.type === 'peer-unavailable' ? 'Sala não encontrada (confira o código)' : netErr(e)));
    });
  },
  attach(c) {
    this.conn = c;
    c.on('open', () => this.emit('open', {}));
    c.on('data', (d) => { if (d && d.t === 'full') { this.emit('error', { msg: 'Essa sala já está cheia' }); return; } if (d && d.t) this.emit(d.t, d); });
    c.on('close', () => { if (this.conn === c) { this.conn = null; this.emit('close', {}); } });
    c.on('error', () => {});
  },
  send(t, o = {}) { if (this.open) try { this.conn.send(Object.assign({ t }, o)); } catch (e) {} },
  // mensagem que chega antes da tela estar pronta fica guardada até alguém escutar
  on(t, f) {
    this.handlers[t] = f;
    const keep = [];
    for (const d of this.pending) { if (d.t === t) f(d); else keep.push(d); }
    this.pending = keep;
  },
  clear(except = []) { for (const k of Object.keys(this.handlers)) if (!except.includes(k)) delete this.handlers[k]; },
  emit(t, d) {
    d.t = t;
    const f = this.handlers[t];
    if (f) f(d);
    else if (t !== 'open' && t !== 's' && t !== 'ping' && t !== 'pong') { this.pending.push(d); if (this.pending.length > 60) this.pending.shift(); }
  },
  close() {
    try { if (this.conn) this.conn.close(); } catch (e) {}
    try { if (this.peer) this.peer.destroy(); } catch (e) {}
    this.peer = null; this.conn = null; this.role = null; this.code = null; this.handlers = {}; this.pending = [];
  },
};
function netErr(e) {
  const ty = e && e.type;
  if (ty === 'browser-incompatible') return 'Este aparelho não suporta o duelo online';
  if (ty === 'network' || ty === 'server-error' || ty === 'socket-error' || ty === 'socket-closed') return 'Sem conexão com o servidor de salas';
  if (ty === 'peer-unavailable') return 'Sala não encontrada (confira o código)';
  return 'Erro de conexão' + (ty ? ` (${ty})` : '');
}
