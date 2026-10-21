import { toast } from '@/components/ui/toast'

export async function copyText(value: string, title: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title, type: 'success' })
  } catch {
    toast.add({ title: 'Could not copy to clipboard', description: value, type: 'error' })
  }
}
