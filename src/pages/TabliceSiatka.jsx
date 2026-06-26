import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Search, Plus, X, ChevronDown } from 'lucide-react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { useWorkspace } from '../context/WorkspaceContext'
import Spinner from '../components/Spinner'
import { useTablicaTheme } from '../lib/useTablicaTheme'
import { getBoardBackgroundStyle } from './tablice/tablicaTokens'

const COVER_COLORS = ['#0FA3B1', '#D9912E', '#B5483C', '#2B4A6F', '#5B4A9E', '#1F7A5C']

// ─── BoardCard — kafel tablicy 1:1 z referencji figma/src/app/App.tsx ──────────
function BoardCard({ board, onStarToggle, onClick }) {
  const [hovered, setHovered] = useState(false)
  const [starHovered, setStarHovered] = useState(false)
  const coverStyle = getBoardBackgroundStyle(board.kolor_tla, board.tlo_typ)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight: 112, borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        boxShadow: hovered ? '0 8px 28px rgba(0,0,0,0.45)' : '0 2px 10px rgba(0,0,0,0.30)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.14s, box-shadow 0.14s',
        position: 'relative',
      }}
    >
      <div style={{ flex: '0 0 75px', position: 'relative', ...coverStyle }}>
        <div style={{ position: 'absolute', inset: 0, background: hovered ? 'rgba(255,255,255,0.08)' : 'transparent', transition: 'background 0.14s' }} />
        <button
          onClick={e => { e.stopPropagation(); onStarToggle(board.id, board.ulubiona) }}
          onMouseEnter={() => setStarHovered(true)}
          onMouseLeave={() => setStarHovered(false)}
          aria-label={board.ulubiona ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          style={{
            position: 'absolute', top: 6, right: 6, width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: starHovered ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.25)',
            borderRadius: 6, border: 'none', cursor: 'pointer',
            opacity: board.ulubiona || hovered ? 1 : 0,
            transition: 'opacity 0.14s, background 0.14s',
          }}
        >
          <Star size={13} fill={board.ulubiona ? '#F5A524' : 'none'} stroke={board.ulubiona ? '#F5A524' : 'white'} strokeWidth={2} />
        </button>
      </div>
      <div style={{ flex: '0 0 37px', background: 'rgba(8,16,30,0.88)', backdropFilter: 'blur(4px)', padding: '0 10px', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--tb-text, #F4F8FB)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.35 }}>
          {board.nazwa}
        </span>
      </div>
    </div>
  )
}

