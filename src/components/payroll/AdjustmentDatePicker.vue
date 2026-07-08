<script setup lang="ts">
import { formatDisplayDate, toISODate, usePayrollCalendar } from '@/composable/usePayrollCalendar';
import axios from '@axios';

/* ─────────────────────────────────────────
   PROPS / EMITS
───────────────────────────────────────── */
const props = defineProps<{
  type:          'pass_slip' | 'official_travel' | 'leave' | ''
  periodMonth:   number
  periodYear:    number
  date:          string
  dateTo:        string | null
  disabled?:     boolean
  errorMessages?: string | string[]
}>()

const emit = defineEmits<{
  (e: 'update:date', v: string): void
  (e: 'update:dateTo', v: string | null): void
}>()

/* ─────────────────────────────────────────
   SHARED CALENDAR DATA (holidays / suspensions)
───────────────────────────────────────── */
const { fetchMonth, getDateInfo } = usePayrollCalendar()

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const menuOpen        = ref(false)
const isDragging       = ref(false)
const dragStart        = ref<string | null>(null)
const dragEnd          = ref<string | null>(null)
const weekScheduleMap  = ref<Record<string, { is_compressed: boolean }>>({})

const DAY_NAMES   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const isRangeType = computed(() => props.type !== 'pass_slip' && !!props.type)

const monthLabel = computed(() => `${MONTH_NAMES[props.periodMonth - 1]} ${props.periodYear}`)

const typeLabel = computed(() => {
  if (props.type === 'pass_slip')       return 'Pass Slip'
  if (props.type === 'official_travel') return 'Official Travel'
  if (props.type === 'leave')           return 'Leave'
  return 'Select a type first'
})

const typeColor = computed(() => {
  if (props.type === 'pass_slip')       return 'orange'
  if (props.type === 'official_travel') return 'blue'
  if (props.type === 'leave')           return 'teal'
  return 'grey'
})

const displayText = computed(() => {
  if (!props.date) return ''
  if (!isRangeType.value) return formatDisplayDate(props.date)
  if (!props.dateTo || props.dateTo === props.date) return formatDisplayDate(props.date)
  return `${formatDisplayDate(props.date)} → ${formatDisplayDate(props.dateTo)}`
})

interface Cell { date: Date | null; iso: string; dow: number }

const cells = computed<Cell[]>(() => {
  const year  = props.periodYear
  const month = props.periodMonth
  if (!year || !month) return []

  const first    = new Date(year, month - 1, 1)
  const last     = new Date(year, month, 0)
  const startDow = first.getDay()
  const days     = last.getDate()

  const arr: Cell[] = []
  for (let i = 0; i < startDow; i++) arr.push({ date: null, iso: '', dow: i })
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month - 1, d)
    arr.push({ date, iso: toISODate(date), dow: date.getDay() })
  }
  while (arr.length % 7 !== 0) arr.push({ date: null, iso: '', dow: arr.length % 7 })
  return arr
})

const rangeSummary = computed(() => {
  if (!isRangeType.value || !dragStart.value) return null
  const end       = dragEnd.value ?? dragStart.value
  const [from, to] = dragStart.value <= end ? [dragStart.value, end] : [end, dragStart.value]

  let days            = 0
  let compressedMins  = 0
  const cursor = new Date(from + 'T00:00:00')
  const toDate = new Date(to + 'T00:00:00')

  while (cursor <= toDate) {
    const iso = toISODate(cursor)
    days++
    const dow = cursor.getDay()
    if (isCompressedDate(iso) && dow >= 1 && dow <= 4) compressedMins += 120
    cursor.setDate(cursor.getDate() + 1)
  }

  return { from, to, days, compressedMins }
})

/* ─────────────────────────────────────────
   WEEK SCHEDULE (compressed week lookup)
───────────────────────────────────────── */
async function fetchWeekSchedules() {
  try {
    const { data } = await axios.get('/api/week-schedules', {
      params: { year: props.periodYear, month: props.periodMonth },
    })
    const map: Record<string, { is_compressed: boolean }> = {}
    for (const row of data.data ?? []) map[row.week_start] = { is_compressed: row.is_compressed }
    weekScheduleMap.value = map
  } catch {
    // non-fatal — informational only
  }
}

function mondayOf(dateStr: string): string {
  const d   = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  return toISODate(d)
}

function isCompressedDate(iso: string): boolean {
  return weekScheduleMap.value[mondayOf(iso)]?.is_compressed ?? false
}

/* ─────────────────────────────────────────
   MENU LIFECYCLE
───────────────────────────────────────── */
watch(menuOpen, async (open) => {
  if (!open) return
  dragStart.value = props.date || null
  dragEnd.value   = props.dateTo || props.date || null
  await Promise.all([
    fetchMonth(props.periodYear, props.periodMonth),
    fetchWeekSchedules(),
  ])
})

watch(() => [props.periodMonth, props.periodYear], () => {
  if (menuOpen.value) {
    fetchMonth(props.periodYear, props.periodMonth)
    fetchWeekSchedules()
  }
})

