Jesteś senior product designerem. Zaprojektuj kompletny moduł Kanban „Tablice"
osadzony w aplikacji webowej Magzic (magzic.com). Ma być NOWOCZEŚNIEJSZY i lepszy
od Trello — immersyjny, terenowy, dla ekip sprzątających, nie biurowy klon tablicy.
Mobile-first: ramka bazowa 375×812. Dodaj warianty desktop 1440×900.

──────────────────────────────────────────
KONTEKST I UŻYTKOWNICY (nie zgaduj)
──────────────────────────────────────────
Produkt: narzędzie operacyjne dla krótkoterminowego najmu (BlueApart, polskie wybrzeże).
Główny user: sprzątaczka/technik w terenie — telefon, jedna ręka, słońce, między
mieszkaniami. Cel ekranu: w 1 sekundę widzi KTÓRY lokal, JAKI typ pracy, ILE zostało,
i przesuwa kartę gdy skończy. Robi też zdjęcia PRZED/PO sprzątaniu jako dowód.
Drugi user: manager na desktopie — układa listy, ustawia automatyzacje, importuje
raporty KW Hotel.

Trzy typy pracy (serce systemu kolorów):
ZMIANA = pełna zmiana między gośćmi (najcięższa), PRZYJAZD = przygotowanie pod
check-in, WYJAZD = obsługa po wymeldowaniu.

──────────────────────────────────────────
SYSTEM WIZUALNY (użyj dokładnie tych wartości; zbuduj jako Variables)
──────────────────────────────────────────
Tło: pełnoekranowy gradient morski 135°: #0A1A2F → #13314F → #1E4D6B.
Opcja foto-tła per tablica — wtedy ZAWSZE nakładka scrim rgba(8,18,32,0.45) pod
kolumnami dla czytelności.

Glass-morphism kolumn i kart: wypełnienie rgba(255,255,255,0.10), border
rgba(255,255,255,0.22), backdrop-blur 16px, radius 16, cień 0 8 24 rgba(0,0,0,0.25).

Tekst: główny #F4F8FB, metadane #A9BBC9. Akcent „baltic" #37A0C9 (akcje, focus,
drop-target, aktywny wskaźnik).

Statusy (maksymalnie rozróżnialne, czytelne w słońcu i dla daltonistów):
ZMIANA amber #F5A524 · PRZYJAZD emerald #2BD17E · WYJAZD violet #9B8CFF.

Typografia: nagłówki i liczby „Space Grotesk" (charakterne cyfry — numery lokali,
liczniki); treść i UI „Inter"; input zawsze 16px (blokada zoomu iOS).
Skala: display 24/700, title 16/600, body 14/400, label 13/500, caption 12/400.

Spacing i radius zgodne z Tailwind: spacing 4/8/12/16/24/32; radius sm8 md12 lg16
pill999. Cienie i blur jako style/efekty.

SYGNATURA (element nie do podrobienia): każda karta ma PIONOWĄ KRAWĘDŹ 4px po lewej
w kolorze typu pracy (status spine) + mały pill z etykietą. Dzięki temu typ pracy
widać natychmiast, nawet gdy karty się nakładają podczas przeciągania.

──────────────────────────────────────────
CO CZYNI TO LEPSZYM OD TRELLO (zaprojektuj te funkcje)
──────────────────────────────────────────
1. Status spine + glanceable klasyfikacja BlueApart (powyżej).
2. Karta z OKŁADKĄ-ZDJĘCIEM lokalu u góry (cover z galerii mieszkania).
3. Zdjęcia PRZED/PO — w szczegółach karty para kafli „Przed / Po" z aparatem;
   kluczowa funkcja weryfikacji sprzątania, której Trello nie ma.
4. Widok „MÓJ DZIEŃ" — osobny ekran agendy: tylko karty przypisane do mnie na dziś,
   posortowane po godzinie/priorytecie. Dla sprzątaczki to domyślny ekran startowy.
5. Realtime presence — w headerze stos avatarów osób aktualnie na tablicy; karta
   edytowana przez kogoś innego ma subtelnie pulsujące obramowanie (lock).
