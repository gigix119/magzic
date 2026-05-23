import { useState } from 'react'
import { exportInvoiceLearningData, importInvoiceLearningData, getInvoiceTrainingExamples, exportAllInvoiceLearningData, importAllInvoiceLearningData, clearAllInvoiceLearningData } from '../utils/invoiceLearning'
import { exportGoldenSamples, importGoldenSamples, getGoldenSamples, clearGoldenSamples } from '../utils/invoiceGoldenSamples'
import { getCorrectionEvents, exportCorrectionEvents, clearCorrectionEvents, getCorrectionStats } from '../utils/invoiceCorrectionTracker'

export default function InvoiceLearningDebugPanel() {
  const [testResult, setTestResult] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const learningData = (() => {
    try {
      const aliases = JSON.parse(localStorage.getItem('magzic_product_aliases') || '{}')
      const supplierMappings = JSON.parse(localStorage.getItem('magzic_supplier_item_mappings') || '{}')
      const prices = JSON.parse(localStorage.getItem('magzic_typical_prices') || '{}')
      return {
        aliasCount: Object.keys(aliases).length,
        supplierCount: Object.keys(supplierMappings).length,
        priceCount: Object.keys(prices).length,
      }
    } catch { return { aliasCount: 0, supplierCount: 0, priceCount: 0 } }
  })()

  const corrStats = getCorrectionStats()
  const goldenCount = getGoldenSamples().length
  const trainingCount = getInvoiceTrainingExamples().length

  function download(data, filename) {
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportAll = () => download(exportAllInvoiceLearningData(), `magzic-all-learning-${Date.now()}.json`)
  const handleExportLearning = () => download(exportInvoiceLearningData(), `magzic-learning-${Date.now()}.json`)
  const handleExportGolden = () => download(exportGoldenSamples(), `magzic-golden-${Date.now()}.json`)
  const handleExportCorrections = () => download(exportCorrectionEvents(), `magzic-corrections-${Date.now()}.json`)

  const handleImportAll = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const result = importAllInvoiceLearningData(text)
    if (result.success) {
      const counts = Object.entries(result.importedCounts || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
      alert('Import OK — ' + (counts || 'brak zmian'))
    } else {
      alert('Błąd: ' + result.error)
    }
    e.target.value = ''
  }

  const handleImportGolden = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const result = importGoldenSamples(text)
    alert(result.success ? `Zaimportowano ${result.count} sampli` : 'Błąd: ' + result.error)
    e.target.value = ''
  }

  const handleClearGolden = () => {
    if (!window.confirm('Wyczyścić wszystkie golden samples?')) return
    clearGoldenSamples()
    alert('Golden samples wyczyszczone')
  }

  const handleClear = () => {
    if (!window.confirm('Wyczyścić WSZYSTKIE dane uczące (aliasy, mappingi, ceny, przykłady treningowe, korekty, golden samples)?')) return
    clearAllInvoiceLearningData()
    alert('Wszystkie dane wyczyszczone')
  }

  const handleRunTests = async () => {
    try {
      const module = await import('../utils/invoiceParserSelfTest.js')
      if (module.runInvoiceParserSelfTest) {
        const result = await module.runInvoiceParserSelfTest()
        setTestResult(result)
      } else {
        setTestResult({ passed: 0, failed: 0, total: 0, failures: ['Brak eksportowanej funkcji runInvoiceParserSelfTest'], results: [] })
      }
    } catch (e) {
      setTestResult({ passed: 0, failed: 0, total: 0, failures: [String(e)], results: [] })
    }
  }

  const stats = [
    { label: 'Aliasy produktów', value: learningData.aliasCount },
    { label: 'Mappingi dostawców', value: learningData.supplierCount },
    { label: 'Historie cen', value: learningData.priceCount },
    { label: 'Zdarzenia korekt', value: corrStats.totalEvents },
    { label: 'Korekty łącznie', value: corrStats.totalCorrections },
    { label: 'Golden samples', value: goldenCount },
    { label: 'Przykłady treningowe', value: trainingCount },
  ]

  return (
    <div style={{ margin: '16px 0', border: '2px dashed #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '8px 16px', background: '#f1f5f9', border: 'none',
          textAlign: 'left', cursor: 'pointer', fontSize: 12, color: '#64748b', fontWeight: 500,
        }}
      >
        🔧 Panel deweloperski — dane uczące parsera{expanded ? ' ▲' : ' ▼'}
      </button>

      {expanded && (
        <div style={{ padding: 16, fontSize: 12 }}>
          {/* Statystyki */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {stats.map(({ label, value }) => (
              <div key={label} style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
                <div style={{ color: '#64748b', fontSize: 11 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Przyciski eksportu/importu */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={handleExportAll} style={btnStyle('#1e3a5f')}>⬇️ Eksportuj wszystko</button>
            <label style={{ ...btnStyle('#1e3a5f'), cursor: 'pointer' }}>
              ⬆️ Importuj wszystko
              <input type="file" accept=".json" onChange={handleImportAll} style={{ display: 'none' }} />
            </label>
            <button onClick={handleExportLearning} style={btnStyle('#3b82f6')}>⬇️ Learning</button>
            <button onClick={handleExportGolden} style={btnStyle('#059669')}>⬇️ Golden samples</button>
            <button onClick={handleExportCorrections} style={btnStyle('#7c3aed')}>⬇️ Korekty</button>
            <label style={{ ...btnStyle('#047857'), cursor: 'pointer' }}>
              ⬆️ Importuj golden
              <input type="file" accept=".json" onChange={handleImportGolden} style={{ display: 'none' }} />
            </label>
            <button onClick={handleRunTests} style={btnStyle('#d97706')}>▶️ Self-test parsera</button>
            <button onClick={handleClearGolden} style={btnStyle('#b45309')}>🗑️ Wyczyść golden</button>
            <button onClick={handleClear} style={btnStyle('#dc2626')}>🗑️ Wyczyść wszystko</button>
          </div>

          {/* Wynik testów */}
          {testResult && (
            <div style={{
              marginTop: 12, padding: 10,
              background: testResult.failed === 0 ? '#f0fdf4' : '#fef2f2',
              borderRadius: 6, fontSize: 11,
            }}>
              <strong>Testy: {testResult.passed}/{testResult.total} passed</strong>
              {testResult.failed > 0 && (
                <div style={{ marginTop: 4, color: '#dc2626' }}>
                  {testResult.failures?.map((f, i) => (
                    <div key={i}>❌ {typeof f === 'string' ? f : `${f.name}: ${f.message}`}</div>
                  ))}
                </div>
              )}
              {testResult.results?.length > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: 'pointer', color: '#64748b' }}>Wszystkie testy ({testResult.results.length})</summary>
                  <div style={{ marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {testResult.results.map((r, i) => (
                      <div key={i} style={{ color: r.passed ? '#16a34a' : '#dc2626' }}>
                        {r.passed ? '✅' : '❌'} {r.name}{!r.passed && r.message ? ` — ${r.message}` : ''}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Najczęstsze korekty */}
          {corrStats.mostCommon?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong style={{ fontSize: 11 }}>Najczęstsze korekty:</strong>
              {corrStats.mostCommon.map(({ type, count }) => (
                <div key={type} style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {type}: {count}×
                </div>
              ))}
            </div>
          )}

          {/* Instrukcja */}
          <div style={{ marginTop: 12, padding: 10, background: '#f0f9ff', borderRadius: 6, fontSize: 11, color: '#0369a1' }}>
            <strong>Jak poprawić skuteczność odczytu:</strong>
            <ol style={{ margin: '4px 0 0 16px' }}>
              <li>Dodaj 3–5 faktur od tego samego dostawcy</li>
              <li>Po każdym odczycie popraw pozycje i zatwierdź</li>
              <li>Przypisuj rawName do właściwych towarów</li>
              <li>Oznaczaj czy pozycja wpływa na magazyn (Towar vs Usługa)</li>
              <li>Golden samples są ważniejsze niż same PDF-y — zapisuj wzorcowe faktury</li>
              <li>Eksportuj learning data raz na miesiąc</li>
              <li>Dla skanów potrzebny będzie OCR/server-side</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

const btnStyle = (bg) => ({
  padding: '6px 12px', background: bg, color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer',
  fontSize: 11, fontWeight: 500,
})
