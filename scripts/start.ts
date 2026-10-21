export {}

// Resolves the Nitro server entry for the active NITRO_PRESET so
// `bun run start` works regardless of preset: `node-server` emits
// .output/server/index.mjs (Docker sets NITRO_PRESET=node-server),
// the default `vercel` preset emits .vercel/output/functions/__server.func.
const preset = Bun.env.NITRO_PRESET ?? 'vercel'

const entry = preset === 'node-server' ? '.output/server/index.mjs' : '.vercel/output/functions/__server.func/index.mjs'

const file = Bun.file(entry)
if (!(await file.exists())) {
  console.error(`No build output at ${entry} for NITRO_PRESET=${preset}. Run \`bun run build\` first.`)
  process.exit(1)
}

const proc = Bun.spawn(['bun', entry], { stdio: ['inherit', 'inherit', 'inherit'] })
process.on('SIGINT', () => proc.kill('SIGINT'))
process.on('SIGTERM', () => proc.kill('SIGTERM'))
await proc.exited
process.exit(proc.exitCode ?? 0)
