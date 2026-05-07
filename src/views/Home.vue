<script setup lang="ts">
import BaseCard from '@/components/base/BaseCard.vue'
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
  const firstDay  = new Date(currentYear, currentMonth - 1, 1).getDay()
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
    .filter(e => {
      const d = new Date(e.date)
      return d.getDate() >= today
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
})

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

    totalEmployees.value  = empRes.data?.data?.length ?? 0

    const wages           = wageRes.data?.data ?? []
    deductionsSet.value   = wages.filter((e: any) => e.has_deductions).length
    deductionsNotSet.value = wages.filter((e: any) => !e.has_deductions).length

    const batches         = batchRes.data?.data ?? []
    pendingBatches.value  = batches.filter((b: any) => b.status !== 'finalized').length

    // Sum net pay from finalized batches this month
    totalDeductions.value = batches
      .filter((b: any) => {
        const d = new Date(b.created_at ?? '')
        return b.status === 'finalized' &&
               d.getFullYear() === currentYear &&
               d.getMonth() + 1 === currentMonth
      })
      .reduce((sum: number, b: any) => sum + (Number(b.net_pay ?? b.total_net ?? 0)), 0)

  } catch {
    // fail silently — cards will show 0
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

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
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
        <BaseCard
          title="Total JO Employees"
          :value="loading ? '...' : String(totalEmployees)"
          icon="mdi-account-group-outline"
          color="primary"
        />
      </VCol>

      <VCol cols="12" sm="6" lg="3">
        <BaseCard
          title="Net Pay This Month"
          :value="loading ? '...' : (totalDeductions > 0 ? fmt(totalDeductions) : '—')"
          icon="mdi-cash-multiple"
          color="success"
        />
      </VCol>

      <VCol cols="12" sm="6" lg="3">
        <BaseCard
          title="Pending Payroll Batches"
          :value="loading ? '...' : String(pendingBatches)"
          icon="mdi-clock-outline"
          color="warning"
        />
      </VCol>

      <VCol cols="12" sm="6" lg="3">
        <BaseCard
          title="Deductions Not Set"
          :value="loading ? '...' : String(deductionsNotSet)"
          icon="mdi-alert-circle-outline"
          color="error"
        />
      </VCol>

      <!-- ── Deductions Progress ── -->
      <VCol cols="12" md="6">
        <VCard rounded="lg" border>
          <VCardText>
            <div class="d-flex align-center justify-space-between mb-3">
              <div>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
                  Deductions Setup Progress
                </p>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  How many JO employees have deductions configured
                </p>
              </div>
              <VIcon icon="mdi-chart-donut" color="primary" size="28" />
            </div>

            <div class="d-flex align-center gap-2 mb-2">
              <span class="text-h5 font-weight-bold text-primary">{{ deductionsSet }}</span>
              <span class="text-body-2 text-medium-emphasis">of {{ totalEmployees }} set</span>
            </div>

            <VProgressLinear
              :model-value="totalEmployees > 0 ? (deductionsSet / totalEmployees) * 100 : 0"
              color="primary"
              bg-color="primary-lighten-4"
              rounded
              height="10"
              class="mb-3"
            />

            <div class="d-flex gap-4">
              <div class="d-flex align-center gap-2">
                <div style="width:10px;height:10px;border-radius:50%;background:#0ea5e9" />
                <span class="text-caption">Set ({{ deductionsSet }})</span>
              </div>
              <div class="d-flex align-center gap-2">
                <div style="width:10px;height:10px;border-radius:50%;background:#fca5a5" />
                <span class="text-caption">Not Set ({{ deductionsNotSet }})</span>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- ── Upcoming Events ── -->
      <VCol cols="12" md="6">
        <VCard rounded="lg" border style="height:100%">
          <VCardText>
            <div class="d-flex align-center justify-space-between mb-3">
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
                Upcoming This Month
              </p>
              <div class="d-flex gap-3">
                <div class="d-flex align-center gap-1">
                  <div style="width:8px;height:8px;border-radius:50%;background:#ef4444" />
                  <span class="text-caption">Regular</span>
                </div>
                <div class="d-flex align-center gap-1">
                  <div style="width:8px;height:8px;border-radius:50%;background:#f59e0b" />
                  <span class="text-caption">Special</span>
                </div>
                <div class="d-flex align-center gap-1">
                  <div style="width:8px;height:8px;border-radius:50%;background:#3b82f6" />
                  <span class="text-caption">Suspension</span>
                </div>
              </div>
            </div>

            <div v-if="calLoading" class="d-flex justify-center py-4">
              <VProgressCircular indeterminate color="primary" size="24" />
            </div>

            <div v-else-if="upcomingEvents.length === 0" class="text-center py-4">
              <VIcon icon="mdi-calendar-check-outline" color="success" size="32" class="mb-2" />
              <p class="text-body-2 text-medium-emphasis mb-0">No upcoming events this month</p>
            </div>

            <div v-else class="d-flex flex-column gap-2">
              <div
                v-for="event in upcomingEvents"
                :key="event.date + event.label"
                class="d-flex align-center gap-3 pa-2 rounded"
                style="background: rgba(0,0,0,0.02)"
              >
                <div
                  style="width:8px;height:8px;border-radius:50%;flex-shrink:0"
                  :style="{ background: eventDot(event.type) }"
                />
                <div class="flex-grow-1">
                  <p class="text-body-2 font-weight-medium mb-0">{{ event.label }}</p>
                </div>
                <VChip :color="eventColor(event.type)" size="x-small" variant="tonal" label>
                  {{ formatEventDate(event.date) }}
                </VChip>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- ── Calendar Preview ── -->
      <VCol cols="12">
        <VCard rounded="lg" border>
          <VCardText>
            <div class="d-flex align-center justify-space-between mb-4">
              <div>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
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
                    'cal-today':   cell?.day === today,
                    'cal-has-event': cell && cell.events.length > 0,
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
                    <!-- Tooltip label on hover -->
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
  background: rgba(0, 0, 0, 0.03);
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
