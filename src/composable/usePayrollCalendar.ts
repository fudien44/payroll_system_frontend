// composables/usePayrollCalendar.ts
import axiosInstance from '@/plugins/axios'
import { computed, ref } from 'vue'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HolidayType = 'regular' | 'special'

export interface Holiday {
  id:          number
  date:        string       // ISO: YYYY-MM-DD
  label:       string
  type:        HolidayType
  is_half_day: boolean      // only meaningful when type === 'special'
}

export interface ContractBreakBatch {
  id:               number
  label:            string
  start_date:       string
  end_date:         string
  resumption_date:  string
  notes:            string | null
  employee_breaks_count?: number
}

export interface EmployeeContractBreak {
  id:               number
  emp_id:           number
  batch_id:         number | null
  emp_name:         string | null
  division_name:    string | null
  start_date:       string | null
  end_date:         string | null
  resumption_date:  string | null
  batch?:           ContractBreakBatch | null
}

export interface ContractBreakEmployeePickerRow {
  emp_id:            number
  name:              string
  position:          string
  division_name:     string | null
  section_name:      string | null
  already_assigned:  boolean
}

export interface StandardWeekBatch {
  id:         number
  label:      string
  start_date: string
  end_date:   string
  notes:      string | null
  employee_exemptions_count?: number
}

export interface EmployeeStandardWeekExemption {
  id:            number
  emp_id:        number
  batch_id:      number | null
  emp_name:      string | null
  division_name: string | null
  start_date:    string | null
  end_date:      string | null
}

export interface SuspensionDay {
  id:          number
  date:        string       // ISO: YYYY-MM-DD
  label:       string
  is_half_day: boolean
  created_at:  string
}

export interface MonthSummary {
  regularHolidays:     Holiday[]
  specialHolidays:     Holiday[]
  suspensions:         SuspensionDay[]
  totalNonWorkingDays: number
}

export interface DateInfo {
  holiday?:    Holiday
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
const contractBreakBatches = ref<ContractBreakBatch[]>([])
const batchesFetched = ref(false)
const standardWeekBatches = ref<StandardWeekBatch[]>([])
const standardWeekBatchesFetched = ref(false)
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

  // ── Cache invalidation ───────────────────────────────────────────────────
  // Call this after any mutation so the next fetchMonth re-hits the API.

  function invalidateMonth(year: number, month: number): void {
    const key = `${year}-${month}`
    fetchedKeys.delete(key)

    // Evict cached records for this month so stale data isn't shown
    // while the re-fetch is in flight.
    const prefix = `${year}-${String(month).padStart(2, '0')}-`
    holidays.value    = holidays.value.filter(h => !h.date.startsWith(prefix))
    suspensions.value = suspensions.value.filter(s => !s.date.startsWith(prefix))
  }

  // ── Fetch ────────────────────────────────────────────────────────────────

