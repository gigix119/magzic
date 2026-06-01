import InvoiceUploader from '../InvoiceUploader'

export default function InvoiceUpload({
  file, onFileSelect, onClear, onAnalyze,
  analyzing, analyzed, statusText,
  onSkipToManual,
}) {
  return (
    <div className="space-y-4">
      <InvoiceUploader
        file={file}
        onFileSelect={onFileSelect}
        onClear={onClear}
        onAnalyze={onAnalyze}
        analyzing={analyzing}
        analyzed={analyzed}
        statusText={statusText}
      />
      <div className="text-center pt-1">
        <button
          type="button"
          onClick={onSkipToManual}
          className="text-xs"
          style={{ color: 'var(--muted)' }}
        >
          Pomiń — wypełnij ręcznie
        </button>
      </div>
    </div>
  )
}
