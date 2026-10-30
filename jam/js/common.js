/* Utilidades e temas visuais */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = s => { if (!isFinite(s) || s < 0) return '0:00'; s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const params = () => Object.fromEntries(new URLSearchParams(location.search));
export const rid = (n = 10) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); };
export const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
export const vehicleId = s => slug(s).slice(0, 20);
export const toArray = o => !o ? [] : Array.isArray(o) ? o.filter(Boolean) : Object.keys(o).sort((a, b) => a - b).map(k => o[k]).filter(Boolean);

export function toast(msg, ms = 3800) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; box.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
export async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Link copiado.'); }
  catch { prompt('Copie o link:', text); }
}
export function qrSvg(text) {
  if (!window.qrcode) return '';
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag(4, 2).replace(/width="\d+px" height="\d+px"/, 'width="100%" height="100%"');
}
export function baseUrl() { return location.href.replace(/[^/]*([?#].*)?$/, ''); }

/* Áudio silencioso para destravar o som no primeiro toque (iPhone) */
export function silentWav() {
  const n = 800, buf = new Uint8Array(44 + n), dv = new DataView(buf.buffer);
  const w = (o, s) => [...s].forEach((c, i) => buf[o + i] = c.charCodeAt(0));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  w(36, 'data'); dv.setUint32(40, n, true); buf.fill(128, 44);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/* Temas por evento */
export const THEMES = {
  'kpop-roxo': { label: 'K-pop roxo', bg: '#0D0520', bg2: '#1B0B3A', ink: '#F6EEFF', muted: '#B9A6DE', accent: '#A855F7', accent2: '#F472D0', font: 'Unbounded', fx: 'sparkle' },
  'kpop-pastel': { label: 'K-pop pastel', bg: '#140C24', bg2: '#251640', ink: '#FFF4FB', muted: '#D2BEE0', accent: '#FF8AD8', accent2: '#8AD8FF', font: 'Unbounded', fx: 'sparkle' },
  'rock': { label: 'Rock pesado', bg: '#0A0A0A', bg2: '#1A0D0D', ink: '#F5F1EA', muted: '#B5ABA0', accent: '#E11D2E', accent2: '#F5C518', font: 'Bebas Neue', fx: 'grain' },
  'pop-neon': { label: 'Pop neon', bg: '#08061A', bg2: '#16103A', ink: '#F2FFFE', muted: '#A9C7D8', accent: '#22D3EE', accent2: '#F0ABFC', font: 'Unbounded', fx: 'grid' },
  'sertanejo': { label: 'Sertanejo', bg: '#1A1008', bg2: '#2C1C0E', ink: '#FFF6E8', muted: '#D6BF9F', accent: '#E8A33D', accent2: '#C2410C', font: 'Bebas Neue', fx: 'grain' },
  'as-brasil': { label: 'AS Brasil azul', bg: '#06122B', bg2: '#0C2152', ink: '#EEF5FF', muted: '#A5BCE0', accent: '#2F7BFF', accent2: '#38D6F5', font: 'Unbounded', fx: 'grid' }
};
export function applyTheme(info) {
  const base = THEMES[(info && info.theme) || 'kpop-roxo'] || THEMES['kpop-roxo'];
  const t = { ...base, accent: info?.accent || base.accent, accent2: info?.accent2 || base.accent2 };
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg); r.setProperty('--bg2', t.bg2); r.setProperty('--ink', t.ink); r.setProperty('--muted', t.muted);
  r.setProperty('--accent', t.accent); r.setProperty('--accent2', t.accent2);
  r.setProperty('--display', `"${t.font}", "Unbounded", system-ui, sans-serif`);
  document.documentElement.dataset.fx = t.fx;
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = t.bg;
}

export const I = {
  play: '<svg class="i f" viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg class="i f" viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  next: '<svg class="i f" viewBox="0 0 24 24"><path d="M5 6.2v11.6a1 1 0 0 0 1.53.85L15 13.2V17a1 1 0 0 0 2 0V7a1 1 0 0 0-2 0v3.8L6.53 5.35A1 1 0 0 0 5 6.2z"/></svg>',
  prev: '<svg class="i f" viewBox="0 0 24 24"><path d="M19 6.2v11.6a1 1 0 0 1-1.53.85L9 13.2V17a1 1 0 0 1-2 0V7a1 1 0 0 1 2 0v3.8l8.47-5.45A1 1 0 0 1 19 6.2z"/></svg>',
  users: '<svg class="i" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  bus: '<svg class="i" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 18v2M16 18v2"/><circle cx="8" cy="14.5" r=".8"/><circle cx="16" cy="14.5" r=".8"/></svg>',
  copy: '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  up: '<svg class="i" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg class="i" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  x: '<svg class="i" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  vol: '<svg class="i" viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>'
};
