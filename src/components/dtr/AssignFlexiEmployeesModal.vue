<script setup lang="ts">
import BaseModal from "@/components/base/BaseModal.vue";

interface Employee {
  id: number;
  full_name: string;
  position: string | null;
  division: string | null;
  section: string | null;
  emp_type: string | null;
  emp_status: number | null;
  is_flexi: boolean;
  current_period_status: "not_saved" | "saved" | "overridden";
  last_saved: {
    month: number;
    year: number;
    label: string;
    date: string | null;
  } | null;
}

const props = defineProps<{
  modelValue: boolean;
  employees: Employee[]; // full roster
  assignedIds: Set<number>; // already-assigned, to exclude from picker
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  assign: [ids: number[]];
}>();

const search = ref("");
const selectedDivision = ref<string | null>(null);
const selectedSection = ref<string | null>(null);
const checkedIds = ref<Set<number>>(new Set());

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    search.value = "";
    selectedDivision.value = null;
    selectedSection.value = null;
    checkedIds.value = new Set();
  },
);

// Pool to pick from: anyone not already assigned.
const pickablePool = computed(() =>
  props.employees.filter((e) => !props.assignedIds.has(e.id)),
);

const divisionOptions = computed(() => {
  const set = new Set(
    pickablePool.value.map((e) => e.division).filter(Boolean) as string[],
  );
  return Array.from(set).sort();
});

// Sections narrow to whatever division is selected, so the dropdown
// doesn't show sections that can't possibly match.
const sectionOptions = computed(() => {
  const pool = selectedDivision.value
    ? pickablePool.value.filter((e) => e.division === selectedDivision.value)
    : pickablePool.value;
  const set = new Set(pool.map((e) => e.section).filter(Boolean) as string[]);
  return Array.from(set).sort();
});

// If the division changes and the current section no longer applies, clear it.
watch(selectedDivision, () => {
  if (
    selectedSection.value &&
    !sectionOptions.value.includes(selectedSection.value)
  ) {
    selectedSection.value = null;
  }
});

const filteredEmployees = computed(() => {
  const q = search.value.trim().toLowerCase();
  return pickablePool.value.filter((e) => {
    if (q && !e.full_name.toLowerCase().includes(q)) return false;
    if (selectedDivision.value && e.division !== selectedDivision.value)
      return false;
    if (selectedSection.value && e.section !== selectedSection.value)
      return false;
    return true;
  });
});

function toggle(id: number) {
  const next = new Set(checkedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  checkedIds.value = next;
}

function toggleAllFiltered() {
  const allChecked = filteredEmployees.value.every((e) =>
    checkedIds.value.has(e.id),
  );
  const next = new Set(checkedIds.value);
  for (const e of filteredEmployees.value) {
    if (allChecked) next.delete(e.id);
    else next.add(e.id);
  }
  checkedIds.value = next;
}

function confirm() {
  emit("assign", Array.from(checkedIds.value));
  emit("update:modelValue", false);
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Assign Employees"
    width="520"
    confirm-text="Add Selected"
    :confirm-disabled="checkedIds.size === 0"
    @update:model-value="$emit('update:modelValue', $event)"
    @confirm="confirm"
  >
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

    <div class="d-flex ga-2 mb-3">
      <VSelect
        v-model="selectedDivision"
        :items="divisionOptions"
        label="Division"
        variant="outlined"
        density="compact"
        clearable
        hide-details
      />
      <VSelect
        v-model="selectedSection"
        :items="sectionOptions"
        label="Section"
        variant="outlined"
        density="compact"
        clearable
        hide-details
      />
    </div>

    <div class="d-flex align-center justify-space-between mb-2">
      <span class="text-caption font-weight-medium">
        {{ checkedIds.size }} selected of {{ filteredEmployees.length }}
      </span>
      <VBtn
        variant="text"
        size="small"
        density="compact"
        @click="toggleAllFiltered"
      >
        {{
          filteredEmployees.length &&
          filteredEmployees.every((e) => checkedIds.has(e.id))
            ? "Clear all"
            : "Select all"
        }}
      </VBtn>
    </div>

    <div style="max-height: 340px; overflow-y: auto">
      <div
        v-for="emp in filteredEmployees"
        :key="emp.id"
        class="d-flex align-center py-1 px-1 assign-row"
        @click="toggle(emp.id)"
      >
        <VCheckbox
          :model-value="checkedIds.has(emp.id)"
          density="compact"
          hide-details
          readonly
        />
        <div class="flex-grow-1 text-truncate">
          <span class="text-body-2">{{ emp.full_name }}</span>
          <span class="text-caption text-medium-emphasis ms-2">
            {{ emp.position ?? "" }}
          </span>
        </div>
      </div>

      <p
        v-if="!filteredEmployees.length"
        class="text-caption text-medium-emphasis text-center py-4"
      >
        No employees match your filters.
      </p>
    </div>
  </BaseModal>
</template>

<style scoped>
.assign-row {
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.assign-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
