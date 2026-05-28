// eliadora.js — logika aplikacji
// (CSS w eliadora.css, tłumaczenia w eliadora.i18n.js,
//  czyste funkcje w eliadora-pure.js, dane w eliadora-data.js)

'use strict';

// ─── ESCAPE HELPERS ───────────────────────────────────────────────────────────
// Czyste, testowalne implementacje są w eliadora-pure.js.
// Tu są tylko cienkie aliasy dla zwięzłości w reszcie kodu.
const esc     = window.EliadoraPure.esc;
const escAttr = window.EliadoraPure.escAttr;
// (Zachowujemy starą sygnaturę żeby reszta pliku — onclick="..." w innerHTML —
//  działała bez zmian. Te funkcje są zdefiniowane raz, w pure module.)

// I18N teraz w eliadora.i18n.js (ładowany przed eliadora.js)
const I18N = window.ELIADORA_I18N || {};
let lang = 'pl';
const t = k => (I18N[lang] || I18N.pl)[k] || k;

const THEME_KEY = 'eliadora_theme';
const THEME_CONFIG = {
  nature:   { paper:'assets/parchment-classic.png', svgBg:'#f0ddb6', grain:'#9f7b42', speck:'#7f5a26', accent:'#b18230' },
  deco20:   { paper:'assets/parchment-papyrus.png', svgBg:'#eed7a8', grain:'#b5842e', speck:'#9a6c20', accent:'#c79a36' },
  interwar: { paper:'assets/parchment-vellum.png', svgBg:'#ead8b6', grain:'#847058', speck:'#5e4a35', accent:'#8a6a3b' },
  prl:      { paper:'assets/parchment-smoke.png', svgBg:'#d4c4a4', grain:'#6d5841', speck:'#54341f', accent:'#9a6028' },
};
let activeTheme = 'nature';

function standaloneExportState() {
  return (window.ELIADORA_STANDALONE_EXPORT && window.ELIADORA_EXPORT_STATE) ? window.ELIADORA_EXPORT_STATE : {};
}

function runtimeAssetUrl(src) {
  const raw = String(src || '').trim();
  if (!raw || /^(data:|blob:|https?:|mailto:|tel:|#)/i.test(raw)) return raw;
  const sources = window.ELIADORA_RUNTIME_ASSETS || (window.ELIADORA_STANDALONE_EXPORT ? window.ELIADORA_EXPORT_SOURCES : null) || {};
  if (Object.prototype.hasOwnProperty.call(sources, raw)) return sources[raw];
  const cleanRaw = raw.replace(/\\/g, '/');
  for (const key of Object.keys(sources)) {
    const cleanKey = String(key).replace(/\\/g, '/');
    if (cleanRaw.endsWith(cleanKey) || cleanRaw.endsWith('/' + cleanKey)) return sources[key];
  }
  return raw;
}

function setTheme(theme) {
  if (!THEME_CONFIG[theme]) theme = 'nature';
  const config = THEME_CONFIG[theme];
  activeTheme = theme;
  document.body.classList.remove('theme-nature','theme-deco20','theme-interwar','theme-prl');
  document.body.classList.add('theme-' + theme);
  document.documentElement.style.setProperty('--paper-texture', `url('${runtimeAssetUrl(config.paper)}')`);
  document.documentElement.style.setProperty('--tree-paper-color', config.svgBg);
  document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
  try { localStorage.setItem(THEME_KEY, theme); } catch(e) {}
  // bgR / bgTint may not exist yet during early init (they're created when the
  // SVG layers are set up, later in the script). updateGrain() reads activeTheme
  // and applies the colour, so on first call we just skip and let init do it.
  // typeof check avoids ReferenceError on let-bindings (window.bgR isn't enough).
  try {
    if (typeof bgR !== 'undefined' && bgR) {
      bgR.attr('fill', config.svgBg).attr('opacity', 0.10);
      if (typeof bgTint !== 'undefined' && bgTint) bgTint.attr('fill', config.svgBg).attr('opacity', 0);
    }
  } catch(e) { /* bgR not initialised yet */ }
  if (currentFocusId) {
    try { updateGrain(calculateLayout(buildHourglass(currentFocusId))); } catch(e) {}
  }
}

function initThemeSwitcher() {
  const exportState = standaloneExportState();
  let saved = exportState.theme || 'nature';
  if (!window.ELIADORA_STANDALONE_EXPORT) {
    try { saved = localStorage.getItem(THEME_KEY) || 'nature'; } catch(e) {}
  }
  setTheme(saved);
}

const SENIOR_KEY = 'eliadora_senior_mode';
const SENIOR_SCALE_KEY = 'eliadora_senior_scale';
const MUSIC_VOLUME_KEY = 'eliadora_music_volume';
let seniorMode = false;
let seniorScale = 1.22;

function setAppChromeMetrics() {
  const header = document.getElementById('app-header');
  if (!header) return;
  const h = Math.ceil(header.getBoundingClientRect().height || 58);
  document.documentElement.style.setProperty('--header-h', h + 'px');
}

function applySeniorMode(enabled) {
  seniorMode = !!enabled;
  document.body.classList.toggle('senior-mode', seniorMode);
  const btn = document.getElementById('senior-toggle');
  if (btn) {
    btn.classList.toggle('active', seniorMode);
    btn.setAttribute('aria-pressed', seniorMode ? 'true' : 'false');
  }
  try { localStorage.setItem(SENIOR_KEY, seniorMode ? '1' : '0'); } catch(e) {}
  setTimeout(() => {
    setAppChromeMetrics();
    if (currentFocusId && !transitioning) {
      const fid = currentFocusId;
      currentFocusId = null;
      transitionTo(fid, false);
      setTimeout(centerCurrent, 90);
    }
  }, 40);
}

function toggleSeniorMode() {
  applySeniorMode(!seniorMode);
}

function setSeniorScale(value) {
  const pct = Math.max(110, Math.min(170, parseInt(value, 10) || 122));
  seniorScale = pct / 100;
  document.documentElement.style.setProperty('--senior-scale', seniorScale.toFixed(2));
  const slider = document.getElementById('senior-scale');
  const label = document.getElementById('senior-scale-label');
  if (slider) slider.value = pct;
  if (label) label.textContent = pct + '%';
  try { localStorage.setItem(SENIOR_SCALE_KEY, String(pct)); } catch(e) {}
  setAppChromeMetrics();
  if (seniorMode && currentFocusId && !transitioning) {
    const fid = currentFocusId;
    currentFocusId = null;
    transitionTo(fid, false);
    setTimeout(centerCurrent, 80);
  }
}

function initSeniorMode() {
  const exportState = standaloneExportState();
  let saved = !!exportState.seniorMode;
  let savedScale = parseInt(exportState.seniorScale || '122', 10);
  if (!window.ELIADORA_STANDALONE_EXPORT) {
    try { saved = localStorage.getItem(SENIOR_KEY) === '1'; } catch(e) {}
    try { savedScale = parseInt(localStorage.getItem(SENIOR_SCALE_KEY) || '122', 10); } catch(e) {}
  }
  setSeniorScale(savedScale);
  applySeniorMode(saved);
}

function setBackgroundVolume(value) {
  const audio = document.getElementById('background-music');
  const slider = document.getElementById('music-volume');
  const label = document.getElementById('music-label');
  const pct = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
  if (audio) audio.volume = pct / 100;
  if (slider) slider.value = pct;
  if (label) label.textContent = pct + '%';
  try { localStorage.setItem(MUSIC_VOLUME_KEY, String(pct)); } catch(e) {}
}

async function toggleBackgroundMusic() {
  const audio = document.getElementById('background-music');
  const btn = document.getElementById('music-toggle');
  if (!audio) return;
  if (audio.paused) {
    try {
      await audio.play();
      if (btn) { btn.classList.add('active'); btn.textContent = 'II'; btn.setAttribute('aria-pressed','true'); }
    } catch(e) {
      if (btn) btn.textContent = '♪';
    }
  } else {
    audio.pause();
    if (btn) { btn.classList.remove('active'); btn.textContent = '♪'; btn.setAttribute('aria-pressed','false'); }
  }
}

function initBackgroundMusic() {
  let volume = 35;
  try {
    const saved = localStorage.getItem(MUSIC_VOLUME_KEY);
    if (saved !== null) volume = parseInt(saved, 10);
  } catch(e) {}
  setBackgroundVolume(volume);
  const audio = document.getElementById('background-music');
  const btn = document.getElementById('music-toggle');
  if (btn) btn.setAttribute('aria-pressed','false');
  if (audio) {
    audio.addEventListener('play', () => {
      if (btn) { btn.classList.add('active'); btn.textContent = 'II'; btn.setAttribute('aria-pressed','true'); }
    });
    audio.addEventListener('pause', () => {
      if (btn) { btn.classList.remove('active'); btn.textContent = '♪'; btn.setAttribute('aria-pressed','false'); }
    });
  }
}

function handleWindowResize() {
  setAppChromeMetrics();
  if (currentFocusId && !transitioning) {
    const fid = currentFocusId;
    currentFocusId = null;
    transitionTo(fid, false);
    setTimeout(centerCurrent, 80);
  }
}

// Family name may switch to the isolated learning tree.
let activeFamilyName = '';
let activeDefaultFocus = '';
let activeStorageKey = 'eliadora_people';
let learningMode = false;
let diyMode = false;
const LEARNING_STORAGE_KEY = 'eliadora_learning_people';
const LEARNING_FOCUS_ID = 'learn_start';
const DIY_STORAGE_KEY = 'eliadora_diy_people';
const DIY_FOCUS_ID = 'diy_start';
const FAMILY_NAME = () => activeFamilyName || '';
const DEFAULT_FOCUS = () => activeDefaultFocus || FOCUS_ID || PEOPLE[0]?.id || '';

function isVideoSrc(src) {
  return !!src && (/(\.mp4|\.webm|\.m4v|\.mov)(\?|#|$)/i.test(src) || /^data:video\//i.test(src));
}
function personVideoSrc(person) {
  return person ? (person.video || person.mp4 || '') : '';
}
function makeVideo(src, className) {
  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  if (className) video.className = className;
  return video;
}
function loadVideoFile(input, targetId) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!(/^video\/(mp4|webm|quicktime)$/i.test(file.type) || /\.(mp4|webm|mov|m4v)$/i.test(file.name))) {
    alert('Wybierz plik MP4/WebM.');
    input.value = '';
    return;
  }
  // Hard limit: data URLs above ~2 MB will likely break browser save (they're
  // stored as base64 = ~33% overhead). Even 2 MB is risky if combined across
  // people. We accept up to 2 MB but warn that it WON'T be persisted across
  // page reloads (savePeople strips data: URLs).
  const MAX_INLINE = 2 * 1024 * 1024;
  if (file.size > MAX_INLINE) {
    alert('Plik jest za duży na bezpośrednie wczytanie (limit ' + Math.round(MAX_INLINE/1024/1024) + ' MB).\n\nLepiej połóż MP4 obok HTML-a i wpisz jego ścieżkę, np. media/portret.mp4.\nTaka ścieżka zostanie zapisana w przeglądarce; wczytany plik — nie.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const target = document.getElementById(targetId);
    if (target) target.value = reader.result;
    const note = document.getElementById(targetId + '-status');
    if (note) note.textContent = 'MP4 widoczny tylko w tej sesji. Aby zapis trwał na stałe, użyj ścieżki względnej (np. media/portret.mp4).';
  };
  reader.readAsDataURL(file);
}
function setImageFolderPrefix(prefix) {
  const target = document.getElementById('ef-image');
  const note = document.getElementById('ef-image-status');
  if (!target) return;
  clearEmbeddedImage('ef-image');
  const raw = String(target.value || '').split(/[\\/]/).pop();
  target.value = prefix + raw;
  if (note) note.textContent = prefix
    ? `Folder ustawiony: ${prefix}. Wybierz plik albo dopisz nazwę, np. ${prefix}ola.png.`
    : 'Folder główny: wpisz samą nazwę pliku, np. adult_f.png.';
}

function isEmbeddedImage(src) {
  return /^data:image\//i.test(String(src || ''));
}

function clearEmbeddedImage(targetId) {
  const data = document.getElementById(targetId + '-data');
  if (data) data.value = '';
}

function imageInputDisplayValue(src) {
  return isEmbeddedImage(src) ? '' : (src || '');
}

function imageInputPlaceholder(src) {
  return isEmbeddedImage(src) ? 'zdjęcie zapisane bezpośrednio w drzewie' : 'image_name.jpg';
}

function dataUrlByteLength(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  return Math.ceil(base64.length * 3 / 4);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Nie udało się odczytać pliku.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Nie udało się odczytać obrazu.'));
    img.src = src;
  });
}

async function makeStoredImageDataUrl(file) {
  const MAX_SOURCE = 14 * 1024 * 1024;
  const MAX_STORED = 900 * 1024;
  if (file.size > MAX_SOURCE) {
    throw new Error(`Plik jest za duży (${formatBytes(file.size)}). Wybierz mniejsze zdjęcie albo zapisz je w folderze zapiski i wpisz ścieżkę.`);
  }
  if (/image\/gif/i.test(file.type) || /\.gif$/i.test(file.name)) {
    if (file.size > MAX_STORED) {
      throw new Error(`GIF jest za duży do bezpośredniego zapisu (${formatBytes(file.size)}). Użyj mniejszego pliku albo wpisz ścieżkę z folderu zapiski.`);
    }
    return readFileAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const attempts = [
      { maxSide: 960, quality: 0.86 },
      { maxSide: 720, quality: 0.80 },
      { maxSide: 540, quality: 0.74 }
    ];
    let best = '';
    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff8e8';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      best = canvas.toDataURL('image/jpeg', attempt.quality);
      if (dataUrlByteLength(best) <= MAX_STORED) return best;
    }
    throw new Error(`Zdjęcie po zmniejszeniu nadal jest za duże (${formatBytes(dataUrlByteLength(best))}). Wybierz mniejszy kadr albo wpisz ścieżkę z folderu zapiski.`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadImageFile(input, targetId) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!(/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name))) {
    alert('Wybierz plik JPG, PNG, WEBP albo GIF.');
    input.value = '';
    return;
  }
  const target = document.getElementById(targetId);
  if (!target) return;
  const dataTarget = document.getElementById(targetId + '-data');
  const note = document.getElementById(targetId + '-status');
  try {
    if (note) note.textContent = 'Zmniejszam i zapisuję zdjęcie bezpośrednio w drzewie...';
    const dataUrl = await makeStoredImageDataUrl(file);
    if (dataTarget) {
      dataTarget.value = dataUrl;
      target.value = '';
      target.placeholder = imageInputPlaceholder(dataUrl);
    } else {
      target.value = dataUrl;
    }
    if (note) {
      note.classList.add('media-upload-note');
      note.textContent = `Zdjęcie zapisze się bezpośrednio w drzewie (${formatBytes(dataUrlByteLength(dataUrl))}). Nie musisz używać folderu p.`;
    }
  } catch(e) {
    alert(e && e.message ? e.message : 'Nie udało się wczytać zdjęcia.');
    if (note) note.textContent = 'Nie udało się wczytać zdjęcia. Możesz wpisać ścieżkę ręcznie, np. zapiski/portret.jpg.';
  } finally {
    input.value = '';
  }
}

// ─── DATE FORMATTER ───────────────────────────────────────────────────────────
// Accepts: '1982', '1982-03', '1982-03-15', or legacy numbers like 1982
const MONTHS = {
  pl: ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  es: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],
  fr: ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],
};
function formatDate(val) {
  if (!val && val !== 0) return '';
  const s = String(val).trim();
  if (/^\d{4}$/.test(s)) return s;
  const parts = s.split('-');
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10) - 1;
    const mName = (MONTHS[lang] || MONTHS.pl)[m] || parts[1];
    return `${mName} ${parts[0]}`;
  }
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const m   = parseInt(parts[1], 10) - 1;
    const yr  = parts[0];
    const mName = (MONTHS[lang] || MONTHS.pl)[m] || parts[1];
    if (lang === 'pl') return `${day} ${mName} ${yr}`;
    if (lang === 'en') return `${mName} ${day}, ${yr}`;
    if (lang === 'es') return `${day} de ${mName} de ${yr}`;
    if (lang === 'fr') return `${day} ${mName} ${yr}`;
    return `${day} ${mName} ${yr}`;
  }
  return s;
}
// Extract birth year as a number for age calculations
function birthYear(val) {
  if (!val && val !== 0) return null;
  return parseInt(String(val).split('-')[0], 10);
}

// ─── FLAG HELPER ──────────────────────────────────────────────────────────────
const FLAG_MAP = {
  PL:'🇵🇱', DE:'🇩🇪', CZ:'🇨🇿', SK:'🇸🇰',
  UA:'🇺🇦', BY:'🇧🇾', LT:'🇱🇹', RU:'🇷🇺',
};
function getFlags(nat) {
  if (!nat) return '';
  const codes = Array.isArray(nat) ? nat : [nat];
  return codes.map(c => FLAG_MAP[c] || '').join('');
}

// ─── DATA (loaded from eliadora-data.js) ──────────────────────────────────────
// If the external file fails to load (e.g. opened via file:// without a server,
// or wrong path, or syntax error in the data file), we show a friendly message
// and stop rather than rendering a confusing blank app.
const _DATA_LOADED = typeof window.ELIADORA_DATA !== 'undefined';
const _DATA    = window.ELIADORA_DATA || { familyName: '', defaultFocus: '', people: [] };
const FOCUS_ID = _DATA.defaultFocus || (_DATA.people?.[0]?.id) || '';
activeFamilyName = _DATA.familyName || '';
activeDefaultFocus = FOCUS_ID;

function showDataLoadError(reason) {
  // Build a visible error pane. Uses textContent only — no innerHTML — so the
  // reason string is always safely escaped.
  const pane = document.createElement('div');
  pane.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:40px;background:rgba(248,234,200,0.96);font-family:Georgia,serif;color:#3a1b06';
  const box = document.createElement('div');
  box.style.cssText = 'max-width:560px;background:#fff8e8;border:2px solid #8b6914;border-radius:8px;padding:32px;box-shadow:0 6px 32px rgba(0,0,0,0.18)';
  const title = document.createElement('h2');
  title.textContent = 'Nie udało się załadować danych drzewa';
  title.style.cssText = 'margin:0 0 14px;font-size:22px;color:#5c2a05';
  const msg = document.createElement('p');
  msg.style.cssText = 'margin:0 0 14px;font-size:15px;line-height:1.55';
  msg.textContent = reason;
  const hint = document.createElement('p');
  hint.style.cssText = 'margin:14px 0 0;font-size:13px;color:#6c4818;line-height:1.55';
  hint.textContent = 'Otwórz przez lokalny serwer HTTP, np.: python3 -m http.server, a potem http://localhost:8000/eliadora8.html — albo sprawdź, czy plik eliadora-data.js leży obok HTML-a.';
  box.append(title, msg, hint);
  pane.appendChild(box);
  document.body.appendChild(pane);
}

if (!_DATA_LOADED) {
  // Data file didn't load (no window.ELIADORA_DATA). Show error and bail.
  // We defer to next tick so <body> is available.
  setTimeout(() => showDataLoadError(
    'Plik eliadora-data.js nie został wczytany. Najczęstsze przyczyny: otwarcie przez file:// (CORS blokuje skrypt), zła ścieżka, błąd składni w pliku danych.'
  ), 0);
  // Prevent the rest of init from running — throw a non-blocking signal.
  // We don't `throw` because that would leave the page broken; instead let the
  // empty _DATA fallback render an empty tree (the error pane covers it anyway).
}

// PEOPLE is the live mutable runtime array.
// On startup: load from localStorage if available (user edits), else use data file.
let PEOPLE = (() => {
  if (window.ELIADORA_STANDALONE_EXPORT) {
    return (_DATA.people || []).map(p => ({...p}));
  }
  try {
    const saved = localStorage.getItem('eliadora_people');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Self-healing: if saved data doesn't contain the default focal person,
      // it's corrupted — discard it and fall back to the data file silently.
      const focusExists = parsed.some(p => p.id === (_DATA.defaultFocus || ''));
      if (focusExists) return parsed;
      localStorage.removeItem('eliadora_people');
    }
  } catch(e) { try { localStorage.removeItem('eliadora_people'); } catch(e2) {} }
  return (_DATA.people || []).map(p => ({...p}));
})();

// Wczytaj meta (nazwa rodu) z localStorage, jeśli użytkownik ją zmieniał
try {
  if (!window.ELIADORA_STANDALONE_EXPORT) {
    const metaRaw = localStorage.getItem('eliadora_people_meta');
    if (metaRaw) {
      const meta = JSON.parse(metaRaw);
      if (meta && typeof meta.familyName === 'string' && meta.familyName.trim()) {
        activeFamilyName = meta.familyName;
      }
    }
  }
} catch(e) {}

// Normalize every person to guarantee p[] and s[] exist. Without this,
// imported data missing these fields crashes buildHourglass on first call.
function normalizePeople(people) {
  people.forEach(p => {
    if (!Array.isArray(p.p)) p.p = [];
    if (!Array.isArray(p.s)) p.s = [];
  });
}
normalizePeople(PEOPLE);

let PMAP = Object.fromEntries(PEOPLE.map(p => [p.id, p]));
function rebuildPMAP() { PMAP = Object.fromEntries(PEOPLE.map(p => [p.id, p])); }

// ── Stale ID cleanup ──────────────────────────────────────────────────────────
// Runs once on load. Removes any IDs in p[] or s[] that don't exist in PMAP.
// Silently fixes corrupted data from previous sessions without user intervention.
function cleanStaleIds() {
  let changed = false;
  PEOPLE.forEach(person => {
    const cleanP = (person.p || []).filter(id => id && PMAP[id]);
    const cleanS = (person.s || []).filter(id => id && PMAP[id]);
    if (cleanP.length !== (person.p||[]).length) { person.p = cleanP; changed = true; }
    if (cleanS.length !== (person.s||[]).length) { person.s = cleanS; changed = true; }
  });
  if (changed) {
    rebuildPMAP();
    // Don't write here — buildSavable() is defined further down, and any user
    // action will trigger savePeople() which writes safely. If the page is
    // closed without further action, next load will run cleanStaleIds again.
  }
}
cleanStaleIds();

function createLearningPeople() {
  return [
    {
      id: LEARNING_FOCUS_ID,
      fn: 'Osoba',
      ln: 'Startowa',
      full: 'Osoba Startowa',
      g: 'F',
      b: '1990',
      bp: 'Miejsce urodzenia',
      image: 'p/ola.png',
      nat: ['PL'],
      bio: {
        pl: 'To jest osobne drzewo do nauki. Możesz edytować tę osobę, dodawać rodziców, małżonka i dzieci bez zmieniania prawdziwego drzewa.'
      },
      p: [],
      s: []
    }
  ];
}

function loadLearningPeople() {
  try {
    const saved = localStorage.getItem(LEARNING_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.some(p => p.id === LEARNING_FOCUS_ID)) return parsed;
      localStorage.removeItem(LEARNING_STORAGE_KEY);
    }
  } catch(e) { try { localStorage.removeItem(LEARNING_STORAGE_KEY); } catch(e2) {} }
  return createLearningPeople();
}

function createDiyPeople() {
  return [
    {
      id: DIY_FOCUS_ID,
      fn: 'Osoba',
      ln: 'Startowa',
      fullName: 'Osoba Startowa',
      g: 'F',
      b: '',
      bp: '',
      image: '',
      nat: ['PL'],
      bio: {
        pl: 'To jest Twoje puste drzewo. Edytuj tę osobę, wgraj zdjęcie bezpośrednio z komputera i dodawaj rodzinę przyciskami w panelu.'
      },
      p: [],
      s: []
    }
  ];
}

function hasSavedDiyTree() {
  try {
    const saved = localStorage.getItem(DIY_STORAGE_KEY);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.some(p => p.id === DIY_FOCUS_ID);
  } catch(e) {
    return false;
  }
}

