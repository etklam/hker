export type ResignationMode = 'days' | 'months'

export interface ResignationInput {
  resignationDate: Date
  mode: ResignationMode
  value: number
}

export interface ResignationResult {
  lastWorkingDay: Date
  noticeEndDate: Date
}

export function calculateLastDay(input: ResignationInput): ResignationResult {
  const base = new Date(
    input.resignationDate.getFullYear(),
    input.resignationDate.getMonth(),
    input.resignationDate.getDate()
  )

  let noticeEndDate: Date

  if (input.mode === 'days') {
    noticeEndDate = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + input.value
    )
  } else {
    const rawMonth = base.getMonth() + input.value
    const targetYear = base.getFullYear() + Math.floor(rawMonth / 12)
    const normalizedMonth = ((rawMonth % 12) + 12) % 12
    const targetDay = base.getDate()
    const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate()
    const clampedDay = Math.min(targetDay, lastDayOfTargetMonth)
    noticeEndDate = new Date(targetYear, normalizedMonth, clampedDay)
  }

  const lastWorkingDay = new Date(
    noticeEndDate.getFullYear(),
    noticeEndDate.getMonth(),
    noticeEndDate.getDate() - 1
  )

  return {
    lastWorkingDay,
    noticeEndDate,
  }
}
