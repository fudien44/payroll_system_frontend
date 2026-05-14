<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import axios from '@axios'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface DeviceStatus {
  floor:   string
  ip:      string
  port:    number
  status:  'connected' | 'disconnected' | 'error'
  message: string
}

interface Employee {
  id:          number
  full_name:   string
  position:    string | null
  division:    string | null
  section:     string | null
  emp_type:    string | null
  emp_status:  number | null
  profile_pic: string | null
}

interface AttendanceDay {
  date:                    number
  id_in_am:                string | number
  in_am:                   string
  id_out_am:               string | number
  out_am:                  string
  id_in_pm:                string | number
  in_pm:                   string
  id_out_pm:               string | number
  out_pm:                  string
  total_hours:             number
  is_late_am:              boolean
  late_minutes_am:         number
  is_late_pm:              boolean
  late_minutes_pm:         number
  total_late_minutes:      number
  is_absent:               boolean
  entry_count:             number
  is_half_day_absent:      boolean
  undertime_minutes_am:    number
  undertime_minutes_pm:    number
  total_undertime_minutes: number
}

interface DtrData {
  attendance:              Record<string, AttendanceDay>
  total_rendered_hours:    number
  total_late_minutes:      number
  total_late_hours:        number
  total_absent_days:       number
  total_undertime_minutes: number
  total_undertime_hours:   number
  regdays:                 number
  sat:                     number
  name:                    string | null
  monthno:                 number
  month:                   string
  year:                    number
}

// Enriched row with computed calendar fields
interface AttendanceRow extends AttendanceDay {
  day:        number
  dayName:    string
  isWeekend:  boolean
  isSaturday: boolean
  isSunday:   boolean
}

type AlertType = 'success' | 'error' | 'warning' | 'info'

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TABLE_HEADERS = [
  { title: 'Employee', key: 'full_name', sortable: true                          },
  { title: 'Position', key: 'position',  sortable: true                          },
  { title: 'Division', key: 'division',  sortable: true                          },
  { title: 'Section',  key: 'section',   sortable: true                          },
  { title: 'Actions',  key: 'actions',   sortable: false, align: 'center' as const },
]

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

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const employees    = ref<Employee[]>([])
const deviceStatus = ref<DeviceStatus[]>([])
const loading      = ref(false)

// ── DTR Modal ─────────────────────────────
const modalOpen     = ref(false)
const modalLoading  = ref(false)
const selectedEmp   = ref<Employee | null>(null)
const selectedMonth = ref<number>(new Date().getMonth() + 1)
const selectedYear  = ref<number>(currentYear)
const dtrData       = ref<DtrData | null>(null)

const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const connectedDevices    = computed(() => deviceStatus.value.filter(d => d.status === 'connected').length)
const disconnectedDevices = computed(() => deviceStatus.value.filter(d => d.status !== 'connected').length)

// ── Modal adapts its width and title based on whether DTR is loaded ──
const modalWidth = computed(() => dtrData.value ? '1150' : '520')

const modalTitle = computed(() => {
  if (!selectedEmp.value) return 'DTR'
  if (!dtrData.value)     return `DTR — ${selectedEmp.value.full_name}`
  return `DTR — ${selectedEmp.value.full_name} — ${dtrData.value.month} ${dtrData.value.year}`
})

// ── Convert attendance object { "1": {...}, "2": {...} } → sorted array ──
const attendanceRows = computed<AttendanceRow[]>(() => {
  if (!dtrData.value) return []

  return Object.entries(dtrData.value.attendance)
    .map(([dayStr, data]) => {
      const day       = Number(dayStr)
      const date      = new Date(dtrData.value!.year, dtrData.value!.monthno - 1, day)
      const dayOfWeek = date.getDay() // 0 = Sun, 6 = Sat

      return {
        ...data,
        day,
        dayName:    DAY_NAMES[dayOfWeek],
        isWeekend:  dayOfWeek === 0 || dayOfWeek === 6,
        isSaturday: dayOfWeek === 6,
        isSunday:   dayOfWeek === 0,
      }
    })
    .sort((a, b) => a.day - b.day)
})

