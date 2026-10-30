/* AS Brasil Music — app do ouvinte e estúdio do artista */
(() => {
'use strict';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fmt = s => { if (!isFinite(s) || s < 0) return '0:00'; s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const rid = (n = 16) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); };
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
const clone = o => JSON.parse(JSON.stringify(o));

const I = {
  play:'<svg class="i f" viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause:'<svg class="i f" viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  next:'<svg class="i f" viewBox="0 0 24 24"><path d="M5 6.2v11.6a1 1 0 0 0 1.53.85L15 13.2V17a1 1 0 0 0 2 0V7a1 1 0 0 0-2 0v3.8L6.53 5.35A1 1 0 0 0 5 6.2z"/></svg>',
  prev:'<svg class="i f" viewBox="0 0 24 24"><path d="M19 6.2v11.6a1 1 0 0 1-1.53.85L9 13.2V17a1 1 0 0 1-2 0V7a1 1 0 0 1 2 0v3.8l8.47-5.45A1 1 0 0 1 19 6.2z"/></svg>',
  shuffle:'<svg class="i" viewBox="0 0 24 24"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>',
  repeat:'<svg class="i" viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
  heart:'<svg class="i" viewBox="0 0 24 24"><path d="M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 7.5 6.3z"/></svg>',
  heartF:'<svg class="i f" viewBox="0 0 24 24"><path d="M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 7.5 6.3z"/></svg>',
  search:'<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  x:'<svg class="i" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  down:'<svg class="i" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  up:'<svg class="i" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>',
  upload:'<svg class="i" viewBox="0 0 24 24"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  share:'<svg class="i" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
  vol:'<svg class="i" viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  studio:'<svg class="i" viewBox="0 0 24 24"><path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  out:'<svg class="i" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>'
};

/* ---------- API (PHP na hospedagem) ---------- */
const API = 'api/';
let CSRF = null;
async function apiCall(path, { method = 'GET', json, body, headers = {} } = {}) {
  const h = { ...headers };
  if (CSRF && method !== 'GET') h['X-CSRF'] = CSRF;
  if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  const r = await fetch(API + path, { method, body, headers: h, credentials: 'same-origin', cache: 'no-store' });
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) { const e = new Error((data && data.mensagem) || ('HTTP ' + r.status)); e.status = r.status; e.code = data && data.erro; e.data = data; throw e; }
  return data;
}

/* ---------- estado ---------- */
const DEFAULT = { v: 1, site: { name: 'AS Brasil Music', tagline: 'Dê o play e continue ouvindo enquanto usa outros apps.', artist: 'AS Brasil Music' }, tracks: [] };
const S = { cat: clone(DEFAULT), published: clone(DEFAULT), loaded: false, static: false, dirty: false, filter: 'all', q: '', admin: false, jobs: [], highlight: null, busy: 0 };
const favs = new Set(LS.get('asbm:favs') || []);
const byId = id => S.cat.tracks.find(t => t.id === id);
const artistOf = t => t.artist || S.cat.site.artist;

function artHTML(t, cls = '') {
  const h = t ? (t.hue ?? 272) : 272;
  const ini = t ? esc((t.title || '?').trim().charAt(0).toUpperCase()) : '';
  const img = t && t.cover ? `<img src="${esc(t.cover)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<div class="art ${cls}" style="--th:${h}"><span class="ini">${ini}</span>${img}</div>`;
}
function setAura(t) { document.body.style.setProperty('--h', t ? (t.hue ?? 272) : 272); }

