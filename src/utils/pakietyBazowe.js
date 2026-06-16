export const POJEMNOSCI = [2, 3, 4, 5, 6, 7]

export function pakietDlaPojemnosci(n) {
  return {
    nazwa: `Pakiet standard ${n}-osobowy`,
    opis: `Standardowe przygotowanie apartamentu dla ${n} osób`,
    elementy: [
      { towar: 'Komplet pościeli',    ilosc: n },
      { towar: 'Ręcznik duży',        ilosc: n },
      { towar: 'Ręcznik mały',        ilosc: n },
      { towar: 'Ręcznik do nóg',      ilosc: Math.ceil(n / 2) },
      { towar: 'Kapsułka do kawy',    ilosc: n * 2 },
      { towar: 'Woda Perlage',        ilosc: 2 },
      { towar: 'Papier toaletowy',    ilosc: Math.max(2, Math.ceil(n / 2)) },
      { towar: 'Ręcznik papierowy',   ilosc: 1 },
      { towar: 'Zestaw kosmetyczny',  ilosc: n },
      { towar: 'Tabletka do zmywarki',ilosc: 3 },
      { towar: 'Worek na śmieci',     ilosc: 4 },
      { towar: 'Gąbka kuchenna',      ilosc: 1 },
      { towar: 'Płyn do naczyń',      ilosc: 1 },
    ],
  }
}
