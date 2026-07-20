<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
import axios from '@axios'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface EmployeeOption {
  emp_id:           number
  user_id:          number
  full_name:        string
  position:         string
  has_wage:         boolean
  has_batch:        boolean
  batch_count:      number
  period_count:     number
  wage:             number
  premium_percent:  number
}

interface AttendanceRow {
  user_id:                  number
  full_name:                string
  position:                 string
  division:                 string | null
  section:                  string | null
  regdays:                  number
  total_rendered_hours:     number
  total_absent_days:        number
  total_late_minutes:       number
  total_undertime_minutes:  number
  dtr_absent_days:          number
  dtr_late_minutes:         number
  pass_slip_late_minutes:   number
  absent_penalty_removed_minutes:       number
  has_adjustment:           boolean
}

interface TardinessEmployee {
  name:             string   // "RODRIGUEZ, JULIUS CEZAR"
  dates:            string   // "4,5,6,7,11,13,14,18,19,20,21,25,26"
  days:             number   // 13
  minutes:          string   // "219"
  has_adjustments:  boolean // true if pass-slip late adjustments are included
}

interface TardinessDivision {
  name:      string               // "LOCAL HEALTH SUPPORT DIVISION"
  employees: TardinessEmployee[]
}

interface PunctualityEmployee {
  name:             string   // "RODRIGUEZ, JULIUS CEZAR"
  position:         string   // "Administrative Assistant III"
  regdays:          number   // 22
  has_adjustments:  boolean  // true if absences were fully offset by leave/official travel
}

interface PunctualityDivision {
  name:      string                  // "LOCAL HEALTH SUPPORT DIVISION"
  employees: PunctualityEmployee[]
}

type AlertType = 'success' | 'error' | 'warning' | 'info'

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const MONTH_ITEMS = [
  { title: 'January',   value: 1  }, { title: 'February',  value: 2  },
  { title: 'March',     value: 3  }, { title: 'April',     value: 4  },
  { title: 'May',       value: 5  }, { title: 'June',      value: 6  },
  { title: 'July',      value: 7  }, { title: 'August',    value: 8  },
  { title: 'September', value: 9  }, { title: 'October',   value: 10 },
  { title: 'November',  value: 11 }, { title: 'December',  value: 12 },
]

const currentYear = new Date().getFullYear()
const YEAR_ITEMS  = Array.from({ length: 5 }, (_, i) => currentYear - i)

const ATTENDANCE_HEADERS = [
  { title: 'Employee',         key: 'full_name',               sortable: true  },
  { title: 'Position',         key: 'position',                sortable: true  },
  { title: 'Working Days',     key: 'regdays',                 sortable: true  },
  { title: 'Hours Rendered',   key: 'total_rendered_hours',    sortable: true  },
  { title: 'Absent Days',      key: 'total_absent_days',       sortable: true  },
  { title: 'Late (mins)',      key: 'total_late_minutes',      sortable: true  },
  { title: 'Undertime (mins)', key: 'total_undertime_minutes', sortable: true  },
]

/* ─────────────────────────────────────────
   STATE — shared
───────────────────────────────────────── */
const activeTab   = ref< 'attendance' | 'punctuality' | 'tardiness' | 'payslip'>('attendance')
const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

// Default to preceding month for both start and end
const prevMonth = new Date().getMonth() === 0 ? 12 : new Date().getMonth()
const prevYear  = new Date().getMonth() === 0 ? currentYear - 1 : currentYear

function showAlert(type: AlertType, msg: string) {
  alertType.value    = type
  alertMessage.value = msg
  alertVisible.value = true
}

const TAB_BANNERS = {
  payslip: {
    type:  'info' as const,
    icon:  'mdi-file-document-outline',
    title: 'Save DTR records before generating payslips',
    body:  'Ensure DTR records for all concerned employees have been saved for the selected period from the <strong>DTR module</strong>. Employees without a payroll batch or with missing DTR entries will be excluded or may produce inaccurate computations.',
  },
  punctuality: {
    type:  'success' as const,
    icon:  'mdi-clock-check-outline',
    title: 'Perfect attendance recognition',
    body:  'This report lists employees with <strong>zero absences, zero tardiness, and zero undertime</strong> for the selected month. Absences fully covered by approved Leave or Official Travel are offset and marked with an <strong>adj</strong> badge.',
  },
  tardiness: {
    type:  'warning' as const,
    icon:  'mdi-clock-alert-outline',
    title: 'Tardiness threshold: more than five (5) days',
    body:  'Only employees with <strong>more than five (5) days of tardiness</strong> are shown. Late minutes include pass-slip adjustments that exceed the 2-hour allowance and are not captured in the DTR — these are flagged with an <strong>adj</strong> badge.',
  },
  attendance: {
    type:  'info' as const,
    icon:  'mdi-calendar-check-outline',
    title: 'Attendance summary is based on saved DTR data',
    body:  'Values are read from saved DTR summaries. Late minutes are sourced from the payroll batch where available; absent day counts reflect leave and official travel offsets. Make sure DTR has been saved for the selected period before loading.',
  },
} as const

const tabBanner = computed(() => TAB_BANNERS[activeTab.value] ?? null)

/* ─────────────────────────────────────────
   STATE — Attendance tab
───────────────────────────────────────── */
const attendanceMonth     = ref<number>(prevMonth)
const attendanceYear      = ref<number>(currentYear)
const attendanceRows      = ref<AttendanceRow[]>([])
const loadingAttendance      = ref(false)
const exportingAttendance    = ref(false)
const exportingAttendancePdf = ref(false)

// ── Division / Section filter (pre-load) ──
interface EmployeeRef { emp_id: number; full_name: string; position: string; division: string | null; section: string | null }
const allEmployeesRef      = ref<EmployeeRef[]>([])
const loadingEmployeeRefs  = ref(false)
const attFilterDivision    = ref<string | null>(null)
const attFilterSection     = ref<string | null>(null)

const divisionOptions = computed(() =>
  [...new Set(allEmployeesRef.value.map(e => e.division).filter(Boolean))]
    .sort() as string[]
)

const sectionOptions = computed(() => {
  const base = attFilterDivision.value
    ? allEmployeesRef.value.filter(e => e.division === attFilterDivision.value)
    : allEmployeesRef.value
  return [...new Set(base.map(e => e.section).filter(Boolean))].sort() as string[]
})

// When division changes, reset section if it no longer belongs to the new division
watch(attFilterDivision, () => {
  if (attFilterSection.value && !sectionOptions.value.includes(attFilterSection.value)) {
    attFilterSection.value = null
  }
})

