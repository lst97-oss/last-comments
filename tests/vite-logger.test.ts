import { describe, expect, spyOn, test } from 'bun:test'

import {
  classifyEnvRunnerLine,
  classifyViteLine,
  consolaLevel,
  routeEnvRunnerWarnings,
  viteLogger,
} from '../scripts/vite-logger'

describe('classifyEnvRunnerLine', () => {
  test('a missing OIDC token is a debug notice with the fix as a hint', () => {
    const line = classifyEnvRunnerLine(
      '\x1b[90m[env-runner]\x1b[39m VERCEL_OIDC_TOKEN is not set. Run vercel env pull to pull',
    )
    expect(line).toEqual({ level: 'debug', message: 'vercel.oidc_token.missing', fields: { hint: 'vercel env pull' } })
  })

  test('an expired token stays a warning and names when it expired', () => {
    const line = classifyEnvRunnerLine(
      '[env-runner] VERCEL_OIDC_TOKEN expired at 2026-11-03T04:00:00.000Z. Run vercel env pull',
    )
    expect(line).toMatchObject({
      level: 'warn',
      message: 'vercel.oidc_token.expired',
      fields: { expiredAt: '2026-11-03T04:00:00.000Z' },
    })
  })

  test('any other env-runner line is a warning with its own text', () => {
    expect(classifyEnvRunnerLine('[env-runner] virtual modules require a newline')).toEqual({
      level: 'warn',
      message: 'virtual modules require a newline',
      fields: {},
    })
  })
})

describe('routeEnvRunnerWarnings', () => {
  test('the raw notice does not reach the terminal, and other warnings pass through', () => {
    const original = console.warn
    const seen: unknown[][] = []
    console.warn = (...args: unknown[]) => {
      seen.push(args)
    }
    try {
      routeEnvRunnerWarnings()
      const withRoute = console.warn
      withRoute('[env-runner] VERCEL_OIDC_TOKEN is not set. Run vercel env pull')
      withRoute('a plain warning')
      expect(seen).toEqual([['a plain warning']])
    } finally {
      console.warn = original
    }
  })
})

describe('viteLogger', () => {
  test('a multi-line error is one entry, its later lines are the stack', () => {
    const previous = process.env.LOG_FORMAT
    process.env.LOG_FORMAT = 'json'
    const error = spyOn(console, 'error').mockImplementation(() => {})
    viteLogger().error('first\nsecond\nthird')
    expect(error).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({ msg: 'first', stack: 'second\nthird' })
    error.mockRestore()
    if (previous === undefined) delete process.env.LOG_FORMAT
    else process.env.LOG_FORMAT = previous
  })
})

describe('consolaLevel', () => {
  test('maps consola types onto the four levels', () => {
    expect(consolaLevel('fail')).toBe('error')
    expect(consolaLevel('warn')).toBe('warn')
    expect(consolaLevel('trace')).toBe('debug')
    expect(consolaLevel('success')).toBe('info')
  })
})

describe('classifyViteLine', () => {
  test('names the ready banner with its version and time', () => {
    expect(classifyViteLine('VITE v8.3.5  ready in 684 ms')).toEqual({
      message: 'vite.ready',
      fields: { version: '8.3.5', readyInMs: 684 },
    })
  })

  test('names the local URL', () => {
    expect(classifyViteLine('➜  Local:   http://localhost:3002/')).toEqual({
      message: 'vite.url',
      fields: { scope: 'local', url: 'http://localhost:3002/' },
    })
  })

  test('strips colour codes before matching', () => {
    expect(classifyViteLine('\x1b[32mVITE v8.3.5\x1b[39m  ready in 684 ms').message).toBe('vite.ready')
  })

  test('names a page reload and its file', () => {
    expect(classifyViteLine('page reload graphify-out/graph.html')).toEqual({
      message: 'vite.reload',
      fields: { file: 'graphify-out/graph.html', reason: undefined },
    })
  })

  test('sourcemap warnings about dependencies are debug', () => {
    expect(classifyViteLine('Sourcemap for "/app/node_modules/a/index.js" points to missing source files')).toEqual({
      message: 'vite.sourcemap',
      level: 'debug',
      fields: { file: '/app/node_modules/a/index.js' },
    })
  })

  test('help hints are debug', () => {
    expect(classifyViteLine('press h + enter to show help').level).toBe('debug')
  })

  test('a line no rule matches keeps its text as the message', () => {
    expect(classifyViteLine('something else entirely')).toEqual({ message: 'something else entirely', fields: {} })
  })
})
