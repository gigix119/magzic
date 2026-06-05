import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { BUSINESS_CATEGORIES, getSubcategoriesFor } from '../config/businessTypes'
import { Loader2 } from 'lucide-react'

export default function BusinessOnboarding() {
  const { workspace, refreshWorkspace } = useAuth()
  const navigate = useNavigate()

  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [companyName, setCompanyName] = useState(workspace?.name || '')
  const [nip, setNip] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!workspace || workspace.business_profile_completed) return null

  const subcategories = selectedCategory ? getSubcategoriesFor(selectedCategory) : []
  const isGeneral = selectedCategory === 'general'

  async function handleSave() {
    if (!selectedCategory) {
      setError('Wybierz branżę, aby kontynuować.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const subcategory = isGeneral
        ? 'general_inventory'
        : (selectedSubcategory || subcategories[0]?.id || null)

      const { error: updateErr } = await supabase
        .from('workspaces')
        .update({
          company_name: companyName.trim() || null,
          nip: nip.trim() || null,
          business_category: selectedCategory,
          business_subcategory: subcategory,
          business_profile_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', workspace.id)

      if (updateErr) throw updateErr
      await refreshWorkspace()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('[BusinessOnboarding] save error:', err)
      setError('Wystąpił błąd zapisu. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    setLoading(true)
    try {
      await supabase
        .from('workspaces')
        .update({
          business_category: 'general',
          business_subcategory: 'general_inventory',
          business_profile_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', workspace.id)
      await refreshWorkspace()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('[BusinessOnboarding] skip error:', err)
      await refreshWorkspace()
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      overflowY: 'auto',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20,
        width: '100%', maxWidth: 640,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        padding: '32px 28px',
        fontFamily: 'DM Sans, sans-serif',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
            Do czego chcesz używać Magzic?
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            Dopasujemy Alerty i Asystenta do Twojej branży.
          </p>
        </div>

        {/* Category grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 20,
        }}>
          {BUSINESS_CATEGORIES.map(cat => {
            const active = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id)
                  setSelectedSubcategory('')
                  setError('')
                }}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: active ? '2px solid #3b82f6' : '1.5px solid #e5e7eb',
                  background: active ? '#eff6ff' : '#fafafa',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.12s',
                  outline: 'none',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>{cat.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#1d4ed8' : '#374151', lineHeight: 1.3 }}>
                  {cat.label}
                </div>
              </button>
            )
          })}
        </div>

        {/* Subcategory selector */}
        {selectedCategory && !isGeneral && subcategories.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Rodzaj działalności
            </label>
            <select
              value={selectedSubcategory}
              onChange={e => setSelectedSubcategory(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 14,
                border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
                background: '#fff', color: '#111827', boxSizing: 'border-box',
              }}
            >
              <option value="">Wybierz rodzaj (opcjonalnie)</option>
              {subcategories.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Company name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
            Nazwa firmy / magazynu
          </label>
          <input
            type="text"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="np. Restauracja Pod Lipą"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 14,
              border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
              background: '#fff', color: '#111827', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* NIP */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
            NIP <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcjonalnie)</span>
          </label>
          <input
            type="text"
            value={nip}
            onChange={e => setNip(e.target.value)}
            placeholder="000-000-00-00"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 14,
              border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
              background: '#fff', color: '#111827', boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 14px',
            color: '#dc2626', fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            width: '100%', padding: '12px', background: loading ? '#93c5fd' : '#3b82f6',
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 12,
          }}
        >
          {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
          {loading ? 'Zapisywanie…' : 'Zapisz i przejdź do Magzic'}
        </button>

        <p style={{ textAlign: 'center', margin: 0 }}>
          <button
            onClick={handleSkip}
            disabled={loading}
            style={{
              background: 'none', border: 'none', color: '#6b7280',
              fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0,
            }}
          >
            Pomiń na razie
          </button>
        </p>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