async function fetchEmployeeRefs() {
  if (allEmployeesRef.value.length) return   // already loaded
  loadingEmployeeRefs.value = true
  try {
    const { data } = await axios.get('/api/reports/employees')
    allEmployeesRef.value = data.data
  } catch {
    showAlert('error', 'Failed to load division/section list.')
  } finally {
    loadingEmployeeRefs.value = false
  }
}

const attendanceMonthLabel = computed(() => {
  const m = MONTH_ITEMS.find(x => x.value === attendanceMonth.value)
  return `${m?.title ?? ''} ${attendanceYear.value}`
})

const filteredAttendanceRows = computed(() => {
  let rows = attendanceRows.value
  if (attFilterDivision.value) {
    rows = rows.filter(r => r.division === attFilterDivision.value)
  }
  if (attFilterSection.value) {
    rows = rows.filter(r => r.section === attFilterSection.value)
  }
  return rows
})

async function fetchAttendance() {
  loadingAttendance.value = true
  attendanceRows.value    = []
  try {
    const { data } = await axios.get('/api/reports/attendance', {
      params: {
        month:    attendanceMonth.value,
        year:     attendanceYear.value,
      },
    })
    attendanceRows.value    = data.data
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 404) {
      showAlert('warning', `No saved DTR summaries found for ${attendanceMonthLabel.value}. Please save DTR first.`)
    } else {
      showAlert('error', 'Failed to load attendance data.')
    }
  } finally {
    loadingAttendance.value = false
  }
}