function loadDiyPeople() {
  try {
    const saved = localStorage.getItem(DIY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.some(p => p.id === DIY_FOCUS_ID)) return parsed;
      localStorage.removeItem(DIY_STORAGE_KEY);
    }
  } catch(e) { try { localStorage.removeItem(DIY_STORAGE_KEY); } catch(e2) {} }
  return createDiyPeople();
}

function openCurrentPersonEditor() {
  const id = currentFocusId || DEFAULT_FOCUS();
  const person = PMAP[id];
  if (!person) return;
  sidebarHidden = false;
  openEditForm({...person}, null);
  sidebarEl.classList.add('open');
}

function configureModeBanner(mode) {
  const title = document.getElementById('mode-banner-title');
  const primary = document.getElementById('mode-banner-primary');
  const reset = document.getElementById('mode-banner-reset');
  const exportHtml = document.getElementById('mode-banner-export-html');
  const importHtml = document.getElementById('mode-banner-import-html');
  if (!title || !primary || !reset) return;
  if (mode === 'diy') {
    title.textContent = 'Zrób to sam';
    primary.textContent = 'Edytuj start';
    primary.onclick = openCurrentPersonEditor;
    reset.textContent = 'Wyczyść';
    reset.onclick = resetDiyTree;
    if (exportHtml) exportHtml.style.display = '';
    if (importHtml) importHtml.style.display = '';
  } else {
    title.textContent = 'Drzewo do nauki';
    primary.textContent = 'Praktyka';
    primary.onclick = () => openHelpTutorial(6);
    reset.textContent = 'Reset nauki';
    reset.onclick = resetLearningTree;
    if (exportHtml) exportHtml.style.display = 'none';
    if (importHtml) importHtml.style.display = 'none';
  }
}

function activateRuntimeTree({ people, familyName, defaultFocus, storageKey, isLearning, isDiy }) {
  PEOPLE = people.map(p => ({...p}));
  normalizePeople(PEOPLE);

  // Nazwa rodu może być nadpisana z localStorage (jeśli użytkownik ją zmieniał)
  let resolvedFamilyName = familyName;
  let resolvedDefaultFocus = defaultFocus;
  try {
    const metaRaw = localStorage.getItem(storageKey + '_meta');
    if (metaRaw) {
      const meta = JSON.parse(metaRaw);
      if (meta && typeof meta.familyName === 'string' && meta.familyName.trim()) {
        resolvedFamilyName = meta.familyName;
      }
      if (meta && typeof meta.defaultFocus === 'string' && meta.defaultFocus) {
        resolvedDefaultFocus = meta.defaultFocus;
      }
    }
  } catch(e) {}

  activeFamilyName = resolvedFamilyName;
  activeDefaultFocus = resolvedDefaultFocus;
  activeStorageKey = storageKey;
  learningMode = !!isLearning;
  diyMode = !!isDiy;
  document.body.classList.toggle('learning-mode', learningMode);
  document.body.classList.toggle('diy-mode', diyMode);
  configureModeBanner(diyMode ? 'diy' : 'learning');
  rebuildPMAP();
  cleanStaleIds();
  navHistory = [];
  navIndex = -1;
  currentFocusId = null;
  sidebarReturnId = null;
  restoreSidebarView();
  rebuildPersonSearch();
  updateNavControls();
  updateOrphanBtn();
  document.getElementById('family-name').textContent = FAMILY_NAME();
  updateCoverText();
  transitionTo(resolvedDefaultFocus, false);
  setTimeout(centerCurrent, 80);
}

function enterLearningTree(reset = false) {
  const people = reset ? createLearningPeople() : loadLearningPeople();
  if (reset) {
    try { localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(buildSavable(people))); } catch(e) {}
  }
  closeHelpTutorial();
  activateRuntimeTree({
    people,
    familyName: 'Drzewo do nauki',
    defaultFocus: LEARNING_FOCUS_ID,
    storageKey: LEARNING_STORAGE_KEY,
    isLearning: true,
    isDiy: false
  });
  savePeople();
  openSidebarFor(LEARNING_FOCUS_ID);
}

function startDiyTree() {
  enterDiyTree(false, false);
  setTimeout(openDiyBuilder, 160);
}

function enterDiyTree(reset = false, editStart = false) {
  const people = reset ? createDiyPeople() : loadDiyPeople();
  if (reset) {
    try { localStorage.setItem(DIY_STORAGE_KEY, JSON.stringify(buildSavable(people))); } catch(e) {}
  }
  closeHelpTutorial();
  activateRuntimeTree({
    people,
    familyName: 'Zrób to sam',
    defaultFocus: DIY_FOCUS_ID,
    storageKey: DIY_STORAGE_KEY,
    isLearning: false,
    isDiy: true
  });
  savePeople();
  openSidebarFor(DIY_FOCUS_ID);
  if (editStart) setTimeout(openCurrentPersonEditor, 140);
}

function resetLearningTree() {
  if (!learningMode && !confirm('Utworzyć nowe osobne drzewo do nauki?')) return;
  if (learningMode && !confirm('Zresetować drzewo do nauki od zera?')) return;
  enterLearningTree(true);
}

function resetDiyTree() {
  if (!diyMode && !confirm('Utworzyć nowe puste drzewo w zakładce "Zrób to sam"?')) return;
  if (diyMode && !confirm('Wyczyścić drzewo "Zrób to sam" i zacząć od jednej osoby?')) return;
  enterDiyTree(true, true);
}

const DIY_BUILDER_PAYLOAD_KEY = 'eliadora_diy_builder_payload';
const DIY_BUILDER_STEPS = ['Ty', 'Dzieci', 'Rodzice', 'Dziadkowie', 'Pradziadkowie'];
const DIY_BUILDER_GGP = [
  { id:'ggpff', label:'Pradziadek ze strony ojca ojca', g:'M' },
  { id:'ggpfm', label:'Prababcia ze strony ojca ojca', g:'F' },
  { id:'ggpmf', label:'Pradziadek ze strony ojca matki', g:'M' },
  { id:'ggpmm', label:'Prababcia ze strony ojca matki', g:'F' },
  { id:'ggpmff', label:'Pradziadek ze strony matki ojca', g:'M' },
  { id:'ggpmfm', label:'Prababcia ze strony matki ojca', g:'F' },
  { id:'ggpmmf', label:'Pradziadek ze strony matki matki', g:'M' },
  { id:'ggpmmm', label:'Prababcia ze strony matki matki', g:'F' },
];
let diyBuilderStep = 0;
let diyBuilderCounts = { spouse: 0, child: 0, sibling: 0 };

function openDiyBuilder() {
  if (!diyMode) enterDiyTree(false, false);
  closeHelpTutorial();
  const overlay = document.getElementById('diy-builder-overlay');
  if (!overlay) return;
  renderDiyBuilder();
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeDiyBuilder() {
  const overlay = document.getElementById('diy-builder-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function diyVal(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function diyRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : 'M';
}

function diySlug(fn, ln, suffix) {
  return ((fn + '_' + (ln || '') + (suffix ? '_' + suffix : ''))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || suffix || 'person');
}

function diyImageValue(key) {
  const embedded = diyVal(`${key}-image-data`);
  const path = diyVal(`${key}-image`);
  return embedded || path;
}

function diyPerson(id, fn, ln, g, b, d, bp, parents, spouses, image = '') {
  if (!fn) return null;
  const person = { id, fn, ln: ln || '', g: g || 'M', b: b || '', bp: bp || '', p: parents || [], s: spouses || [], image: image || '' };
  if (d) person.d = d;
  return person;
}

function diyPersonCard(kind, index, title, gender = 'M', removable = true, death = false, bio = false) {
  const key = `${kind}${index}`;
  return `
    <div class="diy-builder-card" data-kind="${kind}" data-index="${index}">
      <div class="diy-builder-card-title">${esc(title)}</div>
      ${removable ? "<button class=\"diy-builder-remove\" type=\"button\" onclick=\"this.closest('.diy-builder-card').remove()\">×</button>" : ''}
      <div class="diy-builder-grid">
        <div class="diy-field"><label>Imię${kind === 'you' ? ' *' : ''}</label><input id="${key}-fn" type="text" placeholder="np. Maria"></div>
        <div class="diy-field"><label>Nazwisko</label><input id="${key}-ln" type="text" placeholder="np. Kowalska"></div>
      </div>
      <div class="diy-builder-grid three">
        <div class="diy-field"><label>Rok urodzenia</label><input id="${key}-b" type="text" placeholder="1985"></div>
        ${death ? `<div class="diy-field"><label>Rok śmierci</label><input id="${key}-d" type="text" placeholder="opcjonalnie"></div>` : ''}
        <div class="diy-field"><label>Miejsce urodzenia</label><input id="${key}-bp" type="text" placeholder="miasto"></div>
        <div class="diy-field"><label>Płeć</label><div class="diy-radio-row">
          <label><input type="radio" name="${key}-g" value="M" ${gender === 'M' ? 'checked' : ''}> M</label>
          <label><input type="radio" name="${key}-g" value="F" ${gender === 'F' ? 'checked' : ''}> K</label>
        </div></div>
      </div>
      <div class="diy-builder-grid one">
        <div class="diy-field">
          <label>Zdjęcie</label>
          <input id="${key}-image" type="text" placeholder="opcjonalnie: p/ola.png albo zapiski/portret.jpg" oninput="clearEmbeddedImage('${key}-image')">
          <input type="hidden" id="${key}-image-data" value="">
          <div class="diy-photo-tools">
            <button class="diy-photo-btn" type="button" onclick="document.getElementById('${key}-image-upload')?.click()">Wgraj zdjęcie</button>
            <button class="diy-photo-btn" type="button" onclick="setDiyImageFolderPrefix('${key}', 'p/')">p/ portrety</button>
            <button class="diy-photo-btn" type="button" onclick="setDiyImageFolderPrefix('${key}', 'zapiski/')">zapiski/</button>
          </div>
          <input id="${key}-image-upload" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" onchange="loadImageFile(this,'${key}-image')" style="display:none">
          <div class="diy-photo-status" id="${key}-image-status">Możesz od razu wgrać zdjęcie tej osoby. Zapisze się w drzewie i przejdzie do eksportu HTML.</div>
        </div>
      </div>
      ${bio ? `<div class="diy-builder-grid one"><div class="diy-field"><label>Krótka biografia</label><textarea id="${key}-bio" placeholder="Kilka słów o tej osobie"></textarea></div></div>` : ''}
    </div>`;
}

function diyAncestorCard(id, title, gender, death = true) {
  return `
    <div class="diy-builder-card">
      <div class="diy-builder-card-title">${esc(title)}</div>
      <div class="diy-builder-grid">
        <div class="diy-field"><label>Imię</label><input id="${id}-fn" type="text" placeholder="opcjonalnie"></div>
        <div class="diy-field"><label>Nazwisko</label><input id="${id}-ln" type="text" placeholder="opcjonalnie"></div>
      </div>
      <div class="diy-builder-grid three">
        <div class="diy-field"><label>Rok urodzenia</label><input id="${id}-b" type="text" placeholder="~1920"></div>
        ${death ? `<div class="diy-field"><label>Rok śmierci</label><input id="${id}-d" type="text" placeholder="opcjonalnie"></div>` : ''}
        <div class="diy-field"><label>Miejsce urodzenia</label><input id="${id}-bp" type="text" placeholder="miasto"></div>
        <input type="hidden" id="${id}-g" value="${gender}">
      </div>
      <div class="diy-builder-grid one">
        <div class="diy-field">
          <label>Zdjęcie</label>
          <input id="${id}-image" type="text" placeholder="opcjonalnie: p/ola.png albo zapiski/portret.jpg" oninput="clearEmbeddedImage('${id}-image')">
          <input type="hidden" id="${id}-image-data" value="">
          <div class="diy-photo-tools">
            <button class="diy-photo-btn" type="button" onclick="document.getElementById('${id}-image-upload')?.click()">Wgraj zdjęcie</button>
            <button class="diy-photo-btn" type="button" onclick="setDiyImageFolderPrefix('${id}', 'p/')">p/ portrety</button>
            <button class="diy-photo-btn" type="button" onclick="setDiyImageFolderPrefix('${id}', 'zapiski/')">zapiski/</button>
          </div>
          <input id="${id}-image-upload" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" onchange="loadImageFile(this,'${id}-image')" style="display:none">
          <div class="diy-photo-status" id="${id}-image-status">Możesz od razu wgrać zdjęcie tej osoby. Zapisze się w drzewie i przejdzie do eksportu HTML.</div>
        </div>
      </div>
    </div>`;
}

function setDiyImageFolderPrefix(key, prefix) {
  const target = document.getElementById(`${key}-image`);
  const note = document.getElementById(`${key}-image-status`);
  if (!target) return;
  clearEmbeddedImage(`${key}-image`);
  const raw = String(target.value || '').split(/[\\/]/).pop();
  target.value = prefix + raw;
  if (note) note.textContent = prefix
    ? `Folder ustawiony: ${prefix}. Dopisz nazwę pliku albo wgraj zdjęcie bezpośrednio.`
    : 'Wpisz nazwę pliku albo wgraj zdjęcie bezpośrednio.';
}

function renderDiyBuilder() {
  const root = document.getElementById('diy-builder-root');
  if (!root) return;
  diyBuilderStep = 0;
  diyBuilderCounts = { spouse: 0, child: 0, sibling: 0 };
  root.innerHTML = `
    <div class="diy-builder-shell">
      <nav class="diy-builder-steps" aria-label="Kroki kreatora">
        ${DIY_BUILDER_STEPS.map((name, i) => `<button class="diy-builder-step" type="button" data-builder-step="${i}" onclick="diyBuilderGo(${i})"><span class="diy-builder-step-num">${i + 1}</span><span>${esc(name)}</span></button>`).join('')}
      </nav>
      <div class="diy-builder-main">
        <div class="diy-builder-scroll">
          <section class="diy-builder-page" data-builder-page="0">
            <h2 class="diy-builder-title">Ty - osoba główna drzewa</h2>
            ${diyPersonCard('you', 0, 'Twoje dane', 'F', false, false, true)}
            <div id="diy-spouses"></div>
            <button class="diy-builder-add" type="button" onclick="diyBuilderAdd('spouse')">+ Dodaj małżonka / partnera</button>
            <div class="diy-builder-card" style="margin-top:16px">
              <div class="diy-builder-card-title">Nazwa drzewa</div>
              <div class="diy-builder-grid one">
                <div class="diy-field"><label>Nazwa rodu</label><input id="diy-meta-name" type="text" placeholder="np. Drzewo rodziny Kowalskich"></div>
              </div>
            </div>
          </section>
          <section class="diy-builder-page" data-builder-page="1">
            <h2 class="diy-builder-title">Dzieci</h2>
            <p class="diy-builder-note">Dodaj tyle osób, ile potrzebujesz. Puste pokolenie zostanie pominięte.</p>
            <div id="diy-children"></div>
            <button class="diy-builder-add" type="button" onclick="diyBuilderAdd('child')">+ Dodaj dziecko</button>
          </section>
          <section class="diy-builder-page" data-builder-page="2">
            <h2 class="diy-builder-title">Rodzice i rodzeństwo</h2>
            ${diyAncestorCard('pf', 'Ojciec', 'M')}
            ${diyAncestorCard('pm', 'Matka', 'F')}
            <p class="diy-builder-note">Rodzeństwo zostanie połączone z tymi samymi rodzicami.</p>
            <div id="diy-siblings"></div>
            <button class="diy-builder-add" type="button" onclick="diyBuilderAdd('sibling')">+ Dodaj rodzeństwo</button>
          </section>
          <section class="diy-builder-page" data-builder-page="3">
            <h2 class="diy-builder-title">Dziadkowie</h2>
            ${diyAncestorCard('gpff', 'Dziadek ze strony ojca', 'M')}
            ${diyAncestorCard('gpfm', 'Babcia ze strony ojca', 'F')}
            ${diyAncestorCard('gpmf', 'Dziadek ze strony matki', 'M')}
            ${diyAncestorCard('gpmm', 'Babcia ze strony matki', 'F')}
          </section>
          <section class="diy-builder-page" data-builder-page="4">
            <h2 class="diy-builder-title">Pradziadkowie</h2>
            <p class="diy-builder-note">Wpisz tylko te osoby, które znasz.</p>
            ${DIY_BUILDER_GGP.map(p => diyAncestorCard(p.id, p.label, p.g)).join('')}
          </section>
        </div>
        <footer class="diy-builder-footer">
          <div class="diy-builder-footer-group">
            <button class="diy-builder-nav" type="button" id="diy-builder-prev" onclick="diyBuilderPrev()">Wstecz</button>
            <button class="diy-builder-nav" type="button" id="diy-builder-next" onclick="diyBuilderNext()">Dalej</button>
          </div>
          <div class="diy-builder-status" id="diy-builder-status"></div>
          <div class="diy-builder-footer-group">
            <button class="diy-builder-action" type="button" onclick="diyBuilderImport(false)">Wgraj do drzewa</button>
            <button class="diy-builder-action" type="button" onclick="diyBuilderImport(true)">Zapisz HTML</button>
          </div>
        </footer>
      </div>
    </div>`;
  diyBuilderGo(0);
}

function diyBuilderGo(step) {
  diyBuilderStep = Math.max(0, Math.min(DIY_BUILDER_STEPS.length - 1, step));
  document.querySelectorAll('[data-builder-page]').forEach(page => page.classList.toggle('active', Number(page.dataset.builderPage) === diyBuilderStep));
  document.querySelectorAll('[data-builder-step]').forEach(btn => {
    const idx = Number(btn.dataset.builderStep);
    btn.classList.toggle('active', idx === diyBuilderStep);
    btn.classList.toggle('done', idx < diyBuilderStep);
  });
  const prev = document.getElementById('diy-builder-prev');
  const next = document.getElementById('diy-builder-next');
  const status = document.getElementById('diy-builder-status');
  if (prev) prev.style.visibility = diyBuilderStep > 0 ? 'visible' : 'hidden';
  if (next) next.style.visibility = diyBuilderStep < DIY_BUILDER_STEPS.length - 1 ? 'visible' : 'hidden';
  if (status) status.textContent = `Krok ${diyBuilderStep + 1} z ${DIY_BUILDER_STEPS.length}`;
}

function diyBuilderNext() { diyBuilderGo(diyBuilderStep + 1); }
function diyBuilderPrev() { diyBuilderGo(diyBuilderStep - 1); }

function diyBuilderAdd(kind) {
  const map = {
    spouse: { target: 'diy-spouses', title: 'Małżonek / partner', gender: 'M' },
    child: { target: 'diy-children', title: 'Dziecko', gender: 'F' },
    sibling: { target: 'diy-siblings', title: 'Rodzeństwo', gender: 'M' }
  };
  const cfg = map[kind];
  const target = cfg && document.getElementById(cfg.target);
  if (!target) return;
  const idx = diyBuilderCounts[kind]++;
  target.insertAdjacentHTML('beforeend', diyPersonCard(kind, idx, `${cfg.title} ${idx + 1}`, cfg.gender));
}

function buildDiyBuilderData() {
  const people = [];
  const succession = [];
  const ggpMap = {};

  DIY_BUILDER_GGP.forEach(({id, g}) => {
    const fn = diyVal(id + '-fn');
    if (!fn) return;
    const pid = diySlug(fn, diyVal(id + '-ln'), id);
    const p = diyPerson(pid, fn, diyVal(id + '-ln'), g, diyVal(id + '-b'), diyVal(id + '-d'), diyVal(id + '-bp'), [], [], diyImageValue(id));
    if (p) { people.push(p); ggpMap[id] = pid; }
  });

  const gpDefs = [
    { id:'gpff', g:'M', pKeys:['ggpff','ggpfm'] },
    { id:'gpfm', g:'F', pKeys:['ggpmf','ggpmm'] },
    { id:'gpmf', g:'M', pKeys:['ggpmff','ggpmfm'] },
    { id:'gpmm', g:'F', pKeys:['ggpmmf','ggpmmm'] },
  ];
  const gpMap = {};
  gpDefs.forEach(({id, g, pKeys}) => {
    const fn = diyVal(id + '-fn');
    if (!fn) return;
    const pid = diySlug(fn, diyVal(id + '-ln'), id);
    const p = diyPerson(pid, fn, diyVal(id + '-ln'), g, diyVal(id + '-b'), diyVal(id + '-d'), diyVal(id + '-bp'), pKeys.map(k => ggpMap[k]).filter(Boolean), [], diyImageValue(id));
    if (p) { people.push(p); gpMap[id] = pid; }
  });
  const linkSpouses = (a, b) => {
    if (!a || !b) return;
    const pa = people.find(p => p.id === a);
    const pb = people.find(p => p.id === b);
    if (pa && !pa.s.includes(b)) pa.s.push(b);
    if (pb && !pb.s.includes(a)) pb.s.push(a);
  };
  linkSpouses(gpMap.gpff, gpMap.gpfm);
  linkSpouses(gpMap.gpmf, gpMap.gpmm);

  let pfId = null, pmId = null;
  if (diyVal('pf-fn')) {
    pfId = diySlug(diyVal('pf-fn'), diyVal('pf-ln'), 'father');
    const p = diyPerson(pfId, diyVal('pf-fn'), diyVal('pf-ln'), 'M', diyVal('pf-b'), diyVal('pf-d'), diyVal('pf-bp'), [gpMap.gpff, gpMap.gpfm].filter(Boolean), [], diyImageValue('pf'));
    if (p) { people.push(p); succession.push(pfId); }
  }
  if (diyVal('pm-fn')) {
    pmId = diySlug(diyVal('pm-fn'), diyVal('pm-ln'), 'mother');
    const p = diyPerson(pmId, diyVal('pm-fn'), diyVal('pm-ln'), 'F', diyVal('pm-b'), diyVal('pm-d'), diyVal('pm-bp'), [gpMap.gpmf, gpMap.gpmm].filter(Boolean), [], diyImageValue('pm'));
    if (p) { people.push(p); succession.push(pmId); }
  }
  linkSpouses(pfId, pmId);

  document.querySelectorAll('.diy-builder-card[data-kind="sibling"]').forEach(card => {
    const i = card.dataset.index;
    const fn = diyVal(`sibling${i}-fn`);
    if (!fn) return;
    const sid = diySlug(fn, diyVal(`sibling${i}-ln`), `sibling${i}`);
    const p = diyPerson(sid, fn, diyVal(`sibling${i}-ln`), diyRadio(`sibling${i}-g`), diyVal(`sibling${i}-b`), '', diyVal(`sibling${i}-bp`), [pfId, pmId].filter(Boolean), [], diyImageValue(`sibling${i}`));
    if (p) { people.push(p); succession.push(sid); }
  });

  const youFn = diyVal('you0-fn') || 'Osoba';
  const youId = diySlug(youFn, diyVal('you0-ln'), 'you');
  const spouseIds = [];
  document.querySelectorAll('.diy-builder-card[data-kind="spouse"]').forEach(card => {
    const i = card.dataset.index;
    const fn = diyVal(`spouse${i}-fn`);
    if (!fn) return;
    const sid = diySlug(fn, diyVal(`spouse${i}-ln`), `spouse${i}`);
    const p = diyPerson(sid, fn, diyVal(`spouse${i}-ln`), diyRadio(`spouse${i}-g`), diyVal(`spouse${i}-b`), '', diyVal(`spouse${i}-bp`), [], [youId], diyImageValue(`spouse${i}`));
    if (p) { people.push(p); spouseIds.push(sid); }
  });
  const you = diyPerson(youId, youFn, diyVal('you0-ln'), diyRadio('you0-g'), diyVal('you0-b'), '', diyVal('you0-bp'), [pfId, pmId].filter(Boolean), spouseIds, diyImageValue('you0'));
  const bio = diyVal('you0-bio');
  if (bio) you.bio = { pl: bio, en: bio, es: bio, fr: bio };
  people.push(you);
  succession.unshift(youId);

  document.querySelectorAll('.diy-builder-card[data-kind="child"]').forEach(card => {
    const i = card.dataset.index;
    const fn = diyVal(`child${i}-fn`);
    if (!fn) return;
    const cid = diySlug(fn, diyVal(`child${i}-ln`), `child${i}`);
    const p = diyPerson(cid, fn, diyVal(`child${i}-ln`), diyRadio(`child${i}-g`), diyVal(`child${i}-b`), '', diyVal(`child${i}-bp`), [youId, ...spouseIds.slice(0, 1)], [], diyImageValue(`child${i}`));
    if (p) { people.push(p); succession.push(cid); }
  });

  return {
    familyName: diyVal('diy-meta-name') || `${youFn} Family Tree`,
    defaultFocus: youId,
    succession,
    people: people.filter(Boolean)
  };
}

function diyBuilderImport(autoExportHtml) {
  if (!diyVal('you0-fn')) {
    alert('Wpisz imię osoby głównej w pierwszym kroku.');
    diyBuilderGo(0);
    return;
  }
  importDiyBuilderData(buildDiyBuilderData(), !!autoExportHtml);
}

function prepareBuilderDataForDiy(data) {
  if (!data || !Array.isArray(data.people) || data.people.length === 0) {
    throw new Error('Kreator nie przekazał prawidłowych danych drzewa.');
  }
  const people = data.people.map(p => ({...p}));
  normalizePeople(people);
  const sourceFocus = (data.defaultFocus && people.some(p => p.id === data.defaultFocus))
    ? data.defaultFocus
    : people[0].id;
  if (!sourceFocus) throw new Error('Brakuje osoby głównej drzewa.');

  if (sourceFocus !== DIY_FOCUS_ID) {
    const taken = people.some(p => p.id === DIY_FOCUS_ID && p.id !== sourceFocus);
    const collisionId = taken ? DIY_FOCUS_ID + '_old' : DIY_FOCUS_ID;
    for (const p of people) {
      if (p.id === DIY_FOCUS_ID && p.id !== sourceFocus) p.id = collisionId;
    }
    for (const p of people) {
      if (p.id === sourceFocus) p.id = DIY_FOCUS_ID;
      p.p = (p.p || []).map(id => id === sourceFocus ? DIY_FOCUS_ID : id === DIY_FOCUS_ID ? collisionId : id);
      p.s = (p.s || []).map(id => id === sourceFocus ? DIY_FOCUS_ID : id === DIY_FOCUS_ID ? collisionId : id);
    }
  }

  return {
    familyName: data.familyName || 'Zrób to sam',
    defaultFocus: DIY_FOCUS_ID,
    people
  };
}

function importDiyBuilderData(data, autoExportHtml = false) {
  let prepared;
  try {
    prepared = prepareBuilderDataForDiy(data);
  } catch(e) {
    alert(e && e.message ? e.message : 'Nie udało się wczytać danych z kreatora.');
    return false;
  }

  const replacingExisting = diyMode && Array.isArray(PEOPLE) && PEOPLE.length > 1;
  if (replacingExisting && !autoExportHtml) {
    const msg = `Wgrać drzewo "${prepared.familyName}" z kreatora?\n\nObecne drzewo "Zrób to sam" zostanie zastąpione.`;
    if (!confirm(msg)) return false;
  }

  try { localStorage.removeItem(DIY_STORAGE_KEY + '_meta'); } catch(e) {}
  activateRuntimeTree({
    people: prepared.people,
    familyName: prepared.familyName,
    defaultFocus: prepared.defaultFocus,
    storageKey: DIY_STORAGE_KEY,
    isLearning: false,
    isDiy: true
  });
  savePeople();
  closeDiyBuilder();
  openSidebarFor(DIY_FOCUS_ID);

  if (autoExportHtml) {
    setTimeout(() => exportDiyAsStandaloneHTML(), 250);
  } else {
    alert(`Wgrano drzewo z kreatora: ${prepared.people.length} osób.\nMożesz je dalej edytować albo kliknąć "Eksport HTML".`);
  }
  return true;
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'ELIADORA_DIY_BUILDER_IMPORT') {
    importDiyBuilderData(msg.data, false);
  }
  if (msg.type === 'ELIADORA_DIY_BUILDER_EXPORT_HTML') {
    importDiyBuilderData(msg.data, true);
  }
});

