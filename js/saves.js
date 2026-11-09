// 저장. 진행 중인 판은 localStorage, 기록과 모음(내공, 강화, 본 구간, 트로피, 도감)은 IndexedDB에 둔다.
// 저장소를 못 쓰는 환경에서는 메모리로 동작하고, 저장 실패가 게임을 멈추지 않게 한다.
(function () {
  const load = (name, file) => globalThis[name] || (typeof require !== 'undefined' ? require(file) : null);
  const Meta = load('Meta', './meta.js');

  const RUN_KEY = 'stock-rpg-run';
  const APP = 'stock-rpg';
  const VERSION = 1;
  const DB_NAME = 'stock-rpg';
  const REPORTS = 'reports';
  const COLLECTION = 'collection';
  const COLLECTION_ID = 'main';

  const browserStorage = () => (typeof localStorage !== 'undefined' ? localStorage : null);

  function saveRun(run, storage = browserStorage()) {
    try { storage.setItem(RUN_KEY, JSON.stringify(run)); } catch { /* 저장 실패는 게임을 멈추지 않는다 */ }
  }

  function loadRun(validate, storage = browserStorage()) {
    try {
      const run = JSON.parse(storage.getItem(RUN_KEY));
      return validate(run) ? run : null;
    } catch {
      return null;
    }
  }

  function clearRun(storage = browserStorage()) {
    try { storage.removeItem(RUN_KEY); } catch { /* 무시 */ }
  }

  function emptyCollection() {
    return { seen: {}, dex: {}, meta: Meta.empty(), achievements: { trophies: [], medals: [], life: {} } };
  }

  function withDefaults(c) {
    const base = emptyCollection();
    return { ...base, ...(c || {}), meta: { ...base.meta, ...((c && c.meta) || {}) }, achievements: { ...base.achievements, ...((c && c.achievements) || {}) } };
  }

  // ---------- 저장소 구현: 메모리와 IndexedDB가 같은 모양을 가진다 ----------

  function memoryDb() {
    const reports = new Map();
    let collection = null;
    return {
      async putReport(r) { reports.set(r.id, JSON.parse(JSON.stringify(r))); },
      async listReports() { return [...reports.values()]; },
      async clearReports() { reports.clear(); },
      async getCollection() { return collection; },
      async putCollection(c) { collection = JSON.parse(JSON.stringify(c)); },
    };
  }

  function idbDb() {
    const open = () => new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(REPORTS, { keyPath: 'id' });
        req.result.createObjectStore(COLLECTION, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const run = async (store, mode, work) => {
      const conn = await open();
      try {
        return await new Promise((resolve, reject) => {
          const t = conn.transaction(store, mode);
          const req = work(t.objectStore(store));
          t.oncomplete = () => resolve(req && req.result);
          t.onerror = () => reject(t.error);
        });
      } finally {
        conn.close();
      }
    };
    return {
      putReport: (r) => run(REPORTS, 'readwrite', (s) => s.put(r)),
      listReports: () => run(REPORTS, 'readonly', (s) => s.getAll()),
      clearReports: () => run(REPORTS, 'readwrite', (s) => s.clear()),
      getCollection: async () => {
        const row = await run(COLLECTION, 'readonly', (s) => s.get(COLLECTION_ID));
        return row ? row.data : null;
      },
      putCollection: (c) => run(COLLECTION, 'readwrite', (s) => s.put({ id: COLLECTION_ID, data: c })),
    };
  }

  let fallback = null;
  // 브라우저에서는 IndexedDB를 쓰고, 열리지 않으면 메모리로 바꾼다.
  function defaultDb() {
    if (fallback) return fallback;
    if (typeof indexedDB === 'undefined') {
      fallback = memoryDb();
      return fallback;
    }
    const idb = idbDb();
    const mem = memoryDb();
    const guard = (name) => async (...args) => {
      try { return await idb[name](...args); } catch { return mem[name](...args); }
    };
    fallback = Object.fromEntries(Object.keys(idb).map((k) => [k, guard(k)]));
    return fallback;
  }

  async function putReport(report, db = defaultDb()) { await db.putReport(report); }

  async function listReports(db = defaultDb()) {
    const rows = (await db.listReports()) || [];
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async function getCollection(db = defaultDb()) { return withDefaults(await db.getCollection()); }

  async function putCollection(collection, db = defaultDb()) { await db.putCollection(collection); }

  // ---------- 백업 ----------

  function pack(reports, collection) {
    return JSON.stringify({ app: APP, version: VERSION, savedAt: new Date().toISOString(), reports, collection });
  }

  function unpack(text) {
    const data = JSON.parse(text);
    if (!data || data.app !== APP || data.version !== VERSION) throw new Error('목숨걸고 투자의 백업 파일이 아닙니다');
    if (!Array.isArray(data.reports) || !data.collection || typeof data.collection !== 'object') throw new Error('백업 파일 내용이 올바르지 않습니다');
    return { reports: data.reports, collection: data.collection };
  }

  async function exportAll(db = defaultDb()) {
    return pack(await listReports(db), await getCollection(db));
  }

  async function importAll(text, db = defaultDb()) {
    const { reports, collection } = unpack(text);
    await db.clearReports();
    for (const r of reports) await db.putReport(r);
    await db.putCollection(withDefaults(collection));
  }

  const Saves = {
    RUN_KEY, saveRun, loadRun, clearRun, emptyCollection, memoryDb, putReport, listReports, getCollection, putCollection,
    pack, unpack, exportAll, importAll,
  };
  globalThis.Saves = Saves;
  if (typeof module !== 'undefined') module.exports = Saves;
})();
