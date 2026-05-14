<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import axios from '@axios'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Deductions {
  wage:       number
  philhealth: number
  pag_ibig:   number
  sss:        number
  ewt_rate:   number
}

interface Employee {
  emp_id:          number
  name:            string
  position:        string
  salary_grade:    number
  philhealth_mode: 'fixed' | 'percentage'
  philhealth_min:  number
  has_deductions:  boolean
  deductions:      Deductions | null
}

type AlertType = 'success' | 'error' | 'warning' | 'info'

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const PAGIBIG_MIN = 400
const SSS_MIN     = 760     // minimum if employee opts in; ₱0 = opted out
const SG_CUTOFF   = 16

const TABLE_HEADERS = [
  { title: 'Name',       key: 'name',          sortable: true  },
  { title: 'Position',   key: 'position',       sortable: true  },
  { title: 'SG',         key: 'salary_grade',   sortable: true,  align: 'center' as const },
  { title: 'Wage',       key: 'wageDisp',       sortable: false, align: 'end'    as const },
  { title: 'PhilHealth', key: 'philhealthDisp', sortable: false, align: 'end'    as const },
  { title: 'Pag-IBIG',   key: 'pagibigDisp',    sortable: false, align: 'end'    as const },
  { title: 'SSS',        key: 'sssDisp',        sortable: false, align: 'end'    as const },
  { title: 'EWT Rate',   key: 'ewtDisp',        sortable: false, align: 'center' as const },
  { title: 'Status',     key: 'status',         sortable: true  },
  { title: 'Actions',    key: 'actions',        sortable: false, align: 'center' as const },
]

const BLANK_FORM = (): Deductions => ({
  wage:       0,
  philhealth: 500,
  pag_ibig:   PAGIBIG_MIN,
  sss:        SSS_MIN,
  ewt_rate:   5,
})

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const employees    = ref<Employee[]>([])
const loading      = ref(false)
const modalOpen    = ref(false)
const modalLoading = ref(false)
const selectedEmp  = ref<Employee | null>(null)
const form         = ref<Deductions>(BLANK_FORM())
const formErrors   = ref<Partial<Record<keyof Deductions, string>>>({})
const filterStatus = ref<'All' | 'Set' | 'Not Set'>('All')
const isEditing    = ref(false) // true when employee already has deductions
const sssOptIn     = ref(false) // true = employee wants SSS deducted this period

const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

// ── #3 Save confirmation dialog ──────────────────────────────────────────────
const confirmSaveDialog = ref(false)

// ── #4 Reset confirmation dialog ─────────────────────────────────────────────
const confirmResetDialog  = ref(false)
const resetLoading        = ref(false)

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */

const philhealthMin = computed(() => {
  if (!selectedEmp.value) return 500
  return selectedEmp.value.salary_grade >= SG_CUTOFF
    ? Math.round(form.value.wage * 0.05 * 100) / 100
    : 500
})

const philhealthHint = computed(() => {
  if (!selectedEmp.value) return 'Min: ₱500.00/month'
  return selectedEmp.value.salary_grade >= SG_CUTOFF
    ? `SG ${selectedEmp.value.salary_grade} — 5% of wage (min: ${fmt(philhealthMin.value)})/month`
    : 'Min: ₱500.00/month (SG 15 and below)'
})

const filteredItems = computed(() =>
  employees.value
    .filter(e => {
      if (filterStatus.value === 'Set')     return e.has_deductions
      if (filterStatus.value === 'Not Set') return !e.has_deductions
      return true
    })
    .map(e => ({
      ...e,
      wageDisp:       e.deductions ? fmt(e.deductions.wage)       : '—',
      philhealthDisp: e.deductions ? fmt(e.deductions.philhealth) : '—',
      pagibigDisp:    e.deductions ? fmt(e.deductions.pag_ibig)   : '—',
      sssDisp:        e.deductions
        ? (e.deductions.sss > 0 ? fmt(e.deductions.sss) : 'Opted out')
        : '—',
      ewtDisp:        e.deductions ? `${e.deductions.ewt_rate}%`  : '—',
      status:         e.has_deductions ? 'Set' : 'Not Set',
    }))
)