function maybeImportDiyBuilderPayload() {
  const params = new URLSearchParams(location.search || '');
  const shouldImport = params.has('diy_builder') || params.has('diy_builder_export');
  if (!shouldImport) return;
  try {
    const raw = localStorage.getItem(DIY_BUILDER_PAYLOAD_KEY);
    if (!raw) return;
    localStorage.removeItem(DIY_BUILDER_PAYLOAD_KEY);
    const data = JSON.parse(raw);
    setTimeout(() => importDiyBuilderData(data, params.has('diy_builder_export')), 180);
  } catch(e) {
    alert('Nie udało się odebrać danych z kreatora: ' + (e && e.message ? e.message : e));
  } finally {
    try { history.replaceState(null, document.title, location.pathname); } catch(e) {}
  }
}

function exitLearningTree() {
  exitSandboxTree();
}

function exitSandboxTree() {
  if (!learningMode && !diyMode) return;
  location.reload();
}

// ─── LAYOUT CONSTANTS ─────────────────────────────────────────────────────────
// Layout dimensions in SVG units (≈ CSS pixels at 100% zoom).
const L = {
  CW: 108,   // Card width
  CH: 104,   // Card height
  CG: 18,    // Card gap (horizontal gap between paired spouses within a unit)
  BU: 42,    // Between-unit gap (horizontal gap between separate family units)
  RH: 170,   // Row height (vertical distance between generation rows)
  PX: 80,    // Padding-X (left margin of the SVG content)
  PY: 70,    // Padding-Y (top margin of the SVG content)
  PR_N: 32,  // Portrait radius — normal (non-focal cards)
  PR_F: 38,  // Portrait radius — focal card (the highlighted person)
  PC_N: 37,  // Portrait center-Y — normal
  PC_F: 42,  // Portrait center-Y — focal
};
L.UW = L.CW * 2 + L.CG;   // Unit width — a couple (two cards + their inner gap)
L.CO = (L.CW + L.CG) / 2; // Card offset — distance from unit centre to each card centre
L.ML_Y = L.PC_N;          // Marriage-line Y — height at which the spouse line is drawn

// ─── RNG + AGE ────────────────────────────────────────────────────────────────
function seededRand(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return () => { h = (Math.imul(1664525, h) + 1013904223) | 0; return (h >>> 0) / 0xFFFFFFFF; };
}
function ageGroup(p) {
  const by  = birthYear(p.b);
  if (!by) return 'adult';
  const ref = birthYear(p.d) || new Date().getFullYear();
  const age = ref - by;
  return age < 15 ? 'child' : age < 65 ? 'adult' : 'elder';
}

