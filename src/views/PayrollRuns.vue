<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import axios from '@axios'
import { useRouter } from 'vue-router'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Division {
  id:          number
  office:      string
  description: string
}

interface Section {
  id:        number
  office:    number   // FK to division id
  shortcode: string
  station:   string
}

interface PayrollRun {
  id:            number
  payroll_no:    string
  period_month:  number
  period_year:   number
  division_id:   number
  division_name: string
  section_name:  string | null   // NEW: backend already returns this, type was just missing it
  fund_cluster:  string
  saa_no:        string | null
  ors_no:        string | null
  dv_no:         string | null
  jev_no:        string | null
  status:        'draft' | 'finalized'
  employee_count: number
  total_net_pay:  number
  created_at:    string
  updated_at:    string
}

type AlertType = 'success' | 'error' | 'warning' | 'info'

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const TABLE_HEADERS = [
  { title: 'Payroll No.',   key: 'payroll_no',    sortable: true                         },
  { title: 'Period',        key: 'period',         sortable: true                         },
  { title: 'Section / Division', key: 'division_name',  sortable: true                         },
  { title: 'Fund Cluster',  key: 'fund_cluster',   sortable: false                        },
  { title: 'Employees',     key: 'employee_count', sortable: true,  align: 'center' as const },
  { title: 'Total Net Pay', key: 'netPayDisp',     sortable: false, align: 'end'    as const },
  { title: 'Status',        key: 'status',         sortable: true                         },
  { title: 'Actions',       key: 'actions',        sortable: false, align: 'center' as const },
]

const BLANK_FORM = () => ({
  period_month: new Date().getMonth() + 1,
  period_year:  new Date().getFullYear(),
  division_id:  null as number | null,
  section_id:   null as number | null,
  fund_cluster: '',
  saa_no:       '',
  ors_no:       '',
  dv_no:        '',
  jev_no:       '',
})

const CURRENT_YEAR  = new Date().getFullYear()
const YEAR_OPTIONS  = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i)
const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({ title: name, value: i + 1 }))

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const router       = useRouter()
const runs         = ref<PayrollRun[]>([])
const divisions    = ref<Division[]>([])
const sections     = ref<Section[]>([])
const sectionsLoading = ref(false)
const loading      = ref(false)
const modalOpen    = ref(false)
const modalLoading = ref(false)
const form         = ref(BLANK_FORM())
const formErrors   = ref<Record<string, string>>({})
const filterStatus = ref<'All' | 'draft' | 'finalized'>('All')

const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

const confirmDeleteDialog = ref(false)
const deleteTarget        = ref<PayrollRun | null>(null)
const deleteLoading       = ref(false)

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const filteredItems = computed(() =>
  runs.value
    .filter(r => filterStatus.value === 'All' || r.status === filterStatus.value)
    .map(r => ({
      ...r,
      period:     `${MONTH_NAMES[r.period_month - 1]} ${r.period_year}`,
      netPayDisp: fmt(r.total_net_pay),
    }))
)

const totalDraft     = computed(() => runs.value.filter(r => r.status === 'draft').length)
const totalFinalized = computed(() => runs.value.filter(r => r.status === 'finalized').length)

const divisionOptions = computed(() =>
  divisions.value.map(d => ({ title: d.description, value: d.id }))
)

const sectionOptions = computed(() =>
  sections.value.map(s => ({ title: s.station, value: s.id }))
)

// When division changes, reset section and reload sections list
watch(() => form.value.division_id, async (divId) => {
  form.value.section_id = null
  sections.value        = []
  if (!divId) return
  sectionsLoading.value = true
  try {
    const { data } = await axios.get(`/api/divisions/${divId}/sections`)
    sections.value = data.data ?? []
  } catch {
    showAlert('error', 'Failed to load sections.')
  } finally {
    sectionsLoading.value = false
  }
})

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const fmt = (v: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
  }).format(v ?? 0)

function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}

function validate(): boolean {
  const errs: Record<string, string> = {}
  if (!form.value.period_month) errs.period_month = 'Period month is required.'
  if (!form.value.period_year)  errs.period_year  = 'Period year is required.'
  if (!form.value.division_id)  errs.division_id  = 'Division is required.'
  if (!form.value.section_id)   errs.section_id   = 'Section is required.'
  if (!form.value.fund_cluster?.trim()) errs.fund_cluster = 'Fund cluster is required.'
  formErrors.value = errs
  return Object.keys(errs).length === 0
}

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */
async function fetchRuns() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/payroll-run')
    runs.value = data.data ?? []
  } catch {
    showAlert('error', 'Failed to load payroll runs.')
  } finally {
    loading.value = false
  }
}

