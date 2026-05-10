type PostgresClientWithSerializers = {
  options: {
    serializers: Record<string, (value: unknown) => unknown>
  }
}

const dateTypeOids = ['1184', '1082', '1083', '1114']
const jsonTypeOids = ['114', '3802']

export function serializeJsonDriverValue(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value) ?? 'null'
}

export function serializeDateDriverValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function installPostgresSerializerGuards(client: PostgresClientWithSerializers) {
  for (const type of dateTypeOids) {
    client.options.serializers[type] = serializeDateDriverValue
  }
  for (const type of jsonTypeOids) {
    client.options.serializers[type] = serializeJsonDriverValue
  }
}
