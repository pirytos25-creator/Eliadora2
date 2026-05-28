// eliadora-storage.js — magazyn IndexedDB dla galerii wspomnień
//
// Po co osobny plik:
//   localStorage ma limit ~5 MB i przechowuje stringi. Zdjęcia jako data: URLs
//   pęcznieją o 33%, więc kilka fotek wystarczy żeby przepełnić quotę.
//   IndexedDB ma ~50% miejsca na dysku użytkownika (gigabajty), trzyma Bloby
//   natywnie (bez konwersji do Base64) i jest asynchroniczny — nie blokuje UI.
//
// Co tu trzymamy:
//   Każdy wpis to obiekt:
//     { id: <auto>, personId: <id osoby z drzewa>, family: <familyName>,
//       blob: <Blob>, type: 'image'|'video', caption: <string>, added: <timestamp> }
//
//   Dzielimy po `family` żeby drzewo Góreckich i drzewo Twoje (DIY) nie mieszały
//   sobie zdjęć.
//
// API (wszystko zwraca Promise):
//   addItem({personId, family, blob, type, caption})  → {id, ...}
//   getItems(personId, family)                        → Array<entry>
//   updateCaption(id, caption)                        → void
//   deleteItem(id)                                    → void
//   getAllForFamily(family)                           → Array<entry>  (na potrzeby eksportu)
//   getBlobURL(entry)                                 → 'blob:...' (do <img src>)
//   clearFamily(family)                               → void
//
// Wszystko jest singletonem na window.EliadoraStorage.

(function(root) {
  'use strict';

  const DB_NAME = 'eliadora_storage';
  const DB_VERSION = 1;
  const STORE_NAME = 'gallery';

  let dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!root.indexedDB) {
        reject(new Error('IndexedDB nieobsługiwane — galeria zdjęć trwałych niedostępna w tej przeglądarce.'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('byPerson', ['family', 'personId'], { unique: false });
          store.createIndex('byFamily', 'family', { unique: false });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error || new Error('Nie udało się otworzyć bazy IndexedDB.'));
    });
    return dbPromise;
  }

  function tx(mode) {
    return openDB().then(db => {
      const t = db.transaction(STORE_NAME, mode);
      return t.objectStore(STORE_NAME);
    });
  }

  function wrapRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ─── PUBLIC API ─────────────────────────────────────────────────────────────

  async function addItem({ personId, family, blob, type, caption }) {
    if (!personId || !family || !blob) throw new Error('addItem: brak wymaganego pola');
    const store = await tx('readwrite');
    const entry = {
      personId: String(personId),
      family:   String(family),
      blob,
      type:     type === 'video' ? 'video' : 'image',
      caption:  caption || '',
      added:    Date.now()
    };
    const id = await wrapRequest(store.add(entry));
    return { ...entry, id };
  }

  async function getItems(personId, family) {
    const store = await tx('readonly');
    const idx = store.index('byPerson');
    const range = IDBKeyRange.only([String(family), String(personId)]);
    return wrapRequest(idx.getAll(range));
  }

  async function updateCaption(id, caption) {
    const store = await tx('readwrite');
    const entry = await wrapRequest(store.get(id));
    if (!entry) return;
    entry.caption = caption || '';
    await wrapRequest(store.put(entry));
  }

  async function deleteItem(id) {
    const store = await tx('readwrite');
    await wrapRequest(store.delete(id));
  }

  async function getAllForFamily(family) {
    const store = await tx('readonly');
    const idx = store.index('byFamily');
    return wrapRequest(idx.getAll(IDBKeyRange.only(String(family))));
  }

  async function clearFamily(family) {
    const store = await tx('readwrite');
    const idx = store.index('byFamily');
    const all = await wrapRequest(idx.getAll(IDBKeyRange.only(String(family))));
    for (const entry of all) {
      await wrapRequest(store.delete(entry.id));
    }
  }

  // Tworzy efemeryczny URL z Bloba do użycia w <img src>.
  // Pamiętaj o URL.revokeObjectURL gdy element znika, żeby nie wyciekać pamięci.
  function getBlobURL(entry) {
    if (!entry || !entry.blob) return '';
    return URL.createObjectURL(entry.blob);
  }

  // Konwersja Blob → dataURL (do osadzania w eksporcie HTML)
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  // Konwersja dataURL → Blob (do importu z eksportowanego HTML)
  function dataURLToBlob(dataURL) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataURL);
    if (!m) return null;
    const mime = m[1];
    const bin = atob(m[2]);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // Sprawdzenie obsługi — zwraca {supported: bool, message: string}
  async function checkSupport() {
    try {
      await openDB();
      return { supported: true, message: 'OK' };
    } catch (e) {
      return { supported: false, message: e.message };
    }
  }

  root.EliadoraStorage = {
    addItem,
    getItems,
    updateCaption,
    deleteItem,
    getAllForFamily,
    getBlobURL,
    blobToDataURL,
    dataURLToBlob,
    clearFamily,
    checkSupport
  };
})(typeof window !== 'undefined' ? window : globalThis);
