<script setup lang="ts">
import axios from '@axios'
import VueApexCharts from 'vue3-apexcharts'

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

interface DashboardSummary {
  period: { month: number; year: number }
  total_gross: number
  total_deductions: number
  total_net: number
  employee_count: number
  finalized_runs: number
  pending_runs: number
  run_status_counts: Record<string, number>
}

interface TrendPoint {
  label: string
  month: number
  year: number
  total_gross: number
  total_deductions: number
  total_net: number
}

interface DivisionBreakdown {
  division_name: string
  employee_count: number
  total_gross: number
  total_deductions: number
  total_net: number
}

interface DtrTopLate {
  emp_id: number
  emp_name: string
  division_name: string
  total_late_minutes: number
  total_absent_days: number
  total_undertime_minutes: number
}

interface DtrByDivision {
  division_name: string
  total_absent_days: number
  total_late_minutes: number
  total_undertime_minutes: number
}

interface DtrStats {
  overall: {
    total_absent_days: number
    total_late_minutes: number
    total_undertime_minutes: number
    avg_late_minutes: number
  }
  top_late: DtrTopLate[]
  by_division: DtrByDivision[]
}

// NEW: lightweight shape of /api/payroll-run rows, used only to derive
// which periods actually have payroll data for the period selector.
interface PayrollRunLite {
  id:           number
  period_month: number
  period_year:  number
  status:       string
}

interface PeriodOption {
  value:    string   // "YYYY-MM"
  title:    string   // "June 2026"
  subtitle: string   // "2 runs · 1 finalized"
  month:    number
  year:     number
}

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const now          = new Date()
const currentYear  = now.getFullYear()
const currentMonth = now.getMonth() + 1
const today        = now.getDate()

// Existing HRMIS-sourced stats
const totalEmployees   = ref(0)
const deductionsSet    = ref(0)
const deductionsNotSet = ref(0)
const loading          = ref(true)

// NEW: payroll dashboard stats (from DashboardController)
const summary        = ref<DashboardSummary | null>(null)
const summaryLoading = ref(true)

const trends        = ref<TrendPoint[]>([])
const trendsLoading = ref(true)
const trendMonths   = ref(6)

const divisionBreakdown = ref<DivisionBreakdown[]>([])
const divisionLoading   = ref(true)

const dtrStats   = ref<DtrStats | null>(null)
const dtrLoading = ref(true)

// NEW: period selector — drives Summary / Division Breakdown / DTR Overview together
const payrollRuns      = ref<PayrollRunLite[]>([])
const periodsLoading   = ref(true)
const selectedPeriodKey = ref<string | null>(null)

// Existing calendar state
const holidays    = ref<Holiday[]>([])
const suspensions = ref<Suspension[]>([])
const calLoading  = ref(true)

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

/* ─────────────────────────────────────────
   COMPUTED — existing calendar logic
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
   COMPUTED — NEW: period selector
   Derives distinct "month/year" periods from /api/payroll-run
   (already fetched elsewhere in the app — see PayrollItemAdjustmentsDialog's
   deductions export flow for the same source) so the dropdown only ever
   offers periods that actually have payroll data. Sorted most-recent first.
───────────────────────────────────────── */
const periodOptions = computed((): PeriodOption[] => {
  const map = new Map<string, { month: number; year: number; count: number; finalized: number }>()

  for (const r of payrollRuns.value) {
    const key   = `${r.period_year}-${String(r.period_month).padStart(2, '0')}`
    const entry = map.get(key) ?? { month: r.period_month, year: r.period_year, count: 0, finalized: 0 }
    entry.count++
    if (r.status === 'finalized') entry.finalized++
    map.set(key, entry)
  }

  return Array.from(map.entries())
    .map(([key, v]) => ({
      value:    key,
      title:    `${MONTH_NAMES[v.month - 1]} ${v.year}`,
      subtitle: `${v.count} run${v.count === 1 ? '' : 's'} · ${v.finalized} finalized`,
      month:    v.month,
      year:     v.year,
    }))
    .sort((a, b) => b.value.localeCompare(a.value))
})

const selectedPeriod = computed(() =>
  periodOptions.value.find(p => p.value === selectedPeriodKey.value) ?? null
)

const selectedPeriodLabel = computed(() => selectedPeriod.value?.title ?? '—')

/* ─────────────────────────────────────────
   COMPUTED — NEW: payroll trend chart
───────────────────────────────────────── */
const trendChartSeries = computed(() => [
  { name: 'Gross',       data: trends.value.map(t => t.total_gross) },
  { name: 'Deductions',  data: trends.value.map(t => t.total_deductions) },
  { name: 'Net Pay',     data: trends.value.map(t => t.total_net) },
])

