export async function generateWeeklyReport(supabase, workspaceId) {
  if (!workspaceId) return null

  const now = new Date()
  const weekAgo = new Date(now - 7 * 86400000)
  const twoWeeksAgo = new Date(now - 14 * 86400000)
  const thirtyDaysAgo = new Date(now - 30 * 86400000)

  const weekAgoDate = weekAgo.toISOString().slice(0, 10)
  const twoWeeksAgoDate = twoWeeksAgo.toISOString().slice(0, 10)
  const weekAgoTs = weekAgo.toISOString()
  const thirtyDaysAgoTs = thirtyDaysAgo.toISOString()

  const [
    currentSpendingRes,
    previousSpendingRes,
    newProductsRes,
    completedOrdersRes,
    newOrdersRes,
    towaryRes,
    stanyRes,
    ruchyRes,
    newInvoicesRes,
    priceAlertRes,
  ] = await Promise.allSettled([
    supabase.from('faktury').select('wartosc_netto').eq('workspace_id', workspaceId).gte('data_zakupu', weekAgoDate),
    supabase.from('faktury').select('wartosc_netto').eq('workspace_id', workspaceId).gte('data_zakupu', twoWeeksAgoDate).lt('data_zakupu', weekAgoDate),
    supabase.from('towary').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', weekAgoTs),
    supabase.from('zlecenia').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'gotowe').gte('updated_at', weekAgoTs),
    supabase.from('zlecenia').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', weekAgoTs),
    supabase.from('towary').select('id, stan_minimalny').eq('workspace_id', workspaceId).eq('aktywny', true),
    supabase.from('stany_magazynowe').select('towar_id, ilosc').eq('workspace_id', workspaceId),
    supabase.from('ruchy_magazynowe').select('towar_id').eq('workspace_id', workspaceId).gte('created_at', thirtyDaysAgoTs),
    supabase.from('faktury').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', weekAgoTs),
    supabase.from('alerty_cenowe_faktury').select('towar_nazwa, roznica_procent').eq('workspace_id', workspaceId).gte('created_at', weekAgoTs).gt('roznica_procent', 0).order('roznica_procent', { ascending: false }).limit(1),
  ])

  const currentFaktury = currentSpendingRes.status === 'fulfilled' ? (currentSpendingRes.value.data || []) : []
  const previousFaktury = previousSpendingRes.status === 'fulfilled' ? (previousSpendingRes.value.data || []) : []
  const currentSpending = currentFaktury.reduce((sum, f) => sum + (parseFloat(f.wartosc_netto) || 0), 0)
  const previousSpending = previousFaktury.reduce((sum, f) => sum + (parseFloat(f.wartosc_netto) || 0), 0)
  const spendingChange = previousSpending > 0 ? Math.round(((currentSpending - previousSpending) / previousSpending) * 100) : null

  const newProducts = newProductsRes.status === 'fulfilled' ? (newProductsRes.value.count || 0) : 0
  const completedOrders = completedOrdersRes.status === 'fulfilled' ? (completedOrdersRes.value.count || 0) : 0
  const newOrders = newOrdersRes.status === 'fulfilled' ? (newOrdersRes.value.count || 0) : 0

  const towaryData = towaryRes.status === 'fulfilled' ? (towaryRes.value.data || []) : []
  const stanyData = stanyRes.status === 'fulfilled' ? (stanyRes.value.data || []) : []
  const stockMap = {}
  for (const s of stanyData) {
    stockMap[s.towar_id] = (stockMap[s.towar_id] || 0) + Number(s.ilosc)
  }
  let lowStockCount = 0
  for (const t of towaryData) {
    if (t.stan_minimalny != null && (stockMap[t.id] || 0) <= t.stan_minimalny) lowStockCount++
  }

  const ruchyData = ruchyRes.status === 'fulfilled' ? (ruchyRes.value.data || []) : []
  const recentIds = new Set(ruchyData.map(r => r.towar_id))
  let deadStockCount = 0
  for (const t of towaryData) {
    if (!recentIds.has(t.id) && (stockMap[t.id] || 0) > 0) deadStockCount++
  }

  const newInvoices = newInvoicesRes.status === 'fulfilled' ? (newInvoicesRes.value.count || 0) : 0

  const priceAlerts = priceAlertRes.status === 'fulfilled' ? (priceAlertRes.value.data || []) : []
  const biggestPriceIncrease = priceAlerts.length > 0 ? {
    productName: priceAlerts[0].towar_nazwa,
    changePercent: Math.round(priceAlerts[0].roznica_procent),
  } : null

  return {
    period: { from: weekAgo, to: now },
    spending: { current: currentSpending, previous: previousSpending, changePercent: spendingChange },
    newProducts,
    biggestPriceIncrease,
    orders: { completed: completedOrders, new: newOrders },
    inventory: { lowStock: lowStockCount, deadStock: deadStockCount },
    newInvoices,
    generatedAt: now,
  }
}