const deviceChipColor = (status: DeviceStatus['status']) => ({
  connected:    'success',
  disconnected: 'warning',
  error:        'error',
}[status])

const deviceChipIcon = (status: DeviceStatus['status']) => ({
  connected:    'mdi-check-circle-outline',
  disconnected: 'mdi-alert-circle-outline',
  error:        'mdi-close-circle-outline',
}[status])

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}

// "90" → "1h 30m" | "45" → "45m" | "0" → "—"
function fmtMinutes(mins: number): string {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Determines row highlight class for each attendance day
function getRowClass(row: AttendanceRow): string {
  if (row.isSunday)           return 'dtr-row--sunday'
  if (row.isSaturday)         return 'dtr-row--saturday'
  if (row.is_absent)          return 'dtr-row--absent'
  if (row.is_half_day_absent) return 'dtr-row--halfday'
  if (row.is_late_am || row.is_late_pm) return 'dtr-row--late'
  if (row.total_undertime_minutes > 0)  return 'dtr-row--undertime'
  if (row.entry_count > 0)    return 'dtr-row--present'
  return ''
}

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */
async function fetchData() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/dtr')
    employees.value    = data.data.employees     ?? []
    deviceStatus.value = data.data.device_status ?? []
  } catch {
    showAlert('error', 'Failed to load DTR data.')
  } finally {
    loading.value = false
  }
}

async function fetchDtr() {
  if (!selectedEmp.value) return
  modalLoading.value = true
  dtrData.value      = null // clear previous result while loading

  try {
    const { data } = await axios.get(
      `/api/dtr/${selectedEmp.value.id}/${selectedMonth.value}/${selectedYear.value}`
    )
    dtrData.value = data
  } catch {
    showAlert('error', 'Failed to load DTR records.')
  } finally {
    modalLoading.value = false
  }
}

/* ─────────────────────────────────────────
   HANDLERS
───────────────────────────────────────── */
function openDtrModal(item: Employee) {
  selectedEmp.value   = item
  selectedMonth.value = new Date().getMonth() + 1
  selectedYear.value  = currentYear
  dtrData.value       = null
  modalOpen.value     = true
}