/* ---------- estrutura da página ---------- */
$('#root').innerHTML = `
<header class="top"><div class="top-in">
  <a class="brand" href="./"><div class="mark" aria-hidden="true"></div><b id="brandName">AS Brasil Music</b></a>
  <label class="search">${I.search}<span class="sr">Buscar músicas</span><input id="q" type="search" placeholder="Buscar música" autocomplete="off"></label>
  <button class="btn btn-ghost btn-sm studio-btn" id="openStudio">${I.studio}<span>Estúdio</span></button>
</div></header>
<main>
  <section class="hero" id="hero"></section>
  <section aria-labelledby="lbl-list">
    <div class="bar"><h2 id="lbl-list">Faixas</h2>
      <div class="seg" role="group" aria-label="Filtrar faixas">
        <button data-f="all" aria-pressed="true">Todas</button><button data-f="fav" aria-pressed="false">Favoritas</button>
      </div></div>
    <ol class="list" id="list"><li class="skel"></li><li class="skel"></li><li class="skel"></li></ol>
  </section>
</main>
<footer class="foot">
  <span id="copy"></span>
  <span class="links">
    <button id="installBtn" hidden>Instalar app</button>
    <button id="adminLink">Área do artista</button>
  </span>
  <p class="ios-tip" id="iosTip" hidden>No iPhone, toque em Compartilhar e depois em “Adicionar à Tela de Início” para usar como app.</p>
</footer>
<div class="mini hidden" id="mini"><div class="mini-in">
  <button class="mini-open" id="miniOpen" aria-label="Abrir player">
    <span id="miniArt"></span><span class="info"><span class="t" id="miniT"></span><span class="a" id="miniA"></span></span>
  </button>
  <div class="ctl">
    <button class="icon-btn hide-sm" id="miniPrev" aria-label="Faixa anterior">${I.prev}</button>
    <button class="icon-btn play" id="miniPlay" aria-label="Tocar">${I.play}</button>
    <button class="icon-btn" id="miniNext" aria-label="Próxima faixa">${I.next}</button>
  </div>
  <div class="prog" id="miniProg"></div>
</div></div>
<section class="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="Tocando agora">
  <div class="sheet-head">
    <button class="icon-btn" id="closeSheet" aria-label="Fechar player">${I.down}</button>
    <span class="lbl">Tocando agora</span>
    <button class="icon-btn" id="shareBtn" aria-label="Compartilhar esta música">${I.share}</button>
  </div>
  <div class="player">
    <div class="disc-wrap"><div class="disc spin"><div class="label" id="npLabel"></div></div></div>
    <div>
      <div class="np-row"><div style="min-width:0"><h2 class="np-t" id="npT"></h2><p class="np-a" id="npA"></p></div>
        <button class="icon-btn" id="npFav" aria-label="Favoritar">${I.heart}</button></div>
      <div class="seek"><input type="range" id="seek" min="0" max="1000" value="0" step="1" aria-label="Posição da música">
        <div class="times"><span id="tCur">0:00</span><span id="tDur">0:00</span></div></div>
      <div class="controls">
        <button class="icon-btn dim" id="shuf" aria-label="Aleatório" aria-pressed="false">${I.shuffle}</button>
        <button class="icon-btn" id="prev" aria-label="Faixa anterior">${I.prev}</button>
        <button class="big" id="play" aria-label="Tocar">${I.play}</button>
        <button class="icon-btn" id="next" aria-label="Próxima faixa">${I.next}</button>
        <button class="icon-btn dim badge" id="rep" aria-label="Repetir: desligado">${I.repeat}<small></small></button>
      </div>
      <label class="vol">${I.vol}<span class="sr">Volume</span><input type="range" id="vol" min="0" max="100" value="100"></label>
      <p class="note" id="tapNote" hidden>Toque em ▶ para começar. O navegador pede um toque antes do primeiro som.</p>
      <div class="queue"><h3>A seguir</h3><ol class="list" id="queue"></ol></div>
    </div>
  </div>
</section>
<div class="overlay" id="loginBox"><form class="modal" id="loginForm" role="dialog" aria-modal="true" aria-labelledby="lgT">
  <h2 id="lgT">Área do artista</h2>
  <p>Entre para enviar músicas e editar o site.</p>
  <label class="field"><span>Senha</span><input type="password" id="senha" autocomplete="current-password" required></label>
  <div class="err" id="lgErr" role="alert"></div>
  <div class="row-btns"><button type="button" class="btn btn-ghost" id="lgCancel">Cancelar</button><button class="btn btn-primary" id="lgGo">Entrar</button></div>
</form></div>
<div class="overlay" id="studio"><aside class="panel" role="dialog" aria-modal="true" aria-label="Estúdio">
  <div class="panel-head"><h2>Estúdio</h2>
    <button class="btn btn-ghost btn-sm" id="logout">${I.out}<span>Sair</span></button>
    <button class="icon-btn" id="closeStudio" aria-label="Fechar estúdio">${I.x}</button></div>
  <div class="panel-body" id="studioBody"></div>
  <div class="panel-foot"><span class="msg" id="pubMsg">Tudo publicado.</span><button class="btn btn-primary" id="publish" disabled>Publicar alterações</button></div>
</aside></div>
<div class="toasts" id="toasts" aria-live="polite"></div>`;

function toast(msg, action) {
  const el = document.createElement('div');
  el.className = 'toast';
  const sp = document.createElement('span'); sp.textContent = msg; el.appendChild(sp);
  if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { el.remove(); action.run(); }; el.appendChild(b); }
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), action ? 9000 : 4200);
}

