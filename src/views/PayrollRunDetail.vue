<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
import PayrollItemAdjustmentsDialog from '@/components/payroll/PayrollItemAdjustmentsDialog.vue'
import axios from '@axios'
import { useRoute, useRouter } from 'vue-router'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Signatory {
  id:       number
  name:     string
  position: string
  role:     'approved_by' | 'certified_by'
}

interface SelectableEmployee {
  emp_id:          number
  name:            string
  position:        string
  section_name:    string | null
  salary_grade:    number
  has_wage:        boolean
  wage:            number
  hrmis_wage:      number | null   
  has_hrmis_wage:  boolean 
  already_added:   boolean
  already_paid:    boolean          // NEW: finalized in another run for this same period
  paid_payroll_no: string | null    // NEW: which run they were paid under, for the tooltip/chip
}

interface BatchItem {
  id:                      number
  emp_id:                  number
  emp_name:                string
  position:                string | null
  division_name:           string | null
  section_name:            string | null
  engas_no:                string | null
  nip:                     boolean
  wage:                    number
  premium_percent:         number
  premium:                 number
  gross:                   number
  regdays:                 number
  total_rendered_hours:    number
  total_absent_days:       number
  total_late_minutes:      number
  total_undertime_minutes: number
  daily_rate:              number
  work_minutes_per_day:    number
  absent_deduction:        number
  late_ut_deduction:       number
  philhealth:              number
  pag_ibig:                number
  sss:                     number
  ewt:                     number
  total_deductions:        number
  net_pay:                 number
  remarks:                 string | null
  is_overridden:           boolean
  dtr_absent_days:         number
  dtr_late_minutes:        number
  dtr_undertime_minutes:   number
}

interface SectionGroup {
  section_name: string | null
  employees:    BatchItem[]
  subtotal:     GroupTotals
}

interface DivisionGroup {
  division_name: string
  sections:      SectionGroup[]
  subtotal:      GroupTotals
}

interface GroupTotals {
  gross: number; philhealth: number; pag_ibig: number
  sss: number; ewt: number; total_deductions: number; net_pay: number
}

interface PayrollRunDetail {
  id:             number
  payroll_no:     string
  period_month:   number
  period_year:    number
  division_id:    number          // ← FIX #3: added so fetchSignatories can send it
  division_name:  string
  section_name:   string | null
  fund_cluster:   string
  saa_no:         string | null
  ors_no:         string | null
  dv_no:          string | null
  jev_no:         string | null
  uacs_code:      string | null
  status:         'draft' | 'finalized'
  employee_count: number
  total_net_pay:  number
  groups:         DivisionGroup[]
}

type AlertType = 'success' | 'error' | 'warning' | 'info'
type DocType   = 'payroll_sheet' | 'ors' | 'dv'
type ActiveTab = 'employees' | 'meta'

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const HARDCODED_APPROVED_BY_PAYROLL: Signatory = {
  id: 0,
  name: 'EXUPERIA B. SABALBERINO, MD, MPH, CESE',
  position: 'DIRECTOR IV',
  role: 'approved_by',
}
const WAGE_SG_CUTOFF     = 16
const WAGE_PAGIBIG_MIN   = 400
const WAGE_SSS_MIN       = 750
const WAGE_PREMIUM_OPTIONS = [
  { title: '5%',  value: 0.05 },
  { title: '10%', value: 0.10 },
  { title: '15%', value: 0.15 },
  { title: '20%', value: 0.20 },
]

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const route  = useRoute()
const router = useRouter()

const run         = ref<PayrollRunDetail | null>(null)
const loading     = ref(false)
const activeTab   = ref<ActiveTab>('employees')

// ── Metadata ──
const metaEditing = ref(false)
const metaSaving  = ref(false)
const metaForm    = ref({
  fund_cluster: '', saa_no: '', ors_no: '',
  dv_no: '', jev_no: '', uacs_code: '',
})
// ── DTR not saved blocking state ──
const dtrNotSavedDialog = ref(false)
const dtrNotSavedMessage = ref('')
// ── Status ──
const finalizeLoading = ref(false)
const revertLoading   = ref(false)

// ── Employee Selection ──
const selectableEmps    = ref<SelectableEmployee[]>([])
const selectableLoading = ref(false)
const selectedEmpIds    = ref<number[]>([])
const addingEmployees   = ref(false)
const empSearch         = ref('')

// ── Quick Set Deduction (from Add Employees panel) ──
const wageDialog       = ref(false)
const wageSaving       = ref(false)
const wageSssOptIn     = ref(false)
const wageTargetEmp    = ref<SelectableEmployee | null>(null)
const wageForm         = ref({
  wage: 0, premium_percent: 0.05, philhealth: 500,
  pag_ibig: WAGE_PAGIBIG_MIN, sss: 0, ewt_rate: 5,
})
const wageFormErrors   = ref<Partial<Record<keyof typeof wageForm.value, string>>>({})

// ── Inline Edit ──
const editingItem    = ref<BatchItem | null>(null)
const editForm       = ref<Partial<BatchItem> & { days_absent?: number; minutes_late_ut?: number }>({})
const editSaving     = ref(false)
const editDialog     = ref(false)

// ── Remove ──
const removeTarget  = ref<BatchItem | null>(null)
const removeDialog  = ref(false)
const removeLoading = ref(false)

// ── Adjustments ──
const adjustmentTarget  = ref<BatchItem | null>(null)
const adjustmentDialog  = ref(false)

// ── Recompute ──
const recomputeTarget  = ref<BatchItem | null>(null)
const recomputeDialog  = ref(false)
const recomputeLoading = ref(false)

// ── ENGAS No. inline edit ──
const engasEditingItemId = ref<number | null>(null)
const engasEditValue     = ref('')
const engasSaving        = ref(false)

// ── Document Generation ──
const docDialog   = ref(false)
const docType     = ref<DocType>('payroll_sheet')
const docLoading  = ref(false)
const sigsLoading = ref(false)

// Resolved signatory data from backend
const approvedBySig    = ref<Signatory | null>(null)
const certifiedBySlots = ref<(Signatory | null)[]>([])  // ordered slots (null = user picks)
const selectablePool   = ref<Signatory[]>([])            // all certified_by for free dropdown
const slot1Locked      = ref(false)                      // true = division-matched, false = dropdown

// User selections
const selectedApprovedBy  = ref<number | null>(null)
const selectedCertifiedBy = ref<(number | null)[]>([])

// ── Alert ──
const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const periodLabel = computed(() => {
  if (!run.value) return ''
  return `${MONTH_NAMES[run.value.period_month - 1]} ${run.value.period_year}`
})

const grandTotal = computed((): GroupTotals => {
  const z = (): GroupTotals => ({ gross:0,philhealth:0,pag_ibig:0,sss:0,ewt:0,total_deductions:0,net_pay:0 })
  if (!run.value) return z()
  return run.value.groups.reduce((acc, div) => {
    div.sections.forEach(sec => sec.employees.forEach(emp => {
      acc.gross            += Number(emp.gross)
      acc.philhealth       += Number(emp.philhealth)
      acc.pag_ibig         += Number(emp.pag_ibig)
      acc.sss              += Number(emp.sss)
      acc.ewt              += Number(emp.ewt)
      acc.total_deductions += Number(emp.total_deductions)
      acc.net_pay          += Number(emp.net_pay)
    }))
    return acc
  }, z())
})

const wagePhilhealthMin = computed(() => {
  if (!wageTargetEmp.value) return 500
  return (wageTargetEmp.value.salary_grade ?? 0) >= WAGE_SG_CUTOFF
    ? Math.round(Number(wageForm.value.wage) * 0.05 * 100) / 100
    : 500
})

watch(() => wageForm.value.wage, (newWage) => {
  if ((wageTargetEmp.value?.salary_grade ?? 0) >= WAGE_SG_CUTOFF) {
    wageForm.value.philhealth = Math.round(Number(newWage) * 0.05 * 100) / 100
  }
})

const canFinalize = computed(() => run.value?.status === 'draft' && (run.value?.employee_count ?? 0) > 0)
const canRevert   = computed(() => run.value?.status === 'finalized')
const canGenerate = computed(() => run.value?.status === 'finalized')
const isDraft     = computed(() => run.value?.status === 'draft')

const filteredSelectableEmps = computed(() => {
  const q = empSearch.value.toLowerCase()
  return selectableEmps.value.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.position.toLowerCase().includes(q)
  )
})

const availableEmps = computed(() =>
  filteredSelectableEmps.value.filter(e => !e.already_added)
)

const docTypeLabel = computed(() => {
  if (docType.value === 'payroll_sheet') return 'Payroll Sheet'
  if (docType.value === 'ors')           return 'Obligation Request & Status (ORS)'
  return 'Disbursement Voucher (DV)'
})

// Approved By — always static, shown as read-only text
const approvedByName = computed(() => {
  const useHardcoded = docType.value === 'payroll_sheet' || docType.value === 'dv'
  const sig = useHardcoded ? HARDCODED_APPROVED_BY_PAYROLL : approvedBySig.value
  return sig?.name ?? '—'
})

const approvedByPosition = computed(() => {
  const useHardcoded = docType.value === 'payroll_sheet' || docType.value === 'dv'
  const sig = useHardcoded ? HARDCODED_APPROVED_BY_PAYROLL : approvedBySig.value
  return sig?.position ?? ''
})