// ─── FACE GENERATOR ───────────────────────────────────────────────────────────
function buildFaceSVG(person, r) {
  const rand=seededRand(person.id), grp=ageGroup(person);
  const isF=person.g==='F', isChild=grp==='child', isElder=grp==='elder';
  const cx=r, cy=r;
  const skinPal=isF?['#FDDCB5','#FDC8A0','#F5B480']:['#FDDCB5','#FDC8A0','#F5B480','#E8A068','#D48850'];
  const skin=skinPal[Math.floor(rand()*skinPal.length)];
  const hairPal=isElder?['#C0C0B8','#D0C8B0','#B8B8B0','#E0DDD8']:isChild?['#7B3A00','#C07028','#D4A020','#3A1800','#1A0800']:['#5C2800','#8B4513','#C07828','#1C0800','#2A2020','#7A6040'];
  const hair=hairPal[Math.floor(rand()*hairPal.length)];
  const OL='#5C2800', SW=Math.max(1.0,r*0.055);
  const hR=r*0.68, hCx=cx, hCy=cy+r*0.09;
  const bg=isChild&&isF?'#FFF0F5':isChild?'#F0F5FF':isF?'#FEF0F8':'#F0F5FF';
  const p=[];
  p.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}"/>`);
  if(isF&&!isElder) p.push(`<ellipse cx="${hCx}" cy="${hCy+hR*0.10}" rx="${hR*1.24}" ry="${hR*1.26}" fill="${hair}" stroke="${OL}" stroke-width="${SW*0.80}"/>`);
  p.push(`<circle cx="${hCx}" cy="${hCy}" r="${hR}" fill="${skin}" stroke="${OL}" stroke-width="${SW}"/>`);
  const earR=hR*0.148,earY=hCy+hR*0.02;
  [hCx-hR*0.91,hCx+hR*0.91].forEach(ex=>{p.push(`<circle cx="${ex}" cy="${earY}" r="${earR}" fill="${skin}" stroke="${OL}" stroke-width="${SW*0.65}"/>`);});
  if(isElder){
    if(!isF) p.push(`<ellipse cx="${hCx}" cy="${hCy-hR*0.82}" rx="${hR*0.46}" ry="${hR*0.18}" fill="${hair}" stroke="${OL}" stroke-width="${SW*0.55}" opacity="0.88"/>`);
    else{const capCy=hCy-hR*0.64;p.push(`<ellipse cx="${hCx}" cy="${capCy}" rx="${hR*1.04}" ry="${hR*0.40}" fill="${hair}" stroke="${OL}" stroke-width="${SW*0.75}"/>`);for(let i=-1;i<=1;i++)p.push(`<circle cx="${hCx+i*hR*0.42}" cy="${capCy-hR*0.22}" r="${hR*0.19}" fill="${hair}"/>`);}
  } else if(isF){
    const capCy=hCy-hR*0.72;p.push(`<ellipse cx="${hCx}" cy="${capCy}" rx="${hR*1.10}" ry="${hR*0.37}" fill="${hair}" stroke="${OL}" stroke-width="${SW*0.80}"/>`);
    if(isChild)[hCx-hR*1.06,hCx+hR*1.06].forEach(bx=>p.push(`<circle cx="${bx}" cy="${hCy-hR*0.20}" r="${hR*0.23}" fill="${hair}" stroke="${OL}" stroke-width="${SW*0.65}"/>`));
  } else {
    const capCy=hCy-hR*0.76;p.push(`<ellipse cx="${hCx}" cy="${capCy}" rx="${hR*0.98}" ry="${hR*0.32}" fill="${hair}" stroke="${OL}" stroke-width="${SW*0.80}"/>`);
    if(isChild)for(let i=-1;i<=1;i++){const sx=hCx+i*hR*0.32,tCy=hCy-hR*0.92;p.push(`<ellipse cx="${sx}" cy="${tCy}" rx="${hR*0.088}" ry="${hR*0.18}" fill="${hair}" transform="rotate(${i*14} ${sx} ${tCy+hR*0.10})"/>`);}
  }
  const eyeY=hCy-hR*0.14,eyeOff=hR*0.30,eyeRx=hR*0.158,eyeRy=hR*0.122;
  [-eyeOff,eyeOff].forEach(ox=>{const ex=hCx+ox;
    p.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="${eyeRx}" ry="${eyeRy}" fill="white" stroke="${OL}" stroke-width="${SW*0.52}"/>`);
    p.push(`<circle cx="${ex}" cy="${eyeY}" r="${hR*0.092}" fill="#3A1A00"/>`);
    p.push(`<circle cx="${ex+hR*0.040}" cy="${eyeY-hR*0.040}" r="${hR*0.026}" fill="white"/>`);
  });
  const browY=eyeY-hR*0.225,browCol=isElder?'#909088':OL;
  [-eyeOff,eyeOff].forEach(ox=>{const bx=hCx+ox,tilt=ox<0?0.042:-0.042;
    p.push(`<path d="M${bx-hR*0.135},${browY+hR*tilt} Q${bx},${browY-hR*0.052} ${bx+hR*0.135},${browY+hR*tilt}" fill="none" stroke="${browCol}" stroke-width="${SW*0.88}" stroke-linecap="round"/>`);
  });
  const noseY=hCy+hR*0.10;
  [-hR*0.08,hR*0.08].forEach(nx=>{const sign=nx<0?1:-1;
    p.push(`<path d="M${hCx+nx},${noseY} Q${hCx+nx*0.5},${noseY+hR*0.075} ${hCx+nx*sign*0.02},${noseY+hR*0.065}" fill="none" stroke="#C08060" stroke-width="${SW*0.58}" stroke-linecap="round" opacity="0.60"/>`);
  });
  const cheekY=eyeY+hR*0.28;
  [-eyeOff*1.18,eyeOff*1.18].forEach(ox=>p.push(`<ellipse cx="${hCx+ox}" cy="${cheekY}" rx="${hR*0.19}" ry="${hR*0.115}" fill="#FF5050" opacity="0.16"/>`));
  const mouthY=hCy+hR*0.35,mouthW=hR*(isChild?0.268:0.208),mouthD=hR*0.115;
  p.push(`<path d="M${hCx-mouthW},${mouthY} Q${hCx},${mouthY+mouthD} ${hCx+mouthW},${mouthY}" fill="none" stroke="#B84838" stroke-width="${SW*0.90}" stroke-linecap="round"/>`);
  if(isElder){const wc='#C09070';
    p.push(`<path d="M${hCx-hR*0.12},${noseY+hR*0.06} Q${hCx-hR*0.20},${mouthY-hR*0.06} ${hCx-mouthW*0.85},${mouthY}" fill="none" stroke="${wc}" stroke-width="${SW*0.46}" stroke-linecap="round" opacity="0.48"/>`);
    p.push(`<path d="M${hCx+hR*0.12},${noseY+hR*0.06} Q${hCx+hR*0.20},${mouthY-hR*0.06} ${hCx+mouthW*0.85},${mouthY}" fill="none" stroke="${wc}" stroke-width="${SW*0.46}" stroke-linecap="round" opacity="0.48"/>`);
    p.push(`<path d="M${hCx-hR*0.28},${hCy-hR*0.44} Q${hCx},${hCy-hR*0.47} ${hCx+hR*0.28},${hCy-hR*0.44}" fill="none" stroke="${wc}" stroke-width="${SW*0.36}" opacity="0.38"/>`);
  }
  return p.join('');
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function unitW(u) { return (u.male&&u.female)?L.UW:L.CW; }
function cardCx(unit, personId) {
  if (!unit.male||!unit.female) return unit.cx;
  const p=PMAP[personId];
  return p?unit.cx+(p.g==='M'?-L.CO:L.CO):unit.cx;
}

// ─── HOURGLASS BUILDER ────────────────────────────────────────────────────────
function buildHourglass(focusId) {
  function curSpouse(id){const p=PMAP[id];if(!p||!p.s.length)return null;return PMAP[p.s[p.s.length-1]]||null;}
  function mkUnit(id,vis){const p=PMAP[id];if(!p)return null;const sp=curSpouse(id);const male=p.g==='M'?p:(sp&&sp.g==='M'?sp:null);const female=p.g==='F'?p:(sp&&sp.g==='F'?sp:null);return{male,female,mainId:id,vis};}
  function getParents(id){
    const p=PMAP[id]; if(!p||!p.p.length) return null;
    if(p.p.length===1){ const par=PMAP[p.p[0]]; if(!par) return null; return par.g==='F'?{dad:null,mom:par}:{dad:par,mom:null}; }
    const dad=PMAP[p.p[0]]||null, mom=PMAP[p.p[1]]||null;
    return (dad||mom)?{dad,mom}:null;
  }
  const parents=getParents(focusId);
  const row0=[mkUnit(focusId,'full')].filter(Boolean);
  const row1=PEOPLE.filter(p=>p.p.includes(focusId))
    .sort((a,b)=>(birthYear(a.b)||0)-(birthYear(b.b)||0))
    .map(c=>mkUnit(c.id,'full')).filter(Boolean);
  // Row +2: grandchildren, grouped by parent (preserves layout order), sorted within each group.
  const row2=[]; const gcSeen=new Set();
  row1.forEach(u=>{
    const groupKids=[];
    PEOPLE.forEach(gc=>{
      if(gcSeen.has(gc.id)||!gc.p.includes(u.mainId))return;
      gcSeen.add(gc.id);
      const p=PMAP[gc.id]; if(!p) return;
      groupKids.push({male:p.g==='M'?p:null, female:p.g==='F'?p:null, mainId:gc.id, vis:'faded', parentMainId:u.mainId});
    });
    // Sort within this parent's group only — never across groups
    groupKids.sort((a,b)=>(birthYear(PMAP[a.mainId]?.b)||0)-(birthYear(PMAP[b.mainId]?.b)||0));
    row2.push(...groupKids);
  });
  let rowM1=[];
  if(parents){const dad=parents.dad,mom=parents.mom;const male=dad?.g==='M'?dad:(mom?.g==='M'?mom:null);const female=mom?.g==='F'?mom:(dad?.g==='F'?dad:null);rowM1=[{male,female,mainId:dad?.id||mom?.id,vis:'full'}].filter(u=>u&&u.mainId);}
  const rowM2=[];
  if(parents){
    if(parents.dad){const dp=getParents(parents.dad.id);if(dp){const u=mkUnit(dp.dad?.id||dp.mom?.id,'full');if(u)rowM2.push({...u,childId:parents.dad.id});}}
    if(parents.mom){const mp=getParents(parents.mom.id);if(mp){const u=mkUnit(mp.dad?.id||mp.mom?.id,'full');if(u)rowM2.push({...u,childId:parents.mom.id});}}
  }
  const siblings=[],seen=new Set([focusId]);
  if(parents){
    const dadId=parents.dad?.id, momId=parents.mom?.id;
    PEOPLE.forEach(p=>{
      if(seen.has(p.id))return;
      const sharesDad=!!(dadId&&p.p.includes(dadId));
      const sharesMom=!!(momId&&p.p.includes(momId));
      if(!sharesDad&&!sharesMom)return;
      const spId=p.s[p.s.length-1];
      seen.add(p.id);if(spId)seen.add(spId);
      const isHalf=!(sharesDad&&sharesMom);
      const u=mkUnit(p.id,'faded'); if(!u) return;
      siblings.push({...u,isHalf});
    });
  }
  siblings.sort((a,b)=>(birthYear(PMAP[a.mainId]?.b)||0)-(birthYear(PMAP[b.mainId]?.b)||0));
  const formerSpouses=[];
  const fp=PMAP[focusId];
  if(fp&&fp.s.length>1){
    for(let i=0;i<fp.s.length-1;i++){
      const fs=PMAP[fp.s[i]]; if(!fs) continue;
      formerSpouses.push({male:fs.g==='M'?fs:null, female:fs.g==='F'?fs:null, mainId:fs.id, vis:'full', isFormer:true});
    }
  }
  return{row0,rowM1,rowM2,row1,row2,siblings,formerSpouses};
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
function calculateLayout(hg) {
  const Y={M2:L.PY,M1:L.PY+L.RH,R0:L.PY+L.RH*2,R1:L.PY+L.RH*3,R2:L.PY+L.RH*4};
  function rw(us){return us.length?us.reduce((s,u)=>s+unitW(u),0)+(us.length-1)*L.BU:0;}
  function ax(us,cx){let x=cx-rw(us)/2;return us.map(u=>{const uw=unitW(u),ucx=x+uw/2;x+=uw+L.BU;return{...u,cx:ucx};});}
  const r2=ax(hg.rowM2,0),r1=ax(hg.rowM1,0),r0=ax(hg.row0,0),r1p=ax(hg.row1,0);
  // Row+2: simple global centering, but parent-grouped order (fixed in buildHourglass).
  // Grouping prevents crossing lines between different families.
  // Simple centering keeps the row compact and avoids excessive spread.
  const r2p=ax(hg.row2,0);

  const fHW=r0.length?unitW(r0[0])/2:0;
  const fS=hg.siblings.filter(s=>!s.isHalf),hS=hg.siblings.filter(s=>s.isHalf);
  let rx=fHW+L.BU;const rS=fS.map(s=>{const uw=unitW(s),cx=rx+uw/2;rx+=uw+L.BU;return{...s,cx};});
  let lx=-(fHW+L.BU);const lS=hS.map(s=>{const uw=unitW(s),cx=lx-uw/2;lx-=uw+L.BU;return{...s,cx};});
  // Former spouses: placed left of focal couple, oldest furthest left.
  const fmr=[];
  if(hg.formerSpouses&&hg.formerSpouses.length){
    const focalLE=r0.length?r0[0].cx-unitW(r0[0])/2:0;
    let nextRE=focalLE-L.BU;
    for(let i=hg.formerSpouses.length-1;i>=0;i--){
      const fs=hg.formerSpouses[i], uw=unitW(fs), cx=nextRE-uw/2;
      nextRE=cx-uw/2-L.BU;
      fmr[i]={...fs,cx};
    }
  }
  const all=[...r2,...r1,...r0,...r1p,...r2p,...rS,...lS,...fmr];
  if(!all.length)return{rowM2:[],rowM1:[],row0:[],row1:[],row2:[],siblings:[],formerSpouseUnits:[],svgW:800,svgH:600,focalCx:400};
  const le=Math.min(...all.map(u=>u.cx-unitW(u)/2));
  const re=Math.max(...all.map(u=>u.cx+unitW(u)/2));
  const sh=u=>({...u,cx:u.cx+(L.PX-le)});
  let maxY=Y.R0+L.CH;
  if(r1p.length)maxY=Math.max(maxY,Y.R1+L.CH);
  if(r2p.length)maxY=Math.max(maxY,Y.R2+L.CH);
  return{
    rowM2:r2.map(u=>({...sh(u),y:Y.M2})),rowM1:r1.map(u=>({...sh(u),y:Y.M1})),
    row0:r0.map(u=>({...sh(u),y:Y.R0})),row1:r1p.map(u=>({...sh(u),y:Y.R1})),
    row2:r2p.map(u=>({...sh(u),y:Y.R2})),siblings:[...rS,...lS].map(u=>({...sh(u),y:Y.R0})),
    formerSpouseUnits:fmr.map(u=>({...sh(u),y:Y.R0})),
    svgW:Math.ceil(re-le+L.PX*2),svgH:maxY+L.PY,
    focalCx:(r0.length?r0[0].cx:0)+(L.PX-le),
  };
}

// ─── FLAT DATA BUILDERS ───────────────────────────────────────────────────────
function buildCardData(pos,focusId){
  const cards=[];
  function addUnit(unit,isFormer){
    const lx=unit.cx-unitW(unit)/2,op=unit.vis==='faded'?0.42:1;
    if(unit.male&&unit.female){
      cards.push({id:unit.male.id,  x:lx,           y:unit.y,person:unit.male,  isFocal:unit.male.id===focusId,  opacity:op,isFormer:!!isFormer});
      cards.push({id:unit.female.id,x:lx+L.CW+L.CG, y:unit.y,person:unit.female,isFocal:unit.female.id===focusId,opacity:op,isFormer:!!isFormer});
    } else {
      const p=unit.male||unit.female;
      if(p) cards.push({id:p.id,x:lx,y:unit.y,person:p,isFocal:p.id===focusId,opacity:op,isFormer:!!isFormer});
    }
  }
  [...pos.rowM2,...pos.rowM1,...pos.row0,...pos.row1,...pos.row2,...pos.siblings].forEach(u=>addUnit(u,false));
  (pos.formerSpouseUnits||[]).forEach(u=>addUnit(u,true));
  return cards;
}
function buildMarriageData(pos){
  const lines=[];
  function addUnit(unit){if(!unit.male||!unit.female)return;const lx=unit.cx-unitW(unit)/2;
    lines.push({key:unit.male.id+'~'+unit.female.id,x1:lx+L.CW,y1:unit.y+L.ML_Y,x2:lx+L.CW+L.CG,y2:unit.y+L.ML_Y,op:unit.vis==='faded'?0.35:1});}
  [...pos.rowM2,...pos.rowM1,...pos.row0,...pos.row1,...pos.row2,...pos.siblings].forEach(addUnit);
  return lines;
}

// ─── DRAW CARD ────────────────────────────────────────────────────────────────
function drawCardInto(sel, d) {
  sel.selectAll('*').remove();
  const person=d.person, pr=d.isFocal?L.PR_F:L.PR_N, pc=d.isFocal?L.PC_F:L.PC_N;
  const cxC=L.CW/2, nameY=pc+pr+13, surnameY=pc+pr+24;
  let fill=person.g==='M'?'#dde9f3':'#f5e4ee', stroke=person.g==='M'?'#6b9db8':'#c07898', rimCol=person.g==='M'?'#5888a0':'#b06080';
  if(d.isFocal){fill='#fffbe8';stroke='#c8960a';rimCol='#a07810';}
  // Former spouses keep their gender fill but get a dashed amber border
  const isFormerCard = d.isFormer && !d.isFocal;
  if(isFormerCard){ stroke='#b89040'; rimCol=person.g==='M'?'#5888a0':'#b06080'; }
  sel.append('rect').attr('x',2).attr('y',3).attr('width',L.CW).attr('height',L.CH).attr('rx',10).attr('fill','rgba(0,0,0,0.08)');
  const cardRect = sel.append('rect').attr('x',0).attr('y',0).attr('width',L.CW).attr('height',L.CH).attr('rx',10).attr('fill',fill).attr('stroke',stroke).attr('stroke-width',d.isFocal?2.5:1.5);
  if(isFormerCard) cardRect.attr('stroke-dasharray','5,3');
  if(d.isFocal){sel.append('circle').attr('cx',cxC).attr('cy',pc).attr('r',pr+5).attr('fill','none').attr('stroke','#e8b800').attr('stroke-width',3).attr('opacity',0.55);sel.append('circle').attr('cx',cxC).attr('cy',pc).attr('r',pr+10).attr('fill','none').attr('stroke','#f0d040').attr('stroke-width',1).attr('opacity',0.22);}
  const clipId='cp-'+person.id+(d.isFocal?'f':'n');
  sel.append('defs').append('clipPath').attr('id',clipId).append('circle').attr('cx',cxC).attr('cy',pc).attr('r',pr);
  sel.append('g').attr('clip-path',`url(#${clipId})`).append('g').attr('transform',`translate(${cxC-pr},${pc-pr})`).html(buildFaceSVG(person,pr));
  sel.append('circle').attr('cx',cxC).attr('cy',pc).attr('r',pr).attr('clip-path',`url(#${clipId})`).attr('fill','white');
  // Image source: focal+gif → animate; person.image → portrait; else generic placeholder
  const imgSrc = (d.isFocal && person.gif) ? person.gif
               : person.image ? person.image
               : `${ageGroup(person)}_${person.g.toLowerCase()}.png`;
  sel.append('image').attr('class','portrait-img').attr('href',runtimeAssetUrl(imgSrc)).attr('x',cxC-pr).attr('y',pc-pr).attr('width',pr*2).attr('height',pr*2).attr('clip-path',`url(#${clipId})`).attr('preserveAspectRatio','xMidYMid slice');
  if(personVideoSrc(person)){
    sel.append('circle').attr('cx',cxC+pr-8).attr('cy',pc+pr-8).attr('r',9).attr('fill','#3a2410').attr('opacity',0.82);
    sel.append('path').attr('d',`M ${cxC+pr-11} ${pc+pr-13} L ${cxC+pr-11} ${pc+pr-3} L ${cxC+pr-3} ${pc+pr-8} Z`).attr('fill','#fff4d0');
  }
  sel.append('circle').attr('cx',cxC).attr('cy',pc).attr('r',pr).attr('fill','none').attr('stroke',rimCol).attr('stroke-width',d.isFocal?2.5:1.8);
  const cardName = seniorMode ? String(person.fn || '').toUpperCase() : person.fn;
  const cardSurname = seniorMode ? String(person.ln || '').toUpperCase() : person.ln;
  sel.append('text').attr('x',cxC).attr('y',nameY).attr('text-anchor','middle').attr('font-size',seniorMode?(d.isFocal?'13px':'12px'):(d.isFocal?'12px':'11px')).attr('font-weight','800').attr('fill','#120904').attr('stroke','#fff5dc').attr('stroke-width',1.8).attr('paint-order','stroke').attr('font-family','Segoe UI, sans-serif').text(cardName);
  sel.append('text').attr('x',cxC).attr('y',surnameY).attr('text-anchor','middle').attr('font-size',seniorMode?'10px':'9px').attr('font-weight','800').attr('fill','#2b1708').attr('stroke','#fff5dc').attr('stroke-width',1.45).attr('paint-order','stroke').attr('font-family','Segoe UI, sans-serif').text(cardSurname);
  // Flags are shown in the sidebar only — not on the card.
}

// ─── CONNECTORS ───────────────────────────────────────────────────────────────
function drawConnectors(g,pos,focusId,animate=false){
  const col='#9b7820',lw=1.5;
  // Per-family colour palette for row+2. Warm muted tones on parchment.
  // Each row+1 family gets its own colour so grandchildren groups are visually distinct.
  const PALETTE=['#9b7820','#7a5a9a','#2a7a5a','#8a3a3a','#2a5a8a','#9a602a'];
  let _col=col;
  let burnIndex=0;
  function magmaBurn(el){
    if(!animate) return;
    const node=el.node();
    if(!node) return;
    const finalStroke=el.attr('stroke')||_col;
    const finalOpacity=el.attr('opacity')||'0.76';
    const finalDash=el.attr('stroke-dasharray');
    const len=Math.max(1, (node.getTotalLength ? node.getTotalLength() : Math.hypot((+el.attr('x2')||0)-(+el.attr('x1')||0), (+el.attr('y2')||0)-(+el.attr('y1')||0))));
    el.interrupt()
      .attr('filter','url(#magmaGlow)')
      .attr('stroke','#ff7a18')
      .attr('opacity',0.95)
      .attr('stroke-dasharray',len)
      .attr('stroke-dashoffset',len)
      .transition()
      .delay(Math.min(240, burnIndex++ * 22))
      .duration(360)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset',0)
      .on('end', function(){
        const s=d3.select(this);
        s.attr('filter',null)
          .attr('stroke-dashoffset',null)
          .attr('stroke-dasharray',finalDash || null)
          .transition()
          .duration(180)
          .attr('stroke',finalStroke)
          .attr('opacity',finalOpacity);
      });
  }
  function seg(x1,y1,x2,y2,dash,op){const o=op??(dash?0.56:0.76);const el=g.append('line').attr('class','conn').attr('x1',x1).attr('y1',y1).attr('x2',x2).attr('y2',y2).attr('stroke',_col).attr('stroke-width',dash?lw-0.35:lw+0.25).attr('opacity',o);if(dash)el.attr('stroke-dasharray','5,3');magmaBurn(el);}
  function elbow(sx,sy,tx,ty,dash,op){const o=op??(dash?0.56:0.76),my=(sy+ty)/2;const el=g.append('path').attr('class','conn').attr('d',`M${sx},${sy} V${my} H${tx} V${ty}`).attr('fill','none').attr('stroke',_col).attr('stroke-width',dash?lw-0.35:lw+0.25).attr('opacity',o);if(dash)el.attr('stroke-dasharray','5,3');magmaBurn(el);}
  function fan(sx,sy,targets,dash,op){if(!targets.length)return;const tY=targets[0].y,mid=(sy+tY)/2,xs=[sx,...targets.map(t=>t.x)];seg(sx,sy,sx,mid,dash,op);seg(Math.min(...xs),mid,Math.max(...xs),mid,dash,op);targets.forEach(t=>seg(t.x,mid,t.x,t.y,dash,op));}
  function connectDown(pu,cus,dash,op){if(!cus.length)return;const ids=new Set([pu.male?.id,pu.female?.id].filter(Boolean));const cur=[],half=[];cus.forEach(u=>{const c=PMAP[u.mainId],sh=c?c.p.filter(pid=>ids.has(pid)).length:0;(sh>=2?cur:half).push({x:cardCx(u,u.mainId),y:u.y});});if(cur.length)fan(pu.cx,pu.y+L.CH,cur,dash,op);if(half.length){const fx=cardCx(pu,pu.mainId);half.forEach(({x,y})=>elbow(fx,pu.y+L.CH,x,y,true,op));}}
  if(pos.rowM1.length)pos.rowM2.forEach(gp=>{if(gp.childId)elbow(gp.cx,gp.y+L.CH,cardCx(pos.rowM1[0],gp.childId),pos.rowM1[0].y,false);});
  if(pos.rowM1.length&&pos.row0.length){const src=pos.rowM1[0];const fT={x:cardCx(pos.row0[0],focusId),y:pos.row0[0].y};const fST=pos.siblings.filter(s=>!s.isHalf).map(s=>({x:cardCx(s,s.mainId),y:s.y}));fan(src.cx,src.y+L.CH,[fT,...fST],false);pos.siblings.filter(s=>s.isHalf).forEach(hs=>elbow(cardCx(src,src.mainId),src.y+L.CH,cardCx(hs,hs.mainId),hs.y,true));}
  if(pos.row1.length&&pos.row0.length)connectDown(pos.row0[0],pos.row1,false);
  // Row+2: each family group gets its own colour from the palette
  if(pos.row2.length&&pos.row1.length){
    const gcM=new Map();
    pos.row2.forEach(u=>{if(!gcM.has(u.parentMainId))gcM.set(u.parentMainId,[]);gcM.get(u.parentMainId).push(u);});
    pos.row1.forEach((r1u,idx)=>{
      const grp=gcM.get(r1u.mainId);
      if(!grp?.length)return;
      _col=PALETTE[idx%PALETTE.length]; // assign this family's colour
      connectDown(r1u,grp,false,0.45);
    });
    _col=col; // reset to default
  }
  // Former spouses: dashed line from each former spouse's right edge to focal person's left edge.
  // Drawn at card mid-height (L.ML_Y). Uses a distinct muted colour to signal past marriage.
  if(pos.formerSpouseUnits&&pos.formerSpouseUnits.length&&pos.row0.length){
    const focalUnit=pos.row0[0];
    const focalLeftX=focalUnit.cx-unitW(focalUnit)/2;
    const lineY=focalUnit.y+L.ML_Y;
    pos.formerSpouseUnits.forEach(fsu=>{
      const fsRightX=fsu.cx+unitW(fsu)/2;
      const el=g.append('line').attr('class','conn')
        .attr('x1',fsRightX).attr('y1',lineY).attr('x2',focalLeftX).attr('y2',lineY)
        .attr('stroke','#a09880').attr('stroke-width',1.5)
        .attr('stroke-dasharray','6,4').attr('opacity',0.7);
      magmaBurn(el);
    });
  }
}

// ─── SVG LAYERS ───────────────────────────────────────────────────────────────
const ROOT=d3.select('#tree-svg');
const svgDefs=ROOT.append('defs');
svgDefs.html(`
  <filter id="magmaGlow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur"/>
    <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.95  0 0.38 0 0 0.18  0 0 0.08 0 0.02  0 0 0 0.85 0" result="hot"/>
    <feMerge>
      <feMergeNode in="hot"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
`);
// Inner SVG background — slightly lighter than the body sepia so the tree "page"
// reads as parchment laid on a book surface.
const bgR=ROOT.append('rect').attr('fill','#f0ddb6').attr('opacity',0.10);
const bgTint=ROOT.append('rect').attr('fill','#f0ddb6').attr('opacity',0);
const grainL=ROOT.append('g'),labelL=ROOT.append('g'),connL=ROOT.append('g'),cardL=ROOT.append('g');

function updateGrain(pos){
  // Clears any previous grain artwork and applies the current theme's parchment
  // tint to the SVG background rect. The historical updateGrainOld() that drew
  // line/speck textures inside the SVG was removed — it lives only as CSS now.
  grainL.selectAll('*').remove();
  const theme = THEME_CONFIG[activeTheme] || THEME_CONFIG.nature;
  if (bgR)   bgR.attr('fill', theme.svgBg).attr('opacity', 0.10);
  if (bgTint) bgTint.attr('fill', theme.svgBg).attr('opacity', 0);
}
function updateLabels(pos){labelL.selectAll('*').remove();const add=(y,txt)=>labelL.append('text').attr('x',16).attr('y',y+L.CH/2+4).attr('text-anchor','start').attr('font-size',seniorMode?'13px':'11px').attr('font-weight','800').attr('fill','#4f310f').attr('stroke','#f6e7c3').attr('stroke-width',2.2).attr('paint-order','stroke').attr('font-family','Georgia, serif').attr('letter-spacing','1px').text(seniorMode?String(txt).toUpperCase():txt);
  if(pos.rowM2.length)add(pos.rowM2[0].y,t('grandparents'));if(pos.rowM1.length)add(pos.rowM1[0].y,t('parents'));if(pos.row1.length)add(pos.row1[0].y,t('children'));if(pos.row2.length)add(pos.row2[0].y,t('grandchildren'));}

// ─── TREE TRANSITION ──────────────────────────────────────────────────────────
let currentFocusId=null, transitioning=false;
let lastLayout=null, treeZoom=1, navHistory=[], navIndex=-1, suppressHistory=false;
let suppressNextCardClick=false;
let transitionTimer=null, transitionSeq=0, pendingFocusId=null;

function personLabel(p) {
  return `${p.fn || ''} ${p.ln || ''}${p.b ? ' (' + String(p.b).slice(0,4) + ')' : ''}`.trim();
}
function rebuildPersonSearch() {
  const list = document.getElementById('people-search-list');
  if (!list) return;
  list.innerHTML = PEOPLE
    .slice()
    .sort((a,b)=>personLabel(a).localeCompare(personLabel(b), 'pl'))
    .map(p=>`<option value="${esc(personLabel(p))}" data-id="${esc(p.id)}"></option>`)
    .join('');
}
function updateNavControls() {
  const back = document.getElementById('nav-back');
  const fwd = document.getElementById('nav-forward');
  if (back) back.disabled = navIndex <= 0;
  if (fwd) fwd.disabled = navIndex < 0 || navIndex >= navHistory.length - 1;
  const zoom = document.getElementById('zoom-label');
  if (zoom) zoom.textContent = Math.round(treeZoom * 100) + '%';
  const search = document.getElementById('person-search');
  if (search && currentFocusId && PMAP[currentFocusId]) search.value = personLabel(PMAP[currentFocusId]);
}
function rememberNavigation(id) {
  if (!id) return;
  if (suppressHistory) { suppressHistory = false; updateNavControls(); return; }
  if (navHistory[navIndex] === id) { updateNavControls(); return; }
  navHistory = navHistory.slice(0, navIndex + 1);
  navHistory.push(id);
  navIndex = navHistory.length - 1;
  updateNavControls();
}
function goHistory(delta) {
  const next = navIndex + delta;
  if (next < 0 || next >= navHistory.length) return;
  navIndex = next;
  suppressHistory = true;
  transitionTo(navHistory[navIndex], true);
  updateNavControls();
}
function navHome() {
  const fid = DEFAULT_FOCUS();
  if (fid && PMAP[fid]) transitionTo(fid, true);
}
function navSearchCommit() {
  const input = document.getElementById('person-search');
  if (!input) return;
  const q = input.value.trim().toLowerCase();
  if (!q) return;
  const exact = PEOPLE.find(p => personLabel(p).toLowerCase() === q);
  const partial = exact || PEOPLE.find(p => personLabel(p).toLowerCase().includes(q));
  if (partial) transitionTo(partial.id, true);
}
function applyTreeZoom(pos = lastLayout) {
  if (!pos) return;
  const svg = document.getElementById('tree-svg');
  svg.style.width = Math.round(pos.svgW * treeZoom) + 'px';
  svg.style.height = Math.round(pos.svgH * treeZoom) + 'px';
  updateNavControls();
}
function visibleTreeWidth() {
  const c = document.getElementById('tree-container');
  const raw = c?.clientWidth || window.innerWidth || 900;
  let reserved = 0;
  try {
    if (typeof sidebarEl !== 'undefined' && sidebarEl && !sidebarHidden) {
      reserved = Math.max(0, sidebarEl.offsetWidth - 34);
    }
  } catch(e) {}
  return Math.max(420, raw - reserved);
}
function fitLayoutToViewport(pos) {
  const minSvgW = Math.ceil(visibleTreeWidth() / Math.max(0.1, treeZoom));
  if (!pos || pos.svgW >= minSvgW) return pos;
  const dx = Math.round((minSvgW - pos.svgW) / 2);
  const shift = u => ({...u, cx: u.cx + dx});
  return {
    ...pos,
    rowM2: pos.rowM2.map(shift),
    rowM1: pos.rowM1.map(shift),
    row0: pos.row0.map(shift),
    row1: pos.row1.map(shift),
    row2: pos.row2.map(shift),
    siblings: pos.siblings.map(shift),
    formerSpouseUnits: (pos.formerSpouseUnits || []).map(shift),
    svgW: minSvgW,
    focalCx: pos.focalCx + dx,
  };
}
function zoomTree(delta) {
  treeZoom = Math.max(0.65, Math.min(1.75, Math.round((treeZoom + delta) * 100) / 100));
  if (currentFocusId && !transitioning) {
    const pos = fitLayoutToViewport(calculateLayout(buildHourglass(currentFocusId)));
    lastLayout = pos;
    ROOT.attr('width',pos.svgW).attr('height',pos.svgH).attr('viewBox',`0 0 ${pos.svgW} ${pos.svgH}`);
    bgR.attr('width',pos.svgW).attr('height',pos.svgH);
    bgTint.attr('width',pos.svgW).attr('height',pos.svgH);
    applyTreeZoom(pos);
  } else {
    applyTreeZoom();
  }
  if (currentFocusId) setTimeout(centerCurrent, 40);
}
function resetZoom() {
  treeZoom = 1;
  if (currentFocusId && !transitioning) {
    const pos = fitLayoutToViewport(calculateLayout(buildHourglass(currentFocusId)));
    lastLayout = pos;
    ROOT.attr('width',pos.svgW).attr('height',pos.svgH).attr('viewBox',`0 0 ${pos.svgW} ${pos.svgH}`);
    bgR.attr('width',pos.svgW).attr('height',pos.svgH);
    bgTint.attr('width',pos.svgW).attr('height',pos.svgH);
    applyTreeZoom(pos);
  } else {
    applyTreeZoom();
  }
  if (currentFocusId) setTimeout(centerCurrent, 40);
}
function centerCurrent() {
  if (!currentFocusId) return;
  const pos = fitLayoutToViewport(calculateLayout(buildHourglass(currentFocusId)));
  lastLayout = pos;
  scrollToFocus(pos);
}

function interruptTreeMotion() {
  if (transitionTimer) {
    clearTimeout(transitionTimer);
    transitionTimer = null;
  }
  cardL.selectAll('*').interrupt();
  connL.selectAll('*').interrupt();
  labelL.selectAll('*').interrupt();
}

function transitionTo(newFocusId, animate) {
  if(!newFocusId || !PMAP[newFocusId]) return;
  if(animate&&!transitioning&&newFocusId===currentFocusId){
    centerCurrent();
    if(!sidebarHidden)openSidebarFor(newFocusId);
    return;
  }
  const token=++transitionSeq;
  pendingFocusId=newFocusId;
  interruptTreeMotion();
  transitioning=true;
  let hg, pos, cards, marriages;
  try {
    hg=buildHourglass(newFocusId); pos=fitLayoutToViewport(calculateLayout(hg));
    cards=buildCardData(pos,newFocusId); marriages=buildMarriageData(pos);
  } catch(e) {
    console.error('Eliadora: failed to build hourglass for', newFocusId, e);
    transitioning=false; pendingFocusId=null; return;
  }
  const FADE=animate?80:0,MOVE=animate?260:0,TOTAL=FADE+MOVE+40;
  lastLayout = pos;
  ROOT.attr('width',pos.svgW).attr('height',pos.svgH).attr('viewBox',`0 0 ${pos.svgW} ${pos.svgH}`);
  applyTreeZoom(pos);
  bgR.attr('width',pos.svgW).attr('height',pos.svgH);
  bgTint.attr('width',pos.svgW).attr('height',pos.svgH);
  updateGrain(pos);
  connL.selectAll('.conn').remove();
  const mSel=connL.selectAll('.ml').data(marriages,d=>d.key);
  mSel.exit().remove();
  mSel.enter().append('line').attr('class','ml').attr('stroke','#8b6914').attr('stroke-width',2).attr('x1',d=>d.x1).attr('y1',d=>d.y1).attr('x2',d=>d.x2).attr('y2',d=>d.y2).attr('opacity',0).transition().duration(120).delay(FADE).attr('opacity',d=>d.op);
  mSel.transition().duration(MOVE).delay(FADE).attr('x1',d=>d.x1).attr('y1',d=>d.y1).attr('x2',d=>d.x2).attr('y2',d=>d.y2).attr('opacity',d=>d.op);
  const cSel=cardL.selectAll('.card-g').data(cards,d=>d.id);
  cSel.exit().transition().duration(FADE).attr('opacity',0).remove();
  const entered=cSel.enter().append('g').attr('class','card-g').attr('transform',d=>`translate(${d.x},${d.y})`).attr('opacity',0).on('click',(ev,d)=>onCardClick(d.id));
  entered.each(function(d){drawCardInto(d3.select(this),d);});
  if(animate) entered.classed('entering',true);
  entered.transition().duration(140).delay(FADE).attr('opacity',d=>d.opacity);
  cSel.on('click',(ev,d)=>onCardClick(d.id));
  cSel.each(function(d){drawCardInto(d3.select(this),d);});
  if(animate) cSel.classed('entering',true);
  cSel.classed('revealing',false).transition().duration(MOVE).delay(FADE).attr('transform',d=>`translate(${d.x},${d.y})`).attr('opacity',d=>d.opacity);
  transitionTimer=setTimeout(()=>{
    if(token!==transitionSeq) return;
    if(animate) {
      cardL.selectAll('.card-g').classed('entering',true);
      setTimeout(()=>cardL.selectAll('.card-g').classed('entering',false), 560);
    }
    drawConnectors(connL,pos,newFocusId,animate);
    updateLabels(pos);
    if(animate){scrollToFocus(pos);if(!sidebarHidden)openSidebarFor(newFocusId);}
    currentFocusId=newFocusId;
    rememberNavigation(newFocusId);
    pendingFocusId=null;
    transitioning=false;
    transitionTimer=null;
  },TOTAL);
}

function onCardClick(personId) {
  if (suppressNextCardClick) return;
  transitionTo(personId, true);
}

function scrollToFocus(pos) {
  const c = document.getElementById('tree-container');
  const sbVisible = (!sidebarHidden && sidebarEl) ? Math.max(0, sidebarEl.offsetWidth - 34) : 0;
  const availW    = c.clientWidth - sbVisible;
  const contentW = pos.svgW * treeZoom;
  const maxLeft = Math.max(0, contentW - c.clientWidth);
  const desiredLeft = pos.focalCx * treeZoom - Math.max(420, availW) / 2;
  const scrollLeft = Math.max(0, Math.min(maxLeft, desiredLeft));
  const focalRowY  = L.PY + L.RH * 2;
  const contentH = pos.svgH * treeZoom;
  const maxTop = Math.max(0, contentH - c.clientHeight);
  const scrollTop  = Math.max(0, Math.min(maxTop, focalRowY * treeZoom - c.clientHeight * 0.30));
  c.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'smooth' });
}

function initDragPan() {
  const c = document.getElementById('tree-container');
  if (!c) return;
  let dragging=false, moved=false, startX=0, startY=0, startLeft=0, startTop=0;
  c.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.card-g,#app-header,#sidebar,#lightbox,button,input,select,textarea')) return;
    dragging=true; moved=false;
    startX=e.clientX; startY=e.clientY; startLeft=c.scrollLeft; startTop=c.scrollTop;
    c.classList.add('panning');
    c.setPointerCapture?.(e.pointerId);
  });
  c.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    if (Math.abs(dx)+Math.abs(dy)>5) moved=true;
    c.scrollLeft=startLeft-dx;
    c.scrollTop=startTop-dy;
  });
  const end = e => {
    if (!dragging) return;
    dragging=false;
    c.classList.remove('panning');
    try { c.releasePointerCapture?.(e.pointerId); } catch(err) {}
    if (moved) {
      suppressNextCardClick=true;
      setTimeout(()=>{ suppressNextCardClick=false; }, 80);
    }
  };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  c.addEventListener('pointerleave', end);
}

