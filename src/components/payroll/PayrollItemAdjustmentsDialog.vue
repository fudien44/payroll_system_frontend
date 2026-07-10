<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
import AdjustmentDatePicker from '@/components/payroll/AdjustmentDatePicker.vue'
import axios from '@axios'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface BatchItem {
  id:                      number
  emp_id:                  number
  emp_name:                string
  position:                string | null
  division_name:           string | null
  section_name:            string | null
  engas_no:                string | null
  nip:                     boolean
  wage:                    number
  premium_percent:         number
  premium:                 number
  gross:                   number
  regdays:                 number
  total_rendered_hours:    number
  total_absent_days:       number
  total_late_minutes:      number
  total_undertime_minutes: number
  daily_rate:              number
  work_minutes_per_day:    number
  absent_deduction:        number
  late_ut_deduction:       number
  philhealth:              number
  pag_ibig:                number
  sss:                     number
  ewt:                     number
  total_deductions:        number
  net_pay:                 number
  remarks:                 string | null
  is_overridden:           boolean
  dtr_absent_days:         number
  dtr_late_minutes:        number
  dtr_undertime_minutes:   number
}

interface Adjustment {
  id:                   number
  type:                 'pass_slip' | 'official_travel' | 'leave'
  date:                 string
  date_to:              string | null
  minutes:              number
  is_whole_day:         boolean
  notes:                string | null
  is_compressed_week:   boolean
  days_in_month:        number
  compressed_mins_offset: number
  is_hrmis_imported:    boolean
}

type AlertType = 'success' | 'error' | 'warning' | 'info'

/* ─────────────────────────────────────────
   PROPS / EMITS
───────────────────────────────────────── */
const props = defineProps<{
  modelValue:   boolean
  runId:        number
  item:         BatchItem | null
  periodMonth:  number
  periodYear:   number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'updated', updatedItem: any): void
}>()

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const adjustments  = ref<Adjustment[]>([])
const loading      = ref(false)
const saving       = ref(false)
const deleteTarget = ref<Adjustment | null>(null)
const deleting     = ref(false)

const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

// ── Add form ──
interface BatchRow {
  _uid:           number
  type:           'pass_slip' | 'official_travel' | 'leave' | ''
  pass_slip_type: 'personal' | 'official' | ''
  date:           string
  date_to:        string | null
  minutes:        number | null
  notes:          string
}

let rowUidSeq = 0
const BLANK_ROW = (): BatchRow => ({
  _uid: ++rowUidSeq, type: '', pass_slip_type: '',
  date: '', date_to: '', minutes: null, notes: '',
})

const rows      = ref<BatchRow[]>([BLANK_ROW()])
const rowErrors = ref<Record<number, Record<string, string>>>({})

function addRow() {
  rows.value.push(BLANK_ROW())
}
function removeRow(uid: number) {
  rows.value = rows.value.filter(r => r._uid !== uid)
  delete rowErrors.value[uid]
  if (rows.value.length === 0) rows.value.push(BLANK_ROW())
}
function onRowTypeChange(row: BatchRow, val: BatchRow['type']) {
  row.type    = val
  row.date    = ''
  row.date_to = ''
  if (val !== 'pass_slip') {
    row.minutes        = null
    row.pass_slip_type = ''
  }
}

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const compressedMinuteOffset = computed(() =>
  adjustments.value
    .filter(a => a.is_whole_day)
    .reduce((sum, a) => sum + (a.compressed_mins_offset ?? 0), 0)
)

const wholeDayCount = computed(() =>
  adjustments.value
    .filter(a => a.is_whole_day)
    .reduce((sum, a) => sum + (a.days_in_month ?? 1), 0)
)

const passSlipMinutesTotal = computed(() =>
  adjustments.value.filter(a => a.type === 'pass_slip').reduce((s, a) => s + a.minutes, 0)
)

// Preview: what the absent days / late minutes will be after all adjustments
const previewAbsentDays = computed(() => {
  if (!props.item) return 0
  return Math.max(0, Number(props.item.dtr_absent_days) - wholeDayCount.value)
})

const previewLateMinutes = computed(() => {
  if (!props.item) return 0
  return Math.max(0,
    Number(props.item.dtr_late_minutes) - compressedMinuteOffset.value + passSlipMinutesTotal.value
  )
})

const typeLabel = (type: string) => {
  if (type === 'pass_slip')       return 'Pass Slip'
  if (type === 'official_travel') return 'Official Travel'
  if (type === 'leave')           return 'Leave'
  return type
}

