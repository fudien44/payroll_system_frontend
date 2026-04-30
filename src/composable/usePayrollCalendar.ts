// composables/usePayrollCalendar.ts
import { ref, computed } from 'vue'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HolidayType = 'regular' | 'special'

export interface Holiday {
  date: string       // ISO: YYYY-MM-DD
  label: string
  type: HolidayType
}

export interface SuspensionDay {
  id: string
  date: string       // ISO: YYYY-MM-DD
  label: string
  createdAt: string  // ISO timestamp
}

export interface MonthSummary {
  regularHolidays: Holiday[]
  specialHolidays: Holiday[]
  suspensions: SuspensionDay[]
  totalNonWorkingDays: number
}

// ---------------------------------------------------------------------------
// Philippine Public Holidays Data
// Update these each year or replace with an API call.
// ---------------------------------------------------------------------------

const PH_HOLIDAYS: Holiday[] = [
  // ── 2025 ──────────────────────────────────────────────────────────────
  { date: '2025-01-01', label: "New Year's Day",                         type: 'regular' },
  { date: '2025-01-29', label: 'Chinese New Year',                        type: 'special' },
  { date: '2025-02-25', label: 'EDSA People Power Revolution Anniversary', type: 'special' },
  { date: '2025-04-09', label: 'Araw ng Kagitingan (Day of Valor)',        type: 'regular' },
  { date: '2025-04-17', label: 'Maundy Thursday',                         type: 'regular' },
  { date: '2025-04-18', label: 'Good Friday',                             type: 'regular' },
  { date: '2025-04-19', label: 'Black Saturday',                          type: 'special' },
  { date: '2025-05-01', label: 'Labor Day',                               type: 'regular' },
  { date: '2025-06-12', label: 'Independence Day',                        type: 'regular' },
  { date: '2025-08-21', label: 'Ninoy Aquino Day',                        type: 'special' },
  { date: '2025-08-25', label: 'National Heroes Day',                     type: 'regular' },
  { date: '2025-11-01', label: "All Saints' Day",                         type: 'special' },
  { date: '2025-11-02', label: "All Souls' Day",                          type: 'special' },
  { date: '2025-11-30', label: 'Bonifacio Day',                           type: 'regular' },
  { date: '2025-12-08', label: 'Feast of the Immaculate Conception',      type: 'special' },
  { date: '2025-12-24', label: 'Christmas Eve',                           type: 'special' },
  { date: '2025-12-25', label: 'Christmas Day',                           type: 'regular' },
  { date: '2025-12-30', label: 'Rizal Day',                               type: 'regular' },
  { date: '2025-12-31', label: "New Year's Eve",                          type: 'special' },

  // ── 2026 ──────────────────────────────────────────────────────────────
  { date: '2026-01-01', label: "New Year's Day",                          type: 'regular' },
  { date: '2026-02-17', label: 'Chinese New Year',                        type: 'special' },
  { date: '2026-02-25', label: 'EDSA People Power Revolution Anniversary', type: 'special' },
  { date: '2026-04-02', label: 'Maundy Thursday',                         type: 'regular' },
  { date: '2026-04-03', label: 'Good Friday',                             type: 'regular' },
  { date: '2026-04-04', label: 'Black Saturday',                          type: 'special' },
  { date: '2026-04-09', label: 'Araw ng Kagitingan (Day of Valor)',        type: 'regular' },
  { date: '2026-05-01', label: 'Labor Day',                               type: 'regular' },
  { date: '2026-06-12', label: 'Independence Day',                        type: 'regular' },
  { date: '2026-08-21', label: 'Ninoy Aquino Day',                        type: 'special' },
  { date: '2026-08-31', label: 'National Heroes Day',                     type: 'regular' },
  { date: '2026-11-01', label: "All Saints' Day",                         type: 'special' },
  { date: '2026-11-02', label: "All Souls' Day",                          type: 'special' },
  { date: '2026-11-30', label: 'Bonifacio Day',                           type: 'regular' },
  { date: '2026-12-08', label: 'Feast of the Immaculate Conception',      type: 'special' },
  { date: '2026-12-24', label: 'Christmas Eve',                           type: 'special' },
  { date: '2026-12-25', label: 'Christmas Day',                           type: 'regular' },
  { date: '2026-12-30', label: 'Rizal Day',                               type: 'regular' },
  { date: '2026-12-31', label: "New Year's Eve",                          type: 'special' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function usePayrollCalendar() {
  const suspensionDays = ref<SuspensionDay[]>([])

  // ------------------------------------------------------------------
  // Holiday queries
  // ------------------------------------------------------------------

  function getHolidaysForMonth(year: number, month: number): Holiday[] {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`
    return PH_HOLIDAYS.filter(h => h.date.startsWith(prefix))
  }

  function getRegularHolidaysForMonth(year: number, month: number): Holiday[] {
    return getHolidaysForMonth(year, month).filter(h => h.type === 'regular')
  }

  function getSpecialHolidaysForMonth(year: number, month: number): Holiday[] {
    return getHolidaysForMonth(year, month).filter(h => h.type === 'special')
  }

  function getHolidayByDate(isoDate: string): Holiday | undefined {
    return PH_HOLIDAYS.find(h => h.date === isoDate)
  }

  // ------------------------------------------------------------------
  // Suspension day queries
  // ------------------------------------------------------------------

  function getSuspensionDaysForMonth(year: number, month: number): SuspensionDay[] {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`
    return suspensionDays.value.filter(s => s.date.startsWith(prefix))
  }

  function getSuspensionByDate(isoDate: string): SuspensionDay | undefined {
    return suspensionDays.value.find(s => s.date === isoDate)
  }

  // ------------------------------------------------------------------
  // Mutation
  // ------------------------------------------------------------------

  /**
   * Returns true on success, or an error message string on failure.
   */
  function addSuspensionDay(isoDate: string, label: string): true | string {
    if (!isoDate) return 'Please select a date.'
    if (!label.trim()) return 'Please enter a label / reason.'

    const duplicate = suspensionDays.value.some(s => s.date === isoDate)
    if (duplicate) return `A suspension day already exists for ${formatDisplayDate(isoDate)}.`

    suspensionDays.value.push({
      id: crypto.randomUUID(),
      date: isoDate,
      label: label.trim(),
      createdAt: new Date().toISOString(),
    })
    return true
  }

  function removeSuspensionDay(id: string): void {
    suspensionDays.value = suspensionDays.value.filter(s => s.id !== id)
  }

  // ------------------------------------------------------------------
  // Unified date info (used by calendar cells)
  // ------------------------------------------------------------------

  interface DateInfo {
    holiday?: Holiday
    suspension?: SuspensionDay
  }

  function getDateInfo(isoDate: string): DateInfo {
    return {
      holiday: getHolidayByDate(isoDate),
      suspension: getSuspensionByDate(isoDate),
    }
  }

  // ------------------------------------------------------------------
  // Month summary
  // ------------------------------------------------------------------

  function getMonthSummary(year: number, month: number): MonthSummary {
    const regularHolidays = getRegularHolidaysForMonth(year, month)
    const specialHolidays = getSpecialHolidaysForMonth(year, month)
    const suspensions = getSuspensionDaysForMonth(year, month)

    // Unique non-working dates (union of holidays + suspensions)
    const allDates = new Set([
      ...regularHolidays.map(h => h.date),
      ...specialHolidays.map(h => h.date),
      ...suspensions.map(s => s.date),
    ])

    return {
      regularHolidays,
      specialHolidays,
      suspensions,
      totalNonWorkingDays: allDates.size,
    }
  }

  // ------------------------------------------------------------------
  // Expose
  // ------------------------------------------------------------------

  return {
    suspensionDays: computed(() => suspensionDays.value),

    getHolidaysForMonth,
    getRegularHolidaysForMonth,
    getSpecialHolidaysForMonth,
    getHolidayByDate,

    getSuspensionDaysForMonth,
    getSuspensionByDate,

    addSuspensionDay,
    removeSuspensionDay,

    getDateInfo,
    getMonthSummary,

    // expose raw data for advanced use
    allHolidays: PH_HOLIDAYS,
  }
}