function closeModal() {
  modalOpen.value = false
  dtrData.value   = null
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(fetchData)
</script>

<template>
  <div>
    <VContainer fluid class="pa-6">

      <!-- ── Page Header ── -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-2">
        <div>
          <h4 class="text-h5 font-weight-bold mb-1">Daily Time Record</h4>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Monitor biometric device status and view employees with DTR access.
          </p>
        </div>
        <VBtn variant="tonal" prepend-icon="mdi-refresh" :loading="loading" @click="fetchData">
          Refresh
        </VBtn>
      </div>

      <!-- ── Summary Cards ── -->
      <VRow class="mb-6 mt-2">
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="primary" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-account-group-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ employees.length }}</div>
                <div class="text-body-2">Total Employees</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="success" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-lan-check" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ connectedDevices }}</div>
                <div class="text-body-2">Devices Online</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="warning" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-lan-disconnect" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ disconnectedDevices }}</div>
                <div class="text-body-2">Devices Offline</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- ── Device Status ── -->
      <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
        Biometric Devices
      </p>
      <VRow class="mb-6" dense>
        <VCol v-for="device in deviceStatus" :key="device.ip" cols="12" sm="6" lg="3">
          <VCard variant="outlined" rounded="lg">
            <VCardText class="d-flex align-center justify-space-between pa-4">
              <div>
                <div class="text-body-1 font-weight-medium">{{ device.floor }}</div>
                <!-- <div class="text-caption text-medium-emphasis">{{ device.ip }}:{{ device.port }}</div> -->
                <div class="text-caption mt-1">{{ device.message }}</div>
              </div>
              <VChip :color="deviceChipColor(device.status)" size="small" variant="tonal" label>
                <VIcon start :icon="deviceChipIcon(device.status)" size="14" />
                {{ device.status }}
              </VChip>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- ── Employee Table ── -->
      <BaseTable
        title="JO Employees DTR"
        :headers="TABLE_HEADERS"
        :items="employees"
        :loading="loading"
        :items-per-page="10"
        searchable
      >
        <template #item.full_name="{ item }">
          <div class="d-flex align-center gap-3 py-1">
            <VAvatar size="32" :image="item.profile_pic ?? undefined" :color="item.profile_pic ? undefined : 'primary'">
              <span v-if="!item.profile_pic" class="text-caption font-weight-bold">
                {{ item.full_name.charAt(0) }}{{ item.full_name.split(', ')[1]?.charAt(0) ?? '' }}
              </span>
            </VAvatar>
            <span>{{ item.full_name }}</span>
          </div>
        </template>
        <template #item.position="{ item }">
          <span :class="{ 'text-medium-emphasis': !item.position }">{{ item.position ?? '—' }}</span>
        </template>
        <template #item.division="{ item }">
          <span :class="{ 'text-medium-emphasis': !item.division }">{{ item.division ?? '—' }}</span>
        </template>
        <template #item.section="{ item }">
          <span :class="{ 'text-medium-emphasis': !item.section }">{{ item.section ?? '—' }}</span>
        </template>
        <template #item.actions="{ item }">
          <VBtn size="small" variant="tonal" color="primary" prepend-icon="mdi-calendar-clock" @click="openDtrModal(item)">
            View DTR
          </VBtn>
        </template>
      </BaseTable>

    </VContainer>

    <!-- ── DTR Modal ── -->
    <BaseModal
      v-model="modalOpen"
      :title="modalTitle"
      :width="modalWidth"
      :loading="modalLoading"
      :confirm-text="dtrData ? 'Reload' : 'View DTR'"
      cancel-text="Close"
      @confirm="fetchDtr"
      @cancel="closeModal"
    >
      <VRow dense>

        <!-- ── Employee info strip ── -->
        <VCol cols="12">
          <VCard variant="tonal" color="default" rounded="lg">
            <VCardText class="d-flex flex-wrap gap-6 py-3">
              <div>
                <div class="text-caption text-medium-emphasis">Position</div>
                <div class="text-body-2 font-weight-medium">{{ selectedEmp?.position ?? '—' }}</div>
              </div>
              <div>
                <div class="text-caption text-medium-emphasis">Division</div>
                <div class="text-body-2 font-weight-medium">{{ selectedEmp?.division ?? '—' }}</div>
              </div>
              <div>
                <div class="text-caption text-medium-emphasis">Section</div>
                <div class="text-body-2 font-weight-medium">{{ selectedEmp?.section ?? '—' }}</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <!-- ── Period selectors (always visible so user can change and reload) ── -->
        <VCol cols="12" class="mt-3">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
            Select Period
          </p>
          <VDivider class="mt-1 mb-3" />
        </VCol>
        <VCol cols="12" sm="8">
          <VSelect
            v-model="selectedMonth"
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
        <VCol cols="12" sm="4">
          <VSelect
            v-model="selectedYear"
            label="Year"
            :items="YEAR_ITEMS"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-calendar-outline"
            hide-details
          />
        </VCol>

        <!-- ── DTR results (only rendered after fetchDtr succeeds) ── -->
        <template v-if="dtrData">

          <!-- ── Computation Summary ── -->
          <VCol cols="12" class="mt-4">
            <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
              Monthly Summary — {{ dtrData.month }} {{ dtrData.year }}
            </p>
            <VDivider class="mt-1 mb-3" />
          </VCol>

          <VCol cols="6" sm="3">
            <VCard variant="tonal" color="primary" rounded="lg">
              <VCardText class="pa-3 text-center">
                <div class="text-h6 font-weight-bold">{{ dtrData.total_rendered_hours }}h</div>
                <div class="text-caption">Hours Rendered</div>
              </VCardText>
            </VCard>
          </VCol>
          <VCol cols="6" sm="3">
            <VCard variant="tonal" color="error" rounded="lg">
              <VCardText class="pa-3 text-center">
                <div class="text-h6 font-weight-bold">{{ dtrData.total_absent_days }}</div>
                <div class="text-caption">Absent Days</div>
              </VCardText>
            </VCard>
          </VCol>
          <VCol cols="6" sm="3">
            <VCard variant="tonal" color="warning" rounded="lg">
              <VCardText class="pa-3 text-center">
                <div class="text-h6 font-weight-bold">{{ fmtMinutes(dtrData.total_late_minutes) }}</div>
                <div class="text-caption">Total Late</div>
              </VCardText>
            </VCard>
          </VCol>
          <VCol cols="6" sm="3">
            <VCard variant="tonal" color="info" rounded="lg">
              <VCardText class="pa-3 text-center">
                <div class="text-h6 font-weight-bold">{{ fmtMinutes(dtrData.total_undertime_minutes) }}</div>
                <div class="text-caption">Total Undertime</div>
              </VCardText>
            </VCard>
          </VCol>

          <!-- ── Working days breakdown ── -->
          <VCol cols="12">
            <div class="d-flex gap-4 flex-wrap">
              <div class="text-caption text-medium-emphasis">
                Regular Days: <strong class="text-high-emphasis">{{ dtrData.regdays }}</strong>
              </div>
              <div class="text-caption text-medium-emphasis">
                Saturdays: <strong class="text-high-emphasis">{{ dtrData.sat }}</strong>
              </div>
              <div class="text-caption text-medium-emphasis">
                Late Hours: <strong class="text-warning">{{ dtrData.total_late_hours }}h</strong>
              </div>
              <div class="text-caption text-medium-emphasis">
                Undertime Hours: <strong class="text-info">{{ dtrData.total_undertime_hours }}h</strong>
              </div>
            </div>
          </VCol>

          <!-- ── Attendance Table ── -->
          <VCol cols="12" class="mt-2">
            <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
              Attendance Record
            </p>
            <VDivider class="mt-1 mb-2" />

            <!-- Legend -->
            <div class="d-flex flex-wrap gap-3 mb-3">
              <div class="d-flex align-center gap-1">
                <div class="dtr-legend dtr-legend--absent" />
                <span class="text-caption">Absent</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div class="dtr-legend dtr-legend--halfday" />
                <span class="text-caption">Half Day</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div class="dtr-legend dtr-legend--late" />
                <span class="text-caption">Late</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div class="dtr-legend dtr-legend--undertime" />
                <span class="text-caption">Undertime</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div class="dtr-legend dtr-legend--weekend" />
                <span class="text-caption">Weekend</span>
              </div>
            </div>

            <!-- Scrollable table wrapper -->
            <div class="dtr-table-wrapper">
              <table class="dtr-table">
                <thead>
                  <tr>
                    <th class="col-day">Day</th>
                    <th class="col-time">In AM</th>
                    <th class="col-time">Out AM</th>
                    <th class="col-time">In PM</th>
                    <th class="col-time">Out PM</th>
                    <th class="col-hours">Hours</th>
                    <th class="col-status">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in attendanceRows"
                    :key="row.day"
                    :class="getRowClass(row)"
                  >
                    <!-- Day + weekday name -->
                    <td class="col-day">
                      <span class="font-weight-medium">{{ row.day }}</span>
                      <span class="text-caption text-medium-emphasis ms-1">{{ row.dayName }}</span>
                    </td>

                    <!-- Time columns — blank for weekends -->
                    <template v-if="row.isSunday">
                      <td colspan="5" class="text-center text-caption text-disabled">Sunday</td>
                    </template>
                    <template v-else-if="row.isSaturday">
                      <td class="col-time text-caption">{{ row.in_am  || '—' }}</td>
                      <td class="col-time text-caption">{{ row.out_am || '—' }}</td>
                      <td class="col-time text-caption">{{ row.in_pm  || '—' }}</td>
                      <td class="col-time text-caption">{{ row.out_pm || '—' }}</td>
                      <td class="col-hours text-caption">{{ row.total_hours || '—' }}</td>
                      <td class="col-status">
                        <VChip v-if="row.entry_count > 0" color="secondary" size="x-small" variant="tonal" label>
                          Saturday
                        </VChip>
                      </td>
                    </template>
                    <template v-else>
                      <td class="col-time text-caption" :class="{ 'text-warning': row.is_late_am }">
                        {{ row.in_am  || '—' }}
                      </td>
                      <td class="col-time text-caption">{{ row.out_am || '—' }}</td>
                      <td class="col-time text-caption" :class="{ 'text-warning': row.is_late_pm }">
                        {{ row.in_pm  || '—' }}
                      </td>
                      <td class="col-time text-caption">{{ row.out_pm || '—' }}</td>
                      <td class="col-hours text-caption font-weight-medium">
                        {{ row.total_hours ? `${row.total_hours}h` : '—' }}
                      </td>

                      <!-- Status chips -->
                      <td class="col-status">
                        <div class="d-flex flex-wrap gap-1">
                          <VChip v-if="row.is_absent" color="error" size="x-small" variant="tonal" label>
                            Absent
                          </VChip>
                          <VChip v-if="row.is_half_day_absent" color="warning" size="x-small" variant="tonal" label>
                            ½ Day
                          </VChip>
                          <VChip
                            v-if="row.total_late_minutes > 0"
                            color="warning"
                            size="x-small"
                            variant="tonal"
                            label
                          >
                            Late {{ fmtMinutes(row.total_late_minutes) }}
                          </VChip>
                          <VChip
                            v-if="row.total_undertime_minutes > 0"
                            color="info"
                            size="x-small"
                            variant="tonal"
                            label
                          >
                            UT {{ fmtMinutes(row.total_undertime_minutes) }}
                          </VChip>
                          <VChip
                            v-if="!row.is_absent && !row.is_half_day_absent && row.entry_count >= 4"
                            color="success"
                            size="x-small"
                            variant="tonal"
                            label
                          >
                            Present
                          </VChip>
                        </div>
                      </td>
                    </template>
                  </tr>
                </tbody>
              </table>
            </div>
          </VCol>

        </template>
        <!-- ── End DTR results ── -->

      </VRow>
    </BaseModal>

    <!-- ── Alert ── -->
    <BaseAlert
      v-model="alertVisible"
      :message="alertMessage"
      :type="alertType"
      :timeout="3500"
    />
  </div>
