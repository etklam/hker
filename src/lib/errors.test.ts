import { describe, it, expect } from 'vitest'
import { apiError, AppError } from '@/lib/errors'
import type { ErrorCode } from '@/lib/errors'

describe('apiError', () => {
  const cases: [ErrorCode, number, string][] = [
    ['NOT_FOUND', 404, 'not found'],
    ['FORBIDDEN', 403, 'forbidden'],
    ['UNAUTHORIZED', 401, 'unauthorized'],
    ['INVALID_CREDENTIALS', 401, 'bad creds'],
    ['INVALID_REQUEST', 400, 'bad request'],
    ['CONFLICT', 409, 'conflict'],
    ['INTERNAL_ERROR', 500, 'internal'],
  ]

  it.each(cases)('returns status %i for code %s', async (code, expectedStatus, message) => {
    const response = apiError(code, message)
    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(expectedStatus)
    const body = await response.json()
    expect(body).toEqual({ code, message })
  })
})

describe('AppError', () => {
  it('has code and message properties', () => {
    const error = new AppError('FORBIDDEN', 'Access denied')
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('FORBIDDEN')
    expect(error.message).toBe('Access denied')
  })

  it('can be caught with instanceof', () => {
    const throwIt = () => { throw new AppError('NOT_FOUND', 'gone') }
    expect(throwIt).toThrow(AppError)
  })
})
