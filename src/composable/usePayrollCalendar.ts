// composables/usePayrollCalendar.ts
import axiosInstance from '@/plugins/axios'
import { computed, ref } from 'vue'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HolidayType = 'regular' | 'special'

export interface Holiday {
  id: number
  date: string       // ISO: YYYY-MM-DD
  label: string
  type: HolidayType
}

export interface SuspensionDay {
  id: number
  date: string       // ISO: YYYY-MM-DD
  label: string
  created_at: string
}

export interface MonthSummary {
  regularHolidays: Holiday[]
  specialHolidays: Holiday[]
  suspensions: SuspensionDay[]
  totalNonWorkingDays: number
}

export interface DateInfo {
  holiday?: Holiday
  suspension?: SuspensionDay
}

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
// Module-level cache — shared across all component instances
// ---------------------------------------------------------------------------

const holidays    = ref<Holiday[]>([])
const suspensions = ref<SuspensionDay[]>([])
const loading     = ref(false)
const error       = ref<string | null>(null)

// Tracks which year-month keys have already been fetched
const fetchedKeys = new Set<string>()

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function usePayrollCalendar() {

  // ── #1 Cache invalidation ────────────────────────────────────────────────
  // Call this after any mutation so the next fetchMonth re-hits the API.

  function invalidateMonth(year: number, month: number): void {
    const key = `${year}-${month}`
    fetchedKeys.delete(key)

    // Also evict cached records for this month so stale data isn't shown
    // while the re-fetch is in flight.
    const prefix = `${year}-${String(month).padStart(2, '0')}-`
    holidays.value    = holidays.value.filter(h => !h.date.startsWith(prefix))
    suspensions.value = suspensions.value.filter(s => !s.date.startsWith(prefix))
  }

  // ── Fetch ────────────────────────────────────────────────────────────────

  async function fetchMonth(year: number, month: number): Promise<void> {
    const key = `${year}-${month}`
    if (fetchedKeys.has(key)) return

    loading.value = true
    error.value   = null

    try {
      const [holidayRes, suspensionRes] = await Promise.all([
        axiosInstance.get('/api/calendar/holidays', { params: { year, month } }),
        axiosInstance.get('/api/calendar/suspensions', { params: { year, month } }),
      ])

      if (holidayRes.data.success) {
        const incoming: Holiday[] = holidayRes.data.data
        const existingIds = new Set(holidays.value.map(h => h.id))
        incoming.forEach(h => {
          if (!existingIds.has(h.id)) holidays.value.push(h)
        })
      }

      if (suspensionRes.data.success) {
        const incoming: SuspensionDay[] = suspensionRes.data.data
        const existingIds = new Set(suspensions.value.map(s => s.id))
        incoming.forEach(s => {
          if (!existingIds.has(s.id)) suspensions.value.push(s)
        })
      }

      fetchedKeys.add(key)
    }
    catch (err: any) {
      error.value = err?.response?.data?.message ?? 'Failed to load calendar data.'
    }
    finally {
      loading.value = false
    }
  }

  // ── Holiday queries ──────────────────────────────────────────────────────

  function getHolidaysForMonth(year: number, month: number): Holiday[] {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`
    return holidays.value.filter(h => h.date.startsWith(prefix))
  }

  function getHolidayByDate(isoDate: string): Holiday | undefined {
    return holidays.value.find(h => h.date === isoDate)
  }

  // ── Suspension queries ───────────────────────────────────────────────────

  function getSuspensionsForMonth(year: number, month: number): SuspensionDay[] {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`
    return suspensions.value.filter(s => s.date.startsWith(prefix))
  }

  function getSuspensionByDate(isoDate: string): SuspensionDay | undefined {
    return suspensions.value.find(s => s.date === isoDate)
  }

  // ── Date info ────────────────────────────────────────────────────────────

  function getDateInfo(isoDate: string): DateInfo {
    return {
      holiday:    getHolidayByDate(isoDate),
      suspension: getSuspensionByDate(isoDate),
    }
  }

  // ── Month summary ────────────────────────────────────────────────────────

  function getMonthSummary(year: number, month: number): MonthSummary {
    const monthHolidays    = getHolidaysForMonth(year, month)
    const regularHolidays  = monthHolidays.filter(h => h.type === 'regular')
    const specialHolidays  = monthHolidays.filter(h => h.type === 'special')
    const monthSuspensions = getSuspensionsForMonth(year, month)

    const allDates = new Set([
      ...monthHolidays.map(h => h.date),
      ...monthSuspensions.map(s => s.date),
    ])

    return { regularHolidays, specialHolidays, suspensions: monthSuspensions, totalNonWorkingDays: allDates.size }
  }

  // ── Holiday CRUD ─────────────────────────────────────────────────────────

  async function addHoliday(isoDate: string, label: string, type: HolidayType): Promise<true | string> {
    try {
      const res = await axiosInstance.post('/api/calendar/holidays', { date: isoDate, label: label.trim(), type })
      if (res.data.success) { holidays.value.push(res.data.data); return true }
      return res.data.message ?? 'Failed to add holiday.'
    }
    catch (err: any) {
      const errors = err?.response?.data?.errors
      if (errors) return Object.values(errors).flat().join(' ')
      return err?.response?.data?.message ?? 'Failed to add holiday.'
    }
  }

  async function updateHoliday(id: number, isoDate: string, label: string, type: HolidayType): Promise<true | string> {
    try {
      const res = await axiosInstance.post(`/api/calendar/holidays/update/${id}`, { date: isoDate, label: label.trim(), type })
      if (res.data.success) {
        const idx = holidays.value.findIndex(h => h.id === id)
        if (idx !== -1) holidays.value[idx] = res.data.data
        return true
      }
      return res.data.message ?? 'Failed to update holiday.'
    }
    catch (err: any) {
      const errors = err?.response?.data?.errors
      if (errors) return Object.values(errors).flat().join(' ')
      return err?.response?.data?.message ?? 'Failed to update holiday.'
    }
  }

  async function removeHoliday(id: number): Promise<true | string> {
    try {
      const res = await axiosInstance.post(`/api/calendar/holidays/delete/${id}`)
      if (res.data.success) { holidays.value = holidays.value.filter(h => h.id !== id); return true }
      return res.data.message ?? 'Failed to remove holiday.'
    }
    catch (err: any) {
      return err?.response?.data?.message ?? 'Failed to remove holiday.'
    }
  }

  // ── Suspension CRUD ──────────────────────────────────────────────────────

  async function addSuspensionDay(isoDate: string, label: string): Promise<true | string> {
    try {
      const res = await axiosInstance.post('/api/calendar/suspensions', { date: isoDate, label: label.trim() })
      if (res.data.success) { suspensions.value.push(res.data.data); return true }
      return res.data.message ?? 'Failed to add suspension day.'
    }
    catch (err: any) {
      const errors = err?.response?.data?.errors
      if (errors) return Object.values(errors).flat().join(' ')
      return err?.response?.data?.message ?? 'Failed to add suspension day.'
    }
  }

  async function updateSuspensionDay(id: number, isoDate: string, label: string): Promise<true | string> {
    try {
      const res = await axiosInstance.post(`/api/calendar/suspensions/update/${id}`, { date: isoDate, label: label.trim() })
      if (res.data.success) {
        const idx = suspensions.value.findIndex(s => s.id === id)
        if (idx !== -1) suspensions.value[idx] = res.data.data
        return true
      }
      return res.data.message ?? 'Failed to update suspension day.'
    }
    catch (err: any) {
      const errors = err?.response?.data?.errors
      if (errors) return Object.values(errors).flat().join(' ')
      return err?.response?.data?.message ?? 'Failed to update suspension day.'
    }
  }

  async function removeSuspensionDay(id: number): Promise<true | string> {
    try {
      const res = await axiosInstance.post(`/api/calendar/suspensions/delete/${id}`)
      if (res.data.success) { suspensions.value = suspensions.value.filter(s => s.id !== id); return true }
      return res.data.message ?? 'Failed to remove suspension day.'
    }
    catch (err: any) {
      return err?.response?.data?.message ?? 'Failed to remove suspension day.'
    }
  }

  // ── Expose ───────────────────────────────────────────────────────────────

  return {
    loading:        computed(() => loading.value),
    error:          computed(() => error.value),
    allHolidays:    computed(() => holidays.value),
    allSuspensions: computed(() => suspensions.value),

    fetchMonth,
    invalidateMonth,   // ← new: exposed for cache busting after mutations

    getHolidaysForMonth,
    getHolidayByDate,
    getSuspensionsForMonth,
    getSuspensionByDate,
    getDateInfo,
    getMonthSummary,

    addHoliday,
    updateHoliday,
    removeHoliday,

    addSuspensionDay,
    updateSuspensionDay,
    removeSuspensionDay,
  }
}