const typeColor = (type: string) => {
  if (type === 'pass_slip')       return 'orange'
  if (type === 'official_travel') return 'blue'
  if (type === 'leave')           return 'teal'
  return 'grey'
}

const typeIcon = (type: string) => {
  if (type === 'pass_slip')       return 'mdi-door-open'
  if (type === 'official_travel') return 'mdi-briefcase-outline'
  if (type === 'leave')           return 'mdi-calendar-check-outline'
  return 'mdi-help-circle-outline'
}



const fmt = (v: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
  }).format(v ?? 0)

/* ─────────────────────────────────────────
   WATCHERS
───────────────────────────────────────── */
watch(() => props.modelValue, (open) => {
  if (open && props.item) {
    fetchAdjustments()
    rows.value       = [BLANK_ROW()]
    rowErrors.value  = {}
    deleteTarget.value = null
  }
})

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */
async function fetchAdjustments() {
  if (!props.item) return
  loading.value = true
  try {
    const { data } = await axios.get(
      `/api/payroll-run/${props.runId}/items/${props.item.id}/adjustments`
    )
    adjustments.value = data.data ?? []
    if (data.item) {
      emit('updated', data.item)   // NEW — syncs parent table if an auto-import recomputed totals
    }
  } catch {
    showAlert('error', 'Failed to load adjustments.')
  } finally {
    loading.value = false
  }
}

function validateRow(row: BatchRow): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!row.type) errs.type = 'Type is required.'
  if (!row.date) errs.date = 'Please pick a date.'

  if (row.type === 'pass_slip') {
    if (!row.pass_slip_type) errs.pass_slip_type = 'Please select Personal or Official.'
    if (!row.minutes || row.minutes < 1) errs.minutes = 'Minutes must be at least 1 for a pass slip.'
  } else if (row.date && !row.date_to) {
    errs.date = 'Please pick a date range.'
  }
  return errs
}

function validateAllRows(): boolean {
  const allErrors: Record<number, Record<string, string>> = {}
  let valid = true
  for (const row of rows.value) {
    const errs = validateRow(row)
    if (Object.keys(errs).length > 0) {
      allErrors[row._uid] = errs
      valid = false
    }
  }
  rowErrors.value = allErrors
  return valid
}

