/* Página do passageiro: escolhe o veículo e ouve junto com o motorista */
import { connect } from './backend.js';
import { $, esc, fmt, params, toArray, vehicleId, applyTheme, toast, I } from './common.js';
import { JamEngine } from './sync.js';

const P = params();
const app = $('#app');
const ev = P.e;
let info = {}, tracks = [], points = {};

function shell(inner) {
  app.innerHTML = `<div class="brandbar"><span class="dot"></span>AS Music Driver</div>
    <h1>${esc(info.name || 'JAM')}</h1>${info.subtitle ? `<p class="sub">${esc(info.subtitle)}</p>` : '<p class="sub"></p>'}${inner}
    <p class="foot">Ouça com fone para não atrapalhar quem está ao lado.</p>`;
}

if (!ev) { app.innerHTML = '<h1>Link incompleto</h1><p class="sub">Escaneie de novo o QR Code do seu embarque.</p>'; }
else start();

async function start() {
  const b = await connect();
  await b.ensureAnon();
  const first = await b.get('events/' + ev);
  if (!first || !first.info) { app.innerHTML = '<h1>Evento não encontrado</h1><p class="sub">Confira o QR Code com a equipe AS Brasil.</p>'; return; }
  let engine = null;
  b.listen('events/' + ev, e => {
    if (!e) return;
    info = e.info || {}; points = e.points || {};
    tracks = toArray(e.playlist);
    applyTheme(info); document.title = (info.name || 'JAM') + ' · AS Music Driver';
    if (engine) { engine.albumName = info.name; engine.setTracks(tracks); }
  });
  info = first.info; points = first.points || {}; tracks = toArray(first.playlist); applyTheme(info);
  if (P.v) openVehicle(b, vehicleId(P.v)); else picker(b);

  function picker(b) {
    const pt = P.p && points[P.p];
    shell(`<div class="card">
      <p style="margin:0 0 12px;font-weight:800">Em qual veículo você está?</p>
      ${pt ? `<p class="muted" style="margin:-6px 0 14px">Embarque: ${esc(pt.name)}${pt.time ? ' · ' + esc(pt.time) : ''}</p>` : ''}
      <form id="vf" class="row" style="flex-wrap:nowrap"><label class="field" style="flex:1;margin:0"><span class="sr">Número do veículo</span>
        <input id="vnum" class="big-input" inputmode="numeric" placeholder="Nº do veículo" autocomplete="off" required></label>
        <button class="btn btn-main">Entrar</button></form>
    </div>
    <div class="card"><p style="margin:0 0 12px;font-weight:800">Veículos com JAM ligada</p><div class="vlist" id="vl"><p class="muted">Procurando…</p></div></div>`);
    $('#vf').addEventListener('submit', e => { e.preventDefault(); const v = vehicleId($('#vnum').value); if (v) go(v); });
    const un = b.listen('jams/' + ev, jams => {
      const now = b.serverNow();
      const list = Object.entries(jams || {}).filter(([, j]) => j && j.info && (!P.p || j.info.point === P.p) && now - (j.info.updated || 0) < 16 * 3600e3)
        .sort((a, c) => String(a[1].info.label).localeCompare(String(c[1].info.label), 'pt', { numeric: true }));
      const vl = $('#vl'); if (!vl) return;
      vl.innerHTML = list.length ? list.map(([id, j]) => `<button class="vbtn ${j.state && j.state.playing ? 'live' : ''}" data-v="${esc(id)}"><b>${esc(j.info.label)}</b><small>${j.state && j.state.playing ? 'Tocando agora' : 'Aguardando'}</small></button>`).join('')
        : '<p class="muted" style="grid-column:1/-1;margin:0">Nenhum veículo ligou a JAM ainda. Digite o número acima e aguarde o motorista dar o play.</p>';
    });
    $('#vl').addEventListener('click', e => { const bt = e.target.closest('[data-v]'); if (bt) go(bt.dataset.v); });
    function go(v) { un(); const u = new URL(location.href); u.searchParams.set('v', v); history.replaceState(null, '', u); openVehicle(b, v); }
  }

  function openVehicle(b, v) {
    let jam = null, count = 0, leavePresence = null;
    engine = new JamEngine(b, { onChange: render });
    engine.albumName = info.name;
    engine.setTracks(tracks);
    shell(`<div id="screen"></div>`);
    b.listen(`jams/${ev}/${v}`, j => { jam = j; engine.setState(j && j.state); render(); });
    b.listen(`listeners/${ev}/${v}`, l => { count = l ? Object.keys(l).length : 0; render(); });
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => engine.resumeMine());
        navigator.mediaSession.setActionHandler('pause', () => engine.pauseMine());
        ['previoustrack', 'nexttrack', 'seekto', 'seekbackward', 'seekforward'].forEach(a => { try { navigator.mediaSession.setActionHandler(a, null); } catch {} });
      } catch {}
    }
    setInterval(progress, 500);

    function render() {
      const scr = $('#screen'); if (!scr) return;
      const label = jam && jam.info ? jam.info.label : v;
      const tl = engine.timeline();
      const t = tl ? tracks[tl.index] : null;
      const live = !!(tl && tl.playing);
      document.body.classList.toggle('on', live && engine.joined && !engine.audio.paused);
      let status;
      if (!jam || !jam.state) status = '<span class="pill">Aguardando o motorista dar o play</span>';
      else if (!live) status = '<span class="pill">O motorista pausou a JAM</span>';
      else status = `<span class="pill live">Ao vivo</span>`;
      let action;
      if (!engine.joined) action = `<button class="btn btn-main btn-block" id="join">${I.play}<span>Ouvir junto</span></button>`;
      else if (engine.userPaused || engine.needTap) action = `<button class="btn btn-main btn-block" id="back">${I.play}<span>Voltar para a JAM</span></button>`;
      else action = `<button class="btn btn-ghost btn-block" id="mute">${I.pause}<span>Pausar só para mim</span></button>`;
      scr.innerHTML = `
        <div class="stick"><span class="ring"></span><span class="ring r2"></span><span class="orb"></span>
          <div class="label"><small>Veículo</small><b>${esc(label)}</b></div></div>
        <div class="row" style="justify-content:center;margin-bottom:14px">${status}<span class="pill">${I.users}${count} ouvindo</span></div>
        <div class="now card">
          <div class="t">${t ? esc(t.title) : 'Nenhuma música tocando'}</div>
          <div class="a">${t ? esc(t.artist || info.name || '') : (jam && jam.info ? 'Motorista: ' + esc(jam.info.driver || '') : '')}</div>
          <div class="bar"><i id="pb"></i></div><div class="times"><span id="tc">0:00</span><span id="td">${t ? fmt(t.dur) : '0:00'}</span></div>
        </div>
        ${action}
        <p class="muted" style="text-align:center;font-size:.86rem;margin-top:14px">${engine.joined ? 'Pode bloquear a tela: a música continua.' : 'Toque para entrar. O som sai no seu celular, no mesmo ritmo do veículo.'}</p>
        <p style="text-align:center"><button class="btn btn-ghost btn-sm" id="chg">Trocar de veículo</button></p>`;
      $('#join')?.addEventListener('click', async () => {
        await engine.join();
        if (!leavePresence) { try { leavePresence = await b.presence(`listeners/${ev}/${v}/${b.uid}`); } catch {} }
        render();
      });
      $('#back')?.addEventListener('click', () => engine.resumeMine());
      $('#mute')?.addEventListener('click', () => engine.pauseMine());
      $('#chg').addEventListener('click', () => { if (leavePresence) leavePresence(); const u = new URL(location.href); u.searchParams.delete('v'); location.href = u.href; });
      progress();
    }
    function progress() {
      const tl = engine.timeline(); const t = tl && tracks[tl.index];
      const pb = $('#pb'); if (!pb || !t) return;
      const d = engine.dur(tl.index) || t.dur || 0;
      pb.style.width = d ? Math.min(100, tl.pos / d * 100) + '%' : '0';
      $('#tc').textContent = fmt(tl.pos); $('#td').textContent = fmt(d);
    }
  }
}
