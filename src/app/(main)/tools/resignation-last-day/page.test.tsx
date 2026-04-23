import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

let language = 'en'

const translations: Record<string, string> = {
  'tools.backToTools': 'Back to Tools',
  'tools.resignation.title': 'Last Day Calculator',
  'tools.resignation.description': 'Description',
  'tools.resignation.emptyState': 'Enter your resignation date and notice period to see the result.',
  'tools.resignation.resignationDate': 'Resignation Date',
  'tools.resignation.noticeMode': 'Notice Period Type',
  'tools.resignation.modeDays': 'Fixed Days',
  'tools.resignation.modeMonths': 'Fixed Months',
  'tools.resignation.noticePeriod': 'Notice Period',
  'tools.resignation.noticeDaysUnit': 'days',
  'tools.resignation.noticeMonthsUnit': 'month(s)',
  'tools.resignation.monthNote': 'Month note',
  'tools.resignation.results.title': 'Result',
  'tools.resignation.results.lastWorkingDay': 'Last Working Day',
  'tools.resignation.results.noticeEndDate': 'Notice Period End Date',
  'tools.resignation.resultSentence': 'Result sentence',
  'tools.resignation.disclaimer': 'Disclaimer',
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
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

describe('ResignationPage', () => {
  beforeEach(() => {
    language = 'en'
  })

  it('renders an English empty state instead of a hard-coded Chinese string', async () => {
    const mod = await import('@/app/(main)/tools/resignation-last-day/page')
    const ResignationPage = mod.default

    render(<ResignationPage />)

    expect(
      screen.getByText('Enter your resignation date and notice period to see the result.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('請輸入遞信日期及通知期')).not.toBeInTheDocument()
  })
})
