import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

import { BusinessRouteError } from '@/lib/business-route-error'

describe('BusinessRouteError', () => {
  test('does not render an unexpected exception message', () => {
    const html = renderToStaticMarkup(
      React.createElement(BusinessRouteError, {
        error: new Error('private database connection details'),
        reset: () => {},
      }),
    )
    expect(html).not.toContain('private database connection details')
    expect(html).toContain('Something went wrong. Please try again.')
    expect(html).toContain('Try again')
  })
})
