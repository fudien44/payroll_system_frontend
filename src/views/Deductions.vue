<script setup lang="ts">
import BaseCard from '@/components/base/BaseCard.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseConfirmDialog from '@/components/base/BaseConfirmDialog.vue'
import BaseAlert from '@/components/base/BaseAlert.vue'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
type DeductionType      = 'SSS' | 'PhilHealth' | 'Pag-IBIG'
type ComputationType    = 'Fixed' | 'Percentage'
type DeductionStatus    = 'Active' | 'Inactive'
type AlertType          = 'success' | 'error' | 'warning' | 'info'

interface Deduction {
  id:              number
  type:            DeductionType
  name:            string
  computationType: ComputationType
  amount:          number        // fixed peso amount
  rate:            number        // percentage (0–100)
  description:     string
  status:          DeductionStatus
}

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const DEDUCTION_TYPES: DeductionType[]   = ['SSS', 'PhilHealth', 'Pag-IBIG']
const COMPUTATION_TYPES: ComputationType[] = ['Fixed', 'Percentage']

const TYPE_META: Record<DeductionType, { icon: string; color: string; description: string }> = {
  'SSS':        { icon: 'mdi-shield-check-outline',    color: 'primary',  description: 'Social Security System' },
  'PhilHealth': { icon: 'mdi-hospital-box-outline',    color: 'success',  description: 'National Health Insurance' },
  'Pag-IBIG':   { icon: 'mdi-home-outline',            color: 'purple',   description: 'Home Development Mutual Fund' },
}

const TABLE_HEADERS = [
  { title: 'Type',             key: 'type',            sortable: true  },
  { title: 'Name',             key: 'name',            sortable: true  },
  { title: 'Computation',      key: 'computationType', sortable: true  },
  { title: 'Amount / Rate',    key: 'amountDisplay',   sortable: false, align: 'end' as const },
  { title: 'Description',      key: 'description',     sortable: false },
  { title: 'Status',           key: 'status',          sortable: true  },
  { title: 'Actions',          key: 'actions',         sortable: false, align: 'center' as const },
]

const BLANK_FORM = (): Omit<Deduction, 'id'> => ({
  type:            'SSS',
  name:            '',
  computationType: 'Fixed',
  amount:          0,
  rate:            0,
  description:     '',
  status:          'Active',
})

/* ─────────────────────────────────────────
   SEED DATA
───────────────────────────────────────── */
let nextId = 10

const deductions = ref<Deduction[]>([
  {
    id: 1, type: 'SSS', name: 'SSS – Employee Share',
    computationType: 'Percentage', amount: 0, rate: 4.5,
    description: 'Employee counterpart based on monthly salary credit.',
    status: 'Active',
  },
  {
    id: 2, type: 'SSS', name: 'SSS – WISP',
    computationType: 'Fixed', amount: 200, rate: 0,
    description: 'Workers\' Investment and Savings Program add-on.',
    status: 'Active',
  },
  {
    id: 3, type: 'PhilHealth', name: 'PhilHealth – Standard Premium',
    computationType: 'Percentage', amount: 0, rate: 2.5,
    description: 'Employee share (50%) of the 5% monthly premium.',
    status: 'Active',
  },
  {
    id: 4, type: 'PhilHealth', name: 'PhilHealth – Minimum Cap',
    computationType: 'Fixed', amount: 500, rate: 0,
    description: 'Applies when computed premium falls below the floor.',
    status: 'Inactive',
  },
  {
    id: 5, type: 'Pag-IBIG', name: 'Pag-IBIG – Regular Contribution',
    computationType: 'Fixed', amount: 100, rate: 0,
    description: 'Standard monthly employee contribution.',
    status: 'Active',
  },
  {
    id: 6, type: 'Pag-IBIG', name: 'Pag-IBIG – MP2 Savings',
    computationType: 'Fixed', amount: 500, rate: 0,
    description: 'Voluntary Modified Pag-IBIG II savings program.',
    status: 'Inactive',
  },
])

/* ─────────────────────────────────────────
   STATE — Modal
───────────────────────────────────────── */
const modalOpen    = ref(false)
const modalLoading = ref(false)
const isEditing    = ref(false)
const editId       = ref<number | null>(null)
const form         = ref(BLANK_FORM())
const formErrors   = ref<Partial<Record<keyof Deduction, string>>>({})

/* ─────────────────────────────────────────
   STATE — Confirm Delete
───────────────────────────────────────── */
const confirmOpen    = ref(false)
const confirmLoading = ref(false)
const deleteTarget   = ref<Deduction | null>(null)

