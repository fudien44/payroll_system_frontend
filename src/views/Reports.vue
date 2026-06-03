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
const selectAll = ref(true)

function toggleSelectAll() {
  if (selectAll.value) {
    selectedEmpIds.value = []
    selectAll.value      = false
  } else {
    selectedEmpIds.value = payslipEmployees.value.map(e => e.emp_id)
    selectAll.value      = true
  }
}

// Keep selectAll in sync when individual checkboxes are toggled
watch(selectedEmpIds, (val) => {
  selectAll.value = val.length === payslipEmployees.value.length
})

const payslipMonthLabel = computed(() => {
  const m = MONTH_ITEMS.find(x => x.value === payslipMonth.value)
  return `${m?.title ?? ''} ${payslipYear.value}`
})

const employeesWithDtr = computed(() =>
  payslipEmployees.value.filter(e => e.has_dtr)
)

const employeesWithoutDtr = computed(() =>
  payslipEmployees.value.filter(e => !e.has_dtr)
)

// Send only selected IDs; empty array means nothing selected (not "all")
const resolvedEmpIds = computed(() => selectedEmpIds.value)

async function fetchPayslipEmployees() {
  loadingEmployees.value = true
  payslipEmployees.value = []
  try {
    const { data } = await axios.get('/api/reports/payslip', {
      params: { month: payslipMonth.value, year: payslipYear.value },
    })
    payslipEmployees.value = data.data
    selectedEmpIds.value   = data.data.map((e: EmployeeOption) => e.emp_id)
  } catch {
    showAlert('error', 'Failed to load employee list.')
  } finally {
    loadingEmployees.value = false
  }
}

async function generatePdf() {
  generatingPdf.value = true
  try {
    const resp = await axios.post('/api/reports/payslip/generate', {
      month:        payslipMonth.value,
      year:         payslipYear.value,
      employee_ids: selectAll.value ? null : resolvedEmpIds.value,
    }, { responseType: 'blob' })

    downloadBlob(resp.data, `Payslip_${payslipMonthLabel.value.replace(' ', '_')}.pdf`, 'application/pdf')
    showAlert('success', 'Payslip PDF generated successfully.')
  } catch (err: any) {
    const msg = await blobErrorMessage(err)
    showAlert('error', msg ?? 'Failed to generate PDF.')
  } finally {
    generatingPdf.value = false
  }
}

async function exportPayslipExcel() {
  exportingPayslip.value = true
  try {
    const resp = await axios.post('/api/reports/payslip/export', {
      month:        payslipMonth.value,
      year:         payslipYear.value,
      employee_ids: selectAll.value ? null : resolvedEmpIds.value,
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
const loadingAttendance   = ref(false)
const exportingAttendance = ref(false)
const selectedAttEmpIds   = ref<number[]>([])
const selectAllAtt        = ref(true)

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
      params: { month: attendanceMonth.value, year: attendanceYear.value },
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
          <VCard variant="outlined" rounded="lg">
            <VCardText>
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
                Select Period
              </p>
              <VRow dense align="center">
                <VCol cols="12" sm="4" md="3">
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
                <VCol cols="12" sm="3" md="2">
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
                <VCol cols="12" sm="5" md="3">
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
          <VCard variant="outlined" rounded="lg">
            <VCardText>
              <!-- ── Header row: title + chips + select all toggle ── -->
              <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-3">
                <div>
                  <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
                    Employees — {{ payslipMonthLabel }}
                  </p>
                  <p class="text-caption text-medium-emphasis mt-1">
                    <VChip color="success" size="x-small" variant="tonal" label class="me-1">
                      {{ employeesWithDtr.length }} with DTR
                    </VChip>
                    <VChip v-if="employeesWithoutDtr.length" color="warning" size="x-small" variant="tonal" label class="me-1">
                      {{ employeesWithoutDtr.length }} missing DTR
                    </VChip>
                    <VChip color="primary" size="x-small" variant="tonal" label>
                      {{ selectedEmpIds.length }} selected
                    </VChip>
                  </p>
                </div>
                <VBtn
                  :color="selectAll ? 'primary' : 'default'"
                  :variant="selectAll ? 'tonal' : 'outlined'"
                  size="small"
                  prepend-icon="mdi-check-all"
                  @click="toggleSelectAll"
                >
                  {{ selectAll ? 'Clear' : 'Select All' }}
                </VBtn>
              </div>

              <!-- ── Always-visible employee list ── -->
              <VDivider class="mb-3" />
              <VRow dense>
                <VCol
                  v-for="emp in payslipEmployees"
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

              <!-- ── Action buttons ── -->
              <VDivider class="my-4" />
              <div class="d-flex gap-3 flex-wrap">
                <VBtn
                  color="error"
                  variant="tonal"
                  prepend-icon="mdi-file-pdf-box"
                  :loading="generatingPdf"
                  :disabled="exportingPayslip || loadingEmployees"
                  @click="generatePdf"
                >
                  Generate PDF
                </VBtn>
                <VBtn
                  color="success"
                  variant="tonal"
                  prepend-icon="mdi-microsoft-excel"
                  :loading="exportingPayslip"
                  :disabled="generatingPdf || loadingEmployees"
                  @click="exportPayslipExcel"
                >
                  Export Excel
                </VBtn>
              </div>

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
          <VCard variant="outlined" rounded="lg">
            <VCardText>
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
                Select Period
              </p>
              <VRow dense align="center">
                <VCol cols="12" sm="4" md="3">
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
                <VCol cols="12" sm="3" md="2">
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
                <VCol cols="12" sm="5" md="3">
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
          <VCard variant="outlined" rounded="lg">
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
                  <VSwitch
                    v-model="selectAllAtt"
                    label="All"
                    color="primary"
                    density="compact"
                    hide-details
                    inset
                  />
                  <VBtn
                    color="success"
                    variant="tonal"
                    prepend-icon="mdi-microsoft-excel"
                    :loading="exportingAttendance"
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
