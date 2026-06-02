<script setup lang="ts">
import axios from '@axios'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Holiday {
  id:    number
  date:  string
  label: string
  type:  'regular' | 'special'
}

interface Suspension {
  id:    number
  date:  string
  label: string
}

interface CalendarDay {
  day:    number
  date:   string
  events: { label: string; type: 'regular' | 'special' | 'suspension' }[]
}

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const now          = new Date()
const currentYear  = now.getFullYear()
const currentMonth = now.getMonth() + 1
const today        = now.getDate()

const totalEmployees   = ref(0)
const totalDeductions  = ref(0)
const pendingBatches   = ref(0)
const deductionsSet    = ref(0)
const deductionsNotSet = ref(0)
const loading          = ref(true)

const holidays    = ref<Holiday[]>([])
const suspensions = ref<Suspension[]>([])
const calLoading  = ref(true)

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const monthLabel = computed(() => `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`)

const calendarDays = computed((): (CalendarDay | null)[] => {
  const firstDay    = new Date(currentYear, currentMonth - 1, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const days: (CalendarDay | null)[] = Array(firstDay).fill(null)

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const events: CalendarDay['events'] = []
    holidays.value
      .filter(h => h.date.startsWith(dateStr))
      .forEach(h => events.push({ label: h.label, type: h.type }))
    suspensions.value
      .filter(s => s.date.startsWith(dateStr))
      .forEach(s => events.push({ label: s.label, type: 'suspension' }))
    days.push({ day: d, date: dateStr, events })
  }
  return days
})

const upcomingEvents = computed(() => {
  const all = [
    ...holidays.value.map(h => ({ date: h.date, label: h.label, type: h.type as string })),
    ...suspensions.value.map(s => ({ date: s.date, label: s.label, type: 'suspension' })),
  ]
  return all
    .filter(e => new Date(e.date).getDate() >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
})

const deductionsProgress = computed(() =>
  totalEmployees.value > 0
    ? Math.round((deductionsSet.value / totalEmployees.value) * 100)
    : 0
)

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */
async function fetchDashboard() {
  loading.value = true
  try {
    const [empRes, wageRes, batchRes] = await Promise.all([
      axios.get('/api/employee/getemployees'),
      axios.get('/api/wage'),
      axios.get('/api/payroll-batch'),
    ])

    totalEmployees.value   = empRes.data?.data?.length ?? 0
    const wages            = wageRes.data?.data ?? []
    deductionsSet.value    = wages.filter((e: any) =>  e.has_deductions).length
    deductionsNotSet.value = wages.filter((e: any) => !e.has_deductions).length

    const batches          = batchRes.data?.data ?? []
    pendingBatches.value   = batches.filter((b: any) => b.status !== 'finalized').length
    totalDeductions.value  = batches
      .filter((b: any) => {
        const d = new Date(b.created_at ?? '')
        return b.status === 'finalized' &&
               d.getFullYear() === currentYear &&
               d.getMonth() + 1 === currentMonth
      })
      .reduce((sum: number, b: any) => sum + (Number(b.net_pay ?? b.total_net ?? 0)), 0)
  } catch {
    // fail silently
  } finally {
    loading.value = false
  }
}

async function fetchCalendar() {
  calLoading.value = true
  try {
    const { data } = await axios.get('/api/calendar/summary', {
      params: { year: currentYear, month: currentMonth },
    })
    holidays.value    = [
      ...(data.data?.regular_holidays ?? []),
      ...(data.data?.special_holidays ?? []),
    ]
    suspensions.value = data.data?.suspensions ?? []
  } catch {
    //
  } finally {
    calLoading.value = false
  }
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function fmt(v: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 0,
  }).format(v)
}

function eventColor(type: string) {
  if (type === 'regular')    return 'error'
  if (type === 'special')    return 'warning'
  if (type === 'suspension') return 'info'
  return 'default'
}

function eventDot(type: string) {
  if (type === 'regular')    return '#ef4444'
  if (type === 'special')    return '#f59e0b'
  if (type === 'suspension') return '#3b82f6'
  return '#94a3b8'
}

function eventIcon(type: string) {
  if (type === 'regular')    return 'mdi-calendar-star'
  if (type === 'special')    return 'mdi-calendar-alert'
  if (type === 'suspension') return 'mdi-calendar-remove'
  return 'mdi-calendar'
}

function formatEventDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(() => {
  fetchDashboard()
  fetchCalendar()
})
</script>