// ─── SIDEBAR LOGIC ─────────────────────────────────────────────────────────────
// sidebarHidden: true when user manually closed — stays closed until manually re-opened.
// When re-opened manually, reverts to auto-open behaviour on every node click.
let sidebarHidden = false;

const sidebarEl = document.getElementById('sidebar');
const sbArrow    = document.getElementById('sb-arrow');

function openSidebarFor(personId) {
  updateSidebar(personId);
  sidebarEl.classList.add('open');
  sbArrow.innerHTML = '&#9654;';  // ▶ = "click to close"
}
function closeSidebar(manual) {
  sidebarEl.classList.remove('open');
  sbArrow.innerHTML = '&#9664;';  // ◀ = "click to open"
  if (manual) sidebarHidden = true;
}

document.getElementById('sb-toggle').addEventListener('click', () => {
  if (sidebarEl.classList.contains('open')) {
    closeSidebar(true);  // manual close → stays hidden
  } else {
    sidebarHidden = false;  // manual open → resume auto mode
    openSidebarFor(currentFocusId);
  }
});

// ─── SIDEBAR CONTENT UPDATE ───────────────────────────────────────────────────
function updateSidebar(personId) {
  if (editorActive) return;  // don't overwrite the edit form
  const person = PMAP[personId];
  if (!person) return;

  // ── Profile photo ──────────────────────────────────────────────────────────
  const pr = 64, cx = 72, cy = 72;
  const sbSvg = d3.select('#sb-photo-svg');
  sbSvg.selectAll('*').remove();
  document.querySelectorAll('#sb-photo-wrap .sb-photo-video').forEach(el => el.remove());

  // Background ring matching card colour
  const bg  = person.g === 'F' ? '#f5e4ee' : '#dde9f3';
  const rim = person.g === 'F' ? '#b06080' : '#5888a0';
  sbSvg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',pr+3).attr('fill',bg).attr('stroke',rim).attr('stroke-width',2.5);

  const clipId = 'sb-cp-' + person.id;
  sbSvg.append('defs').append('clipPath').attr('id',clipId).append('circle').attr('cx',cx).attr('cy',cy).attr('r',pr);
  sbSvg.append('g').attr('clip-path',`url(#${clipId})`).append('g').attr('transform',`translate(${cx-pr},${cy-pr})`).html(buildFaceSVG(person,pr));
  sbSvg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',pr).attr('clip-path',`url(#${clipId})`).attr('fill','white');
  // Sidebar always shows gif when available (focal person = active = portrait animates)
  const sbImgSrc = person.gif ? person.gif : person.image ? person.image : `${ageGroup(person)}_${person.g.toLowerCase()}.png`;
  sbSvg.append('image').attr('href',runtimeAssetUrl(sbImgSrc)).attr('x',cx-pr).attr('y',cy-pr).attr('width',pr*2).attr('height',pr*2).attr('clip-path',`url(#${clipId})`).attr('preserveAspectRatio','xMidYMid slice');
  const videoSrc = personVideoSrc(person);
  if (videoSrc) {
    const video = makeVideo(videoSrc, 'sb-photo-video');
    document.getElementById('sb-photo-wrap').appendChild(video);
  }
  sbSvg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',pr).attr('fill','none').attr('stroke',rim).attr('stroke-width',2.5);

  // ── Full name + flags ──────────────────────────────────────────────────────
  const displayName = person.fullName || `${person.fn} ${person.ln}`;
  const flags = getFlags(person.nat);
  document.getElementById('sb-fullname').textContent = flags ? `${displayName}  ${flags}` : displayName;

  // ── Dates + age ────────────────────────────────────────────────────────────
  // All person-provided fields are run through esc() because lines[] is joined
  // and assigned to innerHTML. Without esc, a death place like "<img onerror=...>"
  // would execute. formatDate() returns formatted strings derived from person.b/d
  // which are likewise untrusted.
  const now = new Date().getFullYear();
  const lines = [];
  if (person.b) {
    let bl = `${esc(t('born'))} ${esc(formatDate(person.b))}`;
    if (person.bp) bl += `  ·  ${esc(person.bp)}`;
    lines.push(bl);
  }
  if (person.d) {
    let dl = `${esc(t('died'))} ${esc(formatDate(person.d))}`;
    if (person.dp) dl += `  ·  ${esc(person.dp)}`;
    lines.push(dl);
  }
  let ageBadge = '';
  if (person.b) {
    const by = birthYear(person.b), dy = person.d ? birthYear(person.d) : now;
    if (by && dy) {
      const yrs = dy - by;
      ageBadge = person.d
        ? `<span class="sb-age">${esc(t('lived'))} ${yrs} ${esc(t('years'))}</span>`
        : `<span class="sb-age">${esc(t('age'))} ${yrs} ${esc(t('years'))}</span>`;
    }
  }
  document.getElementById('sb-info').innerHTML = lines.join('<br>') + (ageBadge ? '<br>' + ageBadge : '');

  // ── Biography ──────────────────────────────────────────────────────────────
  document.getElementById('sb-bio-title').textContent = t('biography');
  const bioEl = document.getElementById('sb-bio-text');
  // bio can be a multilingual object {pl,en,es,fr} or a plain string (legacy)
  const bioText = person.bio
    ? (typeof person.bio === 'object' ? (person.bio[lang] || person.bio.pl || '') : person.bio)
    : '';
  if (bioText) {
    bioEl.textContent = bioText;
    bioEl.style.color = '#3a2810';
    bioEl.style.fontStyle = 'normal';
  } else {
    bioEl.textContent = t('bioPlaceholder');
    bioEl.style.color = '#b8a888';
    bioEl.style.fontStyle = 'italic';
  }

  // ── Galeria wspomnień ──────────────────────────────────────────────────────
  renderGallery(person);

  // Inject edit button + add person buttons
  injectSidebarActions(personId);
}

// ─── GALERIA WSPOMNIEŃ (IndexedDB) ────────────────────────────────────────────
// Zdjęcia/wideo trzymamy w IndexedDB (window.EliadoraStorage) — nie w
// localStorage, nie w danych osoby. Dlaczego:
//   1. IndexedDB trzyma natywne Bloby — bez Base64 i bez 33% narzutu.
//   2. Limit ~50% miejsca na dysku, nie 5 MB.
//   3. Zdjęcia są trwałe — działają po reloadzie, działają offline.
//   4. Dane osoby (eliadora-data.js, localStorage) zostają lekkie.
//
// Klucz: (family, personId) — drzewo Góreckich i Twoje DIY nie mieszają się.
// `family` to nazwa rodu (activeFamilyName), `personId` to id osoby.
//
// Eksport HTML (exportDiyAsStandaloneHTML) wciąga wszystkie wpisy z IDB
// dla aktualnej rodziny i osadza je jako data: URL w wynikowym pliku.
// Import odwrotnie: czyta osadzone URLe i wrzuca z powrotem do IDB.

// Pamięć w sesji: cache "ostatnio załadowane wpisy" + wygenerowane blob URL-e
// (żeby revoke'ować przed re-renderem i nie wyciekać RAM-u).
const _galleryCache = {
  personId: null,
  entries: [],   // [{id, blob, type, caption, ...}]
  blobURLs: []   // do revoke'owania
};

function _revokeGalleryURLs() {
  for (const u of _galleryCache.blobURLs) {
    try { URL.revokeObjectURL(u); } catch(e) {}
  }
  _galleryCache.blobURLs = [];
}

// Limit rozmiaru pliku — kontroluje quotę i też prędkość eksportu HTML.
// IndexedDB wytrzyma większe, ale eksport HTML z 50 MB filmu byłby tragiczny.
const GALLERY_MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

async function renderGallery(person) {
  const grid  = document.getElementById('sb-gallery-grid');
  const wrap  = document.getElementById('sb-gallery');
  const empty = document.getElementById('sb-gallery-empty');
  if (!grid || !wrap || !person) return;

  _revokeGalleryURLs();
  grid.innerHTML = '';
  wrap.classList.add('editable');

  // Sprawdź obsługę IndexedDB
  if (!window.EliadoraStorage) {
    empty.style.display = 'block';
    empty.textContent = 'Galeria niedostępna (brak modułu eliadora-storage.js).';
    return;
  }

  let entries = [];
  try {
    entries = await window.EliadoraStorage.getItems(person.id, activeFamilyName || 'default');
  } catch (e) {
    console.warn('[Eliadora] Galeria — błąd odczytu IDB:', e);
    empty.style.display = 'block';
    empty.textContent = 'Nie udało się wczytać galerii: ' + (e.message || e);
    return;
  }

  _galleryCache.personId = person.id;
  _galleryCache.entries  = entries;

  wrap.classList.toggle('has-items', entries.length > 0);
  empty.style.display = entries.length === 0 ? 'block' : 'none';
  if (entries.length === 0) {
    empty.textContent = 'Brak wspomnień. Kliknij „+ Dodaj zdjęcie".';
  }

  // Sortuj od najnowszych
  entries.sort((a, b) => (b.added || 0) - (a.added || 0));

  entries.forEach(entry => {
    const isVideo = entry.type === 'video';
    const blobURL = window.EliadoraStorage.getBlobURL(entry);
    _galleryCache.blobURLs.push(blobURL);

    const tile = document.createElement('div');
    tile.className = 'sb-gallery-item';
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-label', entry.caption || (isVideo ? 'Wideo' : 'Zdjęcie'));
    tile.dataset.entryId = String(entry.id);

    if (isVideo) {
      const v = document.createElement('video');
      v.src = blobURL;
      v.muted = true;
      v.playsInline = true;
      v.preload = 'metadata';
      tile.appendChild(v);
      const badge = document.createElement('span');
      badge.className = 'sb-gallery-badge';
      badge.textContent = '▶';
      tile.appendChild(badge);
    } else {
      const img = document.createElement('img');
      img.src = blobURL;
      img.alt = entry.caption || '';
      img.loading = 'lazy';
      tile.appendChild(img);
    }

    // Podpis (edytowalny)
    const cap = document.createElement('input');
    cap.type = 'text';
    cap.className = 'sb-gallery-caption-input';
    cap.value = entry.caption || '';
    cap.placeholder = 'Podpis...';
    cap.addEventListener('click', e => e.stopPropagation());
    cap.addEventListener('keydown', e => e.stopPropagation());
    cap.addEventListener('change', async () => {
      try {
        await window.EliadoraStorage.updateCaption(entry.id, cap.value);
        entry.caption = cap.value;
      } catch(e) { console.warn('[Eliadora] update caption err:', e); }
    });
    tile.appendChild(cap);

    // Usuń
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'sb-gallery-del';
    del.setAttribute('aria-label', 'Usuń to wspomnienie');
    del.textContent = '✕';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Usunąć ten element z galerii?')) return;
      try {
        await window.EliadoraStorage.deleteItem(entry.id);
        const p = PMAP[currentFocusId];
        if (p) renderGallery(p);
      } catch(err) {
        alert('Błąd usuwania: ' + (err.message || err));
      }
    });
    tile.appendChild(del);

    // Lightbox (przekazujemy blobURL — jest aktywny dopóki tile istnieje)
    const openIt = () => openLightbox(blobURL, entry.caption || '', isVideo ? 'video' : 'image');
    tile.addEventListener('click', openIt);
    tile.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openIt(); }
    });

    grid.appendChild(tile);
  });
}

function handleGalleryAddClick() {
  const input = document.getElementById('sb-gallery-file');
  if (input) input.click();
}

async function handleGalleryFileChange(inputEl) {
  const person = PMAP[currentFocusId];
  if (!person) return;
  if (!window.EliadoraStorage) {
    alert('Moduł galerii niedostępny.');
    return;
  }

  const files = Array.from(inputEl.files || []);
  if (files.length === 0) return;

  let added = 0;
  let skipped = 0;
  const family = activeFamilyName || 'default';

  for (const file of files) {
    if (file.size > GALLERY_MAX_FILE_BYTES) {
      skipped++;
      continue;
    }
    try {
      await window.EliadoraStorage.addItem({
        personId: person.id,
        family,
        blob: file,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        caption: ''
      });
      added++;
    } catch (e) {
      console.warn('[Eliadora] add gallery item err:', e);
      skipped++;
    }
  }

  inputEl.value = '';
  if (added > 0) renderGallery(person);
  if (skipped > 0) {
    alert(`Pominięto ${skipped} ${skipped===1?'plik (większy':'plików (każdy większy'} niż ${Math.round(GALLERY_MAX_FILE_BYTES/1024/1024)} MB lub błąd zapisu).`);
  }
}

function initGalleryHandlers() {
  const addBtn = document.getElementById('sb-gallery-add');
  const fileInput = document.getElementById('sb-gallery-file');
  if (addBtn && !addBtn.dataset.bound) {
    addBtn.dataset.bound = '1';
    addBtn.addEventListener('click', handleGalleryAddClick);
  }
  if (fileInput && !fileInput.dataset.bound) {
    fileInput.dataset.bound = '1';
    fileInput.addEventListener('change', () => handleGalleryFileChange(fileInput));
  }
}

// ─── TRYB OPOWIEŚCI ───────────────────────────────────────────────────────────
// Kamera przejeżdża przez drzewo chronologicznie (od najstarszych przodków
// do najmłodszych potomków), zatrzymuje się na każdej osobie ~6 sekund
// pokazując imię, daty i biografię. Sterowanie: poprzednia/następna/pauza/wyjście.
const STORY_DELAY_MS = 6500; // domyślny czas na osobę
let storyState = {
  active: false,
  paused: false,
  order: [],
  index: 0,
  timer: null,
  startedAt: 0
};

function startStoryMode() {
  // Buduj kolejność: osoby posortowane wg roku urodzenia, brakujące daty na końcu
  const valid = PEOPLE.filter(p => p && p.id);
  if (valid.length === 0) {
    alert('Drzewo jest puste — nie ma czego opowiedzieć.');
    return;
  }
  const sorted = [...valid].sort((a, b) => {
    const ya = a.b ? parseInt(String(a.b).split('-')[0], 10) : NaN;
    const yb = b.b ? parseInt(String(b.b).split('-')[0], 10) : NaN;
    const va = !isNaN(ya), vb = !isNaN(yb);
    if (va && vb) return ya - yb;
    if (va) return -1;
    if (vb) return 1;
    // bez dat — alfabetycznie po nazwisku
    return (a.ln || '').localeCompare(b.ln || '', 'pl');
  });

  storyState = {
    active: true,
    paused: false,
    order: sorted.map(p => p.id),
    index: 0,
    timer: null,
    startedAt: 0
  };
  document.body.classList.add('story-mode');
  const overlay = document.getElementById('story-overlay');
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');

  bindStoryControlsOnce();
  showStoryStep(0);
}

function bindStoryControlsOnce() {
  const root = document.getElementById('story-overlay');
  if (!root || root.dataset.bound) return;
  root.dataset.bound = '1';
  document.getElementById('story-prev').addEventListener('click', () => stepStory(-1));
  document.getElementById('story-next').addEventListener('click', () => stepStory(1));
  document.getElementById('story-pause').addEventListener('click', toggleStoryPause);
  document.getElementById('story-exit').addEventListener('click', exitStoryMode);
  document.addEventListener('keydown', (e) => {
    if (!storyState.active) return;
    if (e.key === 'Escape') { e.preventDefault(); exitStoryMode(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepStory(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepStory(1); }
    else if (e.key === ' ') { e.preventDefault(); toggleStoryPause(); }
  });
}

function showStoryStep(idx) {
  clearTimeout(storyState.timer);
  storyState.timer = null;
  if (!storyState.active) return;

  if (idx < 0) idx = 0;
  if (idx >= storyState.order.length) {
    // Koniec opowieści — pokazujemy finałową kartę i zostawiamy do zamknięcia
    finishStory();
    return;
  }
  storyState.index = idx;
  const personId = storyState.order[idx];
  const person = PMAP[personId];
  if (!person) {
    // pomijamy nieistniejącą
    showStoryStep(idx + 1);
    return;
  }

  // Aktualizuj kartę
  const displayName = person.fullName || `${person.fn} ${person.ln}`;
  document.getElementById('story-name').textContent = displayName;
  const dates = [];
  if (person.b) dates.push(`${t('born')} ${formatDate(person.b)}`);
  if (person.d) dates.push(`${t('died')} ${formatDate(person.d)}`);
  if (person.bp) dates.push(person.bp);
  document.getElementById('story-dates').textContent = dates.join(' · ');

  const bioText = person.bio
    ? (typeof person.bio === 'object' ? (person.bio[lang] || person.bio.pl || '') : person.bio)
    : '';
  document.getElementById('story-bio').textContent = bioText;

  document.getElementById('story-counter').textContent =
    `${idx + 1} / ${storyState.order.length}`;
  document.getElementById('story-progress-bar').style.width = `${((idx + 1) / storyState.order.length) * 100}%`;

  // Wyłącz strzałki na krańcach
  document.getElementById('story-prev').disabled = (idx === 0);
  // 'next' nigdy nie disabled — może być końcowy przeskok do finałowej karty

  // Przemieść kamerę
  transitionTo(personId, true);

  // Planuj kolejny krok jeśli nie pauza
  if (!storyState.paused) {
    storyState.startedAt = Date.now();
    storyState.timer = setTimeout(() => stepStory(1), STORY_DELAY_MS);
  }
}

function stepStory(delta) {
  if (!storyState.active) return;
  showStoryStep(storyState.index + delta);
}

function toggleStoryPause() {
  if (!storyState.active) return;
  storyState.paused = !storyState.paused;
  const btn = document.getElementById('story-pause');
  if (storyState.paused) {
    clearTimeout(storyState.timer);
    storyState.timer = null;
    btn.textContent = '▶ Wznów';
    btn.classList.add('paused');
  } else {
    btn.textContent = '⏸ Pauza';
    btn.classList.remove('paused');
    // Wznów odliczanie od nowa
    storyState.timer = setTimeout(() => stepStory(1), STORY_DELAY_MS);
  }
}

function finishStory() {
  // Finałowa karta
  document.getElementById('story-name').textContent = 'Koniec opowieści';
  document.getElementById('story-dates').textContent = '';
  document.getElementById('story-bio').textContent =
    `Poznałeś/aś ${storyState.order.length} osób z tej rodziny. Kliknij „✕ Zakończ", aby wrócić do drzewa, albo „‹ Poprzednia", aby odtworzyć ponownie od końca.`;
  document.getElementById('story-counter').textContent = `${storyState.order.length} / ${storyState.order.length}`;
  document.getElementById('story-progress-bar').style.width = '100%';
  storyState.index = storyState.order.length; // pozwala "Poprzednia" cofnąć
  // brak setTimeout — czeka na akcję
}

function exitStoryMode() {
  clearTimeout(storyState.timer);
  storyState = { active: false, paused: false, order: [], index: 0, timer: null, startedAt: 0 };
  document.body.classList.remove('story-mode');
  const overlay = document.getElementById('story-overlay');
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

// ─── LIGHTBOX ─────────────────────────────────────────────────────────────────
function openLightbox(src, caption, type) {
  const isVideo = type === 'video' || isVideoSrc(src);
  const img = document.getElementById('lb-img');
  const video = document.getElementById('lb-video');
  img.style.display = isVideo ? 'none' : 'block';
  video.style.display = isVideo ? 'block' : 'none';
  if (isVideo) {
    img.removeAttribute('src');
    video.src = src;
    video.play().catch(()=>{});
  } else {
    video.pause();
    video.removeAttribute('src');
    img.src = src;
  }
  document.getElementById('lb-caption').textContent = caption || '';
  const lb = document.getElementById('lightbox');
  lb.style.display = 'flex';
}
function closeLightbox() {
  const video = document.getElementById('lb-video');
  video.pause();
  video.removeAttribute('src');
  document.getElementById('lightbox').style.display = 'none';
}
document.getElementById('lb-overlay').addEventListener('click', closeLightbox);
document.getElementById('lb-close').addEventListener('click', closeLightbox);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeLightbox();
    closeHelpTutorial();
  }
});

// ─── HELP TUTORIAL ───────────────────────────────────────────────────────────
let helpStepIndex = 0;
const HELP_STEP_COUNT = 8;

function openHelpTutorial(step = 0) {
  const overlay = document.getElementById('help-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  showHelpStep(step);
}
function closeHelpTutorial() {
  const overlay = document.getElementById('help-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}
function showHelpStep(step) {
  helpStepIndex = Math.max(0, Math.min(HELP_STEP_COUNT - 1, Number(step) || 0));
  document.querySelectorAll('.help-step').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.helpStep) === helpStepIndex);
  });
  document.querySelectorAll('.help-step-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.helpStep) === helpStepIndex);
  });
}
function moveHelpStep(delta) {
  showHelpStep(helpStepIndex + delta);
}
function toggleHelpCheck(btn) {
  btn.classList.toggle('done');
}
function selectHelpAvatar(btn, src) {
  document.querySelectorAll('.avatar-choice').forEach(b => b.classList.toggle('active', b === btn));
  const img = document.getElementById('help-avatar-preview');
  const path = document.getElementById('help-avatar-path');
  if (img) img.src = runtimeAssetUrl(src);
  if (path) path.textContent = src;
}
function ensureHelpPracticeFocus() {
  const fid = currentFocusId || DEFAULT_FOCUS() || PEOPLE[0]?.id;
  if (!fid || !PMAP[fid]) return null;
  if (currentFocusId !== fid && !transitioning) transitionTo(fid, false);
  sidebarHidden = false;
  openSidebarFor(fid);
  return fid;
}
function startHelpEditPractice() {
  const fid = ensureHelpPracticeFocus();
  if (!fid) return;
  closeHelpTutorial();
  openEditForm(PMAP[fid] ? {...PMAP[fid]} : null, null);
}
function startHelpAddPractice(type) {
  const fid = ensureHelpPracticeFocus();
  if (!fid) return;
  closeHelpTutorial();
  startAddPerson(type, fid);
}
function startHelpPracticeTree() {
  enterLearningTree(false);
}

// ─── LANGUAGE SWITCHER ────────────────────────────────────────────────────────
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang;
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('app-subtitle').textContent = t('subtitle');
    document.getElementById('family-label').textContent = t('family');
    updateCoverText();
    // Language change doesn't affect layout — only label text. Reuse lastLayout
    // instead of rebuilding the hourglass (was burning a full recompute every
    // language switch even though positions are identical).
    if (lastLayout) updateLabels(lastLayout);
    // Re-render sidebar content in new language (if open)
    if (sidebarEl.classList.contains('open') && currentFocusId) {
      updateSidebar(currentFocusId);
    }
    setTimeout(setAppChromeMetrics, 20);
  });
});

// ─── EDITOR MODULE ────────────────────────────────────────────────────────────

// ── Link to existing person (instead of creating new) ────────────────────────
// Used when the person being connected (parent/child/spouse) already exists in the tree.
// ── Parent slot helper ────────────────────────────────────────────────────────
// Assigns a parent to the correct slot by gender, ignoring stale/invalid IDs.
// Returns 'ok' on success, 'filled' if the gender slot is already occupied by a valid person.
function applyParentLink(childPerson, parentId, parentGender) {
  // Start from only the VALID existing parents (those still in PMAP)
  const validP = (childPerson.p || []).filter(id => id && PMAP[id]);
  const hasValidMale   = validP.some(id => PMAP[id].g === 'M');
  const hasValidFemale = validP.some(id => PMAP[id].g === 'F');

  if (parentGender === 'M' && hasValidMale)   return 'filled';
  if (parentGender === 'F' && hasValidFemale) return 'filled';

  // Build new p[]: father first (index 0), mother second (index 1)
  const father = parentGender === 'M' ? parentId : (validP.find(id => PMAP[id].g === 'M') || null);
  const mother = parentGender === 'F' ? parentId : (validP.find(id => PMAP[id].g === 'F') || null);

  if (father && mother) childPerson.p = [father, mother];
  else if (father)      childPerson.p = [father];
  else if (mother)      childPerson.p = [mother];
  else                  childPerson.p = [parentId];

  return 'ok';
}

