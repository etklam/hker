export interface MortgageModeAInput {
  propertyPrice: number
  downPayment: number
  annualRate: number
  tenureYears: number
}

export interface MortgageModeBInput {
  propertyPrice: number
  targetMonthlyPayment: number
  annualRate: number
  tenureYears: number
  maxLtvPercent?: number
}

export interface MortgageResult {
  loanAmount: number
  monthlyPayment: number
  totalInterest: number
  totalPayment: number
  requiredDownPayment?: number
  downPaymentPercent?: number
  exceedsLtv?: boolean
  fullCoverage?: boolean
}

function computeMonthlyPayment(loanAmount: number, monthlyRate: number, periods: number): number {
  if (monthlyRate === 0) {
    return loanAmount / periods
  }
  const factor = Math.pow(1 + monthlyRate, periods)
  return loanAmount * (monthlyRate * factor) / (factor - 1)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculateMortgageModeA(input: MortgageModeAInput): MortgageResult {
  const { propertyPrice, downPayment, annualRate, tenureYears } = input
  const monthlyRate = annualRate / 100 / 12
  const periods = tenureYears * 12

  const loanAmount = round2(propertyPrice - downPayment)
  const monthlyPayment = round2(computeMonthlyPayment(loanAmount, monthlyRate, periods))
  const totalPayment = round2(monthlyPayment * periods)
  const totalInterest = round2(totalPayment - loanAmount)

  return { loanAmount, monthlyPayment, totalInterest, totalPayment }
}

export function calculateMortgageModeB(input: MortgageModeBInput): MortgageResult {
  const { propertyPrice, targetMonthlyPayment, annualRate, tenureYears, maxLtvPercent } = input
  const monthlyRate = annualRate / 100 / 12
  const periods = tenureYears * 12

  let maxAffordableLoan: number
  if (monthlyRate === 0) {
    maxAffordableLoan = targetMonthlyPayment * periods
  } else {
    const factor = Math.pow(1 + monthlyRate, periods)
    maxAffordableLoan = targetMonthlyPayment * (factor - 1) / (monthlyRate * factor)
  }

  let loanAmount: number
  let requiredDownPayment: number
  let downPaymentPercent: number
  let fullCoverage: boolean

  if (maxAffordableLoan >= propertyPrice) {
    fullCoverage = true
    loanAmount = round2(propertyPrice)
    requiredDownPayment = 0
    downPaymentPercent = 0
  } else {
    fullCoverage = false
    loanAmount = round2(maxAffordableLoan)
    requiredDownPayment = round2(propertyPrice - loanAmount)
    downPaymentPercent = round2((requiredDownPayment / propertyPrice) * 100)
  }

  const monthlyPayment = round2(computeMonthlyPayment(loanAmount, monthlyRate, periods))
  const totalPayment = round2(monthlyPayment * periods)
  const totalInterest = round2(totalPayment - loanAmount)

  const result: MortgageResult = {
    loanAmount,
    monthlyPayment,
    totalInterest,
    totalPayment,
    requiredDownPayment,
    downPaymentPercent,
    fullCoverage,
  }

  if (maxLtvPercent !== undefined) {
    result.exceedsLtv = loanAmount > round2(propertyPrice * maxLtvPercent / 100)
  }

  return result
}