/* ---------- renderização ---------- */
function visibleTracks() {
  const q = S.q.trim().toLowerCase();
  return S.cat.tracks.filter(t =>
    (S.filter !== 'fav' || favs.has(t.id)) &&
    (!q || (t.title + ' ' + artistOf(t) + ' ' + (t.album || '')).toLowerCase().includes(q)));
}
function renderHero() {
  const s = S.cat.site, n = S.cat.tracks.length;
  const total = S.cat.tracks.reduce((a, t) => a + (t.dur || 0), 0);
  document.title = s.name;
  $('#brandName').textContent = s.name;
  $('#copy').textContent = '© ' + new Date().getFullYear() + ' ' + s.name;
  const cur = P.current();
  const feat = cur || S.cat.tracks[0];
  if (!cur) setAura(feat);
  const playing = cur && !audio.paused;
  $('#hero').innerHTML = `
    <div>
      <h1>${esc(s.name)}</h1>
      <p class="tag">${esc(s.tagline)}</p>
      <div class="actions">
        <button class="btn btn-primary" id="playAll" ${n ? '' : 'disabled'}>${I.play}<span>Ouvir tudo</span></button>
        <button class="btn btn-ghost" id="shuffleAll" ${n ? '' : 'disabled'}>${I.shuffle}<span>Aleatório</span></button>
      </div>
      <p class="stats">${n ? `${n} ${n === 1 ? 'faixa' : 'faixas'}, ${Math.max(1, Math.round(total / 60))} min de música` : ''}</p>
    </div>
    <div class="feature">
      <div class="disc-wrap"><div class="disc spin"><div class="label">${artHTML(feat)}</div></div></div>
      ${feat ? `<div class="feature-cap"><span class="txt"><small>${cur ? 'Tocando agora' : 'Lançamento mais recente'}</small><strong>${esc(feat.title)}</strong></span>
        <button class="round" id="featPlay" aria-label="${playing ? 'Pausar' : 'Tocar ' + esc(feat.title)}">${playing ? I.pause : I.play}</button></div>` : ''}
    </div>`;
  $('#playAll')?.addEventListener('click', () => P.playList(S.cat.tracks.map(t => t.id), 0, false));
  $('#shuffleAll')?.addEventListener('click', () => P.playList(S.cat.tracks.map(t => t.id), -1, true));
  $('#featPlay')?.addEventListener('click', () => {
    if (cur) P.toggle();
    else P.playList(S.cat.tracks.map(t => t.id), 0, false);
  });
}
function rowHTML(t, i) {
  const cur = P.current();
  const isCur = cur && cur.id === t.id;
  const f = favs.has(t.id);
  const lead = isCur ? `<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>` : `<span class="num">${i + 1}</span><span class="pi">${I.play}</span>`;
  return `<li class="row ${isCur ? 'current' : ''} ${S.highlight === t.id ? 'highlight' : ''}" data-id="${t.id}" tabindex="0" aria-label="Tocar ${esc(t.title)}">
    <span class="n">${lead}</span>${artHTML(t)}
    <span class="meta"><span class="t">${esc(t.title)}</span><span class="a">${esc(artistOf(t))}</span></span>
    <span class="alb">${esc(t.album || '')}</span>
    <span class="d">${fmt(t.dur)}</span>
    <button class="icon-btn ${f ? 'on' : ''}" data-fav="${t.id}" aria-label="${f ? 'Remover das favoritas' : 'Favoritar'}" aria-pressed="${f}">${f ? I.heartF : I.heart}</button>
  </li>`;
}
function renderList() {
  if (!S.loaded) return;
  const list = visibleTracks();
  const el = $('#list');
  if (!S.cat.tracks.length) {
    el.innerHTML = `<li class="empty"><strong>Nenhuma faixa por aqui ainda</strong>${S.static ? 'Envie arquivos para a pasta faixas do repositório e eles aparecem aqui.' : S.admin ? 'Envie suas primeiras músicas pelo Estúdio.<br><button class="btn btn-primary" id="emptyUp">' + I.upload + '<span>Enviar músicas</span></button>' : 'Volte em breve para ouvir as novidades.'}</li>`;
    $('#emptyUp')?.addEventListener('click', openStudio);
    return;
  }
  if (!list.length) {
    const favEmpty = S.filter === 'fav' && !S.q;
    el.innerHTML = `<li class="empty"><strong>${favEmpty ? 'Sem favoritas' : 'Nada encontrado'}</strong>${favEmpty ? 'Toque no coração de uma música para guardá-la aqui.' : 'Tente outro nome de música ou artista.'}</li>`;
    return;
  }
  el.innerHTML = list.map(rowHTML).join('');
}
function renderQueue() {
  const ids = P.queue.slice(P.i + 1, P.i + 30);
  $('#queue').innerHTML = ids.length ? ids.map(id => {
    const t = byId(id); if (!t) return '';
    return `<li class="row" data-q="${id}" tabindex="0">${artHTML(t)}<span class="meta"><span class="t">${esc(t.title)}</span><span class="a">${esc(artistOf(t))}</span></span><span class="d">${fmt(t.dur)}</span></li>`;
  }).join('') : `<li class="empty" style="padding:20px">${P.repeat === 'all' ? 'A lista recomeça depois desta.' : 'Esta é a última da fila.'}</li>`;
}
function renderPlayer() {
  const t = P.current();
  const playing = !!t && !audio.paused;
  document.body.classList.toggle('is-playing', playing);
  document.body.classList.toggle('is-paused', !playing);
  $('#mini').classList.toggle('hidden', !t);
  if (!t) return;
  setAura(t);
  const icon = P.loading ? '<span class="spinner" aria-hidden="true"></span>' : (playing ? I.pause : I.play);
  const label = playing ? 'Pausar' : 'Tocar';
  $('#miniArt').innerHTML = artHTML(t);
  $('#miniT').textContent = t.title;
  $('#miniA').textContent = artistOf(t);
  for (const id of ['#miniPlay', '#play']) { $(id).innerHTML = icon; $(id).setAttribute('aria-label', label); }
  $('#npLabel').innerHTML = artHTML(t);
  $('#npT').textContent = t.title;
  $('#npA').textContent = artistOf(t);
  const f = favs.has(t.id);
  $('#npFav').innerHTML = f ? I.heartF : I.heart; $('#npFav').classList.toggle('on', f);
  $('#npFav').setAttribute('aria-label', f ? 'Remover das favoritas' : 'Favoritar');
  $('#shuf').classList.toggle('on', P.shuffle); $('#shuf').classList.toggle('dim', !P.shuffle); $('#shuf').setAttribute('aria-pressed', P.shuffle);
  $('#rep').classList.toggle('on', P.repeat !== 'off'); $('#rep').classList.toggle('dim', P.repeat === 'off');
  $('#rep small').textContent = P.repeat === 'one' ? '1' : '';
  $('#rep').setAttribute('aria-label', 'Repetir: ' + ({ off: 'desligado', all: 'todas', one: 'esta faixa' })[P.repeat]);
  $('#tapNote').hidden = !P.needsTap;
  if (!isFinite(audio.duration)) $('#tDur').textContent = fmt(t.dur);
  renderQueue();
}
function renderAll() { renderHero(); renderList(); renderPlayer(); }

