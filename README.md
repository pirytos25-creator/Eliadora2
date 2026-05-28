# Eliadora — drzewo genealogiczne

Interaktywne drzewo genealogiczne dla projektu wsparcia dobrostanu Seniorów.

---

## 🚀 Jak opublikować na GitHub Pages (najprościej)

1. **Stwórz nowe repozytorium na GitHubie** (publiczne albo prywatne — Pages działa w obu).
2. **Wrzuć cały ten folder** do repozytorium (przeciągnij pliki do GitHuba przez WWW, albo `git push`).
3. Wejdź w **Settings → Pages**:
   - **Source:** wybierz „**GitHub Actions**"
4. Push do gałęzi `main` automatycznie deployuje stronę (workflow jest już w `.github/workflows/deploy-pages.yml`).
5. Po 1–2 minutach strona będzie pod:
   ```
   https://TWOJ-LOGIN.github.io/NAZWA-REPO/
   ```

To wszystko. **Żadnego Pythona, żadnego serwera, żadnego buildu.** Po prostu pliki na GitHubie.

> 💡 Pierwsze otwarcie strony pokazuje okładkę księgi. Klik „Otwórz księgę" → drzewo Góreckich.
> Na telefonie po chwili pojawi się banner „Zainstaluj Eliadorę" — można ją mieć jak appkę na ekranie głównym.

---

## 🖥 Jak otworzyć lokalnie (bez GitHuba)

**Opcja A — szybka, bez instalowania niczego:**
Podwójne kliknięcie w `eliadora8.html`. Otworzy się w przeglądarce. Ograniczenia tego trybu:
- ❌ PWA (instalacja jako aplikacja, offline) — nie zadziała pod `file://`
- ❌ Eksport zdjęć do PDF może nie działać (CORS)
- ✅ Drzewo, edycja, opowieść, galeria — wszystko działa

**Opcja B — pełna funkcjonalność lokalnie:**
Każdy darmowy serwer HTTP wystarczy. Najwygodniej:
- **Live Server** w VS Code (rozszerzenie, prawy klik → „Open with Live Server")
- albo **Servez** / **http-server** / **serve** — co masz pod ręką

---

## 📂 Co jest w folderze

**Aplikacja (musi być w repo):**
- `index.html` — przekierowanie z głównej do `eliadora8.html`
- `eliadora8.html` — strona (markup)
- `eliadora.css` — style
- `eliadora.js` — logika
- `eliadora-pure.js` — czyste funkcje (testowalne)
- `eliadora.i18n.js` — tłumaczenia PL/EN/ES/FR
- `eliadora-data.js` — dane rodziny Góreckich

**PWA:**
- `manifest.webmanifest`
- `sw.js`

**Zasoby:**
- `assets/` — pergaminy, muzyka, ikona
- `vendor/` — biblioteki D3 i jsPDF
- `p/` — portrety osób
- `adult_*.png`, `child_*.png`, `elder_*.png` — placeholdery

**Dla deweloperów (nie musi być na produkcji, ale niech zostaje):**
- `_dev/` — testy jednostkowe Vitest (65 testów)
- `CHANGES.md` — szczegółowy opis zmian

**Konfiguracja GitHuba:**
- `.github/workflows/deploy-pages.yml` — automatyczny deploy
- `.gitignore` — pomija `node_modules` itd.

---

## ✨ Co umie ta wersja

- 📜 Drzewo genealogiczne z 63 osobami z rodziny Góreckich
- ✏️ Edycja, dodawanie osób, dziedziczenie
- 🌍 4 języki (PL/EN/ES/FR), 4 motywy pergaminu
- 🎵 Muzyka w tle, tryb Senior (większe litery)
- 📄 Eksport PDF, druk
- 🎞️ **Galeria wspomnień** — wiele zdjęć i wideo przy każdej osobie
- 🎬 **Tryb opowieści** — kamera przejeżdża chronologicznie przez drzewo
- 📲 **PWA** — instalowalna jako aplikacja, działa offline
- 📱 **Wersja mobilna** — sidebar wyjeżdża od dołu pełnoekranowo
- 🛠️ **„Zrób to sam"** — własne drzewo od zera, eksport/import jako standalone HTML

---

## 🧪 Uruchamianie testów (opcjonalnie)

Wymaga [Node.js](https://nodejs.org).

```bash
cd _dev
npm install
npm test
```

Powinieneś zobaczyć: `Tests  65 passed (65)`.

---

## 📝 Licencja i autorstwo

Projekt prywatny, wsparcie dobrostanu Seniorów. Brand: Lucid Academy.
