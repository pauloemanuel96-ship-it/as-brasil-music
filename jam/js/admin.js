/* Painel de administração: eventos, tema, playlist, pontos de embarque e monitor ao vivo */
import { connect, TS } from './backend.js';
import { PASSAGEIROS } from './config.js';
import { $, $$, esc, fmt, toArray, rid, slug, toast, qrSvg, baseUrl, copy, applyTheme, THEMES, I } from './common.js';
import { measure, calcTimeline } from './sync.js';

const app = $('#app');
let b, events = {}, sel = null, tab = 'evento', unsubs = [], impMsg = '';
const tokens = {};

init();
async function init() {
  b = await connect();
  applyTheme({ theme: 'kpop-roxo' });
  const u = await b.currentAdmin();
  if (u) main(); else login();
}

function login(msg = '') {
  app.innerHTML = `<div style="max-width:420px;margin:8vh auto 0">
    <div class="brandbar"><span class="dot"></span>AS Music Driver</div><h1>Painel admin</h1>
    ${b.mode === 'demo' ? '<div class="demo"><b>Modo demonstração.</b> Use qualquer e-mail e a senha <b>demo</b>. Os dados ficam só neste navegador.</div>' : ''}
    <form class="card" id="lf">
      <label class="field"><span>E-mail</span><input id="em" type="email" required autocomplete="username"></label>
      <label class="field"><span>Senha</span><input id="pw" type="password" required autocomplete="current-password"></label>
      <div class="err" id="er">${esc(msg)}</div>
      <button class="btn btn-main btn-block" id="go">Entrar</button></form></div>`;
  $('#lf').addEventListener('submit', async e => {
    e.preventDefault(); $('#go').disabled = true;
    try {
      const ok = await b.adminLogin($('#em').value.trim(), $('#pw').value);
      if (!ok) { await b.adminLogout(); login('Este usuário não está cadastrado como admin.'); return; }
      main();
    } catch (err) { $('#go').disabled = false; $('#er').textContent = 'E-mail ou senha incorretos.'; }
  });
}

function main() {
  app.innerHTML = `${b.mode === 'demo' ? '<div class="demo"><b>Modo demonstração:</b> os dados ficam só neste navegador. Abra o link do motorista e o do passageiro em outras abas para testar. Para usar de verdade, configure o Firebase em <code>jam/js/config.js</code>.</div>' : ''}
    <div class="row" style="justify-content:space-between;margin-bottom:8px"><div class="brandbar"><span class="dot"></span>AS Music Driver · Admin</div>
      <button class="btn btn-ghost btn-sm" id="out">Sair</button></div>
    <div class="admin"><aside class="side card"><button class="btn btn-main btn-block" id="newEv" style="margin-bottom:14px">+ Novo evento</button><div id="evs"></div></aside>
      <section id="ed"></section></div>`;
  $('#out').addEventListener('click', async () => { await b.adminLogout(); location.reload(); });
  $('#newEv').addEventListener('click', newEvent);
  b.listen('events', ev => {
    events = ev || {}; renderSide();
    if (sel && !events[sel]) sel = null;
    if (!sel) { const k = Object.keys(events)[0]; if (k) select(k); else renderEditor(); return; }
    const typing = document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (!(tab === 'evento' && typing)) renderEditor();
  });
}

function renderSide() {
  const ids = Object.keys(events).sort((a, c) => (events[c].info?.created || 0) - (events[a].info?.created || 0));
  $('#evs').innerHTML = ids.map(id => { const i = events[id].info || {}; const th = THEMES[i.theme] || THEMES['kpop-roxo'];
    return `<button class="ev ${id === sel ? 'sel' : ''}" data-id="${esc(id)}"><b><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${i.accent || th.accent};margin-right:8px"></span>${esc(i.name || id)}</b><small>${esc(i.date || 'sem data')} · ${toArray(events[id].playlist).length} músicas</small></button>`; }).join('')
    || '<p class="muted">Nenhum evento ainda.</p>';
  $$('#evs .ev').forEach(x => x.addEventListener('click', () => select(x.dataset.id)));
}
async function newEvent() {
  const name = prompt('Nome do evento (ex.: BTS Arirang Tour SP)');
  if (!name) return;
  const id = (slug(name) || 'evento') + '-' + rid(4);
  await b.set('events/' + id + '/info', { name: name.trim(), subtitle: 'Dê o play e cante junto até o show.', date: '', theme: 'kpop-roxo', created: TS });
  select(id);
}
function select(id) {
  sel = id;
  renderSide();
  b.get('tokens/' + id).then(t => { tokens[id] = t || {}; if (tab === 'pontos') renderEditor(); }).catch(() => {});
  renderEditor();
}

