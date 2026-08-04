<script setup lang="ts">
import BaseTable from '@/components/base/BaseTable.vue'
import axios from '@axios'
import { onMounted, ref, watch } from 'vue'

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
  module_actions: { module: string; action: string }[]   // CHANGED from actions: string[]
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
const availableActions = computed(() => {
  const pairs = filterOptions.value.module_actions
  const scoped = filters.value.module
    ? pairs.filter(p => p.module === filters.value.module)
    : pairs
  return [...new Set(scoped.map(p => p.action))]
})
const page = ref(1)
const perPage = ref(50)

const headers = [
  { title: 'Date/Time', key: 'created_at' },
  { title: 'Actor', key: 'username' },
  { title: 'Module', key: 'module' },
  { title: 'Action', key: 'action' },
  { title: 'Description', key: 'description' },
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

async function fetchLogs() {
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
    logs.value = data.data.data          // Laravel paginator shape: { data: { data: [...], total, ... } }
    totalLogs.value = data.data.total
  } finally {
    loading.value = false
  }
}

async function fetchFilterOptions() {
  const { data } = await axios.get('/api/audit-logs/filters')
  filterOptions.value = data.data
}

function resetFilters() {
  filters.value = { module: null, action: null, user_id: null, date_from: null, date_to: null }
  page.value = 1
}

watch(filters, () => { page.value = 1; fetchLogs() }, { deep: true })
watch(page, fetchLogs)
watch(() => filters.value.module, () => {
  filters.value.action = null
})
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
            label="Actor"
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

      <BaseTable
        :headers="headers"
        :items="logs"
        :loading="loading"
        :items-per-page="perPage"
        :searchable="false"
      >
        <template #item.created_at="{ item }">
          {{ formatDateTime(item.created_at) }}
        </template>
        <template #item.username="{ item }">
          {{ item.username ?? '—' }}
        </template>
        <template #item.module="{ item }">
          {{ formatModule(item.module) }}
        </template>
      </BaseTable>

      <div class="d-flex justify-end mt-4">
        <VPagination
          v-model="page"
          :length="Math.ceil(totalLogs / perPage)"
        />
      </div>
    </VCardText>
  </VCard>
</template>
