<template>
  <VDialog
    :model-value="modelValue"
    max-width="780"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <VCard v-if="entry" rounded="lg">
      <!-- ── Header ───────────────────────────────────────────────────── -->
      <VCardText class="pa-6 pb-3">
        <div class="d-flex align-center gap-3">
          <VAvatar color="indigo" variant="tonal" size="44" rounded="lg">
            <VIcon icon="mdi-account-group-outline" size="22" />
          </VAvatar>
          <div class="flex-grow-1 min-w-0">
            <div class="text-body-1 font-weight-medium text-truncate">{{ entry.section_name }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ entry.division_name ?? '—' }} · Standard week exemptions
            </div>
          </div>
          <VBtn icon variant="text" size="small" @click="emit('update:modelValue', false)">
            <VIcon>mdi-close</VIcon>
          </VBtn>
        </div>

        <VTabs v-model="tab" color="indigo" density="compact" class="mt-4">
          <VTab value="batches" prepend-icon="mdi-calendar-clock-outline">
            Batches
            <VChip v-if="tab === 'batches'" size="x-small" class="ml-2" variant="tonal">{{ meta.total }}</VChip>
          </VTab>
          <VTab value="individuals" prepend-icon="mdi-account-clock">
            Individuals
            <VChip v-if="tab === 'individuals'" size="x-small" class="ml-2" variant="tonal">{{ meta.total }}</VChip>
          </VTab>
        </VTabs>

        <!-- ── Filters ─────────────────────────────────────────────────── -->
        <div class="sws-filters mt-3">
          <div class="sws-year">
            <VBtn icon="mdi-chevron-left" size="x-small" variant="text" @click="filterYear--" />
            <span class="text-body-2 font-weight-medium">{{ filterYear }}</span>
            <VBtn icon="mdi-chevron-right" size="x-small" variant="text" @click="filterYear++" />
          </div>
          <VSelect
            v-model="filterMonth"
            :items="monthOptions"
            item-title="title"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            class="sws-month"
          />
          <VTextField
            v-model="search"
            :placeholder="tab === 'batches' ? 'Search batch label' : 'Search employee'"
            density="compact"
            variant="outlined"
            prepend-inner-icon="mdi-magnify"
            hide-details
            clearable
            class="sws-search"
          />
          <VBtn
            color="indigo"
            variant="tonal"
            prepend-icon="mdi-plus"
            @click="tab === 'batches' ? openBatchForm('create') : openIndividualForm()"
          >
            {{ tab === 'batches' ? 'Batch' : 'Individual' }}
          </VBtn>
        </div>
      </VCardText>

      <VDivider />

      <!-- ── List ─────────────────────────────────────────────────────── -->
      <VCardText class="pa-4" style="min-height: 320px;">
        <VSkeletonLoader v-if="listLoading" type="list-item-two-line, list-item-two-line, list-item-two-line" />

        <div v-else-if="isEmpty" class="sws-empty">
          <VIcon :icon="tab === 'batches' ? 'mdi-calendar-blank-outline' : 'mdi-account-off-outline'" size="32" class="text-medium-emphasis mb-2" />
          <p class="text-body-2 text-medium-emphasis mb-0">
            No {{ tab === 'batches' ? 'batches' : 'individual exemptions' }} for {{ periodLabel }}{{ search ? ' matching your search' : '' }}.
          </p>
        </div>

        <!-- Batches -->
        <template v-else-if="tab === 'batches'">
          <div
            v-for="b in batches"
            :key="b.id"
            class="sws-row"
            @click="openBatchDetail(b)"
          >
            <div class="sws-row-main">
              <div class="d-flex align-center gap-2">
                <span class="sws-row-title">{{ b.label }}</span>
                <VChip size="x-small" color="primary" variant="tonal">
                  <VIcon start size="11">mdi-account-multiple</VIcon>
                  {{ b.employee_exemptions_count ?? 0 }}
                </VChip>
              </div>
              <div class="sws-weeks">
                <VChip
                  v-for="w in b.weeks.slice(0, MAX_WEEK_CHIPS)"
                  :key="w"
                  size="x-small"
                  label
                  variant="tonal"
                  :color="isWeekInFilter(w) ? 'indigo' : undefined"
                >
                  Wk {{ formatDisplayDate(w) }}
                </VChip>
                <span v-if="b.weeks.length > MAX_WEEK_CHIPS" class="text-caption text-medium-emphasis">
                  +{{ b.weeks.length - MAX_WEEK_CHIPS }} more
                </span>
              </div>
              <div v-if="b.notes" class="text-caption text-medium-emphasis text-truncate">{{ b.notes }}</div>
            </div>
            <div class="sws-row-actions" @click.stop>
              <VBtn icon size="x-small" variant="text" color="indigo" title="Duplicate with new weeks" @click="openBatchForm('duplicate', b)">
                <VIcon size="15">mdi-content-copy</VIcon>
              </VBtn>
              <VBtn icon size="x-small" variant="text" color="primary" title="Edit" @click="openBatchForm('edit', b)">
                <VIcon size="15">mdi-pencil-outline</VIcon>
              </VBtn>
              <VBtn icon size="x-small" variant="text" color="error" title="Delete" @click="confirmDeleteBatch(b)">
                <VIcon size="15">mdi-delete-outline</VIcon>
              </VBtn>
            </div>
          </div>
        </template>

        <!-- Individuals -->
        <template v-else>
          <div v-for="r in individuals" :key="r.emp_id" class="sws-row sws-row--static">
            <div class="sws-row-main">
              <div class="d-flex align-center gap-2 flex-wrap">
                <span class="sws-row-title">{{ r.emp_name }}</span>
                <span v-if="r.position" class="text-caption text-medium-emphasis">{{ r.position }}</span>
                <VChip v-if="!r.still_in_section" size="x-small" color="warning" variant="tonal" title="No longer in this section — weeks can be removed but not added">
                  Transferred
                </VChip>
              </div>
              <div class="sws-weeks">
                <VChip v-for="w in r.weeks" :key="w" size="x-small" label variant="tonal" color="indigo">
                  Wk {{ formatDisplayDate(w) }}
                </VChip>
              </div>
            </div>
            <div class="sws-row-actions">
              <VBtn icon size="x-small" variant="text" color="primary" title="Edit weeks" @click="openIndividualForm(r)">
                <VIcon size="15">mdi-pencil-outline</VIcon>
              </VBtn>
              <VBtn icon size="x-small" variant="text" color="error" :title="`Remove weeks in ${periodLabel}`" @click="confirmRemoveIndividual(r)">
                <VIcon size="15">mdi-delete-outline</VIcon>
              </VBtn>
            </div>
          </div>
        </template>
      </VCardText>

      <VDivider />

      <!-- ── Pagination ───────────────────────────────────────────────── -->
      <VCardActions class="pa-3 d-flex justify-space-between align-center flex-wrap gap-2">
        <span class="text-caption text-medium-emphasis">
          {{ meta.total ? `Showing ${rangeStart}–${rangeEnd} of ${meta.total}` : '' }}
        </span>
        <VPagination
          v-if="meta.last_page > 1"
          v-model="page"
          :length="meta.last_page"
          :total-visible="5"
          density="compact"
          size="small"
          color="indigo"
        />
      </VCardActions>
    </VCard>

    <!-- ── Batch create / edit / duplicate ─────────────────────────────── -->
    <VDialog v-model="batchForm.visible" max-width="440" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="text-body-1 font-weight-medium mb-1">{{ batchFormTitle }}</div>
          <div class="text-caption text-medium-emphasis mb-4">{{ entry?.section_name }}</div>

          <VAlert
            v-if="batchForm.mode === 'duplicate'"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            The same {{ batchForm.sourceCount }} employee(s) will be copied. Anyone no longer in this section is skipped.
          </VAlert>

          <div class="cm-field mb-3">
            <label class="cm-label">Label <span class="cm-required">*</span></label>
            <VTextField
              v-model="batchForm.label"
              placeholder="e.g. November 2026 – Field Team"
              density="compact"
              variant="outlined"
              prepend-inner-icon="mdi-tag-outline"
              hide-details="auto"
            />
          </div>

          <div class="cm-field mb-3">
            <label class="cm-label">Standard Weeks <span class="cm-required">*</span></label>
            <StandardWeekSelector v-model="batchForm.weeks" color="indigo" />
          </div>

          <div class="cm-field">
            <label class="cm-label">Notes</label>
            <VTextField
              v-model="batchForm.notes"
              placeholder="Optional — e.g. memo reference"
              density="compact"
              variant="outlined"
              prepend-inner-icon="mdi-note-outline"
              hide-details="auto"
            />
          </div>

          <VAlert v-if="batchForm.error" type="error" variant="tonal" density="compact" class="mt-3">
            {{ batchForm.error }}
          </VAlert>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="batchForm.loading" @click="batchForm.visible = false">Cancel</VBtn>
          <VBtn color="indigo" variant="tonal" :loading="batchForm.loading" @click="submitBatchForm">
            {{ batchForm.mode === 'edit' ? 'Save Changes' : batchForm.mode === 'duplicate' ? 'Duplicate' : 'Create Batch' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Batch detail (assigned employees) ────────────────────────────── -->
    <VDialog v-model="batchDetail.visible" max-width="560" scrollable>
      <VCard rounded="lg">
        <VCardText class="pa-6 pb-0">
          <div class="d-flex align-center gap-3">
            <VAvatar color="indigo" variant="tonal" size="40" rounded="lg">
              <VIcon icon="mdi-calendar-clock-outline" size="20" />
            </VAvatar>
            <div class="flex-grow-1 min-w-0">
              <div class="text-body-1 font-weight-medium text-truncate">{{ batchDetail.batch?.label }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ batchDetail.batch?.weeks.length ?? 0 }} week(s) ·
                {{ batchDetail.batch ? formatDisplayDate(batchDetail.batch.start_date) : '' }} –
                {{ batchDetail.batch ? formatDisplayDate(batchDetail.batch.end_date) : '' }}
              </div>
            </div>
            <VBtn icon variant="text" size="small" @click="batchDetail.visible = false">
              <VIcon>mdi-close</VIcon>
            </VBtn>
          </div>
        </VCardText>

        <VDivider class="mt-4" />

        <VCardText class="pa-6">
          <div class="d-flex justify-space-between align-center mb-3">
            <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
              Assigned Employees
              <VChip size="x-small" color="primary" variant="tonal" class="ml-1">{{ batchDetail.assigned.length }}</VChip>
            </p>
            <VBtn size="small" variant="tonal" color="indigo" prepend-icon="mdi-account-plus-outline" @click="openPicker">
              Assign Employees
            </VBtn>
          </div>

          <VSkeletonLoader v-if="batchDetail.loading" type="list-item-two-line, list-item-two-line" />

          <div v-else-if="batchDetail.assigned.length === 0" class="sws-empty sws-empty--bordered">
            <VIcon icon="mdi-account-off-outline" size="28" class="text-medium-emphasis mb-2" />
            <p class="text-body-2 text-medium-emphasis mb-0">No employees assigned yet.</p>
          </div>

          <template v-else>
            <div class="d-flex align-center gap-2 mb-2">
              <VCheckboxBtn
                :model-value="allDetailChecked"
                :indeterminate="someDetailChecked"
                density="compact"
                color="error"
                hide-details
                @update:model-value="toggleAllDetail"
              />
              <span class="text-caption text-medium-emphasis">Select all</span>
              <VSpacer />
              <VBtn
                v-if="batchDetail.selected.length"
                size="small"
                variant="tonal"
                color="error"
                :loading="batchDetail.removing"
                prepend-icon="mdi-account-minus-outline"
                @click="removeSelectedFromBatch"
              >
                Remove ({{ batchDetail.selected.length }})
              </VBtn>
            </div>

            <div style="max-height: 340px; overflow-y: auto;">
              <div v-for="a in batchDetail.assigned" :key="a.id" class="cm-list-item">
                <div class="cm-list-item-info">
                  <VCheckboxBtn
                    :model-value="batchDetail.selected.includes(a.id)"
                    density="compact"
                    color="error"
                    hide-details
                    @update:model-value="toggleDetail(a.id)"
                  />
                  <span class="cm-list-item-label">{{ a.emp_name }}</span>
                </div>
                <VBtn icon size="x-small" variant="text" color="error" @click="removeFromBatch([a.id])">
                  <VIcon size="15">mdi-close</VIcon>
                </VBtn>
              </div>
            </div>
          </template>
        </VCardText>
      </VCard>
    </VDialog>

    <!-- ── Employee picker (section-scoped) ─────────────────────────────── -->
    <VDialog v-model="picker.visible" max-width="480" scrollable>
      <VCard rounded="lg">
        <VCardText class="pa-6 pb-2">
          <div class="text-body-1 font-weight-medium mb-1">Assign Employees</div>
          <div class="text-caption text-medium-emphasis mb-3">Employees currently in {{ entry?.section_name }}</div>
          <VTextField
            v-model="picker.search"
            placeholder="Search by name or position"
            density="compact"
            variant="outlined"
            prepend-inner-icon="mdi-magnify"
            hide-details
            clearable
          />
        </VCardText>
        <VDivider />
        <VCardText class="pa-0" style="max-height: 400px; overflow-y: auto;">
          <div v-if="filteredPickerEmployees.length" class="d-flex align-center gap-2 pa-3 pb-0">
            <VCheckboxBtn
              :model-value="allPickerChecked"
              :indeterminate="somePickerChecked"
              density="compact"
              color="indigo"
              hide-details
              @update:model-value="toggleAllPicker"
            />
            <span class="text-caption text-medium-emphasis">Select all shown ({{ filteredPickerEmployees.length }})</span>
          </div>

          <VSkeletonLoader v-if="picker.loading" type="list-item-two-line, list-item-two-line, list-item-two-line" />

          <VList v-else>
            <VListItem v-for="emp in filteredPickerEmployees" :key="emp.emp_id" @click="togglePicker(emp.emp_id)">
              <template #prepend>
                <VCheckboxBtn :model-value="picker.selected.includes(emp.emp_id)" />
              </template>
              <VListItemTitle>{{ emp.name }}</VListItemTitle>
              <VListItemSubtitle>{{ emp.position }}</VListItemSubtitle>
            </VListItem>
            <p v-if="!filteredPickerEmployees.length" class="text-center text-body-2 text-medium-emphasis pa-4 mb-0">
              No unassigned employees in this section.
            </p>
          </VList>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-space-between pa-4">
          <span class="text-caption text-medium-emphasis">{{ picker.selected.length }} selected</span>
          <div class="d-flex gap-2">
            <VBtn variant="text" @click="picker.visible = false">Cancel</VBtn>
            <VBtn
              color="indigo"
              variant="tonal"
              :loading="picker.assigning"
              :disabled="!picker.selected.length"
              @click="confirmPicker"
            >
              Assign ({{ picker.selected.length }})
            </VBtn>
          </div>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Individual add / edit ────────────────────────────────────────── -->
    <VDialog v-model="individualForm.visible" max-width="440" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="text-body-1 font-weight-medium mb-1">
            {{ individualForm.isEditing ? 'Edit Individual Weeks' : 'Add Individual Exemption' }}
          </div>
          <div class="text-caption text-medium-emphasis mb-4">{{ entry?.section_name }}</div>

          <div class="cm-field mb-3">
            <label class="cm-label">Employee <span class="cm-required">*</span></label>

            <VCard v-if="individualForm.empId" variant="tonal" :color="individualForm.isEditing ? 'grey' : 'indigo'" rounded="lg" flat>
              <VCardText class="d-flex align-center gap-2 pa-3">
                <VIcon icon="mdi-account" size="18" />
                <span class="text-body-2 font-weight-medium">{{ individualForm.empName }}</span>
                <VSpacer />
                <VBtn v-if="!individualForm.isEditing" size="x-small" variant="text" @click="individualForm.empId = null; individualForm.empName = ''; individualForm.weeks = []">
                  Change
                </VBtn>
              </VCardText>
            </VCard>

            <template v-else>
              <VTextField
                v-model="individualForm.employeeSearch"
                placeholder="Search by name"
                density="compact"
                variant="outlined"
                prepend-inner-icon="mdi-magnify"
                hide-details
                clearable
              />
              <div style="max-height: 220px; overflow-y: auto;" class="mt-2">
                <VSkeletonLoader v-if="individualForm.loadingEmployees" type="list-item-two-line, list-item-two-line" />
                <VList v-else density="compact">
                  <VListItem v-for="emp in filteredIndividualEmployees" :key="emp.emp_id" @click="selectIndividualEmployee(emp)">
                    <VListItemTitle>{{ emp.name }}</VListItemTitle>
                    <VListItemSubtitle>{{ emp.position }}</VListItemSubtitle>
                  </VListItem>
                  <p v-if="!filteredIndividualEmployees.length" class="text-caption text-medium-emphasis pa-2 mb-0">
                    No matching employees in this section.
                  </p>
                </VList>
              </div>
            </template>
          </div>

          <div v-if="individualForm.empId" class="cm-field">
            <label class="cm-label">Standard Weeks <span class="cm-required">*</span></label>
            <VSkeletonLoader v-if="individualForm.loadingWeeks" type="image" height="180" />
            <StandardWeekSelector v-else v-model="individualForm.weeks" color="indigo" />
            <p class="text-caption text-medium-emphasis mt-1 mb-0">
              Shows all of this employee's weeks in this section, across every month.
            </p>
          </div>

          <VAlert v-if="individualForm.error" type="error" variant="tonal" density="compact" class="mt-3">
            {{ individualForm.error }}
          </VAlert>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="individualForm.loading" @click="individualForm.visible = false">Cancel</VBtn>
          <VBtn color="indigo" variant="tonal" :loading="individualForm.loading" @click="submitIndividualForm">
            {{ individualForm.isEditing ? 'Save Changes' : 'Add Exemption' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Generic confirm ──────────────────────────────────────────────── -->
    <VDialog v-model="confirm.visible" max-width="400">
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-3">
            <VAvatar color="error" variant="tonal" size="40" rounded="lg">
              <VIcon icon="mdi-delete-outline" size="20" />
            </VAvatar>
            <div class="text-body-1 font-weight-medium">{{ confirm.title }}</div>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-0">{{ confirm.message }}</p>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="confirm.loading" @click="confirm.visible = false">Cancel</VBtn>
          <VBtn color="error" variant="tonal" :loading="confirm.loading" @click="runConfirm">Remove</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VDialog>
</template>

<script setup lang="ts">
import StandardWeekSelector from '@/components/payroll/StandardWeekSelector.vue'
import {
  formatDisplayDate,
  usePayrollCalendar,
  type ContractBreakEmployeePickerRow,
  type EmployeeStandardWeekExemption,
  type PageMeta,
  type SectionIndividualRow,
  type SectionStandardWeekBatch,
  type StandardWeekSectionEntry,
} from '@/composable/usePayrollCalendar'
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps<{
  modelValue:   boolean
  entry:        StandardWeekSectionEntry | null
  initialYear:  number
  initialMonth: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'changed'): void                                               // refresh sidebar counts
  (e: 'notify', message: string, color?: 'success' | 'error'): void  // parent snackbar
}>()

const {
  fetchSectionBatches,
  fetchSectionIndividuals,
  fetchSectionEmployeePicker,
  fetchSectionIndividualWeeks,
  syncSectionIndividual,
  clearSectionIndividual,
  duplicateStandardWeekBatch,
  addStandardWeekBatch,
  updateStandardWeekBatch,
  removeStandardWeekBatch,
  fetchStandardWeekBatchEmployees,
  assignEmployeesToStandardWeekBatch,
  unassignStandardWeekExemption,
} = usePayrollCalendar()

const MONTH_NAMES    = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const PER_PAGE       = 10
const MAX_WEEK_CHIPS = 5

// ---------------------------------------------------------------------------
// Filters + list state
// ---------------------------------------------------------------------------
const tab         = ref<'batches' | 'individuals'>('batches')
const filterYear  = ref(props.initialYear)
const filterMonth = ref<number | null>(props.initialMonth)
const search      = ref('')
const page        = ref(1)

const batches     = ref<SectionStandardWeekBatch[]>([])
const individuals = ref<SectionIndividualRow[]>([])
const meta        = ref<PageMeta>({ current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 })
const listLoading = ref(false)

const monthOptions = [
  { title: 'Whole year', value: null },
  ...MONTH_NAMES.map((m, i) => ({ title: m, value: i + 1 })),
]

const periodLabel = computed(() =>
  filterMonth.value ? `${MONTH_NAMES[filterMonth.value - 1]} ${filterYear.value}` : `${filterYear.value}`,
)

const isEmpty    = computed(() => (tab.value === 'batches' ? batches.value : individuals.value).length === 0)
const rangeStart = computed(() => (meta.value.current_page - 1) * meta.value.per_page + 1)
const rangeEnd   = computed(() => Math.min(meta.value.current_page * meta.value.per_page, meta.value.total))

let requestSeq = 0
async function loadList() {
  if (!props.entry) return
  const seq = ++requestSeq
  listLoading.value = true

  const params = {
    year: filterYear.value,
    month: filterMonth.value,
    search: search.value ?? '',
    page: page.value,
    per_page: PER_PAGE,
  }

  if (tab.value === 'batches') {
    const res = await fetchSectionBatches(props.entry.id, params)
    if (seq !== requestSeq) return
    batches.value = res.data
    meta.value    = res.meta
  } else {
    const res = await fetchSectionIndividuals(props.entry.id, params)
    if (seq !== requestSeq) return
    individuals.value = res.data
    meta.value        = res.meta
  }

  // Deleting the last row on the last page → step back a page
  if (page.value > meta.value.last_page) {
    page.value = meta.value.last_page
    return
  }
  listLoading.value = false
}

function afterMutation() {
  loadList()
  emit('changed')
}

// Reset whenever the modal opens for a section
watch(() => [props.modelValue, props.entry?.id] as const, ([open]) => {
  if (!open || !props.entry) return
  tab.value         = 'batches'
  filterYear.value  = props.initialYear
  filterMonth.value = props.initialMonth
  search.value      = ''
  page.value        = 1
  loadList()
})

watch([tab, filterYear, filterMonth], () => {
  if (!props.modelValue) return
  if (page.value !== 1) page.value = 1 // page watcher reloads
  else loadList()
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (!props.modelValue) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (page.value !== 1) page.value = 1
    else loadList()
  }, 350)
})

