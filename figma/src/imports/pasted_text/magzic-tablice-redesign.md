Jesteś senior product designerem iterującym na istniejącym projekcie Magzic Tablice
(Kanban dla ekip sprzątających, magzic.com/tablice). Masz już wygenerowane ekrany —
teraz popraw je fundamentalnie w trzech kierunkach:

1. Tablica musi WYGLĄDAĆ jak prawdziwa tablica Kanban — immersyjna, przestrzenna,
   z głębią i oddechem. Teraz jest za płaska i za ciasna.
2. Dodaj pełny SYSTEM MOTYWÓW — minimum 4 skórki do przełączania.
3. Popraw każdy komponent w szczegółach wg listy poniżej.

──────────────────────────────────────────────────────────
PROBLEM 1: TABLICA NIE WYGLĄDA JAK TABLICA — NAPRAW TO
──────────────────────────────────────────────────────────
Obecny problem: kolumny są przyklejone do siebie bez oddechu, tło nie oddycha,
brakuje poczucia głębi i przestrzeni. Trello i Linear mają to dobrze — ucz się
z nich ale idź dalej.

Naprawy:
- GAP między kolumnami: minimum 16px, optymalnie 20px. Kolumny NIE dotykają się.
- PADDING płótna: 24px od każdej krawędzi ekranu. Kolumny nie sięgają do brzegów.
- SZEROKOŚĆ kolumny: 280px na desktopie (nie szersza). Karty wewnątrz mają 12px margines.
- GAP między kartami w kolumnie: 10px. Karty oddychają.
- WYSOKOŚĆ kolumny: auto (rośnie z kartami) z max-height i scroll wewnętrznym.
  Kolumna NIE zajmuje całego ekranu jeśli ma 2 karty.
- TŁO PŁÓTNA: jeśli gradient — musi być wyraźnie ciemniejszy niż kolumny glass,
  żeby kolumny „unosiły się" nad tłem. Różnica kontrastu: co najmniej 30%.
- CIEŃ kolumny: 0 4px 32px rgba(0,0,0,0.35) — głęboki, rozprosiony.
  Kolumny muszą rzucać cień na tło, nie na siebie nawzajem.
- GLASS efekt kolumn: backdrop-blur 20px, fill rgba(255,255,255,0.09),
  border top rgba(255,255,255,0.28) (jaśniejszy u góry jak prawdziwe szkło),
  border rest rgba(255,255,255,0.12).
- HEADER kolumny: wyraźnie oddzielony od ciała — border-bottom rgba(255,255,255,0.15),
  padding 14px 16px, tytuł 15px/600 Space Grotesk, licznik kart w pillu 22px/600.
- STOPKA „+ Dodaj kartę": zawsze widoczna na dole kolumny, ghost button,
  padding 12px 16px, ikona + po lewej, kolor muted #A9BBC9, hover rozjaśnia.
- NAGŁÓWEK TABLICY (BoardHeader): sticky, 64px wysokości, glass + blur 20px,
  wyraźna granica shadow-bottom od płótna.

──────────────────────────────────────────────────────────
PROBLEM 2: DODAJ SYSTEM MOTYWÓW (4 skórki)
──────────────────────────────────────────────────────────
W headerze tablicy, obok nazwy lub w menu „⋯", dodaj przełącznik motywu —
4 klikalne kafelki podglądu kolorów (32x32px, radius 8). Aktywny z obramowaniem baltic.

Zaprojektuj wszystkie 4 motywy jako warianty/tryby w Figma Variables:

MOTYW 1: „Baltic Deep" (domyślny — morski, obecny kierunek)
  Tło gradient: #0A1A2F → #13314F → #1E4D6B (135°)
  Kolumna glass fill: rgba(255,255,255,0.09)
  Akcent: #37A0C9
  Tekst: #F4F8FB / #A9BBC9
  Użyj jako bazę do zmian niżej.

MOTYW 2: „Midnight Slate" (ciemny, neutralny, profesjonalny)
  Tło gradient: #0D0D0F → #141418 → #1C1C24 (160°)
  Kolumna glass fill: rgba(255,255,255,0.07)
  Kolumna glass border: rgba(255,255,255,0.12)
  Akcent: #7C6FF7 (fioletowy)
  StatusPill ZMIANA: #F5A524 · PRZYJAZD: #2BD17E · WYJAZD: #9B8CFF
  Podpisy: #8B8B9E
  Poczucie: wysokiej klasy SaaS, jak Linear.

