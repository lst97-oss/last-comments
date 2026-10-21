/**
 * Copy the Scalar standalone browser bundle into `public/scalar/`, so the API
 * reference pages are self-hosted: the Scalar UI is served from this origin
 * instead of a CDN.
 *
 * The standalone build is self-contained — its CSS is embedded and it loads no
 * chunks — so one file is enough.
 */

export {}

const SOURCE = 'node_modules/@scalar/api-reference/dist/browser/standalone.js'
const TARGET_DIR = 'public/scalar'
const TARGET = `${TARGET_DIR}/standalone.js`

async function main(): Promise<void> {
  const source = Bun.file(SOURCE)
  if (!(await source.exists())) {
    console.error(`Missing ${SOURCE}. Run \`bun install\` first.`)
    process.exit(1)
  }

  await Bun.write(TARGET, source)
  const bytes = (await Bun.file(TARGET).size) ?? 0
  console.info(JSON.stringify({ event: 'scalar.standalone.copied', target: TARGET, bytes }))
}

await main()
