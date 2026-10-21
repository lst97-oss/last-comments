export type DocsVersion = {
  label: string
  version: string
  href: string
  current?: boolean
}

export const docVersions: DocsVersion[] = [
  // Mirrors the latest `## vX.Y.Z` in CHANGELOG.md.
  { label: 'Latest Version', version: '0.2.0', href: '/docs', current: true },
]

export const currentDocVersion: DocsVersion = docVersions.find((entry) => entry.current) ?? docVersions[0]!
