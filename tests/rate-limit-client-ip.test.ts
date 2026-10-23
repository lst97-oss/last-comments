import { describe, expect, test } from 'bun:test'

import { isTrustedProxy, peerAddress, resolveClientIp } from '@/server/plugins/rate-limit/client-ip'

function requestWith(headers: Record<string, string>, peer?: string): Request {
  const request = new Request('http://localhost:3000/api/comments', { headers })
  if (peer) Object.defineProperty(request, 'ip', { value: peer, configurable: true })
  return request
}

describe('rate-limit client IP', () => {
  test('ignores a spoofed x-real-ip from a public peer', () => {
    const request = requestWith({ 'x-real-ip': '9.9.9.9' }, '203.0.113.7')
    expect(resolveClientIp(request)).toBe('203.0.113.7')
  })

  test('uses the ingress header when the peer is a trusted proxy', () => {
    expect(resolveClientIp(requestWith({ 'x-real-ip': '9.9.9.9' }, '127.0.0.1'))).toBe('9.9.9.9')
    expect(resolveClientIp(requestWith({ 'x-real-ip': '9.9.9.9' }, '10.1.2.3'))).toBe('9.9.9.9')
  })

  test('prefers the Cloudflare visitor IP over an injected x-real-ip', () => {
    const request = requestWith({ 'x-real-ip': '127.0.0.1', 'cf-connecting-ip': '9.9.9.9' }, '127.0.0.1')
    expect(resolveClientIp(request)).toBe('9.9.9.9')
  })

  test('treats an IPv4-mapped peer as its IPv4 address', () => {
    expect(resolveClientIp(requestWith({ 'x-real-ip': '9.9.9.9' }, '::ffff:127.0.0.1'))).toBe('9.9.9.9')
  })

  test('falls back to the header when the peer address is unknown', () => {
    expect(resolveClientIp(requestWith({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
    expect(resolveClientIp(requestWith({}))).toBeNull()
  })

  test('reads the Cloudflare client IP header from a trusted ingress', () => {
    // Cloudflare sends CF-Connecting-IP and never sets x-real-ip.
    expect(resolveClientIp(requestWith({ 'cf-connecting-ip': '9.9.9.9' }, '127.0.0.1'))).toBe('9.9.9.9')
    expect(resolveClientIp(requestWith({ 'cf-connecting-ip': '9.9.9.9' }, '203.0.113.7'))).toBe('203.0.113.7')
    expect(resolveClientIp(requestWith({ 'cf-connecting-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })

  test('honours an explicit trusted proxy list', () => {
    const request = requestWith({ 'x-real-ip': '9.9.9.9' }, '198.51.100.4')
    expect(resolveClientIp(request, { trustedCidrs: ['198.51.100.0/24'] })).toBe('9.9.9.9')
    expect(resolveClientIp(request, { trustedCidrs: ['*'] })).toBe('9.9.9.9')
    expect(resolveClientIp(request, { trustedCidrs: ['10.0.0.0/8'] })).toBe('198.51.100.4')
  })

  test('reads the peer address from the request or its h3 context', () => {
    expect(peerAddress(requestWith({}, '203.0.113.7'))).toBe('203.0.113.7')
    const request = requestWith({})
    Object.defineProperty(request, 'context', { value: { clientAddress: '203.0.113.8' }, configurable: true })
    expect(peerAddress(request)).toBe('203.0.113.8')
  })

  test('trusts a proxy only inside the configured networks', () => {
    expect(isTrustedProxy('127.0.0.1', ['127.0.0.0/8'])).toBe(true)
    expect(isTrustedProxy('172.20.0.4', ['172.16.0.0/12'])).toBe(true)
    expect(isTrustedProxy('8.8.8.8', ['127.0.0.0/8', '10.0.0.0/8'])).toBe(false)
  })
})