<template>
  <VContainer fluid class="pa-6">

    <!-- ── Page Header ── -->
    <div class="mb-6">
      <h4 class="text-h5 font-weight-bold mb-1">Dashboard</h4>
      <p class="text-body-2 text-medium-emphasis mb-0">
        JO Payroll System — {{ monthLabel }} overview
      </p>
    </div>

    <VRow>

      <!-- ── Stat Cards ── -->
      <VCol cols="12" sm="6" lg="3">
        <VCard variant="tonal" color="primary" rounded="lg" flat>
          <VCardText class="d-flex align-center gap-3 py-4">
            <VAvatar color="primary" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-account-group-outline" size="22" />
            </VAvatar>
            <div>
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">
                Total JO Employees
              </div>
              <div class="text-h5 font-weight-bold mt-1">
                {{ loading ? '…' : totalEmployees }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" lg="3">
        <VCard variant="tonal" color="success" rounded="lg" flat>
          <VCardText class="d-flex align-center gap-3 py-4">
            <VAvatar color="success" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-cash-multiple" size="22" />
            </VAvatar>
            <div>
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">
                Net Pay This Month
              </div>
              <div class="text-h5 font-weight-bold mt-1">
                {{ loading ? '…' : (totalDeductions > 0 ? fmt(totalDeductions) : '—') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" lg="3">
        <VCard variant="tonal" color="warning" rounded="lg" flat>
          <VCardText class="d-flex align-center gap-3 py-4">
            <VAvatar color="warning" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-clock-outline" size="22" />
            </VAvatar>
            <div>
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">
                Pending Payroll Batches
              </div>
              <div class="text-h5 font-weight-bold mt-1">
                {{ loading ? '…' : pendingBatches }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" lg="3">
        <VCard variant="tonal" color="error" rounded="lg" flat>
          <VCardText class="d-flex align-center gap-3 py-4">
            <VAvatar color="error" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-alert-circle-outline" size="22" />
            </VAvatar>
            <div>
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">
                Deductions Not Set
              </div>
              <div class="text-h5 font-weight-bold mt-1">
                {{ loading ? '…' : deductionsNotSet }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- ── Deductions Progress ── -->
      <VCol cols="12" md="6">
        <VCard rounded="lg" border flat style="height: 100%;">
          <VCardText class="pa-5">
            <div class="d-flex align-center justify-space-between mb-4">
              <div>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
                  Deductions Setup Progress
                </p>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  JO employees with deductions configured
                </p>
              </div>
              <VAvatar color="primary" variant="tonal" size="40" rounded="lg">
                <VIcon icon="mdi-chart-donut" size="20" />
              </VAvatar>
            </div>

            <!-- Big number -->
            <div class="d-flex align-baseline gap-2 mb-3">
              <span class="text-h4 font-weight-bold text-primary">{{ deductionsSet }}</span>
              <span class="text-body-2 text-medium-emphasis">of {{ totalEmployees }} employees</span>
              <VSpacer />
              <VChip
                :color="deductionsProgress === 100 ? 'success' : deductionsProgress >= 50 ? 'warning' : 'error'"
                size="small"
                variant="tonal"
                label
              >
                {{ deductionsProgress }}%
              </VChip>
            </div>

            <VProgressLinear
              :model-value="deductionsProgress"
              color="primary"
              bg-color="primary-lighten-4"
              rounded
              height="8"
              class="mb-4"
            />

            <div class="d-flex gap-4">
              <div class="d-flex align-center gap-2">
                <VAvatar color="primary" variant="tonal" size="20" rounded>
                  <VIcon icon="mdi-check" size="12" />
                </VAvatar>
                <span class="text-caption text-medium-emphasis">Set ({{ deductionsSet }})</span>
              </div>
              <div class="d-flex align-center gap-2">
                <VAvatar color="error" variant="tonal" size="20" rounded>
                  <VIcon icon="mdi-close" size="12" />
                </VAvatar>
                <span class="text-caption text-medium-emphasis">Not Set ({{ deductionsNotSet }})</span>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- ── Upcoming Events ── -->
      <VCol cols="12" md="6">
        <VCard rounded="lg" border flat style="height: 100%;">
          <VCardText class="pa-5">
            <div class="d-flex align-center justify-space-between mb-4">
              <div>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
                  Upcoming This Month
                </p>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  Holidays and suspensions remaining
                </p>
              </div>
              <VAvatar color="info" variant="tonal" size="40" rounded="lg">
                <VIcon icon="mdi-calendar-clock" size="20" />
              </VAvatar>
            </div>

            <!-- Legend -->
            <div class="d-flex flex-wrap gap-3 mb-4">
              <div class="d-flex align-center gap-1">
                <div style="width:8px;height:8px;border-radius:50%;background:#ef4444;flex-shrink:0" />
                <span class="text-caption text-medium-emphasis">Regular</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;flex-shrink:0" />
                <span class="text-caption text-medium-emphasis">Special</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div style="width:8px;height:8px;border-radius:50%;background:#3b82f6;flex-shrink:0" />
                <span class="text-caption text-medium-emphasis">Suspension</span>
              </div>
            </div>

            <div v-if="calLoading" class="d-flex justify-center py-4">
              <VProgressCircular indeterminate color="primary" size="24" />
            </div>

            <div v-else-if="upcomingEvents.length === 0" class="text-center py-6">
              <VAvatar color="success" variant="tonal" size="48" rounded="lg" class="mb-3">
                <VIcon icon="mdi-calendar-check-outline" size="24" />
              </VAvatar>
              <p class="text-body-2 text-medium-emphasis mb-0">No upcoming events this month</p>
            </div>

            <div v-else class="d-flex flex-column gap-2">
              <div
                v-for="event in upcomingEvents"
                :key="event.date + event.label"
                class="d-flex align-center gap-3 pa-2 rounded-lg"
                style="background: rgba(var(--v-theme-surface-variant), 0.4);"
              >
                <VAvatar
                  :color="eventColor(event.type)"
                  variant="tonal"
                  size="32"
                  rounded="lg"
                >
                  <VIcon :icon="eventIcon(event.type)" size="16" />
                </VAvatar>
                <div class="flex-grow-1 text-truncate">
                  <p class="text-body-2 font-weight-medium mb-0 text-truncate">{{ event.label }}</p>
                </div>
                <VChip
                  :color="eventColor(event.type)"
                  size="x-small"
                  variant="tonal"
                  label
                  class="flex-shrink-0"
                >
                  {{ formatEventDate(event.date) }}
                </VChip>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- ── Calendar Preview ── -->
      <VCol cols="12">
        <VCard rounded="lg" border flat>
          <VCardText class="pa-5">
            <div class="d-flex align-center justify-space-between mb-4">
              <div>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
                  Calendar Preview
                </p>
                <p class="text-h6 font-weight-bold mb-0">{{ monthLabel }}</p>
              </div>
              <VBtn
                variant="tonal"
                color="primary"
                size="small"
                prepend-icon="mdi-calendar-month-outline"
                :to="{ name: 'CalendarManagement' }"
              >
                Manage Calendar
              </VBtn>
            </div>

            <!-- Calendar legend -->
            <div class="d-flex flex-wrap gap-3 mb-4">
              <div class="d-flex align-center gap-1">
                <div style="width:8px;height:8px;border-radius:50%;background:#ef4444;flex-shrink:0" />
                <span class="text-caption text-medium-emphasis">Regular Holiday</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;flex-shrink:0" />
                <span class="text-caption text-medium-emphasis">Special Holiday</span>
              </div>
              <div class="d-flex align-center gap-1">
                <div style="width:8px;height:8px;border-radius:50%;background:#3b82f6;flex-shrink:0" />
                <span class="text-caption text-medium-emphasis">Suspension</span>
              </div>
            </div>

            <div v-if="calLoading" class="d-flex justify-center py-6">
              <VProgressCircular indeterminate color="primary" />
            </div>

            <template v-else>
              <!-- Day headers -->
              <div class="cal-grid mb-1">
                <div
                  v-for="day in DAY_NAMES"
                  :key="day"
                  class="text-center text-caption font-weight-medium text-medium-emphasis py-1"
                >
                  {{ day }}
                </div>
              </div>

              <!-- Day cells -->
              <div class="cal-grid">
                <div
                  v-for="(cell, i) in calendarDays"
                  :key="i"
                  class="cal-cell"
                  :class="{
                    'cal-today':     cell?.day === today,
                    'cal-has-event': cell && cell.events.length > 0,
                    'cal-weekend':   cell && (new Date(cell.date).getDay() === 0 || new Date(cell.date).getDay() === 6),
                  }"
                >
                  <template v-if="cell">
                    <span class="cal-day-num">{{ cell.day }}</span>
                    <div class="cal-dots">
                      <span
                        v-for="(ev, ei) in cell.events.slice(0, 3)"
                        :key="ei"
                        class="cal-dot"
                        :style="{ background: eventDot(ev.type) }"
                      />
                    </div>
                    <div v-if="cell.events.length" class="cal-tooltip">
                      <div v-for="(ev, ei) in cell.events" :key="ei" class="text-caption">
                        <span :style="{ color: eventDot(ev.type) }">●</span>
                        {{ ev.label }}
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </VCardText>
        </VCard>
      </VCol>

    </VRow>
  </VContainer>
</template>

<style scoped>
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: default;
  transition: background 0.15s;
  padding: 2px;
}

.cal-cell:hover .cal-tooltip {
  display: block;
}

.cal-weekend {
  background: rgba(var(--v-theme-surface-variant), 0.35);
}

.cal-today .cal-day-num {
  background: rgb(var(--v-theme-primary));
  color: #fff;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.cal-has-event {
  background: rgba(var(--v-theme-surface-variant), 0.5);
}

/* weekend + event: event takes priority visually */
.cal-weekend.cal-has-event {
  background: rgba(var(--v-theme-surface-variant), 0.5);
}

.cal-day-num {
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
}

.cal-dots {
  display: flex;
  gap: 2px;
  margin-top: 2px;
  min-height: 6px;
}

.cal-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: inline-block;
}

.cal-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: #fff;
  border-radius: 6px;
  padding: 6px 10px;
  white-space: nowrap;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  pointer-events: none;
  min-width: 160px;
}

.cal-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #1e293b;
}
</style>
