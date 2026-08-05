<script setup lang="ts">
import { toISODate, usePayrollCalendar } from '@/composable/usePayrollCalendar';
import axios from '@axios';

/* ─────────────────────────────────────────
   PROPS / EMITS
───────────────────────────────────────── */
const props = defineProps<{
  startDate:      string
  endDate:        string
  label?:         string
  color?:         string
  disabled?:      boolean
  errorMessages?: string | string[]
}>()

const emit = defineEmits<{
  (e: 'update:startDate', v: string): void
  (e: 'update:endDate', v: string): void
  (e: 'schedule-updated', weekStart: string, isCompressed: boolean): void
}>()

const { fetchMonth, getDateInfo } = usePayrollCalendar()

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const menuOpen   = ref(false)
const isDragging = ref(false)
const dragStart  = ref<string | null>(null)
const dragEnd    = ref<string | null>(null)

const DAY_NAMES   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const today     = new Date()
const viewYear  = ref(today.getFullYear())
const viewMonth = ref(today.getMonth() + 1)

const monthLabel = computed(() => `${MONTH_NAMES[viewMonth.value - 1]} ${viewYear.value}`)

/* ─────────────────────────────────────────
   WEEK SCHEDULES (STD/CMP toggle)
───────────────────────────────────────── */
const weekScheduleMap         = ref<Record<string, { is_compressed: boolean; is_manual_override: boolean }>>({})
const scheduleOverrideLoading = ref<string | null>(null)

async function fetchWeekSchedules(year: number, month: number) {
  try {
    const { data } = await axios.get('/api/week-schedules', { params: { year, month } })
    const map: Record<string, { is_compressed: boolean; is_manual_override: boolean }> = {}
    for (const row of data.data ?? []) {
      map[row.week_start] = { is_compressed: row.is_compressed, is_manual_override: row.is_manual_override }
    }
    weekScheduleMap.value = map
  } catch {
    // non-fatal
  }
}

function isWeekCompressed(weekStart: string): boolean {
  return weekScheduleMap.value[weekStart]?.is_compressed ?? false
}

async function toggleWeekSchedule(weekStart: string, currentIsCompressed: boolean) {
  if (scheduleOverrideLoading.value) return
  if (!currentIsCompressed) return   // guard: only allow flipping CMP → STD from this picker
  scheduleOverrideLoading.value = weekStart
  try {
    await axios.post(`/api/week-schedules/override/${weekStart}`, { is_compressed: false })
    weekScheduleMap.value = {
      ...weekScheduleMap.value,
      [weekStart]: { is_compressed: false, is_manual_override: true },
    }
    emit('schedule-updated', weekStart, false)
  } catch {
    // non-fatal — leave state as-is
  } finally {
    scheduleOverrideLoading.value = null
  }
}

async function clearWeekOverride(weekStart: string) {
  if (scheduleOverrideLoading.value) return
  if (!weekScheduleMap.value[weekStart]?.is_manual_override) return
  scheduleOverrideLoading.value = weekStart
  try {
    const { data } = await axios.post(`/api/week-schedules/clear-override/${weekStart}`)
    if (data.data) {
      weekScheduleMap.value = { ...weekScheduleMap.value, [weekStart]: { is_compressed: data.data.is_compressed, is_manual_override: false } }
      emit('schedule-updated', weekStart, data.data.is_compressed)
    } else {
      const { [weekStart]: _removed, ...rest } = weekScheduleMap.value
      weekScheduleMap.value = rest
    }
  } catch {
    // non-fatal
  } finally {
    scheduleOverrideLoading.value = null
  }
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function fullDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

const displayText = computed(() => {
  if (!props.startDate) return ''
  if (!props.endDate || props.endDate === props.startDate) return fullDisplay(props.startDate)
  return `${fullDisplay(props.startDate)} → ${fullDisplay(props.endDate)}`
})

interface Cell { date: Date | null; iso: string; dow: number }
interface Week { cells: Cell[]; isCompressed: boolean; weekStart: string; hasMonday: boolean }

function buildWeeks(year: number, month: number): Week[] {
  const first    = new Date(year, month - 1, 1)
  const last     = new Date(year, month, 0)
  const startDow = first.getDay()
  const days     = last.getDate()

  const allCells: Cell[] = []
  for (let i = 0; i < startDow; i++) allCells.push({ date: null, iso: '', dow: i })
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month - 1, d)
    allCells.push({ date, iso: toISODate(date), dow: date.getDay() })
  }
  while (allCells.length % 7 !== 0) allCells.push({ date: null, iso: '', dow: allCells.length % 7 })

  const weeks: Week[] = []
  for (let i = 0; i < allCells.length; i += 7) {
    const cells = allCells.slice(i, i + 7)

    let weekStart = ''
    const anchorCell = cells.find(c => c.date && c.date.getDay() !== 0) ?? cells.find(c => c.date)
    if (anchorCell?.date) {
      const d   = new Date(anchorCell.date)
      const dow = d.getDay()
      d.setDate(d.getDate() - (dow - 1))
      weekStart = toISODate(d)
    }

    const isCompressed = weekStart ? isWeekCompressed(weekStart) : false
    const hasMonday     = cells.some(c => c.date && c.date.getDay() === 1)

    weeks.push({ cells, isCompressed, weekStart, hasMonday })
  }

  return weeks
}

