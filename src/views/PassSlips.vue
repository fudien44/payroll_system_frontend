<script setup lang="ts">
import BaseTable from '@/components/base/BaseTable.vue'
import axios from '@axios'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface PassSlipRecord {
  id:                 number
  user_id:            number
  employee_name:      string
  position:           string | null
  division:           string | null
  section:            string | null
  division_id:        number | null
  section_id:         number | null
  request_date:       string
  request_time_out:   string
  actual_time:        string | null
  estimated_arrival:  string | null
  reason:             string | null
  label:              string
  nature_business:    string | null
  minutes:            number
}

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({ title: name, value: i + 1 }))

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

const TABLE_HEADERS = [
  { title: 'Employee',    key: 'employee_name',     sortable: true                        },
  { title: 'Date',        key: 'request_date',      sortable: true                        },
  { title: 'Request Time Out',    key: 'request_time_out',  sortable: true                        },
  { title: 'Actual Time In', key: 'actual_time',    sortable: true                        },
  { title: 'Minutes',     key: 'minutes',           sortable: true,  align: 'end' as const },
  { title: 'Type',        key: 'label',             sortable: true                        },
]

const AVATAR_COLORS = ['primary', 'teal', 'orange', 'purple', 'pink', 'indigo'] as const

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const passSlips     = ref<PassSlipRecord[]>([])
const loading        = ref(false)
const error          = ref<string | null>(null)
const selectedMonth = ref(new Date().getMonth() + 1)
const selectedYear  = ref(CURRENT_YEAR)
const selectedDivisionId = ref<number | null>(null)
const selectedSectionId  = ref<number | null>(null)

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const divisionOptions = computed(() => {
  const seen = new Map<number, string>()
  for (const ps of passSlips.value) {
    if (ps.division_id != null && ps.division) seen.set(ps.division_id, ps.division)
  }
  return Array.from(seen, ([value, title]) => ({ title, value }))
})

const sectionOptions = computed(() => {
  const seen = new Map<number, string>()
  for (const ps of passSlips.value) {
    if (selectedDivisionId.value != null && ps.division_id !== selectedDivisionId.value) continue
    if (ps.section_id != null && ps.section) seen.set(ps.section_id, ps.section)
  }
  return Array.from(seen, ([value, title]) => ({ title, value }))
})

const filteredItems = computed(() =>
  passSlips.value
    .filter(ps => selectedDivisionId.value == null || ps.division_id === selectedDivisionId.value)
    .filter(ps => selectedSectionId.value  == null || ps.section_id  === selectedSectionId.value)
)

const totalPassSlips = computed(() => filteredItems.value.length)
const totalMinutes   = computed(() => filteredItems.value.reduce((sum, ps) => sum + ps.minutes, 0))
const totalOfficial  = computed(() => filteredItems.value.filter(ps => ps.reason === 'official').length)
const totalPersonal  = computed(() => filteredItems.value.filter(ps => ps.reason !== 'official').length)

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function initials(fullName: string): string {
  const [surname, rest] = fullName.split(', ')
  const first = rest?.trim().charAt(0) ?? ''
  return `${surname?.charAt(0) ?? ''}${first}`.toUpperCase()
}

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */
async function fetchPassSlips() {
  loading.value = true
  error.value   = null
  try {
    const { data } = await axios.get('/api/pass-slip', {
      params: { month: selectedMonth.value, year: selectedYear.value },
    })
    passSlips.value = data.data ?? []
  } catch {
    error.value = 'Failed to load pass slip records.'
  } finally {
    loading.value = false
  }
}

watch([selectedMonth, selectedYear], () => {
  selectedDivisionId.value = null
  selectedSectionId.value  = null
  fetchPassSlips()
})

watch(selectedDivisionId, () => {
  selectedSectionId.value = null
})

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(fetchPassSlips)
</script>

<template>
  <div>
    <VContainer fluid class="pa-6">

      <!-- ── Page Header ── -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-2">
        <div>
          <h4 class="text-h5 font-weight-bold mb-1">Pass Slip Reference</h4>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Read-only list of approved, completed pass slips of all active JO employees for the selected period.
            View DTR to make edits — this page is for reference only.
          </p>
        </div>
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
        <VBtn size="small" variant="text" class="ml-2" @click="fetchPassSlips">
          Retry
        </VBtn>
      </VAlert>

      <!-- ── Filters ── -->
      <VRow class="mb-2 mt-4" dense>
        <VCol cols="6" sm="3">
          <VSelect
            v-model="selectedMonth"
            label="Month"
            :items="MONTH_OPTIONS"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
          />
        </VCol>
        <VCol cols="6" sm="2">
          <VSelect
            v-model="selectedYear"
            label="Year"
            :items="YEAR_OPTIONS"
            variant="outlined"
            density="compact"
            hide-details
          />
        </VCol>
        <VCol cols="6" sm="3">
          <VSelect
            v-model="selectedDivisionId"
            label="Division"
            :items="divisionOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            :no-data-text="'No divisions in this period'"
          />
        </VCol>
        <VCol cols="6" sm="3">
          <VSelect
            v-model="selectedSectionId"
            label="Section"
            :items="sectionOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            :no-data-text="'No sections in this period'"
          />
        </VCol>
      </VRow>

      <!-- ── Summary Cards ── -->
      <VRow class="mb-6 mt-2">
        <VCol cols="12" sm="3">
          <VCard variant="tonal" color="primary" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-badge-account-horizontal-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalPassSlips }}</div>
                <div class="text-body-2">Total Pass Slips</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="3">
          <VCard variant="tonal" color="info" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-clock-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalMinutes }}</div>
                <div class="text-body-2">Total Chargeable Minutes</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="3">
          <VCard variant="tonal" color="secondary" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-briefcase-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalOfficial }}</div>
                <div class="text-body-2">Official</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="3">
          <VCard variant="tonal" color="warning" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-account-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalPersonal }}</div>
                <div class="text-body-2">Personal</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- ── Table ── -->
      <BaseTable
        title="Pass Slip Records"
        :headers="TABLE_HEADERS"
        :items="filteredItems"
        :loading="loading"
        :items-per-page="15"
        searchable
      >
        <!-- Employee cell with avatar -->
        <template #item.employee_name="{ item }">
          <div class="d-flex align-center gap-3">
            <VAvatar :color="avatarColor(item.user_id)" variant="tonal" size="36">
              <span class="text-caption font-weight-medium">{{ initials(item.employee_name) }}</span>
            </VAvatar>
            <div>
              <div class="text-body-2 font-weight-medium">{{ item.employee_name }}</div>
              <div class="text-caption text-medium-emphasis">{{ item.position ?? '' }}</div>
            </div>
          </div>
        </template>

        <template #item.actual_time="{ item }">
          <span v-if="item.actual_time">{{ item.actual_time }}</span>
          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <!-- Minutes -->
        <template #item.minutes="{ item }">
          <span class="font-weight-medium">{{ item.minutes }}</span>
        </template>

        <!-- Type/label chip -->
        <template #item.label="{ item }">
          <VChip
            :color="item.reason === 'official' ? 'secondary' : 'warning'"
            size="small"
            variant="tonal"
            label
          >
            <VIcon
              start
              :icon="item.reason === 'official' ? 'mdi-briefcase-outline' : 'mdi-account-outline'"
              size="14"
            />
            {{ item.reason === 'official' ? 'Official' : 'Personal' }}
          </VChip>
          <div v-if="item.nature_business" class="text-caption text-medium-emphasis mt-1">
            {{ item.nature_business }}
          </div>
        </template>
      </BaseTable>

    </VContainer>
  </div>
</template>
