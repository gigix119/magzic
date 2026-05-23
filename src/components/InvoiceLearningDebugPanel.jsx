import { useState } from 'react'
import {
  exportInvoiceLearningData,
  getInvoiceTrainingExamples, exportAllInvoiceLearningData,
  importAllInvoiceLearningData, clearAllInvoiceLearningData,
} from '../utils/invoiceLearning'
import { exportGoldenSamples, importGoldenSamples, getGoldenSamples, clearGoldenSamples } from '../utils/invoiceGoldenSamples'
import { exportCorrectionEvents, getCorrectionStats } from '../utils/invoiceCorrectionTracker'
import {
  getInvoiceModelConfig, setInvoiceModelMode,
  exportInvoiceModelConfig, importInvoiceModelConfig,
  resetInvoiceModelConfig,
} from '../utils/invoiceModelConfig'

export default function InvoiceLearningDebugPanel() {
  const [testResult, setTestResult] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [modelSection, setModelSection] = useState(false)
  const [evalResult, setEvalResult] = useState(null)
  const [evalRunning, setEvalRunning] = useState(false)
  const [trainRunning, setTrainRunning] = useState(false)
  const [trainResult, setTrainResult] = useState(null)
  const [modelConfig, setModelConfig] = useState(() => getInvoiceModelConfig())

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

  function refreshModelConfig() {
    setModelConfig(getInvoiceModelConfig())
  }

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

  // ── Model actions ──────────────────────────────────────────────

  const handleRunEval = async () => {
    setEvalRunning(true)
    setEvalResult(null)
    try {
      const { runInvoiceModelEvaluation, formatEvaluationReport } = await import('../utils/invoiceModelEvaluator.js')
      const result = runInvoiceModelEvaluation()
      const report = formatEvaluationReport(result)
      setEvalResult({ ...result, report })
    } catch (e) {
      setEvalResult({ error: String(e) })
    } finally {
      setEvalRunning(false)
    }
  }

  const handleTrain = async () => {
    setTrainRunning(true)
    setTrainResult(null)
    try {
      const { trainInvoiceModel } = await import('../utils/invoiceModelTrainer.js')
      const result = await trainInvoiceModel()
      setTrainResult(result)
      refreshModelConfig()
    } catch (e) {
      setTrainResult({ success: false, error: String(e) })
    } finally {
      setTrainRunning(false)
    }
  }

  const handleActivateIfBetter = async () => {
    if (!trainResult?.trainedConfig) {
      alert('Najpierw uruchom trening.')
      return
    }
    try {
      const { compareModelConfigs, applyTrainedConfigIfBetter } = await import('../utils/invoiceModelTrainer.js')
      const currentConfig = getInvoiceModelConfig()
      const comparison = compareModelConfigs(currentConfig, trainResult.trainedConfig, trainResult.dataset || [])
      const applied = applyTrainedConfigIfBetter(trainResult.trainedConfig, comparison)
      if (applied.applied) {
        alert(`Model aktywowany. Poprawa: +${(applied.improvement * 100).toFixed(2)}%`)
        refreshModelConfig()
      } else {
        alert(`Model NIE aktywowany — ${applied.reason}. Stary model jest lepszy.`)
      }
    } catch (e) {
      alert('Błąd: ' + String(e))
    }
  }

  const handleSetMode = (mode) => {
    const result = setInvoiceModelMode(mode)
    if (result.success) {
      refreshModelConfig()
      alert(`Tryb ustawiony: ${mode}`)
    } else {
      alert('Błąd: ' + result.error)
    }
  }

  const handleExportModelConfig = () => {
    download(exportInvoiceModelConfig(), `magzic-model-config-${Date.now()}.json`)
  }

  const handleImportModelConfig = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const result = importInvoiceModelConfig(text)
    if (result.success) {
      refreshModelConfig()
      alert('Config modelu zaimportowany pomyślnie.')
    } else {
      alert('Błąd importu: ' + result.error)
    }
    e.target.value = ''
  }

  const handleResetModelConfig = () => {
    if (!window.confirm('Zresetować config modelu do domyślnych wartości?')) return
    resetInvoiceModelConfig()
    refreshModelConfig()
    alert('Config zresetowany do domyślnych wartości.')
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

  const modeColor = { off: '#6b7280', shadow: '#d97706', active: '#16a34a' }[modelConfig.mode] || '#6b7280'

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

          {/* ── Model lokalny / ranking ─────────────────────────────── */}
          <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <button
              onClick={() => setModelSection(s => !s)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: '#1e40af', padding: 0,
              }}
            >
              🤖 Model lokalny / ranking {modelSection ? '▲' : '▼'}
            </button>

            {modelSection && (
              <div style={{ marginTop: 10 }}>
                {/* Status */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Tryb modelu</div>
                    <div style={{ fontWeight: 700, color: modeColor, textTransform: 'uppercase' }}>
                      {modelConfig.mode}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Wersja modelu</div>
                    <div style={{ fontWeight: 600 }}>{modelConfig.version}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Wersja parsera</div>
                    <div style={{ fontWeight: 600 }}>2.0</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Golden samples</div>
                    <div style={{ fontWeight: 700 }}>{goldenCount}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Correction events</div>
                    <div style={{ fontWeight: 700 }}>{corrStats.totalEvents}</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Ostatni trening</div>
                    <div style={{ fontWeight: 600, fontSize: 10 }}>
                      {modelConfig.trainedAt
                        ? new Date(modelConfig.trainedAt).toLocaleDateString('pl-PL')
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Aktualne metryki */}
                {modelConfig.metrics && (
                  <div style={{ marginBottom: 10, padding: 8, background: '#f0f9ff', borderRadius: 6 }}>
                    <strong style={{ fontSize: 11 }}>Metryki (ostatni trening):</strong>
                    <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, fontSize: 11 }}>
                      <span style={{ color: '#64748b' }}>Klasyfikacja dokumentu:</span>
                      <span>{pct(modelConfig.metrics.documentTypeAccuracy)}</span>
                      <span style={{ color: '#64748b' }}>Klasyfikacja pozycji:</span>
                      <span>{pct(modelConfig.metrics.itemTypeAccuracy)}</span>
                      <span style={{ color: '#64748b' }}>Efekt magazynowy:</span>
                      <span>{pct(modelConfig.metrics.inventoryEffectAccuracy)}</span>
                      <span style={{ color: '#64748b' }}>False positive rate:</span>
                      <span>{pct(modelConfig.metrics.falsePositiveRate)}</span>
                      <span style={{ color: '#64748b' }}>Usługa→magazyn błędy:</span>
                      <span style={{ color: modelConfig.metrics.serviceToInventoryErrorRate > 0 ? '#dc2626' : '#16a34a' }}>
                        {pct(modelConfig.metrics.serviceToInventoryErrorRate)}
                      </span>
                      <span style={{ color: '#64748b' }}>Próbki:</span>
                      <span>{modelConfig.metrics.totalSamples}</span>
                    </div>
                  </div>
                )}

                {/* Przyciski operacji na modelu */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  <button
                    onClick={handleRunEval}
                    disabled={evalRunning}
                    style={btnStyle('#1e40af')}
                  >
                    {evalRunning ? '⏳ Ewaluuję…' : '📊 Uruchom ewaluację'}
                  </button>
                  <button
                    onClick={handleTrain}
                    disabled={trainRunning}
                    style={btnStyle('#059669')}
                  >
                    {trainRunning ? '⏳ Trenuję…' : '🎯 Trenuj lokalny ranking'}
                  </button>
                  <button
                    onClick={handleActivateIfBetter}
                    disabled={!trainResult?.trainedConfig}
                    style={btnStyle(trainResult?.trainedConfig ? '#7c3aed' : '#94a3b8')}
                  >
                    ✅ Aktywuj, jeśli lepszy
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  <button
                    onClick={() => handleSetMode('shadow')}
                    style={btnStyle(modelConfig.mode === 'shadow' ? '#d97706' : '#92400e')}
                  >
                    👁️ Tryb shadow
                  </button>
                  <button
                    onClick={() => handleSetMode('active')}
                    style={btnStyle(modelConfig.mode === 'active' ? '#16a34a' : '#065f46')}
                  >
                    ⚡ Tryb active
                  </button>
                  <button
                    onClick={() => handleSetMode('off')}
                    style={btnStyle(modelConfig.mode === 'off' ? '#6b7280' : '#374151')}
                  >
                    🔴 Wyłącz model
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button onClick={handleExportModelConfig} style={btnStyle('#3b82f6')}>
                    ⬇️ Eksportuj config modelu
                  </button>
                  <label style={{ ...btnStyle('#047857'), cursor: 'pointer' }}>
                    ⬆️ Importuj config modelu
                    <input type="file" accept=".json" onChange={handleImportModelConfig} style={{ display: 'none' }} />
                  </label>
                  <button onClick={handleResetModelConfig} style={btnStyle('#b45309')}>
                    🔄 Resetuj config modelu
                  </button>
                </div>

                {/* Wynik treningu */}
                {trainResult && (
                  <div style={{
                    marginTop: 10, padding: 10,
                    background: trainResult.success ? '#f0fdf4' : '#fef2f2',
                    borderRadius: 6, fontSize: 11,
                  }}>
                    {trainResult.success ? (
                      <>
                        <strong>Trening zakończony.</strong>
                        <div>Próbek: {trainResult.datasetSize}</div>
                        <div>Dokładność dokumentu (po): {pct(trainResult.trainedMetrics?.documentTypeAccuracy)}</div>
                        <div>Efekt magazynowy (po): {pct(trainResult.trainedMetrics?.inventoryEffectAccuracy)}</div>
                        <div>Błędy usługa→magazyn (po): {pct(trainResult.trainedMetrics?.serviceToInventoryErrorRate)}</div>
                        <div style={{ color: '#64748b', marginTop: 4 }}>
                          Aby zastosować: kliknij „Aktywuj, jeśli lepszy"
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#dc2626' }}>
                        {trainResult.warning || trainResult.error || 'Błąd treningu'}
                      </div>
                    )}
                  </div>
                )}

                {/* Wynik ewaluacji */}
                {evalResult && (
                  <div style={{
                    marginTop: 10, padding: 10,
                    background: evalResult.error ? '#fef2f2' : '#f0f9ff',
                    borderRadius: 6, fontSize: 11,
                  }}>
                    {evalResult.error ? (
                      <div style={{ color: '#dc2626' }}>Błąd: {evalResult.error}</div>
                    ) : (
                      <>
                        <strong>
                          Ewaluacja: {evalResult.passed}/{evalResult.totalSamples} OK
                          {evalResult.failed > 0 && <span style={{ color: '#dc2626' }}> ({evalResult.failed} błędów)</span>}
                        </strong>
                        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                          <span style={{ color: '#64748b' }}>Klasyfikacja dokumentu:</span>
                          <span>{pct(evalResult.metrics?.documentTypeAccuracy)}</span>
                          <span style={{ color: '#64748b' }}>Klasyfikacja pozycji:</span>
                          <span>{pct(evalResult.metrics?.itemTypeAccuracy)}</span>
                          <span style={{ color: '#64748b' }}>Efekt magazynowy:</span>
                          <span>{pct(evalResult.metrics?.inventoryEffectAccuracy)}</span>
                          <span style={{ color: '#64748b' }}>False positive rate:</span>
                          <span>{pct(evalResult.metrics?.falsePositiveRate)}</span>
                          <span style={{ color: '#64748b' }}>Usługa→magazyn błędy:</span>
                          <span style={{ color: (evalResult.metrics?.serviceToInventoryErrorRate || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                            {pct(evalResult.metrics?.serviceToInventoryErrorRate)}
                          </span>
                        </div>
                        {evalResult.failures?.length > 0 && (
                          <details style={{ marginTop: 6 }}>
                            <summary style={{ cursor: 'pointer', color: '#64748b' }}>
                              Błędy ({evalResult.failures.length})
                            </summary>
                            <div style={{ marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
                              {evalResult.failures.map((f, i) => (
                                <div key={i} style={{ color: '#dc2626', marginBottom: 2 }}>
                                  ❌ [{f.errorType}] {f.name}: {f.message}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Info */}
                <div style={{ marginTop: 10, padding: 8, background: '#fffbeb', borderRadius: 6, fontSize: 11, color: '#92400e' }}>
                  <strong>Shadow mode (domyślny):</strong> Model liczy sugestie rankingu, ale nie zmienia danych faktury.
                  Guardy i walidacja mają zawsze pierwszeństwo. Model nie zatwierdza faktury automatycznie.
                </div>
              </div>
            )}
          </div>

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

function pct(v) {
  return `${((v || 0) * 100).toFixed(1)}%`
}

const btnStyle = (bg) => ({
  padding: '6px 12px', background: bg, color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer',
  fontSize: 11, fontWeight: 500,
})
