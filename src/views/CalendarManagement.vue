<template>
  <div class="calendar-mgmt">
    <!-- ── Page Header ────────────────────────────────────────────── -->
    <div class="cm-page-header">
      <div>
        <h1 class="cm-page-title">
          <VIcon icon="mdi-calendar" class="cm-title-icon" />
          Calendar Management
        </h1>
      </div>

      <VBtn
        color="primary"
        prepend-icon="mdi-plus"
        class="cm-add-btn"
        @click="openAddDialog()"
      >
        Add Suspension Day
      </VBtn>
    </div>

    <!-- ── Main Layout ────────────────────────────────────────────── -->
    <div class="cm-layout">
      <!-- Left: Calendar -->
      <div class="cm-calendar-panel">
        <!-- Month Nav -->
        <div class="cm-month-nav">
          <VBtn icon="mdi-chevron-left" variant="text" @click="prevMonth" />
          <h2 class="cm-month-label">{{ monthLabel }}</h2>
          <VBtn icon="mdi-chevron-right" variant="text" @click="nextMonth" />
        </div>

        <!-- Day Headers -->
        <div class="cm-day-headers">
          <span v-for="name in DAY_NAMES" :key="name" class="cm-day-name">
            {{ name }}
          </span>
        </div>

        <!-- Grid -->
        <div class="cm-grid">
          <div
            v-for="(cell, idx) in calendarCells"
            :key="idx"
            class="cm-cell"
            :class="cellClasses(cell)"
            @click="cell.date && onCellClick(cell)"
          >
            <template v-if="cell.date">
              <span class="cm-cell-num">{{ cell.date.getDate() }}</span>

              <div class="cm-cell-badges">
                <VChip
                  v-if="cell.info.holiday"
                  size="x-small"
                  :color="cell.info.holiday.type === 'regular' ? 'red' : 'orange'"
                >
                  {{ cell.info.holiday.type === 'regular' ? 'RH' : 'SH' }}
                </VChip>

                <VChip
                  v-if="cell.info.suspension"
                  size="x-small"
                  color="green"
                >
                  SUSP
                </VChip>
              </div>
            </template>
          </div>
        </div>

        <!-- Legend -->
        <div class="cm-legend">
          <span class="cm-legend-item"><span class="cm-legend-dot cm-legend-dot--rh" /> Regular Holiday</span>
          <span class="cm-legend-item"><span class="cm-legend-dot cm-legend-dot--sh" /> Special Holiday</span>
          <span class="cm-legend-item"><span class="cm-legend-dot cm-legend-dot--susp" /> Suspension</span>
          <span class="cm-legend-item"><span class="cm-legend-dot cm-legend-dot--today" /> Today</span>
          <span class="cm-legend-item"><span class="cm-legend-dot cm-legend-dot--weekend" /> Weekend</span>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="cm-sidebar">
        <div class="cm-card">
          <h3 class="cm-card-title">{{ monthLabel }} Summary</h3>

          <div class="cm-stats-grid">
            <div class="cm-stat">
              <span class="cm-stat-value">{{ summary.regularHolidays.length }}</span>
              <span class="cm-stat-label">Regular Holidays</span>
            </div>

            <div class="cm-stat">
              <span class="cm-stat-value">{{ summary.specialHolidays.length }}</span>
              <span class="cm-stat-label">Special Holidays</span>
            </div>

            <div class="cm-stat">
              <span class="cm-stat-value">{{ summary.suspensions.length }}</span>
              <span class="cm-stat-label">Suspensions</span>
            </div>

            <div class="cm-stat">
              <span class="cm-stat-value">{{ summary.totalNonWorkingDays }}</span>
              <span class="cm-stat-label">Total</span>
            </div>
          </div>
        </div>

        <!-- Suspension List -->
        <div class="cm-card">
          <div class="d-flex justify-space-between align-center">
            <h3 class="cm-card-title">Suspension Days</h3>

            <VBtn
              size="small"
              variant="outlined"
              icon="mdi-plus"
              @click="openAddDialog()"
            />
          </div>

          <div v-if="summary.suspensions.length">
            <div
              v-for="s in summary.suspensions"
              :key="s.id"
              class="d-flex justify-space-between align-center mt-2"
            >
              <div>
                <VChip size="small">{{ formatDisplayDate(s.date) }}</VChip>
                <span class="ml-2">{{ s.label }}</span>
              </div>

              <VBtn
                icon="mdi-delete"
                variant="text"
                color="error"
                @click="confirmRemove(s)"
              />
            </div>
          </div>

          <p v-else class="cm-empty-text">
            No suspension days this month.
          </p>
        </div>
      </div>
    </div>

    <!-- ── Add Dialog ────────────────────────────────────────────── -->
    <VDialog v-model="dialog.visible" max-width="420">
      <VCard>
        <VCardTitle>Add Suspension Day</VCardTitle>

        <VCardText>
          <VDatePicker v-model="dialog.dateValue" />

          <VTextField
            v-model="dialog.label"
            label="Label / Reason"
            class="mt-3"
          />

          <VAlert
            v-if="dialog.error"
            type="error"
            variant="tonal"
            class="mt-2"
          >
            {{ dialog.error }}
          </VAlert>
        </VCardText>

        <VCardActions class="justify-end">
          <VBtn text @click="closeDialog">Cancel</VBtn>
          <VBtn color="primary" @click="submitSuspension">
            Add
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Remove Dialog ─────────────────────────────────────────── -->
    <VDialog v-model="removeDialog.visible" max-width="380">
      <VCard>
        <VCardTitle>Remove Suspension Day</VCardTitle>

        <VCardText>
          Are you sure you want to remove
          <strong>{{ removeDialog.item?.label }}</strong>?
        </VCardText>

        <VCardActions class="justify-end">
          <VBtn text @click="removeDialog.visible = false">Cancel</VBtn>
          <VBtn color="error" @click="doRemove">Remove</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { usePayrollCalendar, toISODate, formatDisplayDate, type SuspensionDay, } from '@/composable/usePayrollCalendar'

