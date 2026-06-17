import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

let language = 'en'

const translations: Record<string, string> = {
  'tools.monthlyBills.title': 'Monthly Bill Checklist',
  'tools.monthlyBills.description': 'Track monthly bills, due dates, and payment status.',
  'tools.monthlyBills.loginRequired':
    'Log in to save monthly bill lists across devices and share them with a space.',
  'tools.monthlyBills.month': 'Month',
  'tools.monthlyBills.previousMonth': 'Previous month',
  'tools.monthlyBills.nextMonth': 'Next month',
  'tools.monthlyBills.addBill': 'Add Bill',
  'tools.monthlyBills.editBill': 'Edit Bill',
  'tools.monthlyBills.empty': 'No monthly bills yet. Add one to get started.',
  'tools.monthlyBills.fields.name': 'Bill name',
  'tools.monthlyBills.fields.dueDay': 'Day of month',
  'tools.monthlyBills.fields.amount': 'Amount (HK$)',
  'tools.monthlyBills.fields.note': 'Note',
  'tools.monthlyBills.placeholders.name': 'e.g. credit card, phone bill',
  'tools.monthlyBills.placeholders.note': 'e.g. autopay, payment method, account suffix',
  'tools.monthlyBills.summary.month': 'Month',
  'tools.monthlyBills.summary.paid': 'Paid',
  'tools.monthlyBills.summary.unpaidAmount': 'Unpaid amount',
  'tools.monthlyBills.summary.overdue': 'Due/overdue',
  'common.create': 'Create',
  'common.login': 'Log In',
  'common.update': 'Update',
}

function translate(key: string) {
  return translations[key] ?? key
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
    i18n: { language },
  }),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: { children: ReactNode; href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/toast', () => ({
  pushToast: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}))

vi.mock('@/lib/api-client', () => ({
  api: vi.fn(),
}))

describe('MonthlyBillsPage', () => {
  beforeEach(() => {
    language = 'en'
  })

  it('renders a localized login prompt for durable bill lists', async () => {
    const mod = await import('@/app/(main)/bills/page')
    const MonthlyBillsPage = mod.default

    render(<MonthlyBillsPage />)

    expect(screen.getByText('Monthly Bill Checklist')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Log in to save monthly bill lists across devices and share them with a space.',
      ),
    ).toBeInTheDocument()
  })
})
