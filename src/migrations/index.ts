import * as migration_20261011_initial_users_schema from '@/migrations/20261011_initial-users-schema'
import * as migration_20261018_113111_posts_and_media from '@/migrations/20261018_113111_posts-and-media'
import * as migration_20261018_114615_media_versions_drop from '@/migrations/20261018_114615_media-versions-drop'

export const migrations = [
  {
    up: migration_20261011_initial_users_schema.up,
    down: migration_20261011_initial_users_schema.down,
    name: '20261011_initial-users-schema',
  },
  {
    up: migration_20261018_113111_posts_and_media.up,
    down: migration_20261018_113111_posts_and_media.down,
    name: '20261018_113111_posts-and-media',
  },
  {
    up: migration_20261018_114615_media_versions_drop.up,
    down: migration_20261018_114615_media_versions_drop.down,
    name: '20261018_114615_media-versions-drop',
  },
]