// Dropdown options for slot 1 when division is not mapped
const slot1Options = computed(() =>
  selectablePool.value.map(s => ({
    title: `${s.name} — ${s.position}`,
    value: s.id,
  }))
)

// Number of certified slots per doc type
const certifiedSlotCount = computed(() =>
  docType.value === 'payroll_sheet' ? 3 : 2
)

const orsLoading = ref(false)
 
async function generateORSFromBackend() {
  if (!run.value) return
  orsLoading.value = true
  try {
    const response = await axios.post(
      `/api/payroll-run/${run.value.id}/generate-ors`,
      {},
      { responseType: 'blob' }
    )
    const filename = `ORS-${run.value.payroll_no}.pdf`
    const file = new File([response.data], filename, { type: 'application/pdf' })
    const url  = URL.createObjectURL(file)
    const tab  = window.open(url, '_blank')
    if (!tab) {
      showAlert('warning', 'Popup blocked. Please allow popups and try again.')
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err: any) {
    showAlert('error', 'Failed to generate ORS.')
  } finally {
    orsLoading.value = false
  }
}

const dvLoading = ref(false)

async function generateDVFromBackend() {
  if (!run.value) return
  dvLoading.value = true
  try {
    const response = await axios.post(
      `/api/payroll-run/${run.value.id}/generate-dv`,
      {},
      { responseType: 'blob' }
    )
    const filename = `DV-${run.value.payroll_no}.pdf`
    const file = new File([response.data], filename, { type: 'application/pdf' })
    const url  = URL.createObjectURL(file)
    const tab  = window.open(url, '_blank')
    if (!tab) {
      showAlert('warning', 'Popup blocked. Please allow popups and try again.')
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err: any) {
    showAlert('error', 'Failed to generate DV.')
  } finally {
    dvLoading.value = false
  }
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const fmt = (v: number | string) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
  }).format(Number(v) ?? 0)

const fmtNum = (v: number | string) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(v) ?? 0)

function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}

function syncMetaForm() {
  if (!run.value) return
  metaForm.value = {
    fund_cluster: run.value.fund_cluster ?? '',
    saa_no:       run.value.saa_no       ?? '',
    ors_no:       run.value.ors_no       ?? '',
    dv_no:        run.value.dv_no        ?? '',
    jev_no:       run.value.jev_no       ?? '',
    uacs_code:    run.value.uacs_code    ?? '',
  }
}

function allEmployees(): BatchItem[] {
  if (!run.value) return []
  return run.value.groups.flatMap(d => d.sections.flatMap(s => s.employees))
}

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */
async function fetchRun() {
  loading.value = true
  try {
    const { data } = await axios.get(`/api/payroll-run/${route.params.id}`)
    run.value = data.data
    syncMetaForm()
  } catch {
    showAlert('error', 'Failed to load payroll run.')
  } finally {
    loading.value = false
  }
}

async function fetchSelectableEmployees() {
  selectableLoading.value = true
  try {
    const { data } = await axios.get(`/api/payroll-run/${route.params.id}/selectable-employees`)
    selectableEmps.value = data.data ?? []
  } catch {
    showAlert('error', 'Failed to load employees.')
  } finally {
    selectableLoading.value = false
  }
}

async function fetchSignatories(type: DocType) {
  sigsLoading.value = true
  try {
    const { data } = await axios.get('/api/signatories', {
      params: {
        division_id: run.value?.division_id ?? undefined,
        doc_type:    type,
      },
    })

    const payload = data.data

    // Approved By — static, just store it
    approvedBySig.value      = payload.approved_by ?? null
    selectedApprovedBy.value = approvedBySig.value?.id ?? null

    // Certified By — ordered slots from backend
    certifiedBySlots.value = payload.certified_by    // (Signatory | null)[]
    selectablePool.value   = payload.selectable_pool  // all certified_by for free slot 1
    slot1Locked.value      = payload.slot1_locked

    // Pre-populate selections: locked slots use their id, free slot stays null
    selectedCertifiedBy.value = certifiedBySlots.value.map(s => s?.id ?? null)

  } catch {
    showAlert('error', 'Failed to load signatories.')
  } finally {
    sigsLoading.value = false
  }
}

async function addSelectedEmployees() {
  if (!selectedEmpIds.value.length) return
  addingEmployees.value = true
  try {
    const { data } = await axios.post(
      `/api/payroll-run/${route.params.id}/add-employees`,
      { emp_ids: selectedEmpIds.value }
    )
    if (!data.success) {
      if (data.dtr_not_saved) {
        dtrNotSavedMessage.value = data.message
        dtrNotSavedDialog.value  = true
      } else {
        throw new Error(data.message ?? 'Failed to add.')
      }
      return
    }
    showAlert('success', data.message)
    selectedEmpIds.value = []
    await fetchRun()
    await fetchSelectableEmployees()
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to add employees.')
  } finally {
    addingEmployees.value = false
  }
}

async function saveMeta() {
  metaSaving.value = true
  try {
    const { data } = await axios.post(
      `/api/payroll-run/update-meta/${run.value!.id}`,
      metaForm.value
    )
    if (!data.success) throw new Error(data.message ?? 'Failed to save.')
    Object.assign(run.value!, metaForm.value)
    metaEditing.value = false
    showAlert('success', 'Metadata updated.')
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to save metadata.')
  } finally {
    metaSaving.value = false
  }
}

async function finalizeRun() {
  finalizeLoading.value = true
  try {
    const { data } = await axios.post(`/api/payroll-run/finalize/${run.value!.id}`)
    if (!data.success) throw new Error(data.message)
    run.value!.status = 'finalized'
    showAlert('success', 'Payroll run finalized. Documents are now available.')
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to finalize.')
  } finally {
    finalizeLoading.value = false
  }
}

async function revertRun() {
  revertLoading.value = true
  try {
    const { data } = await axios.post(`/api/payroll-run/revert/${run.value!.id}`)
    if (!data.success) throw new Error(data.message)
    run.value!.status = 'draft'
    showAlert('success', 'Reverted to Draft.')
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to revert.')
  } finally {
    revertLoading.value = false
  }
}

async function saveEditForm() {
  if (!editingItem.value || !run.value) return
  editSaving.value = true
  try {
    const { data } = await axios.post(
      `/api/payroll-run/${run.value.id}/items/${editingItem.value.id}/update`,
      {
        days_absent:     editForm.value.days_absent,
        minutes_late_ut: editForm.value.minutes_late_ut,
        philhealth:      editForm.value.philhealth,
        pag_ibig:        editForm.value.pag_ibig,
        sss:             editForm.value.sss,
        ewt:             editForm.value.ewt,
        remarks:         editForm.value.remarks?.trim() || null,
      }
    )
    if (!data.success) throw new Error(data.message)
    showAlert('success', 'Employee row updated.')
    editDialog.value = false
    await fetchRun()
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to update.')
  } finally {
    editSaving.value = false
  }
}

async function confirmRemove() {
  if (!removeTarget.value || !run.value) return
  removeLoading.value = true
  try {
    const { data } = await axios.post(
      `/api/payroll-run/${run.value.id}/employees/${removeTarget.value.emp_id}/remove`
    )
    if (!data.success) throw new Error(data.message)
    showAlert('success', `${removeTarget.value.emp_name} removed from batch.`)
    removeDialog.value = false
    await fetchRun()
    await fetchSelectableEmployees()
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to remove.')
  } finally {
    removeLoading.value = false
  }
}

async function confirmRecompute() {
  if (!recomputeTarget.value || !run.value) return
  recomputeLoading.value = true
  try {
    const { data } = await axios.post(
      `/api/payroll-run/${run.value.id}/employees/${recomputeTarget.value.emp_id}/recompute`
    )
    if (!data.success) throw new Error(data.message)
    showAlert('success', `${recomputeTarget.value.emp_name} recomputed from latest DTR data.`)
    recomputeDialog.value = false
    await fetchRun()
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to recompute.')
  } finally {
    recomputeLoading.value = false
  }
}

/* ─────────────────────────────────────────
   HANDLERS
───────────────────────────────────────── */
function openEditDialog(item: BatchItem) {
  editingItem.value = item
  editForm.value = {
    days_absent:     Number(item.total_absent_days),
    minutes_late_ut: Number(item.total_late_minutes) + Number(item.total_undertime_minutes),
    philhealth:      Number(item.philhealth),
    pag_ibig:        Number(item.pag_ibig),
    sss:             Number(item.sss),
    ewt:             Number(item.ewt),
    remarks:         item.remarks ?? null,
  }
  editDialog.value = true
}

function openRemoveDialog(item: BatchItem) {
  removeTarget.value = item
  removeDialog.value = true
}

function openEngasEdit(item: BatchItem) {
  engasEditingItemId.value = item.id
  engasEditValue.value     = item.engas_no ?? ''
}

function openAdjustmentDialog(item: BatchItem) {
  adjustmentTarget.value = item
  adjustmentDialog.value = true
}
 
// Called by the dialog's @updated emit — patches the item in-place
// so the table row updates without a full fetchRun()
function onAdjustmentUpdated(updatedItem: BatchItem) {
  if (!run.value) return
  for (const div of run.value.groups) {
    for (const sec of div.sections) {
      const idx = sec.employees.findIndex(e => e.id === updatedItem.id)
      if (idx !== -1) {
        sec.employees[idx] = { ...sec.employees[idx], ...updatedItem }
        return
      }
    }
  }
}
 

function openRecomputeDialog(item: BatchItem) {
  recomputeTarget.value = item
  recomputeDialog.value = true
}