function renderEditor() {
  unsubs.forEach(u => u()); unsubs = [];
  const ed = $('#ed');
  if (!sel || !events[sel]) { ed.innerHTML = '<div class="card"><h2 class="display" style="margin-top:0">Comece criando um evento</h2><p class="muted">Cada evento tem seu tema, sua playlist e seus pontos de embarque.</p></div>'; return; }
  const e = events[sel]; const i = e.info || {};
  applyTheme(i);
  ed.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-end"><div><h1 style="margin:0 0 4px">${esc(i.name)}</h1><p class="sub" style="margin-bottom:14px">${esc(i.subtitle || '')}</p></div></div>
    <div class="tabs" role="tablist">${[['evento', 'Evento e tema'], ['playlist', 'Playlist'], ['pontos', 'Embarques e links'], ['aovivo', 'Ao vivo']].map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-t="${k}">${l}</button>`).join('')}</div>
    <div id="tab"></div>`;
  $$('.tabs button').forEach(x => x.addEventListener('click', () => { tab = x.dataset.t; renderEditor(); }));
  ({ evento: tabEvento, playlist: tabPlaylist, pontos: tabPontos, aovivo: tabAoVivo })[tab](e);
}

/* ---- Evento e tema ---- */
function tabEvento(e) {
  const i = e.info || {}; const cur = i.theme || 'kpop-roxo';
  $('#tab').innerHTML = `<div class="card"><div class="grid2">
      <label class="field"><span>Nome do evento</span><input id="f-name" value="${esc(i.name)}" maxlength="60"></label>
      <label class="field"><span>Data</span><input id="f-date" type="date" value="${esc(i.date || '')}"></label></div>
    <label class="field"><span>Frase para os passageiros</span><input id="f-sub" value="${esc(i.subtitle || '')}" maxlength="120"></label>
    <span class="field" style="margin-bottom:8px"><span>Tema</span></span>
    <div class="themes">${Object.entries(THEMES).map(([k, t]) => `<button class="theme" data-th="${k}" aria-pressed="${k === cur}" style="background:linear-gradient(135deg,${t.bg2},${t.bg});font-family:'${t.font}',sans-serif">${t.label}<i style="background:radial-gradient(circle,${t.accent2},${t.accent})"></i></button>`).join('')}</div>
    <div class="grid2"><label class="field"><span>Cor principal (opcional)</span><input id="f-a1" type="color" value="${i.accent || THEMES[cur].accent}"></label>
      <label class="field"><span>Cor de apoio (opcional)</span><input id="f-a2" type="color" value="${i.accent2 || THEMES[cur].accent2}"></label></div>
    <div class="row"><button class="btn btn-main" id="save">Salvar</button><button class="btn btn-ghost" id="reset">Usar cores do tema</button><span style="flex:1"></span><button class="btn btn-danger btn-sm" id="del">Excluir evento</button></div></div>
    <p class="muted" style="font-size:.86rem">Dica: use cores e clima do artista, mas evite logos e fotos oficiais, que são marcas registradas.</p>`;
  let theme = cur;
  $$('.theme').forEach(x => x.addEventListener('click', () => { theme = x.dataset.th; $$('.theme').forEach(y => y.setAttribute('aria-pressed', y === x)); $('#f-a1').value = THEMES[theme].accent; $('#f-a2').value = THEMES[theme].accent2; applyTheme({ theme }); }));
  $('#reset').addEventListener('click', () => { $('#f-a1').value = THEMES[theme].accent; $('#f-a2').value = THEMES[theme].accent2; });
  $('#save').addEventListener('click', async () => {
    const t = THEMES[theme]; const a1 = $('#f-a1').value, a2 = $('#f-a2').value;
    await b.update('events/' + sel + '/info', { name: $('#f-name').value.trim() || i.name, date: $('#f-date').value, subtitle: $('#f-sub').value.trim(), theme,
      accent: a1.toLowerCase() === t.accent.toLowerCase() ? null : a1, accent2: a2.toLowerCase() === t.accent2.toLowerCase() ? null : a2 });
    toast('Evento salvo.');
  });
  $('#del').addEventListener('click', async () => {
    if (prompt('Para excluir, digite o nome do evento: ' + i.name) !== i.name) return;
    await Promise.all([b.remove('events/' + sel), b.remove('tokens/' + sel), b.remove('jams/' + sel), b.remove('listeners/' + sel), b.remove('drivers/' + sel)]);
    sel = null; toast('Evento excluído.');
  });
}

/* ---- Playlist ---- */
function tabPlaylist(e) {
  const list = toArray(e.playlist);
  const total = list.reduce((a, t) => a + (t.dur || 0), 0);
  const defCat = new URL('../catalogo.json', location.href).href;
  $('#tab').innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><b>${list.length} músicas · ${Math.round(total / 60)} min</b>
      ${list.some(t => !t.dur) ? '<span class="pill" style="border-color:var(--danger)">Há músicas sem duração medida</span>' : ''}</div>
    <ul class="list" id="pl">${list.map((t, n) => `<li><span class="n">${n + 1}</span><div style="min-width:0"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist || '')} · ${t.dur ? fmt(t.dur) : 'sem duração'}</div></div>
      <div class="acts"><button class="ib" data-a="up" data-i="${n}" aria-label="Subir">${I.up}</button><button class="ib" data-a="down" data-i="${n}" aria-label="Descer">${I.down}</button><button class="ib" data-a="rm" data-i="${n}" aria-label="Remover">${I.x}</button></div></li>`).join('') || '<li style="display:block" class="muted">Playlist vazia.</li>'}</ul></div>
    <div class="card"><b>Importar a pasta de músicas do site</b><p class="muted" style="margin:4px 0 12px;font-size:.88rem">Puxa todas as faixas do catálogo gerado a partir da pasta <code>faixas/</code>.</p>
      <div class="row"><input id="cat" class="field" style="flex:1;margin:0;background:transparent;border:1px solid var(--line);border-radius:12px;padding:10px" value="${esc(defCat)}"><button class="btn btn-main btn-sm" id="imp">Importar</button></div>
      <p class="muted" id="impmsg" style="font-size:.86rem;margin:8px 0 0">${esc(impMsg)}</p></div>
    <div class="card"><b>Adicionar por link</b>
      <div class="grid2" style="margin-top:10px"><label class="field"><span>Link do arquivo (https)</span><input id="u"></label><label class="field"><span>Título</span><input id="tt"></label></div>
      <div class="grid2"><label class="field"><span>Artista</span><input id="ar"></label><div style="display:flex;align-items:flex-end;margin-bottom:14px"><button class="btn btn-main btn-sm" id="add">Adicionar</button></div></div>
      <button class="btn btn-ghost btn-sm" id="remeasure">Medir durações de novo</button></div>`;
  const save = l => b.set('events/' + sel + '/playlist', l.length ? l : null);
  $('#pl').addEventListener('click', ev => {
    const x = ev.target.closest('[data-a]'); if (!x) return; const n = +x.dataset.i; const l = list.slice();
    if (x.dataset.a === 'up' && n > 0) [l[n - 1], l[n]] = [l[n], l[n - 1]];
    if (x.dataset.a === 'down' && n < l.length - 1) [l[n + 1], l[n]] = [l[n], l[n + 1]];
    if (x.dataset.a === 'rm') l.splice(n, 1);
    save(l);
  });
  $('#imp').addEventListener('click', async () => {
    const url = $('#cat').value.trim(); const el = $('#impmsg');
    const msg = { set textContent(v) { impMsg = v; const x = $('#impmsg'); if (x) x.textContent = v; } };
    try {
      msg.textContent = 'Lendo o catálogo…';
      const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error();
      const cat = await r.json();
      const have = new Set(list.map(t => t.url));
      const novos = (cat.tracks || []).map(t => ({ id: t.id || rid(8), title: t.title, artist: t.artist || '', url: new URL(t.file, url).href, cover: t.cover ? new URL(t.cover, url).href : null, dur: t.dur || 0 })).filter(t => !have.has(t.url));
      if (!novos.length) { msg.textContent = 'Nenhuma música nova nesse catálogo.'; return; }
      for (let k = 0; k < novos.length; k++) { msg.textContent = `Medindo duração ${k + 1} de ${novos.length}…`; const d = await measure(novos[k].url); if (d) novos[k].dur = d; }
      await save(list.concat(novos)); msg.textContent = `${novos.length} músicas importadas.`;
    } catch { msg.textContent = 'Não foi possível ler esse catálogo. Confira o link.'; }
  });
  $('#add').addEventListener('click', async () => {
    const url = $('#u').value.trim(); if (!/^https?:\/\//.test(url)) { toast('Informe um link começando com https://'); return; }
    toast('Medindo a duração…'); const dur = await measure(url);
    if (!dur) { toast('Não consegui abrir esse áudio. Confira se o link é público.'); return; }
    await save(list.concat([{ id: rid(8), title: $('#tt').value.trim() || 'Sem título', artist: $('#ar').value.trim(), url, cover: null, dur }]));
  });
  $('#remeasure').addEventListener('click', async () => {
    const l = list.slice(); for (let k = 0; k < l.length; k++) { toast(`Medindo ${k + 1} de ${l.length}…`, 1200); const d = await measure(l[k].url); if (d) l[k] = { ...l[k], dur: d }; }
    await save(l); toast('Durações atualizadas.');
  });
}

/* ---- Pontos de embarque e links ---- */
function tabPontos(e) {
  const pts = e.points || {}; const tk = tokens[sel] || {};
  const base = baseUrl();
  const ids = Object.keys(pts).sort((a, c) => String(pts[a].time || '').localeCompare(String(pts[c].time || '')));
  $('#tab').innerHTML = `<div class="card"><b>Novo ponto de embarque</b>
      <div class="grid2" style="margin-top:10px"><label class="field"><span>Nome do ponto</span><input id="pn" placeholder="Ex.: Shopping Center Norte"></label>
      <label class="field"><span>Horário de saída</span><input id="ph" type="time"></label></div>
      <div class="row"><button class="btn btn-main btn-sm" id="padd">Adicionar ponto</button>${ids.length && PASSAGEIROS ? '<button class="btn btn-ghost btn-sm" id="print">Imprimir QR dos passageiros</button>' : ''}</div></div>
    ${ids.map(pid => { const p = pts[pid]; const k = tk[pid];
      const drv = k ? `${base}motorista.html?e=${encodeURIComponent(sel)}&p=${pid}&k=${k}` : '';
      const pas = `${base}index.html?e=${encodeURIComponent(sel)}&p=${pid}`;
      return `<div class="card point"><div><b style="font-size:1.1rem">${esc(p.name)}</b> <span class="muted">${esc(p.time || '')}</span>
          <p class="muted" style="font-size:.8rem;margin:10px 0 0">LINK DO MOTORISTA (envie só para os motoristas)</p>
          <div class="link"><code>${esc(drv || 'gerando…')}</code><button class="ib" data-cp="${esc(drv)}" aria-label="Copiar">${I.copy}</button></div>
          ${PASSAGEIROS ? `<p class="muted" style="font-size:.8rem;margin:10px 0 0">LINK DOS PASSAGEIROS</p>
          <div class="link"><code>${esc(pas)}</code><button class="ib" data-cp="${esc(pas)}" aria-label="Copiar">${I.copy}</button></div>` : ''}
          <div class="row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-new="${pid}">Gerar novo link de motorista</button><button class="btn btn-danger btn-sm" data-rm="${pid}">Remover ponto</button></div></div>
        <div class="qrbox">${drv ? `<div class="qr">${qrSvg(drv)}</div>Motorista` : ''}</div>
        ${PASSAGEIROS ? `<div class="qrbox"><div class="qr">${qrSvg(pas)}</div>Passageiros</div>` : ''}</div>`; }).join('')}`;
  $('#padd').addEventListener('click', async () => {
    const name = $('#pn').value.trim(); if (!name) { toast('Dê um nome ao ponto.'); return; }
    const pid = (slug(name).slice(0, 16).replace(/-+$/, '') || 'ponto') + '-' + rid(3); const k = rid(12);
    await b.set(`tokens/${sel}/${pid}`, k); tokens[sel] = { ...(tokens[sel] || {}), [pid]: k };
    await b.set(`events/${sel}/points/${pid}`, { name, time: $('#ph').value || '' });
  });
  $$('[data-cp]').forEach(x => x.addEventListener('click', () => x.dataset.cp && copy(x.dataset.cp)));
  $$('[data-new]').forEach(x => x.addEventListener('click', async () => {
    if (!confirm('O link antigo deixa de funcionar para novos acessos. Continuar?')) return;
    const k = rid(12); await b.set(`tokens/${sel}/${x.dataset.new}`, k); tokens[sel] = { ...(tokens[sel] || {}), [x.dataset.new]: k }; renderEditor();
  }));
  $$('[data-rm]').forEach(x => x.addEventListener('click', async () => {
    if (!confirm('Remover este ponto de embarque?')) return;
    await b.remove(`events/${sel}/points/${x.dataset.rm}`); await b.remove(`tokens/${sel}/${x.dataset.rm}`);
  }));
  $('#print')?.addEventListener('click', () => {
    const i = e.info || {}; const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR · ${esc(i.name)}</title><style>body{font-family:system-ui,sans-serif;margin:0}.pg{page-break-after:always;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:96vh;text-align:center;padding:20px}h1{font-size:40px;margin:0 0 6px}h2{font-size:26px;margin:0 0 24px;font-weight:600}.q{width:420px}p{font-size:22px}</style></head><body>${ids.map(pid => `<div class="pg"><h1>${esc(i.name)}</h1><h2>${esc(pts[pid].name)} ${esc(pts[pid].time || '')}</h2><div class="q">${qrSvg(base + 'index.html?e=' + encodeURIComponent(sel) + '&p=' + pid)}</div><p>Aponte a câmera, escolha o número do seu veículo e ouça junto com a gente.</p></div>`).join('')}</body></html>`);
    w.document.close(); setTimeout(() => w.print(), 400);
  });
}