/* ---------- player ---------- */
const audio = document.createElement('audio');
audio.preload = 'metadata';
audio.setAttribute('playsinline', '');
document.body.appendChild(audio);

const P = {
  queue: [], i: -1, shuffle: false, repeat: 'off', loading: false, needsTap: false,
  current() { return this.i >= 0 ? byId(this.queue[this.i]) : null; },
  playList(ids, start, shuffle) {
    this.shuffle = !!shuffle;
    let q = ids.slice();
    const first = start >= 0 ? q[start] : null;
    if (this.shuffle) {
      q = q.filter(id => id !== first);
      for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
      if (first) q.unshift(first);
      this.queue = q; this.load(0);
    } else { this.queue = q; this.load(Math.max(0, start)); }
  },
  /* Chamado direto do toque: o play acontece no mesmo gesto, o que o iPhone exige. */
  load(idx, autoplay = true) {
    this.i = idx;
    const t = this.current();
    if (!t) return;
    this.needsTap = false;
    audio.src = t.file;
    this.loading = true;
    setMeta(t);
    if (autoplay) {
      const p = audio.play();
      if (p) p.catch(e => {
        if (e && e.name === 'NotAllowedError') { this.needsTap = true; this.loading = false; renderPlayer(); }
      });
    }
    renderAll();
    this.preloadNext();
  },
  preloadNext() {
    const n = this.queue[this.i + 1] ?? (this.repeat === 'all' ? this.queue[0] : null);
    const t = n && byId(n);
    if (!t) return;
    // aquece a conexão com o início do próximo arquivo
    fetch(t.file, { headers: { Range: 'bytes=0-65535' } }).catch(() => {});
  },
  toggle() {
    if (this.i < 0) { const v = visibleTracks(); if (v.length) this.playList(v.map(t => t.id), 0, false); return; }
    if (!audio.src) { this.load(this.i); return; }
    if (audio.paused) { this.needsTap = false; audio.play().catch(() => { this.needsTap = true; renderPlayer(); }); }
    else audio.pause();
  },
  next(auto = false) {
    if (!this.queue.length) return;
    if (auto && this.repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    let n = this.i + 1;
    if (n >= this.queue.length) {
      if (this.repeat === 'all' || !auto) n = 0;
      else { audio.pause(); audio.currentTime = 0; renderPlayer(); return; }
    }
    this.load(n);
  },
  prev() {
    if (!this.queue.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    this.load(this.i > 0 ? this.i - 1 : (this.repeat === 'all' ? this.queue.length - 1 : 0));
  },
  toggleShuffle() {
    this.shuffle = !this.shuffle;
    const cur = this.queue[this.i];
    if (cur) {
      if (this.shuffle) {
        const rest = this.queue.filter(id => id !== cur);
        for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
        this.queue = [cur, ...rest]; this.i = 0;
      } else { this.queue = S.cat.tracks.map(t => t.id); this.i = this.queue.indexOf(cur); }
    }
    renderPlayer(); this.preloadNext();
  },
  cycleRepeat() { this.repeat = ({ off: 'all', all: 'one', one: 'off' })[this.repeat]; renderPlayer(); }
};

/* Media Session: controles na tela de bloqueio e nas notificações */
const coverCache = new Map();
function generatedCover(t) {
  if (coverCache.has(t.id)) return Promise.resolve(coverCache.get(t.id));
  return new Promise(res => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const x = c.getContext('2d'); const h = t.hue ?? 272;
      const g = x.createLinearGradient(0, 0, 512, 512);
      g.addColorStop(0, `hsl(${h + 25} 90% 68%)`); g.addColorStop(.5, `hsl(${h} 75% 45%)`); g.addColorStop(1, `hsl(${h - 30} 70% 22%)`);
      x.fillStyle = g; x.fillRect(0, 0, 512, 512);
      x.globalAlpha = .18; x.strokeStyle = '#fff'; x.lineWidth = 2;
      for (let r = 40; r < 420; r += 22) { x.beginPath(); x.arc(380, 400, r, 0, Math.PI * 2); x.stroke(); }
      x.globalAlpha = 1; x.fillStyle = '#fff'; x.font = '800 230px Unbounded, Arial Black, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText((t.title || '?').trim().charAt(0).toUpperCase(), 256, 270);
      c.toBlob(b => { if (!b) return res(null); const u = URL.createObjectURL(b); coverCache.set(t.id, u); res(u); }, 'image/png');
    } catch { res(null); }
  });
}
async function setMeta(t) {
  if (!('mediaSession' in navigator)) return;
  let artwork = [];
  if (t.cover) artwork = [{ src: new URL(t.cover, location.href).href, sizes: '800x800', type: 'image/jpeg' }];
  else { const u = await generatedCover(t); if (u) artwork = [{ src: u, sizes: '512x512', type: 'image/png' }]; }
  if (P.current() !== t) return;
  try { navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: artistOf(t), album: t.album || S.cat.site.name, artwork }); } catch {}
}
if ('mediaSession' in navigator) {
  const h = [
    ['play', () => audio.play().catch(() => {})],
    ['pause', () => audio.pause()],
    ['previoustrack', () => P.prev()],
    ['nexttrack', () => P.next()],
    ['seekbackward', d => { audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10)); }],
    ['seekforward', d => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (d.seekOffset || 10)); }],
    ['seekto', d => { if (d.fastSeek && 'fastSeek' in audio) audio.fastSeek(d.seekTime); else audio.currentTime = d.seekTime; }]
  ];
  for (const [a, fn] of h) { try { navigator.mediaSession.setActionHandler(a, fn); } catch {} }
}
let lastPos = 0;
function updatePosition(force) {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  const now = Date.now(); if (!force && now - lastPos < 1000) return; lastPos = now;
  if (isFinite(audio.duration) && audio.duration > 0) {
    try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) }); } catch {}
  }
}