watch(page, () => {
  if (props.modelValue) loadList()
})

function isWeekInFilter(monday: string): boolean {
  const d     = new Date(monday + 'T00:00:00')
  const sun   = new Date(d); sun.setDate(d.getDate() + 6)
  const year  = filterYear.value
  const month = filterMonth.value
  if (!month) return d.getFullYear() === year || sun.getFullYear() === year
  const inMonth = (x: Date) => x.getFullYear() === year && x.getMonth() + 1 === month
  return inMonth(d) || inMonth(sun)
}

// ---------------------------------------------------------------------------
// Batch create / edit / duplicate
// ---------------------------------------------------------------------------
type BatchFormMode = 'create' | 'edit' | 'duplicate'

const batchForm = reactive({
  visible:     false,
  mode:        'create' as BatchFormMode,
  batchId:     null as number | null,
  sourceCount: 0,
  label:       '',
  weeks:       [] as string[],
  notes:       '',
  error:       '',
  loading:     false,
})

const batchFormTitle = computed(() => ({
  create:    'Add Batch',
  edit:      'Edit Batch',
  duplicate: 'Duplicate Batch',
}[batchForm.mode]))

function openBatchForm(mode: BatchFormMode, batch?: SectionStandardWeekBatch) {
  batchForm.mode        = mode
  batchForm.batchId     = batch?.id ?? null
  batchForm.sourceCount = batch?.employee_exemptions_count ?? 0
  batchForm.label       = mode === 'duplicate' ? '' : (batch?.label ?? '')
  batchForm.weeks       = mode === 'edit' ? [...(batch?.weeks ?? [])] : []
  batchForm.notes       = batch?.notes ?? ''
  batchForm.error       = ''
  batchForm.loading     = false
  batchForm.visible     = true
}