MOTYW 3: „Coastal Fog" (jasny, letni, przybrzeżny)
  Tło: #EEF3F8 solid (nie gradient)
  Kolumna: białe tło rgba(255,255,255,0.92), border rgba(0,0,0,0.08), cień 0 2px 16px rgba(0,0,0,0.08)
  Brak glass efektu — płaskie karty na jasnym tle jak Trello light.
  Akcent: #0B7FCC
  Tekst główny: #0F1923 · podpisy: #5E7080
  StatusPill ZMIANA: #E8930A · PRZYJAZD: #16A870 · WYJAZD: #6B52E0
  Status spine: zachowany, kolor statusu.
  Poczucie: świeży, dzienny, przyjazny.

MOTYW 4: „Sunset Coast" (wieczorny, ciepły, premium)
  Tło gradient: #1A0A18 → #2D1320 → #3D2010 (135°) — głęboka purpura w ciepły brąz
  Kolumna glass fill: rgba(255,230,200,0.07)
  Kolumna glass border: rgba(255,200,150,0.18)
  Akcent: #E8855A (koralowy)
  Tekst: #F5EBE0 / #C4A898
  StatusPill ZMIANA: #F5A524 · PRZYJAZD: #4CC68D · WYJAZD: #C084FC
  Poczucie: premium, wieczorny shift, zachód słońca nad morzem.

Każdy motyw jako osobny Frame z pełnym widokiem tablicy (Board desktop D-01).
Dodaj też komponent ThemeSwitcher: 4 kafelki 32x32 ułożone poziomo, aktywny z ring.

──────────────────────────────────────────────────────────
PROBLEM 3: POPRAWKI SZCZEGÓŁOWE KOMPONENTÓW
──────────────────────────────────────────────────────────

KARTA (KartaTablicy) — dopracuj:
- Status spine 4px po lewej: NIE zaokrąglaj narożników tam gdzie spine spotyka krawędź
  karty (border-radius: 0 na lewej stronie). Spine musi być ostre i mocne.
- Numer lokalu: Space Grotesk 18px/700, wyraźniejszy.
- Pill statusu (ZMIANA/PRZYJAZD/WYJAZD): kolor tła 18% opacity, tekst pełny kolor statusu,
  border 1px kolor statusu 40% opacity. NIE pełne tło — subtelny, przezroczysty pill.
- Radialny pierścień checklisty: 36px diameter, stroke 3px, kolor statusu (nie szary).
  Wewnątrz cyfry np. „3/7" w 10px/600. Tło pierścienia: rgba koloru statusu 15%.
- Okładka-foto lokalu (cover): jeśli jest — ratio 16:9, radius 8px na górze karty,
  brak dolnego radius (karta przechodzi w foto). Scrim gradient na dole foto (fade to card bg).