let seeking = false, raf = 0;
function paintProgress() {
  raf = 0;
  const d = audio.duration, c = audio.currentTime;
  const pct = isFinite(d) && d > 0 ? (c / d) * 100 : 0;
  $('#miniProg').style.width = pct + '%';
  if (!seeking) { $('#seek').value = Math.round(pct * 10); $('#seek').style.setProperty('--p', pct + '%'); $('#tCur').textContent = fmt(c); }
  $('#tDur').textContent = fmt(isFinite(d) ? d : (P.current()?.dur || 0));
}
audio.addEventListener('timeupdate', () => { if (!raf) raf = requestAnimationFrame(paintProgress); updatePosition(false); });
audio.addEventListener('loadedmetadata', () => { paintProgress(); updatePosition(true); });
audio.addEventListener('waiting', () => { P.loading = true; renderPlayer(); });
audio.addEventListener('playing', () => { P.loading = false; renderPlayer(); renderHero(); });
audio.addEventListener('canplay', () => { if (P.loading) { P.loading = false; renderPlayer(); } });
audio.addEventListener('play', () => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; P.needsTap = false; renderPlayer(); });
audio.addEventListener('pause', () => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; renderPlayer(); renderHero(); });
audio.addEventListener('ended', () => P.next(true));
audio.addEventListener('error', () => {
  if (!audio.src) return;
  P.loading = false;
  const t = P.current();
  toast(`“${t ? t.title : 'Esta música'}” não pôde ser tocada. Indo para a próxima.`);
  if (P.queue.length > 1) setTimeout(() => P.next(true), 800); else renderPlayer();
});

/* ---------- eventos da interface ---------- */
$('#q').addEventListener('input', e => { S.q = e.target.value; renderList(); });
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
  S.filter = b.dataset.f;
  document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
  renderList();
}));
function toggleFav(id) {
  favs.has(id) ? favs.delete(id) : favs.add(id);
  LS.set('asbm:favs', [...favs]);
  renderList(); renderPlayer();
}
$('#list').addEventListener('click', e => {
  const f = e.target.closest('[data-fav]'); if (f) { e.stopPropagation(); toggleFav(f.dataset.fav); return; }
  const r = e.target.closest('.row'); if (!r || !r.dataset.id) return;
  const cur = P.current();
  if (cur && cur.id === r.dataset.id && audio.src) { P.toggle(); return; }
  const ids = visibleTracks().map(t => t.id);
  P.playList(ids, ids.indexOf(r.dataset.id), P.shuffle);
});
$('#list').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('row')) { e.preventDefault(); e.target.click(); } });
$('#queue').addEventListener('click', e => { const r = e.target.closest('[data-q]'); if (r) P.load(P.queue.indexOf(r.dataset.q, P.i + 1)); });
$('#miniPlay').addEventListener('click', () => P.toggle());
$('#play').addEventListener('click', () => P.toggle());
$('#miniNext').addEventListener('click', () => P.next());
$('#next').addEventListener('click', () => P.next());
$('#miniPrev').addEventListener('click', () => P.prev());
$('#prev').addEventListener('click', () => P.prev());
$('#shuf').addEventListener('click', () => P.toggleShuffle());
$('#rep').addEventListener('click', () => P.cycleRepeat());
$('#npFav').addEventListener('click', () => { const t = P.current(); if (t) toggleFav(t.id); });

