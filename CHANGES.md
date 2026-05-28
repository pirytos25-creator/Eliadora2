# Eliadora — paczka Tier 2 (rozdział kodu + testy + galeria + opowieść)

## Co jest w środku

```
v2/
├── eliadora8.html          ← nadpisz (chudy, ~570 linii zamiast 4500)
├── eliadora.css            ← nowy (styles)
├── eliadora.i18n.js        ← nowy (4 języki, łatwo edytować bez znajomości JS)
├── eliadora-pure.js        ← nowy (czyste funkcje testowalne)
├── eliadora.js             ← nowy (logika aplikacji)
├── manifest.webmanifest    ← nowy/aktualizacja (PWA)
├── sw.js                   ← nowy/aktualizacja (Service Worker, cache v10-2)
│
├── package.json            ← nowy (dla testów)
├── vitest.config.js        ← nowy (config testów)
└── tests/                  ← 4 pliki testów, 65 przypadków
    ├── escape.test.js          (12 testów — XSS)
    ├── data-prep.test.js       (11 testów — normalizacja, buildSavable)
    ├── genealogy.test.js       (31 testów — isAncestor, parentLink, duplikat, sanity)
    └── import-export.test.js   (11 testów — parser ELIADORA_DATA)
```

**Pozostają bez zmian:** `eliadora-data.js`, `assets/`, `vendor/`, `p/`, portrety placeholdery (`adult_*.png` etc.) — wszystkie te pliki w Twoim folderze są dalej używane.

## Co działa po wdrożeniu

### 1. 🗂️ Kod rozdzielony — z 4500 linii w jednym HTML na 5 plików
- **`eliadora8.html`** chudy (~570 linii) — sam markup
- **`eliadora.css`** — wszystkie style, edycja bez przewijania logiki
- **`eliadora.i18n.js`** — tłumaczenia PL/EN/ES/FR jako prosty obiekt, może edytować ktoś bez znajomości JS
- **`eliadora-pure.js`** — czyste funkcje (bez DOM/window), testowalne, jeden punkt prawdy
- **`eliadora.js`** — reszta logiki

Edycja tłumaczeń, koloru pergaminu albo dodanie testu wymaga teraz dotykania jednego małego pliku, nie monolitu.

### 2. 🧪 Testy jednostkowe (Vitest) — 65 testów, wszystkie zielone

```
$ npm install
$ npm test
✓ tests/genealogy.test.js     (31 tests)
✓ tests/import-export.test.js (11 tests)
✓ tests/data-prep.test.js     (11 tests)
✓ tests/escape.test.js        (12 tests)
Tests  65 passed (65)
```

**Co konkretnie przetestowane:**

`escape.test.js`:
- `esc()` neutralizuje `<script>`, cudzysłowy, apostrofy, payload `<img onerror>`
- `escAttr()` blokuje XSS injection typu `');alert(1);//`
- przepuszcza normalne dane (`O'Brien`, `person_123`, polskie znaki)
- kolejność escape backslash → apostrof (krytyczne dla bezpieczeństwa)

`genealogy.test.js`:
- `isAncestor()` wykrywa dziadka jako przodka wnuka
- nie wpada w pętlę nieskończoną przy okrężnych referencjach (patologiczne dane A↔B)
- odporny na nieistniejące ID i null pmap
- `applyParentLink()` przypisuje ojca pierwszego, matkę drugą; odrzuca drugiego ojca
- ignoruje "stale IDs" rodziców których już nie ma w drzewie
- `findDuplicate()` case-insensitive, rozróżnia po roku urodzenia, pomija edytowaną osobę
- `ageSanityWarning()` wykrywa zgon przed urodzeniem oraz rodzica młodszego od dziecka

`data-prep.test.js`:
- `normalizePeople()` dodaje brakujące p[]/s[]
- `buildSavable()` stripuje data: URLe (żeby nie pęknąć quoty localStorage), zachowuje ścieżki względne

`import-export.test.js`:
- Parser ELIADORA_DATA: wyciąga z HTML/JS, ogarnia trailing commas, escaped quotes, template literals
- Round-trip: `JSON.stringify(data)` → `extractEliadoraDataFromText()` daje to samo

**Uruchamianie testów:**
```bash
cd v2
npm install        # raz, ~10 sekund
npm test           # uruchom wszystkie testy
npm run test:watch # watch mode podczas pracy
```

