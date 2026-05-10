import { describe, expect, it } from 'vitest'

import {
  installPostgresSerializerGuards,
  serializeDateDriverValue,
  serializeJsonDriverValue,
} from './postgres-serializers'

describe('postgres serializer guards', () => {
  it('keeps Drizzle JSON strings unchanged', () => {
    expect(serializeJsonDriverValue('{"count":1}')).toBe('{"count":1}')
  })

  it('serializes typed JSON scalar values before Postgres.js writes them', () => {
    expect(serializeJsonDriverValue(1)).toBe('1')
    expect(serializeJsonDriverValue(true)).toBe('true')
  })

  it('serializes date-like values before Postgres.js writes them', () => {
    expect(serializeDateDriverValue(new Date('2026-05-10T00:00:00.000Z'))).toBe('2026-05-10T00:00:00.000Z')
    expect(serializeDateDriverValue('2026-05-10T00:00:00.000Z')).toBe('2026-05-10T00:00:00.000Z')
  })

  it('installs guards for Drizzle-overridden Postgres.js serializers', () => {
    const client = {
      options: {
        serializers: {
          '114': (value: unknown) => value,
          '3802': (value: unknown) => value,
          '1184': (value: unknown) => value,
        },
      },
    }

    installPostgresSerializerGuards(client)

    expect(client.options.serializers['114'](1)).toBe('1')
    expect(client.options.serializers['3802']({ ok: true })).toBe('{"ok":true}')
    expect(client.options.serializers['1184'](new Date('2026-05-10T00:00:00.000Z'))).toBe(
      '2026-05-10T00:00:00.000Z',
    )
  })
})
