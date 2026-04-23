import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'
import zhHK from '@/i18n/locales/zh-HK.json'

describe('tool locale definitions', () => {
  it('keeps the mortgage empty-state placeholder at the active top-level tools key', () => {
    expect(zhHK.tools.mortgage.results.placeholder).toBe('請輸入數值以顯示結果。')
    expect(en.tools.mortgage.results.placeholder).toBe('Enter values above to see results.')
  })

  it('provides a localized empty state for the resignation calculator', () => {
    expect(zhHK.tools.resignation.emptyState).toBe('請輸入遞信日期及通知期')
    expect(en.tools.resignation.emptyState).toBe(
      'Enter your resignation date and notice period to see the result.',
    )
  })
})
