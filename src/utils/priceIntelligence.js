import { similarityScore } from './productNormalizer'

const CACHE_TTL = 5 * 60 * 1000

export async function getPriceHistoryCached(towarId, supabase) {
  const key = `price_history_${towarId}`
  try {
    const cached = sessionStorage.getItem(key)
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_TTL) return data
    }
  } catch { /* sessionStorage may be unavailable */ }

  const data = await getPriceHistory(towarId, supabase)
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch { /* ignore quota errors */ }
  return data
}

export async function getPriceHistory(towarId, supabase) {
  const { data, error } = await supabase
    .from('pozycje_faktury')
    .select(`
      ilosc, cena_netto,
      faktury!inner(
        id, numer, data_zakupu, status, kontrahent_id,
        kontrahenci(nazwa)
      )
    `)
    .eq('towar_id', towarId)
    .eq('faktury.status', 'zatwierdzona')
    .order('faktury(data_zakupu)', { ascending: false })
    .limit(20)

  if (error) {
    console.error('getPriceHistory:', error)
    return []
  }
  return data || []
}

export function analyzePriceHistory(history) {
  if (!history.length) return null

  const ceny = history.map(h => Number(h.cena_netto))
  const srednia = ceny.reduce((a, b) => a + b, 0) / ceny.length
  const ostatnia = ceny[0]
  const poprzednia = ceny[1] ?? null
  const najnizsza = Math.min(...ceny)
  const najwyzsza = Math.max(...ceny)

  const perDostawca = {}
  history.forEach(h => {
    const nazwa = h.faktury?.kontrahenci?.nazwa || 'Nieznany'
    if (!perDostawca[nazwa]) perDostawca[nazwa] = []
    perDostawca[nazwa].push(Number(h.cena_netto))
  })

  const dostawcy = Object.entries(perDostawca)
    .map(([nazwa, cenyD]) => ({
      nazwa,
      sredniaCena: cenyD.reduce((a, b) => a + b, 0) / cenyD.length,
      liczbaZakupow: cenyD.length,
    }))
    .sort((a, b) => a.sredniaCena - b.sredniaCena)

  return {
    ostatniaCena: ostatnia,
    poprzedniaCena: poprzednia,
    sredniaCena: srednia,
    najnizszaCena: najnizsza,
    najwyzszaCena: najwyzsza,
    najlepszyDostawca: dostawcy[0] ?? null,
    wszyscyDostawcy: dostawcy,
  }
}

export function generatePriceAlerts(item, history, aktualnyKontrahent) {
  const alerts = []
  if (!history) return alerts

  const { ostatniaCena, sredniaCena, najlepszyDostawca } = history
  const cena = item.unitPriceNet ?? item.cena_netto
  if (!cena) return alerts

  if (ostatniaCena && cena > ostatniaCena * 1.1) {
    const roznica = ((cena - ostatniaCena) / ostatniaCena * 100).toFixed(1)
    alerts.push({
      type: 'price_increase',
      severity: roznica > 30 ? 'high' : 'medium',
      title: 'Cena wyższa niż ostatnio',
      description: `Cena wzrosła o ${roznica}% względem ostatniego zakupu (${ostatniaCena.toFixed(2)} zł).`,
      actionLabel: 'Sprawdź historię',
    })
  }

  if (ostatniaCena && cena < ostatniaCena * 0.9) {
    const roznica = ((ostatniaCena - cena) / ostatniaCena * 100).toFixed(1)
    alerts.push({
      type: 'price_drop',
      severity: 'low',
      title: 'Cena niższa niż ostatnio',
      description: `Cena spadła o ${roznica}% — dobra okazja.`,
      actionLabel: 'OK',
    })
  }

  if (
    najlepszyDostawca &&
    najlepszyDostawca.nazwa !== aktualnyKontrahent &&
    cena > najlepszyDostawca.sredniaCena * 1.05
  ) {
    const roznica = (cena - najlepszyDostawca.sredniaCena).toFixed(2)
    const proc = ((cena - najlepszyDostawca.sredniaCena) / najlepszyDostawca.sredniaCena * 100).toFixed(1)
    alerts.push({
      type: 'cheaper_supplier',
      severity: 'medium',
      title: 'Tańszy dostawca dostępny',
      description: `${najlepszyDostawca.nazwa} oferował średnio ${najlepszyDostawca.sredniaCena.toFixed(2)} zł/szt — o ${roznica} zł (${proc}%) taniej.`,
      actionLabel: 'Porównaj dostawców',
    })
  }

  if (sredniaCena && Math.abs(cena - sredniaCena) > sredniaCena * 0.5) {
    alerts.push({
      type: 'price_anomaly',
      severity: 'high',
      title: 'Podejrzana cena',
      description: `Cena ${cena.toFixed(2)} zł znacznie odbiega od średniej ${sredniaCena.toFixed(2)} zł. Sprawdź jednostkę.`,
      actionLabel: 'Sprawdź',
    })
  }

  return alerts
}

export async function buildPriceAlertsForRecentInvoices(supabase) {
  const alerts = []

  const { data: pozycje, error } = await supabase
    .from('pozycje_faktury')
    .select(`
      id, towar_id, cena_netto, ilosc,
      towary(nazwa),
      faktury!inner(
        id, numer, data_zakupu, status,
        kontrahenci(nazwa)
      )
    `)
    .eq('faktury.status', 'zatwierdzona')
    .order('faktury(data_zakupu)', { ascending: false })
    .limit(200)

  if (error) {
    console.error('buildPriceAlertsForRecentInvoices:', error)
    return []
  }

  // Group by towar to compare per-product
  const byTowar = {}
  for (const p of pozycje || []) {
    if (!byTowar[p.towar_id]) byTowar[p.towar_id] = []
    byTowar[p.towar_id].push(p)
  }

  for (const [towarId, history] of Object.entries(byTowar)) {
    if (history.length < 2) continue

    const analyzed = analyzePriceHistory(history)
    if (!analyzed) continue

    const latest = history[0]
    const kontrahentAktualny = latest.faktury?.kontrahenci?.nazwa || ''
    const itemForAlert = { cena_netto: Number(latest.cena_netto) }
    const priceAlerts = generatePriceAlerts(itemForAlert, analyzed, kontrahentAktualny)

    for (const alert of priceAlerts) {
      alerts.push({
        ...alert,
        towarId,
        towarNazwa: latest.towary?.nazwa || '—',
        fakturaNumer: latest.faktury?.numer || '—',
        fakturaData: latest.faktury?.data_zakupu || '—',
        kontrahent: kontrahentAktualny,
        cenaAktualna: Number(latest.cena_netto),
        sredniaCena: analyzed.sredniaCena,
        ostatniaCena: analyzed.ostatniaCena,
      })
    }
  }

  // deduplicate: one alert per (towarId, type)
  const seen = new Set()
  return alerts.filter(a => {
    const key = `${a.towarId}-${a.type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Unused export kept for future use — finds similar products by name
export { similarityScore }
