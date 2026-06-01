<script setup lang="ts">
import BaseTable from '@/components/base/BaseTable.vue'
import axios from '@axios'
import * as XLSX from 'xlsx'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface EngasEmployee {
  engas_code: string | null
  engas_name: string | null
  hrmis_name: string
  matched:    boolean
  source:     'Manual' | 'ENGAS System' | null
}

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const TABLE_HEADERS = [
  { title: 'ENGAS Code', key: 'engas_code', sortable: true  },
  { title: 'HRMIS Name', key: 'hrmis_name', sortable: true  },
  { title: 'ENGAS Name', key: 'engas_name', sortable: true  },
  { title: 'Source',     key: 'source',     sortable: true  },
  { title: 'Status',     key: 'matched',    sortable: true  },
]

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const employees    = ref<EngasEmployee[]>([])
const loading      = ref(false)
const error        = ref<string | null>(null)
const exporting    = ref(false)

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const totalEmployees  = computed(() => employees.value.length)
const totalMatched    = computed(() => employees.value.filter(e => e.matched).length)
const totalUnmatched  = computed(() => employees.value.filter(e => !e.matched).length)
const totalManual     = computed(() => employees.value.filter(e => e.source === 'Manual').length)
const unmatched       = computed(() => employees.value.filter(e => !e.matched))

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */
async function fetchEmployees() {
  loading.value = true
  error.value   = null
  try {
    const { data } = await axios.get('/api/engas/employees')
    employees.value = data.data ?? []
  } catch {
    error.value = 'Failed to load ENGAS records.'
  } finally {
    loading.value = false
  }
}

/* ─────────────────────────────────────────
   EXPORT
───────────────────────────────────────── */
function exportUnmatched() {
  if (!unmatched.value.length) return

  exporting.value = true

  try {
    const wb = XLSX.utils.book_new()

    const rows = [
      ['ENGAS UNMATCHED EMPLOYEES — FOR HR VERIFICATION'],
      [`Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`],
      [],
      ['#', 'Name', 'Regular?', 'Active?'],
      ...unmatched.value.map((emp, i) => [
        i + 1,
        emp.hrmis_name,
        '',
        '',
      ]),
    ]

    const ws = XLSX.utils.aoa_to_sheet(rows)

    ws['!cols'] = [
      { wch: 5  },
      { wch: 40 },
      { wch: 15 },
      { wch: 15 },
    ]

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Unmatched Employees')

    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `ENGAS_Unmatched_${date}.xlsx`)
  } finally {
    exporting.value = false
  }
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
          <h4 class="text-h5 font-weight-bold mb-1">ENGAS Employee Reference</h4>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Read-only reference from <code>ENGAS SYSTEM</code> from Accounting Department.
            Codes manually encoded in payroll batches take priority.
          </p>
        </div>

        <!-- ── Export Button ── -->
        <VBtn
          color="warning"
          variant="tonal"
          prepend-icon="mdi-microsoft-excel"
          :loading="exporting"
          :disabled="loading || totalUnmatched === 0"
          @click="exportUnmatched"
        >
          Export Unmatched ({{ totalUnmatched }})
        </VBtn>
      </div>

      <!-- ── Error Alert ── -->
      <VAlert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        icon="mdi-alert-circle-outline"
        class="mb-6 mt-4"
        closable
      >
        {{ error }}
        <VBtn size="small" variant="text" class="ml-2" @click="fetchEmployees">
          Retry
        </VBtn>
      </VAlert>

      <!-- ── Summary Cards ── -->
      <VRow class="mb-6 mt-2">
        <VCol cols="12" sm="3">
          <VCard variant="tonal" color="primary" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-account-group-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalEmployees }}</div>
                <div class="text-body-2">Total JO Employees</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="3">
          <VCard variant="tonal" color="success" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-check-circle-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalMatched }}</div>
                <div class="text-body-2">Matched in ENGAS</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="3">
          <VCard variant="tonal" color="info" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-pencil-circle-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalManual }}</div>
                <div class="text-body-2">Manually Encoded</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="3">
          <VCard variant="tonal" color="warning" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-alert-circle-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalUnmatched }}</div>
                <div class="text-body-2">Not Found in ENGAS</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- ── Table ── -->
      <BaseTable
        title="ENGAS Employee List"
        :headers="TABLE_HEADERS"
        :items="employees"
        :loading="loading"
        :items-per-page="15"
        searchable
      >
        <template #item.engas_code="{ item }">
          <VChip
            v-if="item.engas_code"
            color="primary"
            size="small"
            variant="tonal"
            label
          >
            {{ item.engas_code }}
          </VChip>
          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <template #item.hrmis_name="{ item }">
          <span class="font-weight-medium">{{ item.hrmis_name }}</span>
        </template>

        <template #item.engas_name="{ item }">
          <span v-if="item.engas_name">{{ item.engas_name }}</span>
          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <!-- ── Source chip ── -->
        <template #item.source="{ item }">
          <VChip
            v-if="item.source === 'Manual'"
            color="info"
            size="small"
            variant="tonal"
            label
          >
            <VIcon start icon="mdi-pencil-outline" size="14" />
            Manual
          </VChip>
          <VChip
            v-else-if="item.source === 'ENGAS System'"
            color="secondary"
            size="small"
            variant="tonal"
            label
          >
            <VIcon start icon="mdi-database-outline" size="14" />
            ENGAS System
          </VChip>
          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <!-- ── Status chip ── -->
        <template #item.matched="{ item }">
          <VChip
            :color="item.matched ? 'success' : 'warning'"
            size="small"
            variant="tonal"
            label
          >
            <VIcon
              start
              :icon="item.matched ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'"
              size="14"
            />
            {{ item.matched ? 'Matched' : 'Not Found' }}
          </VChip>
          <div
            v-if="!item.matched"
            class="text-caption text-warning mt-1 not-found-hint"
          >
            Please verify with HRMIS — employee may no longer be active or may have been regularized.
          </div>
        </template>
      </BaseTable>

    </VContainer>
  </div>
</template>
<style scoped>
:deep(.v-data-table__td:last-child) {
  min-width: 0;
}

.not-found-hint {
  white-space: normal;
  word-break: break-word;
  max-width: 200px;
  line-height: 1.3;
}
</style>
