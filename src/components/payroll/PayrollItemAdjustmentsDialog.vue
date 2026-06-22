<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
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
  id:           number
  type:         'pass_slip' | 'official_travel' | 'leave'
  date:         string   // 'YYYY-MM-DD'
  minutes:      number
  is_whole_day: boolean
  notes:        string | null
}

type AlertType = 'success' | 'error' | 'warning' | 'info'

/* ─────────────────────────────────────────
   PROPS / EMITS
───────────────────────────────────────── */
const props = defineProps<{
  modelValue: boolean
  runId:      number
  item:       BatchItem | null
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
const BLANK_FORM = () => ({
  type:    '' as 'pass_slip' | 'official_travel' | 'leave' | '',
  date:    '',
  minutes: null as number | null,
  notes:   '',
})
const form       = ref(BLANK_FORM())
const formErrors = ref<Record<string, string>>({})

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const wholeDayCount = computed(() =>
  adjustments.value.filter(a => a.is_whole_day).length
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
  return Number(props.item.dtr_late_minutes) + passSlipMinutesTotal.value
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
    form.value       = BLANK_FORM()
    formErrors.value = {}
    deleteTarget.value = null
  }
})

// When type changes to a whole-day type, clear minutes
watch(() => form.value.type, (t) => {
  if (t !== 'pass_slip') form.value.minutes = null
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
  } catch {
    showAlert('error', 'Failed to load adjustments.')
  } finally {
    loading.value = false
  }
}

function validate(): boolean {
  const errs: Record<string, string> = {}
  if (!form.value.type) errs.type = 'Type is required.'
  if (!form.value.date) errs.date = 'Date is required.'
  if (form.value.type === 'pass_slip') {
    if (!form.value.minutes || form.value.minutes < 1) {
      errs.minutes = 'Minutes must be at least 1 for a pass slip.'
    }
  }
  formErrors.value = errs
  return Object.keys(errs).length === 0
}

async function addAdjustment() {
  if (!validate() || !props.item) return
  saving.value = true
  try {
    const { data } = await axios.post(
      `/api/payroll-run/${props.runId}/items/${props.item.id}/adjustments`,
      {
        type:    form.value.type,
        date:    form.value.date,
        minutes: form.value.type === 'pass_slip' ? form.value.minutes : 0,
        notes:   form.value.notes?.trim() || null,
      }
    )
    if (!data.success) throw new Error(data.message)
    showAlert('success', 'Adjustment added and deductions recomputed.')
    adjustments.value = [...adjustments.value, data.data.adjustment]
    emit('updated', data.data.item)
    form.value       = BLANK_FORM()
    formErrors.value = {}
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to add adjustment.')
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
                  <strong :class="passSlipMinutesTotal > 0 ? 'text-warning' : ''">
                    {{ previewLateMinutes }}
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
                </td>
                <td class="text-caption font-monospace">{{ adj.date }}</td>
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

        <!-- ── Add New Adjustment Form ── -->
        <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">
          Add Adjustment
        </p>

        <VRow dense>
          <!-- Type -->
          <VCol cols="12" sm="4">
            <VSelect
              v-model="form.type"
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
              :error-messages="formErrors.type"
              hide-details="auto"
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

          <!-- Date -->
          <VCol cols="12" sm="4">
            <VTextField
              v-model="form.date"
              label="Date"
              type="date"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-calendar-outline"
              :error-messages="formErrors.date"
              hide-details="auto"
            />
          </VCol>

          <!-- Minutes (pass slip only) -->
          <VCol cols="12" sm="4">
            <VTextField
              v-model.number="form.minutes"
              label="Minutes (pass slip)"
              type="number"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-clock-outline"
              :disabled="form.type !== 'pass_slip'"
              :error-messages="formErrors.minutes"
              hide-details="auto"
              min="1"
              max="480"
              :hint="form.type === 'pass_slip' ? 'Time away from office' : 'N/A for this type'"
              :persistent-hint="form.type === 'pass_slip'"
            />
          </VCol>

          <!-- Helper text for whole-day types -->
          <VCol v-if="form.type && form.type !== 'pass_slip'" cols="12">
            <VAlert density="compact" variant="tonal"
              :color="form.type === 'official_travel' ? 'blue' : 'teal'"
              :icon="typeIcon(form.type)"
              class="text-body-2">
              <template v-if="form.type === 'official_travel'">
                <strong>Official Travel</strong> — this date will be subtracted from the employee's absent days.
              </template>
              <template v-else>
                <strong>Leave</strong> — this date will be subtracted from the employee's absent days.
              </template>
            </VAlert>
          </VCol>

          <VCol v-if="form.type === 'pass_slip'" cols="12">
            <VAlert density="compact" variant="tonal" color="orange" icon="mdi-door-open" class="text-body-2">
              <strong>Pass Slip</strong> — the minutes entered will be <strong>added</strong> to the employee's late/UT minutes for deduction purposes.
            </VAlert>
          </VCol>

          <!-- Notes -->
          <VCol cols="12">
            <VTextField
              v-model="form.notes"
              label="Notes (optional)"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-note-outline"
              placeholder="e.g. Filed SP-2026-001, approved by division head"
              hide-details
            />
          </VCol>

          <!-- Submit -->
          <VCol cols="12" class="d-flex justify-end">
            <VBtn color="primary" variant="tonal" size="small" :loading="saving" @click="addAdjustment">
              <VIcon start size="16">mdi-plus-circle-outline</VIcon>
              Add Adjustment
            </VBtn>
          </VCol>
        </VRow>

      </VCardText>

      <VDivider />
      <VCardActions class="justify-end pa-4">
        <VBtn variant="tonal" @click="isOpen = false">Close</VBtn>
      </VCardActions>

    </VCard>

    <BaseAlert v-model="alertVisible" :message="alertMessage" :type="alertType" :timeout="3000" />
  </VDialog>
</template>
