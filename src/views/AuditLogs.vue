<script setup lang="ts">
import axios from '@axios'
import { computed, onMounted, ref, watch } from 'vue'

interface AuditLogRow {
  id: number
  user_id: number | null
  username: string | null
  module: string
  action: string
  description: string
  subject_type: string | null
  subject_id: number | null
  ip_address: string | null
  created_at: string
}

interface FilterOptions {
  modules: string[]
  module_actions: { module: string; action: string }[]
  actors: { user_id: number; username: string }[]
}

const logs = ref<AuditLogRow[]>([])
const totalLogs = ref(0)
const loading = ref(false)
const filterOptions = ref<FilterOptions>({ modules: [], module_actions: [], actors: [] })

const filters = ref({
  module: null as string | null,
  action: null as string | null,
  user_id: null as number | null,
  date_from: null as string | null,
  date_to: null as string | null,
})

const page = ref(1)
const perPage = ref(50)
const perPageOptions = [
  { value: 25, title: '25' },
  { value: 50, title: '50' },
  { value: 100, title: '100' },
  { value: 200, title: '200' }, // backend max is 200
]

const availableActions = computed(() => {
  const pairs = filterOptions.value.module_actions
  const scoped = filters.value.module
    ? pairs.filter(p => p.module === filters.value.module)
    : pairs
  return [...new Set(scoped.map(p => p.action))]
})

// Server returns rows ordered by created_at desc; client-side sorting would
// only reorder the current page, so sorting is disabled.
const headers = [
  { title: 'Date/Time', key: 'created_at', sortable: false },
  { title: 'User', key: 'username', sortable: false },
  { title: 'Module', key: 'module', sortable: false },
  { title: 'Action', key: 'action', sortable: false },
  { title: 'Description', key: 'description', sortable: false },
]

const moduleLabels: Record<string, string> = {
  payroll_run: 'Payroll Run',
  payroll_batch_item: 'Payroll Item',
  wage: 'Wage',
  signatory: 'Signatory',
  document: 'Document',
  calendar: 'Calendar',
}

function formatModule(m: string) {
  return moduleLabels[m] ?? m
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// Guards against an older, slower response overwriting a newer one
let requestId = 0

async function fetchLogs() {
  const current = ++requestId
  loading.value = true
  try {
    const { data } = await axios.get('/api/audit-logs', {
      params: {
        module: filters.value.module || undefined,
        action: filters.value.action || undefined,
        user_id: filters.value.user_id || undefined,
        date_from: filters.value.date_from || undefined,
        date_to: filters.value.date_to || undefined,
        page: page.value,
        per_page: perPage.value,
      },
    })
    if (current !== requestId) return
    logs.value = data.data.data
    totalLogs.value = data.data.total
  } finally {
    if (current === requestId) loading.value = false
  }
}

async function fetchFilterOptions() {
  const { data } = await axios.get('/api/audit-logs/filters')
  filterOptions.value = data.data
}

// Clear action in the same tick as the module change, so it's one fetch
function onModuleChange() {
  filters.value.action = null
}

function resetFilters() {
  filters.value = { module: null, action: null, user_id: null, date_from: null, date_to: null }
}

// Filter change: go back to page 1. If already on page 1, fetch directly;
// otherwise the page watcher below does the fetch (avoids a double request).
watch(filters, () => {
  if (page.value !== 1) page.value = 1
  else fetchLogs()
}, { deep: true })

// Page or per-page change (VDataTableServer may change both in one tick → one fetch)
watch([page, perPage], fetchLogs)

onMounted(() => {
  fetchFilterOptions()
  fetchLogs()
})
</script>

<template>
  <VCard title="Audit Trail">
    <VCardText>
      <VRow class="mb-2">
        <VCol cols="12" sm="3">
          <VSelect
            v-model="filters.module"
            :items="filterOptions.modules.map(m => ({ title: formatModule(m), value: m }))"
            label="Module"
            clearable
            density="compact"
            @update:model-value="onModuleChange"
          />
        </VCol>
        <VCol cols="12" sm="3">
          <VSelect
            v-model="filters.action"
            :items="availableActions"
            label="Action"
            clearable
            density="compact"
          />
        </VCol>
        <VCol cols="12" sm="3">
          <VSelect
            v-model="filters.user_id"
            :items="filterOptions.actors.map(a => ({ title: a.username, value: a.user_id }))"
            label="User"
            clearable
            density="compact"
          />
        </VCol>
        <VCol cols="12" sm="3" class="d-flex align-center">
          <VBtn variant="text" @click="resetFilters">Reset</VBtn>
        </VCol>
        <VCol cols="12" sm="3">
          <VTextField v-model="filters.date_from" type="date" label="From" density="compact" clearable />
        </VCol>
        <VCol cols="12" sm="3">
          <VTextField v-model="filters.date_to" type="date" label="To" density="compact" clearable />
        </VCol>
      </VRow>

      <VDataTableServer
        v-model:page="page"
        v-model:items-per-page="perPage"
        :headers="headers"
        :items="logs"
        :items-length="totalLogs"
        :items-per-page-options="perPageOptions"
        :loading="loading"
        class="text-no-wrap"
      >
        <template #loading>
          <VSkeletonLoader type="table-row@5" />
        </template>

        <template #no-data>
          <div class="text-center py-8">
            <VIcon icon="mdi-database-off-outline" size="48" color="medium-emphasis" class="mb-3" />
            <p class="text-medium-emphasis">No records found</p>
          </div>
        </template>

        <template #item.created_at="{ item }">
          {{ formatDateTime(item.created_at) }}
        </template>
        <template #item.username="{ item }">
          {{ item.username ?? '—' }}
        </template>
        <template #item.module="{ item }">
          {{ formatModule(item.module) }}
        </template>
      </VDataTableServer>
    </VCardText>
  </VCard>
</template>