function openWageDialog(emp: SelectableEmployee) {
  wageTargetEmp.value = emp
  wageSssOptIn.value  = false
  const prefillWage = emp.has_hrmis_wage && emp.hrmis_wage ? emp.hrmis_wage : (emp.wage || 0)
  wageForm.value = {
    wage: prefillWage,
    premium_percent: 0.05,
    philhealth: (emp.salary_grade ?? 0) >= WAGE_SG_CUTOFF
      ? Math.round(prefillWage * 0.05 * 100) / 100
      : 500,
    pag_ibig: WAGE_PAGIBIG_MIN,
    sss: 0,
    ewt_rate: 5,
  }
  wageFormErrors.value = {}
  wageDialog.value = true
}

function validateWageForm(): boolean {
  const errs: Partial<Record<keyof typeof wageForm.value, string>> = {}
  if (!wageForm.value.wage || Number(wageForm.value.wage) <= 0)
    errs.wage = 'Monthly wage is required and must be greater than ₱0.'
  if (Number(wageForm.value.philhealth) < wagePhilhealthMin.value)
    errs.philhealth = `PhilHealth must be at least ${fmt(wagePhilhealthMin.value)}.`
  if (Number(wageForm.value.pag_ibig) < WAGE_PAGIBIG_MIN)
    errs.pag_ibig = `Pag-IBIG must be at least ${fmt(WAGE_PAGIBIG_MIN)}.`
  if (wageSssOptIn.value && Number(wageForm.value.sss) < WAGE_SSS_MIN)
    errs.sss = `SSS must be at least ${fmt(WAGE_SSS_MIN)} if deducting.`
  wageFormErrors.value = errs
  return Object.keys(errs).length === 0
}

async function saveWage() {
  if (!wageTargetEmp.value || !validateWageForm()) return
  wageSaving.value = true
  try {
    const payload = { ...wageForm.value, sss: wageSssOptIn.value ? wageForm.value.sss : 0 }
    const { data } = await axios.post(`/api/wage/upsert/${wageTargetEmp.value.emp_id}`, payload)
    if (!data.success) throw new Error(data.message ?? 'Save failed.')
    showAlert('success', `Deductions saved for ${wageTargetEmp.value.name}.`)
    wageDialog.value = false
    await fetchSelectableEmployees()   // refreshes chip + unlocks checkbox
  } catch (err: any) {
    if (err.response?.data?.errors) {
      wageFormErrors.value = Object.fromEntries(
        Object.entries(err.response.data.errors).map(([k, v]) => [k, (v as string[])[0]])
      )
    }
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to save deduction.')
  } finally {
    wageSaving.value = false
  }
}

async function saveEngasNo(item: BatchItem) {
  if (!run.value) return
  engasSaving.value = true
  try {
    const { data } = await axios.post(
      `/api/payroll-run/${run.value.id}/items/${item.id}/update-engas`,
      { engas_no: engasEditValue.value.trim() || null }
    )
    if (!data.success) throw new Error(data.message)
    showAlert('success', 'ENGAS No. saved.')
    engasEditingItemId.value = null
    await fetchRun()
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to save ENGAS No.')
  } finally {
    engasSaving.value = false
  }
}

function openDocDialog(type: DocType) {
  docType.value   = type
  docDialog.value = true
  fetchSignatories(type)
}

const editComputedAbsent = computed(() => {
  if (!editingItem.value) return 0
  const days      = Number(editForm.value.days_absent ?? 0)
  const dailyRate = Number(editingItem.value.daily_rate ?? 0)
  return Math.round(days * dailyRate * 100) / 100
})

const editComputedLateUt = computed(() => {
  if (!editingItem.value) return 0
  const mins      = Number(editForm.value.minutes_late_ut ?? 0)
  const dailyRate = Number(editingItem.value.daily_rate ?? 0)
  const perHour   = Math.round(dailyRate / 8 * 100) / 100
  const perMinute = Math.round(perHour / 60 * 100) / 100
  return Math.round(mins * perMinute * 100) / 100
})

const editPreviewNet = computed(() => {
  if (!editingItem.value) return 0
  const gross = Number(editingItem.value.gross)
  const total = (
    editComputedAbsent.value +
    editComputedLateUt.value +
    Number(editForm.value.philhealth ?? 0) +
    Number(editForm.value.pag_ibig   ?? 0) +
    Number(editForm.value.sss        ?? 0) +
    Number(editForm.value.ewt        ?? 0)
  )
  return Math.round((gross - total) * 100) / 100
})

/* ─────────────────────────────────────────
   DOCUMENT GENERATION
───────────────────────────────────────── */
async function generateDocument() {
  if (!run.value) return
  // ORS/DV — dialog is a read-only confirmation; backend resolves signatories itself
  if (docType.value === 'ors') {
    await generateORSFromBackend()
    docDialog.value = false
    return
  }
  if (docType.value === 'dv') {
    await generateDVFromBackend()
    docDialog.value = false
    return
  }
  docLoading.value = true
  try {
    if (!(window as any).jspdf) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
        s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load jsPDF.'))
        document.head.appendChild(s)
      })
    }
    if (!(window as any).jspdfAutotable) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
        s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load AutoTable.'))
        document.head.appendChild(s);(window as any).jspdfAutotable = true
      })
    }

    // Approved By — always the static ref
    const approvedSig = docType.value === 'payroll_sheet'
  ? HARDCODED_APPROVED_BY_PAYROLL
  : approvedBySig.value

    // Certified By — resolve slot 1 from user pick if free, otherwise use locked slot
    const resolvedCertified: (Signatory | null)[] = certifiedBySlots.value.map((slot, i) => {
      if (i === 0 && !slot1Locked.value) {
        const picked = selectedCertifiedBy.value[0]
        return selectablePool.value.find(s => s.id === picked) ?? null
      }
      return slot
    })

    const certSigs = resolvedCertified.slice(0, certifiedSlotCount.value)

   generatePayrollSheet(approvedSig, certSigs)

    showAlert('success', `${docTypeLabel.value} opened in a new tab.`)
    docDialog.value = false
  } catch (err: any) {
    showAlert('error', err.message ?? 'Document generation failed.')
  } finally {
    docLoading.value = false
  }
}