async function exportAttendanceExcel() {
  exportingAttendance.value = true
  try {
    const resp = await axios.post('/api/reports/attendance/export', {
      month:        attendanceMonth.value,
      year:         attendanceYear.value,
      employee_ids: filteredAttendanceRows.value.map(r => r.user_id),
    }, { responseType: 'blob' })

    downloadBlob(resp.data,
      `Attendance_Summary_${attendanceMonthLabel.value.replace(' ', '_')}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    showAlert('success', 'Attendance Summary exported successfully.')
  } catch (err: any) {
    const msg = await blobErrorMessage(err)
    showAlert('error', msg ?? 'Failed to export attendance summary.')
  } finally {
    exportingAttendance.value = false
  }
}

/* ── Attendance PDF export (jsPDF) ────────────────────────────────────────── */
async function exportAttendancePdf() {
  if (!attendanceRows.value.length) {
    showAlert('warning', 'No attendance data to export.')
    return
  }

  exportingAttendancePdf.value = true
  try {
    if (!(window as any).jspdf) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
        s.onload  = () => resolve()
        s.onerror = () => reject(new Error('Failed to load jsPDF.'))
        document.head.appendChild(s)
      })
    }
    if (!(window as any).__jspdfAutotableLoaded) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
        s.onload  = () => {
          ;(window as any).__jspdfAutotableLoaded = true
          resolve()
        }
        s.onerror = () => reject(new Error('Failed to load AutoTable.'))
        document.head.appendChild(s)
      })
    }

    const { jsPDF } = (window as any).jspdf
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const periodLabel = attendanceMonthLabel.value
    const generated   = new Date().toLocaleDateString('en-PH', {
      month: 'long', day: 'numeric', year: 'numeric',
    })

    // ── Filter rows if not all selected ──────────────────────────────────────
    const rows = filteredAttendanceRows.value

    // ── Color palette: Deep Teal / Forest Green ───────────────────────────────
    const DEEP_TEAL       = [18,  78,  76]  as [number, number, number] // #124E4C
    const FOREST_GREEN    = [34, 102,  68]  as [number, number, number] // #226644
    const MIST_GREEN      = [232,245, 237]  as [number, number, number] // #E8F5ED
    const PALE_FERN       = [212,235, 220]  as [number, number, number] // #D4EBDC
    const CITRON          = [188,210,  55]  as [number, number, number] // #BCD237 — accent
    const WHITE           = [255,255, 255]  as [number, number, number]
    const LIGHT_GRAY      = [140,140, 140]  as [number, number, number]
    const CHARCOAL        = [45,  55,  45]  as [number, number, number]

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    // ── Header band ───────────────────────────────────────────────────────────
    doc.setFillColor(...DEEP_TEAL)
    doc.rect(0, 0, pageW, 32, 'F')
    doc.setFillColor(...CITRON)
    doc.rect(0, 32, pageW, 2, 'F')
    doc.setFillColor(...FOREST_GREEN)
    doc.rect(0, 0, 3, 34, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...WHITE)
    doc.text('DEPARTMENT OF HEALTH — REGION XII (SOCCSKSARGEN)', pageW / 2, 11, { align: 'center' })
    doc.setFontSize(13.5)
    doc.text('JO Employee Attendance Summary', pageW / 2, 20, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(180, 220, 195)
    doc.text(
      `Period Covered: ${periodLabel}   ·   Generated: ${generated}   ·   Total Employees: ${rows.length}`,
      pageW / 2, 28, { align: 'center' },
    )

    // ── Table ─────────────────────────────────────────────────────────────────
    const tableBody = rows.map((r, i) => [
      i + 1,
      r.full_name,
      r.position,
      r.regdays,
      r.total_rendered_hours,
      r.total_absent_days   > 0 ? String(r.total_absent_days)            : '—',
      r.total_late_minutes  > 0 ? fmtMins(r.total_late_minutes)         : '—',
      r.total_undertime_minutes > 0 ? fmtMins(r.total_undertime_minutes) : '—',
    ])

    // ── Totals / summary row ──────────────────────────────────────────────────
    const totalRendered  = rows.reduce((s, r) => s + Number(r.total_rendered_hours),    0)
    const totalAbsent    = rows.reduce((s, r) => s + Number(r.total_absent_days),        0)
    const totalLate      = rows.reduce((s, r) => s + Number(r.total_late_minutes),       0)
    const totalUndertime = rows.reduce((s, r) => s + Number(r.total_undertime_minutes),  0)

    const totalsRow = [
      { content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold' as const, halign: 'left' as const } },

      totalRendered.toFixed(2),
      totalAbsent   > 0 ? String(totalAbsent)       : '—',
      totalLate     > 0 ? fmtMins(totalLate)        : '—',
      totalUndertime > 0 ? fmtMins(totalUndertime)  : '—',
    ]

    ;(doc as any).autoTable({
      startY: 38,
      head: [[
        '#', 'Employee', 'Position',
        'Working Days', 'Hours Rendered',
        'Absent Days', 'Late', 'Undertime',
      ]],
      body: tableBody,
      foot: [totalsRow],
      showFoot: 'lastPage',
      theme: 'grid',
      styles: {
        fontSize:    7.5,
        cellPadding: 2.5,
        valign:      'middle',
        overflow:    'linebreak',
        textColor:   CHARCOAL,
        lineColor:   [180, 215, 195],
        lineWidth:   0.2,
      },
      headStyles: {
        fillColor: DEEP_TEAL,
        textColor: WHITE,
        fontStyle: 'bold',
        halign:    'center',
        fontSize:  7.5,
        lineColor: FOREST_GREEN,
        lineWidth: 0.3,
      },
      footStyles: {
        fillColor: PALE_FERN,
        textColor: DEEP_TEAL,
        fontStyle: 'bold',
        lineColor: [160, 205, 180],
        lineWidth: 0.3,
      },
      alternateRowStyles: { fillColor: MIST_GREEN },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8   },
        1: { cellWidth: 52 },
        2: { cellWidth: 42 },
        3: { halign: 'center', cellWidth: 22  },
        4: { halign: 'center', cellWidth: 28  },
        5: { halign: 'center', cellWidth: 22  },
        6: { halign: 'center', cellWidth: 22  },
        7: { halign: 'center', cellWidth: 22  },
      },
      margin: { left: 14, right: 14 },
    })

    // ── Footer bar ────────────────────────────────────────────────────────────
    doc.setFillColor(...CITRON)
    doc.rect(0, pageH - 7, pageW, 2, 'F')
    doc.setFillColor(...DEEP_TEAL)
    doc.rect(0, pageH - 5, pageW, 5, 'F')

    const finalY = (doc as any).lastAutoTable.finalY + 5
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(...LIGHT_GRAY)
    doc.text(
      'This report is system-generated. Based on saved DTR summaries with payroll adjustments applied where available.',
      pageW - 14, finalY, { align: 'right' },
    )

    const pdfBlob = doc.output('blob')
    const url     = URL.createObjectURL(pdfBlob)
    const tab     = window.open(url, '_blank')

    if (!tab) {
      showAlert('error', 'Popup blocked. Please allow popups for this site.')
      URL.revokeObjectURL(url)
      return
    }

    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    showAlert('success', 'Attendance PDF opened in a new tab.')
  } catch (err: any) {
    showAlert('error', err.message ?? 'PDF export failed.')
  } finally {
    exportingAttendancePdf.value = false
  }
}

/* ─────────────────────────────────────────
   STATE — Punctuality tab
───────────────────────────────────────── */
const generatingPunctualityPdf = ref(false)

const punctualityMonth      = ref<number>(prevMonth)
const punctualityYear       = ref<number>(currentYear)
const loadingPunctuality    = ref(false)
const punctualityDivisions  = ref<PunctualityDivision[]>([])
const punctualityLoadedLabel = ref('')

// ─── Fetch punctuality data from the API ───────────────────────────────────
// Backend returns employees with zero unjustified absences, zero effective
// late minutes, and zero undertime, grouped by division (min 12 regdays,
// hardcoded server-side).
async function fetchPunctuality() {
  loadingPunctuality.value   = true
  punctualityDivisions.value = []
  try {
    const { data } = await axios.get('/api/reports/punctuality', {
      params: {
        month: punctualityMonth.value,
        year:  punctualityYear.value,
      },
    })
    punctualityDivisions.value  = data.data
    punctualityLoadedLabel.value = punctualityMonthLabel.value
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 404) {
      // Backend distinguishes "no DTR data saved" vs "no one qualified" —
      // surface its specific message rather than a generic fallback.
      showAlert('warning', err?.response?.data?.message ?? `No punctuality data found for ${punctualityMonthLabel.value}.`)
    } else {
      showAlert('error', 'Failed to load punctuality data.')
    }
  } finally {
    loadingPunctuality.value = false
  }
}

const punctualityMonthLabel = computed(() => {
  const m = MONTH_ITEMS.find(x => x.value === punctualityMonth.value)
  return `${m?.title ?? ''} ${punctualityYear.value}`
})

// ─── Trigger PDF generation (DomPDF, backend-rendered) ─────────────────────
async function exportPunctualityPdf() {
  if (!punctualityDivisions.value.length) {
    showAlert('warning', 'No punctuality data to export.')
    return
  }

  generatingPunctualityPdf.value = true

  // Open the tab immediately while still in the user gesture context
  const previewTab = window.open('', '_blank')

  try {
    const resp = await axios.post('/api/reports/punctuality/generate', {
      month: punctualityMonth.value,
      year:  punctualityYear.value,
    }, { responseType: 'blob' })

    const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))

    if (previewTab) {
      previewTab.location.href = url
    }

    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    showAlert('success', 'Punctuality memo PDF opened in a new tab.')
  } catch (err: any) {
    previewTab?.close() // close the blank tab if the request failed
    const msg = await blobErrorMessage(err)
    showAlert('error', msg ?? 'Failed to generate punctuality memo PDF.')
  } finally {
    generatingPunctualityPdf.value = false
  }
}

/* ─────────────────────────────────────────
   STATE — Tardiness tab
───────────────────────────────────────── */
const generatingTardinessPdf = ref(false)

const tardinessMonth = ref<number>(prevMonth)
const tardinessYear      = ref<number>(currentYear)
const loadingTardiness   = ref(false)
const tardinessDivisions = ref<TardinessDivision[]>([])
const tardinessLoadedLabel = ref('')

// ─── Fetch tardiness data from your API ────────────────────────────────────
// Your backend should return employees grouped by division where days >= 5.
// Adjust the endpoint and response shape to match your actual API.
async function fetchTardiness() {
  loadingTardiness.value  = true
  tardinessDivisions.value = []
  try {
    const { data } = await axios.get('/api/reports/tardiness', {
      params: {
        month:    tardinessMonth.value,
        year:     tardinessYear.value,
        min_days: 6,  // only employees with 6+ tardiness days
      },
    })
     tardinessDivisions.value = data.data
     tardinessLoadedLabel.value = tardinessMonthLabel.value
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 404) {
      showAlert('warning', `No saved DTR data found for ${tardinessMonthLabel.value}.`)
    } else {
      showAlert('error', 'Failed to load tardiness data.')
    }
  } finally {
    loadingTardiness.value = false
  }
}

const tardinessMonthLabel = computed(() => {
  const m = MONTH_ITEMS.find(x => x.value === tardinessMonth.value)
  return `${m?.title ?? ''} ${tardinessYear.value}`
})

// ─── Trigger PDF generation (DomPDF, backend-rendered) ─────────────────────
async function exportTardinessPdf() {
  if (!tardinessDivisions.value.length) {
    showAlert('warning', 'No tardiness data to export.')
    return
  }

  generatingTardinessPdf.value = true

  // Open the tab immediately while still in the user gesture context
  const previewTab = window.open('', '_blank')

  try {
    const resp = await axios.post('/api/reports/tardiness/generate', {
      month: tardinessMonth.value,
      year:  tardinessYear.value,
    }, { responseType: 'blob' })

    const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))

    if (previewTab) {
      previewTab.location.href = url
    }

    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    showAlert('success', 'Tardiness memo PDF opened in a new tab.')
  } catch (err: any) {
    previewTab?.close() // close the blank tab if the request failed
    const msg = await blobErrorMessage(err)
    showAlert('error', msg ?? 'Failed to generate tardiness memo PDF.')
  } finally {
    generatingTardinessPdf.value = false
  }
}

/* ─────────────────────────────────────────
   STATE — Payslip tab
───────────────────────────────────────── */
const payslipStartMonth     = ref<number>(prevMonth)
const payslipStartYear      = ref<number>(prevYear)
const payslipEndMonth       = ref<number>(prevMonth)
const payslipEndYear        = ref<number>(prevYear)
const payslipEmployees      = ref<EmployeeOption[]>([])
const selectedEmpIds        = ref<number[]>([])   // emp_ids; empty = all
const loadingEmployees      = ref(false)
const generatingPdf         = ref(false)
const exportingPayslip      = ref(false)
const selectAll             = ref(false)
const payslipSearch         = ref('')
const excludedCount         = ref(0)
const payslipPeriodMenu     = ref(false)

// Validate that end period is not before start period
const endPeriodIsValid = computed(() => {
  if (payslipEndYear.value !== payslipStartYear.value) {
    return payslipEndYear.value > payslipStartYear.value
  }
  return payslipEndMonth.value >= payslipStartMonth.value
})

// When start changes, clamp end so it never falls before start
watch([payslipStartMonth, payslipStartYear], () => {
  if (!endPeriodIsValid.value) {
    payslipEndMonth.value = payslipStartMonth.value
    payslipEndYear.value  = payslipStartYear.value
  }
})

function toggleSelectAll() {
  if (selectAll.value) {
    selectedEmpIds.value = []
    selectAll.value      = false
  } else {
    selectedEmpIds.value = filteredPayslipEmployees.value.map(e => e.emp_id)
    selectAll.value      = true
  }
}

// Keep selectAll in sync when individual checkboxes are toggled
watch(selectedEmpIds, (val) => {
  selectAll.value = val.length === filteredPayslipEmployees.value.length
})

const payslipMonthLabel = computed(() => {
  const sm = MONTH_ITEMS.find(x => x.value === payslipStartMonth.value)
  const em = MONTH_ITEMS.find(x => x.value === payslipEndMonth.value)
  const startLabel = `${sm?.title ?? ''} ${payslipStartYear.value}`
  const endLabel   = `${em?.title ?? ''} ${payslipEndYear.value}`
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`
})

const isMultiMonth = computed(() =>
  payslipStartYear.value !== payslipEndYear.value ||
  payslipStartMonth.value !== payslipEndMonth.value
)

const periodCount = computed(() => {
  let count = 0
  let y = payslipStartYear.value
  let m = payslipStartMonth.value
  while (
    y < payslipEndYear.value ||
    (y === payslipEndYear.value && m <= payslipEndMonth.value)
  ) {
    count++
    m++
    if (m > 12) { m = 1; y++ }
  }
  return count
})



const filteredPayslipEmployees = computed(() => {
  const q = (payslipSearch.value ?? '').trim().toLowerCase()
  if (!q) return payslipEmployees.value
  return payslipEmployees.value.filter(e =>
    e.full_name.toLowerCase().includes(q)
  )
})

async function fetchPayslipEmployees() {
  if (!endPeriodIsValid.value) {
    showAlert('warning', 'End period cannot be before start period.')
    return
  }
  loadingEmployees.value = true
  payslipEmployees.value = []
  payslipSearch.value = ''
  try {
    const { data } = await axios.get('/api/reports/payslip', {
      params: {
        start_month: payslipStartMonth.value,
        start_year:  payslipStartYear.value,
        end_month:   payslipEndMonth.value,
        end_year:    payslipEndYear.value,
      },
    })
    payslipEmployees.value = data.data
    excludedCount.value    = data.meta?.excluded_count ?? 0
    selectedEmpIds.value   = []
  } catch {
    showAlert('error', 'Failed to load employee list.')
  } finally {
    loadingEmployees.value = false
  }
}

async function generatePdf() {
  if (selectedEmpIds.value.length === 0) {
    showAlert('warning', 'No employees selected. Please select at least one employee to generate PDF.')
    return
  }

  generatingPdf.value = true

  // Open the tab immediately while still in the user gesture context
  const previewTab = window.open('', '_blank')

  try {
    const resp = await axios.post('/api/reports/payslip/generate', {
      start_month:  payslipStartMonth.value,
      start_year:   payslipStartYear.value,
      end_month:    payslipEndMonth.value,
      end_year:     payslipEndYear.value,
      employee_ids: selectedEmpIds.value,
    }, { responseType: 'blob' })

    const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))

    if (previewTab) {
      previewTab.location.href = url
    }

    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    showAlert('success', 'Payslip PDF generated successfully.')
  } catch (err: any) {
    previewTab?.close() // close the blank tab if the request failed
    const msg = await blobErrorMessage(err)
    showAlert('error', msg ?? 'Failed to generate PDF.')
  } finally {
    generatingPdf.value = false
  }
}

