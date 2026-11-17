import { expect, test } from 'bun:test'

import { clientIp } from './clientIp'

test('ignores untrusted forwarding headers', () => {
  expect(clientIp('192.0.2.1', '198.51.100.1', [])).toBe('192.0.2.1')
})
test('takes the first untrusted hop from the right, excluding forged leftmost values', () => {
  expect(clientIp('192.0.2.1', '198.51.100.2, 198.51.100.3', ['192.0.2.1'])).toBe('198.51.100.3')
})
test('rejects malformed proxy chains', () => {
  expect(clientIp('192.0.2.1', 'forged', ['192.0.2.1'])).toBe('192.0.2.1')
})
test('prefers the configured edge client header when it holds a valid address', () => {
  expect(clientIp('10.0.0.1', '198.51.100.1', [], '203.0.113.7')).toBe('203.0.113.7')
})
test('falls back to the socket when the edge header is malformed', () => {
  expect(clientIp('10.0.0.1', undefined, [], 'forged')).toBe('10.0.0.1')
})