const weeks = computed<Week[]>(() => buildWeeks(viewYear.value, viewMonth.value))

async function prevMonth() {
  if (viewMonth.value === 1) { viewMonth.value = 12; viewYear.value-- }
  else viewMonth.value--
  await Promise.all([fetchMonth(viewYear.value, viewMonth.value), fetchWeekSchedules(viewYear.value, viewMonth.value)])
}
async function nextMonth() {
  if (viewMonth.value === 12) { viewMonth.value = 1; viewYear.value++ }
  else viewMonth.value++
  await Promise.all([fetchMonth(viewYear.value, viewMonth.value), fetchWeekSchedules(viewYear.value, viewMonth.value)])
}

/* ─────────────────────────────────────────
   MENU LIFECYCLE
───────────────────────────────────────── */
watch(menuOpen, async (open) => {
  if (!open) return
  dragStart.value = props.startDate || null
  dragEnd.value   = props.endDate || props.startDate || null

  // Jump the calendar to the currently selected start date (or today)
  const anchor = props.startDate ? new Date(props.startDate + 'T00:00:00') : today
  viewYear.value  = anchor.getFullYear()
  viewMonth.value = anchor.getMonth() + 1

  await Promise.all([fetchMonth(viewYear.value, viewMonth.value), fetchWeekSchedules(viewYear.value, viewMonth.value)])
})

/* ─────────────────────────────────────────
   SELECTION / DRAG HANDLERS
───────────────────────────────────────── */
function inRange(iso: string): boolean {
  if (!dragStart.value) return false
  const end        = dragEnd.value ?? dragStart.value
  const [from, to] = dragStart.value <= end ? [dragStart.value, end] : [end, dragStart.value]
  return iso >= from && iso <= to
}

function isRangeEdge(iso: string): boolean {
  if (!dragStart.value) return false
  const end = dragEnd.value ?? dragStart.value
  return iso === dragStart.value || iso === end
}

function onCellMouseDown(cell: Cell) {
  if (!cell.date || props.disabled) return
  isDragging.value = true
  dragStart.value  = cell.iso
  dragEnd.value    = cell.iso
}

function onCellMouseEnter(cell: Cell) {
  if (!isDragging.value || !cell.date) return
  dragEnd.value = cell.iso
}

function stopDragging() { isDragging.value = false }

onMounted(() => document.addEventListener('mouseup', stopDragging))
onUnmounted(() => document.removeEventListener('mouseup', stopDragging))

/* ─────────────────────────────────────────
   CONFIRM / CANCEL
───────────────────────────────────────── */
function confirmSelection() {
  if (!dragStart.value) return
  const end        = dragEnd.value ?? dragStart.value
  const [from, to] = dragStart.value <= end ? [dragStart.value, end] : [end, dragStart.value]
  emit('update:startDate', from)
  emit('update:endDate', to)
  menuOpen.value = false
}

function cancelSelection() { menuOpen.value = false }
</script>

