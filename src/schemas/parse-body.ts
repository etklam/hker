import { ZodSchema, ZodError } from 'zod'
import { AppError } from '@/lib/errors'

export function parseBody<T>(body: unknown, schema: ZodSchema<T>): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = formatZodError(result.error)
    throw new AppError('INVALID_REQUEST', message)
  }
  return result.data
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join('; ')
}
