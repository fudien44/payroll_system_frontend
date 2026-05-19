import { toISODate, usePayrollCalendar } from '@/composable/usePayrollCalendar'

export type ScheduleType = 'compressed' | 'standard'

export interface DaySchedule {
  isoDate:       string
  scheduleType:  ScheduleType
  isWorkingDay:  boolean
  expectedHours: number
  isRestFriday:  boolean   // true = compressed Friday (no work, not absent)
  holiday?:      { label: string; type: 'regular' | 'special' }
  isSuspension:  boolean
}

export function useWeekSchedule() {
  const { getDateInfo } = usePayrollCalendar()

  // ── Core: resolve if a week is compressed ─────────────────────────────
  // Mirrors resolveWeekSchedule() from the Calendar component.
  // A week is STANDARD only if it contains a Regular Holiday on Mon–Fri.

  function getWeekScheduleType(date: Date): ScheduleType {
    const dow    = date.getDay()
    const monday = new Date(date)
    monday.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1))

    for (let i = 0; i < 5; i++) {
      const d    = new Date(monday)
      d.setDate(monday.getDate() + i)
      const info = getDateInfo(toISODate(d))

      if (info.holiday?.type === 'regular') return 'standard'
    }

    return 'compressed'
  }

  // ── Full schedule info for a single date ───────────────────────────────

  function getDaySchedule(date: Date): DaySchedule {
    const isoDate      = toISODate(date)
    const dow          = date.getDay()
    const info         = getDateInfo(isoDate)
    const scheduleType = getWeekScheduleType(date)

    const isWeekend     = dow === 0 || dow === 6
    const isRestFriday  = dow === 5 && scheduleType === 'compressed'
    const isHoliday     = !!info.holiday
    const isSuspension  = !!info.suspension

    // A day is non-working if: weekend, holiday, suspension, or rest friday
    const isWorkingDay  = !isWeekend && !isHoliday && !isSuspension && !isRestFriday

    let expectedHours = 0
    if (isWorkingDay) {
      expectedHours = scheduleType === 'compressed' ? 10 : 8
    }

    return {
      isoDate,
      scheduleType,
      isWorkingDay,
      expectedHours,
      isRestFriday,
      holiday:     info.holiday ? { label: info.holiday.label, type: info.holiday.type } : undefined,
      isSuspension,
    }
  }

  // ── Build full month schedule (used directly by DTR) ───────────────────

  function getMonthDaySchedules(year: number, month: number): DaySchedule[] {
    const daysInMonth = new Date(year, month, 0).getDate()
    const results: DaySchedule[] = []

    for (let d = 1; d <= daysInMonth; d++) {
      results.push(getDaySchedule(new Date(year, month - 1, d)))
    }

    return results
  }

  return { getWeekScheduleType, getDaySchedule, getMonthDaySchedules }
}
