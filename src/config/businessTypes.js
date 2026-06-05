export const BUSINESS_CATEGORIES = [
  {
    id: 'general',
    label: 'Uniwersalny magazyn',
    icon: '📦',
    description: 'Dla firm z nietypowym magazynem lub tych, które nie chcą jeszcze wybierać branży.',
    subcategories: [
      { id: 'general_inventory', label: 'Magazyn ogólny' },
    ],
    assistantQuickPrompts: [
      'Pokaż dashboard zakupów',
      'Co najbardziej podrożało?',
      'Co powinienem zamówić?',
      'Pokaż niskie stany',
      'Pokaż faktury do weryfikacji',
    ],
    helperDescription: 'Zarządzaj towarami, stanami i fakturami w jednym miejscu.',
    searchAliases: ['magazyn', 'ogólny', 'uniwersalny', 'firma', 'biuro', 'inne'],
  },
  {
    id: 'gastronomy',
    label: 'Gastronomia',
    icon: '🍽',
    description: 'Restauracje, kebaby, bary, kawiarnie, piekarnie i catering.',
    subcategories: [
      { id: 'restaurant_bistro', label: 'Restauracja / bistro' },
      { id: 'kebab_fast_food', label: 'Kebab / fast food' },
      { id: 'bar_pub', label: 'Bar / pub' },
      { id: 'cafe', label: 'Kawiarnia' },
      { id: 'bakery_confectionery', label: 'Piekarnia / cukiernia' },
      { id: 'catering', label: 'Catering' },
      { id: 'food_truck', label: 'Food truck' },
    ],
    assistantQuickPrompts: [
      'Co kończy się przed weekendem?',
      'Które produkty spożywcze podrożały?',
      'Co powinienem domówić do kuchni?',
      'Pokaż niskie stany składników',
      'Sprawdź faktury od dostawców żywności',
    ],
    helperDescription: 'Kontroluj zaplecze kuchni, dostawy i stany produktów spożywczych.',
    searchAliases: ['kebab', 'bar', 'kawiarnia', 'piekarnia', 'catering', 'pizza', 'sushi', 'restauracja', 'fast food', 'jedzenie', 'kuchnia', 'food truck', 'bistro', 'cukiernia'],
  },
  {
    id: 'retail',
    label: 'Handel detaliczny',
    icon: '🛒',
    description: 'Sklepy stacjonarne: spożywcze, odzieżowe, zabawki, elektronika i inne.',
    subcategories: [
      { id: 'grocery_store', label: 'Sklep spożywczy' },
      { id: 'fruit_vegetable_store', label: 'Warzywniak' },
      { id: 'toy_store', label: 'Sklep z zabawkami' },
      { id: 'clothing_store', label: 'Sklep odzieżowy' },
      { id: 'cosmetics_store', label: 'Sklep kosmetyczny' },
      { id: 'pet_store', label: 'Sklep zoologiczny' },
      { id: 'electronics_store', label: 'Sklep z elektroniką' },
      { id: 'local_store_kiosk', label: 'Kiosk / sklep osiedlowy' },
      { id: 'bookstore_stationery', label: 'Księgarnia / papierniczy' },
      { id: 'home_goods_store', label: 'Sklep z wyposażeniem domu' },
      { id: 'sports_store', label: 'Sklep sportowy' },
      { id: 'jewelry_accessories_store', label: 'Biżuteria / akcesoria' },
      { id: 'second_hand_store', label: 'Second hand' },
    ],
    assistantQuickPrompts: [
      'Które produkty mają niski stan?',
      'Które produkty zalegają w sklepie?',
      'Co powinienem domówić?',
      'Co najbardziej podrożało u dostawców?',
      'Pokaż faktury do weryfikacji',
    ],
    helperDescription: 'Pilnuj stanów, rotacji i cen w sklepie.',
    searchAliases: ['sklep', 'odzież', 'spożywczy', 'elektronika', 'zabawki', 'kiosk', 'warzywniak', 'kosmetyki', 'zoologiczny', 'delikatesy', 'market'],
  },
  {
    id: 'ecommerce',
    label: 'E-commerce / sprzedaż internetowa',
    icon: '📱',
    description: 'Sklepy online, marketplace, rękodzieło i sprzedaż z małym magazynem.',
    subcategories: [
      { id: 'marketplace_seller', label: 'Sprzedaż na marketplace' },
      { id: 'online_store', label: 'Sklep internetowy' },
      { id: 'handmade_online', label: 'Rękodzieło online' },
      { id: 'dropshipping_light', label: 'Sprzedaż online z małym magazynem' },
      { id: 'second_hand_online', label: 'Second hand online' },
      { id: 'cosmetics_online', label: 'Kosmetyki online' },
      { id: 'electronics_accessories_online', label: 'Akcesoria elektroniczne online' },
    ],
    assistantQuickPrompts: [
      'Które produkty mają niski stan?',
      'Co powinienem domówić do sklepu online?',
      'Które produkty zalegają w magazynie?',
      'Co najbardziej podrożało u dostawców?',
      'Pokaż faktury do weryfikacji',
    ],
    helperDescription: 'Kontroluj stany magazynowe i ceny dla sprzedaży online.',
    searchAliases: ['allegro', 'sklep online', 'ecommerce', 'marketplace', 'shopify', 'woocommerce', 'olx', 'wysyłka', 'kompletacja', 'e-commerce'],
  },
  {
    id: 'beauty',
    label: 'Uroda i beauty',
    icon: '💄',
    description: 'Salony fryzjerskie, kosmetyczne, barber, paznokcie, tatuaż i SPA.',
    subcategories: [
      { id: 'barber_shop', label: 'Barber shop' },
      { id: 'hair_salon', label: 'Salon fryzjerski' },
      { id: 'beauty_salon', label: 'Salon kosmetyczny' },
      { id: 'nails_studio', label: 'Paznokcie / stylizacja' },
      { id: 'tattoo_studio', label: 'Studio tatuażu' },
      { id: 'massage_studio', label: 'Gabinet masażu' },
      { id: 'spa_salon', label: 'SPA' },
      { id: 'solarium', label: 'Solarium' },
      { id: 'eyelash_brow_studio', label: 'Rzęsy / brwi' },
    ],
    assistantQuickPrompts: [
      'Które kosmetyki trzeba domówić?',
      'Które produkty do odsprzedaży mają niski stan?',
      'Co najbardziej podrożało u dostawców?',
      'Czy mam zapas produktów jednorazowych?',
      'Pokaż faktury do weryfikacji',
    ],
    helperDescription: 'Pilnuj zapasów kosmetyków, materiałów jednorazowych i produktów do sprzedaży.',
    searchAliases: ['fryzjer', 'kosmetyczka', 'paznokcie', 'barber', 'salon', 'spa', 'masaż', 'tatuaż', 'stylizacja', 'beauty', 'uroda'],
  },
  {
    id: 'floristry_decor',
    label: 'Kwiaciarnia i dekoracje',
    icon: '🌸',
    description: 'Kwiaciarnie, pracownie florystyczne, sklepy z dekoracjami.',
    subcategories: [
      { id: 'flower_shop', label: 'Kwiaciarnia' },
      { id: 'floristry_studio', label: 'Pracownia florystyczna' },
      { id: 'decoration_store', label: 'Sklep z dekoracjami' },
      { id: 'event_decor', label: 'Dekoracje eventowe' },
    ],
    assistantQuickPrompts: [
      'Które produkty mają niski stan?',
      'Co trzeba domówić przed sezonem?',
      'Które kwiaty lub dekoracje zalegają?',
      'Co podrożało u dostawców?',
      'Pokaż faktury do weryfikacji',
    ],
    helperDescription: 'Zarządzaj zapasami kwiatów, dekoracji i materiałów sezonowych.',
    searchAliases: ['kwiaty', 'dekoracje', 'florystyka', 'kwiaciarnia', 'bukiety', 'kompozycje', 'ślub', 'event', 'ozdoby'],
  },
  {
    id: 'hospitality',
    label: 'Hotelarstwo i apartamenty',
    icon: '🏨',
    description: 'Hotele, apartamenty, hostele, pensjonaty i obiekty sezonowe.',
    subcategories: [
      { id: 'hotel', label: 'Hotel' },
      { id: 'short_term_rental', label: 'Apartamenty / wynajem krótkoterminowy' },
      { id: 'hostel', label: 'Hostel' },
      { id: 'guesthouse', label: 'Pensjonat' },
      { id: 'seasonal_property', label: 'Obiekt sezonowy' },
      { id: 'restaurant_hotel_combined', label: 'Hotel z gastronomią' },
      { id: 'camping_resort', label: 'Camping / ośrodek wypoczynkowy' },
    ],
    assistantQuickPrompts: [
      'Czy wystarczy chemii i pościeli?',
      'Co trzeba domówić do obiektu?',
      'Które środki czystości podrożały?',
      'Pokaż niskie stany wyposażenia',
      'Pokaż faktury do weryfikacji',
    ],
    helperDescription: 'Kontroluj zapasy chemii, pościeli, ręczników i wyposażenia obiektu.',
    searchAliases: ['apartamenty', 'wynajem', 'pensjonat', 'hotel', 'hostel', 'noclegi', 'airbnb', 'booking', 'turystyka', 'obiekt'],
  },
  {
    id: 'workshop_service',
    label: 'Warsztat i serwis',
    icon: '🔧',
    description: 'Warsztaty samochodowe, rowerowe, serwisy IT/GSM i firmy instalacyjne.',
    subcategories: [
      { id: 'car_workshop', label: 'Warsztat samochodowy' },
      { id: 'bike_workshop', label: 'Warsztat rowerowy' },
      { id: 'it_gsm_service', label: 'Serwis IT / GSM' },
      { id: 'technical_service', label: 'Serwis techniczny' },
      { id: 'installation_company', label: 'Firma instalacyjna' },
      { id: 'electronics_repair', label: 'Naprawa elektroniki' },
      { id: 'home_appliance_repair', label: 'Naprawa AGD' },
      { id: 'car_detailing', label: 'Auto detailing' },
    ],
    assistantQuickPrompts: [
      'Których części lub materiałów brakuje?',
      'Co trzeba domówić do serwisu?',
      'Które materiały eksploatacyjne mają niski stan?',
      'Co najbardziej podrożało u dostawców?',
      'Pokaż faktury do weryfikacji',
    ],
    helperDescription: 'Pilnuj części, materiałów eksploatacyjnych i stanów w serwisie.',
    searchAliases: ['warsztat', 'serwis', 'mechanik', 'rower', 'IT', 'GSM', 'naprawa', 'instalacja', 'elektryk', 'hydraulik'],
  },
  {
    id: 'cleaning_facility',
    label: 'Sprzątanie i obsługa obiektów',
    icon: '🧹',
    description: 'Firmy sprzątające, obsługa apartamentów, biur i pralnie.',
    subcategories: [
      { id: 'cleaning_company', label: 'Firma sprzątająca' },
      { id: 'apartment_service', label: 'Obsługa apartamentów' },
      { id: 'office_service', label: 'Obsługa biur' },
      { id: 'laundry', label: 'Pralnia' },
      { id: 'facility_maintenance', label: 'Utrzymanie techniczne' },
      { id: 'window_cleaning', label: 'Mycie okien' },
      { id: 'industrial_cleaning', label: 'Sprzątanie przemysłowe' },
    ],
    assistantQuickPrompts: [
      'Czy wystarczy chemii na najbliższe zlecenia?',
      'Które środki czystości mają niski stan?',
      'Czy mamy zapas rękawiczek i worków?',
      'Co podrożało u dostawców?',
      'Pokaż faktury do weryfikacji',
    ],
    helperDescription: 'Kontroluj zapasy chemii, rękawiczek, worków i środków czystości.',
    searchAliases: ['sprzątanie', 'pralnia', 'cleaning', 'housekeeping', 'czystość', 'firma sprzątająca', 'biuro', 'obiekt'],
  },
  {
    id: 'production_craft',
    label: 'Produkcja i rzemiosło',
    icon: '🏭',
    description: 'Małe produkcje, drukarnie, stolarnie, szwalnie i rękodzieło.',
    subcategories: [
      { id: 'small_production', label: 'Mała produkcja' },
      { id: 'print_shop', label: 'Drukarnia' },
      { id: 'handmade_workshop', label: 'Pracownia rękodzieła' },
      { id: 'carpentry', label: 'Stolarnia' },
      { id: 'sewing_workshop', label: 'Szwalnia' },
      { id: 'local_manufacturer', label: 'Producent lokalny' },
    ],
    assistantQuickPrompts: [
      'Których surowców brakuje?',
      'Co trzeba domówić do pracowni?',
      'Które materiały mają niski stan?',
      'Które materiały podrożały?',
      'Pokaż faktury do weryfikacji',
    ],
    helperDescription: 'Zarządzaj surowcami, półproduktami i materiałami do produkcji.',
    searchAliases: ['drukarnia', 'stolarnia', 'szycie', 'handmade', 'rękodzieło', 'produkcja', 'szwalnia', 'meble', 'drewno'],
  },
  {
    id: 'construction',
    label: 'Budownictwo',
    icon: '🏗',
    description: 'Składy budowlane, firmy remontowe, wykończeniowe i instalacyjne.',
    subcategories: [
      { id: 'building_materials_store', label: 'Skład budowlany' },
      { id: 'renovation_company', label: 'Firma remontowa' },
      { id: 'finishing_company', label: 'Firma wykończeniowa' },
      { id: 'installation_services', label: 'Instalacje' },
      { id: 'construction_materials', label: 'Materiały budowlane' },
    ],
    assistantQuickPrompts: [
      'Których materiałów brakuje?',
      'Co trzeba domówić na projekt?',
      'Które materiały budowlane podrożały?',
      'Pokaż niskie stany narzędzi i materiałów',
      'Pokaż faktury do weryfikacji',
    ],
    helperDescription: 'Pilnuj materiałów budowlanych, narzędzi i zapasów na projekty.',
    searchAliases: ['budowa', 'remont', 'wykończenie', 'materiały budowlane', 'skład', 'płytki', 'farby', 'cement', 'instalacje'],
  },
  {
    id: 'health_care',
    label: 'Zdrowie, gabinety i opieka',
    icon: '⚕',
    description: 'Gabinety stomatologiczne, medyczne, weterynaryjne, fizjoterapia i optyka.',
    subcategories: [
      { id: 'dental_office', label: 'Gabinet stomatologiczny' },
      { id: 'physiotherapy_office', label: 'Fizjoterapia' },
      { id: 'medical_office', label: 'Gabinet medyczny' },
      { id: 'veterinary_office', label: 'Weterynaria' },
      { id: 'optical_store', label: 'Optyk' },
      { id: 'care_home', label: 'Dom opieki' },
      { id: 'wellness_clinic', label: 'Klinika wellness' },
    ],
    assistantQuickPrompts: [
      'Których materiałów jednorazowych brakuje?',
      'Co ma niski stan w gabinecie?',
      'Które produkty wymagają uzupełnienia?',
      'Co trzeba domówić przed kolejnym tygodniem?',
      'Co podrożało u dostawców?',
    ],
    helperDescription: 'Kontroluj materiały jednorazowe, środki dezynfekcji i zapasy gabinetu.',
    searchAliases: ['gabinet', 'stomatolog', 'fizjo', 'weterynarz', 'optyk', 'lekarz', 'klinika', 'przychodnia', 'apteka', 'medyczny'],
  },
  {
    id: 'fitness_recreation',
    label: 'Sport i rekreacja',
    icon: '🏋',
    description: 'Siłownie, kluby sportowe, szkoły tańca, baseny i wypożyczalnie sprzętu.',
    subcategories: [
      { id: 'gym_fitness_club', label: 'Siłownia / klub fitness' },
      { id: 'sports_club', label: 'Klub sportowy' },
      { id: 'dance_school', label: 'Szkoła tańca' },
      { id: 'equipment_rental', label: 'Wypożyczalnia sprzętu' },
      { id: 'swimming_pool_spa', label: 'Basen / spa' },
      { id: 'recreation_facility', label: 'Obiekt rekreacyjny' },
    ],
    assistantQuickPrompts: [
      'Czy mamy zapas środków czystości?',
      'Które produkty do sprzedaży mają niski stan?',
      'Co trzeba domówić do obiektu?',
      'Które akcesoria wymagają uzupełnienia?',
      'Co najbardziej podrożało?',
    ],
    helperDescription: 'Zarządzaj zapasami sprzętu, środków czystości i akcesoriów w obiekcie.',
    searchAliases: ['siłownia', 'klub', 'wypożyczalnia', 'rowery', 'sport', 'basen', 'taniec', 'fitness', 'joga', 'trening'],
  },
]