const {
  getDateInfo,
  getMonthSummary,
  addSuspensionDay,
  removeSuspensionDay,
} = usePayrollCalendar()

const today = new Date()
const viewYear  = ref(today.getFullYear())
const viewMonth = ref(today.getMonth() + 1) // 1-indexed

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const monthLabel = computed(
  () => `${MONTH_NAMES[viewMonth.value - 1]} ${viewYear.value}`,
)

function prevMonth() {
  if (viewMonth.value === 1) {
    viewMonth.value = 12
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function nextMonth() {
  if (viewMonth.value === 12) {
    viewMonth.value = 1
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

// ---------------------------------------------------------------------------
// Calendar cell computation
// ---------------------------------------------------------------------------

interface CalendarCell {
  date: Date | null
  isoDate: string
  isToday: boolean
  isWeekend: boolean
  info: ReturnType<typeof getDateInfo>
}

const calendarCells = computed<CalendarCell[]>(() => {
  const year  = viewYear.value
  const month = viewMonth.value // 1-indexed

  const firstDay = new Date(year, month - 1, 1)
  const lastDay  = new Date(year, month, 0)
  const startDow = firstDay.getDay() // 0 = Sunday
  const daysInMonth = lastDay.getDate()

  const todayISO = toISODate(today)
  const cells: CalendarCell[] = []

  // Padding before the 1st
  for (let i = 0; i < startDow; i++) {
    cells.push({ date: null, isoDate: '', isToday: false, isWeekend: false, info: {} })
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(year, month - 1, d)
    const isoDate = toISODate(date)
    const dow     = date.getDay()

    cells.push({
      date,
      isoDate,
      isToday:   isoDate === todayISO,
      isWeekend: dow === 0 || dow === 6,
      info:      getDateInfo(isoDate),
    })
  }

  // Pad to complete last row (multiple of 7)
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, isoDate: '', isToday: false, isWeekend: false, info: {} })
  }

  return cells
})

function cellClasses(cell: CalendarCell) {
  if (!cell.date) return { 'cm-cell--empty': true }
  return {
    'cm-cell--today':    cell.isToday,
    'cm-cell--weekend':  cell.isWeekend && !cell.info.holiday,
    'cm-cell--rh':       cell.info.holiday?.type === 'regular',
    'cm-cell--sh':       cell.info.holiday?.type === 'special',
    'cm-cell--susp':     !!cell.info.suspension,
    'cm-cell--clickable': true,
  }
}

// Month summary (reactive to view month changes)
const summary = computed(() => getMonthSummary(viewYear.value, viewMonth.value))

// ---------------------------------------------------------------------------
// Click on a calendar cell → pre-fill the add dialog with that date
// ---------------------------------------------------------------------------
function onCellClick(cell: CalendarCell) {
  if (!cell.date) return
  openAddDialog(cell.date)
}

// ---------------------------------------------------------------------------
// Add suspension day dialog
// ---------------------------------------------------------------------------
const dialog = reactive({
  visible:   false,
  dateValue: null as Date | null,
  label:     '',
  error:     '',
  loading:   false,
})

// Restrict the Calendar picker to the currently viewed month
const minDate = computed(() => new Date(viewYear.value, viewMonth.value - 1, 1))
const maxDate = computed(() => new Date(viewYear.value, viewMonth.value, 0))

function openAddDialog(prefillDate?: Date) {
  dialog.dateValue = prefillDate ?? null
  dialog.label     = ''
  dialog.error     = ''
  dialog.loading   = false
  dialog.visible   = true
}

function closeDialog() {
  dialog.visible = false
}

function submitSuspension() {
  dialog.error = ''

  if (!dialog.dateValue) {
    dialog.error = 'Please select a date.'
    return
  }

  const isoDate = toISODate(dialog.dateValue)
  const result  = addSuspensionDay(isoDate, dialog.label)

  if (result !== true) {
    dialog.error = result
    return
  }

  closeDialog()
}

// ---------------------------------------------------------------------------
// Remove suspension day dialog
// ---------------------------------------------------------------------------
const removeDialog = reactive({
  visible: false,
  item:    null as SuspensionDay | null,
})

function confirmRemove(s: SuspensionDay) {
  removeDialog.item    = s
  removeDialog.visible = true
}

function doRemove() {
  if (removeDialog.item) {
    removeSuspensionDay(removeDialog.item.id)
  }
  removeDialog.visible = false
  removeDialog.item    = null
}

</script>

<style>
/* ── Layout ───────────────────────────────────────────── */
.calendar-mgmt {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* ── Header ───────────────────────────────────────────── */
.cm-page-header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.cm-page-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cm-title-icon {
  color: var(--primary-color);
}

.cm-page-subtitle {
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

/* ── Main Layout ──────────────────────────────────────── */
.cm-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1.5rem;
}

@media (max-width: 960px) {
  .cm-layout {
    grid-template-columns: 1fr;
  }
}

/* ── Panels / Cards ───────────────────────────────────── */
.cm-calendar-panel,
.cm-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 1.25rem;
}

/* ── Month Nav ────────────────────────────────────────── */
.cm-month-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cm-month-label {
  font-weight: 700;
  color: var(--text-color);
}

/* ── Day Headers ─────────────────────────────────────── */
.cm-day-headers {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-top: 0.75rem;
}

.cm-day-name {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}

/* ── Calendar Grid ───────────────────────────────────── */
.cm-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-top: 0.5rem;
}