async function saveBatch() {
  if (!validateAllRows() || !props.item) return
  saving.value = true
  try {
    const payload = rows.value.map(row => {
      let notesValue = row.notes?.trim() || null
      if (row.type === 'pass_slip' && row.pass_slip_type) {
        const label = row.pass_slip_type === 'official' ? '[Official Pass Slip]' : '[Personal Pass Slip]'
        notesValue = notesValue ? `${label} ${notesValue}` : label
      }
      return {
        type:    row.type,
        date:    row.date,
        date_to: row.type !== 'pass_slip' ? (row.date_to || row.date) : null,
        minutes: row.type === 'pass_slip' ? row.minutes : 0,
        notes:   notesValue,
      }
    })

    const { data } = await axios.post(
      `/api/payroll-run/${props.runId}/items/${props.item.id}/adjustments/batch`,
      { adjustments: payload }
    )
    if (!data.success) throw new Error(data.message)

    showAlert('success', `${data.data.adjustments.length} adjustment(s) added and deductions recomputed.`)
    adjustments.value = [...adjustments.value, ...data.data.adjustments]
    emit('updated', data.data.item)
    rows.value      = [BLANK_ROW()]
    rowErrors.value = {}
  } catch (err: any) {
    // Map backend row_errors (keyed by array index) back onto the matching row's _uid
    if (err.response?.data?.row_errors) {
  const mapped: Record<number, Record<string, string>> = {}
  for (const [idx, msg] of Object.entries(err.response.data.row_errors)) {
    const row = rows.value[Number(idx)]
    if (row) mapped[row._uid] = { _general: msg as string }
  }
  rowErrors.value = mapped
}
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to save adjustments.')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value || !props.item) return
  deleting.value = true
  try {
    const { data } = await axios.post(
      `/api/payroll-run/${props.runId}/items/${props.item.id}/adjustments/${deleteTarget.value.id}/delete`
    )
    if (!data.success) throw new Error(data.message)
    adjustments.value = adjustments.value.filter(a => a.id !== deleteTarget.value!.id)
    showAlert('success', 'Adjustment removed and deductions recomputed.')
    emit('updated', data.data.item)
    deleteTarget.value = null
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to delete adjustment.')
  } finally {
    deleting.value = false
  }
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}
</script>

<template>
  <VDialog v-model="isOpen" max-width="680" persistent scrollable>
    <VCard rounded="lg">

      <!-- ── Header ── -->
      <VCardText class="pa-6 pb-0">
        <div class="d-flex align-center gap-3 mb-1">
          <VAvatar color="indigo" variant="tonal" size="44" rounded="lg">
            <VIcon icon="mdi-calendar-edit-outline" size="22" />
          </VAvatar>
          <div class="flex-grow-1">
            <div class="text-body-1 font-weight-medium">Attendance Adjustments</div>
            <div class="text-caption text-medium-emphasis">{{ item?.emp_name }}</div>
          </div>
          <VBtn icon variant="text" size="small" @click="isOpen = false">
            <VIcon>mdi-close</VIcon>
          </VBtn>
        </div>
      </VCardText>

      <VDivider class="mt-4" />

      <VCardText class="pa-6">

        <!-- ── DTR Baseline + Preview ── -->
        <VRow dense class="mb-4">
          <!-- DTR Baseline -->
          <VCol cols="12" sm="6">
            <VCard variant="tonal" color="grey" rounded="lg" flat>
              <VCardText class="py-3 px-4">
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-2">
                  DTR Baseline (from biometric)
                </p>
                <div class="d-flex justify-space-between text-body-2">
                  <span class="text-medium-emphasis">Absent Days</span>
                  <strong>{{ item?.dtr_absent_days ?? 0 }}</strong>
                </div>
                <div class="d-flex justify-space-between text-body-2 mt-1">
                  <span class="text-medium-emphasis">Late Minutes</span>
                  <strong>{{ item?.dtr_late_minutes ?? 0 }}</strong>
                </div>
                <div class="d-flex justify-space-between text-body-2 mt-1">
                  <span class="text-medium-emphasis">Undertime Minutes</span>
                  <strong>{{ item?.dtr_undertime_minutes ?? 0 }}</strong>
                </div>
              </VCardText>
            </VCard>
          </VCol>

          <!-- After Adjustments Preview -->
          <VCol cols="12" sm="6">
            <VCard variant="tonal" color="success" rounded="lg" flat>
              <VCardText class="py-3 px-4">
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-2">
                  After Adjustments (current)
                </p>
                <div class="d-flex justify-space-between text-body-2">
                  <span class="text-medium-emphasis">Absent Days</span>
                  <strong :class="previewAbsentDays < (item?.dtr_absent_days ?? 0) ? 'text-success' : ''">
                    {{ previewAbsentDays }}
                    <span v-if="wholeDayCount > 0" class="text-caption text-success">
                      (−{{ wholeDayCount }})
                    </span>
                  </strong>
                </div>
               <div class="d-flex justify-space-between text-body-2 mt-1">
                <span class="text-medium-emphasis">Late Minutes</span>
                <strong :class="compressedMinuteOffset > 0 ? 'text-success' : passSlipMinutesTotal > 0 ? 'text-warning' : ''">
                  {{ previewLateMinutes }}
                  <span v-if="compressedMinuteOffset > 0" class="text-caption text-success">
                    (−{{ compressedMinuteOffset }})
                  </span>
                  <span v-if="passSlipMinutesTotal > 0" class="text-caption text-warning">
                    (+{{ passSlipMinutesTotal }})
                  </span>
                </strong>
              </div>
                <div class="d-flex justify-space-between text-body-2 mt-1">
                  <span class="text-medium-emphasis">Net Pay</span>
                  <strong class="text-success">{{ fmt(item?.net_pay ?? 0) }}</strong>
                </div>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>

        <!-- ── Existing Adjustments ── -->
        <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-2">
          Recorded Adjustments
          <VChip size="x-small" color="primary" variant="tonal" class="ml-1">{{ adjustments.length }}</VChip>
        </p>

        <VSkeletonLoader v-if="loading" type="list-item-two-line, list-item-two-line" class="mb-4" />

        <div v-else-if="adjustments.length === 0" class="text-center py-4 mb-4"
          style="border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 8px;">
          <VIcon icon="mdi-calendar-blank-outline" size="32" class="text-medium-emphasis mb-2" />
          <p class="text-body-2 text-medium-emphasis mb-0">No adjustments recorded yet.</p>
        </div>

        <div v-else class="mb-4"
          style="border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 8px; overflow: hidden;">
          <VTable density="compact" class="text-body-2">
            <thead>
              <tr style="background: rgb(var(--v-theme-surface-variant))">
                <th class="text-left">Type</th>
                <th class="text-left">Date</th>
                <th class="text-right">Minutes</th>
                <th class="text-left">Notes</th>
                <th class="text-center" style="width: 60px;">Del</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="adj in adjustments" :key="adj.id">
                <td>
                  <VChip :color="typeColor(adj.type)" size="x-small" variant="tonal" label>
                    <VIcon start :icon="typeIcon(adj.type)" size="11" />
                    {{ typeLabel(adj.type) }}
                  </VChip>
                   <VChip
                    v-if="adj.is_hrmis_imported"
                    size="x-small"
                    color="indigo"
                    variant="outlined"
                    label
                    class="ml-1"
                  >
                    <VIcon start icon="mdi-cloud-sync-outline" size="10" />
                    HRMIS
                    <VTooltip activator="parent" location="top">Auto-imported from an approved pass slip</VTooltip>
                  </VChip>
                </td>
                <td class="text-caption font-monospace">
                  {{ adj.date }}
                  <template v-if="adj.date_to && adj.date_to !== adj.date">
                    <span class="text-medium-emphasis"> → {{ adj.date_to }}</span>
                    <VChip size="x-small" color="primary" variant="tonal" label class="ml-1">
                      {{ adj.days_in_month }}d in month
                    </VChip>
                  </template>
                </td>
                <td class="text-right text-caption">
                  <template v-if="adj.type === 'pass_slip'">
                    {{ adj.minutes }} min
                  </template>
                  <span v-else class="text-medium-emphasis">—</span>
                </td>
                <td class="text-caption text-medium-emphasis" style="max-width: 160px; white-space: pre-wrap;">
                  {{ adj.notes || '—' }}
                </td>
                <td class="text-center">
                  <VBtn icon size="x-small" variant="text" color="error"
                    :loading="deleting && deleteTarget?.id === adj.id"
                    @click="deleteTarget = adj">
                    <VIcon size="14">mdi-delete-outline</VIcon>
                    <VTooltip activator="parent" location="top">Remove</VTooltip>
                  </VBtn>
                </td>
              </tr>
            </tbody>
          </VTable>
        </div>

        <!-- ── Delete inline confirmation ── -->
        <VAlert v-if="deleteTarget" type="error" variant="tonal" density="compact"
          icon="mdi-alert-outline" class="mb-4">
          <div class="d-flex align-center justify-space-between flex-wrap gap-2">
            <span class="text-body-2">
              Remove <strong>{{ typeLabel(deleteTarget.type) }}</strong> on
              <strong>{{ deleteTarget.date }}</strong>?
              Deductions will be recomputed.
            </span>
            <div class="d-flex gap-2">
              <VBtn size="x-small" variant="text" :disabled="deleting"
                @click="deleteTarget = null">Cancel</VBtn>
              <VBtn size="x-small" color="error" variant="tonal"
                :loading="deleting" @click="confirmDelete">Yes, Remove</VBtn>
            </div>
          </div>
        </VAlert>

        <VDivider class="mb-4" />

        <!-- ── Add New Adjustments (batch) ── -->
<p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
  Add Adjustments
</p>

<div
  v-for="(row, idx) in rows"
  :key="row._uid"
  class="mb-4 pa-3"
  style="border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 8px;"
>
  <div class="d-flex justify-space-between align-center mb-2">
    <span class="text-caption text-medium-emphasis font-weight-medium">Row {{ idx + 1 }}</span>
    <VBtn v-if="rows.length > 1" icon size="x-small" variant="text" color="error" @click="removeRow(row._uid)">
      <VIcon size="14">mdi-close</VIcon>
    </VBtn>
  </div>

  <VAlert v-if="rowErrors[row._uid]?._general" density="compact" variant="tonal" type="error" class="mb-2 text-caption">
    {{ rowErrors[row._uid]._general }}
  </VAlert>

  <VRow dense>
    <!-- Type -->
    <VCol cols="12" sm="4">
      <VSelect
        :model-value="row.type"
        label="Type"
        :items="[
          { title: 'Pass Slip',        value: 'pass_slip'       },
          { title: 'Official Travel',  value: 'official_travel' },
          { title: 'Leave',            value: 'leave'           },
        ]"
        item-title="title"
        item-value="value"
        variant="outlined"
        density="compact"
        prepend-inner-icon="mdi-tag-outline"
        :error-messages="rowErrors[row._uid]?.type"
        hide-details="auto"
        @update:model-value="(val: any) => onRowTypeChange(row, val)"
      >
        <template #item="{ props: itemProps, item: i }">
          <VListItem v-bind="itemProps">
            <template #prepend>
              <VIcon :icon="typeIcon(i.value)" size="16" :color="typeColor(i.value)" class="mr-2" />
            </template>
          </VListItem>
        </template>
      </VSelect>
    </VCol>

    <!-- Pass Slip Sub-type -->
    <VCol v-if="row.type === 'pass_slip'" cols="12" sm="4">
      <VSelect
        v-model="row.pass_slip_type"
        label="Pass Slip Type"
        :items="[
          { title: 'Personal', value: 'personal' },
          { title: 'Official', value: 'official' },
        ]"
        item-title="title"
        item-value="value"
        variant="outlined"
        density="compact"
        prepend-inner-icon="mdi-account-question-outline"
        :error-messages="rowErrors[row._uid]?.pass_slip_type"
        hide-details="auto"
      />
    </VCol>

    <!-- Date / Date range picker -->
    <VCol cols="12" :sm="row.type === 'pass_slip' ? 4 : 8">
      <AdjustmentDatePicker
        :type="row.type"
        :period-month="periodMonth"
        :period-year="periodYear"
        :date="row.date"
        :date-to="row.date_to"
        :disabled="!row.type"
        :error-messages="rowErrors[row._uid]?.date || rowErrors[row._uid]?.date_to"
        @update:date="row.date = $event"
        @update:date-to="row.date_to = $event"
      />
    </VCol>

    <!-- Minutes (pass slip only) -->
    <VCol cols="12" sm="4">
      <VTextField
        v-model.number="row.minutes"
        label="Minutes (pass slip)"
        type="number"
        variant="outlined"
        density="compact"
        prepend-inner-icon="mdi-clock-outline"
        :disabled="row.type !== 'pass_slip'"
        :error-messages="rowErrors[row._uid]?.minutes"
        hide-details="auto"
        min="1"
        max="480"
      />
    </VCol>

    <!-- Helper text -->
    <VCol v-if="row.type && row.type !== 'pass_slip'" cols="12">
      <VAlert density="compact" variant="tonal"
        :color="row.type === 'official_travel' ? 'blue' : 'teal'"
        :icon="typeIcon(row.type)"
        class="text-body-2">
        <template v-if="row.type === 'official_travel'">
          <strong>Official Travel</strong> — the selected date(s) will be subtracted from absent days.
        </template>
        <template v-else>
          <strong>Leave</strong> — the selected date(s) will be subtracted from absent days.
        </template>
      </VAlert>
    </VCol>

    <VCol v-if="row.type === 'pass_slip'" cols="12">
      <VAlert density="compact" variant="tonal" color="orange" icon="mdi-door-open" class="text-body-2">
        <template v-if="row.pass_slip_type === 'official'">
          <strong>Official Pass Slip</strong> — only minutes <strong>beyond the 2-hour (120 min) grace period</strong>
          will be added to late/UT. Enter only the excess minutes.
        </template>
        <template v-else-if="row.pass_slip_type === 'personal'">
          <strong>Personal Pass Slip</strong> — all minutes entered will be
          <strong>added</strong> to the employee's late/UT minutes.
        </template>
        <template v-else>
          <strong>Pass Slip</strong> — select Personal or Official to see how minutes are computed.
        </template>
      </VAlert>
    </VCol>

    <!-- Notes -->
    <VCol cols="12">
      <VTextField
        v-model="row.notes"
        label="Notes (optional)"
        variant="outlined"
        density="compact"
        prepend-inner-icon="mdi-note-outline"
        placeholder="e.g. Filed SP-2026-001, approved by division head"
        hide-details
      />
    </VCol>
  </VRow>
</div>

<div class="d-flex justify-space-between align-center">
  <VBtn variant="text" size="small" color="primary" @click="addRow">
    <VIcon start size="16">mdi-plus</VIcon>
    Add Row
  </VBtn>
  <VBtn color="primary" variant="tonal" size="small" :loading="saving" @click="saveBatch">
    <VIcon start size="16">mdi-content-save-outline</VIcon>
    Save All ({{ rows.length }})
  </VBtn>
</div>

      </VCardText>

      <VDivider />
      <VCardActions class="justify-end pa-4">
        <VBtn variant="tonal" @click="isOpen = false">Close</VBtn>
      </VCardActions>

    </VCard>

    <BaseAlert v-model="alertVisible" :message="alertMessage" :type="alertType" :timeout="3000" />
  </VDialog>
</template>
