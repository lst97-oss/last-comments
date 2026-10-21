# The React Compiler and `'use memo'`

The build runs the React Compiler through `oxc-transform-react` in
**annotation mode** (`vite.config.ts` → `viteReact({ compiler: { target: '19',
compilationMode: 'annotation' } })`). In annotation mode only files that
opt in are compiled.

## The directive goes *inside* the function

```tsx
// ✓ the directive is the first statement in the function body
function ModerationPage() {
  'use memo'
  const { view } = Route.useSearch()
  …
}

// ✗ a file-level directive does nothing
'use memo'
import { … } from 'react'
```

A top-of-file `'use memo'` is a no-op: the compiler looks for the directive
as a *function* directive, and a module-level one is not one. The file also
loses its `'use client'` marker if you stack them in the wrong order —
`'use client'` must stay first in the file.

## Verify it actually compiled

Do not trust the directive; check the build output.

```bash
bun run build
# the compiled component's chunk imports the compiler runtime and uses a cache array
grep -o 'from"[^"]*compiler-runtime[^"]*"' .vercel/output/static/assets/<chunk>.js
grep -oE "[a-zA-Z_$]+\[[0-9]\]=" .vercel/output/static/assets/<chunk>.js
```

The compiled output looks like `const $ = _c(5);` with `$.push`-style cache
slots. If neither appears, the directive is in the wrong place.

A quick way to prove the pipeline works at all: transform a snippet
directly.

```bash
bun -e 'import {transform} from "oxc-transform-react";
const r = await transform("/tmp/p.tsx",
  `export function C(){ "use memo"; const [n,s]=useState(0); return <b onClick={()=>s(n+1)}>{n}</b> }`,
  { jsx: { runtime: "automatic" }, reactCompiler: { target: "19", compilationMode: "annotation" } });
console.log(r.code)'
```

If the output contains `import { c as _c } from "react/compiler-runtime"`,
the compiler is working and the directive placement is what matters.

## Which files opt in

Only files where the compiler buys something measurable:

- `src/routes/moderation.tsx` → `ModerationPage`
- `src/components/admin/sites-view.tsx` → `SitesView`

Keep it to those. The compiler is a client-bundle-only transform (the SSR
and RSC graphs are not compiled), and the annotation is per file.

## What the compiler does not replace

- It does not make an effect correct. `useEffect` + `fetch` stays a bug.
- It does not fix a missing `key`.
- It does not make a `useMemo` dependency right.
- It does not apply to `src/components/ui/**` (vendored shadcn/Base UI).

## `react-doctor` suppressions

`doctor.config.ts` records why a finding is suppressed. The compiler's own
hints (`react-hooks-js/todo`) only apply to files it actually compiles, so
the suppression list documents the annotation scope:

```ts
{
  // The React Compiler runs in annotation mode, so it only compiles
  // the files that opt in with 'use memo' (src/routes/moderation.tsx
  // and src/components/admin/sites-view.tsx). Everywhere else the
  // compiler's own hints describe code it never compiles.
  files: ['**/*.tsx'],
  rules: ['react-hooks-js/todo'],
}
```

When you add or remove an annotated file, update that comment — it is the
only place the scope is written down.
