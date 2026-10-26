// react-doctor suppressions. Every entry below has file evidence from a
// project-root scan; nothing is muted on suspicion.
// Fixed in code (do NOT re-add suppressions for these):
// - react-doctor/no-array-index-as-key on field.tsx (stable keys).
// - react-doctor/no-redundant-roles on pagination.tsx (native <nav>).
// Removed with the unused registry files (calendar/carousel/chart/command/
// input-otp/resizable/sonner/message-scroller/questionnaire): their
// carousel/chart/embla suppressions below. Re-add via `bunx shadcn add`
// if a route adopts them.
// Paths are listed in every form the scanner can emit (root scan prefixes
// `src/`; scoped scans strip it), otherwise a clean root scan hides findings
// that reappear under `react-doctor src`.
export default {
  lint: true,
  deadCode: true,
  verbose: false,
  blocking: 'error',
  respectInlineDisables: true,
  adoptExistingLintConfig: true,
  share: false,
  ignore: {
    files: [
      // Compiled build output (gitignored): react-dom's escaped
      // stringToPrecomputedChunk, Payload's ternary-only ASC/DESC sql.raw,
      // Nitro/AWS internals. Source-verified, not injectable.
      '.output/**',
      'output/**',
      // Generated router tree (gitignored, required by tsc + router).
      'src/routeTree.gen.ts',
      'routeTree.gen.ts',
      // Tracked graphify output (source snippets) and the gitignored Scalar bundle from
      // `generate:scalar`; neither is app code.
      'graphify-out/**',
      'public/scalar/**',
    ],
    overrides: [
      {
        // Registry-generated wrappers: only button + toast are exercised by
        // app code; findings here describe upstream shadcn/Base-UI shape.
        files: ['src/components/ui/**', 'components/ui/**', 'ui/**'],
        rules: [
          // cva variant maps + toast manager exports; rsc:false template.
          'react-doctor/only-export-components',
          // Base-UI internal role="link" (breadcrumb) / role="list" (item).
          'react-doctor/prefer-tag-over-role',
          // Compiler hints on render props (toast); annotation mode never
          // compiles these files.
          'react-hooks-js/todo',
          // ToastClose carries aria-label="Close toast" on the primitive;
          // single-site false positive.
          'react-doctor/shadcn-icon-button-requires-label',
        ],
      },
      {
        // The React Compiler runs in annotation mode, so it only compiles
        // the files that opt in with 'use memo' (src/routes/moderation.tsx
        // and src/components/admin/sites-view.tsx). Everywhere else the
        // compiler's own hints describe code it never compiles.
        files: ['**/*.tsx'],
        rules: ['react-hooks-js/todo'],
      },
    ],
  },
}
