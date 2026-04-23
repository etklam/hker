import { describe, expect, it } from 'vitest'
import { calculateLastDay } from '@/lib/tools/resignation'

describe('calculateLastDay', () => {
  it('returns distinct notice end date and last working day for fixed days', () => {
    const result = calculateLastDay({
      resignationDate: new Date('2026-04-23T00:00:00'),
      mode: 'days',
      value: 30,
    })

    expect(result.noticeEndDate.getFullYear()).toBe(2026)
    expect(result.noticeEndDate.getMonth()).toBe(4)
    expect(result.noticeEndDate.getDate()).toBe(23)

    expect(result.lastWorkingDay.getFullYear()).toBe(2026)
    expect(result.lastWorkingDay.getMonth()).toBe(4)
    expect(result.lastWorkingDay.getDate()).toBe(22)
  })

  it('clamps month-end dates and returns the previous day as last working day', () => {
    const result = calculateLastDay({
      resignationDate: new Date('2026-01-31T00:00:00'),
      mode: 'months',
      value: 1,
    })

    expect(result.noticeEndDate.getFullYear()).toBe(2026)
    expect(result.noticeEndDate.getMonth()).toBe(1)
    expect(result.noticeEndDate.getDate()).toBe(28)

    expect(result.lastWorkingDay.getFullYear()).toBe(2026)
    expect(result.lastWorkingDay.getMonth()).toBe(1)
    expect(result.lastWorkingDay.getDate()).toBe(27)
  })
})