- Stopka karty: ikony 14px, gap 10px, height 32px. Deadline czerwony (#FF6B6B) z ikoną ⚠.
- Label chips: height 20px, padding 4px 8px, radius pill, font 11px/500.
- Avatar stack: 24px diameter, border 2px kolor kolumny glass, -8px overlap.
- Hover state karty: translate-Y -2px, cień mocniejszy (0 8px 24px rgba(0,0,0,0.4)),
  border jaśniejszy rgba(255,255,255,0.35).
- Dragging state: rotate 2deg, scale 1.03, cień 0 16px 40px rgba(0,0,0,0.5),
  opacity 0.97, cursor grabbing.

KARTA „MÓJ DZIEŃ" (lista agendowa) — dopracuj:
- Godzina po lewej: dwie linie — duże „13" (20px/700 Space Grotesk) + małe „:00" (11px/400).
  Wyrównane do prawej w kolumnie 48px szerokości.
- Status spine: 4px po lewej, pełna wysokość wiersza agendowego, kolor statusu.
- Separator sekcji (RANO / POŁUDNIE): caps-lock tracking, 11px/500, kolor muted #A9BBC9,
  margin-top 20px. Cienka linia po prawej, flex grow. Nie bold, nie duży.
- Pierścień na końcu wiersza: identyczny jak na karcie tablicy, 32px diameter.
- Wiersz hover: tło rgba(255,255,255,0.07), kursor pointer, transition 120ms.
- Przekroczony termin: tekst w kolorze #FF6B6B, ikona ⚠ przed tekstem, brak pillu — tylko kolor.

HEADER TABLICY — dopracuj:
- BLUEAPART eyebrow: 10px/500 uppercase tracking-wider, kolor muted. Nad „Tablice".
- „Tablice": 28px/700 Space Grotesk, tekst biały/jasny.
- Ikony widoku (grid/lista): 40x40px, radius 10px, aktywny tło rgba(255,255,255,0.15).
  Border 1px rgba(255,255,255,0.12) zawsze.
- Szukaj jako ikona (nie pole): klikalne, otwiera overlay szukania.
- Presence avatary: 32px, overlap -10px, ostatni pill „+N".
- SyncIndicator po lewej pod tytułem: ikona wifi (14px) + „zapisano" (12px/400 muted).
  Kolor: zielony gdy zapisano, amber gdy synchronizuje, czerwony gdy offline.
- Statystyki po prawej pod filtrami: „7 aktywnych · 1 po terminie" — 12px/400, muted.
  „po terminie" w kolorze #FF6B6B.

FILTRY (chipy):
- Wysokość 32px, padding 10px 16px, radius pill, border 1px rgba(255,255,255,0.18).
- Inactive: tło transparentne, tekst muted.
- Active (np. „Wszystkie"): tło rgba(55,160,201,0.25), tekst baltic #37A0C9,
  border 1px #37A0C9 60% opacity.
- Hover: tło rgba(255,255,255,0.10).

FAB „+":
- 56px circle, tło solid #37A0C9 (nie gradient), ikona + biała 24px.
- Cień: 0 4px 20px rgba(55,160,201,0.50).
- Hover: scale 1.08, cień mocniejszy.
- Position: fixed bottom-right, 24px od krawędzi, nad safe-area.

PRZYCISK HELP „?":
- 40px circle, tło rgba(255,255,255,0.12), border 1px rgba(255,255,255,0.20).
- Obok FAB (nie nakłada się), 8px gap.

──────────────────────────────────────────────────────────
EKRANY DO WYGENEROWANIA (w tej kolejności)
──────────────────────────────────────────────────────────
D-01 „Baltic Deep" Board — desktop 1440×900, 4 kolumny, pełna tablica z oddechem.
     Kolumna 1 „Do zrobienia": 3 karty (14A ZMIANA z okładką, 8B PRZYJAZD bez okładki, 22C WYJAZD).
     Kolumna 2 „W trakcie": 2 karty (5A ZMIANA z okładką + lock-pulse, 11D PRZYJAZD).
     Kolumna 3 „Weryfikacja": 1 karta (3B WYJAZD z okładką + label „Foto OK").
     Kolumna 4 „Gotowe": 2 karty (19A ZMIANA ukończona 7/7, 6C PRZYJAZD).

D-02 „Midnight Slate" — identyczna tablica w motywie ciemnym/fioletowym.
D-03 „Coastal Fog" — identyczna tablica w motywie jasnym.
D-04 „Sunset Coast" — identyczna tablica w motywie ciepłym.
D-05 ThemeSwitcher dropdown — rozwinięty panel przełącznika (4 podglądy + aktywny ring).
M-01 Board mobile 375×812 — „Baltic Deep", carousel, jedna kolumna „Do zrobienia".
M-02 „Mój dzień" mobile — poprawiona agenda wg wytycznych powyżej.
M-03 CardDetail bottom sheet — pełny sheet: checklist, PRZED/PO, komentarze, labele.

──────────────────────────────────────────────────────────
BEZWZGLĘDNE ZASADY (nie łam ich)
──────────────────────────────────────────────────────────
- Auto-layout wszędzie. Zero ręcznego pozycjonowania elementów wewnątrz komponentów.
- Tap target min 44×44px (mobile). Karta min 72px wysokości.
- Input 16px font (blokada zoom iOS).
- safe-area-inset w headerze i FAB.
- Nazwy komponentów = nazwy React: KartaTablicy, KolumnaTablicy, BoardHeader,
  CardDetail, StatusPill, LabelChip, ThemeSwitcher, FAB, SyncIndicator.
- Figma Variables: kolekcja Color ze wszystkimi wartościami; 4 tryby = 4 motywy.
  Nazwa slashowa: status/zmiana, glass/surface, bg/deep — mapa 1:1 do tablicaTokens.js.
- Każdy element danych opisany w warstwie: pole Supabase (np. „klasyfikacja: Zmiana/
  Przyjazd/Wyjazd z automatyzacji", „checklist: JSONB", „cover: Storage signed URL").
- Desktop layout NIGDY psuty zmianami mobile (md: breakpointy).
- prefers-reduced-motion: opisz gdzie wyłączyć scale/rotate, zostaw opacity transition.