<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import axios from '@axios'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface RegularEmployee {
  emp_id:   number
  name:     string
  position: string
}

interface Signatory {
  id:        number
  emp_id:    number
  name:      string
  position:  string
  role:      'certified_by' | 'approved_by'
  is_active: boolean
}

type AlertType = 'success' | 'error' | 'warning' | 'info'

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const TABLE_HEADERS = [
  { title: 'Employee', key: 'name',      sortable: true                        },
  { title: 'Role',     key: 'role',      sortable: true,  align: 'center' as const },
  { title: 'Status',   key: 'is_active', sortable: true,  align: 'center' as const },
  { title: 'Actions',  key: 'actions',   sortable: false, align: 'center' as const },
]

const BLANK_FORM = () => ({
  emp_id:    null as number | null,
  role:      'certified_by' as 'certified_by' | 'approved_by',
  is_active: true,
})

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const signatories      = ref<Signatory[]>([])
const regularEmployees = ref<RegularEmployee[]>([])
const loading          = ref(false)
const empLoading       = ref(false)
const modalOpen        = ref(false)
const modalLoading     = ref(false)
const isEditing        = ref(false)
const selectedId       = ref<number | null>(null)
const form             = ref(BLANK_FORM())
const formErrors       = ref<Partial<Record<string, string>>>({})
const filterRole       = ref<'All' | 'certified_by' | 'approved_by'>('All')

const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

const confirmDeleteDialog = ref(false)
const deleteTarget        = ref<Signatory | null>(null)
const deleteLoading       = ref(false)

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const filteredItems = computed(() =>
  signatories.value
    .filter(s => filterRole.value === 'All' || s.role === filterRole.value)
    .map(s => ({ ...s }))
)

const totalCertified = computed(() =>
  signatories.value.filter(s => s.role === 'certified_by').length
)

const totalApproved = computed(() =>
  signatories.value.filter(s => s.role === 'approved_by').length
)

const availableEmployees = computed(() =>
  regularEmployees.value.filter(e => {
    const alreadyAssigned = signatories.value.some(
      s => s.emp_id === e.emp_id && s.id !== selectedId.value
    )
    return !alreadyAssigned
  })
)

const employeeOptions = computed(() =>
  availableEmployees.value.map(e => ({
    title:    e.name,
    subtitle: e.position,
    value:    e.emp_id,
  }))
)

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

const AVATAR_COLORS = ['primary', 'teal', 'orange', 'purple', 'pink', 'indigo'] as const

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}

function roleLabel(role: string) {
  return role === 'certified_by' ? 'Certified By' : 'Approved By'
}

function validate(): boolean {
  const errs: Partial<Record<string, string>> = {}
  if (!form.value.emp_id) errs.emp_id = 'Please select an employee.'
  if (!form.value.role)   errs.role   = 'Please select a role.'
  formErrors.value = errs
  return Object.keys(errs).length === 0
}

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */
async function fetchSignatories() {
  loading.value = true
  try {
    // The controller now returns a structured object when called with params.
    // When called with NO params (as this page does), we need the flat list.
    // Pass a sentinel so the backend returns selectable_pool which contains all certified_by,
    // then combine with approved_by to rebuild the flat list for this management page.
    const { data } = await axios.get('/api/signatories')
    const payload = data.data

    // Backend now returns structured object — flatten back into a list for this page
    const flat: Signatory[] = []

    if (payload?.approved_by) {
      flat.push({ ...payload.approved_by, is_active: true })
    }
    if (Array.isArray(payload?.selectable_pool)) {
      payload.selectable_pool.forEach((s: any) => {
        flat.push({ ...s, is_active: s.is_active ?? true })
      })
    }

    // Deduplicate by id in case of overlap
    const seen = new Set<number>()
    signatories.value = flat.filter(s => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })
  } catch {
    showAlert('error', 'Failed to load signatories.')
  } finally {
    loading.value = false
  }
}

async function fetchRegularEmployees() {
  empLoading.value = true
  try {
    const { data } = await axios.get('/api/employee/regulars')
    regularEmployees.value = data.data ?? []
  } catch {
    showAlert('error', 'Failed to load regular employees.')
  } finally {
    empLoading.value = false
  }
}

