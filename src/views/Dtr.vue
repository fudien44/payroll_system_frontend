<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import SetFlexiModal from '@/components/dtr/SetFlexiModal.vue'
import realtime from '@/plugins/realtime'
import { useUserStore } from '@/stores/user'
import axios from '@axios'
import { onUnmounted } from 'vue'
import { useTheme } from 'vuetify'

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
  is_flexi:    boolean
}

interface AttendanceDay {
  date:                    number
  full_date:               string
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
  is_absent_penalty:       boolean
  is_absent:               boolean
  entry_count:             number
  is_half_day_absent:      boolean
  undertime_minutes_am:    number
  undertime_minutes_pm:    number
  total_undertime_minutes: number
  // Calendar flags
  is_holiday:              boolean
  holiday_type:            'regular' | 'special' | null
  holiday_label:           string | null
  is_suspension:           boolean
  suspension_label:        string | null
  // Schedule fields returned by the backend
  is_rest_day:             boolean
  schedule_type:           'compressed' | 'standard' | null
  am_official_time:        string | null
  pm_official_time:        string | null
  has_pass_slip:           boolean
  pass_slips:              PassSlipEntry[]
}

interface PassSlipEntry {
  id:                 number
  request_time_out:   string
  actual_time:         string | null
  estimated_arrival:   string | null
  reason:              string | null
  label:               string
  nature_business:     string | null
  minutes:             number
}

interface WeeklyAttendanceDay {
  date:           string
  schedule_type:  'compressed' | 'standard'
  required_hours: number
  rendered_hours: number
  credited_hours: number
  is_complete:    boolean
}

interface WeeklyAttendance {
  week:                   number
  week_start:             string
  week_end:               string
  schedule_type:          'compressed' | 'standard'
  required_weekly_hours:  number
  rendered_weekly_hours:  number
  is_complete_week:       boolean
  days:                   WeeklyAttendanceDay[]
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
  weekends:                number
  total_holidays:          number
  total_suspensions:       number
  monthno:                 number
  month:                   string
  year:                    number
  period_start:            string
  period_end:              string
  period_type:              'full_month' | 'dec_first_half' | 'dec_second_half_merged'
  period_label:            string
  carried_over_absent_days:         number
  carried_over_late_minutes:        number
  carried_over_undertime_minutes:   number
  current_period_absent_days:       number
  current_period_late_minutes:      number
  current_period_undertime_minutes: number
  weekly_attendance:       WeeklyAttendance[]
}

// Enriched row with display-only computed fields
interface AttendanceRow extends AttendanceDay {
  day:          number
  fullDate:     string
  monthShort:   string
  dayName:      string
  isWeekend:    boolean
  isSaturday:   boolean
  isSunday:     boolean
  isFriday:     boolean
}

// Calendar-only preview shown in the Save DTR confirmation dialog
interface PeriodSummary {
  regdays:           number
  total_holidays:    number
  total_suspensions: number
  already_saved:     boolean
}