async function submitBatchForm() {
  batchForm.error = ''
  if (!batchForm.label.trim())  { batchForm.error = 'Please enter a label.'; return }
  if (!batchForm.weeks.length)  { batchForm.error = 'Please select at least one week.'; return }
  if (!props.entry) return

  batchForm.loading = true
  let ok = false
  let message = ''

  if (batchForm.mode === 'duplicate' && batchForm.batchId) {
    const res = await duplicateStandardWeekBatch(batchForm.batchId, batchForm.label, batchForm.weeks, batchForm.notes)
    ok = res.success
    message = res.message
  } else if (batchForm.mode === 'edit' && batchForm.batchId) {
    const res = await updateStandardWeekBatch(batchForm.batchId, batchForm.label, batchForm.weeks, batchForm.notes)
    ok = res === true
    message = ok ? 'Batch updated.' : (res as string)
  } else {
    const res = await addStandardWeekBatch(batchForm.label, batchForm.weeks, batchForm.notes, props.entry.id)
    ok = res === true
    message = ok ? 'Batch created. Click it to assign employees.' : (res as string)
  }

  batchForm.loading = false
  if (!ok) { batchForm.error = message; return }

  batchForm.visible = false
  emit('notify', message)
  afterMutation()
}

function confirmDeleteBatch(b: SectionStandardWeekBatch) {
  openConfirm(
    'Delete batch?',
    `"${b.label}" and its ${b.employee_exemptions_count ?? 0} employee assignment(s) will be removed.`,
    async () => {
      const res = await removeStandardWeekBatch(b.id)
      if (res !== true) return res
      emit('notify', 'Batch deleted.')
      afterMutation()
      return true
    },
  )
}

