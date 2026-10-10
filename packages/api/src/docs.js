// Samma gränssnitt som claude-shim.js (db.doc/collection med get/set/update/delete/onSnapshot),
// men mot tabellen documents för ett konto och en modul. Motorerna och mycket av logiken kan
// därför flyttas över utan omskrivning.
const norm = p => String(p).replace(/^\/+|\/+$/g, '');
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
const freeze = v => { if (v && typeof v === 'object') { Object.freeze(v); Object.values(v).forEach(freeze); } return v; };

/**
 * @param {object} backend createLocalBackend() eller createSupabaseBackend()
 * @param {string} tenantId
 * @param {string} moduleKey
 */
export function docApi(backend, tenantId, moduleKey) {
  const docSnap = (path, data) => ({ id: path.split('/').pop(), exists: data != null, data: () => freeze(clone(data)), ref: docRef(path) });
  function docRef(p) {
    const path = norm(p);
    return {
      id: path.split('/').pop(), path,
      async get() { return docSnap(path, await backend.getDoc(tenantId, moduleKey, path)); },
      async set(v, opt) { await backend.setDoc(tenantId, moduleKey, path, clone(v), { merge: !!(opt && opt.merge) }); },
      async update(v) { await backend.setDoc(tenantId, moduleKey, path, clone(v), { merge: true }); },
      async delete() { await backend.deleteDoc(tenantId, moduleKey, path); },
      collection: c => colRef(path + '/' + c),
      onSnapshot(cb, err) {
        let alive = true;
        const fire = () => backend.getDoc(tenantId, moduleKey, path).then(d => alive && cb(docSnap(path, d))).catch(e => err && err(e));
        fire();
        const un = backend.subscribe(evt => { if (evt.table === '*' || (evt.table === 'documents' && evt.tenant_id === tenantId && evt.module_key === moduleKey && evt.path === path)) fire(); });
        return () => { alive = false; un(); };
      }
    };
  }
  function colRef(p) {
    const path = norm(p);
    const snap = async () => {
      const L = await backend.listDocs(tenantId, moduleKey, path);
      const docs = L.map(x => docSnap(x.path, x.data));
      return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) };
    };
    return {
      path,
      doc: id => docRef(path + '/' + (id || Math.random().toString(36).slice(2, 12))),
      get: snap,
      async add(v) { const r = docRef(path + '/' + Math.random().toString(36).slice(2, 12)); await r.set(v); return r; },
      onSnapshot(cb, err) {
        let alive = true;
        const fire = () => snap().then(s => alive && cb(s)).catch(e => err && err(e));
        fire();
        const un = backend.subscribe(evt => {
          if (evt.table === '*' || (evt.table === 'documents' && evt.tenant_id === tenantId && evt.module_key === moduleKey && evt.path.startsWith(path + '/') && !evt.path.slice(path.length + 1).includes('/'))) fire();
        });
        return () => { alive = false; un(); };
      }
    };
  }
  return { doc: docRef, collection: colRef };
}

/** Motsvarar window.claude.use(name) i prototyperna, för ett konto och en modul. */
export function runtimeFor(backend, tenantId, moduleKey, { download } = {}) {
  const db = docApi(backend, tenantId, moduleKey);
  const user = { async id() { return (await backend.getUser())?.id; }, async name() { return (await backend.getUser())?.name; } };
  const downloads = { async save({ filename, data, mimeType }) { if (download) return download(filename, data, mimeType); return { ok: false }; } };
  const caps = { db, user, downloads };
  return { use: async name => caps[name] || null };
}
