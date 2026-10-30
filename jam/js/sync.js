/*
 * Motor da JAM: todos tocam a mesma faixa no mesmo segundo.
 * O motorista grava só um "estado" (tocando/pausado, faixa, posição e horário do servidor).
 * Cada celular calcula onde a música deveria estar agora e se ajusta.
 * Se o celular do motorista pausar sozinho (ligação), nada é gravado: a JAM segue para todos.
 */
import { silentWav } from './common.js';

export class JamEngine {
  constructor(backend, { onChange } = {}) {
    this.b = backend;
    this.onChange = onChange || (() => {});
    this.tracks = [];
    this.state = null;
    this.joined = false;
    this.userPaused = false;
    this.needTap = false;
    this.cur = -1;
    this.audio = document.createElement('audio');
    this.audio.preload = 'auto';
    this.audio.setAttribute('playsinline', '');
    document.body.appendChild(this.audio);
    this.audio.addEventListener('loadedmetadata', () => this.sync(true));
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('play', () => { this.needTap = false; this.media(); this.onChange(); });
    this.audio.addEventListener('pause', () => { this.media(); this.onChange(); });
    this.audio.addEventListener('waiting', () => this.onChange());
    this.audio.addEventListener('playing', () => this.onChange());
    this.audio.addEventListener('error', () => { if (this.joined && this.cur >= 0) this.onChange('erro'); });
    this.timer = setInterval(() => this.sync(false), 2000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.sync(true); });
  }
  setTracks(list) { this.tracks = list || []; this.sync(true); }
  setState(s) { this.state = s; this.sync(true); this.onChange(); }
  dur(i) { const t = this.tracks[i]; if (!t) return 0; if (i === this.cur && isFinite(this.audio.duration) && this.audio.duration > 0) return this.audio.duration; return t.dur || 0; }

  /* Onde a música deveria estar agora */
  timeline() { return calcTimeline(this.state, this.tracks, this.b.serverNow(), i => this.dur(i)); }
  get track() { const tl = this.timeline(); return tl ? this.tracks[tl.index] : null; }
  get playingLocally() { return !this.audio.paused; }

  async join() {
    // chamado no toque do usuário: destrava o áudio para os próximos plays automáticos
    this.joined = true; this.userPaused = false;
    try { this.audio.src = silentWav(); await this.audio.play(); } catch {}
    this.cur = -1;
    this.sync(true);
  }
  leave() { this.joined = false; this.audio.pause(); this.onChange(); }
  pauseMine() { this.userPaused = true; this.audio.pause(); this.onChange(); }
  resumeMine() { this.userPaused = false; this.needTap = false; this.sync(true); this.audio.play().catch(() => {}); }

  load(i, pos) {
    const t = this.tracks[i]; if (!t) return;
    this.cur = i;
    this.audio.src = t.url;
    this.pendingPos = pos;
    this.media();
    this.onChange();
  }
  onEnded() {
    if (!this.joined) return;
    const tl = this.timeline();
    if (tl && tl.index !== this.cur) { this.sync(true); return; }
    // a duração cadastrada é maior que o arquivo: segue para a próxima localmente
    if (this.tracks.length) this.load((this.cur + 1) % this.tracks.length, 0);
    this.tryPlay();
  }
  tryPlay() {
    if (this.userPaused) return;
    const p = this.audio.play();
    if (p) p.catch(e => { if (e && e.name === 'NotAllowedError') { this.needTap = true; this.onChange(); } });
  }
  sync(force) {
    if (!this.joined) return;
    const tl = this.timeline();
    if (!tl) { if (!this.audio.paused) this.audio.pause(); return; }
    if (tl.index !== this.cur) {
      // troca de faixa (no fim natural da música, o "ended" já cuida)
      if (force || this.audio.paused || this.audio.ended || Math.abs(this.dur(this.cur) - this.audio.currentTime) > 2.5) {
        this.load(tl.index, tl.pos);
        if (tl.playing) this.tryPlay();
      }
      return;
    }
    if (this.audio.readyState < 1) return;
    if (!tl.playing) {
      if (!this.audio.paused) this.audio.pause();
      if (Math.abs(this.audio.currentTime - tl.pos) > 1) this.audio.currentTime = tl.pos;
      return;
    }
    const drift = this.audio.currentTime - tl.pos;
    if (Math.abs(drift) > (force ? 0.4 : 0.9) && !this.audio.seeking) {
      try { this.audio.currentTime = Math.min(tl.pos, (this.audio.duration || tl.pos + 1) - 0.25); } catch {}
    }
    if (this.audio.paused) this.tryPlay();
  }
  media() {
    if (!('mediaSession' in navigator)) return;
    const t = this.tracks[this.cur];
    if (t) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title, artist: t.artist || '', album: this.albumName || 'AS Music Driver',
          artwork: t.cover ? [{ src: t.cover, sizes: '512x512' }] : []
        });
      } catch {}
    }
    navigator.mediaSession.playbackState = this.audio.paused ? 'paused' : 'playing';
  }
  /* Comandos do motorista: gravam o estado para todos */
  cmd(kind) {
    const n = this.tracks.length; if (!n) return null;
    const tl = this.timeline() || { index: 0, pos: 0, playing: false };
    const at = { '.sv': 'timestamp' };
    if (kind === 'play') return { playing: true, index: tl.index, pos: tl.pos, at };
    if (kind === 'pause') return { playing: false, index: tl.index, pos: tl.pos, at };
    if (kind === 'next') return { playing: true, index: (tl.index + 1) % n, pos: 0, at };
    if (kind === 'prev') return tl.pos > 3 ? { playing: true, index: tl.index, pos: 0, at } : { playing: true, index: (tl.index - 1 + n) % n, pos: 0, at };
    if (kind === 'restart') return { playing: true, index: 0, pos: 0, at };
    return null;
  }
}

/* Mede a duração exata de uma faixa (para a sincronia ficar precisa) */
export function measure(url) {
  return new Promise(res => {
    const a = document.createElement('audio'); let done = false;
    const end = d => { if (done) return; done = true; a.src = ''; res(isFinite(d) && d > 0 ? Math.round(d * 100) / 100 : 0); };
    a.preload = 'metadata'; a.onloadedmetadata = () => end(a.duration); a.onerror = () => end(0);
    setTimeout(() => end(a.duration), 15000); a.src = url;
  });
}

/* Cálculo puro da posição da JAM (usado também no painel ao vivo) */
export function calcTimeline(s, tracks, now, durOf) {
  const n = tracks.length;
  if (!s || !n) return null;
  const d = durOf || (i => tracks[i]?.dur || 0);
  let idx = ((s.index || 0) % n + n) % n;
  let pos = Math.max(0, s.pos || 0);
  if (s.playing && s.at) pos += Math.max(0, (now - s.at) / 1000);
  for (let guard = 0; guard < n * 50; guard++) {
    const len = d(idx);
    if (!len || pos < len) break;
    pos -= len; idx = (idx + 1) % n;
  }
  return { index: idx, pos, playing: !!s.playing };
}