6. Pasek FILTRÓW jako chipy: status, osoba, budynek/właściciel, „po terminie".
7. Przełącznik GĘSTOŚCI: compact (więcej kart) / comfortable.
8. Radialny pierścień postępu checklisty na karcie (np. 3/7) zamiast nudnego paska.
9. Wskaźnik SYNCHRONIZACJI (praca w terenie, słaby zasięg): mały status „zapisano /
   synchronizuję" — bez wyrywających animacji.
10. Micro-interakcje: satysfakcjonujący check checkboxa, wypełnianie pierścienia,
    „ghost slot" pokazujący gdzie karta wskoczy przy przeciąganiu, snap przy upuszczeniu.

──────────────────────────────────────────
KOMPONENTY (zrób jako Components z properties/variants, auto-layout wszędzie;
nazwy = nazwy komponentów React do handoffu)
──────────────────────────────────────────
KartaTablicy: opcjonalna okładka-foto u góry; status spine 4px po lewej; wiersz —
numer/nazwa lokalu (Space Grotesk) + StatusPill; rząd LabelChip; radialny progress
checklisty (np. 3/7); stopka — ikona+licznik załączników, komentarzy, deadline (czerwony
gdy po terminie); avatary przypisanych w prawym dolnym rogu. Min wysokość 64px,
wszystkie strefy dotyku ≥44px. Warianty: status (zmiana/przyjazd/wyjazd);
state (default/hover/selected/dragging — dragging: scale 1.02, rotacja 1–2°, mocniejszy
cień, lock-pulse dla cudzej edycji); density (compact/comfortable); hasCover, hasChecklist,
hasAttachments, assignees (0/1/many).
Bindingi Supabase: status z automatyzacji; checklist JSONB; załączniki w Storage (signed
URL 1h); komentarze/historia w tabeli aktywnosc_kart; deadline; cover z galerii lokalu.

KolumnaTablicy (glass): nagłówek = tytuł + licznik kart w pillu + menu „⋯" (44×44);
body = pionowy stos kart, scroll wewnętrzny; stopka = „+ Dodaj kartę" (ghost, pełna
szerokość). Warianty state: default / drop-target (krawędź baltic, tło lekko jaśniejsze).

BoardCanvas: pełnoekranowe tło (gradient lub foto+scrim). Mobile = poziomy scroll-snap
carousel, JEDNA kolumna widoczna naraz, snap do krawędzi, boczny padding 16px by
wystawała krawędź następnej kolumny (afordancja). Desktop = kolumny obok siebie,
poziomy scroll płótna.

BoardHeader (sticky, glass+blur, safe-area-inset-top): nazwa tablicy (display) ·
przełącznik widoku (Tablica / Mój dzień) · pole szukania · pasek FiltrChip ·
stos avatarów presence · avatar zalogowanego.

CarouselIndicator (mobile): segmentowy pasek nad płótnem, ile list i na której jesteś,
aktywny segment w kolorze baltic.