function openPdf(doc: any) {
  const blob = doc.output('blob')
  const url  = URL.createObjectURL(blob)
  const tab  = window.open(url, '_blank')
  if (!tab) { showAlert('error', 'Popup blocked. Please allow popups.'); URL.revokeObjectURL(url); return }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function generatePayrollSheet(approvedSig: Signatory | null, certSigs: (Signatory | null)[]) {
  const { jsPDF } = (window as any).jspdf
  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' })
  const r     = run.value!
  const pageW = doc.internal.pageSize.getWidth()
  const BLK   = [0,0,0]         as [number,number,number]
  const GRAY  = [80,80,80]      as [number,number,number]
  const LGRAY = [180,180,180]   as [number,number,number]
  const WHITE = [255,255,255]   as [number,number,number]

  const emps = allEmployees()
  const gt   = grandTotal.value

  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...BLK)
  doc.text('PAYROLL', pageW/2, 10, { align:'center' })
  doc.setFont('helvetica','normal'); doc.setFontSize(8)
  doc.text(`For the period ${MONTH_NAMES[r.period_month-1].toUpperCase()} ${r.period_year}`, pageW/2, 16, { align:'center' })

  doc.setFontSize(7.5); doc.setTextColor(...GRAY)
  doc.text(`Entity Name : DEPARTMENT OF HEALTH - CENTER FOR HEALTH DEVELOPMENT, SOCCSKSARGEN REGION`, 14, 23)
  doc.text(`Payroll No. : ${r.payroll_no}`, pageW - 14, 23, { align:'right' })
  doc.text(`Fund Cluster : ${r.fund_cluster || '_____________'}`, 14, 28)
  doc.text('Sheet _______ of _______ Sheets', pageW - 14, 28, { align:'right' })

  doc.setFontSize(7); doc.setFont('helvetica','italic')
  doc.text('We acknowledge receipt of cash shown opposite our name as full compensation for services rendered for the period covered.', 14, 34)

  let serial = 1
  const tableBody: any[] = []

  r.groups.forEach(div => {
    div.sections.forEach(sec => {
      sec.employees.forEach(emp => {
        const nipLabel       = emp.nip ? ' (NIP)' : ''
        const grossAmtEarned = Number(emp.gross) - Number(emp.absent_deduction) - Number(emp.late_ut_deduction)
        tableBody.push([
          serial++,
          emp.engas_no || '',
          emp.emp_name + nipLabel,
          emp.position || '',
          fmtNum(emp.wage),
          fmtNum(emp.premium),
          fmtNum(emp.gross),
          fmtNum(emp.absent_deduction),
          fmtNum(emp.late_ut_deduction),
          fmtNum(grossAmtEarned),
          emp.ewt > 0 ? fmtNum(emp.ewt) : '',
          fmtNum(emp.philhealth),
          fmtNum(emp.pag_ibig),
          emp.sss > 0 ? fmtNum(emp.sss) : '',
          fmtNum(emp.net_pay),
          emp.remarks || '',
          r.saa_no ? `SAA ${r.saa_no}${emp.nip ? ' (NIP)' : ''}` : '',
        ])
      })
    })
  })

  const totalAbsent      = emps.reduce((s,e) => s + Number(e.absent_deduction), 0)
  const totalLateUt      = emps.reduce((s,e) => s + Number(e.late_ut_deduction), 0)
  const totalGrossEarned = emps.reduce((s,e) => s + (Number(e.gross) - Number(e.absent_deduction) - Number(e.late_ut_deduction)), 0)
  tableBody.push([
    { content: 'TOTAL', colSpan: 4, styles: { fontStyle:'bold', halign:'left' } },
    { content: fmtNum(emps.reduce((s,e)=>s+Number(e.wage),0)),    styles:{ halign:'right', fontStyle:'bold' } },
    { content: fmtNum(emps.reduce((s,e)=>s+Number(e.premium),0)), styles:{ halign:'right', fontStyle:'bold' } },
    { content: fmtNum(gt.gross),         styles:{ halign:'right', fontStyle:'bold' } },
    { content: fmtNum(totalAbsent),      styles:{ halign:'right', fontStyle:'bold' } },
    { content: fmtNum(totalLateUt),      styles:{ halign:'right', fontStyle:'bold' } },
    { content: fmtNum(totalGrossEarned), styles:{ halign:'right', fontStyle:'bold' } },
    { content: fmtNum(gt.ewt),           styles:{ halign:'right', fontStyle:'bold' } },
    { content: fmtNum(gt.philhealth),    styles:{ halign:'right', fontStyle:'bold' } },
    { content: fmtNum(gt.pag_ibig),      styles:{ halign:'right', fontStyle:'bold' } },
    { content: fmtNum(gt.sss),           styles:{ halign:'right', fontStyle:'bold' } },
    { content: fmtNum(gt.net_pay),       styles:{ halign:'right', fontStyle:'bold' } },
    { content: '', colSpan: 2 },
  ])

  ;(doc as any).autoTable({
    startY: 37,
    head: [[
      { content: 'Serial\nNo.',         rowSpan: 2, styles: { valign:'middle', halign:'center' } },
      { content: 'Engas\nNo.',          rowSpan: 2, styles: { valign:'middle', halign:'center' } },
      { content: 'Name',                rowSpan: 2, styles: { valign:'middle' } },
      { content: 'Position',            rowSpan: 2, styles: { valign:'middle' } },
      { content: 'Wage',                rowSpan: 2, styles: { valign:'middle', halign:'center' } },
      { content: '20%\nPremium',         rowSpan: 2, styles: { valign:'middle', halign:'center' } },
      { content: 'COMPENSATION',        colSpan: 4, styles: { halign:'center' } },
      { content: 'D E D U C T I O N S',colSpan: 4, styles: { halign:'center' } },
      { content: 'Net Amount\nDue',     rowSpan: 2, styles: { valign:'middle', halign:'center' } },
      { content: 'REMARKS',             rowSpan: 2, styles: { valign:'middle' } },
      { content: 'CHARGING',            rowSpan: 2, styles: { valign:'middle' } },
    ],[
      'Total',
      'Amount of\nDay/s not\nrendered/\nNo contract',
      'Amount of\nMinute/s\nLate/UT/\nPass Slip',
      'GROSS\nAMOUNT\nEARNED',
      'Expanded\nWithholding\nTax 5%',
      'Philhealth',
      'PAG-IBIG',
      'SSS',
    ]],
    body: tableBody,
    theme: 'grid',
    tableWidth: pageW - 28,
    styles: { fontSize:6.5, cellPadding:1.5, valign:'middle', overflow:'linebreak', textColor:BLK, lineColor:LGRAY, lineWidth:0.15 },
    headStyles: { fillColor:WHITE, textColor:BLK, fontStyle:'bold', halign:'center', fontSize:6.5, lineColor:BLK, lineWidth:0.3 },
    columnStyles: {
      0:  { halign:'center', cellWidth:12 },
      1:  { cellWidth:18 },
      2:  { cellWidth:'auto' },
      3:  { cellWidth:24 },
      4:  { halign:'right', cellWidth:16 },
      5:  { halign:'right', cellWidth:14 },
      6:  { halign:'right', cellWidth:16 },
      7:  { halign:'right', cellWidth:17 },
      8:  { halign:'right', cellWidth:17 },
      9:  { halign:'right', cellWidth:18 },
      10: { halign:'right', cellWidth:16 },
      11: { halign:'right', cellWidth:15 },
      12: { halign:'right', cellWidth:13 },
      13: { halign:'right', cellWidth:13 },
      14: { halign:'right', cellWidth:18 },
      15: { cellWidth:28 },
      16: { cellWidth:22 },
    },
    margin: { left:14, right:14 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 2
  const TW   = pageW - 28
  const cLbl = 9.2
  const cL   = (TW - cLbl) * 0.40
  const cM   = (TW - cLbl) * 0.40
  const cR   = TW - cLbl - cL - cM

  const aSig = certSigs[0] ?? null
  const bSig = certSigs[1] ?? null
  const cSig = certSigs[2] ?? null

  const sigLine = (sig: Signatory | null): string => {
    const name     = sig?.name     ?? ''
    const position = sig?.position ?? ''
    return `\n\n\n\n                                     ________________________________________\n                                               ${name}\n                                                   ${position}`
  }

  const sigLineWithDateA = (sig: Signatory | null): string => {
    const name     = sig?.name     ?? ''
    const position = sig?.position ?? ''
    return `\n\n\n\n___________________________________                               ______________\n${name}                                                       Date\n${position}`
  }

  const sigLineWithDateB = (sig: Signatory | null): string => {
    const name     = sig?.name     ?? ''
    const position = sig?.position ?? ''
    return `\n\n\n\n_________________________________________                                                                                            _______________\n${name}                                                                                                                          Date\n                   ${position}                                                                                                                                       `
  }

  const sigLineWithDateC = (sig: Signatory | null): string => {
    const name     = sig?.name     ?? ''
    const position = sig?.position ?? ''
    return `\n\n\n\n___________________________________                               ______________\n${name}                                                      Date\n${position}`
  }

  ;(doc as any).autoTable({
    startY: finalY,
    tableWidth: TW,
    body: [[
      { content: 'A', styles: { fontStyle:'bold', fontSize:7, cellPadding:{top:3,left:2,right:2,bottom:3}, valign:'top', halign:'left' } },
      {
        content: `CERTIFIED:  Services duly rendered as stated.${sigLineWithDateA(aSig)}`,
        styles: { fontSize:7, cellPadding:{top:3,left:7,right:0,bottom:3}, valign:'top', halign:'left' }
      },
      {
        content: `APPROVED FOR PAYMENT: _______________________________________${sigLineWithDateB(approvedSig)}`,
        styles: { fontSize:7, cellPadding:{top:3,left:30,right:0,bottom:3}, valign:'top', halign:'left' },
        colSpan: 2,
      },
    ]],
    theme: 'grid',
    styles: { textColor:BLK, lineColor:BLK, lineWidth:0.2, overflow:'linebreak' },
    columnStyles: {
      0: { cellWidth: cLbl },
      1: { cellWidth: cL   },
      2: { cellWidth: cM + cR },
    },
    margin: { left:14, right:14 },
  })

  ;(doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY,
    tableWidth: TW,
    body: [[
      { content: 'B', styles: { fontStyle:'bold', fontSize:7, cellPadding:{top:3,left:2,right:2,bottom:3}, valign:'top', halign:'left' } },
      {
        content: `CERTIFIED:  Supporting documents complete and proper; and cash available in the amount of \nP______________________.${sigLineWithDateC(bSig)}`,
        styles: { fontSize:7, cellPadding:{top:3,left:7,right:0,bottom:3}, valign:'top', halign:'left' }
      },
      {
        content: `CERTIFIED:  Supporting documents complete and proper; and cash available in the amount of \n\nP______________________.${sigLine(cSig)}`,
        styles: { fontSize:7, cellPadding:{top:3,left:7,right:0,bottom:3}, valign:'top', halign:'left' }
      },
      {
        content: `E   ORS/BURS No.${r.ors_no ? ' ' + r.ors_no : ' ___________________________'}\n\nDate : ___________________________\nJEV No. : ___________________________\nDate : ___________________________`,
        styles: { fontSize:7, cellPadding:{top:3,left:3,right:3,bottom:3}, valign:'top', halign:'left' }
      },
    ]],
    theme: 'grid',
    styles: { textColor:BLK, lineColor:BLK, lineWidth:0.2, overflow:'linebreak' },
    columnStyles: {
      0: { cellWidth: cLbl },
      1: { cellWidth: cL   },
      2: { cellWidth: cM   },
      3: { cellWidth: cR   },
    },
    margin: { left:14, right:14 },
  })

  openPdf(doc)
}

const docGenerateLoading = computed(() => {
  if (docType.value === 'ors') return orsLoading.value
  if (docType.value === 'dv')  return dvLoading.value
  return docLoading.value
})

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(async () => {
  await fetchRun()
  await fetchSelectableEmployees()
})
</script>

<template>
  <div>
    <VContainer fluid class="pa-6">

      <!-- ── Back + Header ── -->
      <div class="d-flex align-center gap-3 mb-4">
        <VBtn icon variant="text" size="small" @click="router.back()">
          <VIcon>mdi-arrow-left</VIcon>
        </VBtn>
        <div class="flex-grow-1">
          <div class="d-flex align-center gap-3 flex-wrap">
            <h4 class="text-h5 font-weight-bold mb-0">
              {{ run ? run.payroll_no : 'Loading...' }}
            </h4>
            <VChip v-if="run"
              :color="run.status === 'finalized' ? 'success' : 'warning'"
              size="small" variant="tonal" label
            >
              <VIcon start :icon="run.status === 'finalized' ? 'mdi-check-circle-outline' : 'mdi-pencil-outline'" size="14" />
              {{ run.status === 'finalized' ? 'Finalized' : 'Draft' }}
            </VChip>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-0 mt-1">
            {{ run ? `${periodLabel} — ${run.division_name}${run.section_name ? ' › ' + run.section_name : ''}` : '' }}
          </p>
        </div>

        <!-- Status Actions -->
        <div v-if="run" class="d-flex gap-2 flex-wrap">
          <VBtn v-if="canRevert" variant="outlined" color="warning" size="small"
            prepend-icon="mdi-undo" :loading="revertLoading" @click="revertRun">
            Revert to Draft
          </VBtn>
          <VBtn v-if="canFinalize" color="success" size="small"
            prepend-icon="mdi-check-circle-outline" :loading="finalizeLoading" @click="finalizeRun">
            Finalize
          </VBtn>
        </div>
      </div>

      <VSkeletonLoader v-if="loading" type="card, table" class="mt-4" />

      <template v-else-if="run">
        <VRow>

          <!-- ── LEFT PANEL ── -->
          <VCol cols="12" lg="3">

            <!-- Run Summary -->
            <VCard variant="tonal" color="primary" rounded="lg" flat class="mb-4">
              <VCardText>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">Run Summary</p>
                <div class="d-flex flex-column gap-2">
                  <div class="d-flex justify-space-between">
                    <span class="text-body-2 text-medium-emphasis">Employees</span>
                    <span class="text-body-2 font-weight-medium">{{ run.employee_count }}</span>
                  </div>
                  <div class="d-flex justify-space-between">
                    <span class="text-body-2 text-medium-emphasis">Total Gross</span>
                    <span class="text-body-2 font-weight-medium">{{ fmt(grandTotal.gross) }}</span>
                  </div>
                  <div class="d-flex justify-space-between">
                    <span class="text-body-2 text-medium-emphasis">PhilHealth</span>
                    <span class="text-body-2 font-weight-medium text-error">{{ fmt(grandTotal.philhealth) }}</span>
                  </div>
                  <div class="d-flex justify-space-between">
                    <span class="text-body-2 text-medium-emphasis">Pag-IBIG</span>
                    <span class="text-body-2 font-weight-medium text-error">{{ fmt(grandTotal.pag_ibig) }}</span>
                  </div>
                  <div class="d-flex justify-space-between">
                    <span class="text-body-2 text-medium-emphasis">SSS</span>
                    <span class="text-body-2 font-weight-medium text-error">{{ fmt(grandTotal.sss) }}</span>
                  </div>
                  <VDivider class="my-1" />
                  <div class="d-flex justify-space-between">
                    <span class="text-body-2 font-weight-bold">Net Pay</span>
                    <span class="text-body-2 font-weight-bold text-success">{{ fmt(grandTotal.net_pay) }}</span>
                  </div>
                </div>
              </VCardText>
            </VCard>

            <!-- Document Generation -->
            <VCard variant="outlined" rounded="lg" class="mb-4">
              <VCardText>
                <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-3">Generate Documents</p>
                <VAlert v-if="!canGenerate" type="warning" variant="tonal" density="compact" icon="mdi-lock-outline" class="mb-3 text-body-2">
                  Finalize this run to unlock document generation.
                </VAlert>
                <div class="d-flex flex-column gap-2">
                  <VBtn block :disabled="!canGenerate" color="primary" variant="tonal"
                    prepend-icon="mdi-file-table-outline" @click="openDocDialog('payroll_sheet')">
                    Payroll Sheet
                  </VBtn>
                  <VBtn block :disabled="!canGenerate" color="indigo" variant="tonal"
                    prepend-icon="mdi-file-document-outline"
                    @click="openDocDialog('ors')">
                    Obligation Request & Status
                  </VBtn>
                  <VBtn block :disabled="!canGenerate" color="deep-purple" variant="tonal"
                  prepend-icon="mdi-receipt-text-outline"
                  @click="openDocDialog('dv')">
                  Disbursement Voucher
                  </VBtn>
                </div>
              </VCardText>
            </VCard>

          </VCol>

          <!-- ── RIGHT PANEL ── -->
          <VCol cols="12" lg="9">
            <VTabs v-model="activeTab" class="mb-4">
              <VTab value="employees">
                <VIcon start size="16">mdi-account-group-outline</VIcon>
                Employees
                <VChip size="x-small" class="ml-2" color="primary" variant="tonal">
                  {{ run.employee_count }}
                </VChip>
              </VTab>
              <VTab value="meta">
                <VIcon start size="16">mdi-file-cog-outline</VIcon>
                Metadata
              </VTab>
            </VTabs>

            <!-- ── EMPLOYEES TAB ── -->
            <VTabsWindow v-model="activeTab">
              <VTabsWindowItem value="employees">

                <!-- Employee Selection (Draft only) -->
                <VCard v-if="isDraft" variant="outlined" rounded="lg" class="mb-4">
                  <VCardText>
                    <div class="d-flex align-center justify-space-between mb-3">
                      <div>
                        <p class="text-body-2 font-weight-medium mb-0">Add Employees to Batch</p>
                        <p class="text-caption text-medium-emphasis mb-0">
                          Select employees from {{ run.section_name ?? run.division_name }}. Only employees with wage records are selectable.
                        </p>
                      </div>
                      <VBtn
                        color="primary" size="small" variant="tonal"
                        prepend-icon="mdi-plus"
                        :disabled="!selectedEmpIds.length"
                        :loading="addingEmployees"
                        @click="addSelectedEmployees"
                      >
                        Add Selected ({{ selectedEmpIds.length }})
                      </VBtn>
                    </div>

                    <VTextField
                      v-model="empSearch"
                      placeholder="Search employees..."
                      variant="outlined"
                      density="compact"
                      prepend-inner-icon="mdi-magnify"
                      clearable
                      hide-details
                      class="mb-3"
                    />

                    <VSkeletonLoader v-if="selectableLoading" type="list-item-three-line" />

                    <div v-else-if="availableEmps.length === 0" class="text-center py-4">
                      <VIcon icon="mdi-account-check-outline" size="36" class="text-success mb-2" />
                      <p class="text-body-2 text-medium-emphasis mb-0">All employees in this section have been added.</p>
                    </div>

                    <div v-else style="max-height:260px; overflow-y:auto; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 8px;">
                      <VList density="compact" lines="two">
                        <VListItem
                        v-for="emp in availableEmps"
                        :key="emp.emp_id"
                        :style="{ opacity: (!emp.has_wage || emp.already_paid) ? 0.55 : 1, cursor: (!emp.has_wage || emp.already_paid) ? 'default' : 'pointer' }"
                        :active="selectedEmpIds.includes(emp.emp_id)"
                        active-color="primary"
                        rounded="0"
                        @click="() => {
                          if (!emp.has_wage || emp.already_paid) return
                          const idx = selectedEmpIds.indexOf(emp.emp_id)
                          if (idx === -1) selectedEmpIds.push(emp.emp_id)
                          else selectedEmpIds.splice(idx, 1)
                        }"
                      >
                        <template #prepend>
                        <VCheckboxBtn
                          :model-value="selectedEmpIds.includes(emp.emp_id)"
                          :disabled="!emp.has_wage || emp.already_paid"
                          density="compact"
                          color="primary"
                          hide-details
                          @click.stop
                          @update:model-value="() => {
                            if (!emp.has_wage || emp.already_paid) return
                            const idx = selectedEmpIds.indexOf(emp.emp_id)
                            if (idx === -1) selectedEmpIds.push(emp.emp_id)
                            else selectedEmpIds.splice(idx, 1)
                          }"
                          
                        />
                        </template>
                        <VListItemTitle class="text-body-2 font-weight-medium">{{ emp.name }}</VListItemTitle>
                        <VListItemSubtitle class="text-caption">{{ emp.position }}</VListItemSubtitle>
                        <template #append>
                          <VChip v-if="emp.already_paid" size="x-small" color="error" variant="tonal" label>
                            <VIcon start size="10">mdi-cash-check</VIcon>
                            Already Finalized — {{ emp.paid_payroll_no ?? 'another run' }}
                          </VChip>
                          <VChip v-else-if="emp.has_wage" size="x-small" color="success" variant="tonal" label>
                            {{ fmt(emp.wage) }}
                          </VChip>
                          <VBtn
                              v-else
                              icon
                              size="large"
                              variant="tonal"
                              color="amber-darken-4"
                              density="comfortable"
                              @click.stop="openWageDialog(emp)"
                            >
                              <VIcon size="18">mdi-cash-plus</VIcon>
                              <VTooltip activator="parent" location="top">No deductions set yet — click to set</VTooltip>
                            </VBtn>
                        </template>
                      </VListItem>
                      </VList>
                    </div>
                  </VCardText>
                </VCard>

                <!-- Batch Items Table -->
                <div v-if="run.groups.length === 0" class="text-center py-8">
                  <VIcon icon="mdi-account-off-outline" size="48" class="text-medium-emphasis mb-3" />
                  <p class="text-body-1 text-medium-emphasis mb-1">No employees added yet.</p>
                  <p class="text-body-2 text-medium-emphasis">Select employees above and click Add Selected.</p>
                </div>

                <div v-for="divGroup in run.groups" :key="divGroup.division_name" class="mb-4">
                  <div class="d-flex align-center gap-2 mb-3">
                    <VIcon icon="mdi-domain" size="16" color="primary" />
                    <span class="text-body-1 font-weight-bold">{{ divGroup.division_name }}</span>
                    <VDivider class="flex-grow-1" />
                  </div>

                  <div v-for="secGroup in divGroup.sections" :key="secGroup.section_name ?? 'none'" class="mb-3">
                    <div v-if="secGroup.section_name" class="d-flex align-center gap-2 mb-2 ml-2">
                      <VIcon icon="mdi-subdirectory-arrow-right" size="14" class="text-medium-emphasis" />
                      <span class="text-body-2 text-medium-emphasis font-weight-medium">{{ secGroup.section_name }}</span>
                    </div>

                    <VCard variant="outlined" rounded="lg">
                      <VTable density="compact" class="text-body-2">
                        <thead>
                          <tr style="background:rgb(var(--v-theme-surface-variant))">
                            <th class="text-left" style="min-width:180px">#  Name</th>
                            <th class="text-left">ENGAS No.</th>
                            <th class="text-right">Wage</th>
                            <th class="text-right">Premium</th>
                            <th class="text-right">Gross</th>
                            <th class="text-right">Absent Deduct</th>
                            <th class="text-right">Late/UT Deduct</th>
                            <th class="text-right">PhilHealth</th>
                            <th class="text-right">Pag-IBIG</th>
                            <th class="text-right">SSS</th>
                            <th class="text-right">Total Deductions</th>
                            <th class="text-right text-success">Net Pay</th>
                            <th class="text-left">Remarks</th>
                            <th class="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="(emp, idx) in secGroup.employees"
                            :key="emp.emp_id"
                            :style="idx % 2 === 0 ? '' : 'background:rgba(var(--v-theme-surface-variant),0.4)'"
                          >
                            <td>
                              <div class="d-flex align-center gap-2">
                                <span class="text-medium-emphasis text-caption">{{ idx+1 }}</span>
                                <div>
                                  <div class="font-weight-medium text-caption">{{ emp.emp_name }}</div>
                                  <div class="text-caption text-medium-emphasis">{{ emp.position }}</div>
                                  <div class="d-flex gap-1 mt-1">
                                    <VChip v-if="emp.nip" color="orange" size="x-small" variant="tonal" label>NIP</VChip>
                                    <VChip v-if="emp.is_overridden" color="amber" size="x-small" variant="tonal" label>
                                      <VIcon start size="10">mdi-pencil</VIcon>Overridden
                                    </VChip>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <!-- ENGAS No. inline edit -->
                            <td style="min-width:110px">
                              <template v-if="engasEditingItemId === emp.id">
                                <div class="d-flex align-center gap-1">
                                  <VTextField
                                    v-model="engasEditValue"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    style="min-width:80px"
                                    @keyup.enter="saveEngasNo(emp)"
                                    @keyup.esc="engasEditingItemId = null"
                                    autofocus
                                  />
                                  <VBtn icon size="x-small" color="success" variant="text" :loading="engasSaving" @click="saveEngasNo(emp)">
                                    <VIcon size="14">mdi-check</VIcon>
                                  </VBtn>
                                  <VBtn icon size="x-small" variant="text" @click="engasEditingItemId = null">
                                    <VIcon size="14">mdi-close</VIcon>
                                  </VBtn>
                                </div>
                              </template>
                              <template v-else>
                                <div class="d-flex align-center gap-1">
                                  <span v-if="emp.engas_no" class="text-caption font-monospace">{{ emp.engas_no }}</span>
                                  <VChip v-else size="x-small" color="warning" variant="tonal" label>Not matched</VChip>
                                  <VBtn v-if="isDraft" icon size="x-small" variant="text" color="primary"
                                    @click="openEngasEdit(emp)">
                                    <VIcon size="12">mdi-pencil-outline</VIcon>
                                    <VTooltip activator="parent" location="top">Edit ENGAS No.</VTooltip>
                                  </VBtn>
                                </div>
                              </template>
                            </td>
                            <td class="text-right text-caption">{{ fmt(emp.wage) }}</td>
                            <td class="text-right text-caption">{{ fmt(emp.premium) }}</td>
                            <td class="text-right text-caption font-weight-medium">{{ fmt(emp.gross) }}</td>
                            <td class="text-right text-caption text-error">{{ fmt(emp.absent_deduction) }}</td>
                            <td class="text-right text-caption text-error">{{ fmt(emp.late_ut_deduction) }}</td>
                            <td class="text-right text-caption text-error">{{ fmt(emp.philhealth) }}</td>
                            <td class="text-right text-caption text-error">{{ fmt(emp.pag_ibig) }}</td>
                            <td class="text-right text-caption text-error">{{ emp.sss > 0 ? fmt(emp.sss) : '—' }}</td>
                            <td class="text-right text-caption font-weight-bold text-error">{{ fmt(emp.total_deductions) }}</td>
                            <td class="text-right text-caption font-weight-bold text-success">{{ fmt(emp.net_pay) }}</td>
                            <td class="text-caption text-medium-emphasis" style="max-width:120px;white-space:pre-wrap">
                              {{ emp.remarks || '—' }}
                            </td>
                            <td class="text-center">
                              <div class="d-flex align-center justify-center gap-1">
                                <VBtn v-if="isDraft" icon size="x-small" variant="text" color="indigo"
                                  @click="openAdjustmentDialog(emp)">
                                  <VIcon size="15">mdi-calendar-edit-outline</VIcon>
                                  <VTooltip activator="parent" location="top">Attendance Adjustments</VTooltip>
                                </VBtn>
                                <VBtn v-if="isDraft" icon size="x-small" variant="text" color="primary"
                                  @click="openEditDialog(emp)">
                                  <VIcon size="15">mdi-pencil-outline</VIcon>
                                  <VTooltip activator="parent" location="top">Override</VTooltip>
                                </VBtn>
                                <VBtn v-if="isDraft && emp.is_overridden" icon size="x-small" variant="text" color="warning"
                                  @click="openRecomputeDialog(emp)">
                                  <VIcon size="15">mdi-refresh</VIcon>
                                  <VTooltip activator="parent" location="top">Recompute from DTR</VTooltip>
                                </VBtn>
                                <VBtn v-if="isDraft" icon size="x-small" variant="text" color="error"
                                  @click="openRemoveDialog(emp)">
                                  <VIcon size="15">mdi-delete-outline</VIcon>
                                  <VTooltip activator="parent" location="top">Remove</VTooltip>
                                </VBtn>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr style="background:rgba(var(--v-theme-primary),0.06)">
                            <td class="text-right text-caption font-weight-bold pr-2">Section Total</td>
                            <td colspan="2"></td>
                            <td class="text-right text-caption font-weight-bold">{{ fmt(secGroup.subtotal.gross) }}</td>
                            <td colspan="6" class="text-right text-caption font-weight-bold text-error">
                              Deductions: {{ fmt(secGroup.subtotal.total_deductions) }}
                            </td>
                            <td class="text-right text-caption font-weight-bold text-success">{{ fmt(secGroup.subtotal.net_pay) }}</td>
                            <td colspan="2"></td>
                          </tr>
                        </tfoot>
                      </VTable>
                    </VCard>
                  </div>

                  <!-- Division subtotal -->
                  <VCard variant="tonal" color="primary" rounded="lg" flat class="mt-1 ml-2">
                    <VCardText class="py-2 px-4">
                      <div class="d-flex align-center gap-4 flex-wrap">
                        <span class="text-caption font-weight-bold text-uppercase">{{ divGroup.division_name }} Total</span>
                        <div class="d-flex gap-4 ml-auto flex-wrap">
                          <div class="text-caption">Gross: <strong>{{ fmt(divGroup.subtotal.gross) }}</strong></div>
                          <div class="text-caption text-error">Deductions: <strong>{{ fmt(divGroup.subtotal.total_deductions) }}</strong></div>
                          <div class="text-caption text-success">Net: <strong>{{ fmt(divGroup.subtotal.net_pay) }}</strong></div>
                        </div>
                      </div>
                    </VCardText>
                  </VCard>
                </div>

              </VTabsWindowItem>

              <!-- ── METADATA TAB ── -->
              <VTabsWindowItem value="meta">
                <VCard variant="outlined" rounded="lg">
                  <VCardText>
                    <div class="d-flex align-center justify-space-between mb-4">
                      <p class="text-body-2 font-weight-medium mb-0">Payroll Metadata</p>
                      <VBtn v-if="!metaEditing" size="x-small" variant="tonal" color="primary"
                        prepend-icon="mdi-pencil-outline" @click="metaEditing = true">
                        Edit
                      </VBtn>
                    </div>

                    <template v-if="!metaEditing">
                      <VRow dense>
                        <VCol v-for="field in [
                          { label:'Payroll No.',  value: run.payroll_no,    icon:'mdi-pound'                  },
                          { label:'Period',       value: periodLabel,        icon:'mdi-calendar-month-outline' },
                          { label:'Division',     value: run.division_name,  icon:'mdi-domain'                 },
                          { label:'Section',      value: run.section_name,   icon:'mdi-subdirectory-arrow-right'},
                          { label:'Fund Cluster', value: run.fund_cluster,   icon:'mdi-bank-outline'           },
                          { label:'SAA No.',      value: run.saa_no,         icon:'mdi-pound'                  },
                          { label:'ORS/BURS No.', value: run.ors_no,         icon:'mdi-pound'                  },
                          { label:'DV No.',       value: run.dv_no,          icon:'mdi-pound'                  },
                          { label:'JEV No.',      value: run.jev_no,         icon:'mdi-pound'                  },
                          { label:'UACS Code',    value: run.uacs_code,      icon:'mdi-code-tags'              },
                        ]" :key="field.label" cols="12" sm="6">
                          <div class="d-flex align-start gap-2 mb-3">
                            <VIcon :icon="field.icon" size="15" class="text-medium-emphasis mt-1" />
                            <div>
                              <div class="text-caption text-medium-emphasis">{{ field.label }}</div>
                              <div class="text-body-2 font-weight-medium">{{ field.value || '—' }}</div>
                            </div>
                          </div>
                        </VCol>
                      </VRow>
                    </template>

                    <template v-else>
                      <VRow dense>
                        <VCol cols="12" sm="6">
                          <VTextField v-model="metaForm.fund_cluster" label="Fund Cluster" variant="outlined" density="compact" prepend-inner-icon="mdi-bank-outline" />
                        </VCol>
                        <VCol cols="12" sm="6">
                          <VTextField v-model="metaForm.saa_no" label="SAA No." variant="outlined" density="compact" prepend-inner-icon="mdi-pound" />
                        </VCol>
                        <VCol cols="12" sm="6">
                          <VTextField v-model="metaForm.ors_no" label="ORS/BURS No." variant="outlined" density="compact" prepend-inner-icon="mdi-pound" />
                        </VCol>
                        <VCol cols="12" sm="6">
                          <VTextField v-model="metaForm.dv_no" label="DV No." variant="outlined" density="compact" prepend-inner-icon="mdi-pound" />
                        </VCol>
                        <VCol cols="12" sm="6">
                          <VTextField v-model="metaForm.jev_no" label="JEV No." variant="outlined" density="compact" prepend-inner-icon="mdi-pound" />
                        </VCol>
                        <VCol cols="12" sm="6">
                          <VTextField v-model="metaForm.uacs_code" label="UACS Object Code" variant="outlined" density="compact" prepend-inner-icon="mdi-code-tags" hint="e.g. 224003020200000" persistent-hint />
                        </VCol>
                        <VCol cols="12" class="d-flex gap-2 mt-1">
                          <VBtn color="primary" variant="tonal" size="small" :loading="metaSaving" @click="saveMeta">Save</VBtn>
                          <VBtn variant="text" size="small" :disabled="metaSaving" @click="metaEditing = false; syncMetaForm()">Cancel</VBtn>
                        </VCol>
                      </VRow>
                    </template>
                  </VCardText>
                </VCard>
              </VTabsWindowItem>
            </VTabsWindow>
          </VCol>
        </VRow>
      </template>
    </VContainer>

    <!-- ── Edit/Override Dialog ── -->
    <VDialog v-model="editDialog" max-width="500" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar color="primary" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-pencil-outline" size="22" />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">Override Computation</div>
              <div class="text-caption text-medium-emphasis">{{ editingItem?.emp_name }}</div>
            </div>
          </div>

          <VAlert type="warning" variant="tonal" density="compact" icon="mdi-alert-outline" class="mb-4 text-body-2">
            Overriding will mark this row as manually adjusted. Use <strong>Recompute</strong> to reset back to DTR-based values.
          </VAlert>

          <VRow dense>
            <VCol cols="12">
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">
                Gross: {{ fmt(editingItem?.gross ?? 0) }} &nbsp;·&nbsp;
                Daily Rate: {{ fmt(editingItem?.daily_rate ?? 0) }} &nbsp;·&nbsp;
                Work Mins/Day: {{ editingItem?.work_minutes_per_day ?? 0 }}
              </p>
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="editForm.days_absent" label="Days Absent" type="number"
                variant="outlined" density="compact" prepend-inner-icon="mdi-calendar-remove-outline"
                hint="From DTR" persistent-hint min="0" step="0.5" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="editForm.minutes_late_ut" label="Minutes Late/UT" type="number"
                variant="outlined" density="compact" prepend-inner-icon="mdi-clock-alert-outline"
                hint="Combined late + undertime" persistent-hint min="0" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField :model-value="fmt(editComputedAbsent)" label="Absent Deduction (computed)"
                variant="outlined" density="compact" prepend-inner-icon="mdi-calculator-variant-outline"
                hint="Days × Daily Rate" persistent-hint readonly />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField :model-value="fmt(editComputedLateUt)" label="Late/UT Deduction (computed)"
                variant="outlined" density="compact" prepend-inner-icon="mdi-calculator-variant-outline"
                hint="Mins × (Daily Rate ÷ 8hrs ÷ 60mins)" persistent-hint readonly />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="editForm.philhealth" label="PhilHealth" type="number" prefix="₱"
                variant="outlined" density="compact" min="0"
                :hint="editingItem && run
                  ? ([1,4,7,10].includes(run.period_month)
                      ? 'Quarter month — min ₱1,500 (stored × 3)'
                      : 'Non-quarter month — normally ₱0 for SG 15 and below')
                  : ''"
                persistent-hint />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="editForm.pag_ibig" label="Pag-IBIG" type="number" prefix="₱" variant="outlined" density="compact" min="0" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="editForm.sss" label="SSS" type="number" prefix="₱" variant="outlined" density="compact" min="0" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="editForm.ewt" label="EWT" type="number" prefix="₱" variant="outlined" density="compact" min="0" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="editForm.remarks" label="Remarks" variant="outlined" density="compact" prepend-inner-icon="mdi-note-outline" />
            </VCol>
            <VCol cols="12">
              <VCard variant="tonal" color="success" rounded="lg" flat>
                <VCardText class="py-2 px-4">
                  <div class="d-flex justify-space-between">
                    <span class="text-body-2 text-medium-emphasis">Estimated Net Pay</span>
                    <span class="text-body-1 font-weight-bold text-success">{{ fmt(editPreviewNet) }}</span>
                  </div>
                </VCardText>
              </VCard>
            </VCol>
          </VRow>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="editSaving" @click="editDialog = false">Cancel</VBtn>
          <VBtn color="primary" variant="tonal" :loading="editSaving" @click="saveEditForm">
            <VIcon start size="16">mdi-content-save-outline</VIcon>Save Override
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Remove Dialog ── -->
    <VDialog v-model="removeDialog" max-width="420" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar color="error" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-delete-outline" size="22" />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">Remove from Batch?</div>
              <div class="text-caption text-medium-emphasis">{{ removeTarget?.emp_name }}</div>
            </div>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-0">
            This will remove <strong class="text-high-emphasis">{{ removeTarget?.emp_name }}</strong> from this payroll batch. You can re-add them later.
          </p>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="removeLoading" @click="removeDialog = false">Cancel</VBtn>
          <VBtn color="error" variant="tonal" :loading="removeLoading" @click="confirmRemove">
            <VIcon start size="16">mdi-delete-outline</VIcon>Yes, Remove
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Recompute Dialog ── -->
    <VDialog v-model="recomputeDialog" max-width="420" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar color="warning" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-refresh" size="22" />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">Recompute from DTR?</div>
              <div class="text-caption text-medium-emphasis">{{ recomputeTarget?.emp_name }}</div>
            </div>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-0">
            This will reset all manually overridden values for <strong class="text-high-emphasis">{{ recomputeTarget?.emp_name }}</strong> back to the latest DTR and wage data.
          </p>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="recomputeLoading" @click="recomputeDialog = false">Cancel</VBtn>
          <VBtn color="warning" variant="tonal" :loading="recomputeLoading" @click="confirmRecompute">
            <VIcon start size="16">mdi-refresh</VIcon>Yes, Recompute
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Set Deduction Dialog (quick-set from Add Employees panel) ── -->
      <VDialog v-model="wageDialog" max-width="560" persistent>
        <VCard rounded="lg">
          <VCardText class="pa-6">
            <div class="d-flex align-center gap-3 mb-4">
              <VAvatar color="primary" variant="tonal" size="44" rounded="lg">
                <VIcon icon="mdi-cash-plus" size="22" />
              </VAvatar>
              <div>
                <div class="text-body-1 font-weight-medium">Set Deduction</div>
                <div class="text-caption text-medium-emphasis">{{ wageTargetEmp?.name }}</div>
              </div>
            </div>

            <VAlert v-if="wageTargetEmp?.has_hrmis_wage" type="info" variant="tonal" density="compact" icon="mdi-database-sync-outline" class="mb-4">
              <span class="text-body-2">
                Wage pre-filled from HRMIS
                (<strong>{{ fmt(wageTargetEmp.hrmis_wage!) }}</strong>).
                Saving will also update the HRMIS record.
              </span>
            </VAlert>

            <VRow dense>
              <VCol cols="12" sm="7">
                <VTextField
                  v-model.number="wageForm.wage" label="Monthly Wage" type="number" prefix="₱"
                  variant="outlined" density="compact" prepend-inner-icon="mdi-cash-outline"
                  :error-messages="wageFormErrors.wage" min="0.01"
                />
              </VCol>
              <VCol cols="12" sm="5">
                <VSelect
                  v-model="wageForm.premium_percent" label="Premium Rate" :items="WAGE_PREMIUM_OPTIONS"
                  item-title="title" item-value="value" variant="outlined" density="compact"
                  prepend-inner-icon="mdi-percent-outline"
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VTextField
                  v-model.number="wageForm.philhealth" label="PhilHealth" type="number" prefix="₱"
                  variant="outlined" density="compact" prepend-inner-icon="mdi-hospital-box-outline"
                  :error-messages="wageFormErrors.philhealth"
                  :hint="(wageTargetEmp?.salary_grade ?? 0) >= WAGE_SG_CUTOFF ? '5% of wage — monthly' : 'Min ₱500, deducted ×3 on Jan/Apr/Jul/Oct'"
                  persistent-hint
                  :readonly="(wageTargetEmp?.salary_grade ?? 0) >= WAGE_SG_CUTOFF"
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VTextField
                  v-model.number="wageForm.pag_ibig" label="Pag-IBIG" type="number" prefix="₱"
                  variant="outlined" density="compact" prepend-inner-icon="mdi-home-outline"
                  :error-messages="wageFormErrors.pag_ibig" hint="Min ₱400/month" persistent-hint
                />
              </VCol>
              <VCol cols="12" sm="6">
                <div class="d-flex align-center justify-space-between mb-1">
                  <span class="text-body-2">SSS</span>
                  <VSwitch
                    v-model="wageSssOptIn" color="primary" density="compact" hide-details inset
                    @update:model-value="val => { if (!val) wageForm.sss = 0; else if (wageForm.sss === 0) wageForm.sss = WAGE_SSS_MIN }"
                  />
                </div>
                <VTextField
                  v-if="wageSssOptIn" v-model.number="wageForm.sss" label="SSS Amount" type="number" prefix="₱"
                  variant="outlined" density="compact" :error-messages="wageFormErrors.sss"
                  hint="Min ₱750/month" persistent-hint
                />
                <p v-else class="text-caption text-medium-emphasis mb-0">Opted out — recorded as ₱0.</p>
              </VCol>
              <VCol cols="12" sm="6">
                <VTextField
                  v-model.number="wageForm.ewt_rate" label="EWT Rate" type="number" suffix="%"
                  variant="outlined" density="compact" prepend-inner-icon="mdi-percent-outline"
                  hint="Default 5%. Applies after ₱250,000 annual gross." persistent-hint min="0" max="100"
                />
              </VCol>
            </VRow>
          </VCardText>
          <VDivider />
          <VCardActions class="justify-end pa-4 gap-2">
            <VBtn variant="text" :disabled="wageSaving" @click="wageDialog = false">Cancel</VBtn>
            <VBtn color="primary" variant="tonal" :loading="wageSaving" @click="saveWage">
              <VIcon start size="16">mdi-content-save-outline</VIcon>Save Deduction
            </VBtn>
          </VCardActions>
        </VCard>
      </VDialog>

    <!-- ── Document Generation Dialog ── -->
    <!-- FIX #1 & #2: Moved to root level, old VSelect-based dialog removed -->
    <VDialog v-model="docDialog" max-width="500" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar
              :color="docType === 'payroll_sheet' ? 'primary' : docType === 'ors' ? 'indigo' : 'deep-purple'"
              variant="tonal" size="44" rounded="lg"
            >
              <VIcon
                :icon="docType === 'payroll_sheet' ? 'mdi-file-table-outline' : docType === 'ors' ? 'mdi-file-document-outline' : 'mdi-receipt-text-outline'"
                size="22"
              />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">Generate {{ docTypeLabel }}</div>
              <div class="text-caption text-medium-emphasis">Select signatories before generating</div>
            </div>
          </div>

          <VSkeletonLoader v-if="sigsLoading" type="list-item-two-line, list-item-two-line" />

          <template v-else>

            <!-- Approved By — hidden for ORS (ORS only uses 2 certified signatories) -->
            <template v-if="docType !== 'ors'">
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-1">Approved By</p>
              <VCard variant="tonal" color="primary" rounded="lg" flat class="mb-4">
                <VCardText class="py-2 px-4">
                  <div class="d-flex align-center gap-2">
                    <VIcon icon="mdi-account-check-outline" size="16" />
                     <div>
                      <div class="text-body-2 font-weight-medium">{{ approvedByName }}</div>
                      <div class="text-caption">{{ approvedByPosition }}</div>
                    </div>
                  </div>
                </VCardText>
              </VCard>
            </template>

            <!-- Certified By slots -->
            <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-2">
              Certified By
              <span class="text-lowercase font-weight-regular">
                ({{ certifiedSlotCount }} {{ certifiedSlotCount > 1 ? 'signatories' : 'signatory' }} required)
              </span>
            </p>

            <div class="d-flex flex-column gap-2">

              <!-- Slot 1 — locked (division-matched) or free dropdown -->
              <div class="d-flex align-center gap-2">
                <VChip size="x-small" label color="primary" variant="tonal" class="flex-shrink-0">1</VChip>
                <template v-if="slot1Locked">
                  <VCard variant="outlined" rounded="lg" class="flex-grow-1">
                    <VCardText class="py-2 px-3">
                      <div class="d-flex align-center gap-2">
                        <VIcon icon="mdi-check-decagram-outline" size="15" color="success" />
                        <div>
                          <div class="text-body-2 font-weight-medium">{{ certifiedBySlots[0]?.name }}</div>
                          <div class="text-caption text-medium-emphasis">{{ certifiedBySlots[0]?.position }}</div>
                        </div>
                        <VSpacer />
                        <VChip size="x-small" color="success" variant="tonal" label>Division Head</VChip>
                      </div>
                    </VCardText>
                  </VCard>
                </template>
                <template v-else>
                  <VSelect
                    v-model="selectedCertifiedBy[0]"
                    :items="slot1Options"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                    prepend-inner-icon="mdi-account-multiple-check-outline"
                    placeholder="Select signatory..."
                    hide-details
                    clearable
                    class="flex-grow-1"
                  />
                </template>
              </div>

              <!-- Static slots (slot 2 and optionally slot 3) -->
              <div
                v-for="(slot, i) in certifiedBySlots.slice(1)"
                :key="i + 2"
                class="d-flex align-center gap-2"
              >
                <VChip size="x-small" label color="primary" variant="tonal" class="flex-shrink-0">{{ i + 2 }}</VChip>
                <VCard variant="outlined" rounded="lg" class="flex-grow-1">
                  <VCardText class="py-2 px-3">
                    <div v-if="slot" class="d-flex align-center gap-2">
                      <VIcon icon="mdi-check-decagram-outline" size="15" color="teal" />
                      <div>
                        <div class="text-body-2 font-weight-medium">{{ slot.name }}</div>
                        <div class="text-caption text-medium-emphasis">{{ slot.position }}</div>
                      </div>
                      <VSpacer />
                      <VChip size="x-small" color="teal" variant="tonal" label>Fixed</VChip>
                    </div>
                    <div v-else class="text-caption text-medium-emphasis">
                      Signatory not found — check active signatories
                    </div>
                  </VCardText>
                </VCard>
              </div>

            </div>
          </template>
        </VCardText>

        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="docGenerateLoading" @click="docDialog = false">Cancel</VBtn>
          <VBtn
            :color="docType === 'payroll_sheet' ? 'primary' : docType === 'ors' ? 'indigo' : 'deep-purple'"
            variant="tonal" prepend-icon="mdi-file-pdf-box" :loading="docGenerateLoading"
            @click="generateDocument"
          >
            Generate PDF
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Alert ── -->
    <BaseAlert v-model="alertVisible" :message="alertMessage" :type="alertType" :timeout="3500" />
   <PayrollItemAdjustmentsDialog
  v-model="adjustmentDialog"
  :run-id="run?.id ?? 0"
  :item="adjustmentTarget"
  :period-month="run?.period_month ?? 1"
  :period-year="run?.period_year ?? new Date().getFullYear()"
  @updated="onAdjustmentUpdated"