// ---------------------------------------------------------------------------
// Batch detail
// ---------------------------------------------------------------------------
const batchDetail = reactive({
  visible:  false,
  batch:    null as SectionStandardWeekBatch | null,
  assigned: [] as EmployeeStandardWeekExemption[],
  loading:  false,
  selected: [] as number[],
  removing: false,
})

async function openBatchDetail(b: SectionStandardWeekBatch) {
  batchDetail.batch    = b
  batchDetail.selected = []
  batchDetail.visible  = true
  await reloadBatchDetail()
}

async function reloadBatchDetail() {
  if (!batchDetail.batch) return
  batchDetail.loading  = true
  batchDetail.assigned = await fetchStandardWeekBatchEmployees(batchDetail.batch.id)
  batchDetail.loading  = false
}

const allDetailChecked  = computed(() =>
  batchDetail.assigned.length > 0 && batchDetail.assigned.every(a => batchDetail.selected.includes(a.id)),
)
const someDetailChecked = computed(() =>
  batchDetail.assigned.some(a => batchDetail.selected.includes(a.id)) && !allDetailChecked.value,
)

function toggleAllDetail() {
  batchDetail.selected = allDetailChecked.value ? [] : batchDetail.assigned.map(a => a.id)
}

function toggleDetail(id: number) {
  batchDetail.selected = batchDetail.selected.includes(id)
    ? batchDetail.selected.filter(x => x !== id)
    : [...batchDetail.selected, id]
}

