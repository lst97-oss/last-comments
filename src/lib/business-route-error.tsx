import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function BusinessRouteError({ reset }: { error: unknown; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-svh w-full max-w-lg content-center gap-4 p-4 text-foreground">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          Something went wrong. Please try again.
          <Button variant="outline" className="mt-3" onClick={reset}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  )
}