async function fetchDivisions() {
  try {
    const { data } = await axios.get('/api/divisions')
    divisions.value = data.data ?? []
  } catch {
    showAlert('error', 'Failed to load divisions.')
  }
}
const dtrNotSavedDialog  = ref(false)
const dtrNotSavedMessage = ref('')
const dtrNotSavedPeriod  = ref('')
async function handleCreate() {
  if (!validate()) return
  modalLoading.value = true
  try {
    const { data } = await axios.post('/api/payroll-run', form.value)
    if (!data.success) throw new Error(data.message ?? 'Failed to create.')
    showAlert('success', `Payroll run created: ${data.data.payroll_no}`)
    modalOpen.value = false
    router.push({ name: 'payroll-run-detail', params: { id: data.data.id } })
  } catch (err: any) {
    const resData = err.response?.data
    if (resData?.dtr_not_saved) {
      modalOpen.value          = false
      dtrNotSavedMessage.value = resData.message
      dtrNotSavedPeriod.value  = `${MONTH_NAMES[form.value.period_month - 1]} ${form.value.period_year}`
      dtrNotSavedDialog.value  = true
      return
    }
    if (err.response?.data?.errors) {
      formErrors.value = Object.fromEntries(
        Object.entries(err.response.data.errors).map(([k, v]) => [k, (v as string[])[0]])
      )
    }
    showAlert('error', resData?.message ?? err.message ?? 'Failed to create.')
  } finally {
    modalLoading.value = false
  }
}

async function executeDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    const { data } = await axios.post(`/api/payroll-run/delete/${deleteTarget.value.id}`)
    if (!data.success) throw new Error(data.message ?? 'Failed to delete.')
    runs.value = runs.value.filter(r => r.id !== deleteTarget.value!.id)
    showAlert('success', 'Payroll run deleted.')
    confirmDeleteDialog.value = false
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to delete.')
  } finally {
    deleteLoading.value = false
  }
}

/* ─────────────────────────────────────────
   HANDLERS
───────────────────────────────────────── */
function openCreate() {
  form.value       = BLANK_FORM()
  formErrors.value = {}
  modalOpen.value  = true
}

function openDetail(item: Record<string, any>) {
  router.push({ name: 'payroll-run-detail', params: { id: item.id } })
}

