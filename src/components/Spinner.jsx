export default function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="rounded-full animate-spin"
        style={{
          width: 28,
          height: 28,
          border: '2px solid var(--border)',
          borderTopColor: '#3b82f6',
        }}
      />
    </div>
  )
}
