<script setup lang="ts">
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseConfirmDialog from '@/components/base/BaseConfirmDialog.vue'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Employee {
  id:        number
  name:      string
  position:  string
  division:  string
  section:   string
  email:     string
}

/* ─────────────────────────────────────────
   STATE — Table
───────────────────────────────────────── */
const employees = ref<Employee[]>([
  { id: 1, name: 'Vince Rhyner R. Gerado',    position: 'Computer Operator II',       division: 'MSD', section: 'ICT Unit', email: 'vince.rhyner1013@gmail.com' },
])

let nextId = 10

const headers = [
  { title: 'Name',     key: 'name',     sortable: true                    },
  { title: 'Position', key: 'position', sortable: true                    },
  { title: 'Division', key: 'division', sortable: true                    },
  { title: 'Section',  key: 'section',  sortable: true                    },
  { title: 'Email',    key: 'email',    sortable: false                   },
  { title: 'Actions',  key: 'actions',  sortable: false, align: 'center' as const },
]

/* ─────────────────────────────────────────
   STATE — Modal (add / edit)
───────────────────────────────────────── */
const isModalOpen  = ref(false)
const isSaving     = ref(false)       // ← separate from table loading
const isEditing    = ref(false)
const editId       = ref<number | null>(null)

const BLANK_FORM = (): Omit<Employee, 'id'> => ({
  name:     '',
  position: '',
  division: '',
  section:  '',
  email:    '',
})

const form       = ref(BLANK_FORM())
const formErrors = ref<Partial<Record<keyof Employee, string>>>({})

function openAdd() {
  isEditing.value  = false
  editId.value     = null
  form.value       = BLANK_FORM()
  formErrors.value = {}
  isModalOpen.value = true
}

function handleEdit(item: Record<string, any>) {
  isEditing.value  = true
  editId.value     = item.id
  form.value       = {
    name:     item.name,
    position: item.position,
    division: item.division,
    section:  item.section,
    email:    item.email,
  }
  formErrors.value = {}
  isModalOpen.value = true
}

function validate(): boolean {
  const errs: Partial<Record<keyof Employee, string>> = {}
  if (!form.value.name.trim())     errs.name     = 'Name is required.'
  if (!form.value.position.trim()) errs.position = 'Position is required.'
  if (!form.value.division.trim()) errs.division = 'Division is required.'
  if (!form.value.email.trim())    errs.email    = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email))
                                   errs.email    = 'Enter a valid email address.'
  formErrors.value = errs
  return Object.keys(errs).length === 0
}

function handleConfirm() {
  if (!validate()) return

  isSaving.value = true
  setTimeout(() => {
    if (isEditing.value && editId.value !== null) {
      employees.value = employees.value.map(e =>
        e.id === editId.value ? { id: e.id, ...form.value } : e
      )
      showAlert('Employee updated successfully.', 'success')
    } else {
      employees.value.push({ id: ++nextId, ...form.value })
      showAlert('Employee added successfully.', 'success')
    }
    isSaving.value    = false
    isModalOpen.value = false
  }, 1000)
}

/* ─────────────────────────────────────────
   STATE — Confirm Delete
───────────────────────────────────────── */
const confirmDialog = ref({
  show:       false,
  item:       null as Employee | null,
  isDeleting: false,
})

function handleDelete(item: Record<string, any>) {
  confirmDialog.value = { show: true, item: item as Employee, isDeleting: false }
}

function handleConfirmDelete() {
  confirmDialog.value.isDeleting = true
  setTimeout(() => {
    employees.value = employees.value.filter(e => e.id !== confirmDialog.value.item?.id)
    confirmDialog.value = { show: false, item: null, isDeleting: false }
    showAlert('Employee deleted successfully.', 'error')
  }, 1000)
}

function handleCancelDelete() {
  confirmDialog.value = { show: false, item: null, isDeleting: false }
}

/* ─────────────────────────────────────────
   STATE — Alert
───────────────────────────────────────── */
const alert = ref({
  type:    'success' as 'success' | 'error' | 'warning' | 'info',
  message: '',
  show:    false,
})

function showAlert(message: string, type: typeof alert.value.type = 'success') {
  alert.value = { show: true, message, type }
}
</script>

<template>
  <div>
    <VContainer fluid class="pa-6">
      <VRow>

        <!-- ── Page Header ── -->
        <VCol cols="12">
          <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-4">
            <div>
              <h4 class="text-h5 font-weight-bold mb-1">Employees</h4>
            </div>
            <VBtn
              color="primary"
              prepend-icon="mdi-plus"
              @click="openAdd"
            >
              Add Employee
            </VBtn>
          </div>
        </VCol>

        <!-- ── Employee Table ── -->
        <VCol cols="12">
          <BaseTable
            title="Employees"
            :headers="headers"
            :items="employees"
            @edit="handleEdit"
            @delete="handleDelete"
          />
        </VCol>

      </VRow>
    </VContainer>

    <!-- ── Add / Edit Modal ── -->
    <BaseModal
      v-model="isModalOpen"
      :title="isEditing ? 'Edit Employee' : 'Add Employee'"
      :loading="isSaving"
      :persistent="true"
      :confirm-text="isEditing ? 'Save Changes' : 'Save Employee'"
      @confirm="handleConfirm"
      @cancel="isModalOpen = false"
    >
      <VRow dense>
        <VCol cols="12">
          <VTextField
            v-model="form.name"
            label="Full Name"
            placeholder="Juan Dela Cruz"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-account-outline"
            :error-messages="formErrors.name"
          />
        </VCol>
        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.position"
            label="Position"
            placeholder="e.g. Developer"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-briefcase-outline"
            :error-messages="formErrors.position"
          />
        </VCol>
        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.division"
            label="Division"
            placeholder="e.g. MSD"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-domain"
            :error-messages="formErrors.division"
          />
        </VCol>
        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.section"
            label="Section"
            placeholder="e.g. ICT Unit"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-domain"
            :error-messages="formErrors.section"
          />
        </VCol>
        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.email"
            label="Email Address"
            placeholder="juan@company.com"
            type="email"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-email-outline"
            :error-messages="formErrors.email"
          />
        </VCol>
      </VRow>
    </BaseModal>

    <!-- ── Confirm Delete ── -->
    <BaseConfirmDialog
      v-model="confirmDialog.show"
      title="Delete Employee"
      :message="`Are you sure you want to delete ${confirmDialog.item?.name ?? 'this employee'}? This action cannot be undone.`"
      :loading="confirmDialog.isDeleting"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
    />

    <!-- ── Alert / Snackbar ── -->
    <BaseAlert
      v-model="alert.show"
      :message="alert.message"
      :type="alert.type"
    />
  </div>
</template>