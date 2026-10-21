import { Link } from '@tanstack/react-router'

export function SiteNotFound() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>
        <Link to="/">Go home</Link>
      </p>
    </div>
  )
}
