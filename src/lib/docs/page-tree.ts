// A page tree node, reduced to the fields the sidebar renders. Everything
// here survives the server -> client boundary, so it must stay serializable.
export type SerializedDocsPageTreeNode = {
  name: string
  type?: string
  url?: string
  external?: boolean
  description?: string
  collapsible?: boolean
  defaultOpen?: boolean
  // Icon *names* only (frontmatter `icon:` / meta `icon:`). Elements are
  // resolved client-side (`lib/docs/icons.ts`) — neither elements nor their
  // component functions survive serialization.
  icon?: string
  index?: SerializedDocsPageTreeNode
  children?: SerializedDocsPageTreeNode[]
}

export type SerializedDocsPageTree = {
  $fumadocs_loader: 'page-tree'
  data: SerializedDocsPageTreeNode
}

// The page tree names are plain strings, but the client's
// `deserializePageTree()` rewrites them into React elements — in place, on
// the tree it is handed. Handing it the shared tree would therefore corrupt
// it for every later request. A name that is already an element (the tree
// was mutated) is reduced back to its text.
function nodeName(name: unknown): string {
  if (typeof name === 'string') return name
  if (typeof name === 'number') return String(name)
  if (typeof name === 'object' && name !== null && 'props' in name) {
    const props = name.props
    if (typeof props === 'object' && props !== null) {
      if ('dangerouslySetInnerHTML' in props) {
        const html = props.dangerouslySetInnerHTML
        if (typeof html === 'object' && html !== null && '__html' in html && typeof html.__html === 'string') {
          return html.__html
        }
      }
      if ('children' in props && typeof props.children === 'string') return props.children
    }
  }
  return ''
}

function copyNode(node: unknown): SerializedDocsPageTreeNode {
  if (typeof node !== 'object' || node === null) return { name: '' }
  const copy: SerializedDocsPageTreeNode = { name: 'name' in node ? nodeName(node.name) : '' }
  if ('type' in node && typeof node.type === 'string') copy.type = node.type
  if ('url' in node && typeof node.url === 'string') copy.url = node.url
  if ('external' in node && typeof node.external === 'boolean') copy.external = node.external
  if ('description' in node && typeof node.description === 'string') copy.description = node.description
  if ('collapsible' in node && typeof node.collapsible === 'boolean') copy.collapsible = node.collapsible
  if ('defaultOpen' in node && typeof node.defaultOpen === 'boolean') copy.defaultOpen = node.defaultOpen
  if ('icon' in node && typeof node.icon === 'string') copy.icon = node.icon
  if ('index' in node) copy.index = copyNode(node.index)
  if ('children' in node && Array.isArray(node.children)) copy.children = node.children.map(copyNode)
  return copy
}

// Fumadocs' `source.serializePageTree()` renders the tree's React nodes
// through `react-dom/server.edge`, which this app's import protection
// replaces with an empty module in the RSC graph, so it cannot be used.
// Icon *names* copy across untouched; elements resolve client-side — and the
// copy keeps the shared tree pristine, because the copy is what the client
// rewrites.
export function serializeDocsPageTree(tree: unknown): SerializedDocsPageTree {
  return { $fumadocs_loader: 'page-tree', data: copyNode(tree) }
}
