/* Camada de dados: Firebase Realtime Database ou modo demonstração (local). */
import { firebaseConfig } from './config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const TS = { '.sv': 'timestamp' };
const clean = p => String(p).replace(/^\/+|\/+$/g, '');

export async function connect() {
  return firebaseConfig ? firebaseBackend(firebaseConfig) : demoBackend();
}

/* ---------- Firebase ---------- */
async function firebaseBackend(cfg) {
  const [{ initializeApp }, D, A] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-database.js'), import(FB + 'firebase-auth.js')
  ]);
  const app = initializeApp(cfg);
  const db = D.getDatabase(app);
  const auth = A.getAuth(app);
  let offset = 0;
  D.onValue(D.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  const authReady = new Promise(res => { const un = A.onAuthStateChanged(auth, u => { un(); res(u); }); });
  const r = p => D.ref(db, clean(p));
  const api = {
    mode: 'firebase',
    get uid() { return auth.currentUser ? auth.currentUser.uid : null; },
    async ensureAnon() { await authReady; if (!auth.currentUser) await A.signInAnonymously(auth); return auth.currentUser.uid; },
    async adminLogin(email, pass) { await A.signInWithEmailAndPassword(auth, email, pass); return api.isAdmin(); },
    async adminLogout() { await A.signOut(auth); },
    async currentAdmin() { await authReady; const u = auth.currentUser; if (!u || u.isAnonymous) return null; return (await api.isAdmin()) ? u : null; },
    async isAdmin() { const u = auth.currentUser; if (!u) return false; try { return (await D.get(r('admins/' + u.uid))).exists(); } catch { return false; } },
    async get(p) { return (await D.get(r(p))).val(); },
    set: (p, v) => D.set(r(p), v),
    update: (p, v) => D.update(r(p), v),
    remove: p => D.remove(r(p)),
    listen(p, cb) { return D.onValue(r(p), s => cb(s.val()), () => cb(null)); },
    serverNow: () => Date.now() + offset,
    async presence(p) {
      const ref = r(p);
      await D.onDisconnect(ref).remove();
      await D.set(ref, true);
      return () => D.remove(ref).catch(() => {});
    }
  };
  return api;
}

/* ---------- Demonstração: grava no navegador e avisa as outras abas ---------- */
function demoBackend() {
  const KEY = 'asmd-demo-db';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  let tree = load();
  const subs = new Set();
  const ch = 'BroadcastChannel' in window ? new BroadcastChannel('asmd-demo') : null;
  const seg = p => clean(p).split('/').filter(Boolean);
  const getAt = p => seg(p).reduce((o, k) => (o == null ? undefined : o[k]), tree);
  const resolveTS = v => {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return Date.now();
      const o = Array.isArray(v) ? [] : {};
      for (const k in v) o[k] = resolveTS(v[k]);
      return o;
    }
    return v;
  };
  const prune = (o) => { for (const k in o) { if (o[k] && typeof o[k] === 'object') { prune(o[k]); if (!Object.keys(o[k]).length) delete o[k]; } } };
  const setAt = (p, v) => {
    const s = seg(p);
    if (!s.length) { tree = v || {}; return; }
    let o = tree;
    for (let i = 0; i < s.length - 1; i++) { if (o[s[i]] == null || typeof o[s[i]] !== 'object') o[s[i]] = {}; o = o[s[i]]; }
    if (v === null || v === undefined) delete o[s[s.length - 1]]; else o[s[s.length - 1]] = resolveTS(v);
    prune(tree);
  };
  const notify = () => { for (const s of subs) s.fire(); };
  const commit = () => { try { localStorage.setItem(KEY, JSON.stringify(tree)); } catch {} if (ch) ch.postMessage('x'); notify(); };
  const refresh = () => { tree = load(); notify(); };
  if (ch) ch.onmessage = refresh;
  window.addEventListener('storage', e => { if (e.key === KEY) refresh(); });
  const uid = sessionStorage.getItem('asmd-demo-uid') || ('u' + Math.random().toString(36).slice(2, 10));
  sessionStorage.setItem('asmd-demo-uid', uid);
  let admin = sessionStorage.getItem('asmd-demo-admin') === '1';
  const api = {
    mode: 'demo',
    uid,
    async ensureAnon() { return uid; },
    async adminLogin(email, pass) { if (pass !== 'demo') { const e = new Error('Senha incorreta'); e.code = 'auth/wrong-password'; throw e; } admin = true; sessionStorage.setItem('asmd-demo-admin', '1'); return true; },
    async adminLogout() { admin = false; sessionStorage.removeItem('asmd-demo-admin'); },
    async currentAdmin() { return admin ? { email: 'demo' } : null; },
    async isAdmin() { return admin; },
    async get(p) { const v = getAt(p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); },
    async set(p, v) { setAt(p, v); commit(); },
    async update(p, obj) { for (const k in obj) setAt(clean(p) + '/' + k, obj[k]); commit(); },
    async remove(p) { setAt(p, null); commit(); },
    listen(p, cb) {
      let last;
      const s = { fire() { const v = getAt(p); const j = JSON.stringify(v ?? null); if (j !== last) { last = j; cb(v === undefined ? null : JSON.parse(j)); } } };
      subs.add(s); s.fire();
      return () => subs.delete(s);
    },
    serverNow: () => Date.now(),
    async presence(p) {
      setAt(p, true); commit();
      const off = () => { setAt(p, null); commit(); };
      window.addEventListener('pagehide', off);
      return () => { window.removeEventListener('pagehide', off); off(); };
    }
  };
  return api;
}