const sheet = $('#sheet');
function openSheet() { sheet.classList.add('open'); document.body.style.overflow = 'hidden'; $('#closeSheet').focus(); }
function closeSheet() { sheet.classList.remove('open'); document.body.style.overflow = ''; }
$('#miniOpen').addEventListener('click', openSheet);
$('#closeSheet').addEventListener('click', closeSheet);
$('#shareBtn').addEventListener('click', async () => {
  const t = P.current(); if (!t) return;
  const url = location.origin + location.pathname + '#' + t.id;
  if (navigator.share) { try { await navigator.share({ title: t.title, text: `${t.title}, de ${artistOf(t)}`, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('Link da música copiado.'); }
  catch { history.replaceState(null, '', '#' + t.id); toast('Copie o endereço da página para compartilhar esta música.'); }
});
const seek = $('#seek');
seek.addEventListener('input', () => {
  seeking = true;
  const pct = seek.value / 10; seek.style.setProperty('--p', pct + '%');
  if (isFinite(audio.duration)) $('#tCur').textContent = fmt(audio.duration * pct / 100);
});
seek.addEventListener('change', () => {
  if (isFinite(audio.duration)) audio.currentTime = audio.duration * (seek.value / 1000);
  seeking = false; updatePosition(true);
});
const vol = $('#vol');
vol.style.setProperty('--p', '100%');
vol.addEventListener('input', () => { audio.volume = vol.value / 100; vol.style.setProperty('--p', vol.value + '%'); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('#loginBox').classList.contains('open')) closeLogin();
    else if ($('#studio').classList.contains('open')) closeStudio();
    else if (sheet.classList.contains('open')) closeSheet();
    return;
  }
  if (e.target.closest('input')) return;
  if (e.code === 'Space' && !e.target.closest('button,.row')) { e.preventDefault(); P.toggle(); }
});

/* Link direto para uma música: dominio.com.br/#id */
function applyHash() {
  const id = location.hash.slice(1);
  const t = id && byId(id);
  if (!t) return;
  S.highlight = id;
  if (!(P.current() && P.current().id === id)) {
    P.queue = S.cat.tracks.map(x => x.id); P.i = P.queue.indexOf(id);
    setMeta(t);
  }
  renderAll();
  requestAnimationFrame(() => document.querySelector(`.row[data-id="${id}"]`)?.scrollIntoView({ block: 'center' }));
}
window.addEventListener('hashchange', applyHash);

/* ---------- instalar como app (PWA) ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; });
$('#installBtn').addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; $('#installBtn').hidden = true; });
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (isIOS && !standalone) $('#iosTip').hidden = false;
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- login ---------- */
function openLogin() { $('#loginBox').classList.add('open'); $('#lgErr').textContent = ''; $('#senha').value = ''; setTimeout(() => $('#senha').focus(), 30); }
function closeLogin() { $('#loginBox').classList.remove('open'); }
$('#adminLink').addEventListener('click', () => S.admin ? openStudio() : openLogin());
$('#lgCancel').addEventListener('click', closeLogin);
$('#loginBox').addEventListener('click', e => { if (e.target.id === 'loginBox') closeLogin(); });
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#lgGo'); btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    const r = await apiCall('login.php', { method: 'POST', json: { senha: $('#senha').value } });
    CSRF = r.csrf; setAdmin(true); closeLogin(); openStudio();
  } catch (err) {
    $('#lgErr').textContent = err.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : (err.status === 401 ? 'Senha incorreta.' : (err.message || 'Não foi possível entrar.'));
  } finally { btn.disabled = false; btn.textContent = 'Entrar'; }
});
$('#logout').addEventListener('click', async () => {
  if (S.dirty) { toast('Publique ou descarte as alterações antes de sair.'); return; }
  try { await apiCall('logout.php', { method: 'POST' }); } catch {}
  CSRF = null; setAdmin(false); closeStudio();
});
function setAdmin(on) {
  S.admin = on;
  document.body.classList.toggle('is-admin', on);
  $('#adminLink').textContent = on ? 'Abrir estúdio' : 'Área do artista';
  renderList();
  if (on) {
    const draft = LS.get('asbm:draft');
    if (draft && Array.isArray(draft.tracks) && JSON.stringify(draft) !== JSON.stringify(S.published)) {
      toast('Você tem alterações que não foram publicadas.', { label: 'Restaurar', run: () => { S.cat = draft; markDirty(); } });
    } else LS.del('asbm:draft');
  }
}

/* ---------- estúdio ---------- */
const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'webm'];
const CHUNK = 768 * 1024; // pedaços pequenos passam por qualquer limite de upload do PHP
let MAX_MB = 100;

function markDirty() {
  S.dirty = true;
  LS.set('asbm:draft', S.cat);
  $('#publish').disabled = false;
  $('#pubMsg').textContent = 'Há alterações não publicadas. Os ouvintes só verão depois de publicar.';
  renderAll();
  if ($('#studio').classList.contains('open')) renderStudio();
}
function openStudio() { if (!S.admin) { openLogin(); return; } $('#studio').classList.add('open'); renderStudio(); $('#closeStudio').focus(); }
function closeStudio() { $('#studio').classList.remove('open'); }
$('#openStudio').addEventListener('click', openStudio);
$('#closeStudio').addEventListener('click', closeStudio);
$('#studio').addEventListener('click', e => { if (e.target.id === 'studio') closeStudio(); });