const totalSet    = computed(() => employees.value.filter(e =>  e.has_deductions).length)
const totalNotSet = computed(() => employees.value.filter(e => !e.has_deductions).length)

const preview = computed(() => {
  if (!selectedEmp.value || !form.value.wage) return null
  const wage       = Number(form.value.wage)       || 0
  const philhealth = Number(form.value.philhealth) || 0
  const pag_ibig   = Number(form.value.pag_ibig)   || 0
  const sss        = Number(form.value.sss)        || 0
  const totalDeduct = philhealth + pag_ibig + sss
  return {
    totalDeductions: fmt(totalDeduct),
    estimatedNet:    fmt(wage - totalDeduct),
  }
})

/* ─────────────────────────────────────────
   WATCHERS
───────────────────────────────────────── */

watch(() => form.value.wage, newWage => {
  if ((selectedEmp.value?.salary_grade ?? 0) >= SG_CUTOFF) {
    form.value.philhealth = Math.round(newWage * 0.05 * 100) / 100
  }
})

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */

const fmt = (v: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
  }).format(v)

function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}

// #5 — wage must be > 0; v-model.number returns 0 on empty input
function validate(): boolean {
  const errs: Partial<Record<keyof Deductions, string>> = {}

  if (!form.value.wage || Number(form.value.wage) <= 0)
    errs.wage = 'Monthly wage is required and must be greater than ₱0.'

  if (Number(form.value.philhealth) < philhealthMin.value)
    errs.philhealth = `PhilHealth must be at least ${fmt(philhealthMin.value)}.`

  if (Number(form.value.pag_ibig) < PAGIBIG_MIN)
    errs.pag_ibig = `Pag-IBIG must be at least ${fmt(PAGIBIG_MIN)}.`

  // SSS: if opted in, must be at least ₱760; if opted out, force to 0
  if (sssOptIn.value && Number(form.value.sss) < SSS_MIN)
    errs.sss = `SSS must be at least ${fmt(SSS_MIN)} if deducting.`

  if (Number(form.value.ewt_rate) < 0 || Number(form.value.ewt_rate) > 100)
    errs.ewt_rate = 'EWT rate must be between 0% and 100%.'

  formErrors.value = errs
  return Object.keys(errs).length === 0
}

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */

async function fetchEmployees() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/wage')
    employees.value = data.data ?? []
  } catch {
    showAlert('error', 'Failed to load employees.')
  } finally {
    loading.value = false
  }
}

// #3 — called after user confirms the save dialog
async function handleSave() {
  if (!validate() || !selectedEmp.value) return

  // Show confirmation dialog instead of saving immediately
  confirmSaveDialog.value = true
}

async function executeSave() {
  if (!selectedEmp.value) return
  confirmSaveDialog.value = false
  modalLoading.value      = true

  // If employee opted out of SSS, ensure the value sent is exactly 0
  const payload = { ...form.value, sss: sssOptIn.value ? form.value.sss : 0 }

  try {
    const { data } = await axios.post(
      `/api/wage/upsert/${selectedEmp.value.emp_id}`,
      payload,
    )

    if (!data.success) throw new Error(data.message ?? 'Save failed.')

    const idx = employees.value.findIndex(e => e.emp_id === selectedEmp.value!.emp_id)
    if (idx !== -1) {
      employees.value[idx].deductions    = { ...payload }
      employees.value[idx].has_deductions = true
    }

    showAlert('success', `Deductions saved for ${selectedEmp.value.name}.`)
    modalOpen.value = false
  } catch (err: any) {
    if (err.response?.data?.errors) {
      formErrors.value = Object.fromEntries(
        Object.entries(err.response.data.errors).map(([k, v]) => [k, (v as string[])[0]])
      )
    }
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to save.')
  } finally {
    modalLoading.value = false
  }
}

// #4 — delete wage record from DB
async function executeReset() {
  if (!selectedEmp.value) return
  confirmResetDialog.value = false
  resetLoading.value       = true

  try {
    const { data } = await axios.post(`/api/wage/delete/${selectedEmp.value.emp_id}`)

    if (!data.success) throw new Error(data.message ?? 'Reset failed.')

    const idx = employees.value.findIndex(e => e.emp_id === selectedEmp.value!.emp_id)
    if (idx !== -1) {
      employees.value[idx].deductions    = null
      employees.value[idx].has_deductions = false
    }

    showAlert('success', `Deductions cleared for ${selectedEmp.value.name}.`)
    modalOpen.value = false
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to clear deductions.')
  } finally {
    resetLoading.value = false
  }
}