### 3. 📲 PWA — aplikacja instalowalna offline (cache v10-2)
- Service Worker cachuje wszystkie 5 plików aplikacji + assety statyczne
- W Chrome/Edge pojawia się banner "Zainstaluj Eliadorę"
- Drugi run działa bez netu
- Wymaga serwowania przez HTTP (`python3 -m http.server` albo GitHub Pages), nie `file://`

### 4. 🎞️ Galeria wspomnień per osoba
- Nowa sekcja w sidebarze pod biografią: "Wspomnienia"
- Przycisk "+ Dodaj zdjęcie" → wybór wielu plików (zdjęcia + krótkie wideo)
- Kliknięcie miniatury → lightbox (ten sam co dla portretów)
- Edytowalny podpis przy każdej miniaturze
- Przycisk usuwania (✕) w prawym górnym rogu miniatury
- Limit 1.5 MB na plik osadzony jako data: URL (większe → użyj ścieżki względnej)
- Zapis automatyczny do localStorage przy zmianach
- Galeria wjeżdża jako `person.gallery[]` — kompatybilne z eksportem JSON

### 5. 🎬 Tryb opowieści — kamera przejeżdża przez drzewo
- Nowy przycisk **🎬 Opowieść** w nagłówku
- Osoby sortowane chronologicznie wg roku urodzenia (brakujące daty alfabetycznie na końcu)
- Karta narracyjna w prawym dolnym rogu: imię, daty, biografia, licznik
- Pasek postępu
- ~6.5 sekundy na osobę, automatyczne przejście
- Sterowanie: **‹ Poprzednia**, **⏸ Pauza / ▶ Wznów**, **Następna ›**, **✕ Zakończ**
- Skróty klawiszowe: ← → przewijanie, **Spacja** = pauza, **Esc** = wyjście
- Drzewo widoczne w tle przez całą opowieść — można obserwować ruch kamery

## Czego NIE zrobiłam (zgodnie z Twoją prośbą)
- Trybu "tylko podgląd" — pominięty (powiedziałeś "spokojnie nie rób tego")

## Jak wdrożyć

1. Skopiuj **9 plików** z paczki obok istniejącego `eliadora8.html`:
   ```
   eliadora8.html       (nadpisz)
   eliadora.css         (nowy)
   eliadora.js          (nowy)
   eliadora-pure.js     (nowy)
   eliadora.i18n.js     (nowy)
   manifest.webmanifest (nowy/nadpisz)
   sw.js                (nowy/nadpisz)
   package.json         (nowy — tylko dla testów)
   vitest.config.js     (nowy — tylko dla testów)
   tests/               (folder — tylko dla testów)
   ```

2. Otwórz przez serwer HTTP, nie `file://`:
   ```bash
   cd Doris-onesama
   python3 -m http.server 8000
   # otwórz http://localhost:8000/eliadora8.html
   ```

3. (Opcjonalnie) uruchom testy:
   ```bash
   cd Doris-onesama
   cp -r v2/package.json v2/vitest.config.js v2/tests v2/eliadora-pure.js .
   npm install
   npm test
   ```

## Co warto sprawdzić po wdrożeniu

1. **Stara funkcjonalność:** drzewo się renderuje, klikanie w osoby działa, edycja działa, PDF/print działa, języki przełączają się, motywy pergaminu się zmieniają, muzyka gra.
2. **Galeria:** wejdź w sidebar, kliknij "+ Dodaj zdjęcie", wybierz 2-3 zdjęcia, sprawdź czy się dodały, czy lightbox je otwiera, czy podpisy się zapisują, czy ✕ usuwa.
3. **Opowieść:** kliknij 🎬 Opowieść w nagłówku — kamera powinna przejść od najstarszego przodka (Dariusz Górecki, 1900) przez kolejne pokolenia. Spacja pauzuje, strzałki przewijają.
4. **PWA:** otwórz przez `http://localhost:8000/`, w Chrome F12 → Application → Service Workers — powinien być zarejestrowany. Wyłącz Wi-Fi, F5 — strona dalej działa.
5. **Testy:** `npm test` w folderze powinno dać "Tests 65 passed (65)".

## Następne kroki (jak będziesz chciał)

- **Auto-save indicator** — kropka "✓ zapisano"
- **Edytor wpisów w galerii** — drag-drop kolejności, przycinanie zdjęć
- **Druk księgi A5** — z biografią każdej osoby na osobnej stronie
- **Wsparcie GEDCOM** — import/eksport ze standardu genealogicznego
- **Backend (Supabase)** — multi-rodziny z share-linkiem
