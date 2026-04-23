export interface ChequeAmountResult {
  chinese: string
  english: string
}

export function validateChequeAmount(raw: string): string | null {
  if (raw.trim() === '' || isNaN(Number(raw))) {
    return 'tools.chequeAmount.errors.invalidAmount'
  }
  const decimalIndex = raw.indexOf('.')
  if (decimalIndex !== -1 && raw.length - decimalIndex - 1 > 2) {
    return 'tools.chequeAmount.errors.tooManyDecimals'
  }
  if (Number(raw) > 99999999.99) {
    return 'tools.chequeAmount.errors.amountTooLarge'
  }
  return null
}

export function formatHKD(amount: number): string {
  const parts = amount.toFixed(2).split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `HK$${intPart}.${parts[1]}`
}

const CN_DIGITS = ['零', '壹', '貳', '叁', '肆', '伍', '陸', '柒', '捌', '玖']
const CN_UNITS = ['', '拾', '佰', '仟']

function convertIntegerChinese(n: number): string {
  if (n === 0) return '零'

  const groups: number[] = []
  let remaining = n
  while (remaining > 0) {
    groups.push(remaining % 10000)
    remaining = Math.floor(remaining / 10000)
  }

  const groupUnits = ['', '萬']

  let result = ''
  for (let g = groups.length - 1; g >= 0; g--) {
    const group = groups[g]
    if (group === 0) {
      if (result !== '') result += '零'
      continue
    }

    let groupStr = ''
    const digits = [
      Math.floor(group / 1000),
      Math.floor((group % 1000) / 100),
      Math.floor((group % 100) / 10),
      group % 10,
    ]

    let prevZero = false
    for (let i = 0; i < 4; i++) {
      const d = digits[i]
      if (d === 0) {
        prevZero = true
      } else {
        if (prevZero && groupStr !== '') groupStr += '零'
        groupStr += CN_DIGITS[d] + CN_UNITS[3 - i]
        prevZero = false
      }
    }

    if (result !== '' && groups[g] < 1000) result += '零'
    result += groupStr + groupUnits[g]
  }

  if (result.endsWith('零')) result = result.slice(0, -1)

  return result
}

function convertDecimalChinese(jiao: number, fen: number): string {
  let result = ''
  if (jiao !== 0) result += CN_DIGITS[jiao] + '角'
  if (fen !== 0) result += CN_DIGITS[fen] + '分'
  return result
}

export function convertToChequeAmount(amount: number): ChequeAmountResult {
  const rounded = Math.round(amount * 100)
  const yuanInt = Math.floor(rounded / 100)
  const cents = rounded % 100
  const jiao = Math.floor(cents / 10)
  const fen = cents % 10

  const hasDecimal = jiao !== 0 || fen !== 0
  const endMarker = hasDecimal ? '正' : '整'

  const intChinese = yuanInt === 0 ? '零' : convertIntegerChinese(yuanInt)
  const decChinese = convertDecimalChinese(jiao, fen)

  let chinese: string
  if (yuanInt === 0 && hasDecimal) {
    chinese = '零圓' + decChinese + endMarker
  } else {
    chinese = intChinese + '圓' + decChinese + endMarker
  }

  const english = convertEnglish(yuanInt, cents)

  return { chinese, english }
}

const EN_ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function convertHundreds(n: number): string {
  if (n === 0) return ''
  if (n < 20) return EN_ONES[n]
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return EN_TENS[tens] + (ones > 0 ? '-' + EN_ONES[ones] : '')
  }
  const hundreds = Math.floor(n / 100)
  const remainder = n % 100
  return EN_ONES[hundreds] + ' Hundred' + (remainder > 0 ? ' And ' + convertHundreds(remainder) : '')
}

function convertIntegerEnglish(n: number): string {
  if (n === 0) return 'Zero'
  const million = Math.floor(n / 1000000)
  const thousand = Math.floor((n % 1000000) / 1000)
  const remainder = n % 1000

  const parts: string[] = []
  if (million > 0) parts.push(convertHundreds(million) + ' Million')
  if (thousand > 0) parts.push(convertHundreds(thousand) + ' Thousand')
  if (remainder > 0) parts.push(convertHundreds(remainder))

  return parts.join(' ')
}

function convertEnglish(yuanInt: number, cents: number): string {
  const hasCents = cents > 0
  const hasYuan = yuanInt > 0

  const dollarUnit = yuanInt === 1 ? 'Dollar' : 'Dollars'
  const centUnit = cents === 1 ? 'Cent' : 'Cents'
  const dollarPart = hasYuan ? convertIntegerEnglish(yuanInt) + ' ' + dollarUnit : ''
  const centPart = hasCents ? convertHundreds(cents) + ' ' + centUnit : ''

  if (!hasYuan && !hasCents) return 'Zero Dollars Only'

  if (hasYuan && hasCents) return dollarPart + ' And ' + centPart + ' Only'
  if (hasYuan) return dollarPart + ' Only'
  return centPart + ' Only'
}
