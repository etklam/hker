import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseBody } from '@/schemas/parse-body'
import { AppError } from '@/lib/errors'

const testSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().positive('Age must be positive'),
  email: z.string().email('Invalid email').optional(),
})

describe('parseBody', () => {
  it('should return parsed data for valid body', () => {
    const body = { name: 'John', age: 25 }
    const result = parseBody(body, testSchema)
    expect(result).toEqual({ name: 'John', age: 25 })
  })

  it('should include optional fields when present', () => {
    const body = { name: 'John', age: 25, email: 'john@example.com' }
    const result = parseBody(body, testSchema)
    expect(result).toEqual({ name: 'John', age: 25, email: 'john@example.com' })
  })

  it('should throw AppError for missing required field', () => {
    const body = { age: 25 }
    try {
      parseBody(body, testSchema)
      expect.fail('Expected AppError to be thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      const err = e as AppError
      expect(err.code).toBe('INVALID_REQUEST')
      expect(err.message).toContain('name')
      expect(err.message).toContain('Invalid input')
    }
  })

  it('should throw AppError for wrong type', () => {
    const body = { name: 'John', age: 'not-a-number' }
    try {
      parseBody(body, testSchema)
      expect.fail('Expected AppError to be thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      const err = e as AppError
      expect(err.code).toBe('INVALID_REQUEST')
    }
  })

  it('should throw AppError for multiple validation errors', () => {
    const body = {}
    try {
      parseBody(body, testSchema)
      expect.fail('Expected AppError to be thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      const err = e as AppError
      expect(err.code).toBe('INVALID_REQUEST')
      expect(err.message).toContain('name')
      expect(err.message).toContain('age')
    }
  })

  it('should include field path in error message', () => {
    const nestedSchema = z.object({
      user: z.object({
        name: z.string().trim().min(1, 'Name is required'),
      }),
    })
    const body = { user: { name: '' } }
    try {
      parseBody(body, nestedSchema)
      expect.fail('Expected AppError to be thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      const err = e as AppError
      expect(err.code).toBe('INVALID_REQUEST')
      expect(err.message).toContain('user.name')
    }
  })
})