const trendChartOptions = computed(() => ({
  chart: {
    type: 'area',
    toolbar: { show: false },
    fontFamily: 'inherit',
    parentHeightOffset: 0,
  },
  colors: ['#3b82f6', '#ef4444', '#22c55e'],
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2.5 },
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] },
  },
  xaxis: {
    categories: trends.value.map(t => t.label),
    labels: { style: { fontSize: '12px' } },
    axisBorder: { show: false },
  },
  yaxis: {
    labels: { formatter: (v: number) => fmtCompact(v) },
  },
  tooltip: {
    y: { formatter: (v: number) => fmt(v) },
  },
  legend: { position: 'top', horizontalAlign: 'right', fontSize: '13px' },
  grid: { strokeDashArray: 4 },
}))

/* ─────────────────────────────────────────
   COMPUTED — NEW: division breakdown donut
───────────────────────────────────────── */
const divisionChartSeries = computed(() => divisionBreakdown.value.map(d => d.employee_count))
const divisionChartLabels = computed(() => divisionBreakdown.value.map(d => d.division_name))

const divisionChartOptions = computed(() => ({
  chart: { type: 'donut', fontFamily: 'inherit' },
  labels: divisionChartLabels.value,
  legend: { position: 'bottom', fontSize: '12px' },
  dataLabels: {
    enabled: true,
    formatter: (val: number) => `${val.toFixed(0)}%`,
  },
  tooltip: {
    y: { formatter: (v: number) => `${v} employee${v === 1 ? '' : 's'}` },
  },
  plotOptions: {
    pie: {
      donut: {
        labels: {
          show: true,
          total: {
            show: true,
            label: 'Total',
            formatter: () => String(divisionBreakdown.value.reduce((s, d) => s + d.employee_count, 0)),
          },
        },
      },
    },
  },
}))

