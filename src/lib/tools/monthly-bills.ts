export type MonthlyBillStatus = 'paid' | 'overdue' | 'dueToday' | 'upcoming'

export interface MonthlyBillTemplate {
  id: string
  name: string
  dueDay: number
  amountCents: number | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export type MonthlyBillChecks = Record<string, Record<string, string>>

export interface MonthlyBillEntry extends MonthlyBillTemplate {
  month: string
  dueDate: string
  checkedAt: string | null
  status: MonthlyBillStatus
}

export interface MonthlyBillSummary {
  totalCount: number
  paidCount: number
  unpaidCount: number
  overdueCount: number
  dueTodayCount: number
  totalAmountCents: number
  unpaidAmountCents: number
}

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function getCurrentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function isValidMonthKey(month: string): boolean {
  return MONTH_KEY_RE.test(month)
}

export function getRelativeMonthKey(month: string, offset: number): string {
  if (!isValidMonthKey(month)) {
    throw new Error('Invalid month key')
  }

  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1 + offset, 1)
  return getCurrentMonthKey(date)
}

export function getDaysInMonth(month: string): number {
  if (!isValidMonthKey(month)) {
    throw new Error('Invalid month key')
  }

  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

export function getDueDateForMonth(month: string, dueDay: number): string {
  if (!isValidMonthKey(month)) {
    throw new Error('Invalid month key')
  }
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error('Invalid due day')
  }

  const day = Math.min(dueDay, getDaysInMonth(month))
  return `${month}-${pad2(day)}`
}

export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '')
  if (!trimmed) return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null

  const [dollars, cents = ''] = trimmed.split('.')
  return Number(dollars) * 100 + Number(cents.padEnd(2, '0'))
}

export function formatHKD(cents: number | null): string {
  if (cents === null) return ''
  return 'HK$' + (cents / 100).toLocaleString('en-HK', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function getMonthlyBillStatus(
  dueDate: string,
  checkedAt: string | null,
  today = new Date(),
): MonthlyBillStatus {
  if (checkedAt) return 'paid'

  const todayKey = formatDateKey(today)
  if (dueDate < todayKey) return 'overdue'
  if (dueDate === todayKey) return 'dueToday'
  return 'upcoming'
}

export function buildMonthlyBillEntries(
  templates: MonthlyBillTemplate[],
  checks: MonthlyBillChecks,
  month: string,
  today = new Date(),
): MonthlyBillEntry[] {
  return templates
    .map((template) => {
      const dueDate = getDueDateForMonth(month, template.dueDay)
      const checkedAt = checks[template.id]?.[month] ?? null
      return {
        ...template,
        month,
        dueDate,
        checkedAt,
        status: getMonthlyBillStatus(dueDate, checkedAt, today),
      }
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name))
}

export function setMonthlyBillChecked(
  checks: MonthlyBillChecks,
  billId: string,
  month: string,
  checked: boolean,
  now = new Date(),
): MonthlyBillChecks {
  if (!isValidMonthKey(month)) {
    throw new Error('Invalid month key')
  }

  const next: MonthlyBillChecks = { ...checks }
  const monthChecks = { ...(next[billId] ?? {}) }

  if (checked) {
    monthChecks[month] = now.toISOString()
    next[billId] = monthChecks
    return next
  }

  delete monthChecks[month]
  if (Object.keys(monthChecks).length === 0) {
    delete next[billId]
  } else {
    next[billId] = monthChecks
  }
  return next
}

export function calculateMonthlyBillSummary(entries: Array<{ amountCents: number | null; status: MonthlyBillStatus }>): MonthlyBillSummary {
  return entries.reduce<MonthlyBillSummary>((summary, entry) => {
    const amount = entry.amountCents ?? 0
    summary.totalCount += 1
    summary.totalAmountCents += amount

    if (entry.status === 'paid') {
      summary.paidCount += 1
      return summary
    }

    summary.unpaidCount += 1
    summary.unpaidAmountCents += amount
    if (entry.status === 'overdue') summary.overdueCount += 1
    if (entry.status === 'dueToday') summary.dueTodayCount += 1
    return summary
  }, {
    totalCount: 0,
    paidCount: 0,
    unpaidCount: 0,
    overdueCount: 0,
    dueTodayCount: 0,
    totalAmountCents: 0,
    unpaidAmountCents: 0,
  })
}
