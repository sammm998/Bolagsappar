// Enkel nyckel/värde-lagring i IndexedDB för den lokala backenden (localStorage räcker inte för demodatan).
export function openIdb(name = 'bolagsappar', store = 'kv') {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(store);
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      const tx = mode => db.transaction(store, mode).objectStore(store);
      resolve({
        get: key => new Promise(r => { const q = tx('readonly').get(key); q.onsuccess = () => r(q.result ?? null); q.onerror = () => r(null); }),
        set: (key, value) => new Promise(r => { const q = tx('readwrite').put(value, key); q.onsuccess = () => r(true); q.onerror = () => { console.warn('[lokal] kunde inte spara', q.error); r(false); }; }),
        del: key => new Promise(r => { const q = tx('readwrite').delete(key); q.onsuccess = () => r(true); q.onerror = () => r(false); })
      });
    };
  });
}