/* ─────────────────────────────────────────
   API — existing
───────────────────────────────────────── */
async function fetchDashboard() {
  loading.value = true
  try {
    const [empRes, wageRes] = await Promise.all([
      axios.get('/api/employee/getemployees'),
      axios.get('/api/wage'),
    ])

    totalEmployees.value   = empRes.data?.data?.length ?? 0
    const wages            = wageRes.data?.data ?? []
    deductionsSet.value    = wages.filter((e: any) =>  e.has_deductions).length
    deductionsNotSet.value = wages.filter((e: any) => !e.has_deductions).length
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
   API — NEW: payroll dashboard analytics
───────────────────────────────────────── */
async function fetchPayrollRuns() {
  periodsLoading.value = true
  try {
    const { data } = await axios.get('/api/payroll-run')
    payrollRuns.value = data.data ?? data ?? []
  } catch {
    //
  } finally {
    periodsLoading.value = false
  }
}

async function fetchSummary() {
  if (!selectedPeriod.value) return
  summaryLoading.value = true
  try {
    const { data } = await axios.get<DashboardSummary>('/api/dashboard/summary', {
      params: { month: selectedPeriod.value.month, year: selectedPeriod.value.year },
    })
    summary.value = data
  } catch {
    //
  } finally {
    summaryLoading.value = false
  }
}

async function fetchTrends() {
  trendsLoading.value = true
  try {
    const { data } = await axios.get<TrendPoint[]>('/api/dashboard/trends', {
      params: { months: trendMonths.value },
    })
    trends.value = data
  } catch {
    //
  } finally {
    trendsLoading.value = false
  }
}

async function fetchDivisionBreakdown() {
  if (!selectedPeriod.value) return
  divisionLoading.value = true
  try {
    const { data } = await axios.get<DivisionBreakdown[]>('/api/dashboard/division-breakdown', {
      params: { month: selectedPeriod.value.month, year: selectedPeriod.value.year },
    })
    divisionBreakdown.value = data
  } catch {
    //
  } finally {
    divisionLoading.value = false
  }
}

async function fetchDtrStats() {
  if (!selectedPeriod.value) return
  dtrLoading.value = true
  try {
    const { data } = await axios.get<DtrStats>('/api/dashboard/dtr-stats', {
      params: { month: selectedPeriod.value.month, year: selectedPeriod.value.year },
    })
    dtrStats.value = data
  } catch {
    //
  } finally {
    dtrLoading.value = false
  }
}

function onPeriodChange() {
  fetchSummary()
  fetchDivisionBreakdown()
  fetchDtrStats()
}

function changeTrendRange(months: number) {
  trendMonths.value = months
  fetchTrends()
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function fmt(v: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 0,
  }).format(v)
}

function fmtCompact(v: number) {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `₱${(v / 1_000).toFixed(0)}K`
  return `₱${v}`
}

function fmtMinutes(v: number) {
  if (v <= 0) return '0m'
  const hrs = Math.floor(v / 60)
  const min = v % 60
  return hrs > 0 ? `${hrs}h ${min}m` : `${min}m`
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
onMounted(async () => {
  fetchDashboard()
  fetchCalendar()
  fetchTrends()

  await fetchPayrollRuns()
  if (periodOptions.value.length) {
    selectedPeriodKey.value = periodOptions.value[0].value // most recent period with data
    onPeriodChange()
  }
})
</script>

<template>
  <VContainer fluid class="pa-6">

    <!-- ── Page Header ── -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-6">
      <div>
        <h4 class="text-h5 font-weight-bold mb-1">Dashboard</h4>
        <p class="text-body-2 text-medium-emphasis mb-0">
          JO Payroll System overview
        </p>
      </div>

      <!-- NEW: Payroll Period Selector — drives Summary / Division Breakdown / DTR Overview -->
      <VSelect
        v-model="selectedPeriodKey"
        label="Payroll Period"
        :items="periodOptions"
        item-title="title"
        item-value="value"
        variant="outlined"
        density="compact"
        prepend-inner-icon="mdi-calendar-month-outline"
        :loading="periodsLoading"
        hide-details
        style="min-width: 260px; max-width: 320px;"
        :no-data-text="periodsLoading ? 'Loading...' : 'No payroll periods found'"
        @update:model-value="onPeriodChange"
      >
        <template #item="{ props, item }">
          <VListItem v-bind="props" :title="item.raw.title">
            <template #title>
              <span class="text-body-2 font-weight-medium">{{ item.raw.title }}</span>
            </template>
            <template #subtitle>
              <span class="text-caption text-medium-emphasis">{{ item.raw.subtitle }}</span>
            </template>
          </VListItem>
        </template>
        <template #selection="{ item }">
          <span class="text-body-2 font-weight-medium">{{ item.raw.title }}</span>
        </template>
      </VSelect>
    </div>

    <!-- NEW: empty state — no payroll data exists for any period yet -->
    <VAlert
      v-if="!periodsLoading && periodOptions.length === 0"
      type="info"
      variant="tonal"
      density="compact"
      icon="mdi-information-outline"
      class="mb-6"
    >
      No payroll runs found yet. Payroll totals, division breakdown, and DTR stats will appear here once a payroll run has been created.
    </VAlert>

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
                Net Pay — {{ selectedPeriodLabel }}
              </div>
              <div class="text-h5 font-weight-bold mt-1">
                {{ summaryLoading ? '…' : (summary?.total_net ? fmt(summary.total_net) : '—') }}
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
                Pending Payroll Runs
              </div>
              <div class="text-h5 font-weight-bold mt-1">
                {{ summaryLoading ? '…' : (summary?.pending_runs ?? 0) }}
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

      <!-- ── NEW: Payroll Trends ── -->
      <VCol cols="12">
        <VCard rounded="lg" border flat>
          <VCardText class="pa-5">
            <div class="d-flex align-center justify-space-between mb-4 flex-wrap gap-3">
              <div>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
                  Payroll Trends
                </p>
                <p class="text-h6 font-weight-bold mb-0">Gross, Deductions &amp; Net Pay</p>
              </div>
              <div class="d-flex gap-2">
                <VBtn
                  v-for="m in [3, 6, 12]"
                  :key="m"
                  :variant="trendMonths === m ? 'tonal' : 'text'"
                  :color="trendMonths === m ? 'primary' : 'default'"
                  size="small"
                  @click="changeTrendRange(m)"
                >
                  {{ m }}mo
                </VBtn>
              </div>
            </div>

            <div v-if="trendsLoading" class="d-flex justify-center py-10">
              <VProgressCircular indeterminate color="primary" />
            </div>
            <VueApexCharts
              v-else
              type="area"
              height="320"
              :options="trendChartOptions"
              :series="trendChartSeries"
            />
          </VCardText>
        </VCard>
      </VCol>

      <!-- ── NEW: Division Breakdown ── -->
      <VCol cols="12" md="5">
        <VCard rounded="lg" border flat style="height: 100%;">
          <VCardText class="pa-5">
            <div class="d-flex align-center justify-space-between mb-4">
              <div>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
                  Headcount by Division
                </p>
                <p class="text-body-2 text-medium-emphasis mb-0">{{ selectedPeriodLabel }}</p>
              </div>
              <VAvatar color="primary" variant="tonal" size="40" rounded="lg">
                <VIcon icon="mdi-office-building-outline" size="20" />
              </VAvatar>
            </div>

            <div v-if="divisionLoading" class="d-flex justify-center py-10">
              <VProgressCircular indeterminate color="primary" />
            </div>
            <div v-else-if="divisionBreakdown.length === 0" class="text-center py-10">
              <p class="text-body-2 text-medium-emphasis mb-0">No payroll data for this period</p>
            </div>
            <VueApexCharts
              v-else
              type="donut"
              height="300"
              :options="divisionChartOptions"
              :series="divisionChartSeries"
            />
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="7">
        <VCard rounded="lg" border flat style="height: 100%;">
          <VCardText class="pa-5">
            <div class="d-flex align-center justify-space-between mb-4">
              <div>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
                  Payroll Cost by Division
                </p>
                <p class="text-body-2 text-medium-emphasis mb-0">{{ selectedPeriodLabel }}</p>
              </div>
              <VAvatar color="success" variant="tonal" size="40" rounded="lg">
                <VIcon icon="mdi-cash-multiple" size="20" />
              </VAvatar>
            </div>

            <div v-if="divisionLoading" class="d-flex justify-center py-10">
              <VProgressCircular indeterminate color="primary" />
            </div>
            <div v-else-if="divisionBreakdown.length === 0" class="text-center py-10">
              <p class="text-body-2 text-medium-emphasis mb-0">No payroll data for this period</p>
            </div>
            <VTable v-else density="comfortable">
              <thead>
                <tr>
                  <th>Division</th>
                  <th class="text-right">Employees</th>
                  <th class="text-right">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in divisionBreakdown" :key="row.division_name">
                  <td>{{ row.division_name }}</td>
                  <td class="text-right">{{ row.employee_count }}</td>
                  <td class="text-right font-weight-medium">{{ fmt(row.total_net) }}</td>
                </tr>
              </tbody>
            </VTable>
          </VCardText>
        </VCard>
      </VCol>

      <!-- ── NEW: DTR Overview ── -->
      <VCol cols="12">
        <VCard rounded="lg" border flat>
          <VCardText class="pa-5">
            <div class="d-flex align-center justify-space-between mb-4">
              <div>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
                  DTR Overview
                </p>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  Attendance issues for {{ selectedPeriodLabel }}
                </p>
              </div>
              <VAvatar color="warning" variant="tonal" size="40" rounded="lg">
                <VIcon icon="mdi-timer-alert-outline" size="20" />
              </VAvatar>
            </div>

            <div v-if="dtrLoading" class="d-flex justify-center py-10">
              <VProgressCircular indeterminate color="primary" />
            </div>

            <template v-else-if="dtrStats">
              <VRow class="mb-4">
                <VCol cols="6" sm="3">
                  <div class="text-caption text-medium-emphasis mb-1">Total Absent Days</div>
                  <div class="text-h6 font-weight-bold">{{ dtrStats.overall.total_absent_days }}</div>
                </VCol>
                <VCol cols="6" sm="3">
                  <div class="text-caption text-medium-emphasis mb-1">Total Late</div>
                  <div class="text-h6 font-weight-bold">{{ fmtMinutes(dtrStats.overall.total_late_minutes) }}</div>
                </VCol>
                <VCol cols="6" sm="3">
                  <div class="text-caption text-medium-emphasis mb-1">Total Undertime</div>
                  <div class="text-h6 font-weight-bold">{{ fmtMinutes(dtrStats.overall.total_undertime_minutes) }}</div>
                </VCol>
                <VCol cols="6" sm="3">
                  <div class="text-caption text-medium-emphasis mb-1">Avg Late / Employee</div>
                  <div class="text-h6 font-weight-bold">{{ fmtMinutes(Math.round(dtrStats.overall.avg_late_minutes)) }}</div>
                </VCol>
              </VRow>

              <VDivider class="mb-4" />

              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-2">
                Most Tardy Employees
              </p>
              <div v-if="dtrStats.top_late.length === 0" class="text-center py-6">
                <VAvatar color="success" variant="tonal" size="44" rounded="lg" class="mb-2">
                  <VIcon icon="mdi-check-circle-outline" size="22" />
                </VAvatar>
                <p class="text-body-2 text-medium-emphasis mb-0">No late records this period</p>
              </div>
              <VTable v-else density="comfortable">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Division</th>
                    <th class="text-right">Late</th>
                    <th class="text-right">Absent Days</th>
                    <th class="text-right">Undertime</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in dtrStats.top_late" :key="row.emp_id">
                    <td>{{ row.emp_name }}</td>
                    <td>{{ row.division_name }}</td>
                    <td class="text-right">{{ fmtMinutes(row.total_late_minutes) }}</td>
                    <td class="text-right">{{ row.total_absent_days }}</td>
                    <td class="text-right">{{ fmtMinutes(row.total_undertime_minutes) }}</td>
                  </tr>
                </tbody>
              </VTable>
            </template>
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