/* ---- Ao vivo ---- */
function tabAoVivo(e) {
  $('#tab').innerHTML = `<div class="kpis"><div class="kpi"><b id="k1">0</b><small>veículos conectados</small></div><div class="kpi"><b id="k2">0</b><small>tocando agora</small></div>${PASSAGEIROS ? '<div class="kpi"><b id="k3">0</b><small>passageiros ouvindo</small></div>' : ''}</div>
    <div class="card scroll"><table class="live"><thead><tr><th>Veículo</th><th>Motorista</th><th>Embarque</th><th>Status</th><th>Música</th>${PASSAGEIROS ? '<th>Ouvintes</th>' : ''}<th></th></tr></thead><tbody id="lv"></tbody></table></div>`;
  let jams = {}, lis = {};
  const draw = () => {
    const tracks = toArray((events[sel] || {}).playlist); const pts = (events[sel] || {}).points || {};
    const now = b.serverNow();
    const rows = Object.entries(jams).filter(([, j]) => j && j.info).sort((a, c) => String(a[1].info.label).localeCompare(String(c[1].info.label), 'pt', { numeric: true }));
    let playing = 0, total = 0;
    $('#lv').innerHTML = rows.map(([v, j]) => {
      const tl = calcTimeline(j.state, tracks, now); const t = tl && tracks[tl.index];
      const n = lis[v] ? Object.keys(lis[v]).length : 0; total += n; if (tl && tl.playing) playing++;
      const stale = now - (j.info.updated || 0) > 5 * 60e3;
      return `<tr><td><b>${esc(j.info.label)}</b></td><td>${esc(j.info.driver || '')}</td><td>${esc((pts[j.info.point] || {}).name || '')}</td>
        <td>${tl && tl.playing ? '<span class="pill live">Tocando</span>' : '<span class="pill">Parado</span>'}${stale ? ' <span class="muted" style="font-size:.78rem">motorista offline</span>' : ''}</td>
        <td>${t ? esc(t.title) + ' <span class="muted">' + fmt(tl.pos) + '</span>' : ''}</td>${PASSAGEIROS ? `<td>${n}</td>` : ''}
        <td><button class="btn btn-danger btn-sm" data-end="${esc(v)}">Encerrar</button></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="muted">Nenhum veículo conectado ainda.</td></tr>';
    $('#k1').textContent = rows.length; $('#k2').textContent = playing; if ($('#k3')) $('#k3').textContent = total;
    $$('[data-end]').forEach(x => x.addEventListener('click', async () => { if (confirm('Encerrar a JAM deste veículo?')) { await b.remove(`jams/${sel}/${x.dataset.end}`); await b.remove(`listeners/${sel}/${x.dataset.end}`); } }));
  };
  unsubs.push(b.listen('jams/' + sel, j => { jams = j || {}; draw(); }));
  if (PASSAGEIROS) unsubs.push(b.listen('listeners/' + sel, l => { lis = l || {}; draw(); }));
  const t = setInterval(() => { if (!$('#lv')) return clearInterval(t); draw(); }, 3000);
  unsubs.push(() => clearInterval(t));
}