</template>

<style scoped>
/* ── DTR Table ─────────────────────────────────── */
.dtr-table-wrapper {
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}

.dtr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.dtr-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgb(var(--v-theme-surface));
}

.dtr-table th {
  padding: 8px 12px;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--v-theme-on-surface), 0.6);
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  white-space: nowrap;
}

.dtr-table td {
  padding: 7px 12px;
  border-bottom: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.5));
  white-space: nowrap;
}

.dtr-table tbody tr:last-child td {
  border-bottom: none;
}

/* Column widths */
.col-day    { width: 80px;  }
.col-time   { width: 90px;  }
.col-hours  { width: 70px;  }
.col-status { width: 200px; }

/* ── Row highlight states ───────────────────────── */
.dtr-row--sunday    { background: rgba(var(--v-theme-on-surface), 0.035); color: rgba(var(--v-theme-on-surface), 0.38); }
.dtr-row--saturday  { background: rgba(var(--v-theme-on-surface), 0.02); }
.dtr-row--absent    { background: rgba(var(--v-theme-error),   0.08); }
.dtr-row--halfday   { background: rgba(var(--v-theme-warning), 0.08); }
.dtr-row--late      { background: rgba(var(--v-theme-warning), 0.04); }
.dtr-row--undertime { background: rgba(var(--v-theme-info),    0.06); }
.dtr-row--present   {}

/* ── Legend dots ────────────────────────────────── */
.dtr-legend {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.dtr-legend--absent    { background: rgba(var(--v-theme-error),         0.5); }
.dtr-legend--halfday   { background: rgba(var(--v-theme-warning),       0.5); }
.dtr-legend--late      { background: rgba(var(--v-theme-warning),       0.3); }
.dtr-legend--undertime { background: rgba(var(--v-theme-info),          0.4); }
.dtr-legend--weekend   { background: rgba(var(--v-theme-on-surface),    0.15); }
</style>
