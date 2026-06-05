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