/* ─────────────────────────────────────────
   HANDLERS
───────────────────────────────────────── */

function openEdit(item: Record<string, any>) {
  const emp = employees.value.find(e => e.emp_id === item.emp_id)
  if (!emp) return

  selectedEmp.value = emp
  isEditing.value   = emp.has_deductions
  sssOptIn.value    = emp.has_deductions && (emp.deductions?.sss ?? 0) > 0

  form.value = emp.deductions
    ? {
        wage:       Number(emp.deductions.wage),
        philhealth: Number(emp.deductions.philhealth),
        pag_ibig:   Number(emp.deductions.pag_ibig),
        sss:        Number(emp.deductions.sss),
        ewt_rate:   Number(emp.deductions.ewt_rate),
      }
    : BLANK_FORM()

  formErrors.value = {}
  modalOpen.value  = true
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(fetchEmployees)
</script>

<template>
  <div>
    <VContainer fluid class="pa-6">

      <!-- ── Page Header ── -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-2">
        <div>
          <h4 class="text-h5 font-weight-bold mb-1">Employee Deductions</h4>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Set monthly wage and deduction amounts per JO employee.
          </p>
        </div>
      </div>

      <!-- ── Info Banner ── -->
      <VAlert
        type="info"
        variant="tonal"
        density="compact"
        icon="mdi-information-outline"
        class="mb-6 mt-4"
        closable
      >
        <!-- #1 — corrected SSS text: voluntary, min ₱0 for JO -->
        <strong>PhilHealth:</strong>
        SG 15 and below = ₱500/month fixed &nbsp;·&nbsp;
        SG 16 and above = 5% of monthly wage &nbsp;·&nbsp;
        <strong>Pag-IBIG</strong> min ₱400 (mandatory) &nbsp;·&nbsp;
        <strong>SSS</strong> voluntary — min ₱760 if deducting, ₱0 if opted out &nbsp;·&nbsp;
        <strong>EWT</strong> 5% after ₱250,000 annual gross, editable per employee
      </VAlert>

      <!-- ── Summary Cards ── -->
      <VRow class="mb-6">
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="primary" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-account-group-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ employees.length }}</div>
                <div class="text-body-2">Total JO Employees</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="success" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-check-circle-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalSet }}</div>
                <div class="text-body-2">Deductions Set</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="warning" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-alert-circle-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalNotSet }}</div>
                <div class="text-body-2">Deductions Not Set</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- ── Filter ── -->
      <VRow class="mb-4" dense>
        <VCol cols="12" sm="6" md="4">
          <VSelect
            v-model="filterStatus"
            label="Filter by Status"
            :items="['All', 'Set', 'Not Set']"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-filter-outline"
            hide-details
          />
        </VCol>
      </VRow>

      <!-- ── Table ── -->
      <BaseTable
        title="JO Employee Deductions"
        :headers="TABLE_HEADERS"
        :items="filteredItems"
        :loading="loading"
        :items-per-page="10"
        searchable
        @edit="openEdit"
      >
        <template #item.salary_grade="{ item }">
          <VChip
            :color="item.salary_grade >= SG_CUTOFF ? 'purple' : 'default'"
            size="small"
            variant="tonal"
            label
          >
            SG {{ item.salary_grade || '—' }}
          </VChip>
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="item.status === 'Set' ? 'success' : 'warning'"
            size="small"
            variant="tonal"
            label
          >
            <VIcon
              start
              :icon="item.status === 'Set' ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'"
              size="14"
            />
            {{ item.status }}
          </VChip>
        </template>

        <template #item.ewtDisp="{ item }">
          <VChip v-if="item.deductions" color="secondary" size="small" variant="tonal" label>
            {{ item.ewtDisp }}
          </VChip>
          <span v-else class="text-medium-emphasis">—</span>
        </template>
      </BaseTable>

    </VContainer>

    <!-- ── Edit Modal ── -->
    <BaseModal
      v-model="modalOpen"
      :title="`${isEditing ? 'Edit' : 'Set'} Deductions — ${selectedEmp?.name ?? ''}`"
      width="600"
      :persistent="true"
      :loading="modalLoading || resetLoading"
      confirm-text="Save Deductions"
      cancel-text="Cancel"
      @confirm="handleSave"
      @cancel="modalOpen = false"
    >
      <VRow dense>

        <!-- Employee Info -->
        <VCol cols="12">
          <VCard variant="tonal" color="default" rounded="lg" class="mb-2">
            <VCardText class="d-flex flex-wrap gap-6 py-3">
              <div>
                <div class="text-caption text-medium-emphasis">Position</div>
                <div class="text-body-2 font-weight-medium">{{ selectedEmp?.position ?? '—' }}</div>
              </div>
              <div>
                <div class="text-caption text-medium-emphasis">Salary Grade</div>
                <VChip
                  :color="(selectedEmp?.salary_grade ?? 0) >= SG_CUTOFF ? 'purple' : 'default'"
                  size="small"
                  variant="tonal"
                  label
                  class="mt-1"
                >
                  SG {{ selectedEmp?.salary_grade ?? '—' }}
                </VChip>
              </div>
              <div>
                <div class="text-caption text-medium-emphasis">PhilHealth Mode</div>
                <div class="text-body-2 font-weight-medium">
                  {{ (selectedEmp?.salary_grade ?? 0) >= SG_CUTOFF ? '5% of monthly wage' : '₱500 fixed/month' }}
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <!-- #4 — Reset button, only shown when editing existing deductions -->
        <VCol v-if="isEditing" cols="12">
          <VAlert type="warning" variant="tonal" density="compact" icon="mdi-alert-outline">
            <div class="d-flex align-center justify-space-between flex-wrap gap-2">
              <span class="text-body-2">
                Existing deductions are set for this employee.
              </span>
              <VBtn
                size="small"
                color="error"
                variant="outlined"
                prepend-icon="mdi-delete-outline"
                :loading="resetLoading"
                @click="confirmResetDialog = true"
              >
                Clear Deductions
              </VBtn>
            </div>
          </VAlert>
        </VCol>

        <!-- Wage -->
        <VCol cols="12" class="mt-1">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
            Monthly Wage
          </p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="6">
          <VTextField
            v-model.number="form.wage"
            label="Monthly Wage"
            type="number"
            prefix="₱"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-cash-outline"
            :error-messages="formErrors.wage"
            hint="Enter the employee's monthly wage."
            persistent-hint
            min="0.01"
          />
        </VCol>

        <!-- Government Contributions -->
        <VCol cols="12" class="mt-2">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
            Government Contributions
          </p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="4">
          <VTextField
            v-model.number="form.philhealth"
            label="PhilHealth"
            type="number"
            prefix="₱"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-hospital-box-outline"
            :error-messages="formErrors.philhealth"
            :hint="philhealthHint"
            persistent-hint
            :min="philhealthMin"
            :readonly="(selectedEmp?.salary_grade ?? 0) >= SG_CUTOFF"
          />
        </VCol>

        <VCol cols="12" sm="4">
          <VTextField
            v-model.number="form.pag_ibig"
            label="Pag-IBIG"
            type="number"
            prefix="₱"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-home-outline"
            :error-messages="formErrors.pag_ibig"
            :hint="`Min: ${fmt(PAGIBIG_MIN)}/month (mandatory)`"
            persistent-hint
            :min="PAGIBIG_MIN"
          />
        </VCol>

        <!-- SSS — toggle opt-in, then show amount field only if opted in -->
        <VCol cols="12" sm="4">
          <div class="d-flex flex-column gap-2">
            <VSwitch
              v-model="sssOptIn"
              color="primary"
              density="compact"
              hide-details
              :label="sssOptIn ? 'SSS: Deducting' : 'SSS: Not deducting'"
              @update:model-value="val => { if (!val) form.sss = 0; else if (form.sss === 0) form.sss = SSS_MIN }"
            />
            <VTextField
              v-if="sssOptIn"
              v-model.number="form.sss"
              label="SSS Amount"
              type="number"
              prefix="₱"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-shield-check-outline"
              :error-messages="formErrors.sss"
              :hint="`Min: ${fmt(SSS_MIN)}/month`"
              persistent-hint
              :min="SSS_MIN"
            />
            <p v-else class="text-caption text-medium-emphasis mb-0">
              Employee opted out — SSS will be recorded as ₱0.
            </p>
          </div>
        </VCol>

        <!-- EWT -->
        <VCol cols="12" class="mt-2">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
            Expanded Withholding Tax (EWT)
          </p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="5">
          <VTextField
            v-model.number="form.ewt_rate"
            label="EWT Rate"
            type="number"
            suffix="%"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-percent-outline"
            :error-messages="formErrors.ewt_rate"
            hint="Default 5%. Applied after ₱250,000 annual gross threshold."
            persistent-hint
            min="0"
            max="100"
            step="0.01"
          />
        </VCol>

        <VCol cols="12" sm="7" class="d-flex align-center">
          <VAlert
            type="info"
            variant="tonal"
            density="compact"
            icon="mdi-information-outline"
            class="text-body-2 w-100"
          >
            EWT applies only after cumulative annual gross exceeds
            <strong>₱250,000</strong>. Only the excess is taxed in the crossing month.
          </VAlert>
        </VCol>

        <!-- Preview -->
        <VCol v-if="preview" cols="12" class="mt-2">
          <VCard variant="tonal" color="success" rounded="lg">
            <VCardText class="py-3">
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-2">
                Estimated Monthly Deduction Summary
              </p>
              <VRow dense>
                <VCol cols="6">
                  <div class="text-caption text-medium-emphasis">Total Deductions (excl. EWT)</div>
                  <div class="text-body-1 font-weight-bold">{{ preview.totalDeductions }}</div>
                </VCol>
                <VCol cols="6">
                  <div class="text-caption text-medium-emphasis">Est. Net Pay (excl. EWT)</div>
                  <div class="text-body-1 font-weight-bold text-success">{{ preview.estimatedNet }}</div>
                </VCol>
              </VRow>
              <p class="text-caption text-medium-emphasis mt-2 mb-0">
                <VIcon icon="mdi-information-outline" size="12" class="mr-1" />
                EWT and premium are excluded — computed per payroll period.
              </p>
            </VCardText>
          </VCard>
        </VCol>

      </VRow>
    </BaseModal>

    <!-- ── #3 Save Confirmation Dialog ── -->
    <VDialog v-model="confirmSaveDialog" max-width="420" persistent>
      <VCard>
        <VCardTitle class="pt-5 px-5">
          {{ isEditing ? 'Overwrite Deductions?' : 'Save Deductions?' }}
        </VCardTitle>
        <VCardText class="px-5">
          <span v-if="isEditing">
            You are about to <strong>overwrite</strong> the existing deductions for
            <strong>{{ selectedEmp?.name }}</strong>. This will replace all current values.
            Are you sure?
          </span>
          <span v-else>
            Save deductions for <strong>{{ selectedEmp?.name }}</strong>? You can edit or
            clear them later from this page.
          </span>
        </VCardText>
        <VCardActions class="justify-end px-5 pb-4">
          <VBtn variant="text" @click="confirmSaveDialog = false">Cancel</VBtn>
          <VBtn color="primary" :loading="modalLoading" @click="executeSave">
            {{ isEditing ? 'Yes, Overwrite' : 'Yes, Save' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── #4 Reset Confirmation Dialog ── -->
    <VDialog v-model="confirmResetDialog" max-width="420" persistent>
      <VCard>
        <VCardTitle class="pt-5 px-5">Clear Deductions?</VCardTitle>
        <VCardText class="px-5">
          This will <strong>permanently delete</strong> all deduction records for
          <strong>{{ selectedEmp?.name }}</strong>, including wage, PhilHealth, Pag-IBIG,
          SSS, and EWT rate. This cannot be undone.
        </VCardText>
        <VCardActions class="justify-end px-5 pb-4">
          <VBtn variant="text" @click="confirmResetDialog = false">Cancel</VBtn>
          <VBtn color="error" :loading="resetLoading" @click="executeReset">
            Yes, Clear Deductions
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Alert ── -->
    <BaseAlert
      v-model="alertVisible"
      :message="alertMessage"
      :type="alertType"
      :timeout="3500"
    />
  </div>
</template>