async function removeFromBatch(ids: number[]) {
  batchDetail.removing = true
  const results = await Promise.all(ids.map(id => unassignStandardWeekExemption(id)))
  batchDetail.removing = false

  const failed  = results.filter(r => r !== true).length
  const removed = ids.length - failed
  batchDetail.selected = []

  emit('notify', failed ? `${removed} removed, ${failed} failed.` : `${removed} employee(s) removed.`, failed ? 'error' : 'success')
  await reloadBatchDetail()
  afterMutation()
}

function removeSelectedFromBatch() {
  removeFromBatch([...batchDetail.selected])
}

// ---------------------------------------------------------------------------
// Employee picker (section-scoped)
// ---------------------------------------------------------------------------
const picker = reactive({
  visible:   false,
  search:    '',
  employees: [] as ContractBreakEmployeePickerRow[],
  selected:  [] as number[],
  loading:   false,
  assigning: false,
})

async function openPicker() {
  if (!props.entry || !batchDetail.batch) return
  picker.search    = ''
  picker.selected  = []
  picker.visible   = true
  picker.loading   = true
  picker.employees = await fetchSectionEmployeePicker(props.entry.id, batchDetail.batch.id)
  picker.loading   = false
}

const filteredPickerEmployees = computed(() => {
  const q    = (picker.search ?? '').trim().toLowerCase()
  const base = picker.employees.filter(e => !e.already_assigned)
  if (!q) return base
  return base.filter(e => e.name.toLowerCase().includes(q) || e.position.toLowerCase().includes(q))
})