/* ─────────────────────────────────────────
   SELECTION / DRAG HANDLERS
───────────────────────────────────────── */
function inRange(iso: string): boolean {
  if (!dragStart.value) return false
  if (!isRangeType.value) return iso === dragStart.value
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
  if (!cell.date || props.disabled || !props.type) return

  if (!isRangeType.value) {
    // Pass slip — single click selects and confirms immediately
    dragStart.value = cell.iso
    dragEnd.value    = cell.iso
    confirmSelection()
    return
  }

  isDragging.value = true
  dragStart.value  = cell.iso
  dragEnd.value    = cell.iso
}

function onCellMouseEnter(cell: Cell) {
  if (!isDragging.value || !cell.date || !isRangeType.value) return
  dragEnd.value = cell.iso
}

function stopDragging() {
  isDragging.value = false
}

onMounted(() => document.addEventListener('mouseup', stopDragging))
onUnmounted(() => document.removeEventListener('mouseup', stopDragging))

/* ─────────────────────────────────────────
   CONFIRM / CANCEL
───────────────────────────────────────── */
function confirmSelection() {
  if (!dragStart.value) return
  const end        = dragEnd.value ?? dragStart.value
  const [from, to] = dragStart.value <= end ? [dragStart.value, end] : [end, dragStart.value]

  emit('update:date', from)
  emit('update:dateTo', isRangeType.value ? to : null)
  menuOpen.value = false
}

function cancelSelection() {
  menuOpen.value = false
}
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
        :label="isRangeType ? 'Date Range' : 'Date'"
        placeholder="Pick a date"
        readonly
        variant="outlined"
        density="compact"
        prepend-inner-icon="mdi-calendar-outline"
        append-inner-icon="mdi-menu-down"
        :disabled="disabled"
        :error-messages="errorMessages"
        hide-details="auto"
      />
    </template>

    <VCard rounded="lg" min-width="300" max-width="320" @mouseleave="stopDragging">
      <VCardText class="pa-3 pb-2">
        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2 font-weight-medium">{{ monthLabel }}</span>
          <VChip size="x-small" variant="tonal" :color="typeColor" label>{{ typeLabel }}</VChip>
        </div>

        <div class="adp-grid adp-grid--header">
          <span v-for="d in DAY_NAMES" :key="d" class="adp-daylabel">{{ d }}</span>
        </div>

        <div class="adp-grid">
          <div
            v-for="(cell, i) in cells"
            :key="i"
            class="adp-cell"
            :class="{
              'adp-cell--empty':      !cell.date,
              'adp-cell--weekend':    cell.date && (cell.dow === 0 || cell.dow === 6),
              'adp-cell--holiday':    cell.date && !!getDateInfo(cell.iso).holiday,
              'adp-cell--suspension': cell.date && !!getDateInfo(cell.iso).suspension,
              'adp-cell--selected':   cell.date && inRange(cell.iso),
              'adp-cell--edge':       cell.date && isRangeEdge(cell.iso),
            }"
            @mousedown="onCellMouseDown(cell)"
            @mouseenter="onCellMouseEnter(cell)"
          >
            <span v-if="cell.date">{{ cell.date.getDate() }}</span>
          </div>
        </div>

        <VAlert
          v-if="isRangeType && rangeSummary"
          density="compact"
          variant="tonal"
          :color="typeColor"
          class="mt-3 text-caption"
        >
          {{ formatDisplayDate(rangeSummary.from) }}
          <template v-if="rangeSummary.to !== rangeSummary.from"> → {{ formatDisplayDate(rangeSummary.to) }}</template>
          · {{ rangeSummary.days }} day{{ rangeSummary.days !== 1 ? 's' : '' }}
          <template v-if="rangeSummary.compressedMins > 0">
            <br><VIcon size="12" class="mr-1">mdi-clock-minus-outline</VIcon>
            −{{ rangeSummary.compressedMins }} min (compressed week)
          </template>
        </VAlert>

        <p v-if="isRangeType" class="text-caption text-medium-emphasis mt-2 mb-0">
          Click-and-drag to select a date range.
        </p>
        <p v-else class="text-caption text-medium-emphasis mt-2 mb-0">
          Click a day to select it.
        </p>
      </VCardText>

      <template v-if="isRangeType">
        <VDivider />
        <VCardActions class="justify-end pa-2">
          <VBtn size="small" variant="text" @click="cancelSelection">Cancel</VBtn>
          <VBtn size="small" color="primary" variant="tonal" :disabled="!dragStart" @click="confirmSelection">
            Confirm
          </VBtn>
        </VCardActions>
      </template>
    </VCard>
  </VMenu>
</template>

<style scoped>
.adp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.adp-grid--header { margin-bottom: 2px; }

.adp-daylabel {
  text-align: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-color-secondary, rgba(var(--v-theme-on-surface), 0.6));
}

.adp-cell {
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

.adp-cell--empty    { cursor: default; }
.adp-cell--weekend   { background: rgba(var(--v-theme-on-surface), 0.04); }
.adp-cell--holiday   { background: rgba(var(--v-theme-error), 0.12); }
.adp-cell--suspension{ background: rgba(var(--v-theme-success), 0.12); }

.adp-cell--selected {
  background: rgba(var(--v-theme-primary), 0.18);
  font-weight: 600;
}

.adp-cell--edge {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-weight: 700;
}

.adp-cell:not(.adp-cell--empty):hover {
  background: rgba(var(--v-theme-primary), 0.28);
}
</style>