async function exportPayslipExcel() {
  if (selectedEmpIds.value.length === 0) {
    showAlert('warning', 'No employees selected. Please select at least one employee to export Excel.')
    return
  }


  exportingPayslip.value = true
  try {
    const resp = await axios.post('/api/reports/payslip/export', {
      start_month:  payslipStartMonth.value,
      start_year:   payslipStartYear.value,
      end_month:    payslipEndMonth.value,
      end_year:     payslipEndYear.value,
      employee_ids: selectedEmpIds.value,
    }, { responseType: 'blob' })

    downloadBlob(resp.data, `Payslip_${payslipMonthLabel.value.replace(' ', '_')}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    showAlert('success', 'Payslip Excel exported successfully.')
  } catch (err: any) {
    const msg = await blobErrorMessage(err)
    showAlert('error', msg ?? 'Failed to export Excel.')
  } finally {
    exportingPayslip.value = false
  }
}

/* ─────────────────────────────────────────
   UTILITIES
───────────────────────────────────────── */
function downloadBlob(blob: Blob, filename: string, type: string) {
  const url  = URL.createObjectURL(new Blob([blob], { type }))
  const link = document.createElement('a')
  link.href  = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function blobErrorMessage(err: any): Promise<string | null> {
  try {
    if (err?.response?.data instanceof Blob) {
      const text = await err.response.data.text()
      const json = JSON.parse(text)
      return json?.message ?? null
    }
  } catch {}
  return err?.response?.data?.message ?? null
}

function fmtMins(mins: number): string {
  return `${mins}m`
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(() => {
  fetchEmployeeRefs()
})

watch(activeTab, (tab) => {
  if (tab === 'attendance') fetchEmployeeRefs()
})
</script>

<template>
  <div>
    <VContainer fluid class="pa-6">

  <!-- ── Page Header ── -->
  <div class="mb-6">
    <h4 class="text-h5 font-weight-bold mb-1">Reports</h4>
    <p class="text-body-2 text-medium-emphasis mb-0">
      Generate tardiness, payslips, and export attendance summaries.
    </p>
  </div>

  <!-- ── Info Banner (tab-specific) ── -->
  <VAlert
    v-if="tabBanner"
    :type="tabBanner.type"
    :icon="tabBanner.icon"
    variant="tonal"
    rounded="lg"
    class="mb-6"
  >
    <template #title>{{ tabBanner.title }}</template>
    <span v-html="tabBanner.body" />
  </VAlert>

  <!-- ── Tabs ── -->
  <VTabs v-model="activeTab" color="primary" class="mb-6">
    <VTab value="attendance" prepend-icon="mdi-file-document-outline">Attendance Summary</VTab>
    <VTab value="punctuality" prepend-icon="mdi-clock-check-outline">Punctuality</VTab>
    <VTab value="tardiness" prepend-icon="mdi-clock-alert-outline">Tardiness</VTab>
    <VTab value="payslip" prepend-icon="mdi-calendar-check-outline">Payslip</VTab>
  </VTabs>

  <VWindow v-model="activeTab">
    <!-- ══════════════════════════════════════════
          TAB 1 — ATTENDANCE SUMMARY
    ══════════════════════════════════════════ -->
    <VWindowItem value="attendance">
      <VRow>

        <!-- ── Period + controls ── -->
        <VCol cols="12">
          <VCard variant="flat" rounded="lg">
            <VCardText>
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
                Select Period
              </p>
              <VRow dense align="center">
                <VCol cols="12" sm="6" md="2">
                  <VSelect
                    v-model="attendanceMonth"
                    label="Month"
                    :items="MONTH_ITEMS"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-calendar-month-outline"
                    hide-details
                  />
                </VCol>
                <VCol cols="12" sm="6" md="2">
                  <VSelect
                    v-model="attendanceYear"
                    label="Year"
                    :items="YEAR_ITEMS"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-calendar-outline"
                    hide-details
                  />
                </VCol>
                <VCol cols="12" sm="6" md="3">
                  <VSelect
                    v-model="attFilterDivision"
                    :items="divisionOptions"
                    :loading="loadingEmployeeRefs"
                    label="Division (optional)"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-office-building-outline"
                    clearable
                    hide-details
                    placeholder="All divisions"
                  />
                </VCol>
                <VCol cols="12" sm="6" md="3">
                  <VSelect
                    v-model="attFilterSection"
                    :items="sectionOptions"
                    :disabled="!attFilterDivision"
                    label="Section (optional)"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-account-group-outline"
                    clearable
                    hide-details
                    placeholder="All sections"
                  />
                </VCol>
                <VCol cols="12" sm="6" md="2">
                  <VBtn
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-magnify"
                    :loading="loadingAttendance"
                    block
                    @click="fetchAttendance"
                  >
                    Load Summary
                  </VBtn>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
        </VCol>

        <!-- ── Attendance table ── -->
        <VCol v-if="attendanceRows.length" cols="12">
          <VCard variant="flat" rounded="lg">
            <VCardText>
              <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4">
                <div>
                  <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
                    Attendance Summary — {{ attendanceMonthLabel }}
                  </p>
                  <p class="text-caption text-medium-emphasis mt-1">
                    {{ filteredAttendanceRows.length }} employees
                  </p>
                </div>
                <div class="d-flex gap-2 align-center">
                  <VBtn
                    color="error"
                    variant="outlined"
                    prepend-icon="mdi-file-pdf-box"
                    :loading="exportingAttendancePdf"
                    :disabled="exportingAttendance"
                    @click="exportAttendancePdf"
                  >
                    Export PDF
                  </VBtn>
                  <VBtn
                    color="success"
                    variant="outlined"
                    prepend-icon="mdi-microsoft-excel"
                    :loading="exportingAttendance"
                    :disabled="exportingAttendancePdf"
                    @click="exportAttendanceExcel"
                  >
                    Export Excel
                  </VBtn>
                </div>
              </div>

              <!-- Data table -->
              <VDataTable
                :headers="ATTENDANCE_HEADERS"
                :items="filteredAttendanceRows"
                :items-per-page="15"
                density="compact"
                class="rounded-lg"
              >
                <template #item.total_rendered_hours="{ item }">
                  {{ item.total_rendered_hours }}h
                </template>
                <template #item.total_late_minutes="{ item }">
                  <div class="d-flex align-center gap-1">
                    <VChip
                      v-if="item.total_late_minutes > 0"
                      color="warning"
                      size="x-small"
                      variant="tonal"
                      label
                    >
                      {{ fmtMins(item.total_late_minutes) }}
                    </VChip>
                    <span v-else class="text-medium-emphasis">—</span>
                    <VTooltip v-if="item.has_adjustment && item.dtr_late_minutes !== item.total_late_minutes" location="top">
                      <template #activator="{ props }">
                        <VChip v-bind="props" color="info" size="x-small" variant="tonal" label>adj</VChip>
                      </template>
                      <span>
                        DTR: {{ fmtMins(item.dtr_late_minutes) }}
                        <template v-if="item.pass_slip_late_minutes > 0"> + pass slip: {{ fmtMins(item.pass_slip_late_minutes) }}</template>
                        <template v-if="item.absent_penalty_removed_minutes > 0"> − Official Travel/Leave: {{ fmtMins(item.absent_penalty_removed_minutes) }}</template>
                        = {{ fmtMins(item.total_late_minutes) }}
                      </span>                    
                    </VTooltip>
                  </div>
                </template>
                <template #item.total_undertime_minutes="{ item }">
                  <VChip
                    v-if="item.total_undertime_minutes > 0"
                    color="info"
                    size="x-small"
                    variant="tonal"
                    label
                  >
                    {{ fmtMins(item.total_undertime_minutes) }}
                  </VChip>
                  <span v-else class="text-medium-emphasis">—</span>
                </template>
                <template #item.total_absent_days="{ item }">
                  <div class="d-flex align-center gap-1">
                    <VChip
                      v-if="item.total_absent_days > 0"
                      color="error"
                      size="x-small"
                      variant="tonal"
                      label
                    >
                      {{ item.total_absent_days }}
                    </VChip>
                    <span v-else class="text-medium-emphasis">—</span>
                    <VTooltip v-if="item.has_adjustment && item.dtr_absent_days !== item.total_absent_days" location="top">
                      <template #activator="{ props }">
                        <VChip v-bind="props" color="info" size="x-small" variant="tonal" label>adj</VChip>
                      </template>
                      DTR: {{ item.dtr_absent_days }} day(s) − {{ item.dtr_absent_days - item.total_absent_days }} leave/travel = {{ item.total_absent_days }} day(s)
                    </VTooltip>
                  </div>
                </template>
              </VDataTable>

            </VCardText>
          </VCard>
        </VCol>

        <!-- ── Empty state ── -->
        <VCol v-else-if="!loadingAttendance" cols="12">
          <VCard variant="tonal" rounded="lg" color="default">
            <VCardText class="text-center py-8">
              <VIcon icon="mdi-calendar-check-outline" size="48" class="mb-3 text-medium-emphasis" />
              <p class="text-body-1 text-medium-emphasis">
                Select a period and click <strong>Load Summary</strong> to view saved DTR data.
              </p>
              <p class="text-caption text-medium-emphasis mt-2">
                Make sure DTR has been saved for the selected period from the DTR module.
              </p>
            </VCardText>
          </VCard>
        </VCol>

      </VRow>
    </VWindowItem>    

    <!-- ══════════════════════════════════════════
          TAB 2 — PUNCTUALITY
    ══════════════════════════════════════════ -->
    <VWindowItem value="punctuality">
      <VRow>

        <!-- Period + controls -->
        <VCol cols="12">
          <VCard variant="flat" rounded="lg">
            <VCardText>
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
                Select Period
              </p>
              <VRow dense align="center">
                <VCol cols="12" sm="6" md="2">
                  <VSelect
                    v-model="punctualityMonth"
                    label="Month"
                    :items="MONTH_ITEMS"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-calendar-month-outline"
                    hide-details
                  />
                </VCol>
                <VCol cols="12" sm="6" md="2">
                  <VSelect
                    v-model="punctualityYear"
                    label="Year"
                    :items="YEAR_ITEMS"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-calendar-outline"
                    hide-details
                  />
                </VCol>
                <VCol cols="12" sm="6" md="2">
                  <VBtn
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-magnify"
                    :loading="loadingPunctuality"
                    block
                    @click="fetchPunctuality"
                  >
                    Load Data
                  </VBtn>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
        </VCol>

        <!-- Results: one card per division (shown after data loads) -->
        <VCol v-if="punctualityDivisions.length" cols="12">

          <!-- Export button at top -->
          <div class="d-flex justify-end mb-4">
            <VBtn
              color="error"
              variant="outlined"
              prepend-icon="mdi-file-pdf-box"
              :loading="generatingPunctualityPdf"
              @click="exportPunctualityPdf"
            >
              Export PDF
            </VBtn>
          </div>

          <!-- One card per division -->
          <VCard
            v-for="division in punctualityDivisions"
            :key="division.name"
            variant="flat"
            rounded="lg"
            class="mb-4"
          >
            <VCardText>
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
                {{ division.name }}
              </p>
              <VDataTable
                :headers="[
                  { title: '#',            key: 'index',    sortable: false, width: '40px'  },
                  { title: 'Name',         key: 'name',     sortable: true  },
                  { title: 'Position',     key: 'position', sortable: true  },
                  { title: 'Month',        key: 'month',    sortable: false, width: '100px' },
                  { title: 'Days Present', key: 'regdays',  sortable: true,  width: '130px' },
                ]"
                :items="division.employees.map((e, i) => ({ ...e, index: i + 1, month: punctualityLoadedLabel }))"
                :items-per-page="-1"
                density="compact"
                hide-default-footer
                class="rounded-lg"
              >
                <template #item.index="{ item }">
                  <span class="text-medium-emphasis">{{ item.index }}</span>
                </template>
                <template #item.name="{ item }">
                  <div class="d-flex align-center gap-2">
                    <span class="font-weight-medium">{{ item.name }}</span>
                    <VTooltip v-if="item.has_adjustments" location="top">
                      <template #activator="{ props }">
                        <VChip
                          v-bind="props"
                          color="info"
                          size="x-small"
                          variant="tonal"
                          label
                          prepend-icon="mdi-clipboard-clock-outline"
                        >
                          adj
                        </VChip>
                      </template>
                      <span>Absence(s) fully offset by Leave/Official Travel</span>
                    </VTooltip>
                  </div>
                </template>
                <template #item.regdays="{ item }">
                  <VChip color="success" size="x-small" variant="tonal" label>
                    {{ item.regdays }}
                  </VChip>
                </template>
              </VDataTable>
              <!-- Legend: shown only if any employee in this division has adjustments -->
              <div
                v-if="division.employees.some(e => e.has_adjustments)"
                class="d-flex align-center gap-1 mt-2 px-1"
              >
                <VChip color="info" size="x-small" variant="tonal" label prepend-icon="mdi-clipboard-clock-outline">
                  adj
                </VChip>
                <span class="text-caption text-medium-emphasis">
                  — Absence(s) fully offset by approved Leave or Official Travel
                </span>
              </div>
            </VCardText>
          </VCard>

        </VCol>

        <!-- Empty state -->
        <VCol v-else-if="!loadingPunctuality" cols="12">
          <VCard variant="tonal" rounded="lg" color="default">
            <VCardText class="text-center py-8">
              <VIcon icon="mdi-clock-check-outline" size="48" class="mb-3 text-medium-emphasis" />
              <p class="text-body-1 text-medium-emphasis">
                Select a period and click <strong>Load Data</strong> to view punctuality records.
              </p>
              <p class="text-caption text-medium-emphasis mt-2">
                Employees with zero unjustified absences, zero tardiness, and zero undertime will appear here, grouped by division. Absences covered by Leave/Official Travel are included and flagged.
              </p>
            </VCardText>
          </VCard>
        </VCol>

      </VRow>
    </VWindowItem>

    <!-- ══════════════════════════════════════════
          TAB 3 — TARDINESS
    ══════════════════════════════════════════ -->
    <VWindowItem value="tardiness">
      <VRow>
  
        <!-- Period + controls -->
        <VCol cols="12">
          <VCard variant="flat" rounded="lg">
            <VCardText>
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
                Select Period
              </p>
              <VRow dense align="center">
                <VCol cols="12" sm="6" md="2">
                  <VSelect
                    v-model="tardinessMonth"
                    label="Month"
                    :items="MONTH_ITEMS"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-calendar-month-outline"
                    hide-details
                  />
                </VCol>
                <VCol cols="12" sm="6" md="2">
                  <VSelect
                    v-model="tardinessYear"
                    label="Year"
                    :items="YEAR_ITEMS"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-calendar-outline"
                    hide-details
                  />
                </VCol>
                <VCol cols="12" sm="6" md="2">
                  <VBtn
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-magnify"
                    :loading="loadingTardiness"
                    block
                    @click="fetchTardiness"
                  >
                    Load Data
                  </VBtn>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
        </VCol>
  
        <!-- Results: two side-by-side report cards (shown after data loads) -->
        <VCol v-if="tardinessDivisions.length" cols="12">
  
          <!-- Export button at top -->
          <div class="d-flex justify-end mb-4">
            <VBtn
              color="error"
              variant="outlined"
              prepend-icon="mdi-file-pdf-box"
              :loading="generatingTardinessPdf"
              @click="exportTardinessPdf"
            >
              Export PDF
            </VBtn>
          </div>
  
          <!-- One card per division -->
          <VCard
            v-for="division in tardinessDivisions"
            :key="division.name"
            variant="flat"
            rounded="lg"
            class="mb-4"
          >
            <VCardText>
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
                {{ division.name }}
              </p>
              <VDataTable
                :headers="[
                  { title: '#',          key: 'index',   sortable: false, width: '40px'  },
                  { title: 'Name',       key: 'name',    sortable: true  },
                  { title: 'Month',      key: 'month',   sortable: false, width: '100px' },
                  { title: 'Dates',      key: 'dates',   sortable: false },
                  { title: '# of Days', key: 'days',    sortable: true,  width: '90px'  },
                  { title: 'Mins',       key: 'minutes', sortable: true,  width: '80px'  },
                ]"
                :items="division.employees.map((e, i) => ({ ...e, index: i + 1, month: tardinessLoadedLabel }))"
                :items-per-page="-1"
                density="compact"
                hide-default-footer
                class="rounded-lg"
              >
                <template #item.index="{ item }">
                  <span class="text-medium-emphasis">{{ item.index }}</span>
                </template>
                <template #item.name="{ item }">
                  <div class="d-flex align-center gap-2">
                    <span class="font-weight-medium">{{ item.name }}</span>
                    <VTooltip v-if="item.has_adjustments" location="top">
                      <template #activator="{ props }">
                        <VChip
                          v-bind="props"
                          color="warning"
                          size="x-small"
                          variant="tonal"
                          label
                          prepend-icon="mdi-clipboard-clock-outline"
                        >
                          adj
                        </VChip>
                      </template>
                      <span>Includes pass-slip late adjustment(s)</span>
                    </VTooltip>
                  </div>
                </template>
                <template #item.days="{ item }">
                  <VChip
                    :color="item.days >= 10 ? 'error' : item.days >= 7 ? 'warning' : 'default'"
                    size="x-small"
                    variant="tonal"
                    label
                  >
                    {{ item.days }}
                  </VChip>
                </template>
              </VDataTable>
              <!-- Legend: shown only if any employee in this division has adjustments -->
              <div
                v-if="division.employees.some(e => e.has_adjustments)"
                class="d-flex align-center gap-1 mt-2 px-1"
              >
                <VChip color="warning" size="x-small" variant="tonal" label prepend-icon="mdi-clipboard-clock-outline">
                  adj
                </VChip>
                <span class="text-caption text-medium-emphasis">
                  — Late minutes include pass-slip adjustment(s) not captured in DTR
                </span>
              </div>
            </VCardText>
          </VCard>
  
        </VCol>
  
        <!-- Empty state -->
        <VCol v-else-if="!loadingTardiness" cols="12">
          <VCard variant="tonal" rounded="lg" color="default">
            <VCardText class="text-center py-8">
              <VIcon icon="mdi-clock-alert-outline" size="48" class="mb-3 text-medium-emphasis" />
              <p class="text-body-1 text-medium-emphasis">
                Select a period and click <strong>Load Data</strong> to view tardiness records.
              </p>
              <p class="text-caption text-medium-emphasis mt-2">
                Employees with 6 or more days of tardiness will appear here, grouped by division. Pass-slip late adjustments are included.
              </p>
            </VCardText>
          </VCard>
        </VCol>
  
      </VRow>
    </VWindowItem>

    <!-- ══════════════════════════════════════════
          TAB 4 — PAYSLIP
    ══════════════════════════════════════════ -->
    <VWindowItem value="payslip">
      <VRow>

        <!-- ── Period + controls ── -->
        <VCol cols="12">
          <VCard variant="flat" rounded="lg">
            <VCardText>
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
                Select Period
              </p>

              <!-- ── Collapsed period trigger + popover ── -->
              <VMenu
                v-model="payslipPeriodMenu"
                :close-on-content-click="false"
                location="bottom start"
                min-width="380"
              >
                <template #activator="{ props }">
                  <VBtn
                    v-bind="props"
                    variant="outlined"
                    :color="endPeriodIsValid ? 'primary' : 'error'"
                    prepend-icon="mdi-calendar-range-outline"
                    append-icon="mdi-chevron-down"
                    class="mb-3 text-none"
                  >
                    {{ payslipMonthLabel }}
                    <VChip
                      v-if="isMultiMonth"
                      size="x-small"
                      color="primary"
                      variant="flat"
                      label
                      class="ml-2"
                    >
                      {{ periodCount }} mo
                    </VChip>
                  </VBtn>
                </template>

                <VCard rounded="lg" elevation="4">
                  <VCardText>
                    <VRow dense align="center">
                      <!-- FROM -->
                      <VCol cols="12" sm="6">
                        <p class="text-caption text-medium-emphasis mb-2">
                          <VIcon icon="mdi-calendar-plus-outline" size="14" class="me-1" />
                          From
                        </p>
                        <VRow dense>
                          <VCol cols="7">
                            <VSelect
                              v-model="payslipStartMonth"
                              label="Month"
                              :items="MONTH_ITEMS"
                              item-title="title"
                              item-value="value"
                              variant="outlined"
                              density="compact"
                              hide-details
                            />
                          </VCol>
                          <VCol cols="5">
                            <VSelect
                              v-model="payslipStartYear"
                              label="Year"
                              :items="YEAR_ITEMS"
                              variant="outlined"
                              density="compact"
                              hide-details
                            />
                          </VCol>
                        </VRow>
                      </VCol>

                      <!-- TO -->
                      <VCol cols="12" sm="6">
                        <p class="text-caption text-medium-emphasis mb-2">
                          <VIcon icon="mdi-calendar-check-outline" size="14" class="me-1" />
                          To
                        </p>
                        <VRow dense>
                          <VCol cols="7">
                            <VSelect
                              v-model="payslipEndMonth"
                              label="Month"
                              :items="MONTH_ITEMS"
                              item-title="title"
                              item-value="value"
                              variant="outlined"
                              density="compact"
                              hide-details
                              :error="!endPeriodIsValid"
                            />
                          </VCol>
                          <VCol cols="5">
                            <VSelect
                              v-model="payslipEndYear"
                              label="Year"
                              :items="YEAR_ITEMS"
                              variant="outlined"
                              density="compact"
                              hide-details
                              :error="!endPeriodIsValid"
                            />
                          </VCol>
                        </VRow>
                      </VCol>
                    </VRow>

                    <!-- Error hint -->
                    <p v-if="!endPeriodIsValid" class="text-caption text-error mt-2 mb-0">
                      <VIcon icon="mdi-alert-circle-outline" size="14" class="me-1" />
                      End period cannot be before start period.
                    </p>
                  </VCardText>

                  <VDivider />

                  <VCardActions>
                    <VSpacer />
                    <VBtn
                      variant="flat"
                      color="primary"
                      :disabled="!endPeriodIsValid"
                      @click="payslipPeriodMenu = false"
                    >
                      Done
                    </VBtn>
                  </VCardActions>
                </VCard>
              </VMenu>

              <!-- Search + Load row -->
              <VRow dense align="center">
                <VCol cols="12" sm="6" md="8">
                  <VTextField
                    v-model="payslipSearch"
                    label="Search employee"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-magnify"
                    clearable
                    hide-details
                    placeholder="Type a name..."
                    :disabled="!payslipEmployees.length"
                  />
                </VCol>
                <VCol cols="12" sm="6" md="3">
                  <VBtn
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-magnify"
                    :loading="loadingEmployees"
                    :disabled="!endPeriodIsValid"
                    block
                    @click="fetchPayslipEmployees"
                  >
                    Load Data
                  </VBtn>
                </VCol>
              </VRow>

            </VCardText>
          </VCard>
        </VCol>

        <!-- ── Employee selection ── -->
        <VCol v-if="payslipEmployees.length" cols="12">
          <VCard variant="flat" rounded="lg">
            <VCardText>
              <!-- ── Header row: title + chips + select all toggle ── -->
              <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-3">
                <div>
                  <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
                    Employees — {{ payslipMonthLabel }}
                  </p>
                  <p class="text-caption text-medium-emphasis mt-1">
                    <VChip color="success" size="x-small" variant="tonal" label class="me-1">
                      {{ filteredPayslipEmployees.filter(e => e.has_batch).length }} payroll ready
                    </VChip>
                    <VChip v-if="filteredPayslipEmployees.filter(e => !e.has_batch && e.batch_count > 0).length" color="warning" size="x-small" variant="tonal" label class="me-1">
                      {{ filteredPayslipEmployees.filter(e => !e.has_batch && e.batch_count > 0).length }} partial
                    </VChip>
                    <VChip v-if="excludedCount > 0" color="default" size="x-small" variant="tonal" label class="me-1">
                      {{ excludedCount }} excluded
                    </VChip>
                    <VChip color="primary" size="x-small" variant="tonal" label>
                      {{ selectedEmpIds.length }} selected
                    </VChip>
                  </p>
                </div>
                <div class="d-flex gap-2 align-center flex-wrap">
                  <VBtn
                    :color="selectAll ? 'primary' : 'default'"
                    :variant="selectAll ? 'tonal' : 'outlined'"
                    size="small"
                    prepend-icon="mdi-check-all"
                    @click="toggleSelectAll"
                  >
                    {{ selectAll ? 'Clear' : 'Select All' }}
                  </VBtn>
                  <VBtn
                    color="error"
                    variant="outlined"
                    size="small"
                    prepend-icon="mdi-file-pdf-box"
                    :loading="generatingPdf"
                    :disabled="exportingPayslip || loadingEmployees"
                    @click="generatePdf"
                  >
                    Generate PDF
                  </VBtn>
                  <VBtn
                    color="success"
                    variant="outlined"
                    size="small"
                    prepend-icon="mdi-microsoft-excel"
                    :loading="exportingPayslip"
                    :disabled="generatingPdf || loadingEmployees"
                    @click="exportPayslipExcel"
                  >
                    Export Excel
                  </VBtn>
                </div>
              </div>

              <!-- ── Always-visible employee list ── -->
              <VDivider class="mb-3" />
              <VRow dense>
                <VCol
                  v-for="emp in filteredPayslipEmployees"
                  :key="emp.emp_id"
                  cols="12" sm="6" md="4"
                >
                  <VCheckbox
                    v-model="selectedEmpIds"
                    :value="emp.emp_id"
                    density="compact"
                    hide-details
                    :color="emp.has_batch ? 'primary' : emp.batch_count > 0 ? 'warning' : 'error'"
                  >
                    <template #label>
                      <div>
                        <div class="text-body-2">{{ emp.full_name }}</div>
                        <div class="text-caption text-medium-emphasis">{{ emp.position }}</div>
                        <!-- All periods have a batch item: no badge needed -->
                        <VChip
                          v-if="!emp.has_batch && emp.batch_count > 0"
                          color="warning"
                          size="x-small"
                          variant="tonal"
                          label
                          class="mt-1"
                        >
                          Batch: {{ emp.batch_count }}/{{ emp.period_count }} months
                        </VChip>
                        <VChip
                          v-else-if="emp.batch_count === 0"
                          color="error"
                          size="x-small"
                          variant="tonal"
                          label
                          class="mt-1"
                        >
                          No payroll batch
                        </VChip>
                      </div>
                    </template>
                  </VCheckbox>
                </VCol>
              </VRow>


            </VCardText>
          </VCard>
        </VCol>

        <!-- ── Empty state ── -->
        <VCol v-else-if="!loadingEmployees" cols="12">
          <VCard variant="tonal" rounded="lg" color="default">
            <VCardText class="text-center py-8">
              <VIcon icon="mdi-file-document-outline" size="48" class="mb-3 text-medium-emphasis" />
              <p class="text-body-1 text-medium-emphasis">
                Select a period and click <strong>Load Data</strong> to begin.
              </p>
              <p class="text-caption text-medium-emphasis mt-2">
                Only employees with a payroll batch for the selected period will appear here.
              </p>
            </VCardText>
          </VCard>
        </VCol>

      </VRow>
    </VWindowItem>

  </VWindow>

    </VContainer>

    <!-- ── Alert ── -->
    <BaseAlert
      v-model="alertVisible"
      :message="alertMessage"
      :type="alertType"
      :timeout="3500"
    />
  </div>
</template>