const allPickerChecked  = computed(() =>
  filteredPickerEmployees.value.length > 0 && filteredPickerEmployees.value.every(e => picker.selected.includes(e.emp_id)),
)
const somePickerChecked = computed(() =>
  filteredPickerEmployees.value.some(e => picker.selected.includes(e.emp_id)) && !allPickerChecked.value,
)

function toggleAllPicker() {
  const ids = filteredPickerEmployees.value.map(e => e.emp_id)
  picker.selected = allPickerChecked.value
    ? picker.selected.filter(id => !ids.includes(id))
    : Array.from(new Set([...picker.selected, ...ids]))
}

function togglePicker(id: number) {
  picker.selected = picker.selected.includes(id)
    ? picker.selected.filter(x => x !== id)
    : [...picker.selected, id]
}

async function confirmPicker() {
  if (!batchDetail.batch || !picker.selected.length) return
  picker.assigning = true
  const res = await assignEmployeesToStandardWeekBatch(batchDetail.batch.id, picker.selected)
  picker.assigning = false

  emit('notify', res.message, res.success ? 'success' : 'error')
  if (!res.success) return

  picker.visible = false
  await reloadBatchDetail()
  afterMutation()
}

// ---------------------------------------------------------------------------
// Individual add / edit
// ---------------------------------------------------------------------------
const individualForm = reactive({
  visible:          false,
  isEditing:        false,
  empId:            null as number | null,
  empName:          '',
  weeks:            [] as string[],
  employees:        [] as ContractBreakEmployeePickerRow[],
  employeeSearch:   '',
  loadingEmployees: false,
  loadingWeeks:     false,
  error:            '',
  loading:          false,
})

