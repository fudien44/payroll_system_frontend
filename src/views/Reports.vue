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
  has_dtr:          boolean
  wage:             number
  premium_percent:  number
}

interface AttendanceRow {
  user_id:                  number
  full_name:                string
  position:                 string
  regdays:                  number
  total_rendered_hours:     number
  total_absent_days:        number
  total_late_minutes:       number
  total_undertime_minutes:  number
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
const activeTab   = ref<'payslip' | 'attendance'>('payslip')
const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

function showAlert(type: AlertType, msg: string) {
  alertType.value    = type
  alertMessage.value = msg
  alertVisible.value = true
}

/* ─────────────────────────────────────────
   STATE — Payslip tab
───────────────────────────────────────── */
const payslipMonth        = ref<number>(new Date().getMonth()) // default: preceding month
const payslipYear         = ref<number>(currentYear)
const payslipEmployees    = ref<EmployeeOption[]>([])
const selectedEmpIds      = ref<number[]>([])   // emp_ids; empty = all
const loadingEmployees    = ref(false)
const generatingPdf       = ref(false)
const exportingPayslip    = ref(false)
const selectAll = ref(false)
const payslipFilterDivision = ref<string | null>(null)
const payslipFilterSection  = ref<string | null>(null)

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
  const m = MONTH_ITEMS.find(x => x.value === payslipMonth.value)
  return `${m?.title ?? ''} ${payslipYear.value}`
})

const employeesWithDtr = computed(() =>
  filteredPayslipEmployees.value.filter(e => e.has_dtr)
)

const payslipSectionOptions = computed(() => {
  const base = payslipFilterDivision.value
    ? allEmployeesRef.value.filter(e => e.division === payslipFilterDivision.value)
    : allEmployeesRef.value
  return [...new Set(base.map(e => e.section).filter(Boolean))].sort() as string[]
})

watch(payslipFilterDivision, () => {
  if (payslipFilterSection.value && !payslipSectionOptions.value.includes(payslipFilterSection.value)) {
    payslipFilterSection.value = null
  }
})

const filteredPayslipEmployees = computed(() => {
  if (!payslipFilterDivision.value && !payslipFilterSection.value) {
    return payslipEmployees.value
  }
  const refMap = new Map(allEmployeesRef.value.map(e => [e.emp_id, e]))
  return payslipEmployees.value.filter(e => {
    const ref = refMap.get(e.emp_id)
    if (!ref) return false
    if (payslipFilterDivision.value && ref.division !== payslipFilterDivision.value) return false
    if (payslipFilterSection.value  && ref.section  !== payslipFilterSection.value)  return false
    return true
  })
})

