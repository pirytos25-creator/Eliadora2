# Eliadora — paczka Tier 2.3 (galeria w IDB, eksport z osadzaniem zdjęć, edycja nazwy rodu)

> Ten dokument opisuje zmiany **względem poprzedniej wersji** (Tier 2.2).

## Nowości

### 🗄️ Galeria zdjęć → IndexedDB

Zamiast wpychać każde zdjęcie jako Base64 do `localStorage` (limit 5 MB i 33% narzut), galeria teraz używa **IndexedDB** (limit ~50% dysku, natywne Bloby bez konwersji).

**Co się zmieniło dla Ciebie:**
- Możesz dodać zdjęcia do dowolnej osoby w drzewie (nie tylko DIY) — przycisk „+ Dodaj zdjęcie" w sidebarze
- Zdjęcia są **trwałe** — działają po reloadzie, działają offline, działają z PWA
- Limit pojedynczego pliku podniesiony z 1.5 MB do **8 MB**
- Galeria dzieli się per **rodzina** (Góreckich, Twoja DIY, Drzewo do nauki) — nie mieszają się

**Czego NIE robi:**
- Zdjęcia są w przeglądarce **Twojego komputera**, nie w folderze `zapiski/` ani nie na GitHubie. Inny komputer = puste galerie. To fundamentalne ograniczenie przeglądarek — żeby dzielić zdjęcia między urządzeniami, potrzeba backendu (Tier 3, Supabase).
- Wyczyszczenie danych przeglądarki = utrata galerii. Dlatego eksport HTML jest tak ważny — pakuje galerię ze sobą.

**Plik nowy:** `eliadora-storage.js` (8.5 KB, do podpięcia w HTML obok pozostałych skryptów).

### 📦 Eksport HTML wciąga zdjęcia

Przycisk „📦 Eksport HTML" w trybie DIY teraz:
1. Bierze drzewo
2. **Pobiera wszystkie zdjęcia z IndexedDB**
3. Konwertuje na data: URL
4. Zapakuje wszystko w jeden plik `Eliadora-NazwaRodu.html`

Plik może być ogromny (np. 50 MB jeśli masz dużo zdjęć), ale jest **w 100% samodzielny** — wysyłasz przez maila, otwierasz na innym komputerze, wszystko jest na miejscu.

### 📥 Import HTML wczytuje zdjęcia z powrotem

Przy imporcie:
1. Czyta drzewo
2. Czyści starą galerię tej rodziny
3. **Wczytuje zdjęcia z osadzonych data: URL do IDB**

Round-trip Eksport → Import jest stratny tylko o quotę IDB (jeśli komuś brakuje miejsca).

### ✏️ Edycja nazwy rodu

Ołówek `✎` obok napisu „Rodzina Góreckich" w nagłówku — kliknij, wpisz nową nazwę. Zmienia się:
- Tytuł w nagłówku
- Tekst na okładce księgi
- Zapisuje się trwale (przeżywa reload)
- **Galeria zostaje przeniesiona** (zdjęcia ze starej rodziny lądują pod nową nazwą)

Działa we wszystkich trybach (Góreckich, DIY, nauka).

## Pliki, które się zmieniły

| Plik | Stan |
|---|---|
| `eliadora-storage.js` | **NOWY** — moduł IndexedDB |
| `eliadora8.html` | zmienione: nowy `<script>`, przycisk ✎ obok tytułu |
| `eliadora.css` | doklejono ~20 linii (styl przycisku ✎) |
| `eliadora.js` | refaktor galerii, eksport/import HTML z galerią, funkcja `openFamilyNameEditor`, zapis/odczyt meta |
| `sw.js` | bumped do `eliadora-v10-3`, doklejony `eliadora-storage.js` do precache |

## Co warto sprawdzić po wdrożeniu

1. **Galeria u Góreckich:** wejdź w dowolną osobę, dodaj zdjęcie. Reload (F5). Zdjęcie powinno tam być.
2. **Nazwa rodu:** kliknij `✎`, wpisz „Test". Reload. Powinno dalej być „Test".
3. **Eksport HTML z galerią:** w DIY dodaj 2-3 osoby + zdjęcia do nich. Kliknij „📦 Eksport HTML". Zapisz plik. Otwórz wyeksportowany plik bezpośrednio w przeglądarce — drzewo i zdjęcia powinny być widoczne.
4. **Import:** wyczyść DIY, kliknij „📥 Importuj HTML", wybierz wcześniej zapisany plik. Wszystko wraca.
5. **Galeria w trybie nauki:** wejdź w „Drzewo do nauki", dodaj zdjęcie. Wróć do Góreckich. Wejdź ponownie w naukę — zdjęcie powinno tam być (a w Góreckich nie!).

## Ograniczenia, o których trzeba pamiętać

- **Wyczyszczenie danych przeglądarki kasuje galerię.** Eksportuj HTML co jakiś czas żeby mieć backup.
- **Tryb incognito** nie zapisuje IDB między sesjami — to limitacja przeglądarki.
- **iPhone/Safari mają mniejsze quoty IDB** (~50 MB dla strony) — duże filmy mogą się nie zmieścić.
- **Eksport HTML z galerią bywa wolny** — przy dużej liczbie zdjęć może zająć kilka–kilkanaście sekund. Nie zamykaj zakładki.