async function openIndividualForm(row?: SectionIndividualRow) {
  if (!props.entry) return
  individualForm.isEditing      = !!row
  individualForm.empId          = row?.emp_id ?? null
  individualForm.empName        = row?.emp_name ?? ''
  individualForm.weeks          = []
  individualForm.employeeSearch = ''
  individualForm.error          = ''
  individualForm.loading        = false
  individualForm.visible        = true

  if (row) {
    await loadIndividualWeeks(row.emp_id)
  } else {
    individualForm.loadingEmployees = true
    individualForm.employees        = await fetchSectionEmployeePicker(props.entry.id)
    individualForm.loadingEmployees = false
  }
}

async function loadIndividualWeeks(empId: number) {
  if (!props.entry) return
  individualForm.loadingWeeks = true
  individualForm.weeks        = await fetchSectionIndividualWeeks(props.entry.id, empId)
  individualForm.loadingWeeks = false
}

const filteredIndividualEmployees = computed(() => {
  const q = (individualForm.employeeSearch ?? '').trim().toLowerCase()
  if (!q) return individualForm.employees
  return individualForm.employees.filter(e => e.name.toLowerCase().includes(q))
})

async function selectIndividualEmployee(emp: ContractBreakEmployeePickerRow) {
  individualForm.empId   = emp.emp_id
  individualForm.empName = emp.name
  // Existing weeks in this section are pre-loaded so adding is additive
  await loadIndividualWeeks(emp.emp_id)
}