.cm-cell {
  aspect-ratio: 1;
  border-radius: 8px;
  padding: 0.4rem;
  font-size: 0.8rem;
  position: relative;
  background: transparent;
  transition: background 0.2s ease;
}

.cm-cell--clickable {
  cursor: pointer;
}

.cm-cell--clickable:hover {
  background: var(--surface-hover);
}

.cm-cell--weekend {
  background: var(--surface-ground);
}

/* ── Today (Primary Color Driven) ────────────────────── */
.cm-cell--today {
  background: color-mix(in srgb, var(--primary-color) 15%, transparent);
  outline: 1px solid var(--primary-color);
}

/* ── Semantic Cell Colors (Theme Adaptive) ───────────── */
.cm-cell--rh {
  background: color-mix(in srgb, var(--red-500) 12%, transparent);
}

.cm-cell--sh {
  background: color-mix(in srgb, var(--orange-500) 12%, transparent);
}

.cm-cell--susp {
  background: color-mix(in srgb, var(--green-500) 12%, transparent);
}

/* Mixed state */
.cm-cell--rh.cm-cell--susp,
.cm-cell--sh.cm-cell--susp {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--red-500) 12%, transparent) 50%,
    color-mix(in srgb, var(--green-500) 12%, transparent) 50%
  );
}

/* ── Cell Content ────────────────────────────────────── */
.cm-cell-num {
  font-weight: 600;
  color: var(--text-color);
}

.cm-cell-badges {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  margin-top: 4px;
  justify-content: center;
}

/* ── Legend ─────────────────────────────────────────── */
.cm-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  border-top: 1px solid var(--surface-border);
  padding-top: 1rem;
}

.cm-legend-item {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.cm-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.cm-legend-dot--rh {
  background: var(--red-400);
}

.cm-legend-dot--sh {
  background: var(--orange-400);
}

.cm-legend-dot--susp {
  background: var(--green-400);
}

.cm-legend-dot--today {
  background: var(--primary-color);
  border-radius: 50%;
}

.cm-legend-dot--weekend {
  background: var(--surface-border);
}

/* ── Sidebar ────────────────────────────────────────── */
.cm-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Stats ─────────────────────────────────────────── */
.cm-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.cm-stat {
  padding: 0.75rem;
  border-radius: 8px;
}

.cm-stat--rh {
  background: color-mix(in srgb, var(--red-500) 15%, var(--surface-card));
}

.cm-stat--sh {
  background: color-mix(in srgb, var(--orange-500) 15%, var(--surface-card));
}

.cm-stat--susp {
  background: color-mix(in srgb, var(--green-500) 15%, var(--surface-card));
}

.cm-stat--total {
  background: var(--surface-hover);
}

.cm-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-color);
}

.cm-stat-label {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
}

/* ── Lists ─────────────────────────────────────────── */
.cm-holiday-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
}

.cm-holiday-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cm-empty-text {
  color: var(--text-color-secondary);
  font-size: 0.85rem;
}

/* ── Dialog ────────────────────────────────────────── */
.cm-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.cm-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-color);
}

.cm-required {
  color: var(--red-500);
}
</style>