function validParentIds(person) {
  return (person?.p || []).filter(id => id && PMAP[id]);
}

function isSiblingType(type) {
  return type === 'brother' || type === 'sister';
}

// ── Circular ancestry check ───────────────────────────────────────────────────
// Returns true if 'ancestorId' is already an ancestor of 'personId'.
// Prevents wiring A as parent of B when A is already B's descendant.
function isAncestor(ancestorId, personId, visited = new Set()) {
  if (ancestorId === personId) return true;
  if (visited.has(personId)) return false;
  visited.add(personId);
  const p = PMAP[personId];
  if (!p || !p.p) return false;
  return p.p.some(pid => pid && isAncestor(ancestorId, pid, visited));
}

// ── Duplicate detection ───────────────────────────────────────────────────────
// Returns any existing person matching fn + ln + birth year (case-insensitive).
// Excludes the person being edited (originalId) to allow saving without change.
function findDuplicate(fn, ln, bRaw, excludeId) {
  const fnL = fn.toLowerCase(), lnL = ln.toLowerCase();
  const byear = bRaw ? String(bRaw).split('-')[0] : null;
  return PEOPLE.find(p => {
    if (p.id === excludeId) return false;
    if (p.fn.toLowerCase() !== fnL || p.ln.toLowerCase() !== lnL) return false;
    if (!byear) return true; // name match alone is enough to warn
    const pByear = p.b ? String(p.b).split('-')[0] : null;
    return !pByear || pByear === byear;
  }) || null;
}

// ── Age sanity check ─────────────────────────────────────────────────────────
// Returns a warning string if dates are suspicious, or null if all fine.
// Checks: death before birth, parent born after child.
function ageSanityWarning(person, parentIds) {
  const warnings = [];
  const by = person.b ? parseInt(String(person.b).split('-')[0], 10) : null;
  const dy = person.d ? parseInt(String(person.d).split('-')[0], 10) : null;
  if (by && dy && dy < by) warnings.push(`Rok śmierci (${dy}) wcześniej niż rok urodzenia (${by}). / Death year (${dy}) before birth year (${by}).`);
  (parentIds || []).forEach(pid => {
    const par = PMAP[pid]; if (!par) return;
    const pby = par.b ? parseInt(String(par.b).split('-')[0], 10) : null;
    if (by && pby && pby >= by) warnings.push(`${par.fn} ${par.ln} urodzony/a ${pby} — później niż dziecko (${by}). / ${par.fn} ${par.ln} born ${pby}, same year or after child (${by}).`);
  });
  return warnings.length ? warnings.join('\n') : null;
}

function linkExistingPerson() {
  const selectedId = document.getElementById('ef-link-select')?.value;
  if (!selectedId) { showEditError('Wybierz osobę z listy / Select a person from the list.'); return; }
  const spec = editorConnectionSpec;
  if (!spec) return;

  const anchor   = PMAP[spec.anchorId];   // the person we're adding FROM
  const existing = PMAP[selectedId];       // the person already in the tree
  if (!anchor || !existing) return;

  if (spec.type === 'parent') {
    if (isAncestor(spec.anchorId, selectedId)) {
      showEditError(`Błąd kołowy: ${existing.fn} ${existing.ln} jest już potomkiem tej osoby.\nCircular: ${existing.fn} ${existing.ln} is already a descendant.`);
      return;
    }
    const result = applyParentLink(anchor, selectedId, existing.g);
    if (result === 'filled') { showEditError('Rodzic tej płci już istnieje / Parent of this gender already linked.'); return; }

  } else if (spec.type === 'child') {
    if (isAncestor(selectedId, spec.anchorId)) {
      showEditError(`Błąd kołowy: ${anchor.fn} ${anchor.ln} jest już potomkiem tej osoby.\nCircular: ${anchor.fn} ${anchor.ln} is already a descendant.`);
      return;
    }
    const result = applyParentLink(existing, spec.anchorId, anchor.g);
    if (result === 'filled') { showEditError('Ta osoba już ma rodzica tej płci / Parent of this gender already linked.'); return; }

  } else if (spec.type === 'spouse') {
    if (selectedId === spec.anchorId) { showEditError('Osoba nie może być własnym małżonkiem. / A person cannot be their own spouse.'); return; }
    if (!anchor.s.includes(selectedId))      anchor.s   = [...anchor.s,   selectedId];
    if (!existing.s.includes(spec.anchorId)) existing.s = [...existing.s, spec.anchorId];

  } else if (isSiblingType(spec.type)) {
    const anchorParents = validParentIds(anchor);
    if (!anchorParents.length) {
      showEditError('Ta osoba nie ma jeszcze rodziców w drzewie. Dodaj najpierw przynajmniej jednego rodzica, a potem rodzeństwo.');
      return;
    }
    const existingParents = validParentIds(existing);
    const conflicts = existingParents.filter(id => !anchorParents.includes(id));
    if (conflicts.length && !confirm(`${existing.fn} ${existing.ln} ma już innych rodziców w drzewie.\nZastąpić ich rodzicami osoby ${anchor.fn} ${anchor.ln}?`)) return;
    existing.p = [...anchorParents];
  }

  rebuildPMAP();
  savePeople();
  editorActive = false;
  editorConnectionSpec = null;
  restoreSidebarView();
  const fid = currentFocusId;
  currentFocusId = null;
  sidebarReturnId = fid;
  transitionTo(fid, false);
  setTimeout(() => {
    sidebarReturnId = null;
    if (!sidebarHidden && fid) { updateSidebar(fid); sidebarEl.classList.add('open'); }
  }, 100);
}
// ── Reset to data file ─────────────────────────────────────────────────────────
function resetToDataFile() {
  if (learningMode) {
    resetLearningTree();
    return;
  }
  if (diyMode) {
    resetDiyTree();
    return;
  }
  if (!confirm('Przywrócić oryginalne dane z pliku?\nReset to original data file?\n\nWszystkie zmiany wprowadzone w przeglądarce zostaną utracone.\nAll browser edits will be lost.')) return;
  try { localStorage.removeItem('eliadora_people'); } catch(e) {}
  location.reload();
}

// ── Delete a person from the tree ─────────────────────────────────────────────
function deletePerson(personId) {
  const person = PMAP[personId];
  if (!person) return;

  // Protect the default focal person — deleting them breaks the whole tree
  if (personId === DEFAULT_FOCUS()) {
    alert(`Nie można usunąć ${person.fn} ${person.ln} — ta osoba jest główną osobą drzewa (defaultFocus w pliku danych).\n\nCannot delete ${person.fn} ${person.ln} — this person is the tree's default focus.`);
    return;
  }

  const name = `${person.fn} ${person.ln}`;
  // Count children who will lose a parent
  const childrenAffected = PEOPLE.filter(p => (p.p || []).includes(personId));
  const childWarn = childrenAffected.length
    ? `\n\n⚠ ${childrenAffected.length} osób straci rodzica / ${childrenAffected.length} person(s) will lose a parent:\n${childrenAffected.map(c => `  ${c.fn} ${c.ln}`).join('\n')}`
    : '';

  if (!confirm(`Usunąć ${name} z drzewa?\nDelete ${name} from the tree?${childWarn}\n\nTej operacji nie można cofnąć. / This cannot be undone.`)) return;

  PEOPLE.forEach(p => {
    if (p.p) p.p = p.p.filter(id => id !== personId);
    if (p.s) p.s = p.s.filter(id => id !== personId);
  });
  const idx = PEOPLE.findIndex(p => p.id === personId);
  if (idx !== -1) PEOPLE.splice(idx, 1);
  rebuildPMAP(); savePeople();
  const df = DEFAULT_FOCUS();
  const newFocal = PMAP[df] ? df : PEOPLE[0]?.id;
  if (newFocal) { currentFocusId = null; restoreSidebarView(); transitionTo(newFocal, false); }
}

// ── Unlink a relationship without deleting either person ──────────────────────
function unlinkRelationship(personId, otherId, type) {
  const person = PMAP[personId], other = PMAP[otherId];
  if (!person || !other) return;
  if (type === 'parent') {
    person.p = (person.p || []).filter(id => id !== otherId);
  } else if (type === 'spouse') {
    person.s = (person.s || []).filter(id => id !== otherId);
    other.s  = (other.s  || []).filter(id => id !== personId);
  }
  rebuildPMAP(); savePeople();
  restoreSidebarView();
  const fid = currentFocusId; currentFocusId = null;
  transitionTo(fid, false);
  setTimeout(() => { if (!sidebarHidden && fid) { updateSidebar(fid); sidebarEl.classList.add('open'); } }, 100);
}

// Build a persistence-safe copy of PEOPLE: keep compressed uploaded portraits,
// but strip data: URLs from video/GIF fields because they quickly exceed the
// localStorage quota. Users who want videos in their tree should put the file
// alongside the HTML and reference it by relative path (e.g. zapiski/portret.mp4).
function buildSavable(people) {
  return people.map(p => {
    const copy = {...p};
    // Stripuj wbudowane (Base64) zasoby z głównych pól — żeby nie pęknąć quotę.
    // Ścieżki względne (np. "p/jan.png") są zachowywane.
    for (const f of ['gif', 'video', 'mp4', 'portraitMP4']) {
      if (typeof copy[f] === 'string' && copy[f].startsWith('data:')) {
        delete copy[f];
      }
    }
    // Galeria: kopiuj jako tablicę, ale wyrzucaj data: URLe gdy są zbyt duże
    if (Array.isArray(p.gallery)) {
      copy.gallery = p.gallery
        .filter(g => g && typeof g.src === 'string')
        .map(g => ({...g}));
      // Próba zachowania wszystkiego — quota jest sprawdzana niżej w savePeople
    }
    return copy;
  });
}

function savePeople() {
  const savable = buildSavable(PEOPLE);
  try {
    localStorage.setItem(activeStorageKey, JSON.stringify(savable));
    // Meta — nazwa rodu i defaultFocus żeby przeżyły reload
    try {
      localStorage.setItem(activeStorageKey + '_meta', JSON.stringify({
        familyName: activeFamilyName || '',
        defaultFocus: activeDefaultFocus || ''
      }));
    } catch(e) {}
  } catch(e) {
    // Most common cause: QuotaExceededError when too many embedded portraits
    // (or just lots of bios in 4 languages × many people) overflow the quota.
    const msg = (e && e.name === 'QuotaExceededError')
      ? 'Pamięć przeglądarki została wypełniona. Zmiany NIE zostały zapisane.\n\nNajczęstsza przyczyna: zbyt dużo zdjęć zapisanych bezpośrednio w drzewie albo zbyt duże pliki wideo. Usuń kilka portretów, użyj mniejszych zdjęć albo wpisz ścieżki względne, np. zapiski/portret.jpg.\n\nMożesz też kliknąć "↓ JS" aby zapisać dane do pliku ręcznie.'
      : 'Nie udało się zapisać do pamięci przeglądarki: ' + (e && e.message ? e.message : 'nieznany błąd');
    alert(msg);
  }
  rebuildPersonSearch();
  updateOrphanBtn();
}

function exportDataFile() {
  const content = [
    '// eliadora-data.js — exported from Eliadora',
    '// For field documentation see the original file.',
    '',
    'window.ELIADORA_DATA = {',
    `  familyName:   ${JSON.stringify(FAMILY_NAME())},`,
    `  defaultFocus: ${JSON.stringify(DEFAULT_FOCUS())},`,
    '  people:',
    JSON.stringify(PEOPLE, null, 2).split('\n').map(l => '  ' + l).join('\n'),
    '};',
    '',
  ].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], {type:'text/javascript'})),
    download: 'eliadora-data.js',
  });
  a.click(); URL.revokeObjectURL(a.href);
}

// ── Editor state ─────────────────────────────────────────────────────────────
let editorActive = false;
let editorConnectionSpec = null; // { type: 'parent'|'child'|'spouse', anchorId }
let editorSelectedNat = [];
let editorActiveBioTab = 'pl';
let sidebarReturnId = null; // person to show in sidebar after cancel/save

const NAT_OPTIONS = [
  {code:'PL',flag:'🇵🇱',name:'Polska'},
  {code:'DE',flag:'🇩🇪',name:'Niemcy'},
  {code:'CZ',flag:'🇨🇿',name:'Czechy'},
  {code:'SK',flag:'🇸🇰',name:'Słowacja'},
  {code:'UA',flag:'🇺🇦',name:'Ukraina'},
  {code:'BY',flag:'🇧🇾',name:'Białoruś'},
  {code:'LT',flag:'🇱🇹',name:'Litwa'},
  {code:'RU',flag:'🇷🇺',name:'Rosja'},
];
const BIO_LANGS = ['pl','en','es','fr'];

// ── Inject edit + add buttons into view mode sidebar ─────────────────────────
function injectSidebarActions(personId) {
  const inner = document.getElementById('sb-inner');
  if (!inner) return;
  inner.querySelectorAll('.sb-edit-btn,.sb-add-section').forEach(el => el.remove());

  // Edit pencil button appended to name
  const nameEl = document.getElementById('sb-fullname');
  if (nameEl) {
    const btn = document.createElement('button');
    btn.className = 'sb-edit-btn';
    btn.title = t('edit');
    btn.textContent = '✏';
    btn.onclick = () => openEditForm(PMAP[personId] ? {...PMAP[personId]} : null, null);
    nameEl.appendChild(btn);
  }

  // Add person section — view mode only shows "add" options
  const person = PMAP[personId];
  const parentCount = person?.p?.filter(id => id && PMAP[id]).length || 0;
  const eid = escAttr(personId);
  const addSec = document.createElement('div');
  addSec.className = 'sb-add-section';
  addSec.innerHTML = `
    <div class="sb-form-section-title">${esc(t('addPerson'))}</div>
    <div class="sb-add-row">
      ${parentCount < 2 ? `<button class="sb-add-btn" onclick="startAddPerson('parent','${eid}')">${esc(t('addParent'))}</button>` : ''}
      <button class="sb-add-btn" onclick="startAddPerson('child','${eid}')">${esc(t('addChild'))}</button>
      <button class="sb-add-btn" onclick="startAddPerson('spouse','${eid}')">${esc(t('addSpouse'))}</button>
      <button class="sb-add-btn" onclick="startAddPerson('brother','${eid}')">${esc(t('addBrother'))}</button>
      <button class="sb-add-btn" onclick="startAddPerson('sister','${eid}')">${esc(t('addSister'))}</button>
    </div>`;
  inner.appendChild(addSec);
}

// ── Start "add new person via connection" flow ────────────────────────────────
function startAddPerson(type, anchorId) {
  editorConnectionSpec = { type, anchorId };
  const anchor = PMAP[anchorId];
  if (isSiblingType(type) && !validParentIds(anchor).length) {
    alert('Żeby dodać brata albo siostrę, ta osoba musi mieć w drzewie przynajmniej jednego rodzica. Dodaj najpierw rodzica, potem rodzeństwo.');
    return;
  }
  const defaultG = type === 'spouse' ? (anchor?.g === 'M' ? 'F' : 'M') : type === 'sister' ? 'F' : 'M';
  openEditForm({ fn:'', ln:'', b:'', d:null, g:defaultG, p:[], s:[], bio:{} }, { type, anchorId });
}

// ── Build and render the edit form in the sidebar ────────────────────────────
function openEditForm(person, connectionSpec) {
  editorActive = true;
  editorConnectionSpec = connectionSpec;
  editorSelectedNat = person.nat ? (Array.isArray(person.nat) ? [...person.nat] : [person.nat]) : [];
  editorActiveBioTab = lang;
  // Remember who the sidebar should return to after cancel/save
  sidebarReturnId = connectionSpec ? connectionSpec.anchorId : (person.id || currentFocusId);

  const inner = document.getElementById('sb-inner');
  const isNew = !person.id || !PMAP[person.id];
  const bio = person.bio || {};

  // Context label + "link existing" section (only for add-via-connection flows)
  let ctxHtml = '';
  if (connectionSpec) {
    const anchor = PMAP[connectionSpec.anchorId];
    const aName = anchor ? `${anchor.fn} ${anchor.ln}` : '?';
    const ctxKey = `addingAs${connectionSpec.type.charAt(0).toUpperCase()}${connectionSpec.type.slice(1)}`;
    // Build dropdown of all existing people (sorted by name), excluding the anchor itself
    const options = PEOPLE
      .filter(p => p.id !== connectionSpec.anchorId)
      .sort((a,b) => (a.fn+a.ln).localeCompare(b.fn+b.ln))
      .map(p => `<option value="${esc(p.id)}">${esc(p.fn)} ${esc(p.ln)}${p.b?' ('+String(p.b).slice(0,4)+')':''}</option>`)
      .join('');
    ctxHtml = `
      <div class="sb-context-label">${esc(t(ctxKey))} <strong>${esc(aName)}</strong></div>
      <div class="sb-form-section">
        <div class="sb-form-section-title">Połącz z istniejącą osobą / Link existing</div>
        <div style="display:flex;gap:7px;align-items:center">
          <select class="sb-input" id="ef-link-select" style="flex:1">
            <option value="">— wybierz / select —</option>
            ${options}
          </select>
          <button type="button" class="sb-add-btn" style="flex:0;white-space:nowrap;padding:6px 12px"
            onclick="linkExistingPerson()">Połącz →</button>
        </div>
        <div style="margin:10px 0;text-align:center;color:#b8a888;font-size:10px;letter-spacing:1px">— LUB UTWÓRZ NOWĄ / OR CREATE NEW —</div>
      </div>`;
  }

  inner.innerHTML = `
    <div class="sb-form-header">
      <button class="sb-form-back" onclick="cancelEdit()" title="${esc(t('cancel'))}">&#8592;</button>
      <span class="sb-form-title">${isNew ? esc(t('newPerson')) : `${esc(t('editing'))}: ${esc(person.fn||'')} ${esc(person.ln||'')}`}</span>
    </div>
    ${ctxHtml}

    <div class="sb-form-section">
      <div class="sb-form-section-title">${esc(t('nameSection'))}</div>
      <div class="sb-field">
        <label class="sb-label">${esc(t('firstName'))} <span style="color:#b8a888">(${esc(t('onCard'))})</span></label>
        <input class="sb-input" id="ef-fn" value="${esc(person.fn||'')}">
      </div>
      <div class="sb-field">
        <label class="sb-label">${esc(t('lastName'))} <span style="color:#b8a888">(${esc(t('onCard'))})</span></label>
        <input class="sb-input" id="ef-ln" value="${esc(person.ln||'')}">
      </div>
      <div class="sb-field">
        <label class="sb-label">${esc(t('fullNameField'))}</label>
        <input class="sb-input" id="ef-fullName" value="${esc(person.fullName||'')}" placeholder="${esc(t('fullNamePlaceholder'))}">
      </div>
    </div>

    <div class="sb-form-section">
      <div class="sb-form-section-title">${esc(t('genderSection'))}</div>
      <div class="sb-gender-row">
        <label class="sb-radio-label"><input type="radio" name="ef-g" value="M" ${person.g==='M'?'checked':''}> ${esc(t('male'))}</label>
        <label class="sb-radio-label"><input type="radio" name="ef-g" value="F" ${person.g==='F'?'checked':''}> ${esc(t('female'))}</label>
      </div>
    </div>

    <div class="sb-form-section">
      <div class="sb-form-section-title">${esc(t('datesSection'))}</div>
      <div class="sb-field">
        <label class="sb-label">${esc(t('born'))} <span style="color:#b8a888;font-size:9px">YYYY · YYYY-MM · YYYY-MM-DD</span></label>
        <input class="sb-input" id="ef-b" value="${esc(String(person.b||''))}" placeholder="1982-04-15">
      </div>
      <div class="sb-field">
        <label class="sb-label">${esc(t('birthPlace'))}</label>
        <input class="sb-input" id="ef-bp" value="${esc(person.bp||'')}" placeholder="Warszawa, Polska">
      </div>
      <div class="sb-field">
        <label class="sb-label">${esc(t('died'))} <span style="color:#b8a888;font-size:9px">${esc(t('leaveEmpty'))}</span></label>
        <input class="sb-input" id="ef-d" value="${esc(String(person.d||''))}">
      </div>
      <div class="sb-field">
        <label class="sb-label">${esc(t('deathPlace'))}</label>
        <input class="sb-input" id="ef-dp" value="${esc(person.dp||'')}">
      </div>
    </div>

    <div class="sb-form-section">
      <div class="sb-form-section-title">${esc(t('nationalitySection'))}</div>
      <div class="sb-nat-row" id="ef-nat-row">
        ${NAT_OPTIONS.map(n=>`<button class="sb-nat-btn${editorSelectedNat.includes(n.code)?' active':''}" data-code="${esc(n.code)}" onclick="toggleEditorNat('${escAttr(n.code)}')" type="button" title="${escAttr(n.name)}" aria-label="${escAttr(n.name)}">${n.flag} ${esc(n.name)}</button>`).join('')}
      </div>
    </div>

    <div class="sb-form-section">
      <div class="sb-form-section-title">${esc(t('mediaSection'))}</div>
      <div class="sb-field">
        <label class="sb-label">${esc(t('imageField'))} <span style="color:#b8a888;font-size:9px">wgraj albo wpisz ścieżkę</span></label>
        <input class="sb-input" id="ef-image" value="${esc(imageInputDisplayValue(person.image||''))}" placeholder="${esc(imageInputPlaceholder(person.image||''))}" oninput="clearEmbeddedImage('ef-image')">
        <input type="hidden" id="ef-image-data" value="${esc(isEmbeddedImage(person.image||'') ? person.image : '')}">
        <div class="media-path-tools" aria-label="Folder zdjęcia">
          <button class="media-path-btn" type="button" onclick="document.getElementById('ef-image-upload')?.click()">wgraj bezpośrednio</button>
          <button class="media-path-btn" type="button" onclick="setImageFolderPrefix('p/')">p/ portrety</button>
          <button class="media-path-btn" type="button" onclick="setImageFolderPrefix('')">folder główny</button>
          <button class="media-path-btn" type="button" onclick="setImageFolderPrefix('assets/')">assets/</button>
          <button class="media-path-btn" type="button" onclick="setImageFolderPrefix('zapiski/')">zapiski/</button>
        </div>
        <input class="sb-input" id="ef-image-upload" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" onchange="loadImageFile(this,'ef-image')" style="margin-top:6px;padding:5px">
        <div class="sb-helper" id="ef-image-status">${isEmbeddedImage(person.image||'') ? 'To zdjęcie jest zapisane bezpośrednio w drzewie.' : 'Możesz wgrać zdjęcie bezpośrednio do drzewa. Alternatywnie wpisz ścieżkę, np. zapiski/portret.jpg albo p/ola.png.'}</div>
      </div>
      <div class="sb-field">
        <label class="sb-label">${esc(t('gifField'))} <span style="color:#b8a888;font-size:9px">gif_name.gif</span></label>
        <input class="sb-input" id="ef-gif" value="${esc(person.gif||'')}">
      </div>
      <div class="sb-field">
        <label class="sb-label">${esc(t('videoField'))} <span style="color:#b8a888;font-size:9px">media/portret.mp4</span></label>
        <input class="sb-input" id="ef-video" value="${esc(person.video||person.mp4||'')}">
        <input class="sb-input" type="file" accept=".mp4,.webm,.mov,.m4v,video/mp4,video/webm,video/quicktime" onchange="loadVideoFile(this,'ef-video')" style="margin-top:6px;padding:5px">
        <div class="sb-helper" id="ef-video-status">Możesz wskazać MP4 z dysku albo wpisać ścieżkę, np. media/portret.mp4.</div>
      </div>
    </div>

    <div class="sb-form-section">
      <div class="sb-form-section-title">${esc(t('biography'))}</div>
      <div class="sb-bio-tabs">
        ${BIO_LANGS.map(l=>`<button class="sb-bio-tab${editorActiveBioTab===l?' active':''}" onclick="switchEditorBioTab('${escAttr(l)}')" type="button">${esc(l.toUpperCase())}</button>`).join('')}
      </div>
      ${BIO_LANGS.map(l=>`<textarea class="sb-textarea sb-bio-lang" id="ef-bio-${esc(l)}" style="display:${editorActiveBioTab===l?'block':'none'};border-radius:0 4px 4px 4px" placeholder="${esc(t('bioPlaceholder'))}">${esc(bio[l]||'')}</textarea>`).join('')}
    </div>

    <div id="ef-error" style="display:none" class="sb-error"></div>

    <div class="sb-form-actions">
      <button class="sb-btn-save" onclick="submitEdit('${escAttr(person.id||'')}')">${esc(isNew ? t('addToTree') : t('saveChanges'))}</button>
      <button class="sb-btn-cancel" onclick="cancelEdit()">${esc(t('cancel'))}</button>
    </div>
    <p class="sb-storage-note">${esc(t('localStorageNote'))}</p>

    ${!isNew ? `
    <div class="sb-form-section" style="margin-top:8px">
      <div class="sb-form-section-title" style="color:#a03020">Zmień połączenie / Change</div>
      <div class="sb-add-row" style="margin-bottom:8px">
        ${(person.p||[]).filter(id=>id&&PMAP[id]).map(pid=>{
          const par=PMAP[pid];
          return `<button class="sb-add-btn" style="background:#fdf0ee;border-color:#e0a090;color:#803020;font-size:10px" onclick="unlinkRelationship('${escAttr(person.id)}','${escAttr(pid)}','parent')">✕ ${esc(par.fn)} ${esc(par.ln)}</button>`;
        }).join('')}
        ${(person.s||[]).filter(id=>id&&PMAP[id]).map(sid=>{
          const sp=PMAP[sid];
          return `<button class="sb-add-btn" style="background:#fdf0ee;border-color:#e0a090;color:#803020;font-size:10px" onclick="unlinkRelationship('${escAttr(person.id)}','${escAttr(sid)}','spouse')">✕ ♥ ${esc(sp.fn)} ${esc(sp.ln)}</button>`;
        }).join('')}
      </div>
      ${person.id !== DEFAULT_FOCUS() ? `
      <div class="sb-form-section-title" style="color:#a03020;margin-top:10px">Usuń osobę / Delete</div>
      <div class="sb-add-row">
        <button class="sb-add-btn" style="background:#fdf0ee;border-color:#c03020;color:#803020" onclick="deletePerson('${escAttr(person.id)}')">🗑 ${esc(person.fn)} ${esc(person.ln)}</button>
      </div>` : ''}
    </div>` : ''}
  `;
}