async function submitIndividualForm() {
  individualForm.error = ''
  if (!props.entry) return
  if (!individualForm.empId) { individualForm.error = 'Please select an employee.'; return }
  if (!individualForm.weeks.length) {
    individualForm.error = individualForm.isEditing
      ? 'Select at least one week. To remove all, close this and use the delete button.'
      : 'Please select at least one week.'
    return
  }

  individualForm.loading = true
  const res = await syncSectionIndividual(props.entry.id, individualForm.empId, individualForm.weeks)
  individualForm.loading = false

  if (res !== true) { individualForm.error = res; return }

  individualForm.visible = false
  emit('notify', 'Exemption saved.')
  afterMutation()
}

function confirmRemoveIndividual(r: SectionIndividualRow) {
  openConfirm(
    'Remove exemption?',
    `${r.emp_name}'s ${r.week_count} week(s) in ${periodLabel.value} will be removed from this section. Weeks in other months are kept.`,
    async () => {
      if (!props.entry) return 'No section selected.'
      const res = await clearSectionIndividual(props.entry.id, r.emp_id, filterYear.value, filterMonth.value)
      if (res !== true) return res
      emit('notify', 'Exemption removed.')
      afterMutation()
      return true
    },
  )
}

// ---------------------------------------------------------------------------
// Generic confirm
// ---------------------------------------------------------------------------
const confirm = reactive({
  visible: false,
  title:   '',
  message: '',
  loading: false,
  action:  null as null | (() => Promise<true | string>),
})

function openConfirm(title: string, message: string, action: () => Promise<true | string>) {
  confirm.title   = title
  confirm.message = message
  confirm.action  = action
  confirm.loading = false
  confirm.visible = true
}

async function runConfirm() {
  if (!confirm.action) return
  confirm.loading = true
  const res = await confirm.action()
  confirm.loading = false
  if (res !== true) { emit('notify', res, 'error'); return }
  confirm.visible = false
}
</script>

<style scoped>
.sws-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.sws-year {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0 0.25rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  height: 40px;
}

.sws-month  { flex: 0 0 150px; }
.sws-search { flex: 1 1 180px; min-width: 160px; }

.sws-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  cursor: pointer;
}
.sws-row:last-child      { border-bottom: none; }
.sws-row:hover           { background: rgba(var(--v-theme-on-surface), 0.04); }
.sws-row--static         { cursor: default; }
.sws-row--static:hover   { background: transparent; }

.sws-row-main {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.sws-row-title {
  font-size: 0.875rem;
  font-weight: 500;
}

.sws-row-actions {
  display: flex;
  flex-shrink: 0;
}

.sws-weeks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.sws-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}
.sws-empty--bordered {
  padding: 1.5rem 1rem;
  border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}

.cm-field { display: flex; flex-direction: column; gap: 0.3rem; }
.cm-label { font-size: 0.85rem; font-weight: 600; }
.cm-required { color: rgb(var(--v-theme-error)); }

.cm-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.cm-list-item:last-child { border-bottom: none; }
.cm-list-item-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.cm-list-item-label {
  font-size: 0.82rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.min-w-0 { min-width: 0; }
</style>