/>
<!-- ── DTR Not Saved Dialog ── -->
<VDialog v-model="dtrNotSavedDialog" max-width="460" persistent>
  <VCard rounded="lg">
    <VCardText class="pa-6">
      <div class="d-flex align-center gap-3 mb-4">
        <VAvatar color="warning" variant="tonal" size="44" rounded="lg">
          <VIcon icon="mdi-calendar-alert-outline" size="22" />
        </VAvatar>
        <div>
          <div class="text-body-1 font-weight-medium">DTR Not Yet Saved</div>
          <div class="text-caption text-medium-emphasis">{{ periodLabel }}</div>
        </div>
      </div>
      <VAlert type="warning" variant="tonal" density="compact" icon="mdi-alert-outline" class="mb-4 text-body-2">
        {{ dtrNotSavedMessage }}
      </VAlert>
      <p class="text-body-2 text-medium-emphasis mb-0">
        Go to the <strong class="text-high-emphasis">DTR module</strong> and click
        <strong class="text-high-emphasis">Save DTR</strong> for
        <strong class="text-high-emphasis">{{ periodLabel }}</strong> first,
        then come back to add employees.
      </p>
    </VCardText>
    <VDivider />
    <VCardActions class="justify-end pa-4 gap-2">
      <VBtn variant="text" @click="dtrNotSavedDialog = false">Cancel</VBtn>
      <VBtn
        color="warning"
        variant="tonal"
        prepend-icon="mdi-clock-outline"
        @click="dtrNotSavedDialog = false; router.push({ name: 'dtr' })"
      >
        Go to DTR Module
      </VBtn>
    </VCardActions>
  </VCard>
</VDialog>
  </div>
</template>
