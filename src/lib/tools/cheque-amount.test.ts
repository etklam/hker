import { describe, expect, it } from 'vitest'
import { convertToChequeAmount } from '@/lib/tools/cheque-amount'

describe('convertToChequeAmount', () => {
  it('uses singular cent when the decimal amount is exactly one cent', () => {
    const result = convertToChequeAmount(1000000.01)
    expect(result.english).toBe('One Million Dollars And One Cent Only')
  })

  it('uses singular dollar when the integer amount is exactly one dollar', () => {
    const result = convertToChequeAmount(1)
    expect(result.english).toBe('One Dollar Only')
  })
})