const _byId = Object.fromEntries(BUSINESS_CATEGORIES.map(c => [c.id, c]))
const _general = _byId['general']

export function getCategoryById(id) {
  return _byId[id] || _general
}

export function getSubcategoriesFor(categoryId) {
  return getCategoryById(categoryId).subcategories
}

export function getQuickPromptsFor(categoryId) {
  return getCategoryById(categoryId).assistantQuickPrompts
}

export function getCategoryLabel(id) {
  return getCategoryById(id).label
}

export function getHelperDescriptionFor(categoryId) {
  return getCategoryById(categoryId).helperDescription
}

const FIRST_USE_FLOWS = {
  general: {
    title: 'Skonfiguruj podstawowy magazyn',
    steps: [
      { id: 'add_warehouse', label: 'Dodaj pierwszy magazyn', description: 'Utwórz magazyn, np. główny, zapasowy.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'add_product', label: 'Dodaj pierwszy produkt', description: 'Dodaj towary, które chcesz śledzić.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_contractor', label: 'Dodaj kontrahenta', description: 'Dodaj dostawcę lub odbiorcę.', route: '/kontrahenci', ctaLabel: 'Dodaj kontrahenta', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj pierwszą fakturę', description: 'Wgraj fakturę zakupową.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź Alerty', description: 'Zobacz rekomendacje asystenta.', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  gastronomy: {
    title: 'Przygotuj gastronomię do pracy',
    steps: [
      { id: 'add_warehouse', label: 'Dodaj magazyn kuchni', description: 'Utwórz magazyn np. kuchnia, bar, chłodnia.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'add_product', label: 'Dodaj składniki', description: 'Dodaj produkty spożywcze i składniki.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_contractor', label: 'Dodaj dostawcę żywności', description: 'Dodaj hurtownię lub dostawcę.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj fakturę od dostawcy', description: 'Wgraj pierwszą fakturę zakupową.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź braki składników', description: 'Zobacz co kończy się w kuchni.', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  retail: {
    title: 'Ustaw kontrolę sprzedaży',
    steps: [
      { id: 'add_product', label: 'Dodaj produkty', description: 'Dodaj towary ze sklepu.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_contractor', label: 'Dodaj dostawcę', description: 'Dodaj hurtownię lub producenta.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj fakturę zakupową', description: 'Dodaj fakturę, żeby śledzić ceny.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'add_warehouse', label: 'Dodaj magazyn sklepu', description: 'Utwórz magazyn np. sklep, zaplecze.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'check_alerts', label: 'Sprawdź niskie stany', description: 'Zobacz produkty do domówienia.', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  ecommerce: {
    title: 'Przygotuj kompletację zamówień',
    steps: [
      { id: 'add_product', label: 'Dodaj produkty z SKU', description: 'Dodaj towary do sprzedaży online.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_warehouse', label: 'Dodaj magazyn wysyłkowy', description: 'Utwórz magazyn do kompletacji.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'add_contractor', label: 'Dodaj dostawcę', description: 'Dodaj źródło zaopatrzenia.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj fakturę', description: 'Śledź ceny zakupu.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź braki do wysyłki', description: 'Zobacz co trzeba domówić.', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  beauty: {
    title: 'Ustaw zużycie produktów na zabiegi',
    steps: [
      { id: 'add_product', label: 'Dodaj produkty kosmetyczne', description: 'Dodaj kosmetyki, materiały jednorazowe.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_contractor', label: 'Dodaj dostawcę kosmetyków', description: 'Dodaj hurtownię beauty.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'add_warehouse', label: 'Dodaj magazyn salonu', description: 'Utwórz magazyn np. salon, zaplecze.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'upload_invoice', label: 'Wgraj fakturę', description: 'Śledź ceny produktów.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź co się kończy', description: 'Zobacz produkty do domówienia.', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  floristry_decor: {
    title: 'Przygotuj kompozycje i świeżość produktów',
    steps: [
      { id: 'add_product', label: 'Dodaj kwiaty i dodatki', description: 'Dodaj kwiaty, zielone, wstążki, papier.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_contractor', label: 'Dodaj dostawcę kwiatów', description: 'Dodaj hurtownię florystyczną.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'add_warehouse', label: 'Dodaj magazyn kwiaciarni', description: 'Utwórz magazyn np. chłodnia, sklep.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'upload_invoice', label: 'Wgraj fakturę', description: 'Śledź ceny dostaw.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź produkty krótkoterminowe', description: 'Co może się zmarnować?', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  hospitality: {
    title: 'Przygotuj obsługę apartamentów',
    steps: [
      { id: 'add_warehouse', label: 'Dodaj magazyn środków czystości', description: 'Utwórz magazyn np. magazyn chemii.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'add_product', label: 'Dodaj produkty: ręczniki, pościel, chemia', description: 'Dodaj wszystko co zużywasz w obiektach.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_contractor', label: 'Dodaj dostawcę', description: 'Dodaj hurtownię chemii lub tekstyliów.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj fakturę', description: 'Śledź koszty zakupów.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź braki przed sprzątaniem', description: 'Co trzeba domówić?', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  cleaning_facility: {
    title: 'Zbuduj pierwszy pakiet sprzątania',
    steps: [
      { id: 'add_product', label: 'Dodaj środki czystości', description: 'Dodaj chemię, rękawiczki, worki.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_warehouse', label: 'Dodaj magazyn', description: 'Utwórz magazyn środków.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'add_contractor', label: 'Dodaj dostawcę chemii', description: 'Dodaj hurtownię.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj fakturę', description: 'Śledź koszty środków.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź braki', description: 'Co trzeba domówić na zlecenia?', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  workshop_service: {
    title: 'Przygotuj zlecenia serwisowe',
    steps: [
      { id: 'add_product', label: 'Dodaj części i materiały', description: 'Dodaj części zamienne, oleje, filtry.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_warehouse', label: 'Dodaj magazyn warsztatu', description: 'Utwórz magazyn np. warsztat, regał.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'add_contractor', label: 'Dodaj dostawcę części', description: 'Dodaj hurtownię motoryzacyjną.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj fakturę', description: 'Śledź ceny części.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź brakujące części', description: 'Co blokuje zlecenia?', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  production_craft: {
    title: 'Zbuduj pierwszą recepturę produkcyjną',
    steps: [
      { id: 'add_product', label: 'Dodaj materiały i surowce', description: 'Dodaj drewno, tkaninę, farbę, klej.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_warehouse', label: 'Dodaj magazyn materiałów', description: 'Utwórz magazyn np. pracownia, skład.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'add_contractor', label: 'Dodaj dostawcę surowców', description: 'Dodaj źródło materiałów.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj fakturę', description: 'Śledź koszty materiałów.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź braki materiałowe', description: 'Co blokuje produkcję?', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  construction: {
    title: 'Przygotuj materiały na budowę',
    steps: [
      { id: 'add_product', label: 'Dodaj materiały budowlane', description: 'Dodaj cement, płytki, farby, narzędzia.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_warehouse', label: 'Dodaj magazyn budowy', description: 'Utwórz magazyn np. plac budowy, skład.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'add_contractor', label: 'Dodaj dostawcę materiałów', description: 'Dodaj skład budowlany, hurtownię.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj fakturę', description: 'Śledź koszty materiałów.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź braki na budowie', description: 'Co może opóźnić realizację?', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  health_care: {
    title: 'Ustaw kontrolę materiałów gabinetowych',
    steps: [
      { id: 'add_product', label: 'Dodaj materiały jednorazowe', description: 'Dodaj rękawiczki, maseczki, igły, leki.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_warehouse', label: 'Dodaj magazyn gabinetu', description: 'Utwórz magazyn np. gabinet, magazyn.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'add_contractor', label: 'Dodaj dostawcę medycznego', description: 'Dodaj hurtownię medyczną.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj fakturę', description: 'Śledź koszty materiałów.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź krótkie daty i braki', description: 'Co się kończy w gabinecie?', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
  fitness_recreation: {
    title: 'Skontroluj sprzęt i wypożyczenia',
    steps: [
      { id: 'add_product', label: 'Dodaj sprzęt', description: 'Dodaj piłki, maty, hantle, rowery.', route: '/towary', ctaLabel: 'Dodaj produkt', detection: 'products' },
      { id: 'add_warehouse', label: 'Dodaj magazyn sprzętu', description: 'Utwórz magazyn np. siłownia, wypożyczalnia.', route: '/magazyny', ctaLabel: 'Dodaj magazyn', detection: 'warehouses' },
      { id: 'add_contractor', label: 'Dodaj dostawcę sprzętu', description: 'Dodaj hurtownię sportową.', route: '/kontrahenci', ctaLabel: 'Dodaj dostawcę', detection: 'contractors' },
      { id: 'upload_invoice', label: 'Wgraj fakturę', description: 'Śledź koszty zakupów.', route: '/faktury', ctaLabel: 'Wgraj fakturę', detection: 'invoices' },
      { id: 'check_alerts', label: 'Sprawdź stan sprzętu', description: 'Co wymaga uwagi?', route: '/alerty', ctaLabel: 'Sprawdź alerty', detection: null },
    ],
  },
}

export function getFirstUseFlowFor(categoryId) {
  return FIRST_USE_FLOWS[categoryId] || FIRST_USE_FLOWS.general
}
