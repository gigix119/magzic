import { IS } from './invoiceShared'
import InvoiceScoringPanel from './InvoiceScoringPanel'
import { getAssignmentStatus, isReadyToSave } from '../../utils/invoicePositionValidator'
import { getVerificationStatusConfig } from '../../utils/invoiceVerificationStatus'
import { isInvoiceAiAvailable } from '../../utils/invoiceAiAdapter'

export default function InvoiceVerificationPanel({
  extractedItems,
  towary,
  extractionResult,
  qualityMetrics,
  contractorValue,
  contractorNipWarning,
  shadowResult,
  draftZeroPriceConfirmed,
  createProductFor,
  newProductForm,
  newProductSaving,
  newProductDupeWarning,

  onExtractedItemChange,
  onProductMatch,
  onCandidateSelect,
  onToggleSkip,
  onMarkService,
  onMarkInventory,
  onOpenCreateProduct,
  onCloseCreateProduct,
  onDraftZeroPriceConfirmedChange,
  onNewProductFormFieldChange,
  onSaveNewProduct,
  onGoToManualForm,
  onCommitExtracted,
  onCommitDraftExtracted,
}) {
  const creatingFor = createProductFor !== null ? extractedItems[createProductFor] : null

  return (
    <div>
      {/* Source badge + AI availability */}
      {extractionResult && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: extractionResult.source === 'pdf_text_ai' ? '#eff6ff' : '#f0fdf4',
            color: extractionResult.source === 'pdf_text_ai' ? '#1d4ed8' : '#15803d',
            border: `1px solid ${extractionResult.source === 'pdf_text_ai' ? '#bfdbfe' : '#bbf7d0'}`,
            borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
          }}>
            {extractionResult.source === 'pdf_text_ai' ? '🤖 Odczyt lokalny + AI' :
             extractionResult.source === 'pdf_text' ? '📄 Odczyt lokalny' :
             '✍️ Wymaga ręcznej weryfikacji'}
          </span>
          {!isInvoiceAiAvailable() && extractionResult.source !== 'pdf_text_ai' && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>AI premium nie jest skonfigurowane</span>
          )}
        </div>
      )}

      {/* Document type banners */}
      {extractionResult?.documentType === 'inventory_purchase_invoice' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#166534' }}>
          <strong>Faktura zakupowa magazynowa</strong> — po zatwierdzeniu pozycje oznaczone jako <strong>Towar</strong> mogą zwiększyć stany magazynowe.
        </div>
      )}
      {extractionResult?.documentType && ['telecom_invoice','utility_invoice','service_cost_invoice'].includes(extractionResult.documentType) && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#92400e' }}>
          <strong>Faktura usługowa/kosztowa</strong> — pozycje nie zwiększą stanów magazynowych. Zostaną zapisane jako koszty.
        </div>
      )}
      {extractionResult?.documentType === 'unknown' && extractedItems.some(i => i.itemType === 'inventory_item') && extractedItems.some(i => i.itemType === 'service_item') && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#0369a1' }}>
          <strong>Faktura mieszana</strong> — tylko pozycje oznaczone jako <strong>Towar</strong> wpłyną na magazyn.
        </div>
      )}
      {extractionResult?.debug?.ksefComarchDetected && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#78350f' }}>
          <strong>Wykryto dokument KSeF/Comarch</strong> — pominięto metadane systemowe (Uwagi/Remarks, Nr wiersza itp.), które nie są pozycjami faktury.
          {extractionResult.debug.ksefMetadataBlocked > 0 && (
            <span> Zablokowano {extractionResult.debug.ksefMetadataBlocked} linie metadanych.</span>
          )}
        </div>
      )}

      {/* Quality metrics panel */}
      <InvoiceScoringPanel
        qualityMetrics={qualityMetrics}
        contractorValue={contractorValue}
        contractorNipWarning={contractorNipWarning}
        shadowResult={shadowResult}
      />

      {/* Validation banner */}
      {extractionResult?.validation && (() => {
        const v = extractionResult.validation
        const isError = v.suggestedAction === 'manual_required'
        const isWarn = v.suggestedAction === 'review_required'
        const hasContractorIssue = !!contractorNipWarning ||
          (!contractorValue?.existingId && !contractorValue?.candidate)
        const effectiveIsWarn = isWarn || (!isError && hasContractorIssue)
        const bg = isError ? '#1a0000' : effectiveIsWarn ? '#1a1200' : '#001a00'
        const fg = isError ? '#f87171' : effectiveIsWarn ? '#fbbf24' : '#86efac'
        const border = isError ? '#7f1d1d' : effectiveIsWarn ? '#78350f' : '#166534'
        const label = isError ? '⚠ Wymagane ręczne uzupełnienie'
          : effectiveIsWarn && hasContractorIssue ? '⚡ Odczytano dane — sprawdź kontrahenta i NIP'
          : effectiveIsWarn ? '⚡ Weryfikacja zalecana'
          : '✓ Dane odczytane'
        const msgs = [...v.errors.slice(0, 2), ...v.warnings.slice(0, 2)]
        return (
          <div className="rounded-lg px-4 py-3 mb-3 text-xs" style={{ background: bg, color: fg, border: `1px solid ${border}` }}>
            <div className="flex items-center gap-2 font-semibold text-sm">
              <span>{label}</span>
              <span className="ml-auto opacity-70">Pewność: {extractionResult.confidence}%</span>
            </div>
            {msgs.length > 0 && (
              <ul className="mt-1 space-y-0.5 opacity-85">
                {msgs.map((m, i) => <li key={i}>· {m}</li>)}
              </ul>
            )}
          </div>
        )
      })()}

      {/* Item count summary */}
      {(() => {
        const statuses = extractedItems.map(i => getAssignmentStatus(i, towary))
        const inventoryReadyCount = statuses.filter(s => s === 'ready').length
        const serviceCostCount = statuses.filter(s => s === 'service_cost').length
        const reviewCount = statuses.filter(s => s === 'needs_review' || s === 'needs_product' || s === 'needs_price').length
        const skippedCount = extractedItems.filter(i => i.skipped).length
        return (
          <div className="mb-3">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Znaleziono <strong>{extractedItems.length}</strong> pozycji —{' '}
              <span style={{ color: '#16a34a' }}>gotowe do magazynu: {inventoryReadyCount}</span>
              {reviewCount > 0 && <span style={{ color: '#d97706' }}>, do weryfikacji: {reviewCount}</span>}
              {serviceCostCount > 0 && <span style={{ color: '#7c3aed' }}>, usługi/koszty: {serviceCostCount}</span>}
              {skippedCount > 0 && <span style={{ color: 'var(--muted)' }}>, pominięte: {skippedCount}</span>}
            </p>
            {reviewCount > 0 && (
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Pozycje do weryfikacji możesz dodać do faktury jako robocze. Nie zwiększą stanów magazynowych, dopóki nie wybierzesz towaru i magazynu.
              </p>
            )}
          </div>
        )
      })()}

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2 mt-1" style={{ maxHeight: 440, overflowY: 'auto' }}>
        {extractedItems.map((item, idx) => {
          const assignStatus = getAssignmentStatus(item, towary)
          const borderColor = assignStatus === 'ready' || assignStatus === 'service_cost' ? '#16a34a'
            : assignStatus === 'needs_review' ? '#d97706'
            : assignStatus === 'needs_price' || assignStatus === 'needs_product' ? '#ef4444'
            : '#94a3b8'
          const statusCfg = getVerificationStatusConfig(assignStatus)
          return (
            <div key={idx} style={{
              background: 'var(--card)', borderRadius: 8, padding: '10px 12px',
              border: `1px solid var(--border)`, borderLeft: `3px solid ${borderColor}`,
              opacity: item.skipped ? 0.4 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 12, lineHeight: 1.3 }}>{item.rawName}</span>
                  {item.matchingSource === 'manual_created_from_invoice' && (
                    <span style={{ display: 'inline-block', marginLeft: 4, background: '#dbeafe', color: '#1e40af', borderRadius: 4, padding: '0px 4px', fontSize: 10, fontWeight: 600 }}>nowy towar</span>
                  )}
                  {item.matchingSource === 'alias_learned' && (
                    <span style={{ display: 'inline-block', marginLeft: 4, background: '#f0fdf4', color: '#166534', borderRadius: 4, padding: '0px 4px', fontSize: 10, fontWeight: 600 }} title={`Alias z bazy — użyty ${item.aliasUsageCount ?? 1} razy`}>♻ Alias ({item.aliasUsageCount ?? 1}×)</span>
                  )}
                  {item.matchingSource === 'manual_selected' && item.matchedProductId && (
                    <span style={{ display: 'inline-block', marginLeft: 4, background: '#f3f4f6', color: '#6b7280', borderRadius: 4, padding: '0px 4px', fontSize: 10 }}>ręcznie</span>
                  )}
                  {item.autoApproved && (
                    <span style={{ display: 'inline-block', marginLeft: 4, background: '#dcfce7', color: '#14532d', borderRadius: 4, padding: '0px 4px', fontSize: 10, fontWeight: 700 }}>✓ Auto</span>
                  )}
                  {!item.autoApproved && item.confidenceLevel === 'high' && (
                    <span style={{ display: 'inline-block', marginLeft: 4, background: '#f0fdf4', color: '#166534', borderRadius: 4, padding: '0px 4px', fontSize: 10 }}>High</span>
                  )}
                  {item.confidenceLevel === 'medium' && (
                    <span style={{ display: 'inline-block', marginLeft: 4, background: '#fef9c3', color: '#854d0e', borderRadius: 4, padding: '0px 4px', fontSize: 10 }}>Med</span>
                  )}
                  {item.confidenceLevel === 'low' && (
                    <span style={{ display: 'inline-block', marginLeft: 4, background: '#fff7ed', color: '#c2410c', borderRadius: 4, padding: '0px 4px', fontSize: 10 }}>Low</span>
                  )}
                </div>
                {!item.skipped && (
                  <span style={{ background: statusCfg.bg, color: statusCfg.color, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                    {statusCfg.short}
                  </span>
                )}
              </div>
              <select
                value={item.matchedProductId || ''}
                onChange={e => onProductMatch(idx, e.target.value || null, item.rawName)}
                style={{ ...IS(), fontSize: 11, padding: '5px 8px', marginBottom: 8 }}
                disabled={item.skipped}
              >
                <option value="">{item.shouldAffectInventory === false ? '— koszt / nie dotyczy —' : '— brak dopasowania —'}</option>
                {towary.map(t => <option key={t.id} value={t.id}>{t.nazwa}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input
                  type="number" min="0" step="0.001"
                  value={item.quantity}
                  onChange={e => onExtractedItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                  style={{ ...IS(), fontSize: 11, padding: '4px 8px', width: 70, textAlign: 'right' }}
                  disabled={item.skipped}
                />
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>×</span>
                <input
                  type="number" min="0" step="0.01"
                  value={item.unitPriceNet}
                  onChange={e => onExtractedItemChange(idx, 'unitPriceNet', parseFloat(e.target.value) || 0)}
                  style={{ ...IS(assignStatus === 'needs_price'), fontSize: 11, padding: '4px 8px', width: 80, textAlign: 'right' }}
                  disabled={item.skipped}
                />
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>zł</span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {!item.skipped && item.itemType !== 'service_item' && (
                  <button type="button" onClick={() => onMarkService(idx)}
                    style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}>
                    Oznacz jako usługę
                  </button>
                )}
                {!item.skipped && item.itemType === 'service_item' && (
                  <button type="button" onClick={() => onMarkInventory(idx)}
                    style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}>
                    Zmień na towar
                  </button>
                )}
                {!item.skipped && !item.matchedProductId && item.itemType !== 'service_item' && (
                  <button type="button" onClick={() => onOpenCreateProduct(idx)}
                    style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}>
                    Utwórz towar
                  </button>
                )}
                <button type="button" onClick={() => onToggleSkip(idx)}
                  style={{ background: 'var(--table-sub)', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}>
                  {item.skipped ? 'Przywróć' : 'Pomiń'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block table-scroll-x" style={{ maxHeight: 440, overflowY: 'auto' }}>
        <table className="w-full text-sm" style={{ minWidth: 580 }}>
          <thead>
            <tr style={{ background: 'var(--table-sub)', position: 'sticky', top: 0 }}>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 11 }}>Odczytana nazwa</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 11 }}>Towar w bazie</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 11 }}>Ilość</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 11 }}>Cena</th>
              <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 11 }}>Pewność</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {extractedItems.map((item, idx) => {
              const assignStatus = getAssignmentStatus(item, towary)
              const borderColor = assignStatus === 'ready' || assignStatus === 'service_cost' ? '#16a34a'
                : assignStatus === 'needs_review' ? '#d97706'
                : assignStatus === 'needs_price' || assignStatus === 'needs_product' ? '#ef4444'
                : '#94a3b8'
              const statusLabel = {
                ready: { text: '✓ gotowa', bg: '#dcfce7', color: '#166534' },
                service_cost: { text: '✓ usługa', bg: '#f0fdf4', color: '#166534' },
                needs_review: { text: '⚠ sprawdź', bg: '#fef9c3', color: '#854d0e' },
                needs_price: { text: '✗ brak ceny', bg: '#fee2e2', color: '#991b1b' },
                needs_product: { text: '✗ brak towaru', bg: '#fee2e2', color: '#991b1b' },
                ignored: { text: '– pominięta', bg: '#f3f4f6', color: '#6b7280' },
              }[assignStatus] || { text: assignStatus, bg: '#f3f4f6', color: '#6b7280' }

              return (
                <tr
                  key={idx}
                  style={{
                    opacity: item.skipped ? 0.35 : 1,
                    borderTop: '1px solid var(--border)',
                    borderLeft: `3px solid ${borderColor}`,
                  }}
                >
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text)' }}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{item.rawName}</span>
                      {item.itemType === 'inventory_item' && (
                        <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>Towar</span>
                      )}
                      {item.itemType === 'service_item' && (
                        <span style={{ background: '#fed7aa', color: '#9a3412', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>Usługa</span>
                      )}
                      {item.itemType === 'cost_item' && (
                        <span style={{ background: '#fce7f3', color: '#9d174d', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>Koszt</span>
                      )}
                      {(item.itemType === 'unknown' || !item.itemType) && (
                        <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Sprawdź</span>
                      )}
                      {item.matchingSource === 'manual_created_from_invoice' && (
                        <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>nowy towar</span>
                      )}
                      {item.matchingSource === 'alias_learned' && (
                        <span style={{ background: '#f0fdf4', color: '#166534', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }} title={`Learned alias — used ${item.aliasUsageCount ?? 1} times`}>♻ Alias ({item.aliasUsageCount ?? 1}×)</span>
                      )}
                      {item.matchingSource === 'manual_selected' && item.matchedProductId && (
                        <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>wybrano ręcznie</span>
                      )}
                      {item.shouldAffectInventory === true && (
                        <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>↑ Magazyn</span>
                      )}
                      {item.warnings?.length > 0 && (
                        <span title={item.warnings.join('; ')} style={{ background: '#fff7ed', color: '#c2410c', borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'help' }}>⚠ {item.warnings.length}</span>
                      )}
                      {item._modelLabel && item.shouldAffectInventory !== false && (
                        <span
                          title={`Model lokalny: ${item._modelLabel}${item._modelCandidatesCount > 0 ? `, ${item._modelCandidatesCount} kandydatów` : ''}`}
                          style={{
                            background: item._modelLabel === 'strong' ? '#dcfce7' : item._modelLabel === 'review' ? '#fef9c3' : '#f3f4f6',
                            color: item._modelLabel === 'strong' ? '#166534' : item._modelLabel === 'review' ? '#854d0e' : '#6b7280',
                            borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'help',
                          }}
                        >
                          M:{item._modelLabel}
                        </span>
                      )}
                      {item._matchDisagreement && (
                        <span
                          title="Parser i model nie są zgodne — sprawdź dopasowanie ręcznie."
                          style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'help' }}
                        >
                          ⚡ niezgodność
                        </span>
                      )}
                      {item._modelItemType && item._modelItemType !== item.itemType && item.itemType && item.itemType !== 'unknown' && (
                        <span
                          title={`Model klasyfikuje jako: ${item._modelItemType}`}
                          style={{ background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'help' }}
                        >
                          M:{item._modelItemType === 'service_item' ? 'usługa?' : item._modelItemType === 'inventory_item' ? 'towar?' : item._modelItemType}
                        </span>
                      )}
                      {!item.skipped && (
                        <span style={{ background: statusLabel.bg, color: statusLabel.color, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>
                          {statusLabel.text}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2" style={{ minWidth: 180 }}>
                    <select
                      value={item.matchedProductId || ''}
                      onChange={e => onProductMatch(idx, e.target.value || null, item.rawName)}
                      style={{ ...IS(), fontSize: 11, padding: '4px 8px' }}
                    >
                      <option value="">{item.shouldAffectInventory === false ? '— koszt / nie dotyczy —' : '— brak dopasowania —'}</option>
                      {towary.map(t => (
                        <option key={t.id} value={t.id}>{t.nazwa}</option>
                      ))}
                    </select>
                    {!item.matchedProductId && item._suggestedProductId && (
                      <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>
                        Sugestia: <button
                          type="button"
                          onClick={() => onProductMatch(idx, item._suggestedProductId, item.rawName)}
                          style={{ color: '#d97706', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: 0 }}
                        >
                          {item._suggestedProductNazwa}
                        </button>
                      </div>
                    )}
                    {!item.matchedProductId && item._topCandidates?.length > 0 && (
                      <div style={{ fontSize: 10, marginTop: 3, lineHeight: 1.6 }}>
                        <span style={{ color: 'var(--muted)' }}>Model: </span>
                        {item._topCandidates.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onCandidateSelect(idx, c.id, c.nazwa, c.score, item.rawName)}
                            title={`Pewność modelu: ${Math.round(c.score * 100)}%`}
                            style={{
                              color: c.score >= 0.7 ? '#6366f1' : '#94a3b8',
                              textDecoration: 'underline', fontSize: 10,
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: '0 6px 0 0',
                            }}
                          >
                            {c.nazwa} ({Math.round(c.score * 100)}%)
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={item.quantity}
                      onChange={e => onExtractedItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      style={{ ...IS(), fontSize: 11, padding: '4px 8px', width: 72, textAlign: 'right' }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPriceNet}
                      onChange={e => onExtractedItemChange(idx, 'unitPriceNet', parseFloat(e.target.value) || 0)}
                      style={{ ...IS(assignStatus === 'needs_price'), fontSize: 11, padding: '4px 8px', width: 80, textAlign: 'right' }}
                    />
                    {assignStatus === 'needs_price' && (
                      <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>Uzupełnij cenę</div>
                    )}
                    {item.recoveredAmount && (
                      <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>Cena odzyskana heurystycznie</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-medium" style={{ color: borderColor }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      {item.matchingSource === 'manual_created_from_invoice'
                        ? <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>nowy towar</span>
                        : item.matchingSource === 'alias_learned'
                        ? <span style={{ background: '#f0fdf4', color: '#166534', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>♻ Alias</span>
                        : item.matchingSource === 'manual_selected'
                        ? <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>ręcznie</span>
                        : item.matchScore > 0 ? `${Math.round(item.matchScore * 100)}%` : '—'}
                      {item.autoApproved && (
                        <span style={{ background: '#dcfce7', color: '#14532d', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>✓ Auto-approved</span>
                      )}
                      {!item.autoApproved && item.confidenceLevel === 'high' && (
                        <span style={{ background: '#f0fdf4', color: '#166534', borderRadius: 4, padding: '1px 5px', fontSize: 9 }}>High Confidence</span>
                      )}
                      {item.confidenceLevel === 'medium' && (
                        <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 4, padding: '1px 5px', fontSize: 9 }}>Medium Confidence</span>
                      )}
                      {item.confidenceLevel === 'low' && (
                        <span style={{ background: '#fff7ed', color: '#c2410c', borderRadius: 4, padding: '1px 5px', fontSize: 9 }}>Low Confidence</span>
                      )}
                      {item.confidenceLevel === 'none' && item.matchedProductId && (
                        <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 4, padding: '1px 5px', fontSize: 9 }}>Needs Review</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1 items-start justify-end" style={{ minWidth: 120 }}>
                      {!item.skipped && item.itemType !== 'service_item' && (
                        <button
                          type="button"
                          onClick={() => onMarkService(idx)}
                          title="Oznacz jako usługę/koszt — nie wpłynie na magazyn"
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', whiteSpace: 'nowrap' }}
                        >
                          Oznacz jako usługę
                        </button>
                      )}
                      {!item.skipped && item.itemType === 'service_item' && (
                        <button
                          type="button"
                          onClick={() => onMarkInventory(idx)}
                          title="Przywróć jako towar magazynowy"
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}
                        >
                          Zmień na towar
                        </button>
                      )}
                      {!item.skipped && !item.matchedProductId && item.itemType !== 'service_item' && (
                        <button
                          type="button"
                          onClick={() => onOpenCreateProduct(idx)}
                          title="Utwórz nowy towar na podstawie tej pozycji"
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}
                        >
                          Utwórz towar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleSkip(idx)}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: 'var(--table-sub)', color: 'var(--muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}
                      >
                        {item.skipped ? 'Przywróć' : 'Pomiń'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Zero-price draft confirmation */}
      {(() => {
        const active = extractedItems.filter(i => !i.skipped)
        const draftStatuses = active.filter(i => {
          const s = getAssignmentStatus(i, towary)
          return s === 'needs_review' || s === 'needs_product' || s === 'needs_price' || s === 'service_cost'
        })
        const hasZeroPrice = draftStatuses.some(i => !((i.unitPriceNet ?? 0) > 0))
        if (!hasZeroPrice) return null
        return (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <input
              type="checkbox"
              id="draftZeroConfirm"
              checked={draftZeroPriceConfirmed}
              onChange={e => onDraftZeroPriceConfirmedChange(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <label htmlFor="draftZeroConfirm" style={{ color: '#92400e', cursor: 'pointer' }}>
              Rozumiem, że pozycje bez ceny zostaną dodane jako robocze i nie wpłyną na magazyn.
            </label>
          </div>
        )
      })()}

      {/* Action buttons */}
      <div className="flex gap-2 mt-4 flex-wrap items-center">
        <button
          type="button"
          onClick={onGoToManualForm}
          className="rounded-lg py-2 px-3 text-sm font-medium"
          style={{ background: 'var(--table-sub)', color: 'var(--text-2)', flexShrink: 0 }}
        >
          Pomiń pozycje
        </button>
        {(() => {
          const active = extractedItems.filter(i => !i.skipped)
          const statuses = active.map(i => getAssignmentStatus(i, towary))
          const readyCount = statuses.filter(s => isReadyToSave(s)).length
          const draftCount = statuses.filter(s => s === 'needs_review' || s === 'needs_product' || s === 'needs_price').length
          const hasZeroPrice = active.some(i => {
            const s = getAssignmentStatus(i, towary)
            return (s === 'needs_review' || s === 'needs_product' || s === 'needs_price') && !((i.unitPriceNet ?? 0) > 0)
          })
          const draftDisabled = draftCount === 0 || (hasZeroPrice && !draftZeroPriceConfirmed)
          const allReady = readyCount > 0 && draftCount === 0
          return (
            <>
              {draftCount > 0 && (
                <button
                  type="button"
                  onClick={onCommitDraftExtracted}
                  disabled={draftDisabled}
                  className="flex-1 rounded-lg py-2 px-3 text-sm font-semibold"
                  style={{
                    background: draftDisabled ? '#f1f5f9' : '#fffbeb',
                    color: draftDisabled ? '#94a3b8' : '#78350f',
                    border: `1px solid ${draftDisabled ? '#e2e8f0' : '#fde047'}`,
                    cursor: draftDisabled ? 'not-allowed' : 'pointer',
                    minWidth: 160,
                  }}
                >
                  {readyCount === 0
                    ? 'Zapisz fakturę roboczą z pozycjami do weryfikacji'
                    : `Zapisz ${draftCount} pozycji do weryfikacji`}
                </button>
              )}
              <button
                type="button"
                onClick={onCommitExtracted}
                disabled={readyCount === 0}
                className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
                style={{
                  background: readyCount > 0 ? '#3b82f6' : '#94a3b8',
                  cursor: readyCount > 0 ? 'pointer' : 'not-allowed',
                  minWidth: 140,
                }}
              >
                {readyCount === 0
                  ? 'Brak gotowych pozycji'
                  : allReady
                  ? 'Dodaj wszystkie pozycje do faktury →'
                  : `Dodaj ${readyCount} pozycji do faktury →`}
              </button>
            </>
          )
        })()}
      </div>

      {/* Create-product mini-modal */}
      {createProductFor !== null && creatingFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>Utwórz towar z pozycji faktury</p>
            {creatingFor?.rawName && (
              <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>
                Pozycja: <em>{creatingFor.rawName}</em>
              </p>
            )}
            {(creatingFor?.quantity > 0 || creatingFor?.unitPriceNet > 0) && (
              <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                {creatingFor.quantity > 0 ? `${creatingFor.quantity} ${creatingFor.jednostka || 'szt'}` : ''}
                {creatingFor.quantity > 0 && creatingFor.unitPriceNet > 0 ? ' · ' : ''}
                {creatingFor.unitPriceNet > 0 ? `${creatingFor.unitPriceNet} zł/szt` : ''}
              </p>
            )}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#1e3a8a' }}>
              Tworzysz nowy towar na podstawie pozycji z faktury. Towar zostanie przypisany do tej pozycji, ale <strong>magazyn zwiększy się dopiero po zatwierdzeniu faktury</strong>.
            </div>
            {newProductDupeWarning && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Znaleziono podobne towary w bazie:</p>
                <p style={{ marginBottom: 4 }}>{newProductDupeWarning}</p>
                <p>Wybierz istniejący towar z listy albo kliknij „Utwórz mimo to".</p>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-2)' }}>Nazwa *</label>
                <input
                  value={newProductForm.nazwa}
                  onChange={e => onNewProductFormFieldChange('nazwa', e.target.value)}
                  style={IS(!newProductForm.nazwa.trim())}
                  placeholder="Pełna nazwa towaru"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-2)' }}>Jednostka</label>
                  <select value={newProductForm.jednostka} onChange={e => onNewProductFormFieldChange('jednostka', e.target.value)} style={IS()}>
                    <option value="szt">szt</option>
                    <option value="kg">kg</option>
                    <option value="l">l</option>
                    <option value="m">m</option>
                    <option value="m2">m²</option>
                    <option value="opak">opak</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-2)' }}>Typ towaru</label>
                  <select value={newProductForm.typ} onChange={e => onNewProductFormFieldChange('typ', e.target.value)} style={IS()}>
                    <option value="towar">Towar</option>
                    <option value="material">Materiał</option>
                    <option value="urzadzenie">Urządzenie</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onCloseCreateProduct}
                  className="flex-1 rounded-lg py-2 text-sm font-medium"
                  style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={onSaveNewProduct}
                  disabled={newProductSaving || !newProductForm.nazwa.trim()}
                  className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
                  style={{
                    background: (newProductSaving || !newProductForm.nazwa.trim()) ? '#94a3b8' : '#3b82f6',
                    cursor: (newProductSaving || !newProductForm.nazwa.trim()) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {newProductSaving ? 'Tworzenie...' : newProductDupeWarning ? 'Utwórz mimo to' : 'Utwórz towar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEV tools */}
      {import.meta.env.DEV && extractedItems.length > 0 && extractionResult && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e2e8f0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={async () => {
              try {
                const { buildGoldenSampleFromApprovedInvoice } = await import('../../utils/invoiceDatasetBuilder')
                const { saveGoldenSample } = await import('../../utils/invoiceGoldenSamples')
                const sampleName = window.prompt('Nazwa golden sample:', `${extractionResult.fields?.kontrahent_nazwa || 'Faktura'} ${new Date().toLocaleDateString('pl-PL')}`)
                if (sampleName === null) return
                const sample = buildGoldenSampleFromApprovedInvoice(
                  extractionResult,
                  extractedItems.filter(i => !i.skipped),
                  { name: sampleName }
                )
                const result = saveGoldenSample(sample)
                if (result.success) alert(`Golden sample "${sampleName}" zapisany (DEV).`)
                else alert('Błąd: ' + result.error)
              } catch (e) {
                alert('Błąd: ' + String(e))
              }
            }}
            style={{
              padding: '5px 12px', background: '#059669', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 500,
            }}
          >
            [DEV] Zapisz jako golden sample
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const { buildInvoiceDebugExport, downloadInvoiceDebugJson } = await import('../../utils/invoiceDebugExport')
                const debugData = buildInvoiceDebugExport(extractionResult)
                downloadInvoiceDebugJson(debugData, extractionResult._fileName || 'faktura')
              } catch (e) {
                alert('Błąd eksportu: ' + String(e))
              }
            }}
            style={{
              padding: '5px 12px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 500,
            }}
          >
            [DEV] Eksportuj debug odczytu
          </button>
        </div>
      )}
    </div>
  )
}