function openDeleteConfirm(item: Record<string, any>) {
  const run = runs.value.find(r => r.id === item.id)
  if (!run) return
  if (run.status === 'finalized') {
    showAlert('warning', 'Finalized payroll runs cannot be deleted.')
    return
  }
  deleteTarget.value        = run
  confirmDeleteDialog.value = true
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(() => {
  fetchRuns()
  fetchDivisions()
})
</script>

<template>
  <div>
    <VContainer fluid class="pa-6">

      <!-- ── Page Header ── -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-2">
        <div>
          <h4 class="text-h5 font-weight-bold mb-1">Payroll Runs</h4>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Create and manage monthly payroll runs per division. Generate official payroll documents from finalized runs.
          </p>
        </div>
        <VBtn color="primary" prepend-icon="mdi-plus" @click="openCreate">
          New Payroll Run
        </VBtn>
      </div>

      <!-- ── Summary Cards ── -->
      <VRow class="mb-5 mt-2" dense>
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="primary" rounded="lg" flat>
            <VCardText class="d-flex align-center gap-3 py-4">
              <VAvatar color="primary" variant="tonal" size="44" rounded="lg">
                <VIcon icon="mdi-file-document-multiple-outline" size="22" />
              </VAvatar>
              <div>
                <div class="text-h5 font-weight-bold">{{ runs.length }}</div>
                <div class="text-body-2 text-medium-emphasis">Total Runs</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="warning" rounded="lg" flat>
            <VCardText class="d-flex align-center gap-3 py-4">
              <VAvatar color="warning" variant="tonal" size="44" rounded="lg">
                <VIcon icon="mdi-pencil-outline" size="22" />
              </VAvatar>
              <div>
                <div class="text-h5 font-weight-bold">{{ totalDraft }}</div>
                <div class="text-body-2 text-medium-emphasis">Draft</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="success" rounded="lg" flat>
            <VCardText class="d-flex align-center gap-3 py-4">
              <VAvatar color="success" variant="tonal" size="44" rounded="lg">
                <VIcon icon="mdi-check-circle-outline" size="22" />
              </VAvatar>
              <div>
                <div class="text-h5 font-weight-bold">{{ totalFinalized }}</div>
                <div class="text-body-2 text-medium-emphasis">Finalized</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- ── Filter Pills ── -->
      <div class="d-flex gap-2 mb-3 flex-wrap">
        <VChip
          v-for="opt in [
            { label: 'All',       value: 'All'       },
            { label: 'Draft',     value: 'draft'     },
            { label: 'Finalized', value: 'finalized' },
          ]"
          :key="opt.value"
          :color="
            filterStatus === opt.value
              ? opt.value === 'finalized' ? 'success'
              : opt.value === 'draft'     ? 'warning'
              : 'primary'
              : undefined
          "
          :variant="filterStatus === opt.value ? 'tonal' : 'outlined'"
          size="small"
          label
          style="cursor:pointer"
          @click="filterStatus = opt.value as typeof filterStatus"
        >
          {{ opt.label }}
        </VChip>
      </div>

      <!-- ── Table ── -->
      <BaseTable
        title="Payroll Runs"
        :headers="TABLE_HEADERS"
        :items="filteredItems"
        :loading="loading"
        :items-per-page="10"
        searchable
        :filter-keys="['payroll_no', 'period', 'division_name', 'section_name', 'fund_cluster', 'status']"
        @edit="openDetail"
        @delete="openDeleteConfirm"
      >
        <!-- Payroll No -->
        <template #item.payroll_no="{ item }">
          <span class="text-body-2 font-weight-medium font-monospace">{{ item.payroll_no }}</span>
        </template>

        <!-- Period -->
        <template #item.period="{ item }">
          <div class="d-flex align-center gap-2">
            <VIcon icon="mdi-calendar-month-outline" size="15" class="text-medium-emphasis" />
            <span class="text-body-2">{{ item.period }}</span>
          </div>
        </template>

        <!-- Section / Division -->
        <template #item.division_name="{ item }">
          <div class="d-flex align-center gap-2">
            <VIcon icon="mdi-domain" size="15" class="text-medium-emphasis" />
            <div>
              <div v-if="item.section_name" class="text-body-2">{{ item.section_name }}</div>
              <div class="d-flex align-center gap-1 text-caption text-medium-emphasis" :class="{ 'text-body-2': !item.section_name }">
                <VIcon v-if="item.section_name" icon="mdi-subdirectory-arrow-right" size="11" />
                {{ item.division_name }}
              </div>
            </div>
          </div>
        </template>

        <!-- Employee count -->
        <template #item.employee_count="{ item }">
          <VChip color="primary" size="small" variant="tonal" label>
            {{ item.employee_count }}
          </VChip>
        </template>

        <!-- Status -->
        <template #item.status="{ item }">
          <VChip
            :color="item.status === 'finalized' ? 'success' : 'warning'"
            size="small"
            variant="tonal"
            label
          >
            <VIcon
              start
              :icon="item.status === 'finalized' ? 'mdi-check-circle-outline' : 'mdi-pencil-outline'"
              size="14"
            />
            {{ item.status === 'finalized' ? 'Finalized' : 'Draft' }}
          </VChip>
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-1">
            <VBtn icon size="small" variant="text" color="primary" @click.stop="openDetail(item)">
              <VIcon size="18">mdi-eye-outline</VIcon>
              <VTooltip activator="parent" location="top">View Details</VTooltip>
            </VBtn>
            <VBtn
              v-if="item.status === 'draft'"
              icon size="small" variant="text" color="error"
              @click.stop="openDeleteConfirm(item)"
            >
              <VIcon size="18">mdi-delete-outline</VIcon>
              <VTooltip activator="parent" location="top">Delete</VTooltip>
            </VBtn>
          </div>
        </template>
      </BaseTable>

    </VContainer>

    <!-- ── Create Modal ── -->
    <BaseModal
      v-model="modalOpen"
      title="New Payroll Run"
      width="560"
      :persistent="true"
      :loading="modalLoading"
      confirm-text="Create Payroll Run"
      cancel-text="Cancel"
      @confirm="handleCreate"
      @cancel="modalOpen = false"
    >
      <VRow dense>

        <!-- Info -->
        <VCol cols="12">
          <VAlert type="info" variant="tonal" density="compact" icon="mdi-information-outline" class="mb-2">
            A payroll run covers <strong>one division</strong> for <strong>one month</strong>.
            You can add more details (SAA No., ORS No., etc.) after creation.
          </VAlert>
        </VCol>

        <!-- Period -->
        <VCol cols="12" class="mt-1">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Period Covered</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="6">
          <VSelect
            v-model="form.period_month"
            label="Month"
            :items="MONTH_OPTIONS"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-calendar-month-outline"
            :error-messages="formErrors.period_month"
          />
        </VCol>

        <VCol cols="12" sm="6">
          <VSelect
            v-model="form.period_year"
            label="Year"
            :items="YEAR_OPTIONS"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-calendar-outline"
            :error-messages="formErrors.period_year"
          />
        </VCol>

        <!-- Division -->
        <VCol cols="12" class="mt-2">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Division</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12">
          <VSelect
            v-model="form.division_id"
            label="Division"
            :items="divisionOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-domain"
            :error-messages="formErrors.division_id"
            hint="Employees will be grouped by Division → Section inside the run."
            persistent-hint
          />
        </VCol>

        <VCol cols="12">
          <VSelect
            v-model="form.section_id"
            label="Section"
            :items="sectionOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-account-group-outline"
            :loading="sectionsLoading"
            :disabled="!form.division_id || sectionsLoading"
            :error-messages="formErrors.section_id"
            hint="Select the specific section for this payroll run."
            persistent-hint
            :no-data-text="form.division_id ? 'No sections found for this division.' : 'Select a division first.'"
          />
        </VCol>

        <!-- Fund Cluster -->
        <VCol cols="12" class="mt-3">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Budget Information</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12">
          <VTextField
            v-model="form.fund_cluster"
            label="Fund Cluster"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-bank-outline"
            :error-messages="formErrors.fund_cluster"
            hint="e.g. 01, 02, 03"
            persistent-hint
          />
        </VCol>

        <!-- Optional reference numbers -->
        <VCol cols="12" class="mt-3">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
            Reference Numbers <span class="text-lowercase font-weight-regular">(optional — can be filled later)</span>
          </p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.saa_no"
            label="SAA No."
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-pound"
            hint="Sub-Allotment Advice number"
            persistent-hint
          />
        </VCol>

        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.ors_no"
            label="ORS/BURS No."
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-pound"
            hint="Obligation Request & Status"
            persistent-hint
          />
        </VCol>

        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.dv_no"
            label="DV No."
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-pound"
            hint="Disbursement Voucher number"
            persistent-hint
          />
        </VCol>

        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.jev_no"
            label="JEV No."
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-pound"
            hint="Journal Entry Voucher number"
            persistent-hint
          />
        </VCol>

      </VRow>
    </BaseModal>

    <!-- ── Delete Confirmation ── -->
    <VDialog v-model="confirmDeleteDialog" max-width="420" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar color="error" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-delete-outline" size="22" />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">Delete Payroll Run?</div>
              <div class="text-caption text-medium-emphasis">This action cannot be undone.</div>
            </div>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-0">
            You are about to delete payroll run
            <strong class="text-high-emphasis">{{ deleteTarget?.payroll_no }}</strong>
            for <strong class="text-high-emphasis">{{ deleteTarget?.division_name }}</strong>
            — {{ deleteTarget ? MONTH_NAMES[deleteTarget.period_month - 1] : '' }} {{ deleteTarget?.period_year }}.
            All associated data will be permanently removed.
          </p>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="deleteLoading" @click="confirmDeleteDialog = false">Cancel</VBtn>
          <VBtn color="error" variant="tonal" :loading="deleteLoading" @click="executeDelete">
            <VIcon start size="16">mdi-delete-outline</VIcon>
            Yes, Delete
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
    <!-- ── DTR Not Saved Dialog ── -->
