type PostgresClientWithSerializers = {
  options: {
    serializers: Record<string, (value: unknown) => unknown>
  }
}

// Comprehensive OID coverage for postgres.js driver value serialization
// All serializers MUST return string to satisfy the wire protocol writer

const dateTypeOids = ['1082', '1083', '1114', '1184']
const jsonTypeOids = ['114', '3802']
const booleanTypeOids = ['16']

export function serializeJsonDriverValue(value: unknown): string {
  return JSON.stringify(value) ?? 'null'
}

export function serializeDateDriverValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function serializeBooleanDriverValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 't' : 'f'
  return String(value)
}

export function installPostgresSerializerGuards(client: PostgresClientWithSerializers) {
  for (const type of dateTypeOids) {
    client.options.serializers[type] = serializeDateDriverValue
  }
  for (const type of jsonTypeOids) {
    client.options.serializers[type] = serializeJsonDriverValue
  }
  for (const type of booleanTypeOids) {
    client.options.serializers[type] = serializeBooleanDriverValue
  }
}