function jobsHTML() {
  return S.jobs.map(j => `<li><div class="jl"><b>${esc(j.name)}</b><span>${esc(j.status)}</span></div>${j.pct != null ? `<div class="pb"><i style="width:${j.pct}%"></i></div>` : ''}</li>`).join('');
}
function setJob(job, status, pct) { job.status = status; job.pct = pct; const ul = $('#jobs'); if (ul) ul.innerHTML = jobsHTML(); }

function renderStudio() {
  const s = S.cat.site;
  $('#studioBody').innerHTML = `
    <div class="drop" id="drop">${I.upload}
      <div style="font-weight:800;margin-top:6px">Envie suas músicas</div>
      <p>MP3, M4A, WAV, OGG, FLAC ou WEBM, até ${MAX_MB} MB cada. Pode selecionar várias de uma vez.</p>
      <label class="btn btn-primary btn-sm" style="cursor:pointer">Escolher arquivos<input type="file" id="files" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm" multiple hidden></label>
    </div>
    <ul class="jobs" id="jobs">${jobsHTML()}</ul>
    <div class="box"><h3>Identidade do site</h3>
      <label class="field"><span>Nome do site</span><input data-site="name" value="${esc(s.name)}" maxlength="40"></label>
      <label class="field"><span>Frase de apresentação</span><input data-site="tagline" value="${esc(s.tagline)}" maxlength="120"></label>
      <label class="field" style="margin:0"><span>Nome artístico padrão</span><input data-site="artist" value="${esc(s.artist)}" maxlength="80"></label>
    </div>
    <h3 style="font-family:var(--display);font-size:1rem;margin:0 0 10px">Suas faixas (${S.cat.tracks.length})</h3>
    <div id="eds">${S.cat.tracks.map((t, i) => `
      <div class="ed" data-ed="${t.id}">${artHTML(t)}
        <div>
          <label class="field"><span>Título</span><input data-k="title" value="${esc(t.title)}" maxlength="120"></label>
          <label class="field"><span>Artista</span><input data-k="artist" value="${esc(t.artist || '')}" placeholder="${esc(s.artist)}" maxlength="80"></label>
          <label class="field" style="margin:0"><span>Álbum ou projeto</span><input data-k="album" value="${esc(t.album || '')}" maxlength="80"></label>
        </div>
        <div class="tools">
          <label class="btn btn-ghost" style="cursor:pointer">${t.cover ? 'Trocar capa' : 'Adicionar capa'}<input type="file" accept="image/png,image/jpeg,image/webp" data-cover hidden></label>
          ${t.cover ? '<button class="btn btn-ghost" data-act="nocover">Remover capa</button>' : ''}
          <button class="btn btn-ghost" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Mover para cima">${I.up}</button>
          <button class="btn btn-ghost" data-act="down" ${i === S.cat.tracks.length - 1 ? 'disabled' : ''} aria-label="Mover para baixo">${I.down}</button>
          <button class="btn btn-danger" data-act="del">Excluir</button>
        </div>
      </div>`).join('') || '<p class="note">Nenhuma faixa ainda. Comece enviando arquivos acima.</p>'}</div>`;
  const drop = $('#drop');
  $('#files').addEventListener('change', e => { handleFiles([...e.target.files]); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => handleFiles([...e.dataTransfer.files]));
  $('#studioBody').querySelectorAll('[data-site]').forEach(inp => inp.addEventListener('change', () => {
    S.cat.site[inp.dataset.site] = inp.value.trim() || DEFAULT.site[inp.dataset.site]; markDirty();
  }));
  $('#eds').addEventListener('change', async e => {
    const ed = e.target.closest('[data-ed]'); if (!ed) return;
    const t = byId(ed.dataset.ed); if (!t) return;
    if (e.target.dataset.k) {
      const v = e.target.value.trim();
      if (e.target.dataset.k === 'title' && !v) { e.target.value = t.title; return; }
      t[e.target.dataset.k] = v; markDirty();
    }
    if (e.target.hasAttribute('data-cover') && e.target.files[0]) await setCover(t, e.target.files[0]);
  });
  $('#eds').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('[data-ed]').dataset.ed; const arr = S.cat.tracks; const i = arr.findIndex(t => t.id === id);
    const act = b.dataset.act;
    if (act === 'up' && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    else if (act === 'down' && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    else if (act === 'nocover') arr[i].cover = null;
    else if (act === 'del') {
      const t = arr.splice(i, 1)[0];
      toast(`“${t.title}” foi excluída. Ela some do site quando você publicar.`, { label: 'Desfazer', run: () => { arr.splice(Math.min(i, arr.length), 0, t); markDirty(); } });
    } else return;
    markDirty();
  });
}
function probeDuration(file) {
  return new Promise(res => {
    const a = document.createElement('audio'); const u = URL.createObjectURL(file);
    let done = false;
    const end = d => { if (done) return; done = true; URL.revokeObjectURL(u); res(isFinite(d) ? d : 0); };
    a.preload = 'metadata'; a.onloadedmetadata = () => end(a.duration); a.onerror = () => end(0);
    setTimeout(() => end(a.duration), 8000); a.src = u;
  });
}
function cleanTitle(name) {
  return name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/^\d{1,3}\s*[-.]\s*/, '').replace(/\s+/g, ' ').trim() || 'Sem título';
}
async function sendChunked(blob, kind, ext, onPct) {
  const uid = rid(16);
  let off = 0;
  const total = blob.size;
  while (true) {
    const end = Math.min(off + CHUNK, total);
    const final = end >= total;
    let tries = 0;
    while (true) {
      try {
        const r = await apiCall(`upload.php?kind=${kind}&uid=${uid}&ext=${ext}&offset=${off}&final=${final ? 1 : 0}`,
          { method: 'POST', body: blob.slice(off, end), headers: { 'Content-Type': 'application/octet-stream' } });
        if (final) return r.path;
        break;
      } catch (e) {
        if (e.status === 401) throw e;
        if (e.status === 409 && e.data && typeof e.data.recebido === 'number') { off = e.data.recebido; break; }
        if (++tries >= 3 || (e.status && e.status < 500 && e.status !== 408 && e.status !== 429)) throw e;
        await new Promise(r => setTimeout(r, 800 * tries));
      }
    }
    if (!final) off = end;
    onPct(Math.round(off / total * 100));
  }
}
function sessionLost() { setAdmin(false); CSRF = null; closeStudio(); toast('Sua sessão expirou. Entre de novo para continuar.'); openLogin(); }

