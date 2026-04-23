import { vi } from 'vitest'

/**
 * Mocks node:crypto with deterministic values for testing.
 */
export function mockCrypto(overrides?: {
  randomBytesValue?: string
  scryptResult?: string
  hmacResult?: string
}) {
  const randomBytesValue = overrides?.randomBytesValue ?? 'a'.repeat(32)
  const scryptResult = overrides?.scryptResult ?? 'b'.repeat(64)
  const hmacResult = overrides?.hmacResult ?? 'c'.repeat(32)

  const mockRandomBytes = vi.fn((size: number, cb: (err: Error | null, buf: Buffer) => void) => {
    cb(null, Buffer.from(randomBytesValue.slice(0, size * 2), 'hex'))
  })

  const mockScrypt = vi.fn((
    _password: string | Buffer,
    _salt: string | Buffer,
    _keylen: number,
    _options: unknown,
    cb: (err: Error | null, derivedKey: Buffer) => void,
  ) => {
    cb(null, Buffer.from(scryptResult, 'hex'))
  })

  const mockTimingSafeEqual = vi.fn((_a: Buffer, _b: Buffer) => true)

  const mockCreateHmac = vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue(hmacResult),
  }))

  vi.doMock('node:crypto', () => ({
    randomBytes: mockRandomBytes,
    scrypt: mockScrypt,
    timingSafeEqual: mockTimingSafeEqual,
    createHmac: mockCreateHmac,
  }))

  vi.doMock('crypto', () => ({
    randomBytes: mockRandomBytes,
  }))

  return {
    mockRandomBytes,
    mockScrypt,
    mockTimingSafeEqual,
    mockCreateHmac,
  }
}