  async function fetchContractBreakBatches(force = false): Promise<void> {
  if (batchesFetched.value && !force) return
  try {
    const { data } = await axiosInstance.get('/api/calendar/contract-breaks/batches')
    if (data.success) {
      contractBreakBatches.value = data.data
      batchesFetched.value = true
    }
  } catch {
    // non-fatal
  }
}

async function addContractBreakBatch(
  label: string, startDate: string, endDate: string, resumptionDate: string, notes = '',
): Promise<true | string> {
  try {
    const res = await axiosInstance.post('/api/calendar/contract-breaks/batches', {
      label: label.trim(), start_date: startDate, end_date: endDate,
      resumption_date: resumptionDate, notes: notes.trim() || null,
    })
    if (res.data.success) {
      contractBreakBatches.value.push(res.data.data)
      return true
    }
    return res.data.message ?? 'Failed to add batch.'
  } catch (err: any) {
    const errors = err?.response?.data?.errors
    if (errors) return Object.values(errors).flat().join(' ')
    return err?.response?.data?.message ?? 'Failed to add batch.'
  }
}

async function updateContractBreakBatch(
  id: number, label: string, startDate: string, endDate: string, resumptionDate: string, notes = '',
): Promise<true | string> {
  try {
    const res = await axiosInstance.post(`/api/calendar/contract-breaks/batches/update/${id}`, {
      label: label.trim(), start_date: startDate, end_date: endDate,
      resumption_date: resumptionDate, notes: notes.trim() || null,
    })
    if (res.data.success) {
      const idx = contractBreakBatches.value.findIndex(b => b.id === id)
      if (idx !== -1) contractBreakBatches.value[idx] = res.data.data
      return true
    }
    return res.data.message ?? 'Failed to update batch.'
  } catch (err: any) {
    const errors = err?.response?.data?.errors
    if (errors) return Object.values(errors).flat().join(' ')
    return err?.response?.data?.message ?? 'Failed to update batch.'
  }
}

async function removeContractBreakBatch(id: number): Promise<true | string> {
  try {
    const res = await axiosInstance.post(`/api/calendar/contract-breaks/batches/delete/${id}`)
    if (res.data.success) {
      contractBreakBatches.value = contractBreakBatches.value.filter(b => b.id !== id)
      return true
    }
    return res.data.message ?? 'Failed to delete batch.'
  } catch (err: any) {
    return err?.response?.data?.message ?? 'Failed to delete batch.'
  }
}

async function fetchBatchEmployees(batchId: number): Promise<EmployeeContractBreak[]> {
  try {
    const { data } = await axiosInstance.get(`/api/calendar/contract-breaks/batches/${batchId}/employees`)
    return data.success ? data.data : []
  } catch {
    return []
  }
}

async function assignEmployeesToBatch(batchId: number, empIds: number[]): Promise<
  { success: true; message: string; data: EmployeeContractBreak[] } | { success: false; message: string }
  > {
  try {
    const { data } = await axiosInstance.post(`/api/calendar/contract-breaks/batches/${batchId}/assign`, {
      emp_ids: empIds,
    })
    if (data.success) {
      // Keep the batch's assigned-count badge in sync
      const idx = contractBreakBatches.value.findIndex(b => b.id === batchId)
      if (idx !== -1) contractBreakBatches.value[idx].employee_breaks_count = data.data.length
      return { success: true, message: data.message, data: data.data }
    }
    return { success: false, message: data.message ?? 'Failed to assign employees.' }
  } catch (err: any) {
    return { success: false, message: err?.response?.data?.message ?? 'Failed to assign employees.' }
  }
}

async function unassignEmployeeBreak(id: number): Promise<true | string> {
  try {
    const res = await axiosInstance.post(`/api/calendar/contract-breaks/${id}/unassign`)
    return res.data.success ? true : (res.data.message ?? 'Failed to unassign.')
  } catch (err: any) {
    return err?.response?.data?.message ?? 'Failed to unassign.'
  }
}

async function addCustomContractBreak(
  empId: number, startDate: string, endDate: string, resumptionDate: string,
): Promise<true | string> {
  try {
    const res = await axiosInstance.post('/api/calendar/contract-breaks/custom', {
      emp_id: empId, start_date: startDate, end_date: endDate, resumption_date: resumptionDate,
    })
    return res.data.success ? true : (res.data.message ?? 'Failed to add custom contract break.')
  } catch (err: any) {
    const errors = err?.response?.data?.errors
    if (errors) return Object.values(errors).flat().join(' ')
    return err?.response?.data?.message ?? 'Failed to add custom contract break.'
  }
}

async function updateCustomContractBreak(
  id: number, startDate: string, endDate: string, resumptionDate: string,
): Promise<true | string> {
  try {
    const res = await axiosInstance.post(`/api/calendar/contract-breaks/${id}/update-custom`, {
      start_date: startDate, end_date: endDate, resumption_date: resumptionDate,
    })
    return res.data.success ? true : (res.data.message ?? 'Failed to update.')
  } catch (err: any) {
    const errors = err?.response?.data?.errors
    if (errors) return Object.values(errors).flat().join(' ')
    return err?.response?.data?.message ?? 'Failed to update.'
  }
}

async function fetchContractBreakEmployeePicker(batchId?: number): Promise<ContractBreakEmployeePickerRow[]> {
  try {
    const { data } = await axiosInstance.get('/api/calendar/contract-breaks/employees-picker', {
      params: batchId ? { batch_id: batchId } : {},
    })
    return data.success ? data.data : []
  } catch {
    return []
  }
}

async function fetchStandardWeekBatches(force = false): Promise<void> {
  if (standardWeekBatchesFetched.value && !force) return
  try {
    const { data } = await axiosInstance.get('/api/calendar/standard-week/batches')
    if (data.success) {
      standardWeekBatches.value = data.data
      standardWeekBatchesFetched.value = true
    }
  } catch {
    // non-fatal
  }
}

async function addStandardWeekBatch(
  label: string, startDate: string, endDate: string, notes = '',
): Promise<true | string> {
  try {
    const res = await axiosInstance.post('/api/calendar/standard-week/batches', {
      label: label.trim(), start_date: startDate, end_date: endDate,
      notes: notes.trim() || null,
    })
    if (res.data.success) {
      standardWeekBatches.value.push(res.data.data)
      return true
    }
    return res.data.message ?? 'Failed to add batch.'
  } catch (err: any) {
    const errors = err?.response?.data?.errors
    if (errors) return Object.values(errors).flat().join(' ')
    return err?.response?.data?.message ?? 'Failed to add batch.'
  }
}

async function updateStandardWeekBatch(
  id: number, label: string, startDate: string, endDate: string, notes = '',
): Promise<true | string> {
  try {
    const res = await axiosInstance.post(`/api/calendar/standard-week/batches/update/${id}`, {
      label: label.trim(), start_date: startDate, end_date: endDate,
      notes: notes.trim() || null,
    })
    if (res.data.success) {
      const idx = standardWeekBatches.value.findIndex(b => b.id === id)
      if (idx !== -1) standardWeekBatches.value[idx] = res.data.data
      return true
    }
    return res.data.message ?? 'Failed to update batch.'
  } catch (err: any) {
    const errors = err?.response?.data?.errors
    if (errors) return Object.values(errors).flat().join(' ')
    return err?.response?.data?.message ?? 'Failed to update batch.'
  }
}

async function removeStandardWeekBatch(id: number): Promise<true | string> {
  try {
    const res = await axiosInstance.post(`/api/calendar/standard-week/batches/delete/${id}`)
    if (res.data.success) {
      standardWeekBatches.value = standardWeekBatches.value.filter(b => b.id !== id)
      return true
    }
    return res.data.message ?? 'Failed to delete batch.'
  } catch (err: any) {
    return err?.response?.data?.message ?? 'Failed to delete batch.'
  }
}

async function fetchStandardWeekBatchEmployees(batchId: number): Promise<EmployeeStandardWeekExemption[]> {
  try {
    const { data } = await axiosInstance.get(`/api/calendar/standard-week/batches/${batchId}/employees`)
    return data.success ? data.data : []
  } catch {
    return []
  }
}

async function assignEmployeesToStandardWeekBatch(
  batchId: number,
  empIds: number[]
): Promise<{ success: true; message: string; data: EmployeeStandardWeekExemption[] } | { success: false; message: string }> {
  try {
    const { data } = await axiosInstance.post(`/api/calendar/standard-week/batches/${batchId}/assign`, {
      emp_ids: empIds,
    })
    if (data.success) {
      const idx = standardWeekBatches.value.findIndex(b => b.id === batchId)
      if (idx !== -1) standardWeekBatches.value[idx].employee_exemptions_count = data.data.length
      return { success: true, message: data.message, data: data.data }
    }
    return { success: false, message: data.message ?? 'Failed to assign employees.' }
  } catch (err: any) {
    return { success: false, message: err?.response?.data?.message ?? 'Failed to assign employees.' }
  }
}

async function unassignStandardWeekExemption(id: number): Promise<true | string> {
  try {
    const res = await axiosInstance.post(`/api/calendar/standard-week/${id}/unassign`)
    return res.data.success ? true : (res.data.message ?? 'Failed to unassign.')
  } catch (err: any) {
    return err?.response?.data?.message ?? 'Failed to unassign.'
  }
}

async function addCustomStandardWeekExemption(
  empId: number, startDate: string, endDate: string,
): Promise<true | string> {
  try {
    const res = await axiosInstance.post('/api/calendar/standard-week/custom', {
      emp_id: empId, start_date: startDate, end_date: endDate,
    })
    return res.data.success ? true : (res.data.message ?? 'Failed to add exemption.')
  } catch (err: any) {
    const errors = err?.response?.data?.errors
    if (errors) return Object.values(errors).flat().join(' ')
    return err?.response?.data?.message ?? 'Failed to add exemption.'
  }
}

async function updateCustomStandardWeekExemption(
  id: number, startDate: string, endDate: string,
): Promise<true | string> {
  try {
    const res = await axiosInstance.post(`/api/calendar/standard-week/${id}/update-custom`, {
      start_date: startDate, end_date: endDate,
    })
    return res.data.success ? true : (res.data.message ?? 'Failed to update.')
  } catch (err: any) {
    const errors = err?.response?.data?.errors
    if (errors) return Object.values(errors).flat().join(' ')
    return err?.response?.data?.message ?? 'Failed to update.'
  }
}

async function fetchStandardWeekEmployeePicker(
  batchId?: number,
  startDate?: string,
  endDate?: string,
): Promise<ContractBreakEmployeePickerRow[]> {
  try {
    const params: Record<string, string | number> = {}
    if (batchId) {
      params.batch_id = batchId
    } else if (startDate && endDate) {
      params.start_date = startDate
      params.end_date   = endDate
    }
    const { data } = await axiosInstance.get('/api/calendar/standard-week/employees-picker', { params })
    return data.success ? data.data : []
  } catch {
    return []
  }
}