// ── Form helpers ─────────────────────────────────────────────────────────────
// esc() and escAttr() are defined earlier (near top of script).

function toggleEditorNat(code) {
  const i = editorSelectedNat.indexOf(code);
  if (i === -1) editorSelectedNat.push(code); else editorSelectedNat.splice(i,1);
  document.querySelectorAll('#ef-nat-row .sb-nat-btn').forEach(b => b.classList.toggle('active', editorSelectedNat.includes(b.dataset.code)));
}

function switchEditorBioTab(l) {
  editorActiveBioTab = l;
  document.querySelectorAll('.sb-bio-lang').forEach(ta => { ta.style.display = ta.id===`ef-bio-${l}`?'block':'none'; });
  document.querySelectorAll('.sb-bio-tab').forEach(b => b.classList.toggle('active', b.textContent.trim().toLowerCase()===l));
}

// ── Sidebar skeleton ─────────────────────────────────────────────────────────
// openEditForm replaces sb-inner entirely. We need to restore the skeleton
// before updateSidebar can work again.
const SIDEBAR_SKELETON = `
  <div id="sb-photo-wrap">
    <svg id="sb-photo-svg" width="144" height="144" viewBox="0 0 144 144"></svg>
  </div>
  <h2 id="sb-fullname"></h2>
  <div id="sb-info"></div>
  <div class="sb-section">
    <div class="sb-section-title" id="sb-bio-title"></div>
    <p id="sb-bio-text"></p>
  </div>
`;
function restoreSidebarView() {
  document.getElementById('sb-inner').innerHTML = SIDEBAR_SKELETON;
}

function cancelEdit() {
  editorActive = false;
  editorConnectionSpec = null;
  const returnId = sidebarReturnId || currentFocusId;
  sidebarReturnId = null;
  restoreSidebarView();
  if (returnId && PMAP[returnId]) {
    updateSidebar(returnId);
    if (!sidebarHidden) sidebarEl.classList.add('open');
  }
}

function showEditError(msg) {
  const el = document.getElementById('ef-error');
  if (el) { el.style.display='block'; el.textContent=msg; }
}

// ── Submit edit / add ─────────────────────────────────────────────────────────
function submitEdit(originalId) {
  const fn = document.getElementById('ef-fn')?.value.trim();
  const ln = document.getElementById('ef-ln')?.value.trim();
  const g  = document.querySelector('input[name="ef-g"]:checked')?.value;

  if (!fn) { showEditError(t('errFirstName')); return; }
  if (!ln) { showEditError(t('errLastName'));  return; }
  if (!g)  { showEditError(t('errGender'));    return; }

  const bRaw = document.getElementById('ef-b')?.value.trim() || '';
  const dRaw = document.getElementById('ef-d')?.value.trim() || '';

  // ── Duplicate detection ───────────────────────────────────────────────────
  const isNew = !originalId || !PMAP[originalId];
  if (isNew) {
    const dup = findDuplicate(fn, ln, bRaw, originalId);
    if (dup) {
      const dupInfo = `${dup.fn} ${dup.ln}${dup.b ? ' ('+String(dup.b).split('-')[0]+')' : ''}`;
      if (!confirm(`Uwaga: osoba o tym imieniu już istnieje w drzewie:\n${dupInfo}\n\nWarning: a person with this name already exists:\n${dupInfo}\n\nKontynuować mimo to? / Continue anyway?`)) return;
    }
  }

  // ── Age sanity (warning only, user can proceed) ───────────────────────────
  // Determine which parent IDs the new/edited person will have after save.
  let pendingParentIds = [];
  if (isNew && editorConnectionSpec) {
    if (editorConnectionSpec.type === 'child') {
      // New person becomes a child of the anchor → anchor is their parent
      pendingParentIds = [editorConnectionSpec.anchorId];
    } else if (isSiblingType(editorConnectionSpec.type)) {
      pendingParentIds = validParentIds(PMAP[editorConnectionSpec.anchorId]);
    }
    // 'parent' and 'spouse' types don't add parents to the new person
  } else if (!isNew) {
    // Editing existing person — keep their current parents for the check
    pendingParentIds = [...(PMAP[originalId]?.p || [])];
  }
  const ageWarn = ageSanityWarning({b: bRaw, d: dRaw}, pendingParentIds);
  if (ageWarn && !confirm(`⚠ Ostrzeżenie o datach / Date warning:\n${ageWarn}\n\nZapisać mimo to? / Save anyway?`)) return;

  // Build multilingual bio (only store non-empty)
  const bio = {};
  BIO_LANGS.forEach(l => { const v = document.getElementById(`ef-bio-${l}`)?.value.trim(); if(v) bio[l]=v; });

  const nat = editorSelectedNat.length === 0 ? undefined
            : editorSelectedNat.length === 1 ? editorSelectedNat[0]
            : [...editorSelectedNat];

  const newId = isNew ? ('p' + Date.now().toString(36) + Math.random().toString(36).slice(2,4)) : originalId;
  const imageData = document.getElementById('ef-image-data')?.value.trim() || '';
  const imagePath = document.getElementById('ef-image')?.value.trim() || '';
  const imageValue = imageData || imagePath;

  // Build updated record (preserve relational fields from original)
  const orig = PMAP[originalId] || {};
  const updated = {
    id: newId, fn, ln, g,
    ...(document.getElementById('ef-fullName')?.value.trim() ? { fullName: document.getElementById('ef-fullName').value.trim() } : {}),
    ...(bRaw ? { b: bRaw } : {}),
    ...(dRaw ? { d: dRaw } : { d: null }),
    ...(document.getElementById('ef-bp')?.value.trim() ? { bp: document.getElementById('ef-bp').value.trim() } : {}),
    ...(document.getElementById('ef-dp')?.value.trim() ? { dp: document.getElementById('ef-dp').value.trim() } : {}),
    ...(nat !== undefined ? { nat } : {}),
    ...(imageValue ? { image: imageValue } : {}),
    ...(document.getElementById('ef-gif')?.value.trim()   ? { gif:   document.getElementById('ef-gif').value.trim()   } : {}),
    ...(document.getElementById('ef-video')?.value.trim() ? { video: document.getElementById('ef-video').value.trim() } : {}),
    ...(Object.keys(bio).length ? { bio } : {}),
    // Relational fields: preserve existing, will be updated below for new connections
    p: [...(orig.p || [])],
    s: [...(orig.s || [])],
  };

  if (isNew && editorConnectionSpec) {
    const spec = editorConnectionSpec;
    const anchor = PMAP[spec.anchorId];
    if (anchor) {
      if (spec.type === 'child') {
        // New person is a child of anchor — set anchor as the known parent
        updated.p = [spec.anchorId];

      } else if (spec.type === 'parent') {
        // New person becomes a parent of anchor using gender-based slot
        if (isAncestor(spec.anchorId, newId)) {
          showEditError('Błąd kołowy: ta osoba jest już potomkiem kotwicy.\nCircular ancestry detected.'); return;
        }
        const result = applyParentLink(anchor, newId, g);
        if (result === 'filled') { showEditError('Rodzic tej płci już istnieje / Parent of this gender already exists.'); return; }

      } else if (spec.type === 'spouse') {
        // New person becomes a spouse of anchor
        anchor.s = [...(anchor.s || []), newId];
        updated.s = [spec.anchorId];

      } else if (isSiblingType(spec.type)) {
        const anchorParents = validParentIds(anchor);
        if (!anchorParents.length) {
          showEditError('Ta osoba nie ma jeszcze rodziców w drzewie. Dodaj najpierw przynajmniej jednego rodzica, a potem rodzeństwo.');
          return;
        }
        updated.p = [...anchorParents];
      }
    }
  }

  if (isNew) {
    PEOPLE.push(updated);
  } else {
    const idx = PEOPLE.findIndex(p => p.id === originalId);
    if (idx !== -1) {
      // Preserve p[] and s[] from original (not editable in this form)
      PEOPLE[idx] = { ...updated, p: orig.p || [], s: orig.s || [] };
    }
  }

  rebuildPMAP();
  savePeople();
  editorActive = false;
  editorConnectionSpec = null;
  restoreSidebarView();

  // Force a full re-render. transitionTo() blocks if focusId hasn't changed,
  // so we reset currentFocusId to null to bypass that guard.
  const fid = currentFocusId;
  currentFocusId = null;
  sidebarReturnId = fid;
  transitionTo(fid, false);
  setTimeout(() => {
    sidebarReturnId = null;
    if (!sidebarHidden && fid) { updateSidebar(fid); sidebarEl.classList.add('open'); }
  }, 100);
}
// ─── ORPHAN DETECTION ─────────────────────────────────────────────────────────
function findOrphans() {
  const referenced = new Set();
  PEOPLE.forEach(p => {
    (p.p||[]).forEach(id => referenced.add(id));
    (p.s||[]).forEach(id => referenced.add(id));
  });
  return PEOPLE.filter(p =>
    !referenced.has(p.id) &&
    !(p.p||[]).some(id => PMAP[id]) &&
    !(p.s||[]).some(id => PMAP[id])
  );
}
function updateOrphanBtn() {
  const orphans = findOrphans();
  const btn = document.getElementById('orphan-btn');
  if (!btn) return;
  if (!orphans.length) { btn.style.display='none'; return; }
  btn.style.display = 'block';
  btn.textContent = `⚠ ${orphans.length} osób bez połączeń`;
}
function showOrphans() {
  const orphans = findOrphans();
  if (!orphans.length) return;
  const list = orphans.map((p,i)=>`${i+1}. ${p.fn} ${p.ln}${p.b?' ('+String(p.b).slice(0,4)+')':''}`).join('\n');
  if (confirm(`Osoby bez połączeń z drzewem:\n\n${list}\n\nKliknij OK aby przejść do pierwszej osoby.\nAby usunąć: otwórz ✏ edycję i użyj przycisku Usuń.`)) {
    transitionTo(orphans[0].id, true);
  }
}

// ─── BOOK COVER ───────────────────────────────────────────────────────────────
// Cover is shown only on first visit (tracked in localStorage). After it animates
// open, it stays hidden; user can re-summon it via the 📖 button in the header.
const COVER_SEEN_KEY = 'eliadora_cover_seen';

function updateCoverText() {
  const fn = FAMILY_NAME();
  const familyEl = document.querySelector('[data-family]');
  if (familyEl) familyEl.textContent = fn || '';
  const subEl = document.querySelector('[data-cover-subtitle]');
  if (subEl) subEl.textContent = t('coverSubtitle');
  const openEl = document.querySelector('[data-cover-open]');
  if (openEl) openEl.textContent = t('coverOpen');
}

function showCover() {
  // Manual cover — slide in (no localStorage write, doesn't change "seen" state)
  updateCoverText();
  const cv = document.getElementById('book-cover');
  cv.classList.remove('hidden','opening','fade-out');
  cv.setAttribute('aria-hidden','false');
}

function openBookCover() {
  // The opening animation: rotate the cover page, then fade the overlay
  const cv = document.getElementById('book-cover');
  const fid = currentFocusId || DEFAULT_FOCUS();
  cv.classList.add('opening');
  setTimeout(() => cv.classList.add('fade-out'), 700);
  setTimeout(() => {
    cv.classList.add('hidden');
    cv.setAttribute('aria-hidden','true');
    const revealAfterCover = () => {
      if (transitioning) { setTimeout(revealAfterCover, 120); return; }
      if (!fid || !PMAP[fid]) return;
      currentFocusId = null;
      transitionTo(fid, true);
    };
    revealAfterCover();
    // Persist that the cover has been seen (so it won't auto-show next time)
    try { localStorage.setItem(COVER_SEEN_KEY, '1'); } catch(e) {}
  }, 1600);
}

function maybeShowCoverOnLoad() {
  if (window.ELIADORA_STANDALONE_EXPORT) {
    if (standaloneExportState().showCover) showCover();
    return;
  }
  let seen = false;
  try { seen = localStorage.getItem(COVER_SEEN_KEY) === '1'; } catch(e) {}
  if (!seen) showCover();
}

// ─── EXPORT TO PDF / PRINT ────────────────────────────────────────────────────
// Strategy: serialise the live tree SVG → load into <img> via data URL →
// draw onto canvas at high resolution → embed as JPEG in jsPDF.
// This keeps Polish/UTF-8 text accurate (rendered as pixels) and avoids
// the limited font support of jsPDF's vector text.

function resolveAssetUrl(src) {
  try { return new URL(src, document.baseURI).href; }
  catch(e) { return src; }
}

async function srcToDataUrl(src) {
  if (!src || /^data:/i.test(src)) return src;
  const abs = resolveAssetUrl(src);
  if (/^file:/i.test(abs)) {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          c.getContext('2d').drawImage(img, 0, 0);
          res(c.toDataURL('image/png'));
        } catch(err) { rej(err); }
      };
      img.onerror = rej;
      img.src = abs;
    });
  }
  try {
    const resp = await fetch(abs);
    if (!resp.ok) throw new Error('image fetch failed');
    const blob = await resp.blob();
    return await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  } catch(e) {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          c.getContext('2d').drawImage(img, 0, 0);
          res(c.toDataURL('image/png'));
        } catch(err) { rej(err); }
      };
      img.onerror = rej;
      img.src = abs;
    });
  }
}

async function loadCanvasImage(src) {
  const dataUrl = await srcToDataUrl(src);
  return await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = dataUrl;
  });
}

function drawImageCover(ctx, img, w, h) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const ratio = Math.max(w / iw, h / ih);
  const dw = iw * ratio, dh = ih * ratio;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

