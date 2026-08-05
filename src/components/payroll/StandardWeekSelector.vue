<script setup lang="ts">
import { toISODate } from '@/composable/usePayrollCalendar';
import axios from '@axios';

const props = defineProps<{
  modelValue: string[]   // selected week_start ISO dates (Mondays)
  disabled?:  boolean
  color?:     string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string[]): void
}>()

const DAY_NAMES   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const today     = new Date()
const viewYear  = ref(today.getFullYear())
const viewMonth = ref(today.getMonth() + 1)

const monthLabel = computed(() => `${MONTH_NAMES[viewMonth.value - 1]} ${viewYear.value}`)

/* ─────────────────────────────────────────
   GLOBAL WEEK SCHEDULE — READ ONLY
   This component never mutates week_schedules. It only reads the
   current office-wide CMP/STD state so it knows which weeks are
   eligible to be marked Standard for this batch.
───────────────────────────────────────── */
const weekScheduleMap = ref<Record<string, { is_compressed: boolean }>>({})
const loadingSchedule = ref(false)

async function fetchWeekSchedules(year: number, month: number) {
  loadingSchedule.value = true
  try {
    const { data } = await axios.get('/api/week-schedules', { params: { year, month } })
    const map: Record<string, { is_compressed: boolean }> = {}
    for (const row of data.data ?? []) map[row.week_start] = { is_compressed: row.is_compressed }
    weekScheduleMap.value = map
  } catch {
    // non-fatal
  } finally {
    loadingSchedule.value = false
  }
}

onMounted(() => fetchWeekSchedules(viewYear.value, viewMonth.value))

function isWeekCompressed(weekStart: string): boolean {
  return weekScheduleMap.value[weekStart]?.is_compressed ?? false
}

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
  await fetchWeekSchedules(viewYear.value, viewMonth.value)
}
async function nextMonth() {
  if (viewMonth.value === 12) { viewMonth.value = 1; viewYear.value++ }
  else viewMonth.value++
  await fetchWeekSchedules(viewYear.value, viewMonth.value)
}

function isSelected(weekStart: string): boolean {
  return props.modelValue.includes(weekStart)
}

function toggleWeek(week: Week) {
  if (props.disabled || !week.weekStart) return
  const selected = isSelected(week.weekStart)
  // Can only newly select weeks that are currently Compressed —
  // nothing to exempt on an already-Standard week. Already-selected
  // weeks can always be unmarked, even if the global schedule changed
  // out from under this batch afterward.
  if (!selected && !week.isCompressed) return

  emit('update:modelValue', selected
    ? props.modelValue.filter(w => w !== week.weekStart)
    : [...props.modelValue, week.weekStart])
}

// Jump the calendar to the earliest selected week when editing an
// existing batch (so its weeks are visible without manual navigation).
watch(() => props.modelValue, (val) => {
  if (val.length && !weeks.value.some(w => val.includes(w.weekStart))) {
    const anchor = new Date(val[0] + 'T00:00:00')
    viewYear.value  = anchor.getFullYear()
    viewMonth.value = anchor.getMonth() + 1
    fetchWeekSchedules(viewYear.value, viewMonth.value)
  }
}, { immediate: true })
</script>

<template>
  <div class="sws-wrap">
    <div class="d-flex align-center justify-space-between mb-2">
      <VBtn icon="mdi-chevron-left" size="x-small" variant="text" @click="prevMonth" />
      <span class="text-body-2 font-weight-medium">{{ monthLabel }}</span>
      <VBtn icon="mdi-chevron-right" size="x-small" variant="text" @click="nextMonth" />
    </div>

    <div class="sws-grid sws-grid--header">
      <span class="sws-week-gutter-header" />
      <span v-for="d in DAY_NAMES" :key="d" class="sws-daylabel">{{ d }}</span>
    </div>

    <VProgressLinear v-if="loadingSchedule" indeterminate :color="color ?? 'indigo'" height="2" class="mb-1" />

    <div class="sws-weeks">
      <div v-for="(week, wIdx) in weeks" :key="wIdx" class="sws-week-row">
        <div
          v-if="week.hasMonday"
          class="sws-week-label"
          :class="[
            isSelected(week.weekStart)
              ? 'sws-week-label--selected'
              : (week.isCompressed ? 'sws-week-label--cmp' : 'sws-week-label--std'),
            (!week.isCompressed && !isSelected(week.weekStart)) ? 'sws-week-label--locked' : '',
          ]"
          :title="isSelected(week.weekStart)
            ? 'Marked Standard for this batch. Click to unmark.'
            : week.isCompressed
              ? 'Currently Compressed. Click to mark Standard for this batch.'
              : 'Already Standard — nothing to exempt.'"
          @click="toggleWeek(week)"
        >
          {{ isSelected(week.weekStart) ? 'STD' : (week.isCompressed ? 'CMP' : 'STD') }}
          <VIcon v-if="isSelected(week.weekStart)" size="9" class="sws-check">mdi-check</VIcon>
        </div>
        <div v-else class="sws-week-label-empty" />

        <div
          v-for="(cell, cIdx) in week.cells"
          :key="cIdx"
          class="sws-cell"
          :class="{
            'sws-cell--empty':    !cell.date,
            'sws-cell--weekend':  cell.date && (cell.dow === 0 || cell.dow === 6),
            'sws-cell--selected': cell.date && isSelected(week.weekStart),
          }"
        >
          <span v-if="cell.date">{{ cell.date.getDate() }}</span>
        </div>
      </div>
    </div>

    <p class="text-caption text-medium-emphasis mt-2 mb-0">
      Click a <strong>CMP</strong> week to mark it Standard for this batch. Click again to unmark.
    </p>

    <VChip v-if="modelValue.length" size="small" :color="color ?? 'indigo'" variant="tonal" class="mt-2">
      {{ modelValue.length }} week{{ modelValue.length !== 1 ? 's' : '' }} selected
    </VChip>
  </div>
</template>

<style scoped>
.sws-grid { display: grid; grid-template-columns: 30px repeat(7, 1fr); gap: 2px; }
.sws-grid--header { margin-bottom: 2px; }
.sws-daylabel {
  text-align: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-color-secondary, rgba(var(--v-theme-on-surface), 0.6));
}
.sws-weeks { display: flex; flex-direction: column; gap: 2px; }
.sws-week-row {
  display: grid;
  grid-template-columns: 30px repeat(7, 1fr);
  gap: 2px;
  align-items: stretch;
}
.sws-week-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 0.52rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  border-radius: 5px;
  user-select: none;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.sws-week-label:hover { opacity: 0.8; transform: scale(1.05); }
.sws-week-label--std {
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.sws-week-label--cmp {
  background: rgba(156, 39, 176, 0.1);
  color: #9c27b0;
}
.sws-week-label--selected {
  background: rgb(var(--v-theme-success));
  color: white;
}
.sws-week-label--locked { cursor: default; }
.sws-week-label--locked:hover { opacity: 1; transform: none; }
.sws-week-label-empty { border-radius: 5px; }
.sws-check { margin-left: 1px; }

.sws-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  border-radius: 6px;
  color: var(--text-color);
}
.sws-cell--weekend { background: rgba(var(--v-theme-on-surface), 0.04); }
.sws-cell--selected { background: rgba(var(--v-theme-success), 0.14); }
</style>
