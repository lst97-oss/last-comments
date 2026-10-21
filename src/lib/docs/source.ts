import { loader } from 'fumadocs-core/source'
import { defineDocs } from 'fumadocs-mdx/macro'

// Macro collections are compiled statically: `defineDocs` must stay a
// top-level const with a literal `dir`, and it must never be re-exported
// from another module.
export const docs = defineDocs({
  dir: 'content/docs',
  docs: { async: true },
})

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
})
