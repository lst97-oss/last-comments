// Runs `work` and rejects with `onTimeout()` if it has not settled within `ms`. The work gets a signal that
// aborts at the same moment, so a slow plugin hook can stop early.
export async function withTimeout<T>(
  ms: number,
  work: (signal: AbortSignal) => Promise<T>,
  onTimeout: () => unknown,
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(onTimeout())
        }, ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