/* ─────────────────────────────────────────
   STATE — Alert
───────────────────────────────────────── */
const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

/* ─────────────────────────────────────────
   STATE — Filters
───────────────────────────────────────── */
const filterType   = ref<DeductionType | 'All'>('All')
const filterStatus = ref<DeductionStatus | 'All'>('All')

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const filteredDeductions = computed(() =>
  deductions.value.filter(d => {
    const matchType   = filterType.value   === 'All' || d.type   === filterType.value
    const matchStatus = filterStatus.value === 'All' || d.status === filterStatus.value
    return matchType && matchStatus
  })
)

const tableItems = computed(() =>
  filteredDeductions.value.map(d => ({
    ...d,
    amountDisplay: d.computationType === 'Fixed'
      ? fmt(d.amount)
      : `${d.rate}%`,
  }))
)

// Summary counts per type (active only)
const countByType = (type: DeductionType) =>
  computed(() => deductions.value.filter(d => d.type === type && d.status === 'Active').length)

const sssCount       = countByType('SSS')
const philhealthCount = countByType('PhilHealth')
const pagibigCount   = countByType('Pag-IBIG')
const totalActive    = computed(() => deductions.value.filter(d => d.status === 'Active').length)

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const fmt = (v: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(v)

function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}

function validate(): boolean {
  const errs: Partial<Record<keyof Deduction, string>> = {}
  if (!form.value.name.trim()) {
    errs.name = 'Deduction name is required.'
  }
  if (form.value.computationType === 'Fixed' && form.value.amount <= 0) {
    errs.amount = 'Amount must be greater than 0.'
  }
  if (form.value.computationType === 'Percentage') {
    if (form.value.rate <= 0)   errs.rate = 'Rate must be greater than 0.'
    if (form.value.rate > 100)  errs.rate = 'Rate cannot exceed 100%.'
  }

  // Duplicate name within same type
  const duplicate = deductions.value.find(
    d => d.name.toLowerCase() === form.value.name.trim().toLowerCase()
      && d.type === form.value.type
      && d.id   !== editId.value
  )
  if (duplicate) errs.name = 'A deduction with this name already exists for this type.'

  formErrors.value = errs
  return Object.keys(errs).length === 0
}

/* ─────────────────────────────────────────
   HANDLERS — Modal
───────────────────────────────────────── */
function openAdd() {
  isEditing.value  = false
  editId.value     = null
  form.value       = BLANK_FORM()
  formErrors.value = {}
  modalOpen.value  = true
}

function openEdit(item: Record<string, any>) {
  const target = deductions.value.find(d => d.id === item.id)
  if (!target) return
  isEditing.value  = true
  editId.value     = target.id
  form.value       = { ...target }
  formErrors.value = {}
  modalOpen.value  = true
}

async function handleSave() {
  if (!validate()) return

  modalLoading.value = true
  await new Promise(r => setTimeout(r, 500))

  const payload: Omit<Deduction, 'id'> = {
    type:            form.value.type,
    name:            form.value.name.trim(),
    computationType: form.value.computationType,
    amount:          form.value.computationType === 'Fixed'      ? Number(form.value.amount) : 0,
    rate:            form.value.computationType === 'Percentage'  ? Number(form.value.rate)   : 0,
    description:     form.value.description.trim(),
    status:          form.value.status,
  }

  if (isEditing.value && editId.value !== null) {
    deductions.value = deductions.value.map(d =>
      d.id === editId.value ? { id: d.id, ...payload } : d
    )
    showAlert('success', `"${payload.name}" has been updated.`)
  } else {
    deductions.value.push({ id: ++nextId, ...payload })
    showAlert('success', `"${payload.name}" has been added.`)
  }

  modalLoading.value = false
  modalOpen.value    = false
}

/* ─────────────────────────────────────────
   HANDLERS — Delete
───────────────────────────────────────── */
function openDelete(item: Record<string, any>) {
  deleteTarget.value = deductions.value.find(d => d.id === item.id) ?? null
  confirmOpen.value  = true
}

async function handleDeleteConfirm() {
  if (!deleteTarget.value) return
  confirmLoading.value = true
  await new Promise(r => setTimeout(r, 500))
  deductions.value = deductions.value.filter(d => d.id !== deleteTarget.value!.id)
  showAlert('info', `"${deleteTarget.value.name}" has been removed.`)
  confirmLoading.value = false
  confirmOpen.value    = false
  deleteTarget.value   = null
}

