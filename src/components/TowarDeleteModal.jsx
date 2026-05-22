import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { sprawdzPowiazaniaTowaru, wydajStan } from '../utils/magazyn'

export default function TowarDeleteModal({ towar, onClose, onSuccess, addToast }) {
  const [powiazania, setPowiazania] = useState(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState(null)

  const [selectedMagazyn, setSelectedMagazyn] = useState('')
  const [ilosc, setIlosc] = useState(1)
  const [powod, setPowod] = useState('korekta')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    sprawdzPowiazaniaTowaru(towar.id).then(data => {
      setPowiazania(data)
      setLoading(false)
    })
  }, [towar.id])

  async function handleIssue() {
    if (!selectedMagazyn || ilosc <= 0) return
    setSaving(true)
    const result = await wydajStan(towar.id, selectedMagazyn, ilosc, powod)
    if (result.success) {
      addToast(`Zdjęto ${ilosc} szt. z magazynu`, 'success')
      onSuccess()
      onClose()
    } else {
      addToast(result.error || 'Błąd', 'error')
    }
    setSaving(false)
  }

  async function handleArchive() {
    setSaving(true)
    for (const stan of powiazania.stanyAktywne) {
      if (stan.ilosc > 0) {
        await wydajStan(towar.id, stan.magazyn_id, stan.ilosc, 'archiwizacja')
      }
    }
    const { error } = await supabase
      .from('towary')
      .update({
        archived_at: new Date().toISOString(),
        archive_reason: 'Ręczna archiwizacja',
      })
      .eq('id', towar.id)

    if (error) {
      addToast('Błąd archiwizacji: ' + error.message, 'error')
    } else {
      addToast(`Towar "${towar.nazwa}" zarchiwizowany`, 'success')
      onSuccess()
      onClose()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!powiazania.moznaUsunac) return
    setSaving(true)
    await supabase.from('stany_magazynowe').delete().eq('towar_id', towar.id)
    const { error } = await supabase.from('towary').delete().eq('id', towar.id)
    if (error) {
      addToast('Błąd usuwania: ' + error.message, 'error')
    } else {
      addToast(`Towar "${towar.nazwa}" usunięty`, 'success')
      onSuccess()
      onClose()
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <p style={{ color: 'var(--text-2)' }}>Sprawdzam powiązania...</p>
        </div>
      </div>
    )
  }

  const maxIlosc = powiazania.stanyAktywne.find(s => s.magazyn_id === selectedMagazyn)?.ilosc || 999

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Co zrobić z towarem?</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16 }}>
          <strong>{towar.nazwa}</strong>
        </p>

        <div style={{
          background: 'var(--table-sub)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12,
        }}>
          <div>Stan łączny: <strong>{powiazania.stanLaczny} {towar.jednostka || 'szt.'}</strong></div>
          {powiazania.stanyAktywne.map(s => (
            <div key={s.id} style={{ color: 'var(--text-2)', marginTop: 2 }}>
              • {s.magazyny?.nazwa}: {s.ilosc} szt.
            </div>
          ))}
          <div style={{ marginTop: 8 }}>Ruchy magazynowe: <strong>{powiazania.liczbaRuchow}</strong></div>
          <div>Pozycje faktur: <strong>{powiazania.liczbaPozycjiFaktur}</strong></div>
        </div>

        {/* Opcja 1: Wydaj kilka sztuk */}
        {powiazania.stanyAktywne.length > 0 && (
          <div style={optionStyle}>
            <button
              onClick={() => setAction(action === 'issue' ? null : 'issue')}
              style={optionBtnStyle}
            >
              Usuń kilka sztuk z magazynu
            </button>
            {action === 'issue' && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <select value={selectedMagazyn} onChange={e => setSelectedMagazyn(e.target.value)} style={inputStyle}>
                  <option value="">Wybierz magazyn</option>
                  {powiazania.stanyAktywne.map(s => (
                    <option key={s.magazyn_id} value={s.magazyn_id}>
                      {s.magazyny?.nazwa} ({s.ilosc} szt.)
                    </option>
                  ))}
                </select>
                <input
                  type="number" min="1" max={maxIlosc}
                  value={ilosc}
                  onChange={e => setIlosc(+e.target.value)}
                  placeholder="Ilość"
                  style={inputStyle}
                />
                <select value={powod} onChange={e => setPowod(e.target.value)} style={inputStyle}>
                  {['korekta', 'zużycie', 'uszkodzone', 'wyrzucone', 'inne'].map(p => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <button
                  onClick={handleIssue}
                  disabled={saving || !selectedMagazyn}
                  style={actionBtnStyle('#d97706')}
                >
                  {saving ? 'Zapisuję...' : 'Zdejmij ze stanu'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Opcja 2: Archiwizuj */}
        <div style={optionStyle}>
          <button
            onClick={() => setAction(action === 'archive' ? null : 'archive')}
            style={optionBtnStyle}
          >
            Wyzeruj stany i zarchiwizuj towar
          </button>
          {action === 'archive' && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
                Towar zniknie z aktywnej listy. Historia ruchów zostaje.
                {powiazania.stanLaczny > 0 && (
                  <span style={{ color: '#f59e0b' }}> Zostanie wyzerowanych {powiazania.stanLaczny} szt.</span>
                )}
              </p>
              <button onClick={handleArchive} disabled={saving} style={actionBtnStyle('#6b7280')}>
                {saving ? 'Archiwizuję...' : 'Zarchiwizuj'}
              </button>
            </div>
          )}
        </div>

        {/* Opcja 3: Usuń definitywnie */}
        <div style={optionStyle}>
          <button
            onClick={() => powiazania.moznaUsunac && setAction(action === 'delete' ? null : 'delete')}
            style={{ ...optionBtnStyle, opacity: powiazania.moznaUsunac ? 1 : 0.5, cursor: powiazania.moznaUsunac ? 'pointer' : 'not-allowed' }}
          >
            Usuń definitywnie
            {!powiazania.moznaUsunac && (
              <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
                (niedostępne — produkt ma historię)
              </span>
            )}
          </button>
          {action === 'delete' && powiazania.moznaUsunac && (
            <div style={{ marginTop: 10 }}>
              <p style={{
                fontSize: 12, color: '#dc2626',
                background: 'rgba(220,38,38,0.08)',
                padding: '6px 10px', borderRadius: 6, marginBottom: 8,
              }}>
                Tej operacji nie można cofnąć!
              </p>
              <button onClick={handleDelete} disabled={saving} style={actionBtnStyle('#dc2626')}>
                {saving ? 'Usuwam...' : 'Tak, usuń definitywnie'}
              </button>
            </div>
          )}
        </div>

        <button onClick={onClose} style={{
          marginTop: 16, width: '100%',
          padding: '8px', borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-2)',
          cursor: 'pointer', fontSize: 13,
        }}>
          Anuluj
        </button>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 200,
}

const modalStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14, padding: 24, width: 460,
  maxHeight: '80vh', overflowY: 'auto',
}

const optionStyle = {
  border: '1px solid var(--border)',
  borderRadius: 8, padding: 12,
  marginBottom: 10,
}

const optionBtnStyle = {
  background: 'none', border: 'none',
  cursor: 'pointer', fontSize: 13,
  fontWeight: 500, color: 'var(--text)',
  textAlign: 'left', width: '100%', padding: 0,
}

const inputStyle = {
  width: '100%', padding: '7px 10px',
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 7, color: 'var(--text)',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

const actionBtnStyle = (color) => ({
  padding: '7px 14px',
  background: color, color: '#fff',
  border: 'none', borderRadius: 7,
  cursor: 'pointer', fontSize: 12,
  fontWeight: 500,
})