<VDialog v-model="dtrNotSavedDialog" max-width="460" persistent>
  <VCard rounded="lg">
    <VCardText class="pa-6">
      <div class="d-flex align-center gap-3 mb-4">
        <VAvatar color="warning" variant="tonal" size="44" rounded="lg">
          <VIcon icon="mdi-calendar-alert-outline" size="22" />
        </VAvatar>
        <div>
          <div class="text-body-1 font-weight-medium">DTR Not Yet Saved</div>
          <div class="text-caption text-medium-emphasis">{{ dtrNotSavedPeriod }}</div>
        </div>
      </div>
      <VAlert type="warning" variant="tonal" density="compact" icon="mdi-alert-outline" class="mb-4 text-body-2">
        {{ dtrNotSavedMessage }}
      </VAlert>
      <p class="text-body-2 text-medium-emphasis mb-0">
        Go to the <strong class="text-high-emphasis">DTR module</strong> and click
        <strong class="text-high-emphasis">Save DTR</strong> for
        <strong class="text-high-emphasis">{{ dtrNotSavedPeriod }}</strong> first,
        then come back to create this payroll run.
      </p>
    </VCardText>
    <VDivider />
    <VCardActions class="justify-end pa-4 gap-2">
      <VBtn variant="text" @click="dtrNotSavedDialog = false">Cancel</VBtn>
      <VBtn
        color="warning"
        variant="tonal"
        prepend-icon="mdi-clock-outline"
        @click="dtrNotSavedDialog = false; router.push('/dtr')"

      >
        Go to DTR Module
      </VBtn>
    </VCardActions>
  </VCard>
</VDialog>
  </div>
</template>
