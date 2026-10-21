import { Link } from '@tanstack/react-router'

// Inline styles match SiteNotFound — no design-system dependency on a crash path.
export function SiteError({ error, reset }: { error: unknown; reset: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Something went wrong</h1>
      <p>{message}</p>
      <p>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>{' '}
        <Link to="/">Go home</Link>
      </p>
    </div>
  )
}