  async function fetchMonth(year: number, month: number): Promise<void> {
    const key = `${year}-${month}`
    if (fetchedKeys.has(key)) return

    loading.value = true
    error.value   = null

    try {
      const [holidayRes, suspensionRes] = await Promise.all([
        axiosInstance.get('/api/calendar/holidays',    { params: { year, month } }),
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

    return {
      regularHolidays,
      specialHolidays,
      suspensions:         monthSuspensions,
      totalNonWorkingDays: allDates.size,
    }
  }

  // ── Holiday CRUD ─────────────────────────────────────────────────────────

  async function addHoliday(
    isoDate:    string,
    label:      string,
    type:       HolidayType,
    isHalfDay = false,
  ): Promise<true | string> {
    try {
      const res = await axiosInstance.post('/api/calendar/holidays', {
        date:        isoDate,
        label:       label.trim(),
        type,
        // Regular holidays are never half-day; guard here too for safety
        is_half_day: type === 'special' ? isHalfDay : false,
      })
      if (res.data.success) {
        holidays.value.push(res.data.data)
        return true
      }
      return res.data.message ?? 'Failed to add holiday.'
    }
    catch (err: any) {
      const errors = err?.response?.data?.errors
      if (errors) return Object.values(errors).flat().join(' ')
      return err?.response?.data?.message ?? 'Failed to add holiday.'
    }
  }

  async function updateHoliday(
    id:         number,
    isoDate:    string,
    label:      string,
    type:       HolidayType,
    isHalfDay = false,
  ): Promise<true | string> {
    try {
      const res = await axiosInstance.post(`/api/calendar/holidays/update/${id}`, {
        date:        isoDate,
        label:       label.trim(),
        type,
        is_half_day: type === 'special' ? isHalfDay : false,
      })
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
      if (res.data.success) {
        holidays.value = holidays.value.filter(h => h.id !== id)
        return true
      }
      return res.data.message ?? 'Failed to remove holiday.'
    }
    catch (err: any) {
      return err?.response?.data?.message ?? 'Failed to remove holiday.'
    }
  }

  // ── Suspension CRUD ──────────────────────────────────────────────────────

  async function addSuspensionDay(
    isoDate:    string,
    label:      string,
    isHalfDay = false,
  ): Promise<true | string> {
    try {
      const res = await axiosInstance.post('/api/calendar/suspensions', {
        date:        isoDate,
        label:       label.trim(),
        is_half_day: isHalfDay,
      })
      if (res.data.success) {
        suspensions.value.push(res.data.data)
        return true
      }
      return res.data.message ?? 'Failed to add suspension day.'
    }
    catch (err: any) {
      const errors = err?.response?.data?.errors
      if (errors) return Object.values(errors).flat().join(' ')
      return err?.response?.data?.message ?? 'Failed to add suspension day.'
    }
  }

  async function updateSuspensionDay(
    id:         number,
    isoDate:    string,
    label:      string,
    isHalfDay = false,
  ): Promise<true | string> {
    try {
      const res = await axiosInstance.post(`/api/calendar/suspensions/update/${id}`, {
        date:        isoDate,
        label:       label.trim(),
        is_half_day: isHalfDay,
      })
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
      if (res.data.success) {
        suspensions.value = suspensions.value.filter(s => s.id !== id)
        return true
      }
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
    invalidateMonth,

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

     contractBreakBatches: computed(() => contractBreakBatches.value),
    fetchContractBreakBatches,
    addContractBreakBatch,
    updateContractBreakBatch,
    removeContractBreakBatch,
    fetchBatchEmployees,
    assignEmployeesToBatch,
    unassignEmployeeBreak,
    addCustomContractBreak,
    updateCustomContractBreak,
    fetchContractBreakEmployeePicker,

    standardWeekBatches: computed(() => standardWeekBatches.value),
    fetchStandardWeekBatches,
    addStandardWeekBatch,
    updateStandardWeekBatch,
    removeStandardWeekBatch,
    fetchStandardWeekBatchEmployees,
    assignEmployeesToStandardWeekBatch,
    unassignStandardWeekExemption,
    addCustomStandardWeekExemption,
    updateCustomStandardWeekExemption,
    fetchStandardWeekEmployeePicker,
  }
}