async function handleSave() {
  if (!validate()) return
  modalLoading.value = true
  try {
    if (isEditing.value && selectedId.value) {
      const { data } = await axios.post(`/api/signatories/${selectedId.value}/update`, form.value)
      if (!data.success) throw new Error(data.message ?? 'Update failed.')
      await fetchSignatories()
      showAlert('success', 'Signatory updated successfully.')
    } else {
      const { data } = await axios.post('/api/signatories/store', form.value)
      if (!data.success) throw new Error(data.message ?? 'Save failed.')
      await fetchSignatories()
      showAlert('success', 'Signatory added successfully.')
    }
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

async function executeDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    const { data } = await axios.post(`/api/signatories/${deleteTarget.value.id}/delete`)
    if (!data.success) throw new Error(data.message ?? 'Delete failed.')
    signatories.value = signatories.value.filter(s => s.id !== deleteTarget.value!.id)
    showAlert('success', `${deleteTarget.value.name} removed from signatories.`)
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
function openAdd() {
  isEditing.value  = false
  selectedId.value = null
  form.value       = BLANK_FORM()
  formErrors.value = {}
  modalOpen.value  = true
}

function openEdit(item: Record<string, any>) {
  const s = signatories.value.find(s => s.id === item.id)
  if (!s) return
  isEditing.value  = true
  selectedId.value = s.id
  form.value = { emp_id: s.emp_id, role: s.role, is_active: s.is_active }
  formErrors.value = {}
  modalOpen.value  = true
}

function openDeleteConfirm(item: Record<string, any>) {
  const s = signatories.value.find(s => s.id === item.id)
  if (!s) return
  deleteTarget.value        = s
  confirmDeleteDialog.value = true
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(async () => {
  await Promise.all([fetchSignatories(), fetchRegularEmployees()])
})
</script>

<template>
  <div>
<<<<<<< HEAD
    <VContainer fluid class="pa-6">

      <!-- ── Page Header ── -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-2">
        <div>
          <h4 class="text-h5 font-weight-bold mb-1">Signatories</h4>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Manage authorized signatories for payroll documents.
          </p>
        </div>
        <VBtn color="primary" prepend-icon="mdi-plus" @click="openAdd">
          Add Signatory
        </VBtn>
      </div>

      <!-- ── Info Banner ── -->
      <VAlert
        type="info"
        variant="tonal"
        density="compact"
        icon="mdi-information-outline"
        class="mb-5 mt-4"
        closable
      >
        <strong>Certified By</strong> — signs to certify that services were duly rendered or supporting documents are complete. Multiple signatories allowed.
        &nbsp;·&nbsp;
        <strong>Approved By</strong> — the approving authority for payment. Only one is expected per payroll document.
      </VAlert>

      <!-- ── Summary Cards ── -->
      <VRow class="mb-5" dense>
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="primary" rounded="lg" flat>
            <VCardText class="d-flex align-center gap-3 py-4">
              <VAvatar color="primary" variant="tonal" size="44" rounded="lg">
                <VIcon icon="mdi-pen" size="22" />
              </VAvatar>
              <div>
                <div class="text-h5 font-weight-bold">{{ signatories.length }}</div>
                <div class="text-body-2 text-medium-emphasis">Total Signatories</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="success" rounded="lg" flat>
            <VCardText class="d-flex align-center gap-3 py-4">
              <VAvatar color="success" variant="tonal" size="44" rounded="lg">
                <VIcon icon="mdi-check-decagram-outline" size="22" />
              </VAvatar>
              <div>
                <div class="text-h5 font-weight-bold">{{ totalCertified }}</div>
                <div class="text-body-2 text-medium-emphasis">Certified By</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="warning" rounded="lg" flat>
            <VCardText class="d-flex align-center gap-3 py-4">
              <VAvatar color="warning" variant="tonal" size="44" rounded="lg">
                <VIcon icon="mdi-account-check-outline" size="22" />
              </VAvatar>
              <div>
                <div class="text-h5 font-weight-bold">{{ totalApproved }}</div>
                <div class="text-body-2 text-medium-emphasis">Approved By</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- ── Filter Pills ── -->
      <div class="d-flex align-center flex-wrap gap-3 mb-3">
        <div class="d-flex gap-2">
          <VChip
            v-for="opt in [
              { label: 'All',          value: 'All'          },
              { label: 'Certified By', value: 'certified_by' },
              { label: 'Approved By',  value: 'approved_by'  },
            ]"
            :key="opt.value"
            :color="
              filterRole === opt.value
                ? opt.value === 'certified_by' ? 'success'
                : opt.value === 'approved_by'  ? 'warning'
                : 'primary'
                : undefined
            "
            :variant="filterRole === opt.value ? 'tonal' : 'outlined'"
            size="small"
            label
            style="cursor: pointer;"
            @click="filterRole = opt.value as typeof filterRole"
          >
            {{ opt.label }}
          </VChip>
        </div>
      </div>

      <!-- ── Table ── -->
      <BaseTable
        title="Signatories"
        :headers="TABLE_HEADERS"
        :items="filteredItems"
        :loading="loading"
        :items-per-page="10"
        searchable
        @edit="openEdit"
        @delete="openDeleteConfirm"
      >
        <template #item.name="{ item }">
          <div class="d-flex align-center gap-3">
            <VAvatar :color="avatarColor(item.emp_id)" variant="tonal" size="36">
              <span class="text-caption font-weight-medium">{{ initials(item.name) }}</span>
            </VAvatar>
            <div>
              <div class="text-body-2 font-weight-medium">{{ item.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ item.position }}</div>
            </div>
          </div>
        </template>

        <template #item.role="{ item }">
          <VChip
            :color="item.role === 'approved_by' ? 'warning' : 'success'"
            size="small" variant="tonal" label
          >
            <VIcon start
              :icon="item.role === 'approved_by' ? 'mdi-account-check-outline' : 'mdi-check-decagram-outline'"
              size="14"
            />
            {{ roleLabel(item.role) }}
          </VChip>
        </template>

        <template #item.is_active="{ item }">
          <VChip
            :color="item.is_active ? 'success' : 'default'"
            size="small" variant="tonal" label
          >
            <VIcon start
              :icon="item.is_active ? 'mdi-check-circle-outline' : 'mdi-minus-circle-outline'"
              size="14"
            />
            {{ item.is_active ? 'Active' : 'Inactive' }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-1">
            <VBtn icon size="small" variant="text" color="primary" @click.stop="openEdit(item)">
              <VIcon size="18">mdi-pencil-outline</VIcon>
            </VBtn>
            <VBtn icon size="small" variant="text" color="error" @click.stop="openDeleteConfirm(item)">
              <VIcon size="18">mdi-delete-outline</VIcon>
            </VBtn>
          </div>
        </template>
      </BaseTable>

    </VContainer>

    <!-- ── Add / Edit Modal ── -->
    <BaseModal
      v-model="modalOpen"
      :title="isEditing ? 'Edit Signatory' : 'Add Signatory'"
      width="540"
      :persistent="true"
      :loading="modalLoading"
      confirm-text="Save"
      cancel-text="Cancel"
      @confirm="handleSave"
      @cancel="modalOpen = false"
    >
      <VRow dense>

        <VCol cols="12">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Employee</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12">
          <VAutocomplete
            v-model="form.emp_id"
            label="Select Regular Employee"
            :items="employeeOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-account-search-outline"
            :loading="empLoading"
            :error-messages="formErrors.emp_id"
            :disabled="isEditing"
            clearable
            hide-details="auto"
            hint="Only regular employees are listed. Each employee can only hold one signatory role."
            persistent-hint
            no-data-text="No available regular employees"
          >
            <template #selection="{ item }">
              <div class="d-flex align-center gap-2 py-1">
                <VAvatar :color="avatarColor(item.raw.value)" variant="tonal" size="24">
                  <span style="font-size: 10px; font-weight: 600;">{{ initials(item.raw.title) }}</span>
                </VAvatar>
                <div>
                  <span class="text-body-2 font-weight-medium">{{ item.raw.title }}</span>
                  <span class="text-caption text-medium-emphasis ml-2">{{ item.raw.subtitle }}</span>
                </div>
              </div>
            </template>

            <template #item="{ item, props }">
              <VListItem v-bind="props" :title="undefined" class="py-2">
                <template #prepend>
                  <VAvatar :color="avatarColor(item.raw.value)" variant="tonal" size="36" class="mr-3">
                    <span style="font-size: 12px; font-weight: 600;">{{ initials(item.raw.title) }}</span>
                  </VAvatar>
                </template>
                <VListItemTitle class="text-body-2 font-weight-medium">{{ item.raw.title }}</VListItemTitle>
                <VListItemSubtitle class="text-caption">{{ item.raw.subtitle }}</VListItemSubtitle>
              </VListItem>
            </template>
          </VAutocomplete>
        </VCol>

        <VCol v-if="isEditing" cols="12">
          <VAlert type="info" variant="tonal" density="compact" icon="mdi-information-outline" class="mt-1">
            <span class="text-body-2">Employee cannot be changed. Delete and re-add to reassign.</span>
          </VAlert>
        </VCol>

        <VCol cols="12" class="mt-3">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Role</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="6">
          <VCard
            :variant="form.role === 'certified_by' ? 'tonal' : 'outlined'"
            :color="form.role === 'certified_by' ? 'success' : undefined"
            rounded="lg" style="cursor: pointer;"
            @click="form.role = 'certified_by'"
          >
            <VCardText class="pa-3">
              <div class="d-flex align-center gap-2 mb-1">
                <VIcon icon="mdi-check-decagram-outline" size="18"
                  :color="form.role === 'certified_by' ? 'success' : 'medium-emphasis'" />
                <span class="text-body-2 font-weight-medium">Certified By</span>
              </div>
              <p class="text-caption text-medium-emphasis mb-0">Certifies services rendered or cash availability.</p>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" sm="6">
          <VCard
            :variant="form.role === 'approved_by' ? 'tonal' : 'outlined'"
            :color="form.role === 'approved_by' ? 'warning' : undefined"
            rounded="lg" style="cursor: pointer;"
            @click="form.role = 'approved_by'"
          >
            <VCardText class="pa-3">
              <div class="d-flex align-center gap-2 mb-1">
                <VIcon icon="mdi-account-check-outline" size="18"
                  :color="form.role === 'approved_by' ? 'warning' : 'medium-emphasis'" />
                <span class="text-body-2 font-weight-medium">Approved By</span>
              </div>
              <p class="text-caption text-medium-emphasis mb-0">Approving authority for payment release.</p>
            </VCardText>
          </VCard>
        </VCol>

        <VCol v-if="formErrors.role" cols="12">
          <p class="text-caption text-error mt-1 mb-0">{{ formErrors.role }}</p>
        </VCol>

        <VCol cols="12" class="mt-3">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Status</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12">
          <VCard variant="tonal" :color="form.is_active ? 'success' : 'default'" rounded="lg" flat>
            <VCardText class="d-flex align-center justify-space-between pa-3">
              <div>
                <div class="text-body-2 font-weight-medium">{{ form.is_active ? 'Active' : 'Inactive' }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ form.is_active ? 'Will appear in payroll documents' : 'Hidden from payroll documents' }}
                </div>
              </div>
              <VSwitch v-model="form.is_active" color="success" density="compact" hide-details inset />
            </VCardText>
          </VCard>
        </VCol>

      </VRow>
    </BaseModal>

    <!-- ── Delete Confirmation Dialog ── -->
    <VDialog v-model="confirmDeleteDialog" max-width="420" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar color="error" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-delete-outline" size="22" />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">Remove Signatory?</div>
              <div class="text-caption text-medium-emphasis">This action cannot be undone.</div>
            </div>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-0">
            <strong class="text-high-emphasis">{{ deleteTarget?.name }}</strong>
            will be permanently removed as a signatory from all payroll documents.
          </p>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="deleteLoading" @click="confirmDeleteDialog = false">Cancel</VBtn>
          <VBtn color="error" variant="tonal" :loading="deleteLoading" @click="executeDelete">
            <VIcon start size="16">mdi-delete-outline</VIcon>Yes, Remove
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Alert ── -->
    <BaseAlert v-model="alertVisible" :message="alertMessage" :type="alertType" :timeout="3500" />
=======
    <h1>Signatories</h1>
>>>>>>> e8f972f8ab4455f0dcdf71812d913d7af94893e7
  </div>
</template>
