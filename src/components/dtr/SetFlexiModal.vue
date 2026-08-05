<script setup lang="ts">
import BaseModal from "@/components/base/BaseModal.vue";
import axios from "@axios";
import AssignFlexiEmployeesModal from "./AssignFlexiEmployeesModal.vue";

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
  employees: Employee[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [employees: Employee[], message: string, isError?: boolean];
}>();

const saving = ref(false);
const assignedIds = ref<Set<number>>(new Set());
const showAssignModal = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    assignedIds.value = new Set(
      props.employees.filter((e) => e.is_flexi).map((e) => e.id),
    );
  },
);

const assignedEmployees = computed(() =>
  props.employees.filter((e) => assignedIds.value.has(e.id)),
);

function removeEmployee(id: number) {
  const next = new Set(assignedIds.value);
  next.delete(id);
  assignedIds.value = next;
}

function handleAssign(ids: number[]) {
  const next = new Set(assignedIds.value);
  for (const id of ids) next.add(id);
  assignedIds.value = next;
}

async function save() {
  saving.value = true;
  try {
    const ids = Array.from(assignedIds.value);
    const { data } = await axios.post("/api/dtr/flexi", { employee_ids: ids });

    const assignedSet = assignedIds.value;
    const updated = props.employees.map((e) => ({
      ...e,
      is_flexi: assignedSet.has(e.id),
    }));

    emit("saved", updated, data.message ?? "Flexi schedule updated.");
    emit("update:modelValue", false);
  } catch (e: any) {
    emit(
      "saved",
      props.employees,
      e?.response?.data?.message ?? "Failed to update flexi schedule.",
      true,
    );
  } finally {
    saving.value = false;
  }
}
const AVATAR_COLORS = [
  "primary",
  "teal",
  "orange",
  "purple",
  "pink",
  "indigo",
] as const;

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function initials(fullName: string): string {
  const [surname, rest] = fullName.split(", ");
  const first = rest?.trim().charAt(0) ?? "";
  return `${surname?.charAt(0) ?? ""}${first}`.toUpperCase();
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
    <p class="text-caption text-medium-emphasis mb-4">
      Flexi schedule: Mon–Thu 8:00AM–5:30PM, Fri 8:00AM–3:00PM.
    </p>

    <div class="d-flex align-center justify-space-between mb-3">
      <div class="d-flex align-center">
        <span
          class="text-overline text-medium-emphasis"
          style="letter-spacing: 0.08em"
        >
          ASSIGNED EMPLOYEES
        </span>
        <VChip
          size="small"
          color="info"
          variant="tonal"
          class="ms-2 font-weight-medium"
        >
          {{ assignedIds.size }}
        </VChip>
      </div>
      <VBtn
        prepend-icon="mdi-account-plus"
        size="small"
        color="info"
        variant="tonal"
        @click="showAssignModal = true"
      >
        Assign Employees
      </VBtn>
    </div>

    <div style="max-height: 360px; overflow-y: auto" class="flexi-list">
      <div
        v-for="emp in assignedEmployees"
        :key="emp.id"
        class="d-flex align-center py-2 px-1 flexi-row"
      >
        <VAvatar
          size="32"
          :color="avatarColor(emp.id)"
          variant="tonal"
          class="me-3"
        >
          <span class="text-caption font-weight-bold">{{
            initials(emp.full_name)
          }}</span>
        </VAvatar>
        <div class="flex-grow-1 text-truncate">
          <span class="text-body-2">{{ emp.full_name }}</span>
          <span class="text-caption text-medium-emphasis ms-1">
            · {{ emp.position ?? "" }}
          </span>
        </div>
        <VBtn
          icon="mdi-close"
          size="small"
          variant="text"
          color="error"
          @click="removeEmployee(emp.id)"
        />
      </div>

      <p
        v-if="!assignedEmployees.length"
        class="text-caption text-medium-emphasis text-center py-6"
      >
        No employees assigned yet. Click "Assign Employees" to add some.
      </p>
    </div>
  </BaseModal>

  <AssignFlexiEmployeesModal
    v-model="showAssignModal"
    :employees="employees"
    :assigned-ids="assignedIds"
    @assign="handleAssign"
  />
</template>

<style scoped>
.flexi-row {
  border-radius: 8px;
  transition: background-color 0.15s ease;
}

.flexi-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.flexi-list {
  scrollbar-gutter: stable;
}
</style>
