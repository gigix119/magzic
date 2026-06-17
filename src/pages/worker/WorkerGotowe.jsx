import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import Spinner from '../../components/Spinner'
import { CheckCircle2, Package, CheckSquare, Image, Clock } from 'lucide-react'

function isoToday() { return new Date().toISOString().split('T')[0] }

export default function WorkerGotowe() {
  const navigate = useNavigate()
  const { workspaceId, wsQuery, addWsFilter } = useWorkspace()

  const [items, setItems] = useState([])
  const [pozMap, setPozMap] = useState({})
  const [checklistMap, setChecklistMap] = useState({})
  const [photoMap, setPhotoMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return }
    fetchData()
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true)
    const { data: zl } = await addWsFilter(
      wsQuery('zlecenia').select('*')
    ).eq('status', 'gotowe').eq('data_realizacji', isoToday()).order('updated_at', { ascending: false })

    const all = zl || []
    setItems(all)

    const ids = all.map(z => z.id)
    if (ids.length > 0) {
      const [{ data: poz }, { data: cl }, { data: ph }] = await Promise.all([
        supabase.from('zlecenia_pozycje').select('zlecenie_id, wydano').in('zlecenie_id', ids),
        supabase.from('checklist_items').select('zlecenie_id, checked').in('zlecenie_id', ids),
        supabase.from('preparation_photos').select('zlecenie_id').in('zlecenie_id', ids),
      ])

      const pMap = {}
      for (const p of poz || []) {
        if (!pMap[p.zlecenie_id]) pMap[p.zlecenie_id] = { total: 0, wydano: 0 }
        pMap[p.zlecenie_id].total++
        if (p.wydano) pMap[p.zlecenie_id].wydano++
      }
      setPozMap(pMap)

      const cMap = {}
      for (const c of cl || []) {
        if (!cMap[c.zlecenie_id]) cMap[c.zlecenie_id] = { total: 0, checked: 0 }
        cMap[c.zlecenie_id].total++
        if (c.checked) cMap[c.zlecenie_id].checked++
      }
      setChecklistMap(cMap)

      const phMap = {}
      for (const p of ph || []) phMap[p.zlecenie_id] = (phMap[p.zlecenie_id] || 0) + 1
      setPhotoMap(phMap)
    } else {
      setPozMap({}); setChecklistMap({}); setPhotoMap({})
    }
    setLoading(false)
  }

  if (loading) return <Spinner />

  return (
    <div>
      <h1 className="font-bold mb-4" style={{ fontSize: 20, color: 'var(--text)' }}>Gotowe dzisiaj</h1>

      {items.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
          <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="font-medium" style={{ color: 'var(--text)' }}>Jeszcze nic nie ukończono</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Zakończone zadania pojawią się tutaj.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {items.map(item => {
              const poz = pozMap[item.id] || { total: 0, wydano: 0 }
              const cl = checklistMap[item.id] || { total: 0, checked: 0 }
              const photoCount = photoMap[item.id] || 0
              const time = item.updated_at ? new Date(item.updated_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : null

              return (
                <div
                  key={item.id}
                  className="rounded-xl p-4 cursor-pointer"
                  style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}
                  onClick={() => navigate(`/pracownik/zadanie/${item.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{item.nazwa}</p>
                    {time && (
                      <span className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                        <Clock size={11} /> {time}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap text-xs" style={{ color: 'var(--text-2)' }}>
                    {poz.total > 0 && (
                      <span className="flex items-center gap-1"><Package size={12} /> {poz.wydano}/{poz.total} materiałów</span>
                    )}
                    {cl.total > 0 && (
                      <span className="flex items-center gap-1"><CheckSquare size={12} /> {cl.checked}/{cl.total} checklista</span>
                    )}
                    {photoCount > 0 && (
                      <span className="flex items-center gap-1"><Image size={12} /> {photoCount} zdjęć</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-center text-sm font-medium" style={{ color: 'var(--text-2)' }}>
            Dziś ukończono {items.length} {items.length === 1 ? 'przygotowanie' : 'przygotowania'} 🎉
          </p>
        </>
      )}
    </div>
  )
}
