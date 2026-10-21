import {
  Atom,
  BookOpen,
  Braces,
  Code,
  Download,
  Eye,
  Fingerprint,
  Hexagon,
  KeyRound,
  Layers,
  LayoutGrid,
  List,
  Palette,
  Puzzle,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Type,
} from 'lucide-react'
import { type ComponentType, createElement } from 'react'

// Sidebar icons. Pages declare `icon: <Name>` in MDX frontmatter (folders in
// `meta.json`); the loader leaves those strings raw, `page-tree.ts` carries
// them through serialization as strings, and `withDocTreeIcons` resolves them
// to elements on the client — React elements (and their component `type`
// functions) can never cross the server boundary, so resolution must happen
// here, keyed by an explicit allowlist. Unknown names resolve to no icon
// rather than crashing the sidebar.
const DOC_ICONS = {
  Atom,
  BookOpen,
  Braces,
  Code,
  Download,
  Eye,
  Fingerprint,
  Hexagon,
  KeyRound,
  Layers,
  LayoutGrid,
  List,
  Palette,
  Puzzle,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Type,
} satisfies Record<string, ComponentType<{ className?: string }>>

export type DocIconName = keyof typeof DOC_ICONS

export function resolveDocIcon(name: string | undefined) {
  if (!name || !(name in DOC_ICONS)) return undefined
  const Icon = DOC_ICONS[name as DocIconName]
  return createElement(Icon, { className: 'size-4 shrink-0' })
}

// Fumadocs' `deserializePageTree` wraps raw icon strings in a
// `<span dangerouslySetInnerHTML>` before we see the tree, so the name may
// arrive either as a string (serialized) or as that span (deserialized).
// Only bare names resolve — markup never becomes a component.
function iconNameOf(icon: unknown): string | undefined {
  if (typeof icon === 'string') return icon
  if (typeof icon === 'object' && icon !== null && 'props' in icon) {
    const props = (icon as { props?: unknown }).props
    if (typeof props === 'object' && props !== null && 'dangerouslySetInnerHTML' in props) {
      const html = (props as { dangerouslySetInnerHTML?: unknown }).dangerouslySetInnerHTML
      if (typeof html === 'object' && html !== null && '__html' in html) {
        const text = (html as { __html?: unknown }).__html
        if (typeof text === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(text.trim())) return text.trim()
      }
    }
  }
  return undefined
}

type IconNode = { icon?: unknown; children?: IconNode[] }

export function withDocTreeIcons<T extends IconNode>(node: T): T {
  const name = iconNameOf(node.icon)
  return {
    ...node,
    icon: name ? (resolveDocIcon(name) ?? undefined) : undefined,
    children: node.children?.map(withDocTreeIcons),
  }
}
