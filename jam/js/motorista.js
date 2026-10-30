/* Página do motorista: identifica o veículo e controla a JAM */
import { connect } from './backend.js';
import { PASSAGEIROS } from './config.js';
import { $, esc, fmt, params, toArray, vehicleId, applyTheme, toast, qrSvg, baseUrl, copy, I } from './common.js';
import { JamEngine } from './sync.js';

const P = params();
const app = $('#app');
const ev = P.e, pt = P.p, key = P.k;
let info = {}, tracks = [], points = {};

if (!ev || !pt || !key) app.innerHTML = '<h1>Link incompleto</h1><p class="sub">Peça para a equipe AS Brasil enviar o link de motorista de novo.</p>';
else start();

async function start() {
  const b = await connect();
  await b.ensureAnon();
  const e0 = await b.get('events/' + ev);
  if (!e0 || !e0.info) { app.innerHTML = '<h1>Evento não encontrado</h1>'; return; }
  info = e0.info; points = e0.points || {}; tracks = toArray(e0.playlist); applyTheme(info);
  const point = points[pt];

  // valida o link (o token é conferido pelas regras do banco)
  try {
    if (b.mode === 'demo') { const tk = await b.get(`tokens/${ev}/${pt}`); if (tk !== key) throw new Error('token'); }
    await b.set(`drivers/${ev}/${b.uid}`, { p: pt, k: key, at: { '.sv': 'timestamp' } });
  } catch {
    app.innerHTML = '<h1>Link inválido</h1><p class="sub">Este link de motorista expirou ou foi trocado. Peça um novo para a equipe AS Brasil.</p>';
    return;
  }

  let engine = null;
  b.listen('events/' + ev, e => {
    if (!e) return; info = e.info || {}; tracks = toArray(e.playlist); applyTheme(info);
    if (engine) { engine.albumName = info.name; engine.setTracks(tracks); }
  });

  const saved = JSON.parse(localStorage.getItem('asmd-driver') || '{}');
  if (saved.ev === ev && saved.v) control(saved.v, saved.name); else form();

  function head() {
    return `<div class="brandbar"><span class="dot"></span>AS Music Driver · Motorista</div>
      <h1>${esc(info.name || 'JAM')}</h1><p class="sub">${point ? 'Embarque: ' + esc(point.name) + (point.time ? ' · ' + esc(point.time) : '') : ''}</p>`;
  }
  function form() {
    app.innerHTML = head() + `<form class="card" id="f">
      <label class="field"><span>Seu nome</span><input id="nm" value="${esc(saved.name || '')}" required maxlength="40" autocomplete="name"></label>
      <label class="field"><span>Número do veículo</span><input id="vn" class="big-input" inputmode="numeric" value="${esc(saved.label || '')}" required maxlength="20"></label>
      <div class="err" id="er"></div>
      <button class="btn btn-main btn-block">Continuar</button></form>
      <p class="muted" style="font-size:.86rem;text-align:center">Faça isso antes de sair, com o veículo parado.</p>`;
    $('#f').addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#nm').value.trim(), label = $('#vn').value.trim(), v = vehicleId(label);
      if (!v) { $('#er').textContent = 'Informe o número do veículo.'; return; }
      try {
        await b.update(`jams/${ev}/${v}/info`, { label, driver: name, point: pt, uid: b.uid, updated: { '.sv': 'timestamp' } });
      } catch { $('#er').textContent = 'Não foi possível registrar o veículo. Tente de novo.'; return; }
      localStorage.setItem('asmd-driver', JSON.stringify({ ev, v, name, label }));
      control(v, name);
    });
  }

  function control(v, name) {
    let jam = null, count = 0;
    engine = new JamEngine(b, { onChange: render });
    engine.albumName = info.name;
    engine.setTracks(tracks);
    const listenUrl = baseUrl() + `index.html?e=${encodeURIComponent(ev)}&v=${encodeURIComponent(v)}`;
    app.innerHTML = head() + `<div id="screen"></div>`;
    b.listen(`jams/${ev}/${v}`, j => { jam = j; engine.setState(j && j.state); render(); });
    if (PASSAGEIROS) b.listen(`listeners/${ev}/${v}`, l => { count = l ? Object.keys(l).length : 0; render(); });
    const beat = () => b.update(`jams/${ev}/${v}/info`, { updated: { '.sv': 'timestamp' } }).catch(() => {});
    beat(); setInterval(beat, 60000);

    const send = async kind => {
      if (!tracks.length) { toast('A playlist deste evento está vazia.'); return; }
      if (!engine.joined) await engine.join();
      engine.userPaused = false;
      const st = engine.cmd(kind);
      if (st) { try { await b.set(`jams/${ev}/${v}/state`, st); } catch { toast('Sem conexão. Tente de novo.'); } }
    };
    if ('mediaSession' in navigator) {
      const h = { play: () => send('play'), pause: () => send('pause'), nexttrack: () => send('next'), previoustrack: () => send('prev') };
      for (const a in h) { try { navigator.mediaSession.setActionHandler(a, h[a]); } catch {} }
    }
    setInterval(progress, 500);

    function render() {
      const scr = $('#screen'); if (!scr) return;
      const tl = engine.timeline(); const t = tl ? tracks[tl.index] : null;
      const live = !!(tl && tl.playing);
      document.body.classList.toggle('on', live);
      const label = jam && jam.info ? jam.info.label : v;
      const stopped = live && engine.joined && engine.audio.paused && !engine.audio.ended;
      scr.innerHTML = `
        <div class="stick"><span class="ring"></span><span class="ring r2"></span><span class="orb"></span>
          <div class="label"><small>Veículo</small><b>${esc(label)}</b></div></div>
        <div class="row" style="justify-content:center;margin-bottom:14px">
          ${live ? '<span class="pill live">JAM ao vivo</span>' : '<span class="pill">JAM parada</span>'}
          ${PASSAGEIROS ? `<span class="pill">${I.users}${count} ouvindo</span>` : ''}</div>
        <div class="now card"><div class="t">${t ? esc(t.title) : 'Toque no play para começar'}</div>
          <div class="a">${t ? esc(t.artist || '') : tracks.length + ' músicas na playlist'}</div>
          <div class="bar"><i id="pb"></i></div><div class="times"><span id="tc">0:00</span><span id="td">0:00</span></div></div>
        <div class="controls">
          <button class="ctl" id="pv" aria-label="Música anterior">${I.prev}</button>
          <button class="main" id="pp" aria-label="${live ? 'Pausar a JAM' : 'Tocar a JAM'}">${live ? I.pause : I.play}</button>
          <button class="ctl" id="nx" aria-label="Próxima música">${I.next}</button>
        </div>
        ${stopped ? `<div class="card" style="text-align:center"><p style="margin:0 0 10px">O som parou (ligação ou outro app). A playlist segue no tempo certo: toque para voltar.</p><button class="btn btn-main" id="rs">Voltar a tocar aqui</button></div>` : ''}
        ${!live && engine.joined === false && jam && jam.state ? '' : ''}
        ${PASSAGEIROS ? `<div class="card" style="text-align:center;margin-top:14px">
          <p style="margin:0 0 10px;font-weight:800">Passageiros: aponte a câmera</p>
          <div class="qr">${qrSvg(listenUrl)}</div>
          <p class="muted" style="font-size:.82rem;margin:10px 0 0">Ou pelo link do embarque, escolhendo o veículo ${esc(label)}.</p>
          <p style="margin:10px 0 0"><button class="btn btn-ghost btn-sm" id="cp">${I.copy}<span>Copiar link</span></button></p>
        </div>` : ''}
        <p style="text-align:center;margin-top:16px"><button class="btn btn-ghost btn-sm" id="sw">Trocar veículo</button></p>
        <p class="muted" style="font-size:.84rem;text-align:center">Conecte o celular ao som do veículo pelo Bluetooth. Depois do play, não precisa mexer: pode bloquear a tela.</p>`;
      $('#pp').addEventListener('click', () => send(live ? 'pause' : 'play'));
      $('#nx').addEventListener('click', () => send('next'));
      $('#pv').addEventListener('click', () => send('prev'));
      $('#rs')?.addEventListener('click', () => engine.resumeMine());
      $('#cp')?.addEventListener('click', () => copy(listenUrl));
      $('#sw').addEventListener('click', () => { localStorage.removeItem('asmd-driver'); location.reload(); });
      progress();
    }
    function progress() {
      const tl = engine.timeline(); const t = tl && tracks[tl.index];
      const pb = $('#pb'); if (!pb || !t) return;
      const d = engine.dur(tl.index) || t.dur || 0;
      pb.style.width = d ? Math.min(100, tl.pos / d * 100) + '%' : '0';
      $('#tc').textContent = fmt(tl.pos); $('#td').textContent = fmt(d);
    }
    // se a JAM já estava tocando (motorista reabriu a página), entra ao primeiro toque em qualquer lugar
    document.addEventListener('pointerdown', () => { if (!engine.joined && jam && jam.state && jam.state.playing) engine.join(); }, { once: true });
  }
}
