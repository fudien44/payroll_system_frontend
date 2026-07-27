<script setup lang="ts">
import BaseModal from '@/components/base/BaseModal.vue'
import axios from '@axios'

interface Employee {
  id:          number
  full_name:   string
  position:    string | null
  division:    string | null
  section:     string | null
  emp_type:    string | null
  emp_status:  number | null
  is_flexi:    boolean
}

const props = defineProps<{
  modelValue: boolean
  employees:  Employee[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': [employees: Employee[], message: string, isError?: boolean]
}>()

const search    = ref('')
const saving    = ref(false)
const selectedIds = ref<Set<number>>(new Set())

watch(() => props.modelValue, (open) => {
  if (!open) return

  selectedIds.value = new Set(props.employees.filter(e => e.is_flexi).map(e => e.id))
  search.value = ''
})

const filteredEmployees = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.employees
  return props.employees.filter(e => e.full_name.toLowerCase().includes(q))
})

// Whether the divider between "selected" and "unselected" groups should
// show. Cheap array filter — no DOM reordering involved, so this is safe
// to recompute on every toggle even with 300+ employees.
const hasMixedSelection = computed(() => {
  const total = filteredEmployees.value.length
  if (!total) return false
  const selectedCount = filteredEmployees.value.filter(e => selectedIds.value.has(e.id)).length
  return selectedCount > 0 && selectedCount < total
})

function toggle(id: number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

async function save() {
  saving.value = true
  try {
    const ids = Array.from(selectedIds.value)
    const { data } = await axios.post('/api/dtr/flexi', { employee_ids: ids })

    const selectedSet = selectedIds.value
    const updated = props.employees.map(e => ({ ...e, is_flexi: selectedSet.has(e.id) }))

    emit('saved', updated, data.message ?? 'Flexi schedule updated.')
    emit('update:modelValue', false)
  } catch (e: any) {
    emit('saved', props.employees, e?.response?.data?.message ?? 'Failed to update flexi schedule.', true)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Set Flexi Schedule"
    width="480"
    confirm-text="Save"
    :loading="saving"
    @update:model-value="$emit('update:modelValue', $event)"
    @confirm="save"
  >
    <p class="text-caption text-medium-emphasis mb-3">
      Flexi schedule: Mon–Thu 8:00AM–5:30PM, Fri 8:00AM–3:00PM. Select employees below.
    </p>
    <p class="text-caption font-weight-medium mb-2">
      {{ selectedIds.size }} selected
    </p>
    <VTextField
      v-model="search"
      placeholder="Search employee..."
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="compact"
      clearable
      hide-details
      class="mb-3"
      @click:clear="search = ''"
    />
    <div style="max-height: 360px; overflow-y: auto;">
      <div class="d-flex flex-column">
        <div
          v-for="emp in filteredEmployees"
          :key="emp.id"
          class="d-flex align-center py-1 px-2 rounded flexi-row"
          :class="{ 'bg-info-lighten-5': selectedIds.has(emp.id) }"
          :style="{ order: selectedIds.has(emp.id) ? 0 : 2, cursor: 'pointer' }"
          @click="toggle(emp.id)"
        >
          <VCheckbox
            :model-value="selectedIds.has(emp.id)"
            density="compact"
            hide-details
            readonly
          />
          <span class="text-body-2">{{ emp.full_name }}</span>
          <span class="text-caption text-medium-emphasis ms-2">{{ emp.position ?? '' }}</span>
        </div>
        <VDivider v-if="hasMixedSelection" class="my-2" style="order: 1;" />
      </div>
      <p v-if="!filteredEmployees.length" class="text-caption text-medium-emphasis text-center py-4">
        No employees match your search.
      </p>
    </div>
  </BaseModal>
</template>

<style scoped>
.flexi-row {
  transition: background-color 0.15s ease;
}

.flexi-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}
</style>
