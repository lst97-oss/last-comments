import config from '@payload-config'
import { expect, test } from 'bun:test'
import { BasePayload } from 'payload'

test('Payload schema matches the latest migration without connecting to the database', async () => {
  const sanitized = await config
  const payload = await new BasePayload().init({
    config: { ...sanitized, typescript: { ...sanitized.typescript, autoGenerate: false } },
    disableDBConnect: true,
    disableOnInit: true,
  })
  const snapshots = [...new Bun.Glob('*.json').scanSync({ cwd: 'src/migrations' })].sort()
  const snapshot = await Bun.file(`src/migrations/${snapshots.at(-1)}`).json()
  const { generateDrizzleJson, generateMigration } = payload.db.requireDrizzleKit()
  const current = await generateDrizzleJson(payload.db.schema)

  expect(await generateMigration(snapshot, current)).toEqual([])
})