async function handleFiles(files) {
  if (!S.admin) return;
  for (const file of files) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const job = { name: file.name, status: 'Na fila' }; S.jobs.unshift(job); setJob(job, 'Na fila');
    if (!AUDIO_EXT.includes(ext)) { setJob(job, 'Formato não aceito'); continue; }
    if (file.size > MAX_MB * 1048576) { setJob(job, `Maior que ${MAX_MB} MB`); continue; }
    try {
      S.busy++;
      setJob(job, 'Lendo…', 0);
      const dur = await probeDuration(file);
      const path = await sendChunked(file, 'audio', ext, p => setJob(job, `Enviando ${p}%`, p));
      const t = { id: 't' + rid(12), title: cleanTitle(file.name), artist: '', album: '', dur: Math.round(dur), file: path, cover: null, hue: 255 + Math.floor(Math.random() * 65), added: Math.floor(Date.now() / 1000) };
      S.cat.tracks.unshift(t);
      setJob(job, 'Pronta para publicar', 100);
      markDirty();
    } catch (e) {
      if (e.status === 401) { S.busy--; sessionLost(); return; }
      setJob(job, 'Erro: ' + (e.message || 'falha no envio'));
    } finally { S.busy = Math.max(0, S.busy - 1); }
  }
}
async function setCover(t, file) {
  try {
    const bmp = await createImageBitmap(file);
    const size = 800, c = document.createElement('canvas'); c.width = c.height = size;
    const s = Math.min(bmp.width, bmp.height);
    c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .86));
    toast('Enviando capa…');
    t.cover = await sendChunked(blob, 'cover', 'jpg', () => {});
    coverCache.delete(t.id);
    markDirty();
    if (P.current() === t) setMeta(t);
  } catch (e) {
    if (e.status === 401) return sessionLost();
    toast('Não foi possível enviar a capa: ' + (e.message || 'erro') + '.');
  }
}
$('#publish').addEventListener('click', async () => {
  if (!S.dirty) return;
  if (S.busy) { toast('Espere os envios terminarem para publicar.'); return; }
  const btn = $('#publish'); btn.disabled = true; btn.textContent = 'Publicando…';
  try {
    const r = await apiCall('catalog.php', { method: 'POST', json: S.cat });
    S.cat = r.catalog; S.published = clone(r.catalog);
    S.dirty = false; LS.del('asbm:draft');
    $('#pubMsg').textContent = 'Publicado. Já está no ar para todo mundo.';
    toast('Alterações publicadas.');
    renderAll(); renderStudio();
  } catch (e) {
    if (e.status === 401) return sessionLost();
    $('#pubMsg').textContent = 'A publicação falhou: ' + (e.message || 'tente de novo') + '.';
    btn.disabled = false;
  } finally { btn.textContent = 'Publicar alterações'; }
});
window.addEventListener('beforeunload', e => { if (S.dirty || S.busy) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- inicialização ---------- */
renderHero();
(async () => {
  let cat = null;
  try {
    cat = await apiCall('catalog.php');
    if (cat && cat.limiteMb) MAX_MB = cat.limiteMb;
  } catch {}
  if (!cat || !Array.isArray(cat.tracks)) {
    // Sem PHP (ex.: GitHub Pages): usa o catálogo gerado a partir da pasta faixas/
    try {
      const r = await fetch('catalogo.json', { cache: 'no-store' });
      if (r.ok) { cat = await r.json(); S.static = true; }
    } catch {}
  }
  if (cat && Array.isArray(cat.tracks)) { S.cat = cat; S.published = clone(cat); }
  else toast('Não foi possível carregar as músicas. Atualize a página em instantes.');
  S.loaded = true;
  if (S.static) $('#adminLink').hidden = true;
  renderAll();
  applyHash();
  if (!S.static) { try { const me = await apiCall('me.php'); if (me && me.logado) { CSRF = me.csrf; setAdmin(true); } } catch {} }
})();
})();
