// Single source of truth for shared invoice signal/keyword constants.
// Imported by invoiceFeatureExtractor.js and invoiceDocumentClassifier.js.

export const TELECOM_SIGNALS = [
  'usługi telekomunikacyjne', 'abonament', 'p4 sp', 'play', 'orange',
  'numer konta klienta', 'twoje abonamenty', 'rozliczenie konta',
  'opłaty naliczone', 'rodzina m 5g', 'zapłać online', 'obsługa klienta',
]

export const UTILITY_SIGNALS = [
  'energia elektryczna', 'gaz', 'woda i ścieki', 'tauron',
  'pge', 'enea', 'energa', 'pgnig',
  'prąd elektryczny', 'zużycie energii', 'odczyt licznika',
  'innogy', 'e.on', 'polenergia', 'fortum',
]

export const INVENTORY_SIGNALS = [
  // Column headers / table structure signals
  'cena jednostkowa', 'cena netto j', 'cena jedn',
  'wartość netto', 'jm', 'j.m.', 'ilość szt',
  'indeks', 'symbol towaru', 'kod towaru', 'ean', 'indeks towaru',
  // Physical goods keywords
  'syfon', 'bateria', 'listwa', 'żarówka', 'worki', 'papier toaletowy',
  'clin', 'płyn do', 'silikon', 'kołki', 'śruby', 'wąż prysznicowy',
  'materiały budowlane', 'artykuł', 'opakowanie',
]

export const SERVICE_ITEM_KEYWORDS = [
  'usług', 'abonament', 'opłat', 'serwis', 'telekomunik', 'internet',
  'energia elektryczna', 'gaz ziemny', 'woda i ścieki',
  'licencj', 'subskrypcj', 'konsulting', 'doradztw', 'szkoleni',
]

// Lighter forbidden-line guard used by invoiceFeatureExtractor for scoring
export const FORBIDDEN_AS_ITEM_KEYWORDS = [
  'razem', 'suma', 'do zapłaty', 'wartość faktury',
  'prosimy o wpłatę', 'termin płatności',
  'forma płatności', 'numer konta', 'numer rachunku',
  'saldo końcowe', 'blankiet',
]

// Broader forbidden-line guard used by invoiceDocumentClassifier for hard-blocking
export const FORBIDDEN_AS_ITEM = [
  'razem', 'suma', 'do zapłaty', 'wartość faktury',
  'prosimy o wpłatę', 'zapłać online', 'termin płatności',
  'forma płatności', 'przelew', 'numer konta', 'numer rachunku',
  'obsługa klienta', 'zarządzaj kontem', 'twoje abonamenty',
  'rozliczenie konta', 'saldo końcowe', 'wpłata',
  'odcinek dla wpłacającego', 'opłać fakturę', 'zeskanuj kod',
  'tytułem', 'nazwa odbiorcy', 'abonament za okres',
  'opłaty naliczone w okresie', 'blankiet',
]

export const PAYMENT_KEYWORDS = [
  'przelew', 'numer konta', 'numer rachunku', 'iban',
  'termin płatności', 'forma płatności', 'zapłać online',
]

export const SUMMARY_KEYWORDS = ['razem', 'suma', 'do zapłaty', 'wartość faktury', 'razem netto']

export const INVENTORY_ITEM_KEYWORDS = [
  'syfon', 'bateria', 'listwa', 'żarówk', 'wiertł', 'wkręt', 'śrub',
  'klej', 'farb', 'papier', 'płyn', 'silikon', 'kołek', 'zawias',
  'rura', 'kran', 'uszczelk', 'opak', 'worek', 'rolka',
]

export const KNOWN_UNITS = new Set([
  'szt', 'szt.', 'kg', 'g', 'l', 'ml', 'm', 'm2', 'mb', 'kpl', 'kpl.',
  'opak', 'opak.', 'rolka', 'para', 'godz', 'godz.', 'usł', 'usł.',
  'litr', 'sztuka', 'sztuk',
])
