import { getQualityBadge, shouldRequireManualReview, getQualityWarnings } from '../../utils/invoiceQualityMetrics'

export default function InvoiceScoringPanel({ qualityMetrics, contractorValue, contractorNipWarning, shadowResult }) {
  if (!qualityMetrics) return null

  const badge = getQualityBadge(qualityMetrics)

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 12, fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>📊 Jakość odczytu</span>
        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </div>
      <div className="quality-metrics-grid">
        <div>
          <div style={{ color: '#64748b' }}>Źródło</div>
          <div style={{ fontWeight: 500 }}>
            {qualityMetrics.source === 'pdf_text' ? '📄 Lokalny' : qualityMetrics.source?.includes('ai') ? '🤖 AI' : '✍️ Ręczny'}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748b' }}>Pewność</div>
          <div style={{ fontWeight: 500, color: qualityMetrics.confidence >= 85 ? '#16a34a' : qualityMetrics.confidence >= 60 ? '#d97706' : '#dc2626' }}>
            {qualityMetrics.confidence}%
          </div>
        </div>
        <div>
          <div style={{ color: '#64748b' }}>Typ dokumentu</div>
          <div style={{ fontWeight: 500 }}>
            {qualityMetrics.documentType === 'inventory_purchase_invoice' ? '🏭 Zakupowy'
              : qualityMetrics.documentType?.includes('telecom') ? '📱 Telecom'
              : qualityMetrics.documentType?.includes('service') ? '🔧 Usługowy'
              : qualityMetrics.documentType?.includes('utility') ? '⚡ Media'
              : '❓ Nieznany'}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748b' }}>Pozycje</div>
          <div style={{ fontWeight: 500 }}>{qualityMetrics.itemCount} ({qualityMetrics.inventoryItemCount} towarów, {qualityMetrics.serviceItemCount} usług)</div>
        </div>
        <div>
          <div style={{ color: '#64748b' }}>Matematyka</div>
          <div style={{ fontWeight: 500, color: qualityMetrics.mathValid ? '#16a34a' : '#dc2626' }}>
            {qualityMetrics.mathValid ? '✅ OK' : '❌ Sprawdź'}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748b' }}>Ostrzeżenia</div>
          <div style={{ fontWeight: 500, color: qualityMetrics.warningsCount === 0 ? '#16a34a' : '#d97706' }}>
            {qualityMetrics.warningsCount}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748b' }}>Kontrahent</div>
          <div style={{ fontWeight: 500,
            color: contractorValue?.matchStatus === 'matched_nip' || contractorValue?.matchStatus === 'matched_name' || contractorValue?.matchStatus === 'learned_history' ? '#16a34a'
              : contractorValue?.matchStatus === 'new_from_pdf' ? '#1d4ed8'
              : contractorValue?.matchStatus === 'low_confidence' ? '#d97706'
              : '#d97706' }}>
            {contractorValue?.matchStatus === 'matched_nip' ? '✓ NIP'
              : contractorValue?.matchStatus === 'matched_name' ? '✓ Nazwa'
              : contractorValue?.matchStatus === 'learned_history' ? '♻ Z historii'
              : contractorValue?.matchStatus === 'low_confidence' ? '⚠ Sprawdź'
              : contractorValue?.matchStatus === 'new_from_pdf' ? '+ Nowy (PDF)'
              : contractorValue?.matchStatus === 'new_manual' ? '+ Nowy'
              : '— brak'}
          </div>
        </div>
      </div>
      {contractorNipWarning && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 4, color: '#92400e', fontSize: 11 }}>
          ⚠ {contractorNipWarning}
        </div>
      )}
      {qualityMetrics.errorsCount > 0 && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', borderRadius: 4, color: '#991b1b', fontSize: 11 }}>
          ❌ {qualityMetrics.errorsCount} błędów — wymagane ręczne uzupełnienie
        </div>
      )}
      {qualityMetrics.supplierTemplate && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: '#f0fdf4', borderRadius: 4, color: '#166534', fontSize: 11 }}>
          Wykryto dostawcę: <strong>{qualityMetrics.supplierTemplate.name}</strong>
          {' '}(match: {qualityMetrics.supplierTemplate.matchedBy})
          — zastosowano reguły specyficzne dla tego dostawcy
        </div>
      )}
      {shouldRequireManualReview(qualityMetrics) && (() => {
        const warnings = getQualityWarnings(qualityMetrics)
        return (
          <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 4, fontSize: 11, color: '#9a3412' }}>
            <strong>⚠ Sprawdź dane przed zatwierdzeniem.</strong> System nie zapisze zmian automatycznie.
            {warnings.length > 0 && (
              <ul style={{ margin: '4px 0 0 16px' }}>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        )
      })()}
      {shadowResult?.documentScores && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#64748b' }}>Ocena modelu:</span>
          <span title="Sygnały magazynowe">🏭 {Math.round((shadowResult.documentScores.inventoryScore ?? 0) * 100)}%</span>
          <span title="Sygnały usługowe">🔧 {Math.round((shadowResult.documentScores.serviceScore ?? 0) * 100)}%</span>
          {(shadowResult.documentScores.telecomScore ?? 0) > 0.1 && (
            <span title="Sygnały telecom">📱 {Math.round(shadowResult.documentScores.telecomScore * 100)}%</span>
          )}
          {(shadowResult.documentScores.utilityScore ?? 0) > 0.1 && (
            <span title="Sygnały media">⚡ {Math.round(shadowResult.documentScores.utilityScore * 100)}%</span>
          )}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
        System przygotował propozycję. Sprawdź dane przed zatwierdzeniem.
      </div>
    </div>
  )
}