function handleDeleteCancel() {
  confirmOpen.value  = false
  deleteTarget.value = null
}
</script>

<template>
  <div>
    <VContainer fluid class="pa-6">

      <!-- ── Page Header ── -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-2">
        <div>
          <h4 class="text-h5 font-weight-bold mb-1">Deduction</h4>
        </div>
        <VBtn color="primary" prepend-icon="mdi-plus" @click="openAdd">
          New Deduction
        </VBtn>
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
        Deductions defined here are <strong>presets</strong>. When you process a payroll,
        you'll choose which of these to apply per employee.
      </VAlert>

      <!-- ── Summary Cards ── -->
      <VRow class="mb-6">
        <VCol cols="12" sm="6" lg="3">
          <BaseCard
            title="Active SSS Presets"
            :value="sssCount"
            icon="mdi-shield-check-outline"
            color="primary"
          />
        </VCol>
        <VCol cols="12" sm="6" lg="3">
          <BaseCard
            title="Active PhilHealth Presets"
            :value="philhealthCount"
            icon="mdi-hospital-box-outline"
            color="success"
          />
        </VCol>
        <VCol cols="12" sm="6" lg="3">
          <BaseCard
            title="Active Pag-IBIG Presets"
            :value="pagibigCount"
            icon="mdi-home-outline"
            color="purple"
          />
        </VCol>
        <VCol cols="12" sm="6" lg="3">
          <BaseCard
            title="Total Active Presets"
            :value="totalActive"
            icon="mdi-format-list-checks"
            color="warning"
          />
        </VCol>
      </VRow>

      <!-- ── Filters ── -->
      <VRow class="mb-4" dense>
        <VCol cols="12" sm="6" md="4">
          <VSelect
            v-model="filterType"
            label="Filter by Type"
            :items="['All', ...DEDUCTION_TYPES]"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-filter-outline"
            hide-details
          />
        </VCol>
        <VCol cols="12" sm="6" md="4">
          <VSelect
            v-model="filterStatus"
            label="Filter by Status"
            :items="['All', 'Active', 'Inactive']"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-toggle-switch-outline"
            hide-details
          />
        </VCol>
      </VRow>

      <!-- ── Table ── -->
      <BaseTable
        title="Deduction Presets"
        :headers="TABLE_HEADERS"
        :items="tableItems"
        :items-per-page="10"
        searchable
        @edit="openEdit"
        @delete="openDelete"
      >
        <!-- Type chip -->
        <template #item.type="{ item }">
          <VChip
            :color="TYPE_META[item.type as DeductionType].color"
            :prepend-icon="TYPE_META[item.type as DeductionType].icon"
            size="small"
            variant="tonal"
            label
          >
            {{ item.type }}
          </VChip>
        </template>

        <!-- Computation type chip -->
        <template #item.computationType="{ item }">
          <VChip
            :color="item.computationType === 'Fixed' ? 'info' : 'secondary'"
            :prepend-icon="item.computationType === 'Fixed' ? 'mdi-currency-php' : 'mdi-percent-outline'"
            size="small"
            variant="tonal"
            label
          >
            {{ item.computationType }}
          </VChip>
        </template>

        <!-- Amount / Rate aligned end -->
        <template #item.amountDisplay="{ item }">
          <span class="font-weight-bold">{{ item.amountDisplay }}</span>
        </template>

        <!-- Status chip -->
        <template #item.status="{ item }">
          <VChip
            :color="item.status === 'Active' ? 'success' : 'default'"
            size="small"
            variant="tonal"
            label
          >
            <VIcon start :icon="item.status === 'Active' ? 'mdi-check-circle-outline' : 'mdi-close-circle-outline'" size="14" />
            {{ item.status }}
          </VChip>
        </template>

        <!-- Description truncated -->
        <template #item.description="{ item }">
          <span class="text-medium-emphasis text-body-2">
            {{ item.description || '—' }}
          </span>
        </template>
      </BaseTable>

    </VContainer>

    <!-- ── Add / Edit Modal ── -->
    <BaseModal
      v-model="modalOpen"
      :title="isEditing ? 'Edit Deduction Preset' : 'New Deduction Preset'"
      width="580"
      :persistent="true"
      :loading="modalLoading"
      :confirm-text="isEditing ? 'Save Changes' : 'Add Deduction'"
      cancel-text="Cancel"
      @confirm="handleSave"
      @cancel="modalOpen = false"
    >
      <VRow dense>

        <!-- Type -->
        <VCol cols="12" sm="6">
          <VSelect
            v-model="form.type"
            label="Deduction Type"
            :items="DEDUCTION_TYPES"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-tag-outline"
            hide-details="auto"
          >
            <template #item="{ item, props: itemProps }">
              <VListItem v-bind="itemProps">
                <template #prepend>
                  <VIcon :icon="TYPE_META[item.value as DeductionType].icon" class="mr-2" />
                </template>
                <VListItemSubtitle>
                  {{ TYPE_META[item.value as DeductionType].description }}
                </VListItemSubtitle>
              </VListItem>
            </template>
          </VSelect>
        </VCol>

        <!-- Status -->
        <VCol cols="12" sm="6">
          <VSelect
            v-model="form.status"
            label="Status"
            :items="['Active', 'Inactive']"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-toggle-switch-outline"
            hide-details="auto"
          />
        </VCol>

        <!-- Name -->
        <VCol cols="12">
          <VTextField
            v-model="form.name"
            label="Deduction Name"
            placeholder="e.g. SSS – Employee Share"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-label-outline"
            :error-messages="formErrors.name"
            hint="Give this preset a clear, recognizable name."
            persistent-hint
          />
        </VCol>

        <!-- Description -->
        <VCol cols="12">
          <VTextarea
            v-model="form.description"
            label="Description"
            placeholder="Briefly describe when this deduction applies..."
            variant="outlined"
            density="compact"
            rows="2"
            hide-details="auto"
            no-resize
          />
        </VCol>

        <!-- Divider -->
        <VCol cols="12">
          <VDivider class="my-1" />
          <p class="text-caption text-medium-emphasis font-weight-medium mt-2 mb-0 text-uppercase">
            Computation
          </p>
        </VCol>

        <!-- Computation Type toggle -->
        <VCol cols="12">
          <VBtnToggle
            v-model="form.computationType"
            mandatory
            rounded="lg"
            density="compact"
            color="primary"
          >
            <VBtn value="Fixed" prepend-icon="mdi-currency-php">
              Fixed Amount
            </VBtn>
            <VBtn value="Percentage" prepend-icon="mdi-percent-outline">
              Percentage of Salary
            </VBtn>
          </VBtnToggle>
        </VCol>

        <!-- Fixed Amount -->
        <VCol v-if="form.computationType === 'Fixed'" cols="12" sm="6">
          <VTextField
            v-model.number="form.amount"
            label="Fixed Amount"
            type="number"
            prefix="₱"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-cash-outline"
            :error-messages="formErrors.amount"
            hint="Exact peso amount to deduct."
            persistent-hint
            min="0"
          />
        </VCol>

        <!-- Percentage Rate -->
        <VCol v-if="form.computationType === 'Percentage'" cols="12" sm="6">
          <VTextField
            v-model.number="form.rate"
            label="Rate"
            type="number"
            suffix="%"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-percent-outline"
            :error-messages="formErrors.rate"
            hint="Percentage of employee's basic salary."
            persistent-hint
            min="0"
            max="100"
            step="0.01"
          />
        </VCol>

        <!-- Preview -->
        <VCol cols="12">
          <VAlert
            type="info"
            :color="form.type === 'SSS' ? 'primary' : form.type === 'PhilHealth' ? 'success' : 'secondary'"
            variant="tonal"
            density="compact"
            :icon="TYPE_META[form.type].icon"
          >
            <strong>Preview:</strong>
            This preset will deduct
            <strong>
              {{ form.computationType === 'Fixed'
                  ? fmt(Number(form.amount) || 0)
                  : `${Number(form.rate) || 0}% of basic salary`
              }}
            </strong>
            as <strong>{{ form.type }}</strong> contribution.
          </VAlert>
        </VCol>

      </VRow>
    </BaseModal>

    <!-- ── Confirm Delete ── -->
    <BaseConfirmDialog
      v-model="confirmOpen"
      title="Remove Deduction Preset?"
      :message="`'${deleteTarget?.name}' will be permanently removed. Any payroll entries referencing this preset will retain their computed values.`"
      confirm-text="Remove"
      cancel-text="Cancel"
      :loading="confirmLoading"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />

    <!-- ── Alert / Snackbar ── -->
    <BaseAlert
      v-model="alertVisible"
      :message="alertMessage"
      :type="alertType"
      :timeout="3500"
    />
  </div>
</template>