type AlertType = 'success' | 'error' | 'warning' | 'info'

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const TABLE_HEADERS = [
  { title: 'Employee', key: 'full_name', sortable: true                            },
  { title: 'Position', key: 'position',  sortable: true                            },
  { title: 'Division', key: 'division',  sortable: true                            },
  { title: 'Section',  key: 'section',   sortable: true                            },
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

const modalOpen     = ref(false)
const modalLoading  = ref(false)
const selectedEmp   = ref<Employee | null>(null)
const selectedMonth = ref<number>(new Date().getMonth() + 1)
const selectedYear  = ref<number>(currentYear)
const dtrData       = ref<DtrData | null>(null)

// ── Save DTR state ──────────────────────────────────────────────────
const savingDtr        = ref(false)
const confirmSaveOpen  = ref(false)
const confirmOverrideOpen = ref(false)
const savingElapsedSecs = ref(0)
let   savingTimer: ReturnType<typeof setInterval> | null = null

// ── Set Flexi state ─────────────────────────────────────────────────
const flexiModalOpen   = ref(false)

function handleFlexiSaved(updated: Employee[], message: string, isError = false) {
  employees.value = updated
  alertType.value = isError ? 'error' : 'success'
  alertMessage.value = message
  alertVisible.value = true
}

// ── Save DTR progress (live via Reverb broadcast) ────────────────────
const saveProgressDone  = ref(0)
const saveProgressTotal = ref(0)

// ── Timeout fallback - Reverb can silently die ────────────────────
const STALE_TIMEOUT_MS    = 30_000       // 30s of silence = assume stalled
const HARD_CAP_TIMEOUT_MS = 5 * 60_000  // 5 min absolute ceiling
let staleTimer: ReturnType<typeof setTimeout> | null = null
let hardCapTimer: ReturnType<typeof setTimeout> | null = null
const savingTimedOut = ref(false)

function clearSavingTimers() {
  if (staleTimer)   clearTimeout(staleTimer)
  if (hardCapTimer) clearTimeout(hardCapTimer)
  staleTimer = null
  hardCapTimer = null
}

function armStaleTimer() {
  if (staleTimer) clearTimeout(staleTimer)
  staleTimer = setTimeout(() => {
    savingTimedOut.value = true
    showAlert(
      'warning',
      'Lost contact with the DTR job — it may still be running in the background. ' +
      'Refresh in a bit to confirm, or try again.',
    )
    finishSavingDtr()
  }, STALE_TIMEOUT_MS)
}

// Period selector inside Save DTR dialog — defaults to preceding month
function getDefaultSaveDtrPeriod() {
  const now = new Date()
  return {
    month: now.getMonth() === 0 ? 12 : now.getMonth(),
    year:  now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
  }
}

const defaultSaveDtrPeriod = getDefaultSaveDtrPeriod()
const saveDtrMonth = ref<number>(defaultSaveDtrPeriod.month)
const saveDtrYear  = ref<number>(defaultSaveDtrPeriod.year)

// ── Period calendar preview (working days / holidays / suspensions) ──
const periodSummary        = ref<PeriodSummary | null>(null)
const periodSummaryLoading = ref(false)

// Fetch the working days / holidays / suspensions preview whenever the
// Save DTR dialog is opened, and again whenever the month/year selectors
// inside the dialog change while it's open.
watch(confirmSaveOpen, (open) => {
  if (open) fetchPeriodSummary()
})

watch([saveDtrMonth, saveDtrYear], () => {
  if (confirmSaveOpen.value) fetchPeriodSummary()
})

const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')
const userStore    = useUserStore()
const realtimeConnectionError = ref(false)

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const connectedDevices    = computed(() => deviceStatus.value.filter(d => d.status === 'connected').length)
const disconnectedDevices = computed(() => deviceStatus.value.filter(d => d.status !== 'connected').length)

const modalWidth = computed(() => dtrData.value ? '1150' : '520')

const modalTitle = computed(() => {
  if (!selectedEmp.value) return 'DTR'
  if (!dtrData.value)     return `DTR — ${selectedEmp.value.full_name}`
  return `DTR — ${selectedEmp.value.full_name} — ${dtrData.value.period_label}`
})

const isMonthComplete = computed(() => {
  const lastDay = new Date(saveDtrYear.value, saveDtrMonth.value, 0) // day 0 = last day of prev month
  const today   = new Date()
  today.setHours(0, 0, 0, 0)
  return lastDay < today
})

const canSaveDtr = computed(() => !savingDtr.value && isMonthComplete.value)

const saveDtrLabel = computed(() => {
  const m = MONTH_ITEMS.find(x => x.value === saveDtrMonth.value)
  return `${m?.title ?? ''} ${saveDtrYear.value}`
})

const savingElapsedLabel = computed(() => {
  const s = savingElapsedSecs.value
  if (s < 60) return `${s}s elapsed`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r}s elapsed`
})

const saveProgressLabel = computed(() => {
  if (saveProgressTotal.value === 0) return 'Saving...'
  return `Saving DTR ${saveProgressDone.value} out of ${saveProgressTotal.value}`
})

const saveProgressPercent = computed(() => {
  if (saveProgressTotal.value === 0) return 0
  return Math.round((saveProgressDone.value / saveProgressTotal.value) * 100)
})

const attendanceRows = computed<AttendanceRow[]>(() => {
  if (!dtrData.value) return []

  return Object.entries(dtrData.value.attendance)
    .map(([dateKey, data]) => {
      // dateKey is an ISO date string (e.g. "2026-12-20"), not a bare day
      // number — the backend keys attendance this way so a period spanning
      // two months/years (the December merged period) can't collide two
      // different days that happen to share the same day-of-month.
      const [y, m, d] = dateKey.split('-').map(Number)
      const date      = new Date(y, m - 1, d)
      const dayOfWeek = date.getDay()

      return {
        ...data,
        day:        data.date,   // day-of-month, for display
        fullDate:   dateKey,     // real date — sort key / row key / grouping
        monthShort: MONTH_SHORT_NAMES[m - 1],
        dayName:    DAY_NAMES[dayOfWeek],
        isWeekend:  dayOfWeek === 0 || dayOfWeek === 6,
        isSaturday: dayOfWeek === 6,
        isSunday:   dayOfWeek === 0,
        isFriday:   dayOfWeek === 5,
      }
    })
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate)) // ISO format sorts chronologically as a plain string
})

const deviceChipColor = (status: DeviceStatus['status']) => ({
  connected:    'success',
  disconnected: 'warning',
  error:        'error',
}[status] ?? 'default')

const deviceChipIcon = (status: DeviceStatus['status']) => ({
  connected:    'mdi-check-circle-outline',
  disconnected: 'mdi-alert-circle-outline',
  error:        'mdi-close-circle-outline',
}[status] ?? 'mdi-help-circle-outline')

const theme = useTheme()

const chipColor = computed(() =>
  theme.global.current.value.dark ? 'cyan-accent-2' : 'cyan-darken-3'
)

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}

const AVATAR_COLORS = ['primary', 'teal', 'orange', 'purple', 'pink', 'indigo'] as const

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function initials(fullName: string): string {
  const [surname, rest] = fullName.split(', ')
  const first = rest?.trim().charAt(0) ?? ''
  return `${surname?.charAt(0) ?? ''}${first}`.toUpperCase()
}

function getRowClass(row: AttendanceRow): string {
  if (row.is_holiday)                   return 'dtr-row--holiday'
  if (row.is_suspension)                return 'dtr-row--suspension'
  if (row.is_rest_day)                  return 'dtr-row--fri-cmp'
  if (row.isSunday)                     return 'dtr-row--sunday'
  if (row.isSaturday)                   return 'dtr-row--saturday'
  if (row.is_absent)                    return 'dtr-row--absent'
  if (row.is_half_day_absent)           return 'dtr-row--halfday'
  if (row.is_late_am || row.is_late_pm) return 'dtr-row--late'
  if (row.total_undertime_minutes > 0)  return 'dtr-row--undertime'
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

    // Re-sync the Save DTR period in case the dialog's selectors were
    // changed to a future/incomplete month and left that way
    const defaultPeriod = getDefaultSaveDtrPeriod()
    saveDtrMonth.value = defaultPeriod.month
    saveDtrYear.value  = defaultPeriod.year
  } catch {
    showAlert('error', 'Failed to load DTR data.')
  } finally {
    loading.value = false
  }
}

async function fetchDtr() {
  if (!selectedEmp.value) return
  modalLoading.value = true
  dtrData.value      = null

  try {
    const { data } = await axios.get(
      `/api/dtr/${selectedEmp.value.id}/${selectedMonth.value}/${selectedYear.value}`,
    )
    dtrData.value = data
  } catch {
    showAlert('error', 'Failed to load DTR records.')
  } finally {
    modalLoading.value = false
  }
}

async function fetchPeriodSummary() {
  periodSummaryLoading.value = true
  periodSummary.value        = null

  try {
    const { data } = await axios.get(
      `/api/dtr/period-summary/${saveDtrMonth.value}/${saveDtrYear.value}`,
    )
    periodSummary.value = {
      ...data.data,
      already_saved: data.already_saved,
    }
  } catch {
    // Non-critical preview — fail silently, dialog still works without it
    periodSummary.value = null
  } finally {
    periodSummaryLoading.value = false
  }
}

// ── Save DTR for all JO employees (preceding month) ────────────────
function finishSavingDtr() {
  clearSavingTimers()
  if (savingTimer) clearInterval(savingTimer)
  savingTimer              = null
  savingDtr.value          = false
  confirmSaveOpen.value    = false
  savingElapsedSecs.value  = 0
  saveProgressDone.value   = 0
  saveProgressTotal.value  = 0
  periodSummary.value      = null
}

// Shared by saveDtr() and overrideDtr() — both queue a job for the same
// month/year payload and drive the same progress UI; only the target
// endpoint and the 422 fallback message differ.
async function runDtrJob(endpoint: string, incompleteMonthMessage: string) {
  if (savingDtr.value) return
  savingDtr.value         = true
  savingTimedOut.value    = false
  savingElapsedSecs.value = 0
  savingTimer = setInterval(() => { savingElapsedSecs.value++ }, 1000)

  saveProgressDone.value  = 0
  saveProgressTotal.value = 0
  
  armStaleTimer()
  hardCapTimer = setTimeout(() => {
    savingTimedOut.value = true
    showAlert(
      'warning',
      'DTR job is taking much longer than expected. It may still finish in the ' +
      'background — check back shortly.',
    )
    finishSavingDtr()
  }, HARD_CAP_TIMEOUT_MS)

  try {
    await axios.post(endpoint, {
      month: saveDtrMonth.value,
      year:  saveDtrYear.value,
    })
  } catch (err: any) {
    const status  = err?.response?.status
    const message = err?.response?.data?.message

    if (status === 409) {
      showAlert('warning', message ?? `DTR for ${saveDtrLabel.value} has already been saved.`)
    } else if (status === 422) {
      showAlert('warning', message ?? incompleteMonthMessage)
    } else {
      showAlert('error', message ?? 'Failed to process DTR. Please try again.')
    }
    finishSavingDtr()
  }
}

async function saveDtr() {
  await runDtrJob('/api/dtr/save', `DTR for ${saveDtrLabel.value} is not yet complete.`)
}

async function overrideDtr() {
  confirmOverrideOpen.value = false
  await runDtrJob('/api/dtr/override', `DTR for ${saveDtrLabel.value} is not yet complete.`)
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

function cancelSaveDtr() {
  confirmSaveOpen.value = false
  const defaultPeriod = getDefaultSaveDtrPeriod()
  saveDtrMonth.value = defaultPeriod.month
  saveDtrYear.value  = defaultPeriod.year
  periodSummary.value = null
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(() => {
  fetchData()

  const userId = userStore.user?.id
  if (!userId) return

  realtime.subscribeToDtrProgress(
    userId,
    payload => {
      realtimeConnectionError.value = false
      armStaleTimer() // any event, including 'running', proves the channel is alive

      if (payload.status === 'completed') {
        showAlert('success', payload.message)
        finishSavingDtr()
        return
      }

      if (payload.status === 'failed') {
        showAlert('error', payload.message || 'DTR save failed. Please try again.')
        finishSavingDtr()
        return
      }

      // status === 'running'
      saveProgressDone.value  = payload.current
      saveProgressTotal.value = payload.total
    },
    () => {
      realtimeConnectionError.value = true
    },
  )
})

onUnmounted(() => {
  const userId = userStore.user?.id
  if (!userId) return

  realtime.leaveDtrProgress(userId)
})
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

        <!-- ── Header action buttons ── -->
        <div class="d-flex gap-2">
          <VBtn variant="tonal" prepend-icon="mdi-refresh" :loading="loading" @click="fetchData">
            Refresh
          </VBtn>

          <!-- Save DTR button — saves ALL JO employees' DTR for the preceding month -->
          <VTooltip location="bottom">
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                color="success"
                variant="tonal"
                prepend-icon="mdi-content-save-outline"
                :loading="savingDtr"
                :disabled="!canSaveDtr"
                @click="{ savingElapsedSecs = 0; confirmSaveOpen = true }"
              >
                Save DTR
              </VBtn>
            </template>
            <span>
              {{
                !isMonthComplete
                  ? `${saveDtrLabel} is not yet complete — DTR can only be saved after the month ends`
                  : 'Save DTR summaries — select period in dialog'
              }}
            </span>
          </VTooltip>

          <!-- Set Flexi button — mark/unmark employees on the flexi schedule -->
          <VBtn
            variant="tonal"
            color="info"
            prepend-icon="mdi-account-clock-outline"
            @click="flexiModalOpen = true"
          >
            Set Flexi
          </VBtn>
        </div>
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
      <div class="d-flex flex-wrap gap-2 mb-6">
        <VTooltip
          v-for="device in deviceStatus"
          :key="device.ip"
          location="top"
          content-class="device-pill-tooltip"
        >
          <template #activator="{ props }">
          <!-- Connected: quiet/neutral pill with a small status dot -->
          <VChip
            v-if="device.status === 'connected'"
            v-bind="props"
            color="default"
            variant="outlined"
            label
            class="device-pill"
          >
            <span class="device-dot device-dot--success" />
            {{ device.floor }}
          </VChip>

          <!-- Disconnected/error: bold, colored, icon — meant to stand out -->
          <VChip
            v-else
            v-bind="props"
            :color="deviceChipColor(device.status)"
            variant="tonal"
            label
            class="device-pill device-pill--problem"
          >
            <VIcon start :icon="deviceChipIcon(device.status)" size="16" />
            {{ device.floor }}
          </VChip>
        </template>
          <div class="font-weight-medium">{{ device.floor }}</div>
          <div>{{ device.message }}</div>
        </VTooltip>
      </div>

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
            <VAvatar size="32" :color="avatarColor(item.id)" variant="tonal">
              <span class="text-caption font-weight-bold">
                {{ initials(item.full_name) }}
              </span>
            </VAvatar>
            <span>{{ item.full_name }}</span>
            <VChip v-if="item.is_flexi" size="x-small" color="info" variant="tonal" label>
              Flexi
            </VChip>
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
          <VTooltip location="top">
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon="mdi-calendar-clock"
                size="small"
                variant="text"
                color="primary"
                @click="openDtrModal(item)"
              />
            </template>
            <span>View DTR</span>
          </VTooltip>
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

        <!-- ── Period selectors ── -->
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

        <!-- ── DTR results ── -->
        <template v-if="dtrData">

          <!-- ── Monthly Summary ── -->
          <VCol cols="12" class="mt-4">
            <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
              Period Summary — {{ dtrData.period_label }}
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
                <div class="text-h6 font-weight-bold">{{ dtrData.total_late_minutes }}m</div>
                <div class="text-caption">Total Late Minutes</div>
              </VCardText>
            </VCard>
          </VCol>
          <VCol cols="6" sm="3">
            <VCard variant="tonal" color="info" rounded="lg">
              <VCardText class="pa-3 text-center">
                <div class="text-h6 font-weight-bold">{{ dtrData.total_undertime_minutes }}m</div>
                <div class="text-caption">Total Undertime Minutes</div>
              </VCardText>
            </VCard>
          </VCol>

          <!-- ── Working days breakdown ── -->
          <VCol cols="12">
            <div class="d-flex gap-4 flex-wrap">
              <div class="text-caption text-medium-emphasis">
                Working Days: <strong class="text-high-emphasis">{{ dtrData.regdays }}</strong>
              </div>
              <div class="text-caption text-medium-emphasis">
                Weekends: <strong class="text-high-emphasis">{{ dtrData.weekends }}</strong>
              </div>
              <div class="text-caption text-medium-emphasis">
                Holidays: <strong class="text-purple">{{ dtrData.total_holidays }}</strong>
              </div>
              <div class="text-caption text-medium-emphasis">
                Suspensions: <strong class="text-teal">{{ dtrData.total_suspensions }}</strong>
              </div>
              <div class="text-caption text-medium-emphasis">
                Late Hours: <strong class="text-warning">{{ dtrData.total_late_hours }}h</strong>
              </div>
              <div class="text-caption text-medium-emphasis">
                Undertime Hours: <strong class="text-info">{{ dtrData.total_undertime_hours }}h</strong>
              </div>
            </div>
          </VCol>

          <!-- ── December/January carried-over breakdown ── -->
          <!-- Only meaningful for a merged January period — the combined
               totals above are unaffected either way; this just shows
               how much of them came from each calendar month. -->
          <VCol v-if="dtrData.period_type === 'dec_second_half_merged'" cols="12">
            <VCard variant="tonal" color="default" rounded="lg" class="mt-2">
              <VCardText class="pa-3">
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-2">
                  December / January Breakdown
                </p>
                <VRow dense>
                  <VCol cols="6">
                    <div class="text-caption text-medium-emphasis mb-1">December (carried over)</div>
                    <div class="text-body-2">
                      Absent: <strong>{{ dtrData.carried_over_absent_days }}</strong> ·
                      Late: <strong>{{ dtrData.carried_over_late_minutes }}m</strong> ·
                      Undertime: <strong>{{ dtrData.carried_over_undertime_minutes }}m</strong>
                    </div>
                  </VCol>
                  <VCol cols="6">
                    <div class="text-caption text-medium-emphasis mb-1">January</div>
                    <div class="text-body-2">
                      Absent: <strong>{{ dtrData.current_period_absent_days }}</strong> ·
                      Late: <strong>{{ dtrData.current_period_late_minutes }}m</strong> ·
                      Undertime: <strong>{{ dtrData.current_period_undertime_minutes }}m</strong>
                    </div>
                  </VCol>
                </VRow>
              </VCardText>
            </VCard>
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
                <div class="dtr-legend dtr-legend--holiday" />
                <span class="text-caption">Holiday</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div class="dtr-legend dtr-legend--suspension" />
                <span class="text-caption">Suspension</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div class="dtr-legend dtr-legend--pass-slip" />
                <span class="text-caption">Pass Slip</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div class="dtr-legend dtr-legend--fri-cmp" />
                <span class="text-caption">Compressed Rest (Fri)</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div class="dtr-legend dtr-legend--weekend" />
                <span class="text-caption">Weekend</span>
              </div>
            </div>
            <!-- Compressed week absence note -->
            <div class="d-flex align-center gap-1 mt-1">
              <VIcon size="14" color="info">mdi-information-outline</VIcon>
              <span class="text-caption text-medium-emphasis">
                <strong>Compressed Week Absence:</strong> 1 absent day + 120 mins added to late
              </span>
            </div>

            <!-- Scrollable table -->
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
                    :key="row.fullDate"
                    :class="getRowClass(row)"
                  >
                    <!-- Day + weekday name -->
                    <td class="col-day">
                      <span class="font-weight-medium">{{ row.day }}</span>
                      <span v-if="dtrData?.period_type === 'dec_second_half_merged'" class="text-caption text-medium-emphasis">
                        {{ row.monthShort }}
                      </span>
                      <span class="text-caption text-medium-emphasis ms-1">{{ row.dayName }}</span>
                    </td>

                    <!-- ── Holiday ── -->
                    <template v-if="row.is_holiday">
                      <td class="col-time text-caption">{{ row.in_am  || '—' }}</td>
                      <td class="col-time text-caption">{{ row.out_am || '—' }}</td>
                      <td class="col-time text-caption">{{ row.in_pm  || '—' }}</td>
                      <td class="col-time text-caption">{{ row.out_pm || '—' }}</td>
                      <td class="col-hours text-caption">{{ row.total_hours ? `${row.total_hours}h` : '—' }}</td>
                      <td class="col-status">
                        <VChip
                          :color="row.holiday_type === 'regular' ? 'purple' : 'deep-purple'"
                          size="x-small"
                          variant="tonal"
                          label
                        >
                          {{ row.holiday_type === 'regular' ? 'Regular Holiday' : 'Special Holiday' }}
                          <span v-if="row.holiday_label" class="ms-1">— {{ row.holiday_label }}</span>
                        </VChip>
                      </td>
                    </template>

                    <!-- ── Suspension ── -->
                    <template v-else-if="row.is_suspension">
                      <td class="col-time text-caption">{{ row.in_am  || '—' }}</td>
                      <td class="col-time text-caption">{{ row.out_am || '—' }}</td>
                      <td class="col-time text-caption">{{ row.in_pm  || '—' }}</td>
                      <td class="col-time text-caption">{{ row.out_pm || '—' }}</td>
                      <td class="col-hours text-caption">{{ row.total_hours ? `${row.total_hours}h` : '—' }}</td>
                      <td class="col-status">
                        <VChip color="teal" size="x-small" variant="tonal" label>
                          Suspension
                          <span v-if="row.suspension_label" class="ms-1">— {{ row.suspension_label }}</span>
                        </VChip>
                      </td>
                    </template>

                    <!-- ── Sunday ── -->
                    <template v-else-if="row.isSunday">
                      <td colspan="5" class="text-center text-caption text-disabled">Happy Weekend 🎉</td>
                      <td />
                    </template>

                    <!-- ── Saturday ── -->
                    <template v-else-if="row.isSaturday">
                      <td colspan="5" class="text-center text-caption text-disabled">Happy Weekend 🎉</td>
                      <td />
                    </template>

                    <!-- ── Compressed Friday (Rest Day) ── -->
                    <template v-else-if="row.is_rest_day">
                      <td colspan="5" class="text-center text-caption text-disabled">
                        Rest Day
                        <span class="text-caption">(Compressed Week)</span>
                      </td>
                      <td class="col-status">
                        <VChip color="purple" size="x-small" variant="tonal" label>
                          Compressed Rest
                        </VChip>
                      </td>
                    </template>

                    <!-- ── Regular weekday ── -->
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
                      <td class="col-status">
                        <div class="d-flex flex-wrap gap-1">
                          <VChip v-if="row.is_absent" color="error" size="x-small" variant="tonal" label>
                            Absent
                          </VChip>
                          <VChip v-if="row.is_half_day_absent" color="warning" size="x-small" variant="tonal" label>
                            ½ Day
                          </VChip>
                          <VChip v-if="row.total_late_minutes > 0" color="warning" size="x-small" variant="tonal" label>
                            {{ row.is_absent_penalty ? '+ ' : '' }}Late {{ row.total_late_minutes }}m
                          </VChip>
                          <VChip v-if="row.total_undertime_minutes > 0" color="info" size="x-small" variant="tonal" label>
                            UT {{ row.total_undertime_minutes }}m
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

                          <VTooltip v-if="row.has_pass_slip" location="top" max-width="280" content-class="pass-slip-tooltip">
                            <template #activator="{ props }">
                              <VChip v-bind="props" :color="chipColor" size="x-small" variant="tonal" label>
                                <VIcon start size="12">mdi-badge-account-horizontal-outline</VIcon>
                                Pass Slip
                              </VChip>
                            </template>
                            <div v-for="ps in row.pass_slips" :key="ps.id" class="mb-1">
                              <div class="font-weight-medium">{{ ps.label }}</div>
                              <div>Request Out: {{ ps.request_time_out }} → Actual In: {{ ps.actual_time ?? '—' }}</div>
                              <div v-if="ps.minutes > 0">Minutes: {{ ps.minutes }}m</div>
                              <div v-if="ps.nature_business">{{ ps.nature_business }}</div>
                            </div>
                          </VTooltip>

                          <VChip
                            v-if="row.schedule_type"
                            :color="row.schedule_type === 'compressed' ? 'purple' : 'primary'"
                            size="x-small"
                            variant="tonal"
                            label
                          >
                            {{ row.schedule_type === 'compressed' ? 'CMP' : 'STD' }}
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

    <!-- ── Save DTR Confirmation Dialog ── -->
    <VDialog v-model="confirmSaveOpen" max-width="440" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <!-- ── Idle state: form ── -->
          <template v-if="!savingDtr">
            <div class="d-flex align-center gap-3 mb-4">
              <VIcon icon="mdi-content-save-outline" color="success" size="28" />
              <span class="text-h6 font-weight-bold">Save DTR</span>
            </div>
            <p class="text-body-2 mb-3">
              This will save DTR summary totals for <strong>all active JO employees</strong> for:
            </p>

            <!-- ── Period selectors ── -->
            <VRow dense class="mb-3">
              <VCol cols="7">
                <VSelect
                  v-model="saveDtrMonth"
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
              <VCol cols="5">
                <VSelect
                  v-model="saveDtrYear"
                  label="Year"
                  :items="YEAR_ITEMS"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-calendar-outline"
                  hide-details
                />
              </VCol>
            </VRow>

            <p class="text-body-1 font-weight-bold text-success mb-3">
              {{ saveDtrLabel }}
            </p>

            <!-- ── Calendar preview: working days / holidays / suspensions ── -->
            <div class="d-flex flex-wrap gap-2 mb-3">
              <VProgressCircular
                v-if="periodSummaryLoading"
                indeterminate
                size="18"
                width="2"
                color="success"
              />
              <template v-else-if="periodSummary">
                <VChip size="small" color="success" variant="tonal" prepend-icon="mdi-briefcase-check-outline">
                  {{ periodSummary.regdays }} Working Days
                </VChip>
                <VChip size="small" color="warning" variant="tonal" prepend-icon="mdi-calendar-star">
                  {{ periodSummary.total_holidays }} Holiday{{ periodSummary.total_holidays === 1 ? '' : 's' }}
                </VChip>
                <VChip size="small" color="error" variant="tonal" prepend-icon="mdi-calendar-remove-outline">
                  {{ periodSummary.total_suspensions }} Suspension{{ periodSummary.total_suspensions === 1 ? '' : 's' }}
                </VChip>
              </template>
            </div>

            <!-- ── Already-saved warning: switches the flow to override ── -->
            <VAlert
              v-if="periodSummary?.already_saved"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3"
              icon="mdi-alert-circle-outline"
            >
              DTR for {{ saveDtrLabel }} has already been saved. Do you want to override the existing data?
            </VAlert>

            <VAlert
              v-if="!isMonthComplete"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3"
              icon="mdi-calendar-alert"
            >
              {{ saveDtrLabel }} is not yet complete. DTR can only be saved after the month has fully ended.
            </VAlert>

            <p class="text-caption text-medium-emphasis">
              This action cannot be undone.
            </p>
          </template>

          <!-- ── Saving state: real progress screen (polled from backend) ── -->
          <template v-else>
            <div class="d-flex flex-column align-center text-center py-6">
              <VAlert
                v-if="realtimeConnectionError"
                type="warning"
                density="compact"
                variant="tonal"
                class="mb-4"
                style="max-width: 320px;"
              >
                Live progress connection lost. The save is still running in the background — refresh after it completes to confirm.
              </VAlert>

              <VProgressCircular
                :model-value="saveProgressPercent"
                size="72"
                width="5"
                color="success"
                class="mb-4"
              >
                <span class="text-caption font-weight-bold">{{ saveProgressPercent }}%</span>
              </VProgressCircular>

              <p class="text-body-1 font-weight-medium mb-1">
                {{ saveProgressLabel }}
              </p>

              <VProgressLinear
                :model-value="saveProgressPercent"
                color="success"
                height="6"
                rounded
                class="mb-3"
                style="max-width: 280px;"
              />

              <p class="text-caption text-medium-emphasis mb-0">
                {{ saveDtrLabel }} — {{ savingElapsedLabel }}
              </p>
              <p class="text-caption text-medium-emphasis mt-1">
                Please don't close this window.
              </p>
            </div>
          </template>
        </VCardText>
        <VCardActions v-if="!savingDtr" class="pa-4 pt-0 gap-2 justify-end">
          <VBtn variant="text" @click="cancelSaveDtr">Cancel</VBtn>
          <VBtn
            v-if="periodSummary?.already_saved"
            color="warning"
            variant="tonal"
            prepend-icon="mdi-restore-alert"
            @click="confirmOverrideOpen = true"
            :disabled="!canSaveDtr"
          >
            Override
          </VBtn>
          <VBtn v-else color="success" variant="tonal" prepend-icon="mdi-content-save-outline" @click="saveDtr" :disabled="!canSaveDtr">
            Save
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Override confirmation: second, explicit "are you sure" step ── -->
    <VDialog v-model="confirmOverrideOpen" max-width="400">
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VIcon icon="mdi-alert-circle-outline" color="warning" size="28" />
            <span class="text-h6 font-weight-bold">Confirm Override</span>
          </div>
          <p class="text-body-2">
            Are you sure you want to override the existing DTR for
            <strong>{{ saveDtrLabel }}</strong>? This will overwrite the previously
            saved data for all active JO employees and cannot be undone.
          </p>
        </VCardText>
        <VCardActions class="pa-4 pt-0 gap-2 justify-end">
          <VBtn variant="text" @click="confirmOverrideOpen = false">Cancel</VBtn>
          <VBtn color="warning" variant="tonal" prepend-icon="mdi-restore-alert" @click="overrideDtr">
            Yes, Override
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Set Flexi Modal ── -->
    <SetFlexiModal
      v-model="flexiModalOpen"
      :employees="employees"
      @saved="handleFlexiSaved"
    />

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
.col-status { width: 240px; }

/* ── Row highlight states ───────────────────────── */
.dtr-row--holiday    { background: rgba(var(--v-theme-purple),        0.08); }
.dtr-row--suspension { background: rgba(var(--v-theme-teal),          0.08); }
.dtr-row--sunday     { background: rgba(var(--v-theme-on-surface), 0.035); color: rgba(var(--v-theme-on-surface), 0.38); }
.dtr-row--saturday   { background: rgba(var(--v-theme-on-surface),    0.02); }
.dtr-row--absent     { background: rgba(var(--v-theme-error),         0.08); }
.dtr-row--halfday    { background: rgba(var(--v-theme-warning),       0.08); }
.dtr-row--late       { background: rgba(var(--v-theme-warning),       0.04); }
.dtr-row--undertime  { background: rgba(var(--v-theme-info),          0.06); }
.dtr-row--fri-cmp    { background: rgba(128, 0, 128,                  0.05); color: rgba(var(--v-theme-on-surface), 0.45); }

/* ── Legend dots ────────────────────────────────── */
.dtr-legend {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.dtr-legend--absent     { background: rgba(var(--v-theme-error),      0.5); }
.dtr-legend--halfday    { background: rgba(var(--v-theme-warning),    0.5); }
.dtr-legend--late       { background: rgba(var(--v-theme-warning),    0.3); }
.dtr-legend--undertime  { background: rgba(var(--v-theme-info),       0.4); }
.dtr-legend--holiday    { background: rgba(128, 0, 128,               0.4); }
.dtr-legend--suspension { background: rgba(0,   128, 128,             0.4); }
.dtr-legend--weekend    { background: rgba(var(--v-theme-on-surface), 0.15); }
.dtr-legend--fri-cmp    { background: rgba(128, 0, 128,               0.25); }
.dtr-legend--pass-slip  { background: rgba(var(--v-theme-info),       0.4); }

/* ── Pass slip ────────────────────────────────── */
.pass-slip-tooltip {
  font-size: 0.8rem;
  line-height: 1.4;
  padding: 10px 12px;
  text-align: left;
  white-space: normal;
}

/* ── Biometric device pills ─────────────────────── */
.device-pill {
  font-weight: 500;
  padding-inline: 10px;
  cursor: default;
}

.device-pill--problem {
  font-weight: 600;
}

.device-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 7px;
  background: rgb(var(--v-theme-success));
  flex-shrink: 0;
}

.device-pill-tooltip {
  font-size: 0.8rem;
  line-height: 1.4;
  padding: 8px 12px;
  text-align: left;
  white-space: normal;
}

</style>
