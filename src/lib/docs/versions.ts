export type DocsVersion = {
  label: string
  version: string
  href: string
  current?: boolean
}

export const docVersions: DocsVersion[] = [
  // Names the minor line, so a patch release needs no edit here.
  { label: 'Latest Version', version: '0.3.x', href: '/docs', current: true },
]

export const currentDocVersion: DocsVersion = docVersions.find((entry) => entry.current) ?? docVersions[0]!
