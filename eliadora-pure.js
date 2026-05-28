// eliadora-pure.js — czyste funkcje (bez efektów ubocznych)
// Wszystko tutaj jest deterministyczne: bierze argumenty, zwraca wynik.
// Brak odwołań do document/window/localStorage/globalnych zmiennych.
// Dzięki temu można to importować w Vitest i testować bez przeglądarki.
//
// W przeglądarce ten plik ładuje się jako zwykły <script> i wystawia
// funkcje na window.EliadoraPure. eliadora.js korzysta z nich przez
// cienkie wrappery, które przekazują aktualne PMAP/PEOPLE.

(function(root) {
  'use strict';

  // ── ESCAPE HELPERS ─────────────────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function escAttr(s) {
    return String(s)
      .replace(/\\/g, '\\\\')
      .replace(/'/g,  '\\\'')
      .replace(/\r?\n/g, '\\n')
      .replace(/&/g,  '&amp;')
      .replace(/"/g,  '&quot;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;');
  }

  // ── PEOPLE NORMALIZATION ───────────────────────────────────────────────────
  // Modyfikuje array in place — gwarantuje że każda osoba ma p[] i s[].
  // Zwraca true jeśli cokolwiek było do naprawienia.
  function normalizePeople(people) {
    if (!Array.isArray(people)) return false;
    let changed = false;
    people.forEach(p => {
      if (!Array.isArray(p.p)) { p.p = []; changed = true; }
      if (!Array.isArray(p.s)) { p.s = []; changed = true; }
    });
    return changed;
  }

  // ── ANCESTRY CHECK ─────────────────────────────────────────────────────────
  // Czy `ancestorId` jest już przodkiem `personId` w danej mapie osób?
  // pmap: { id -> osoba } — zwykle obiekt zbudowany z PEOPLE.
  function isAncestor(ancestorId, personId, pmap, visited) {
    visited = visited || new Set();
    if (ancestorId === personId) return true;
    if (visited.has(personId)) return false;
    visited.add(personId);
    const p = pmap && pmap[personId];
    if (!p || !p.p) return false;
    return p.p.some(pid => pid && isAncestor(ancestorId, pid, pmap, visited));
  }

  // ── PARENT LINK ────────────────────────────────────────────────────────────
  // Przypisuje rodzica do slota wg płci. Zwraca 'ok' lub 'filled'.
  // pmap potrzebny żeby odrzucić nieistniejące ID i znaleźć aktualnych rodziców.
  function applyParentLink(childPerson, parentId, parentGender, pmap) {
    if (!childPerson) return 'filled';
    const validP = (childPerson.p || []).filter(id => id && pmap && pmap[id]);
    const hasValidMale   = validP.some(id => pmap[id].g === 'M');
    const hasValidFemale = validP.some(id => pmap[id].g === 'F');

    if (parentGender === 'M' && hasValidMale)   return 'filled';
    if (parentGender === 'F' && hasValidFemale) return 'filled';

    const father = parentGender === 'M' ? parentId : (validP.find(id => pmap[id].g === 'M') || null);
    const mother = parentGender === 'F' ? parentId : (validP.find(id => pmap[id].g === 'F') || null);

    if (father && mother) childPerson.p = [father, mother];
    else if (father)      childPerson.p = [father];
    else if (mother)      childPerson.p = [mother];
    else                  childPerson.p = [parentId];

    return 'ok';
  }

  // ── DUPLICATE FINDER ───────────────────────────────────────────────────────
  // Szuka osoby o tym samym imieniu/nazwisku (i opcjonalnie roku urodzenia).
  // people: pełna lista, excludeId: pomiń tę osobę (przy edycji).
  function findDuplicate(fn, ln, bRaw, excludeId, people) {
    if (!Array.isArray(people)) return null;
    if (typeof fn !== 'string' || typeof ln !== 'string') return null;
    const fnL = fn.toLowerCase(), lnL = ln.toLowerCase();
    const byear = bRaw ? String(bRaw).split('-')[0] : null;
    return people.find(p => {
      if (p.id === excludeId) return false;
      if (!p.fn || !p.ln) return false;
      if (p.fn.toLowerCase() !== fnL || p.ln.toLowerCase() !== lnL) return false;
      if (!byear) return true;
      const pByear = p.b ? String(p.b).split('-')[0] : null;
      return !pByear || pByear === byear;
    }) || null;
  }

  // ── AGE SANITY ─────────────────────────────────────────────────────────────
  // Zwraca string z ostrzeżeniem (po PL + EN) lub null.
  function ageSanityWarning(person, parentIds, pmap) {
    if (!person) return null;
    const warnings = [];
    const by = person.b ? parseInt(String(person.b).split('-')[0], 10) : null;
    const dy = person.d ? parseInt(String(person.d).split('-')[0], 10) : null;
    if (by && dy && dy < by) {
      warnings.push(`Rok śmierci (${dy}) wcześniej niż rok urodzenia (${by}). / Death year (${dy}) before birth year (${by}).`);
    }
    (parentIds || []).forEach(pid => {
      const par = pmap && pmap[pid];
      if (!par) return;
      const pby = par.b ? parseInt(String(par.b).split('-')[0], 10) : null;
      if (by && pby && pby >= by) {
        warnings.push(`${par.fn} ${par.ln} urodzony/a ${pby} — później niż dziecko (${by}). / ${par.fn} ${par.ln} born ${pby}, same year or after child (${by}).`);
      }
    });
    return warnings.length ? warnings.join('\n') : null;
  }

  // ── EXTRACT ELIADORA_DATA FROM TEXT ────────────────────────────────────────
  // Wyciąga dane z eksportu portable HTML albo ze starego window.ELIADORA_DATA.
  // Toleruje trailing commas. Zwraca obiekt {familyName, defaultFocus, people} lub null.
  const PORTABLE_DATA_SCRIPT_IDS = [
    'eliadora-portable-data',
    'eliadora-export-data'
  ];

  function safeJsonForHtmlScript(value) {
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    return String(json)
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  function decodeHtmlEntities(text) {
    return String(text || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  function parseDataObject(raw) {
    if (typeof raw !== 'string') return null;
    let text = decodeHtmlEntities(raw).trim();
    if (!text) return null;
    text = text.replace(/^\uFEFF/, '').replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(text);
    } catch(e) {
      try {
        // eslint-disable-next-line no-new-func
        return (new Function('return (' + text + ');'))();
      } catch(e2) {
        return null;
      }
    }
  }

  function extractScriptContentById(text, id) {
    const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      '<script\\b(?=[^>]*\\bid\\s*=\\s*["\\\']' + escaped + '["\\\'])[^>]*>([\\s\\S]*?)<\\/script>',
      'i'
    );
    const match = re.exec(text);
    return match ? match[1] : '';
  }

  function readBalancedObject(text, start) {
    let depth = 0, inStr = false, strCh = '', escMode = false, end = -1;
    for (let k = start; k < text.length; k++) {
      const ch = text[k];
      if (inStr) {
        if (escMode) { escMode = false; continue; }
        if (ch === '\\') { escMode = true; continue; }
        if (ch === strCh) { inStr = false; continue; }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = k; break; }
      }
    }
    return end >= 0 ? text.slice(start, end + 1) : '';
  }

  function extractEliadoraDataFromText(text) {
    if (typeof text !== 'string') return null;

    for (const id of PORTABLE_DATA_SCRIPT_IDS) {
      const embedded = extractScriptContentById(text, id);
      const parsed = parseDataObject(embedded);
      if (parsed) return parsed;
    }

    const assignment = /\b(?:window\.)?ELIADORA_DATA\s*=/g;
    let match;
    while ((match = assignment.exec(text))) {
      const start = text.indexOf('{', assignment.lastIndex);
      if (start < 0) continue;
      const raw = readBalancedObject(text, start);
      const parsed = parseDataObject(raw);
      if (parsed) return parsed;
    }
    return null;
  }

  // ── BUILD SAVABLE ──────────────────────────────────────────────────────────
  // Strip data: URLs (które rozsadziłyby localStorage) i zwraca kopię bezpieczną do JSON.stringify.
  function buildSavable(people) {
    if (!Array.isArray(people)) return [];
    return people.map(p => {
      const clone = {...p};
      // Tablice klonujemy
      if (Array.isArray(p.p)) clone.p = [...p.p];
      if (Array.isArray(p.s)) clone.s = [...p.s];
      if (Array.isArray(p.nat)) clone.nat = [...p.nat];
      if (p.bio && typeof p.bio === 'object') clone.bio = {...p.bio};
      // Portrety w polu image zostają, żeby import HTML nie gubił zdjęć.
      // Ciężkie animacje/wideo dalej wyrzucamy z localStorage.
      ['gif', 'video', 'portraitMP4'].forEach(field => {
        if (typeof clone[field] === 'string' && clone[field].startsWith('data:')) {
          clone[field] = '';
        }
      });
      return clone;
    });
  }

  // ── EXPORT ─────────────────────────────────────────────────────────────────
  const api = {
    esc, escAttr,
    normalizePeople,
    isAncestor,
    applyParentLink,
    findDuplicate,
    ageSanityWarning,
    extractEliadoraDataFromText,
    safeJsonForHtmlScript,
    buildSavable
  };

  // Node/CommonJS (Vitest)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  // Przeglądarka
  if (typeof root !== 'undefined') {
    root.EliadoraPure = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
