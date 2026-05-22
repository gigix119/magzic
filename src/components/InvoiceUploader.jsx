import { useRef, useState } from 'react'
import { Upload, File, Table2, Image, X, RefreshCw } from 'lucide-react'

export default function InvoiceUploader({ file, onFileSelect, onClear, onAnalyze, analyzing, analyzed = false, statusText = '' }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFileSelect(f)
  }

  const ext = file ? file.name.split('.').pop().toLowerCase() : ''
  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
  const previewUrl = file && isImage ? URL.createObjectURL(file) : null

  return (
    <div className="flex flex-col gap-3">
      {!file && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 cursor-pointer rounded-2xl transition-colors"
          style={{
            border: `2px dashed ${dragging ? '#3b82f6' : 'var(--border)'}`,
            background: dragging ? 'rgba(59,130,246,0.06)' : 'var(--table-sub)',
            minHeight: 220,
            padding: 32,
          }}
        >
          <div className="rounded-full flex items-center justify-center" style={{ width: 56, height: 56, background: 'rgba(59,130,246,0.1)' }}>
            <Upload size={24} style={{ color: '#3b82f6' }} />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>
              Przeciągnij plik lub kliknij aby wybrać
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              PDF, JPG, PNG, WEBP, CSV, XLSX · max 10 MB
            </p>
          </div>
        </div>
      )}

      {file && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--table-sub)' }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            {ext === 'pdf'
              ? <File size={14} style={{ color: '#f87171' }} />
              : (ext === 'csv' || ext === 'xlsx')
                ? <Table2 size={14} style={{ color: '#4ade80' }} />
                : <Image size={14} style={{ color: '#60a5fa' }} />}
            <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-2)' }}>{file.name}</span>
            <button type="button" onClick={onClear} style={{ color: 'var(--muted)' }} title="Usuń plik">
              <X size={14} />
            </button>
          </div>

          {isImage && previewUrl ? (
            <div className="flex items-center justify-center p-3" style={{ minHeight: 160 }}>
              <img
                src={previewUrl}
                alt="Podgląd faktury"
                style={{ maxHeight: 220, maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8" style={{ color: 'var(--muted)' }}>
              {ext === 'pdf'
                ? <File size={36} style={{ color: '#f87171', opacity: 0.5 }} />
                : <Table2 size={36} style={{ color: '#4ade80', opacity: 0.5 }} />}
              <p className="text-xs">{ext.toUpperCase()} — podgląd niedostępny</p>
            </div>
          )}
        </div>
      )}

      {file && (
        <div>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={analyzing}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white w-full"
            style={{
              background: analyzing ? '#94a3b8' : '#3b82f6',
              cursor: analyzing ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {analyzing ? '⏳' : analyzed ? <RefreshCw size={15} /> : '📄'}
            {analyzing
              ? (statusText || 'Odczytuję dokument…')
              : analyzed
                ? 'Ponów odczyt'
                : 'Odczytaj dokument'}
          </button>
          <p className="text-xs mt-1.5" style={{ color: '#64748b' }}>
            Obsługuje PDF z warstwą tekstową. Możesz też wypełnić formularz ręcznie.
          </p>
        </div>
      )}

      {file && !analyzing && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs text-center"
          style={{ color: 'var(--muted)' }}
        >
          Zmień plik
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.csv,.xlsx,.jpg,.jpeg,.png,.webp"
        onChange={e => {
          const f = e.target.files[0]
          if (f) onFileSelect(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
