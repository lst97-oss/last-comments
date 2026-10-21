'use client'

import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { ArrowUpRight, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { signOut, useSessionPrincipal } from '@/lib/business-auth-client'

export function AuthButton({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'default' | 'lg' }) {
  const { principal, isPending } = useSessionPrincipal()
  if (isPending) {
    return (
      <Button disabled size={size} className={cn('ml-auto shrink-0', className)}>
        Sign in
        <ArrowUpRight data-icon="inline-end" />
      </Button>
    )
  }
  if (!principal) {
    return (
      <Button size={size} className={cn('ml-auto shrink-0', className)} render={<Link to="/dashboard" />}>
        Sign in
        <ArrowUpRight data-icon="inline-end" />
      </Button>
    )
  }
  return (
    <span className={cn('ml-auto flex shrink-0 items-center gap-1', className)}>
      <Link
        to="/dashboard"
        title={principal.email ?? undefined}
        className="max-w-28 truncate text-sm text-muted-foreground hover:text-foreground"
      >
        {principal.displayName ?? principal.email ?? 'Account'}
      </Link>
      <Button aria-label="Sign out" title="Sign out" size="icon-sm" variant="ghost" onClick={() => void signOut()}>
        <LogOut aria-hidden />
      </Button>
    </span>
  )
}