CardDetail: mobile = BOTTOM SHEET z punktami snap (peek / half / full ~92%), uchwyt do
zsuwania, akcje główne PRZYKLEJONE DO DOŁU (kciuk); desktop = SLIDE-OVER panel z prawej
(~420px), tablica w tle przyciemniona. Sekcje (każda sub-komponent, auto-layout):
nagłówek (lokal + StatusPill + przypisani + AutomationBadge); ChecklistItem (checkbox 24px
+ tekst + ✕, pierścień/pasek postępu); blok PRZED/PO (dwa AttachmentTile 1:1 z aparatem)
+ pozostałe AttachmentTile (miniatura, nazwa, rozmiar, kafel „+ Aparat/Plik");
ActivityRow (avatar + autor + treść + czas, oś czasu komentarzy/historii); edytor labeli
(paleta kolorów z tokenów).

Mniejsze: StatusPill (3 warianty), LabelChip (warianty kolorów), AutomationBadge (⚡ +
nazwa reguły), FiltrChip (default/active), PresenceStack (avatary + „+N"), FAB „+”
(56px, baltic, cień, nad safe-area-inset-bottom — dodaje kartę do widocznej listy),
SyncIndicator, DensityToggle, EmptyState (krótkie „Brak kart. Dodaj pierwszą." +
przycisk — zaproszenie do akcji, nie nastrój), LoadingState (szkielety kart, nie spinner),
ErrorState (co poszło nie tak + jak naprawić, głosem interfejsu).

──────────────────────────────────────────
EKRANY (frame'y — generuj w tej kolejności)
──────────────────────────────────────────
MOBILE 375×812:
M-01 „Mój dzień" — domyślny ekran sprzątaczki: header z przełącznikiem widoku,
   lista kart przypisanych na dziś (z godziną, lokalem, typem pracy, postępem), FAB.
M-02 Board — header + FiltrChipy + presence + CarouselIndicator + jedna glass-kolumna
   z kartami (część z okładką-foto) + FAB.
M-03 Board / drag — karta w stanie dragging nad kolumną drop-target, widoczny ghost slot.
M-04 CardDetail (bottom sheet, stan full) — wszystkie sekcje, wyraźny blok PRZED/PO,
   akcje przyklejone do dołu.
M-05 Import KW Hotel — listy auto-wypełnione z raportu, karty z kolorowymi labelami wg
   klasyfikacji ZMIANA/PRZYJAZD/WYJAZD.
M-06 Empty board.

DESKTOP 1440×900:
D-01 Board — tło + 4–5 glass-kolumn obok siebie + header z filtrami, presence i szukaniem.
D-02 CardDetail (slide-over z prawej, 420px) — tablica przyciemniona w tle.
D-03 „Mój dzień" / agenda na desktopie (opcjonalnie).

──────────────────────────────────────────
ZACHOWANIA (zaznacz w prototypie / opisach warstw — mapują się na kod)
──────────────────────────────────────────
Drag & drop: osobne sensory — mysz (próg 8px) i dotyk (delay 180ms, tolerancja 8px);
karty mają touch-action none. Wizualnie: dragging = uniesienie + tilt + cień;
drop-target podświetlony baltic; ghost slot tam gdzie karta wskoczy.
Reorder w liście: fractional indexing — pokaż ghost slot.
Carousel: CSS scroll-snap po X, snap do krawędzi kolumny; indykator synchronizuje listę.
Realtime: cała ekipa pracuje jednocześnie — presence w headerze + lock-pulse na cudzej
karcie + subtelny puls obramowania przy zdalnej zmianie. Żadnych wyrywających animacji.
Optymistyczny ruch karty z delikatnym potwierdzającym pulsem.
Transitions 120–180ms ease-out. RESPEKTUJ prefers-reduced-motion (wyłącz scale/rotację,
zostaw zmianę cienia). Widoczny focus-ring baltic na każdym elemencie interaktywnym.

──────────────────────────────────────────
TWARDE REGUŁY MOBILE-FIRST
──────────────────────────────────────────
Baza 375px; desktop = nadpisania (md:), desktop NIGDY psuty zmianami mobile.
Tap target min 44×44px; karta min 64px. Input 16px. safe-area-inset-top/bottom
w headerze, FAB, sheetcie. Akcje główne w zasięgu kciuka (dół), nie na górze.

──────────────────────────────────────────
HANDOFF DO KODU (React 19 + Tailwind 4 + Supabase + Cloudflare, VS Code)
──────────────────────────────────────────
Zbuduj Variables (Color/Spacing/Radius/Effect) nazwane slashowo (status/zmiana) — mapują
się 1:1 do tablicaTokens.js i tokenów @theme Tailwinda (bg-status-zmiana, rounded-md,
gap-2). Nazwy komponentów Figmy = nazwy komponentów React (KartaTablicy, KolumnaTablicy,
BoardHeader, CardDetail, StatusPill, LabelChip, FAB…). W opisie każdej warstwy danych
zaznacz pole Supabase do podpięcia. Glass na foto-tle zawsze ze scrim (kontrast WCAG).