// ─── CreateBoardTile — kafel „Utwórz nową tablicę" 1:1 z referencji ────────────
function CreateBoardTile({ onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight: 112, borderRadius: 12,
        background: hovered ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
        border: `1.5px dashed ${hovered ? 'rgba(55,160,201,0.60)' : 'rgba(255,255,255,0.28)'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: 'pointer', transition: 'background 0.14s, border-color 0.14s',
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 8, background: hovered ? 'rgba(55,160,201,0.20)' : 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.14s' }}>
        <Plus size={16} style={{ color: hovered ? 'var(--tb-accent, #37A0C9)' : 'var(--tb-text-muted, #A9BBC9)' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: hovered ? 'var(--tb-text, #F4F8FB)' : 'var(--tb-text-muted, #A9BBC9)', fontFamily: "'Inter', sans-serif" }}>Utwórz nową tablicę</span>
    </button>
  )
}

// ─── CreateBoardModal — 1:1 z referencji (bez selektora widoczności — decorative) ──
function CreateBoardModal({ onClose, onCreate, creating }) {
  const [title, setTitle] = useState('')
  const [selectedColor, setSelectedColor] = useState(COVER_COLORS[0])
  const canCreate = title.trim().length > 0 && !creating

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 100, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', zIndex: 101, top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 360, maxWidth: 'calc(100vw - 32px)',
        background: 'rgba(12,24,44,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.18)', borderTop: '1px solid rgba(255,255,255,0.28)',
        borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.65)', overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--tb-text, #F4F8FB)' }}>Utwórz tablicę</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'var(--tb-text-muted, #A9BBC9)' }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ width: '100%', height: 96, borderRadius: 10, overflow: 'hidden', marginBottom: 20, position: 'relative', background: selectedColor }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.12)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 12px', background: 'rgba(8,16,30,0.80)' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tb-text, #F4F8FB)' }}>{title || 'Tytuł tablicy'}</span>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--tb-text-muted, #A9BBC9)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Tytuł tablicy <span style={{ color: '#FF6B6B' }}>*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="np. Tablica Półwysep"
              autoFocus
              style={{
                width: '100%', height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.07)',
                border: `1px solid ${title ? 'rgba(55,160,201,0.60)' : 'rgba(255,255,255,0.18)'}`,
                color: 'var(--tb-text, #F4F8FB)', fontSize: 16, padding: '0 14px', outline: 'none',
                fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', transition: 'border 0.14s',
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--tb-text-muted, #A9BBC9)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tło</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {COVER_COLORS.map(c => {
                const isActive = selectedColor === c
                return (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    style={{ width: 40, height: 28, borderRadius: 7, background: c, border: isActive ? '2px solid var(--tb-accent, #37A0C9)' : '2px solid transparent', cursor: 'pointer', outline: isActive ? '2px solid rgba(55,160,201,0.35)' : 'none', outlineOffset: 1 }}
                  />
                )
              })}
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--tb-text-muted, #A9BBC9)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Widoczność</label>
            <button type="button" style={{ width: '100%', height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', color: 'var(--tb-text, #F4F8FB)', fontSize: 14, cursor: 'default' }}>
              <span>Przestrzeń robocza</span><ChevronDown size={14} style={{ color: 'var(--tb-text-muted, #A9BBC9)' }} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              disabled={!canCreate}
              onClick={() => onCreate(title.trim(), selectedColor)}
              style={{
                height: 48, borderRadius: 12, width: '100%',
                background: canCreate ? 'var(--tb-accent, #37A0C9)' : 'rgba(55,160,201,0.25)', border: 'none',
                cursor: canCreate ? 'pointer' : 'not-allowed', color: canCreate ? 'white' : 'rgba(255,255,255,0.35)',
                fontSize: 15, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif",
                transition: 'background 0.14s, color 0.14s',
              }}
            >
              {creating ? 'Tworzenie…' : title.trim() ? 'Utwórz' : 'Wpisz tytuł tablicy'}
            </button>
            <button onClick={onClose} style={{ height: 44, borderRadius: 12, width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--tb-text-muted, #A9BBC9)', fontSize: 14, cursor: 'pointer' }}>
              Anuluj
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function TabliceSiatka() {
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter } = useWorkspace()
  const navigate = useNavigate()
  const { theme: t } = useTablicaTheme()

  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  async function fetchData() {
    if (!workspaceId) { setLoading(false); return }
    const { data, error } = await addWsFilter(
      wsQuery('tablice').select('id, nazwa, kolor_tla, tlo_typ, ulubiona, pozycja')
    ).eq('archiwum', false).order('pozycja')
    if (error) addToast(error.message, 'error')
    else setBoards(data || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [workspaceId])

  const filteredBoards = useMemo(
    () => boards.filter(b => b.nazwa.toLowerCase().includes(search.trim().toLowerCase())),
    [boards, search]
  )
  const starred = useMemo(() => filteredBoards.filter(b => b.ulubiona), [filteredBoards])

  async function handleStarToggle(id, current) {
    setBoards(prev => prev.map(b => (b.id === id ? { ...b, ulubiona: !current } : b)))
    const { error } = await supabase.from('tablice').update({ ulubiona: !current }).eq('id', id)
    if (error) {
      addToast(error.message, 'error')
      setBoards(prev => prev.map(b => (b.id === id ? { ...b, ulubiona: current } : b)))
    }
  }

  async function handleCreate(nazwa, kolor) {
    setCreating(true)
    const { data: newId, error } = await supabase.rpc('utworz_tablice_z_szablonu', {
      p_workspace_id: workspaceId,
      p_typ: 'robocza',
      p_nazwa: nazwa,
    })
    if (error) {
      addToast(error.message, 'error')
      setCreating(false)
      return
    }
    await supabase.from('tablice').update({ kolor_tla: kolor, tlo_typ: 'solid' }).eq('id', newId)
    setCreating(false)
    setShowCreate(false)
    navigate(`/tablice/${newId}`)
  }

  if (loading) return <Spinner />

  return (
    <div
      className="rounded-2xl overflow-y-auto"
      style={{
        height: 'calc(100vh - 96px)',
        background: `linear-gradient(135deg, ${t.bg.deep} 0%, ${t.bg.mid} 55%, ${t.bg.tide} 100%)`,
        padding: '20px 16px 90px',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Lokalny toolbar — szukaj + Utwórz (bell/help/avatar są już w globalnym Topbarze) */}
      <div className="flex items-center gap-3 mb-7">
        <div
          className="flex items-center gap-2 flex-1"
          style={{ maxWidth: 420, height: 38, borderRadius: 10, padding: '0 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
        >
          <Search size={14} style={{ color: 'var(--tb-text-muted, #A9BBC9)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj tablic…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--tb-text, #F4F8FB)', fontSize: 14 }}
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="hidden sm:flex"
          style={{ height: 38, padding: '0 18px', borderRadius: 10, background: 'var(--tb-accent, #37A0C9)', border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", alignItems: 'center', gap: 6, boxShadow: '0 2px 10px rgba(55,160,201,0.40)', flexShrink: 0 }}
        >
          <Plus size={15} strokeWidth={2.5} />Utwórz
        </button>
      </div>

      {filteredBoards.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--tb-text, #F4F8FB)' }}>Brak tablic</p>
          <p style={{ fontSize: 12, maxWidth: 260, color: 'var(--tb-text-muted, #A9BBC9)' }}>Utwórz pierwszą tablicę, by zacząć organizować zadania w stylu Kanban.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 rounded-lg text-sm font-medium text-white mt-1"
            style={{ background: 'var(--tb-accent, #37A0C9)', minHeight: 44 }}
          >
            <Plus size={16} /> Nowa tablica
          </button>
        </div>
      ) : (
        <>
          {starred.length > 0 && (
            <div className="mb-9">
              <div className="flex items-center gap-2 mb-3.5">
                <Star size={17} fill="#F5A524" stroke="#F5A524" />
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--tb-text, #F4F8FB)' }}>Tablice oznaczone gwiazdką</span>
              </div>
              <div className="boards-grid">
                {starred.map(b => (
                  <BoardCard key={b.id} board={b} onStarToggle={handleStarToggle} onClick={() => navigate(`/tablice/${b.id}`)} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--tb-text-muted, #A9BBC9)', marginBottom: 12 }}>
              Twoje przestrzenie robocze
            </p>
            <div className="boards-grid">
              {filteredBoards.map(b => (
                <BoardCard key={b.id} board={b} onStarToggle={handleStarToggle} onClick={() => navigate(`/tablice/${b.id}`)} />
              ))}
              {!search && <CreateBoardTile onClick={() => setShowCreate(true)} />}
            </div>
          </div>
        </>
      )}

      {/* FAB — tylko mobile, zastępuje przycisk „Utwórz" z toolbara */}
      <button
        onClick={() => setShowCreate(true)}
        className="sm:hidden"
        style={{
          position: 'fixed', right: 20, bottom: 'max(80px, env(safe-area-inset-bottom, 24px))',
          width: 56, height: 56, borderRadius: '50%', background: 'var(--tb-accent, #37A0C9)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(55,160,201,0.55)', zIndex: 40,
        }}
      >
        <Plus size={24} color="white" strokeWidth={2.5} />
      </button>

      {showCreate && (
        <CreateBoardModal onClose={() => setShowCreate(false)} onCreate={handleCreate} creating={creating} />
      )}

      <style>{`
        .boards-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 640px) {
          .boards-grid { grid-template-columns: repeat(auto-fill, 200px); }
        }
      `}</style>
    </div>
  )
}
