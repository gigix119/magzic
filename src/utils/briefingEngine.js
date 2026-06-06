function pl(n, one, few, many) {
  if (n === 1) return `${n} ${one}`
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} ${few}`
  return `${n} ${many}`
}

const LOW_STOCK_DESC = {
  gastronomy: 'Składniki w kuchni kończą się — sprawdź przed zmianą.',
  retail: 'Produkty w sklepie wymagają uzupełnienia.',
  ecommerce: 'Produkty magazynowe mogą się wyczerpać przed wysyłką.',
  beauty: 'Kosmetyki i materiały kończą się w salonie.',
  floristry_decor: 'Kwiaty lub materiały florystyczne wymagają uzupełnienia.',
  hospitality: 'Środki czystości lub pościel wymagają uzupełnienia.',
  workshop_service: 'Części lub materiały eksploatacyjne wymagają uzupełnienia.',
  cleaning_facility: 'Środki czystości mogą nie wystarczyć na zlecenia.',
  production_craft: 'Surowce lub materiały do produkcji kończą się.',
  construction: 'Materiały budowlane wymagają uzupełnienia na projekcie.',
  health_care: 'Materiały jednorazowe lub środki dezynfekcji kończą się.',
  fitness_recreation: 'Środki czystości lub akcesoria wymagają uzupełnienia.',
}

const DEAD_STOCK_DESC = {
  gastronomy: 'Składniki nie są używane — możesz je usunąć z listy.',
  retail: 'Produkty zalegają — rozważ promocję lub zwrot.',
  ecommerce: 'Produkty zalegają w magazynie wysyłkowym.',
  beauty: 'Produkty nie schodzą — sprawdź czy są potrzebne.',
  floristry_decor: 'Kwiaty lub dekoracje zalegają — sprawdź aktualność.',
  hospitality: 'Wyposażenie nie jest używane od dłuższego czasu.',
  workshop_service: 'Części nie są używane — sprawdź zapotrzebowanie.',
  cleaning_facility: 'Środki zalegają — sprawdź zapotrzebowanie na zlecenia.',
  production_craft: 'Surowce lub materiały zalegają w pracowni.',
  construction: 'Materiały budowlane zalegają na placu.',
  health_care: 'Materiały gabinetowe bez ruchu — sprawdź daty ważności.',
  fitness_recreation: 'Sprzęt lub akcesoria nie są używane od dłuższego czasu.',
}

function getDesc(map, category) {
  return map[category] || 'Sprawdź produkty wymagające uwagi.'
}

export async function generateDailyBriefing(supabase, workspaceId, businessCategory) {
  if (!workspaceId) return { items: [], generatedAt: new Date() }

  try {
    const ago30 = new Date(Date.now() - 30 * 86400000).toISOString()

    const results = await Promise.allSettled([
      supabase.from('towary').select('id, stan_minimalny').eq('workspace_id', workspaceId).eq('aktywny', true),
      supabase.from('stany_magazynowe').select('towar_id, ilosc').eq('workspace_id', workspaceId),
      supabase.from('faktury').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'robocza'),
      supabase.from('ruchy_magazynowe').select('towar_id').eq('workspace_id', workspaceId).gte('created_at', ago30),
      supabase.from('alerty_cenowe_faktury').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('przeczytany', false).gt('roznica_procent', 10),
    ])

    const towaryData = results[0].status === 'fulfilled' ? (results[0].value.data || []) : []
    const stanyData = results[1].status === 'fulfilled' ? (results[1].value.data || []) : []
    const fakturyCount = results[2].status === 'fulfilled' ? (results[2].value.count || 0) : null
    const ruchyData = results[3].status === 'fulfilled' ? (results[3].value.data || []) : []
    const priceCount = results[4].status === 'fulfilled' ? (results[4].value.count || 0) : null

    const stockMap = {}
    for (const s of stanyData) {
      stockMap[s.towar_id] = (stockMap[s.towar_id] || 0) + Number(s.ilosc)
    }

    const recentIds = new Set(ruchyData.map(r => r.towar_id))

    let lowStockCount = 0
    let itemsToOrderCount = 0
    let deadStockCount = 0

    for (const t of towaryData) {
      const stan = stockMap[t.id] || 0
      const min = t.stan_minimalny

      if (min != null && stan <= min) {
        lowStockCount++
      } else if (min != null && stan > min && stan <= min * 1.5) {
        itemsToOrderCount++
      }

      if (stan > 0 && !recentIds.has(t.id)) {
        deadStockCount++
      }
    }

    const items = []

    if (lowStockCount > 0) {
      items.push({
        type: 'low_stock',
        priority: lowStockCount > 5 ? 'high' : 'medium',
        icon: '🔴',
        title: pl(lowStockCount, 'produkt ma niski stan', 'produkty mają niski stan', 'produktów ma niski stan'),
        description: getDesc(LOW_STOCK_DESC, businessCategory),
        count: lowStockCount,
        action: { label: 'Sprawdź niskie stany', route: '/alerty' },
      })
    }

    if (priceCount != null && priceCount > 0) {
      items.push({
        type: 'price_increase',
        priority: 'medium',
        icon: '🔔',
        title: pl(priceCount, 'produkt podrożał powyżej 10%', 'produkty podrożały powyżej 10%', 'produktów podrożało powyżej 10%'),
        description: 'Nowe alerty cenowe z zatwierdzonych faktur — sprawdź zmiany cen zakupu.',
        count: priceCount,
        action: { label: 'Zobacz zmiany cen', route: '/alerty' },
      })
    }

    if (fakturyCount != null && fakturyCount > 0) {
      items.push({
        type: 'invoice_review',
        priority: fakturyCount > 3 ? 'high' : 'medium',
        icon: '📄',
        title: pl(fakturyCount, 'faktura wymaga sprawdzenia', 'faktury wymagają sprawdzenia', 'faktur wymaga sprawdzenia'),
        description: 'Faktury robocze — zatwierdź lub uzupełnij brakujące dane.',
        count: fakturyCount,
        action: { label: 'Sprawdź faktury', route: '/faktury' },
      })
    }

    if (itemsToOrderCount > 0) {
      items.push({
        type: 'items_to_order',
        priority: 'medium',
        icon: '📋',
        title: `Domów ${pl(itemsToOrderCount, 'produkt', 'produkty', 'produktów')} zanim się skończy`,
        description: getDesc(LOW_STOCK_DESC, businessCategory).replace('kończą się', 'zbliżają się do minimum'),
        count: itemsToOrderCount,
        action: { label: 'Co zamówić?', route: '/alerty' },
      })
    }

    if (deadStockCount > 0) {
      items.push({
        type: 'dead_stock',
        priority: 'low',
        icon: '📦',
        title: pl(deadStockCount, 'produkt nie miał ruchu od 30 dni', 'produkty nie miały ruchu od 30 dni', 'produktów nie miało ruchu od 30 dni'),
        description: getDesc(DEAD_STOCK_DESC, businessCategory),
        count: deadStockCount,
        action: { label: 'Zobacz zalegające', route: '/towary' },
      })
    }

    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
    items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

    if (items.length === 0) {
      const hasTowary = towaryData.length > 0
      items.push({
        type: 'no_data',
        priority: 'low',
        icon: '🟢',
        title: hasTowary ? 'Wszystko OK — brak alertów' : 'Brak danych do analizy',
        description: hasTowary
          ? 'Stany magazynowe są w porządku. Nie ma nic pilnego do zrobienia.'
          : 'Dodaj produkty i faktury, a briefing zacznie działać automatycznie.',
        count: 0,
        action: { label: hasTowary ? 'Przejdź do magazynu' : 'Dodaj pierwszy produkt', route: '/towary' },
      })
    }

    return { items, generatedAt: new Date() }
  } catch (err) {
    console.error('generateDailyBriefing:', err)
    return { items: [], generatedAt: new Date(), error: true }
  }
}