<template>
  <VMenu
    v-model="menuOpen"
    :close-on-content-click="false"
    location="bottom start"
    :disabled="disabled"
  >
    <template #activator="{ props: menuProps }">
      <VTextField
        v-bind="menuProps"
        :model-value="displayText"
        :label="label ?? 'Date Range'"
        placeholder="Pick a date range"
        readonly
        variant="outlined"
        density="compact"
        prepend-inner-icon="mdi-calendar-range-outline"
        append-inner-icon="mdi-menu-down"
        :disabled="disabled"
        :error-messages="errorMessages"
        hide-details="auto"
      />
    </template>

    <VCard rounded="lg" min-width="340" max-width="360" @mouseleave="stopDragging">
      <VCardText class="pa-3 pb-2">
        <div class="d-flex align-center justify-space-between mb-2">
          <VBtn icon="mdi-chevron-left" size="x-small" variant="text" @click="prevMonth" />
          <span class="text-body-2 font-weight-medium">{{ monthLabel }}</span>
          <VBtn icon="mdi-chevron-right" size="x-small" variant="text" @click="nextMonth" />
        </div>

        <div class="drp-grid drp-grid--header">
          <span class="drp-week-gutter-header" />
          <span v-for="d in DAY_NAMES" :key="d" class="drp-daylabel">{{ d }}</span>
        </div>

        <div class="drp-weeks">
          <div v-for="(week, wIdx) in weeks" :key="wIdx" class="drp-week-row">
            <div
                v-if="week.hasMonday"
                class="drp-week-label"
                :class="[
                    week.isCompressed ? 'drp-week-label--cmp' : 'drp-week-label--std',
                    !week.isCompressed ? 'drp-week-label--locked' : '',
                    scheduleOverrideLoading === week.weekStart ? 'drp-week-label--saving' : '',
                    weekScheduleMap[week.weekStart]?.is_manual_override ? 'drp-week-label--override' : '',
                ]"
                :title="week.isCompressed
                    ? 'Compressed: Mon–Thu, 7am–6pm\nClick to switch this week to Standard.'
                    + (weekScheduleMap[week.weekStart]?.is_manual_override ? '\n⚠ Manual override active' : '')
                    : 'Standard: Mon–Fri, 8am–5pm'
                    + (weekScheduleMap[week.weekStart]?.is_manual_override ? ' (manual override — right-click to reset)' : '')"
                @click="week.weekStart && week.isCompressed && toggleWeekSchedule(week.weekStart, week.isCompressed)"
                @contextmenu.prevent="week.weekStart && weekScheduleMap[week.weekStart]?.is_manual_override && clearWeekOverride(week.weekStart)"
                >
                <span v-if="scheduleOverrideLoading === week.weekStart" class="drp-week-saving">…</span>
                <template v-else>
                    {{ week.isCompressed ? 'CMP' : 'STD' }}
                    <span
                    v-if="weekScheduleMap[week.weekStart]?.is_manual_override"
                    class="drp-week-override-dot"
                    title="Manual override active"
                    />
                </template>
                </div>
            <div v-else class="drp-week-label-empty" />

            <div
              v-for="(cell, cIdx) in week.cells"
              :key="cIdx"
              class="drp-cell"
              :class="{
                'drp-cell--empty':      !cell.date,
                'drp-cell--weekend':    cell.date && (cell.dow === 0 || cell.dow === 6),
                'drp-cell--holiday':    cell.date && !!getDateInfo(cell.iso).holiday,
                'drp-cell--suspension': cell.date && !!getDateInfo(cell.iso).suspension,
                'drp-cell--selected':   cell.date && inRange(cell.iso),
                'drp-cell--edge':       cell.date && isRangeEdge(cell.iso),
              }"
              @mousedown="onCellMouseDown(cell)"
              @mouseenter="onCellMouseEnter(cell)"
            >
              <span v-if="cell.date">{{ cell.date.getDate() }}</span>
            </div>
          </div>
        </div>

        <VAlert v-if="dragStart" density="compact" variant="tonal" :color="color ?? 'indigo'" class="mt-3 text-caption">
          {{ fullDisplay(dragStart) }}
          <template v-if="(dragEnd ?? dragStart) !== dragStart"> → {{ fullDisplay(dragEnd ?? dragStart) }}</template>
        </VAlert>

        <p class="text-caption text-medium-emphasis mt-2 mb-0">
        Click-and-drag to select a date range. Click a <strong>CMP</strong> tag to switch that week to Standard.
        </p>
      </VCardText>

      <VDivider />
      <VCardActions class="justify-end pa-2">
        <VBtn size="small" variant="text" @click="cancelSelection">Cancel</VBtn>
        <VBtn size="small" :color="color ?? 'indigo'" variant="tonal" :disabled="!dragStart" @click="confirmSelection">
          Confirm
        </VBtn>
      </VCardActions>
    </VCard>
  </VMenu>
</template>

<style scoped>
.drp-grid {
  display: grid;
  grid-template-columns: 30px repeat(7, 1fr);
  gap: 2px;
}
.drp-grid--header { margin-bottom: 2px; }
.drp-week-gutter-header { }
.drp-daylabel {
  text-align: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-color-secondary, rgba(var(--v-theme-on-surface), 0.6));
}

.drp-weeks {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.drp-week-row {
  display: grid;
  grid-template-columns: 30px repeat(7, 1fr);
  gap: 2px;
  align-items: stretch;
}

.drp-week-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 0.52rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  border-radius: 5px;
  user-select: none;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.drp-week-label:hover { opacity: 0.8; transform: scale(1.05); }

.drp-week-label--std {
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.drp-week-label--cmp {
  background: rgba(156, 39, 176, 0.1);
  color: #9c27b0;
}
.drp-week-label--locked {
  cursor: default;
}
.drp-week-label--locked:hover {
  opacity: 1;
  transform: none;
}
.drp-week-label--saving { opacity: 0.5; pointer-events: none; }
.drp-week-label--override {
  outline: 2px solid rgba(251, 140, 0, 0.8);
  outline-offset: 1px;
}
.drp-week-saving { font-size: 0.6rem; color: var(--text-color-secondary); }
.drp-week-override-dot {
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #fb8c00;
  margin: 1px auto 0;
}
.drp-week-label-empty { border-radius: 5px; }

.drp-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition: background 0.1s ease;
}
.drp-cell--empty     { cursor: default; }
.drp-cell--weekend    { background: rgba(var(--v-theme-on-surface), 0.04); }
.drp-cell--holiday    { background: rgba(var(--v-theme-error), 0.12); }
.drp-cell--suspension { background: rgba(var(--v-theme-success), 0.12); }
.drp-cell--selected {
  background: rgba(var(--v-theme-primary), 0.18);
  font-weight: 600;
}
.drp-cell--edge {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-weight: 700;
}
.drp-cell:not(.drp-cell--empty):hover {
  background: rgba(var(--v-theme-primary), 0.28);
}
</style>
