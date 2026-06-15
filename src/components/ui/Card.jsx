// Usage: <Card className="p-4">content</Card>
// White surface with 16 px radius and subtle shadow; hover deepens shadow.

export default function Card({ children, className = '', ...props }) {
  return (
    <div
      style={{
        background: 'var(--c-surface)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border)',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
      className={className}
      {...props}
    >
      {children}
    </div>
  )
}