async function fetchPayslipEmployees() {
  loadingEmployees.value = true
  payslipEmployees.value = []
  try {
    const { data } = await axios.get('/api/reports/payslip', {
      params: { month: payslipMonth.value, year: payslipYear.value },
    })
    payslipEmployees.value = data.data
    selectedEmpIds.value = []
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
      month:        payslipMonth.value,
      year:         payslipYear.value,
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
      month:        payslipMonth.value,
      year:         payslipYear.value,
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
   STATE — Attendance tab
───────────────────────────────────────── */
const attendanceMonth     = ref<number>(new Date().getMonth())
const attendanceYear      = ref<number>(currentYear)
const attendanceRows      = ref<AttendanceRow[]>([])
const loadingAttendance      = ref(false)
const exportingAttendance    = ref(false)
const exportingAttendancePdf = ref(false)
const selectedAttEmpIds      = ref<number[]>([])
const selectAllAtt           = ref(true)

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

const resolvedAttEmpIds = computed(() =>
  selectAllAtt.value ? [] : selectedAttEmpIds.value
)

async function fetchAttendance() {
  loadingAttendance.value = true
  attendanceRows.value    = []
  try {
    const { data } = await axios.get('/api/reports/attendance', {
      params: {
        month:    attendanceMonth.value,
        year:     attendanceYear.value,
        division: attFilterDivision.value ?? undefined,
        section:  attFilterSection.value  ?? undefined,
      },
    })
    attendanceRows.value    = data.data
    selectedAttEmpIds.value = data.data.map((r: AttendanceRow) => r.user_id)
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
      employee_ids: resolvedAttEmpIds.value.length ? resolvedAttEmpIds.value : null,
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
    // ── Lazy-load jsPDF ──────────────────────────────────────────────────────
    if (!(window as any).jspdf) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
        s.onload  = () => resolve()
        s.onerror = () => reject(new Error('Failed to load jsPDF.'))
        document.head.appendChild(s)
      })
    }
    if (!(window as any).jspdfAutotable) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
        s.onload  = () => resolve()
        s.onerror = () => reject(new Error('Failed to load AutoTable.'))
        document.head.appendChild(s)
        ;(window as any).jspdfAutotable = true
      })
    }

    const { jsPDF } = (window as any).jspdf
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const periodLabel = attendanceMonthLabel.value
    const generated   = new Date().toLocaleDateString('en-PH', {
      month: 'long', day: 'numeric', year: 'numeric',
    })

    // ── Filter rows if not all selected ──────────────────────────────────────
    const rows = selectAllAtt.value
      ? attendanceRows.value
      : attendanceRows.value.filter(r => selectedAttEmpIds.value.includes(r.user_id))

    if (!rows.length) {
      showAlert('warning', 'No employees selected for export.')
      return
    }

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
      r.total_late_minutes  > 0 ? fmtHours(r.total_late_minutes)         : '—',
      r.total_undertime_minutes > 0 ? fmtHours(r.total_undertime_minutes) : '—',
    ])

    // ── Totals / summary row ──────────────────────────────────────────────────
    const totalRendered  = rows.reduce((s, r) => s + Number(r.total_rendered_hours),    0)
    const totalAbsent    = rows.reduce((s, r) => s + Number(r.total_absent_days),        0)
    const totalLate      = rows.reduce((s, r) => s + Number(r.total_late_minutes),       0)
    const totalUndertime = rows.reduce((s, r) => s + Number(r.total_undertime_minutes),  0)

    const totalsRow = [
      { content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold' as const, halign: 'left' as const } },
      '',
      totalRendered.toFixed(2),
      totalAbsent   > 0 ? String(totalAbsent)            : '—',
      totalLate     > 0 ? fmtHours(totalLate)            : '—',
      totalUndertime > 0 ? fmtHours(totalUndertime)      : '—',
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
      'This report is system-generated. Based on saved DTR summaries from the DTR module.',
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

function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(() => {
  fetchPayslipEmployees()
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
      Generate payslip PDFs and export attendance summaries.
    </p>
  </div>

  <!-- ── Tabs ── -->
  <VTabs v-model="activeTab" color="primary" class="mb-6">
    <VTab value="payslip" prepend-icon="mdi-file-document-outline">Payslip</VTab>
    <VTab value="attendance" prepend-icon="mdi-calendar-check-outline">Attendance Summary</VTab>
  </VTabs>

  <VWindow v-model="activeTab">

    <!-- ══════════════════════════════════════════
          TAB 1 — PAYSLIP
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
              <VRow dense align="center">
                <VCol cols="12" sm="6" md="2">
                  <VSelect
                    v-model="payslipMonth"
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
                    v-model="payslipYear"
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
                    v-model="payslipFilterDivision"
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
                    v-model="payslipFilterSection"
                    :items="payslipSectionOptions"
                    :disabled="!divisionOptions.length"
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
                    :loading="loadingEmployees"
                    block
                    @click="fetchPayslipEmployees"
                  >
                    Load Employees
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
                      {{ filteredPayslipEmployees.filter(e => e.has_dtr).length }} with DTR
                    </VChip>
                    <VChip v-if="filteredPayslipEmployees.filter(e => !e.has_dtr).length" color="warning" size="x-small" variant="tonal" label class="me-1">
                      {{ filteredPayslipEmployees.filter(e => !e.has_dtr).length }} missing DTR
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
                    :color="emp.has_dtr ? 'primary' : 'warning'"
                  >
                    <template #label>
                      <div>
                        <div class="text-body-2">{{ emp.full_name }}</div>
                        <div class="text-caption text-medium-emphasis">{{ emp.position }}</div>
                        <VChip
                          v-if="!emp.has_dtr"
                          color="warning"
                          size="x-small"
                          variant="tonal"
                          label
                          class="mt-1"
                        >
                          No DTR saved
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
                Select a period and click <strong>Load Employees</strong> to begin.
              </p>
            </VCardText>
          </VCard>
        </VCol>

      </VRow>
    </VWindowItem>

    <!-- ══════════════════════════════════════════
          TAB 2 — ATTENDANCE SUMMARY
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
                    :disabled="!divisionOptions.length"
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
                    {{ attendanceRows.length }} employees
                  </p>
                </div>
                <div class="d-flex gap-2 align-center">
                  <!-- <VSwitch
                    v-model="selectAllAtt"
                    label="All"
                    color="primary"
                    density="compact"
                    hide-details
                    inset
                  /> -->
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
                :items="attendanceRows"
                :items-per-page="15"
                density="compact"
                class="rounded-lg"
              >
                <template #item.total_rendered_hours="{ item }">
                  {{ item.total_rendered_hours }}h
                </template>
                <template #item.total_late_minutes="{ item }">
                  <VChip
                    v-if="item.total_late_minutes > 0"
                    color="warning"
                    size="x-small"
                    variant="tonal"
                    label
                  >
                    {{ fmtHours(item.total_late_minutes) }}
                  </VChip>
                  <span v-else class="text-medium-emphasis">—</span>
                </template>
                <template #item.total_undertime_minutes="{ item }">
                  <VChip
                    v-if="item.total_undertime_minutes > 0"
                    color="info"
                    size="x-small"
                    variant="tonal"
                    label
                  >
                    {{ fmtHours(item.total_undertime_minutes) }}
                  </VChip>
                  <span v-else class="text-medium-emphasis">—</span>
                </template>
                <template #item.total_absent_days="{ item }">
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
