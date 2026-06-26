WAŻNE OGRANICZENIE: Projektujesz TYLKO statyczny design wizualny z danymi-atrapami
(hardcoded). NIE pisz logiki backendu, NIE podłączaj bazy, NIE rób auth, routingu,
drag-and-drop działającego, realtime ani API. Generujesz wygląd, layout, komponenty
i tokeny — interakcje tylko jako stany wizualne (hover/active/selected) i klikalne
przejścia między ekranami. Całą logikę napiszą programiści osobno.

Nazwy komponentów MUSZĄ odpowiadać komponentom React (do handoffu): napisz je po angielsku
w panelu warstw: BoardGrid, BoardCard (kafel tablicy), CreateBoardModal, BoardInterior,
Lista, KartaTablicy, BoardHeader, FAB.

Buduj wszystko na auto-layout. Każdy kolor/spacing/radius jako Figma Variable nazwana
slashowo (np. bg/deep, akcent/baltic, status/zmiana) — mapa 1:1 do tablicaTokens.js.

Zaprojektuj WNĘTRZE pojedynczej tablicy Kanban w Magzic — widok po wejściu w tablicę.
Wzór: realna tablica Trello BlueApart („Tablica Zagranica (Wł+Puck)", „Techniczne
Zagranica"). Ma być GĘSTA, TEKSTOWA, OPERACYJNA — nie ozdobna. To narzędzie pracy.

KLUCZOWE RÓŻNICE OD POPRZEDNICH WERSJI (przeczytaj uważnie):
- Karty są DOMYŚLNIE PROSTE: głównie sam tekst tytułu (np. „Klif C2!", „Nexo H11 - 24.06",
  „nx e18 brak karty", lub dłuższy opis na 2-4 linie). BEZ okładek-zdjęć domyślnie,
  BEZ pillów statusu ZMIANA/PRZYJAZD domyślnie, BEZ pierścieni postępu domyślnie.
- KOLOR jest na poziomie LISTY i całej TABLICY, nie na karcie. Tło tablicy ma jeden
  kolor motywu listy (np. cała tablica teal/cyjan, albo amber, albo granat).
- Listy mają RÓŻNE realne nazwy (nie „Do zrobienia/W trakcie/Gotowe"): np.
  „BRELOK BRAK", „24.06 IGOR potwierdzone", „24.06 gotowe", „24.06 Becia Z, Daria
  granatowy ford", „dołożyć braki", „Pęknięcia", „gnieżdżewo",
  „LISTA DO ZROBIENIA POINFORMOWANA LAURA".
- Listy mogą mieć WŁASNY kolor nagłówka/tła (jak na screenie Techniczne: niebieska,
  fioletowa, amber, zielona listy obok siebie).

UKŁAD (desktop 1440×900):
- BoardHeader na górze (sticky, ~56px): nazwa tablicy po lewej (20px/700, np.
  „Tablica Zagranica (Wł+Puck)") + ikona widoku list + chevron. Po prawej: awatar
  workspace, ikona power-up (wtyczka), ikona automatyzacji (błyskawica), filtr,
  gwiazdka, członkowie, przycisk „Udostępnij", menu „⋯".
- Tło tablicy: JEDEN kolor motywu (wybrany przy tworzeniu) — domyślnie teal/cyjan
  #1A8B99 lub gradient morski. Listy leżą na tym tle.
- Listy w poziomie, scroll poziomy. Szerokość listy 272px (wąsko, jak Trello).
  Gap między listami 12px. Padding płótna 16px.

LISTA (komponent „Lista"):
- Tło listy: półprzezroczysta ciemna płyta rgba(0,0,0,0.30) na kolorowym tle tablicy
  (jak Trello — listy są ciemniejsze niż tło). Radius 12, padding 8px.
- Nagłówek listy: nazwa (14px/600) + licznik kart w pillu (np. „14", „3", „0") +
  ikona zwijania (→←) + menu „⋯”. Niektóre listy mają kolorowy nagłówek (warianty:
  teal/fiolet/amber/zielony/czerwony/granat) — zrób jako variant koloru.
- Body: pionowy stos kart, gap 8px, scroll wewnętrzny gdy dużo kart.
- Stopka: „+ Dodaj kartę" (ghost, ikona + po lewej) + ikona szablonu karty po prawej.

KARTA (komponent „KartaTablicy") — HYBRYDOWA:
WARIANT „simple" (DOMYŚLNY, 90% kart):
  • Tło karty: ciemne rgba(0,0,0,0.45) lub solidne #22272B, radius 8, padding 10px 12px.
  • Sam tekst tytułu, 14px/400, biały, 1-4 linie. Przykłady: „Klif C2!", „Nexo D24 - 24.06",
    „Kat 7 Dolozyc 2x poszewka oraz wode", „NEXO G3 KAPA I POSZEWKI NOWE NIE NASZ LOKAL".
  • Hover: lekkie rozjaśnienie tła + ikona ołówka w rogu.
WARIANT „enriched" (OPCJONALNY, gdy karta ma dane dodatkowe):
  • Może mieć NA GÓRZE pasek koloru etykiety (cienkie kolorowe paski jak Trello labels —
    np. zielony, pomarańczowy, fioletowy 8px wysokości, kilka obok siebie).
  • Może mieć miniaturę-foto (gdy załącznik graficzny).
  • Może mieć ikony w stopce: 📎 z liczbą (załączniki), opis (≡), termin.
  • To wszystko POJAWIA SIĘ TYLKO gdy dane istnieją — opisz w warstwach „widoczne
    warunkowo: gdy karta.labels istnieje / gdy karta.zalaczniki > 0".

DOLNY PASEK NAWIGACJI (jak w Trello mobile/desktop BlueApart):
- Wyśrodkowany pływający pasek na dole: „Skrzynka odbiorcza", „Planista”, „Tablica"
  (aktywna), „Przełącz tablice". Ikony + tekst, glass.

MENU TABLICY (osobny frame — panel „⋯” z prawej):
- Slide-over panel z prawej ~320px, lista pozycji z ikonami: „Udostępnij”,
  „O tej tablicy", „Widoczność", „Wydrukuj/eksportuj", „Ustawienia", „Zmień tło”,
  „Pola niestandardowe", „Automatyzacja", „Etykiety", „Aktywność",
  „Zarchiwizowane elementy", „Zwiń wszystkie listy", „Skopiuj tablicę".

EKRANY DO WYGENEROWANIA:
B-01 BoardInterior desktop — tablica teal z 6 listami o realnych nazwach BlueApart,
     karty PROSTE tekstowe (odwzoruj „Tablica Zagranica”: BRELOK BRAK 14 kart,
     pusta lista „.”, 24.06 IGOR potwierdzone, 24.06 gotowe, 24.06 Becia Z, dołożyć braki).
B-02 BoardInterior „kolorowe listy” — odwzoruj „Techniczne Zagranica”: listy w różnych
     kolorach nagłówków (niebieska, fioletowa, amber, zielona) obok siebie, karty z
     długimi opisami CAPS-LOCK + jedna karta z paskami etykiet kolorów (enriched).
B-03 Menu tablicy — panel „⋯” otwarty z prawej.
B-04 BoardInterior mobile 375×812 — jedna lista widoczna, scroll-snap poziomy,
     dolny pasek nawigacji, FAB „+".
B-05 KartaTablicy — arkusz wariantów: simple (1 linia), simple (4 linie),
     enriched (etykiety), enriched (foto + ikony), stan hover, stan dragging.

ZASADY: gęsto i tekstowo jak realne Trello. Karta domyślnie minimalna. Kolor na
liście i tle, nie na karcie. Tap target 44px, input 16px. Auto-layout. Dane-atrapy
z realnych nazw BlueApart. NIE generuj logiki — tylko wygląd i stany wizualne.