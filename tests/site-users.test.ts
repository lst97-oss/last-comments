import { describe, expect, test } from 'bun:test'

import { INITIAL_USER_DIRECTORY, type UserDirectoryState, userDirectoryReducer } from '@/lib/site-users'

const paged: UserDirectoryState = { ...INITIAL_USER_DIRECTORY, directoryPage: 3, blockedPage: 2 }

describe('userDirectoryReducer', () => {
  test('a new search returns both lists to their first page', () => {
    expect(userDirectoryReducer(paged, { type: 'search', search: 'ada' })).toEqual({
      ...paged,
      search: 'ada',
      directoryPage: 0,
      blockedPage: 0,
    })
  })

  test('a filter change returns only the directory to its first page', () => {
    expect(userDirectoryReducer(paged, { type: 'filter', filter: 'blocked' })).toEqual({
      ...paged,
      filter: 'blocked',
      directoryPage: 0,
    })
  })

  test('paging moves only its own cursor', () => {
    expect(userDirectoryReducer(paged, { type: 'directoryPage', page: 4 })).toEqual({ ...paged, directoryPage: 4 })
    expect(userDirectoryReducer(paged, { type: 'blockedPage', page: 1 })).toEqual({ ...paged, blockedPage: 1 })
  })
})
