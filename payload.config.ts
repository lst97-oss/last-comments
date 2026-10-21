import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'

import { migrations } from '@/migrations'
import { getServerEnv } from '@/server/env'
import { resolvePayloadServerUrl } from '@/server/security/payload-server-url'

const env = getServerEnv()
// import.meta.dir is Bun-only; the Payload CLI (generate:types,
// migrate:create) runs under Node, so fall back to import.meta.dirname.
const projectDirectory = import.meta.dir ?? import.meta.dirname
const projectPath = (relativePath: string) => `${projectDirectory}/${relativePath.replace(/^\.\//, '')}`

export default buildConfig({
  graphQL: {
    disable: true,
  },
  llmInstructions: false,
  maxDepth: 5,
  serverURL: resolvePayloadServerUrl(env),
  admin: {
    user: 'users',
    importMap: {
      importMapFile: projectPath('./src/payload-import-map.ts'),
    },
  },
  collections: [
    {
      slug: 'users',
      auth: true,
      authorship: false,
      admin: {
        useAsTitle: 'email',
      },
      fields: [],
    },
    {
      slug: 'media',
      upload: true,
      // Defaults to true; without this the migration also creates _media_v
      // version tables that nothing reads.
      versions: false,
      access: {
        read: () => true,
      },
      admin: {
        useAsTitle: 'filename',
      },
      fields: [
        {
          name: 'alt',
          type: 'text',
        },
      ],
    },
    {
      slug: 'posts',
      // Public blog reads; writes stay behind the Payload admin session.
      access: {
        read: () => true,
        create: ({ req }) => Boolean(req.user),
        update: ({ req }) => Boolean(req.user),
        delete: ({ req }) => Boolean(req.user),
      },
      // Both default to true; without them the migration would add _posts_v,
      // created_by and updated_by tables nobody asked for.
      authorship: false,
      versions: false,
      admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'status', 'publishedAt'],
        group: 'Blog',
      },
      hooks: {
        // Publishing registers the comment thread up front so the first
        // visitor never owns thread creation. Comment failures must not fail
        // the publish, so this swallows errors and only logs.
        afterChange: [
          async ({ doc, req }) => {
            const serverUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL
            const siteKey = process.env.BLOG_SITE_KEY
            const apiKey = process.env.BLOG_PUBLISHER_API_KEY
            if (!serverUrl || !siteKey || !apiKey) return
            if (doc.status !== 'published') return
            try {
              const response = await fetch(`${serverUrl}/api/admin/pages`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
                body: JSON.stringify({
                  site: siteKey,
                  url: `${serverUrl}/blog/${doc.slug}`,
                  pageKey: doc.slug,
                  title: doc.title,
                }),
              })
              if (!response.ok) {
                req.payload.logger.warn({
                  msg: 'Blog thread registration failed',
                  postSlug: doc.slug,
                  status: response.status,
                  body: await response.text(),
                })
              }
            } catch (cause) {
              req.payload.logger.warn({
                msg: 'Blog thread registration errored',
                postSlug: doc.slug,
                err: cause instanceof Error ? cause.message : String(cause),
              })
            }
          },
        ],
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          maxLength: 160,
        },
        {
          name: 'slug',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          admin: {
            description: 'URL path: /blog/<slug>. Also the stable comment-thread key.',
          },
        },
        {
          name: 'description',
          type: 'textarea',
          maxLength: 320,
        },
        {
          name: 'content',
          type: 'textarea',
          required: true,
          admin: {
            description: 'Markdown (GitHub-flavored). Raw HTML is stripped when rendered.',
          },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
          ],
        },
        {
          name: 'publishedAt',
          type: 'date',
          index: true,
          admin: {
            condition: (_data, siblingData) => siblingData?.status === 'published',
            description: 'Required when status is published. Future dates stay hidden on the blog.',
          },
          validate: (value, { siblingData }) => {
            const status = (siblingData as { status?: string } | undefined)?.status
            return status === 'published' && !value ? 'A publish date is required when the post is published.' : true
          },
        },
        {
          name: 'tags',
          type: 'array',
          maxRows: 12,
          fields: [
            {
              name: 'value',
              type: 'text',
              required: true,
              maxLength: 40,
            },
          ],
        },
        {
          name: 'cover',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'authorName',
          type: 'text',
          maxLength: 80,
        },
      ],
    },
  ],
  db: postgresAdapter({
    push: false,
    prodMigrations: migrations,
    pool: {
      connectionString: env.DATABASE_URL,
    },
  }),
  editor: lexicalEditor({}),
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: projectPath('./payload-types.ts'),
  },
  jobs: {
    tasks: [],
  },
})