async function paintPdfTreeBackground(ctx, w, h) {
  const theme = THEME_CONFIG[activeTheme] || THEME_CONFIG.nature;
  const styles = getComputedStyle(document.getElementById('tree-container'));
  ctx.fillStyle = styles.backgroundColor || theme.svgBg || '#efd9b0';
  ctx.fillRect(0, 0, w, h);
  try {
    const paper = await loadCanvasImage(theme.paper);
    drawImageCover(ctx, paper, w, h);
  } catch(e) {}
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(255,246,219,0.28)');
  grad.addColorStop(0.62, 'rgba(202,137,50,0.06)');
  grad.addColorStop(1, 'rgba(82,44,14,0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

async function svgToCanvas(svgEl, scale) {
  // Clone SVG so we can ensure width/height attributes and inline namespaces.
  const clone = svgEl.cloneNode(true);
  const w = parseInt(svgEl.getAttribute('width')) || svgEl.clientWidth || 800;
  const h = parseInt(svgEl.getAttribute('height')) || svgEl.clientHeight || 600;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);

  // External images (person photos) need to be inlined as data URLs, otherwise
  // they won't show up when we draw the SVG onto a canvas (CORS-tainted).
  const imgs = clone.querySelectorAll('image');
  await Promise.all(Array.from(imgs).map(async (im) => {
    const href = im.getAttribute('href') || im.getAttribute('xlink:href');
    if (!href || href.startsWith('data:')) return;
    try {
      const dataUrl = await srcToDataUrl(href);
      im.setAttribute('href', dataUrl);
      im.removeAttribute('xlink:href');
    } catch(e) {
      // Image couldn't be loaded — leave the placeholder face SVG to show instead
      im.removeAttribute('href');
    }
  }));

  const xml = new XMLSerializer().serializeToString(clone);
  const svg64 = btoa(unescape(encodeURIComponent(xml)));
  const url = 'data:image/svg+xml;base64,' + svg64;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  await paintPdfTreeBackground(ctx, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, w, h };
}

async function exportToPDF() {
  const btn = document.getElementById('pdf-btn');
  const oldLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '...';

  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF nie został załadowany. Sprawdź połączenie sieciowe.');
    }
    const { jsPDF } = window.jspdf;
    const svgEl = document.getElementById('tree-svg');

    // High-res rasterisation: 2× for crisp print at A4 size
    const { canvas, w, h } = await svgToCanvas(svgEl, 2);

    // Pick orientation by aspect ratio
    const landscape = w >= h;
    const pdf = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8; // mm
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;

    // Fit canvas into page while preserving aspect ratio
    const ratio = w / h;
    let drawW = availW;
    let drawH = drawW / ratio;
    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * ratio;
    }
    const offX = (pageW - drawW) / 2;
    const offY = (pageH - drawH) / 2;

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', offX, offY, drawW, drawH, undefined, 'FAST');

    // Filename: family name + focal person name, sanitised
    const focal = PMAP[currentFocusId];
    const fname = `${(FAMILY_NAME()||'rodzina').replace(/[^a-zA-Z0-9_-]/g,'_')}_${focal ? (focal.fn+'_'+focal.ln).replace(/[^a-zA-Z0-9_-]/g,'_') : 'drzewo'}.pdf`;
    pdf.save(fname);
  } catch(err) {
    console.error('PDF export failed:', err);
    alert('Eksport PDF nie powiódł się: ' + (err.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
}

function printTree() {
  // Native browser print — the @media print rules above handle the styling.
  document.body.classList.add('printing');
  window.print();
  // Remove the class after the print dialog (small delay to ensure it picked up)
  setTimeout(() => document.body.classList.remove('printing'), 1000);
}

// ─── DIY: EKSPORT JAKO SAMODZIELNY HTML ───────────────────────────────────────
// Bierze aktualny zestaw osób z trybu DIY i zapisuje pełny plik HTML
// (kopię tego dokumentu) z osadzonymi danymi drzewa. Otwarty bez serwera
// pokaże od razu Twoje drzewo — bez potrzeby trzymania osobnego eliadora-data.js.
//
// Jak to robimy:
//   1. Bierzemy outerHTML tego dokumentu (pełny <html>…</html>).
//   2. Usuwamy zewnętrzny <script src="eliadora-data.js"> bo dane wstawiamy inline.
//   3. Wstawiamy własny <script> z window.ELIADORA_DATA tuż przed </head>.
//   4. Czyścimy stan trybu DIY z URL/atrybutów, żeby otworzony plik startował normalnie.
//   5. Pobieramy jako "Eliadora-MojeDrzewo.html".
//
// Limit: portrety które są pełnymi data: URLami zostaną osadzone (mogą napuchnąć
// plik). Ścieżki względne jak "p/jan.png" zostaną — taki plik wymaga, żeby folder p/
// był obok niego, ale to jest wybór użytkownika.
// ─── EDYCJA NAZWY RODU ────────────────────────────────────────────────────────
// Pozwala zmienić "Rodzina Góreckich" na cokolwiek. Aktualizuje:
//   - activeFamilyName (źródło prawdy w runtime)
//   - element #family-name w nagłówku
//   - tekst okładki
//   - localStorage (żeby przeżyło reload — w DIY/learning store, w głównym pliku
//     nie zapisujemy, bo eliadora-data.js jest read-only z dysku; ale w runtime
//     i tak działa do końca sesji)
//   - galerię w IDB — przenosimy wpisy ze starej rodziny na nową
function openFamilyNameEditor() {
  const current = activeFamilyName || '';
  const newName = prompt(
    'Nowa nazwa rodu (np. „Kowalskich", „Nowaków"):\n\nObecnie: ' + (current || '— brak —'),
    current
  );
  if (newName === null) return; // anulowane
  const trimmed = newName.trim();
  if (!trimmed) {
    alert('Nazwa nie może być pusta.');
    return;
  }
  if (trimmed === current) return; // nic się nie zmieniło
  if (trimmed.length > 80) {
    alert('Nazwa za długa (max 80 znaków).');
    return;
  }

  applyFamilyNameChange(current, trimmed);
}

async function applyFamilyNameChange(oldName, newName) {
  // 1) Update runtime
  activeFamilyName = newName;

  // 2) Update header
  const fnEl = document.getElementById('family-name');
  if (fnEl) fnEl.textContent = newName;

  // 3) Update cover text (jeśli dostępna funkcja)
  if (typeof updateCoverText === 'function') {
    try { updateCoverText(); } catch(e) {}
  }

  // 4) Update danych: jeśli tryb DIY albo learning — zapisujemy do localStorage
  //    razem z nową nazwą. Tryb główny (eliadora-data.js): zmiana zostaje
  //    w runtime do reloadu, plik na dysku zostaje (intencjonalnie — żeby
  //    przypadkiem nie nadpisać czyichś danych przy zmianie nazwy).
  if (typeof activeStorageKey !== 'undefined' && activeStorageKey) {
    try {
      const payload = {
        familyName: newName,
        defaultFocus: typeof activeDefaultFocus !== 'undefined' ? activeDefaultFocus : (PEOPLE[0]?.id || ''),
        people: buildSavable(PEOPLE)
      };
      localStorage.setItem(activeStorageKey, JSON.stringify(payload));
    } catch(e) { console.warn('[Eliadora] saveTreeState err:', e); }
  }

  // 5) Galeria: jeśli były wpisy pod starą nazwą — przenosimy je
  if (window.EliadoraStorage && oldName && oldName !== newName) {
    try {
      const oldEntries = await window.EliadoraStorage.getAllForFamily(oldName);
      if (oldEntries.length > 0) {
        for (const entry of oldEntries) {
          await window.EliadoraStorage.addItem({
            personId: entry.personId,
            family: newName,
            blob: entry.blob,
            type: entry.type,
            caption: entry.caption || ''
          });
          await window.EliadoraStorage.deleteItem(entry.id);
        }
        console.log(`[Eliadora] Przeniesiono ${oldEntries.length} wpisów galerii: "${oldName}" → "${newName}"`);
      }
    } catch(e) { console.warn('[Eliadora] move gallery err:', e); }
  }

  // 6) Refresh sidebar gdyby był otwarty
  if (currentFocusId && PMAP[currentFocusId]) {
    const p = PMAP[currentFocusId];
    if (typeof renderGallery === 'function') renderGallery(p);
  }
}

async function exportDiyAsStandaloneHTML() {
  try {
    const familyForName = (activeFamilyName || 'MojeDrzewo').replace(/[^a-zA-Z0-9_\-]+/g, '_').slice(0, 40) || 'MojeDrzewo';
    const filename = `Eliadora-${familyForName}.html`;
    const exportFocusId = (currentFocusId && PMAP[currentFocusId]) ? currentFocusId
      : (activeDefaultFocus && PMAP[activeDefaultFocus]) ? activeDefaultFocus
      : DIY_FOCUS_ID;
    const coverEl = document.getElementById('book-cover');
    const exportState = {
      theme: activeTheme || 'nature',
      seniorMode: !!seniorMode,
      seniorScale: Math.round((seniorScale || 1.22) * 100),
      focusId: exportFocusId,
      showCover: !!(coverEl && !coverEl.classList.contains('hidden'))
    };
    const runtimeAssets = await buildRuntimeAssetMapForExport();

    // ── Galeria: ściągamy wszystkie wpisy IDB dla tej rodziny i konwertujemy
    //    Bloby na data: URL żeby osadzić w HTML.
    let galleryEntries = [];
    if (window.EliadoraStorage) {
      try {
        const raw = await window.EliadoraStorage.getAllForFamily(activeFamilyName || 'default');
        const serializeAll = await Promise.all(raw.map(async (e) => ({
          personId: e.personId,
          type:     e.type,
          caption:  e.caption || '',
          added:    e.added || Date.now(),
          dataURL:  await window.EliadoraStorage.blobToDataURL(e.blob)
        })));
        galleryEntries = serializeAll;
      } catch (e) {
        console.warn('[Eliadora] Eksport: błąd odczytu galerii z IDB', e);
      }
    }

    // Dane do osadzenia (drzewo + galeria)
    const exportedData = {
      familyName:   activeFamilyName || 'Moja rodzina',
      defaultFocus: exportFocusId,
      people:       await buildHtmlExportPeople(PEOPLE),
      gallery:      galleryEntries,
      exportedAt:   new Date().toISOString(),
      version:      'eliadora-export-v1'
    };
    const dataJSON = window.EliadoraPure && typeof window.EliadoraPure.safeJsonForHtmlScript === 'function'
      ? window.EliadoraPure.safeJsonForHtmlScript(exportedData)
      : JSON.stringify(exportedData)
          .replace(/</g, '\\u003C')
          .replace(/>/g, '\\u003E')
          .replace(/&/g, '\\u0026');
    const exportStateJSON = window.EliadoraPure && typeof window.EliadoraPure.safeJsonForHtmlScript === 'function'
      ? window.EliadoraPure.safeJsonForHtmlScript(exportState)
      : JSON.stringify(exportState)
          .replace(/</g, '\\u003C')
          .replace(/>/g, '\\u003E')
          .replace(/&/g, '\\u0026');
    const runtimeAssetsJSON = window.EliadoraPure && typeof window.EliadoraPure.safeJsonForHtmlScript === 'function'
      ? window.EliadoraPure.safeJsonForHtmlScript(runtimeAssets)
      : JSON.stringify(runtimeAssets)
          .replace(/</g, '\\u003C')
          .replace(/>/g, '\\u003E')
          .replace(/&/g, '\\u0026');

    // Klon dokumentu (bez stanu sesji)
    const doctype = '<!DOCTYPE html>\n';
    const root = document.documentElement.cloneNode(true);

    // 1) usuwamy zewnętrzny script z danymi i stare bloki portable
    root.querySelectorAll('script[src="eliadora-data.js"]').forEach(s => s.remove());
    root.querySelectorAll('#eliadora-portable-data,#eliadora-portable-loader,#eliadora-export-state,#eliadora-runtime-assets').forEach(s => s.remove());

    // 2) wstawiamy bezpieczny blok JSON + krótki loader przed kodem aplikacji
    const head = root.querySelector('head');
    if (head) {
      const dataScript = document.createElement('script');
      dataScript.id = 'eliadora-portable-data';
      dataScript.type = 'application/json';
      dataScript.textContent = dataJSON;

      const stateScript = document.createElement('script');
      stateScript.id = 'eliadora-export-state';
      stateScript.type = 'application/json';
      stateScript.textContent = exportStateJSON;

      const assetsScript = document.createElement('script');
      assetsScript.id = 'eliadora-runtime-assets';
      assetsScript.type = 'application/json';
      assetsScript.textContent = runtimeAssetsJSON;

      const loaderScript = document.createElement('script');
      loaderScript.id = 'eliadora-portable-loader';
      loaderScript.textContent = "window.ELIADORA_STANDALONE_EXPORT = true; window.ELIADORA_EXPORT_STATE = JSON.parse(document.getElementById('eliadora-export-state').textContent); window.ELIADORA_RUNTIME_ASSETS = JSON.parse(document.getElementById('eliadora-runtime-assets').textContent); window.ELIADORA_DATA = JSON.parse(document.getElementById('eliadora-portable-data').textContent);";
      head.append(dataScript, stateScript, assetsScript, loaderScript);
    }

    // 3) sprzątanie body
    const body = root.querySelector('body');
    if (body) {
      const ib = body.querySelector('#install-banner');
      if (ib) ib.remove();
      body.className = body.className.replace(/\b(diy-mode|learning-mode|senior-mode|cover-open|story-mode|theme-\w+)\b/g, '').trim();
      body.classList.add('diy-mode', 'theme-' + exportState.theme);
      if (exportState.seniorMode) body.classList.add('senior-mode');
      const sb = body.querySelector('#sidebar');
      if (sb) sb.classList.remove('open');
      const cover = body.querySelector('#book-cover');
      if (cover) {
        cover.classList.toggle('hidden', !exportState.showCover);
        cover.setAttribute('aria-hidden', exportState.showCover ? 'false' : 'true');
      }
    }

    // 4) Jeśli aplikacja działa przez lokalny serwer, osadzamy CSS/JS w pliku.
    //    Przy file:// przeglądarka może zablokować fetch lokalnych plików; wtedy
    //    używamy window.ELIADORA_EXPORT_SOURCES jako awaryjnego magazynu źródeł.
    await inlineExportStylesheets(root);
    await inlineExportScripts(root);
    await inlineExportDocumentAssets(root);
    await inlineExportInlineStyles(root);

    // 5) sklejamy i zapisujemy
    const fullHTML = doctype + root.outerHTML;
    const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
    alert(`Zapisano "${filename}" (${sizeMB} MB).\n\nW środku: ${PEOPLE.length} osób + ${galleryEntries.length} wpisów w galerii.\nPlik można otworzyć w przeglądarce lub przesłać — wszystko zapisane razem.`);
  } catch (err) {
    console.error('[Eliadora] Eksport HTML nieudany:', err);
    alert('Nie udało się wyeksportować pliku HTML: ' + (err && err.message || err));
  }
}

// ─── DIY: IMPORT Z SAMODZIELNEGO HTML ─────────────────────────────────────────
// Czyta wybrany plik HTML (taki jaki wypluł exportDiyAsStandaloneHTML), wyciąga
// z niego window.ELIADORA_DATA i wczytuje:
//   - drzewo → tryb DIY (zastępuje obecne)
//   - galerię → IndexedDB (dodaje do obecnej, lub zastępuje za potwierdzeniem)
// Wspiera też proste pliki .js / .json bez galerii (eksport "↓ JS").
function cloneImportedPerson(person) {
  const copy = {...person};
  if (Array.isArray(person.p)) copy.p = [...person.p];
  if (Array.isArray(person.s)) copy.s = [...person.s];
  if (Array.isArray(person.nat)) copy.nat = [...person.nat];
  if (person.bio && typeof person.bio === 'object') copy.bio = {...person.bio};
  if (Array.isArray(person.gallery)) copy.gallery = person.gallery.map(item => ({...item}));
  return copy;
}

function uniqueImportedId(people, preferred) {
  const taken = new Set((people || []).map(p => p && p.id).filter(Boolean));
  let candidate = preferred;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${preferred}_${n++}`;
  }
  return candidate;
}

function prepareStandaloneImportForDiy(data) {
  const people = (Array.isArray(data.people) ? data.people : []).map(cloneImportedPerson);
  if (!people.length) throw new Error('Import nie zawiera żadnych osób.');
  normalizePeople(people);

  const sourceFocus = people.some(p => p.id === data.defaultFocus)
    ? data.defaultFocus
    : people[0].id;
  const idMap = new Map();

  if (sourceFocus !== DIY_FOCUS_ID) {
    if (people.some(p => p.id === DIY_FOCUS_ID && p.id !== sourceFocus)) {
      idMap.set(DIY_FOCUS_ID, uniqueImportedId(people, DIY_FOCUS_ID + '_imported'));
    }
    idMap.set(sourceFocus, DIY_FOCUS_ID);
  }

  if (idMap.size) {
    for (const person of people) {
      if (idMap.has(person.id)) person.id = idMap.get(person.id);
    }
    for (const person of people) {
      person.p = (person.p || []).map(id => idMap.get(id) || id);
      person.s = (person.s || []).map(id => idMap.get(id) || id);
    }
  }

  const gallery = Array.isArray(data.gallery)
    ? data.gallery.map(item => item ? ({...item, personId: idMap.get(item.personId) || item.personId}) : item)
    : [];

  return {
    familyName: data.familyName || 'Zrób to sam',
    defaultFocus: DIY_FOCUS_ID,
    people,
    gallery
  };
}

function importDiyFromStandaloneHTML(inputEl) {
  const file = inputEl && inputEl.files && inputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => {
    alert('Nie udało się przeczytać pliku.');
    inputEl.value = '';
  };
  reader.onload = async () => {
    try {
      const text = String(reader.result || '');
      const parsed = extractEliadoraDataFromText(text);
      if (!parsed || !Array.isArray(parsed.people) || parsed.people.length === 0) {
        alert('W pliku nie znaleziono prawidłowych danych Eliadory.\n\nUpewnij się, że plik został wyeksportowany przyciskiem "📦 Eksport HTML" lub "↓ JS".');
        return;
      }
      const prepared = prepareStandaloneImportForDiy(parsed);
      const peopleArr = prepared.people;
      const gallerySize = prepared.gallery.length;
      const confirmMsg = `Wczytać drzewo "${prepared.familyName || 'bez nazwy'}"?
  • osób: ${peopleArr.length}
  • zdjęć/wideo w galerii: ${gallerySize}

Obecne drzewo "Zrób to sam" i jego galeria zostaną zastąpione.`;
      if (!confirm(confirmMsg)) return;

      // Drzewo
      try {
        localStorage.removeItem(DIY_STORAGE_KEY + '_meta');
        localStorage.setItem(DIY_STORAGE_KEY, JSON.stringify(buildSavable(peopleArr)));
        localStorage.setItem(DIY_STORAGE_KEY + '_meta', JSON.stringify({
          familyName: prepared.familyName,
          defaultFocus: prepared.defaultFocus
        }));
      } catch(e) {
        console.warn('[Eliadora] Import: zapis drzewa do localStorage nieudany', e);
      }
      activateRuntimeTree({
        people: peopleArr,
        familyName: prepared.familyName,
        defaultFocus: prepared.defaultFocus,
        storageKey: DIY_STORAGE_KEY,
        isLearning: false,
        isDiy: true
      });

      // Galeria — wczytaj do IDB pod activeFamilyName
      if (window.EliadoraStorage && gallerySize > 0) {
        const family = activeFamilyName || prepared.familyName || 'default';
        try { await window.EliadoraStorage.clearFamily(family); } catch(e) {}
        let restored = 0;
        for (const item of prepared.gallery) {
          if (!item || !item.dataURL) continue;
          const blob = window.EliadoraStorage.dataURLToBlob(item.dataURL);
          if (!blob) continue;
          try {
            await window.EliadoraStorage.addItem({
              personId: item.personId,
              family,
              blob,
              type: item.type === 'video' ? 'video' : 'image',
              caption: item.caption || ''
            });
            restored++;
          } catch (e) {
            console.warn('[Eliadora] Import: pominąłem wpis galerii', e);
          }
        }
        console.log(`[Eliadora] Galeria: zaimportowano ${restored}/${gallerySize} wpisów`);
      }

      openSidebarFor(DIY_FOCUS_ID);
      alert(`Drzewo zaimportowane: ${peopleArr.length} osób, ${gallerySize} wpisów galerii.`);
    } catch (err) {
      console.error('[Eliadora] Import nieudany:', err);
      alert('Błąd podczas importu: ' + (err && err.message || err));
    } finally {
      inputEl.value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
}

// Próbuje wyciągnąć window.ELIADORA_DATA = {...} z tekstu pliku.
// Działa zarówno dla pełnych plików HTML jak i dla wyeksportowanego eliadora-data.js.
// Wykorzystuje znalezienie nawiasów klamrowych po znaku '=' i parsowanie JSON-em
// z drobnymi tolerancjami (trailing comma).
function extractEliadoraDataFromText(text) {
  if (window.EliadoraPure && typeof window.EliadoraPure.extractEliadoraDataFromText === 'function') {
    return window.EliadoraPure.extractEliadoraDataFromText(text);
  }
  // Szukamy dosłownie "ELIADORA_DATA" i pierwszego '=' po nim, potem zbalansowanego {...}
  const marker = 'ELIADORA_DATA';
  const idx = text.indexOf(marker);
  if (idx < 0) return null;
  let i = text.indexOf('=', idx);
  if (i < 0) return null;
  // pomiń spacje
  while (i < text.length && /\s/.test(text[i+1])) i++;
  // pierwszy '{'
  let start = text.indexOf('{', i);
  if (start < 0) return null;
  // znajdź zbalansowane zamknięcie (ignorując nawiasy w stringach)
  let depth = 0, inStr = false, strCh = '', esc2 = false, end = -1;
  for (let k = start; k < text.length; k++) {
    const ch = text[k];
    if (inStr) {
      if (esc2) { esc2 = false; continue; }
      if (ch === '\\') { esc2 = true; continue; }
      if (ch === strCh) { inStr = false; continue; }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = k; break; } }
  }
  if (end < 0) return null;
  let raw = text.slice(start, end + 1);
  // usuń trailing commas typu ", }" lub ", ]"
  raw = raw.replace(/,(\s*[}\]])/g, '$1');
  // próba JSON.parse
  try {
    return JSON.parse(raw);
  } catch(e) {
    // ostatnia szansa: Function eval (kontrolowany kontekst — wczytujemy tylko obiekt)
    try {
      // eslint-disable-next-line no-new-func
      return (new Function('return (' + raw + ');'))();
    } catch(e2) {
      console.error('[Eliadora] Parsing ELIADORA_DATA nieudany:', e, e2);
      return null;
    }
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function blobToDataURLForExport(blob) {
  if (window.EliadoraStorage && typeof window.EliadoraStorage.blobToDataURL === 'function') {
    return window.EliadoraStorage.blobToDataURL(blob);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Nie udało się osadzić zasobu.'));
    reader.readAsDataURL(blob);
  });
}

function isLocalExportUrl(url) {
  return !!url && !/^(data:|blob:|https?:|mailto:|tel:|#)/i.test(String(url).trim());
}

function getBundledExportSource(url) {
  const sources = window.ELIADORA_EXPORT_SOURCES || {};
  const raw = String(url || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (Object.prototype.hasOwnProperty.call(sources, raw)) return sources[raw];

  let resolved = raw;
  try { resolved = new URL(raw, location.href).href.replace(/\\/g, '/'); } catch(e) {}
  try { resolved = decodeURIComponent(resolved); } catch(e) {}

  for (const key of Object.keys(sources)) {
    const cleanKey = String(key).replace(/\\/g, '/');
    if (raw.endsWith(cleanKey) || resolved.endsWith('/' + cleanKey) || resolved.endsWith(cleanKey)) {
      return sources[key];
    }
  }
  return '';
}

async function fetchLocalAssetAsDataURL(url) {
  const bundled = getBundledExportSource(url);
  if (bundled && /^data:/i.test(bundled)) return bundled;

  const resolved = new URL(url, location.href).href;
  const response = await fetch(resolved, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Nie udało się pobrać zasobu: ${url}`);
  return blobToDataURLForExport(await response.blob());
}

async function fetchLocalTextForExport(url) {
  const bundled = getBundledExportSource(url);
  if (bundled && !/^data:/i.test(bundled)) return bundled;

  const response = await fetch(new URL(url, location.href).href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function inlineCssUrlsForExport(cssText, baseHref) {
  const matches = [...cssText.matchAll(/url\((['"]?)([^'")]+)\1\)/g)];
  let result = cssText;
  for (const match of matches) {
    const rawUrl = (match[2] || '').trim();
    if (!isLocalExportUrl(rawUrl)) continue;
    try {
      const dataUrl = await fetchLocalAssetAsDataURL(new URL(rawUrl, baseHref || location.href).href);
      result = result.split(match[0]).join(`url("${dataUrl}")`);
    } catch(e) {
      console.warn('[Eliadora] Eksport: zostawiam zewnętrzny zasób CSS', rawUrl, e);
    }
  }
  return result;
}

async function inlineExportStylesheets(root) {
  const links = [...root.querySelectorAll('link[rel="stylesheet"][href]')];
  for (const link of links) {
    const href = link.getAttribute('href');
    if (!isLocalExportUrl(href)) continue;
    try {
      const resolved = new URL(href, location.href).href;
      const style = document.createElement('style');
      style.textContent = await inlineCssUrlsForExport(await fetchLocalTextForExport(resolved), resolved);
      link.replaceWith(style);
    } catch(e) {
      console.warn('[Eliadora] Eksport: nie udało się osadzić CSS', href, e);
    }
  }
}

async function inlineExportScripts(root) {
  const scripts = [...root.querySelectorAll('script[src]')];
  for (const script of scripts) {
    const src = script.getAttribute('src');
    if (/eliadora-export-sources\.js(?:[?#].*)?$/i.test(src || '')) {
      script.remove();
      continue;
    }
    if (!isLocalExportUrl(src)) continue;
    try {
      const inline = document.createElement('script');
      inline.textContent = await fetchLocalTextForExport(src);
      script.replaceWith(inline);
    } catch(e) {
      console.warn('[Eliadora] Eksport: nie udało się osadzić JS', src, e);
    }
  }
}

async function inlineExportDocumentAssets(root) {
  const srcTargets = [
    ...root.querySelectorAll('img[src]'),
    ...root.querySelectorAll('audio[src]'),
    ...root.querySelectorAll('video[src]')
  ];
  for (const el of srcTargets) {
    const src = el.getAttribute('src');
    if (!isLocalExportUrl(src)) continue;
    try { el.setAttribute('src', await fetchLocalAssetAsDataURL(src)); }
    catch(e) { console.warn('[Eliadora] Eksport: nie udało się osadzić zasobu', src, e); }
  }

  const hrefTargets = [...root.querySelectorAll('link[rel~="icon"][href],link[rel="apple-touch-icon"][href]')];
  for (const el of hrefTargets) {
    const href = el.getAttribute('href');
    if (!isLocalExportUrl(href)) continue;
    try { el.setAttribute('href', await fetchLocalAssetAsDataURL(href)); }
    catch(e) { console.warn('[Eliadora] Eksport: nie udało się osadzić ikony', href, e); }
  }

  const manifest = root.querySelector('link[rel="manifest"][href]');
  if (manifest) {
    const href = manifest.getAttribute('href');
    if (isLocalExportUrl(href)) {
      try {
        const text = await fetchLocalTextForExport(href);
        manifest.setAttribute('href', 'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(text));
      } catch(e) {
        manifest.remove();
      }
    }
  }
}

async function inlineExportInlineStyles(root) {
  const styled = [...root.querySelectorAll('[style]')];
  for (const el of styled) {
    const style = el.getAttribute('style');
    if (!style || !/url\(/i.test(style)) continue;
    try { el.setAttribute('style', await inlineCssUrlsForExport(style, location.href)); }
    catch(e) {}
  }
}

async function buildRuntimeAssetMapForExport() {
  const keys = new Set([
    ...Object.values(THEME_CONFIG).map(config => config.paper),
    'adult_f.png',
    'adult_m.png',
    'child_f.png',
    'child_m.png',
    'elder_f.png',
    'elder_m.png'
  ]);
  const result = {};
  for (const key of keys) {
    try { result[key] = await fetchLocalAssetAsDataURL(key); }
    catch(e) { console.warn('[Eliadora] Eksport: nie udało się osadzić zasobu runtime', key, e); }
  }
  return result;
}

async function buildHtmlExportPeople(people) {
  const result = (Array.isArray(people) ? people : []).map(p => {
    const clone = {...p};
    if (Array.isArray(p.p)) clone.p = [...p.p];
    if (Array.isArray(p.s)) clone.s = [...p.s];
    if (Array.isArray(p.nat)) clone.nat = [...p.nat];
    if (p.bio && typeof p.bio === 'object') clone.bio = {...p.bio};
    if (Array.isArray(p.gallery)) clone.gallery = p.gallery.map(g => ({...g}));
    return clone;
  });
  await Promise.all(result.map(async (person) => {
    const fallbackImage = `${ageGroup(person)}_${String(person.g || 'F').toLowerCase()}.png`;
    const imageFields = ['image', 'gif'];
    for (const field of imageFields) {
      const currentImage = field === 'image' ? (person.image || fallbackImage) : person[field];
      if (isLocalExportUrl(currentImage)) {
        try { person[field] = await fetchLocalAssetAsDataURL(currentImage); }
        catch(e) { person[field] = currentImage; }
      }
    }
  }));
  return result;
}

initThemeSwitcher();
initSeniorMode();
initBackgroundMusic();
initGalleryHandlers();
setAppChromeMetrics();
if (window.ELIADORA_STANDALONE_EXPORT) {
  activeStorageKey = DIY_STORAGE_KEY;
  activeDefaultFocus = DEFAULT_FOCUS();
  learningMode = false;
  diyMode = true;
  document.body.classList.add('diy-mode');
  configureModeBanner('diy');
}
window.addEventListener('resize', handleWindowResize);
rebuildPersonSearch();
updateNavControls();
initDragPan();
document.getElementById('family-name').textContent = FAMILY_NAME();
updateCoverText();
maybeShowCoverOnLoad();

transitionTo(DEFAULT_FOCUS(), true);
setTimeout(() => { setAppChromeMetrics(); centerCurrent(); updateOrphanBtn(); }, 120);
maybeImportDiyBuilderPayload();

// ─── PWA: REJESTRACJA SERVICE WORKERA ─────────────────────────────────────────
// Pozwala otworzyć aplikację offline po pierwszym załadowaniu i zainstalować
// ją jak appkę ("Dodaj do ekranu głównego"). Działa tylko przez http(s)://,
// pod file:// service workery są zablokowane przez przeglądarkę.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('[Eliadora] Service worker registration failed:', err);
    });
  });
}

// ─── PWA: PRZYCISK "ZAINSTALUJ" ───────────────────────────────────────────────
// Chrome/Edge emitują 'beforeinstallprompt' gdy aplikacja spełnia kryteria
// PWA. Łapiemy event, pokazujemy mały banner z propozycją instalacji.
// Safari iOS nie wspiera tego eventu — tam trzeba użyć Share → Add to Home Screen ręcznie.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});
function showInstallBanner() {
  if (document.getElementById('install-banner')) return;
  if (localStorage.getItem('eliadora_install_dismissed') === '1') return;
  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.innerHTML = `
    <span>📲 Zainstaluj Eliadorę jako aplikację — szybciej, działa offline.</span>
    <button id="install-banner-yes" type="button">Zainstaluj</button>
    <button id="install-banner-no" type="button" aria-label="Zamknij">✕</button>
  `;
  document.body.appendChild(banner);
  document.getElementById('install-banner-yes').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch(e) {}
    deferredInstallPrompt = null;
    banner.remove();
  });
  document.getElementById('install-banner-no').addEventListener('click', () => {
    localStorage.setItem('eliadora_install_dismissed', '1');
    banner.remove();
  });
}
window.addEventListener('appinstalled', () => {
  const b = document.getElementById('install-banner');
  if (b) b.remove();
  deferredInstallPrompt = null;
});
