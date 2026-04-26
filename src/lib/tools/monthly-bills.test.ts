import { describe, expect, it } from 'vitest'
import {
  buildMonthlyBillEntries,
  calculateMonthlyBillSummary,
  formatHKD,
  getDueDateForMonth,
  getRelativeMonthKey,
  parseAmountToCents,
  setMonthlyBillChecked,
  type MonthlyBillTemplate,
} from './monthly-bills'

const templates: MonthlyBillTemplate[] = [
  {
    id: 'card',
    name: 'Credit Card',
    dueDay: 31,
    amountCents: 120050,
    note: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'phone',
    name: 'Phone',
    dueDay: 8,
    amountCents: null,
    note: 'Autopay',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
]

describe('monthly bill helpers', () => {
  it('clamps the due day to the end of short months', () => {
    expect(getDueDateForMonth('2026-02', 31)).toBe('2026-02-28')
    expect(getDueDateForMonth('2028-02', 31)).toBe('2028-02-29')
  })

  it('moves between months across year boundaries', () => {
    expect(getRelativeMonthKey('2026-01', -1)).toBe('2025-12')
    expect(getRelativeMonthKey('2026-12', 1)).toBe('2027-01')
  })

  it('parses and formats HKD cents', () => {
    expect(parseAmountToCents('1,234.50')).toBe(123450)
    expect(parseAmountToCents('88')).toBe(8800)
    expect(parseAmountToCents('12.345')).toBeNull()
    expect(formatHKD(123450)).toBe('HK$1,234.50')
    expect(formatHKD(8800)).toBe('HK$88')
  })

  it('scopes checked state by month', () => {
    const checked = setMonthlyBillChecked({}, 'card', '2026-04', true, new Date('2026-04-02T00:00:00Z'))
    expect(checked.card['2026-04']).toBe('2026-04-02T00:00:00.000Z')

    const entriesForApril = buildMonthlyBillEntries(templates, checked, '2026-04', new Date('2026-04-10'))
    const entriesForMay = buildMonthlyBillEntries(templates, checked, '2026-05', new Date('2026-05-10'))

    expect(entriesForApril.find((entry) => entry.id === 'card')?.status).toBe('paid')
    expect(entriesForMay.find((entry) => entry.id === 'card')?.status).not.toBe('paid')
  })

  it('summarises paid, unpaid, overdue, and amounts', () => {
    const checked = setMonthlyBillChecked({}, 'phone', '2026-04', true, new Date('2026-04-08T00:00:00Z'))
    const entries = buildMonthlyBillEntries(templates, checked, '2026-04', new Date('2026-05-01'))
    const summary = calculateMonthlyBillSummary(entries)

    expect(summary.totalCount).toBe(2)
    expect(summary.paidCount).toBe(1)
    expect(summary.unpaidCount).toBe(1)
    expect(summary.overdueCount).toBe(1)
    expect(summary.totalAmountCents).toBe(120050)
    expect(summary.unpaidAmountCents).toBe(120050)
  })
})
