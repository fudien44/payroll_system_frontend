<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import axios from '@axios'
import { useRouter } from 'vue-router'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Division {
  id:          number
  office:      string
  description: string
}

interface Section {
  id:        number
  office:    number   // FK to division id
  shortcode: string
  station:   string
}

interface PayrollRun {
  id:            number
  payroll_no:    string
  period_month:  number
  period_year:   number
  division_id:   number
  division_name: string
  section_name:  string | null   // NEW: backend already returns this, type was just missing it
  fund_cluster:  string
  saa_no:        string | null
  ors_no:        string | null
  dv_no:         string | null
  jev_no:        string | null
  status:        'draft' | 'finalized'
  employee_count: number
  total_net_pay:  number
  created_at:    string
  updated_at:    string
}

type AlertType = 'success' | 'error' | 'warning' | 'info'
interface Signatory {
  id:       number
  name:     string
  position: string
  role:     'approved_by' | 'certified_by'
}

interface FullBatchItem {
  emp_name: string; position: string | null; engas_no: string | null; nip: boolean
  wage: number; premium: number; gross: number
  absent_deduction: number; late_ut_deduction: number
  philhealth: number; pag_ibig: number; sss: number; ewt: number
  total_deductions: number; net_pay: number; remarks: string | null
}
interface FullSectionGroup { section_name: string | null; employees: FullBatchItem[] }
interface FullDivisionGroup { division_name: string; sections: FullSectionGroup[] }
interface FullPayrollRunDetail extends PayrollRun {
  groups: FullDivisionGroup[]
}

type DocType = 'payroll_sheet' | 'ors' | 'dv'

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

const TABLE_HEADERS = [
  { title: 'Payroll No.',   key: 'payroll_no',    sortable: true                         },
  { title: 'Period',        key: 'period',         sortable: true                         },
  { title: 'Section / Division', key: 'division_name',  sortable: true                         },
  { title: 'Fund Cluster',  key: 'fund_cluster',   sortable: false                        },
  { title: 'Employees',     key: 'employee_count', sortable: true,  align: 'center' as const },
  { title: 'Total Net Pay', key: 'netPayDisp',     sortable: false, align: 'end'    as const },
  { title: 'Status',        key: 'status',         sortable: true                         },
  { title: 'Actions',       key: 'actions',        sortable: false, align: 'center' as const },
]

const BLANK_FORM = () => ({
  period_month: new Date().getMonth() + 1,
  period_year:  new Date().getFullYear(),
  division_id:  null as number | null,
  section_id:   null as number | null,
  fund_cluster: '',
  saa_no:       '',
  ors_no:       '',
  dv_no:        '',
  jev_no:       '',
})

const CURRENT_YEAR  = new Date().getFullYear()
const YEAR_OPTIONS  = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i)
const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({ title: name, value: i + 1 }))

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const router       = useRouter()
const runs         = ref<PayrollRun[]>([])
const divisions    = ref<Division[]>([])
const sections     = ref<Section[]>([])
const sectionsLoading = ref(false)
const loading      = ref(false)
const modalOpen    = ref(false)
const modalLoading = ref(false)
const form         = ref(BLANK_FORM())
const formErrors   = ref<Record<string, string>>({})
const filterStatus = ref<'All' | 'draft' | 'finalized'>('All')

const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

const confirmDeleteDialog = ref(false)
const deleteTarget        = ref<PayrollRun | null>(null)
const deleteLoading       = ref(false)

/* ── Document Generation ── */
const docDialog    = ref(false)
const docType      = ref<DocType>('payroll_sheet')
const docTarget    = ref<Record<string, any> | null>(null)
const docLoading   = ref(false)
const orsLoading   = ref(false)
const dvLoading    = ref(false)
const sigsLoading  = ref(false)

const approvedBySig       = ref<Signatory | null>(null)
const certifiedBySlots    = ref<(Signatory | null)[]>([])
const selectablePool      = ref<Signatory[]>([])
const slot1Locked         = ref(false)
const selectedCertifiedBy = ref<(number | null)[]>([])

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */
const filteredItems = computed(() =>
  runs.value
    .filter(r => filterStatus.value === 'All' || r.status === filterStatus.value)
    .map(r => ({
      ...r,
      period:     `${MONTH_NAMES[r.period_month - 1]} ${r.period_year}`,
      netPayDisp: fmt(r.total_net_pay),
    }))
)

const totalDraft     = computed(() => runs.value.filter(r => r.status === 'draft').length)
const totalFinalized = computed(() => runs.value.filter(r => r.status === 'finalized').length)

const divisionOptions = computed(() =>
  divisions.value.map(d => ({ title: d.description, value: d.id }))
)

const sectionOptions = computed(() =>
  sections.value.map(s => ({ title: s.station, value: s.id }))
)

// When division changes, reset section and reload sections list
watch(() => form.value.division_id, async (divId) => {
  form.value.section_id = null
  sections.value        = []
  if (!divId) return
  sectionsLoading.value = true
  try {
    const { data } = await axios.get(`/api/divisions/${divId}/sections`)
    sections.value = data.data ?? []
  } catch {
    showAlert('error', 'Failed to load sections.')
  } finally {
    sectionsLoading.value = false
  }
})

const docTypeLabel = computed(() => {
  if (docType.value === 'payroll_sheet') return 'Payroll Sheet'
  if (docType.value === 'ors')           return 'Obligation Request & Status (ORS)'
  return 'Disbursement Voucher (DV)'
})

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

const slot1Options = computed(() =>
  selectablePool.value.map(s => ({ title: `${s.name} — ${s.position}`, value: s.id }))
)

const certifiedSlotCount = computed(() => docType.value === 'payroll_sheet' ? 3 : 2)

const docGenerateLoading = computed(() => {
  if (docType.value === 'ors') return orsLoading.value
  if (docType.value === 'dv')  return dvLoading.value
  return docLoading.value
})

const docPeriodLabel = computed(() => {
  if (!docTarget.value) return ''
  return `${MONTH_NAMES[docTarget.value.period_month - 1]} ${docTarget.value.period_year}`
})

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const fmt = (v: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
  }).format(v ?? 0)

  const fmtNum = (v: number | string) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(v) ?? 0)

function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}

function validate(): boolean {
  const errs: Record<string, string> = {}
  if (!form.value.period_month) errs.period_month = 'Period month is required.'
  if (!form.value.period_year)  errs.period_year  = 'Period year is required.'
  if (!form.value.division_id)  errs.division_id  = 'Division is required.'
  if (!form.value.section_id)   errs.section_id   = 'Section is required.'
  if (!form.value.fund_cluster?.trim()) errs.fund_cluster = 'Fund cluster is required.'
  formErrors.value = errs
  return Object.keys(errs).length === 0
}

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */
async function fetchRuns() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/payroll-run')
    runs.value = data.data ?? []
  } catch {
    showAlert('error', 'Failed to load payroll runs.')
  } finally {
    loading.value = false
  }
}

async function fetchDivisions() {
  try {
    const { data } = await axios.get('/api/divisions')
    divisions.value = data.data ?? []
  } catch {
    showAlert('error', 'Failed to load divisions.')
  }
}
async function fetchSignatories(type: DocType, divisionId: number) {
  sigsLoading.value = true
  try {
    const { data } = await axios.get('/api/signatories', {
      params: { division_id: divisionId, doc_type: type },
    })
    const payload = data.data
    approvedBySig.value   = payload.approved_by ?? null
    certifiedBySlots.value = payload.certified_by
    selectablePool.value   = payload.selectable_pool
    slot1Locked.value      = payload.slot1_locked
    selectedCertifiedBy.value = certifiedBySlots.value.map((s: Signatory | null) => s?.id ?? null)
  } catch {
    showAlert('error', 'Failed to load signatories.')
  } finally {
    sigsLoading.value = false
  }
}

function openDocDialog(type: DocType, item: Record<string, any>) {
  docType.value   = type
  docTarget.value = item
  docDialog.value = true
  fetchSignatories(type, item.division_id)
}

async function generateORSFromBackend() {
  if (!docTarget.value) return
  orsLoading.value = true
  try {
    const response = await axios.post(
      `/api/payroll-run/${docTarget.value.id}/generate-ors`,
      {},
      { responseType: 'blob' }
    )
    const filename = `ORS-${docTarget.value.payroll_no}.pdf`
    const file = new File([response.data], filename, { type: 'application/pdf' })
    const url  = URL.createObjectURL(file)
    const tab  = window.open(url, '_blank')
    if (!tab) showAlert('warning', 'Popup blocked. Please allow popups and try again.')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    showAlert('error', 'Failed to generate ORS.')
  } finally {
    orsLoading.value = false
  }
}

async function generateDVFromBackend() {
  if (!docTarget.value) return
  dvLoading.value = true
  try {
    const response = await axios.post(
      `/api/payroll-run/${docTarget.value.id}/generate-dv`,
      {},
      { responseType: 'blob' }
    )
    const filename = `DV-${docTarget.value.payroll_no}.pdf`
    const file = new File([response.data], filename, { type: 'application/pdf' })
    const url  = URL.createObjectURL(file)
    const tab  = window.open(url, '_blank')
    if (!tab) showAlert('warning', 'Popup blocked. Please allow popups and try again.')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    showAlert('error', 'Failed to generate DV.')
  } finally {
    dvLoading.value = false
  }
}

function openPdf(doc: any) {
  const blob = doc.output('blob')
  const url  = URL.createObjectURL(blob)
  const tab  = window.open(url, '_blank')
  if (!tab) { showAlert('error', 'Popup blocked. Please allow popups.'); URL.revokeObjectURL(url); return }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function generatePayrollSheetFromList(approvedSig: Signatory | null, certSigs: (Signatory | null)[]) {
  if (!docTarget.value) return
  // Full employee breakdown isn't in the list row — fetch it
  const { data } = await axios.get(`/api/payroll-run/${docTarget.value.id}`)
  const r: FullPayrollRunDetail = data.data

  const { jsPDF } = (window as any).jspdf
  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' })
  const pageW = doc.internal.pageSize.getWidth()
  const BLK   = [0,0,0]       as [number,number,number]
  const GRAY  = [80,80,80]    as [number,number,number]
  const LGRAY = [180,180,180] as [number,number,number]
  const WHITE = [255,255,255] as [number,number,number]

  const emps = r.groups.flatMap(d => d.sections.flatMap(s => s.employees))
  const gt = emps.reduce((acc, e) => {
    acc.gross            += Number(e.gross)
    acc.philhealth        += Number(e.philhealth)
    acc.pag_ibig          += Number(e.pag_ibig)
    acc.sss                += Number(e.sss)
    acc.ewt                 += Number(e.ewt)
    acc.total_deductions   += Number(e.total_deductions)
    acc.net_pay             += Number(e.net_pay)
    return acc
  }, { gross:0, philhealth:0, pag_ibig:0, sss:0, ewt:0, total_deductions:0, net_pay:0 })

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
  emps.forEach(emp => {
    const nipLabel       = emp.nip ? ' (NIP)' : ''
    const grossAmtEarned = Number(emp.gross) - Number(emp.absent_deduction) - Number(emp.late_ut_deduction)
    tableBody.push([
      serial++, emp.engas_no || '', emp.emp_name + nipLabel, emp.position || '',
      fmtNum(emp.wage), fmtNum(emp.premium), fmtNum(emp.gross),
      fmtNum(emp.absent_deduction), fmtNum(emp.late_ut_deduction), fmtNum(grossAmtEarned),
      emp.ewt > 0 ? fmtNum(emp.ewt) : '', fmtNum(emp.philhealth), fmtNum(emp.pag_ibig),
      emp.sss > 0 ? fmtNum(emp.sss) : '', fmtNum(emp.net_pay), emp.remarks || '',
      r.saa_no ? `SAA ${r.saa_no}${emp.nip ? ' (NIP)' : ''}` : '',
    ])
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
      { content: 'Serial\nNo.',  rowSpan: 2, styles: { valign:'middle', halign:'center' } },
      { content: 'Engas\nNo.',   rowSpan: 2, styles: { valign:'middle', halign:'center' } },
      { content: 'Name',         rowSpan: 2, styles: { valign:'middle' } },
      { content: 'Position',     rowSpan: 2, styles: { valign:'middle' } },
      { content: 'Wage',         rowSpan: 2, styles: { valign:'middle', halign:'center' } },
      { content: '20%\nPremium', rowSpan: 2, styles: { valign:'middle', halign:'center' } },
      { content: 'COMPENSATION', colSpan: 4, styles: { halign:'center' } },
      { content: 'D E D U C T I O N S', colSpan: 4, styles: { halign:'center' } },
      { content: 'Net Amount\nDue', rowSpan: 2, styles: { valign:'middle', halign:'center' } },
      { content: 'REMARKS',      rowSpan: 2, styles: { valign:'middle' } },
      { content: 'CHARGING',     rowSpan: 2, styles: { valign:'middle' } },
    ],[
      'Total', 'Amount of\nDay/s not\nrendered/\nNo contract', 'Amount of\nMinute/s\nLate/UT/\nPass Slip',
      'GROSS\nAMOUNT\nEARNED', 'Expanded\nWithholding\nTax 5%', 'Philhealth', 'PAG-IBIG', 'SSS',
    ]],
    body: tableBody,
    theme: 'grid',
    tableWidth: pageW - 28,
    styles: { fontSize:6.5, cellPadding:1.5, valign:'middle', overflow:'linebreak', textColor:BLK, lineColor:LGRAY, lineWidth:0.15 },
    headStyles: { fillColor:WHITE, textColor:BLK, fontStyle:'bold', halign:'center', fontSize:6.5, lineColor:BLK, lineWidth:0.3 },
    columnStyles: {
      0:{halign:'center',cellWidth:12}, 1:{cellWidth:18}, 2:{cellWidth:'auto'}, 3:{cellWidth:24},
      4:{halign:'right',cellWidth:16}, 5:{halign:'right',cellWidth:14}, 6:{halign:'right',cellWidth:16},
      7:{halign:'right',cellWidth:17}, 8:{halign:'right',cellWidth:17}, 9:{halign:'right',cellWidth:18},
      10:{halign:'right',cellWidth:16}, 11:{halign:'right',cellWidth:15}, 12:{halign:'right',cellWidth:13},
      13:{halign:'right',cellWidth:13}, 14:{halign:'right',cellWidth:18}, 15:{cellWidth:28}, 16:{cellWidth:22},
    },
    margin: { left:14, right:14 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 2
  const TW = pageW - 28
  const cLbl = 9.2
  const cL = (TW - cLbl) * 0.40
  const cM = (TW - cLbl) * 0.40
  const cR = TW - cLbl - cL - cM

  const aSig = certSigs[0] ?? null
  const bSig = certSigs[1] ?? null
  const cSig = certSigs[2] ?? null

  const sigLine = (sig: Signatory | null) =>
    `\n\n\n\n                                     ________________________________________\n                                               ${sig?.name ?? ''}\n                                                   ${sig?.position ?? ''}`
  const sigLineWithDateA = (sig: Signatory | null) =>
    `\n\n\n\n___________________________________                               ______________\n${sig?.name ?? ''}                                                       Date\n${sig?.position ?? ''}`
  const sigLineWithDateB = (sig: Signatory | null) =>
    `\n\n\n\n_________________________________________                                                                                            _______________\n${sig?.name ?? ''}                                                                                                                          Date\n                   ${sig?.position ?? ''}                                                                                                                                       `
  const sigLineWithDateC = (sig: Signatory | null) =>
    `\n\n\n\n___________________________________                               ______________\n${sig?.name ?? ''}                                                      Date\n${sig?.position ?? ''}`

  ;(doc as any).autoTable({
    startY: finalY, tableWidth: TW,
    body: [[
      { content: 'A', styles: { fontStyle:'bold', fontSize:7, cellPadding:{top:3,left:2,right:2,bottom:3}, valign:'top', halign:'left' } },
      { content: `CERTIFIED:  Services duly rendered as stated.${sigLineWithDateA(aSig)}`,
        styles: { fontSize:7, cellPadding:{top:3,left:7,right:0,bottom:3}, valign:'top', halign:'left' } },
      { content: `APPROVED FOR PAYMENT: _______________________________________${sigLineWithDateB(approvedSig)}`,
        styles: { fontSize:7, cellPadding:{top:3,left:30,right:0,bottom:3}, valign:'top', halign:'left' }, colSpan: 2 },
    ]],
    theme: 'grid',
    styles: { textColor:BLK, lineColor:BLK, lineWidth:0.2, overflow:'linebreak' },
    columnStyles: { 0:{cellWidth:cLbl}, 1:{cellWidth:cL}, 2:{cellWidth:cM+cR} },
    margin: { left:14, right:14 },
  })

  ;(doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY, tableWidth: TW,
    body: [[
      { content: 'B', styles: { fontStyle:'bold', fontSize:7, cellPadding:{top:3,left:2,right:2,bottom:3}, valign:'top', halign:'left' } },
      { content: `CERTIFIED:  Supporting documents complete and proper; and cash available in the amount of \nP______________________.${sigLineWithDateC(bSig)}`,
        styles: { fontSize:7, cellPadding:{top:3,left:7,right:0,bottom:3}, valign:'top', halign:'left' } },
      { content: `CERTIFIED:  Supporting documents complete and proper; and cash available in the amount of \n\nP______________________.${sigLine(cSig)}`,
        styles: { fontSize:7, cellPadding:{top:3,left:7,right:0,bottom:3}, valign:'top', halign:'left' } },
      { content: `E   ORS/BURS No.${r.ors_no ? ' ' + r.ors_no : ' ___________________________'}\n\nDate : ___________________________\nJEV No. : ___________________________\nDate : ___________________________`,
        styles: { fontSize:7, cellPadding:{top:3,left:3,right:3,bottom:3}, valign:'top', halign:'left' } },
    ]],
    theme: 'grid',
    styles: { textColor:BLK, lineColor:BLK, lineWidth:0.2, overflow:'linebreak' },
    columnStyles: { 0:{cellWidth:cLbl}, 1:{cellWidth:cL}, 2:{cellWidth:cM}, 3:{cellWidth:cR} },
    margin: { left:14, right:14 },
  })

  openPdf(doc)
}

async function generateDocument() {
  if (!docTarget.value) return
  if (docType.value === 'ors') { await generateORSFromBackend(); docDialog.value = false; return }
  if (docType.value === 'dv')  { await generateDVFromBackend();  docDialog.value = false; return }

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
        document.head.appendChild(s); (window as any).jspdfAutotable = true
      })
    }

    const approvedSig = docType.value === 'payroll_sheet' ? HARDCODED_APPROVED_BY_PAYROLL : approvedBySig.value

    const resolvedCertified: (Signatory | null)[] = certifiedBySlots.value.map((slot, i) => {
      if (i === 0 && !slot1Locked.value) {
        const picked = selectedCertifiedBy.value[0]
        return selectablePool.value.find(s => s.id === picked) ?? null
      }
      return slot
    })
    const certSigs = resolvedCertified.slice(0, certifiedSlotCount.value)

    await generatePayrollSheetFromList(approvedSig, certSigs)
    showAlert('success', `${docTypeLabel.value} opened in a new tab.`)
    docDialog.value = false
  } catch (err: any) {
    showAlert('error', err.message ?? 'Document generation failed.')
  } finally {
    docLoading.value = false
  }
}
const dtrNotSavedDialog  = ref(false)
const dtrNotSavedMessage = ref('')
const dtrNotSavedPeriod  = ref('')
async function handleCreate() {
  if (!validate()) return
  modalLoading.value = true
  try {
    const { data } = await axios.post('/api/payroll-run', form.value)
    if (!data.success) throw new Error(data.message ?? 'Failed to create.')
    showAlert('success', `Payroll run created: ${data.data.payroll_no}`)
    modalOpen.value = false
    router.push({ name: 'payroll-run-detail', params: { id: data.data.id } })
  } catch (err: any) {
    const resData = err.response?.data
    if (resData?.dtr_not_saved) {
      modalOpen.value          = false
      dtrNotSavedMessage.value = resData.message
      dtrNotSavedPeriod.value  = `${MONTH_NAMES[form.value.period_month - 1]} ${form.value.period_year}`
      dtrNotSavedDialog.value  = true
      return
    }
    if (err.response?.data?.errors) {
      formErrors.value = Object.fromEntries(
        Object.entries(err.response.data.errors).map(([k, v]) => [k, (v as string[])[0]])
      )
    }
    showAlert('error', resData?.message ?? err.message ?? 'Failed to create.')
  } finally {
    modalLoading.value = false
  }
}

async function executeDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    const { data } = await axios.post(`/api/payroll-run/delete/${deleteTarget.value.id}`)
    if (!data.success) throw new Error(data.message ?? 'Failed to delete.')
    runs.value = runs.value.filter(r => r.id !== deleteTarget.value!.id)
    showAlert('success', 'Payroll run deleted.')
    confirmDeleteDialog.value = false
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to delete.')
  } finally {
    deleteLoading.value = false
  }
}

/* ─────────────────────────────────────────
   HANDLERS
───────────────────────────────────────── */
function openCreate() {
  form.value       = BLANK_FORM()
  formErrors.value = {}
  modalOpen.value  = true
}

function openDetail(item: Record<string, any>) {
  router.push({ name: 'payroll-run-detail', params: { id: item.id } })
}

function openDeleteConfirm(item: Record<string, any>) {
  const run = runs.value.find(r => r.id === item.id)
  if (!run) return
  if (run.status === 'finalized') {
    showAlert('warning', 'Finalized payroll runs cannot be deleted.')
    return
  }
  deleteTarget.value        = run
  confirmDeleteDialog.value = true
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
onMounted(() => {
  fetchRuns()
  fetchDivisions()
})
</script>

<template>
  <div>
    <VContainer fluid class="pa-6">

      <!-- ── Page Header ── -->
      <div class="d-flex align-center justify-space-between flex-wrap gap-4 mb-2">
        <div>
          <h4 class="text-h5 font-weight-bold mb-1">Payroll Runs</h4>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Create and manage monthly payroll runs per division. Generate official payroll documents from finalized runs.
          </p>
        </div>
        <VBtn color="primary" prepend-icon="mdi-plus" @click="openCreate">
          New Payroll Run
        </VBtn>
      </div>

      <!-- ── Summary Cards ── -->
      <VRow class="mb-5 mt-2" dense>
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="primary" rounded="lg" flat>
            <VCardText class="d-flex align-center gap-3 py-4">
              <VAvatar color="primary" variant="tonal" size="44" rounded="lg">
                <VIcon icon="mdi-file-document-multiple-outline" size="22" />
              </VAvatar>
              <div>
                <div class="text-h5 font-weight-bold">{{ runs.length }}</div>
                <div class="text-body-2 text-medium-emphasis">Total Runs</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="warning" rounded="lg" flat>
            <VCardText class="d-flex align-center gap-3 py-4">
              <VAvatar color="warning" variant="tonal" size="44" rounded="lg">
                <VIcon icon="mdi-pencil-outline" size="22" />
              </VAvatar>
              <div>
                <div class="text-h5 font-weight-bold">{{ totalDraft }}</div>
                <div class="text-body-2 text-medium-emphasis">Draft</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="success" rounded="lg" flat>
            <VCardText class="d-flex align-center gap-3 py-4">
              <VAvatar color="success" variant="tonal" size="44" rounded="lg">
                <VIcon icon="mdi-check-circle-outline" size="22" />
              </VAvatar>
              <div>
                <div class="text-h5 font-weight-bold">{{ totalFinalized }}</div>
                <div class="text-body-2 text-medium-emphasis">Finalized</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- ── Filter Pills ── -->
      <div class="d-flex gap-2 mb-3 flex-wrap">
        <VChip
          v-for="opt in [
            { label: 'All',       value: 'All'       },
            { label: 'Draft',     value: 'draft'     },
            { label: 'Finalized', value: 'finalized' },
          ]"
          :key="opt.value"
          :color="
            filterStatus === opt.value
              ? opt.value === 'finalized' ? 'success'
              : opt.value === 'draft'     ? 'warning'
              : 'primary'
              : undefined
          "
          :variant="filterStatus === opt.value ? 'tonal' : 'outlined'"
          size="small"
          label
          style="cursor:pointer"
          @click="filterStatus = opt.value as typeof filterStatus"
        >
          {{ opt.label }}
        </VChip>
      </div>

      <!-- ── Table ── -->
      <BaseTable
        title="Payroll Runs"
        :headers="TABLE_HEADERS"
        :items="filteredItems"
        :loading="loading"
        :items-per-page="10"
        searchable
        :filter-keys="['payroll_no', 'period', 'division_name', 'section_name', 'fund_cluster', 'status']"
        @edit="openDetail"
        @delete="openDeleteConfirm"
      >
        <!-- Payroll No -->
        <template #item.payroll_no="{ item }">
          <span class="text-body-2 font-weight-medium font-monospace">{{ item.payroll_no }}</span>
        </template>

        <!-- Period -->
        <template #item.period="{ item }">
          <div class="d-flex align-center gap-2">
            <VIcon icon="mdi-calendar-month-outline" size="15" class="text-medium-emphasis" />
            <span class="text-body-2">{{ item.period }}</span>
          </div>
        </template>

        <!-- Section / Division -->
        <template #item.division_name="{ item }">
          <div class="d-flex align-center gap-2">
            <VIcon icon="mdi-domain" size="15" class="text-medium-emphasis" />
            <div>
              <div v-if="item.section_name" class="text-body-2">{{ item.section_name }}</div>
              <div class="d-flex align-center gap-1 text-caption text-medium-emphasis" :class="{ 'text-body-2': !item.section_name }">
                <VIcon v-if="item.section_name" icon="mdi-subdirectory-arrow-right" size="11" />
                {{ item.division_name }}
              </div>
            </div>
          </div>
        </template>

        <!-- Employee count -->
        <template #item.employee_count="{ item }">
          <VChip color="primary" size="small" variant="tonal" label>
            {{ item.employee_count }}
          </VChip>
        </template>

        <!-- Status -->
        <template #item.status="{ item }">
          <VChip
            :color="item.status === 'finalized' ? 'success' : 'warning'"
            size="small"
            variant="tonal"
            label
          >
            <VIcon
              start
              :icon="item.status === 'finalized' ? 'mdi-check-circle-outline' : 'mdi-pencil-outline'"
              size="14"
            />
            {{ item.status === 'finalized' ? 'Finalized' : 'Draft' }}
          </VChip>
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-1">
            <VBtn icon size="small" variant="text" color="primary" @click.stop="openDetail(item)">
              <VIcon size="18">mdi-eye-outline</VIcon>
              <VTooltip activator="parent" location="top">View Details</VTooltip>
            </VBtn>
              <VMenu v-if="item.status === 'finalized'">
              <template #activator="{ props }">
                <VBtn icon size="small" variant="text" color="indigo" v-bind="props" @click.stop>
                  <VIcon size="18">mdi-file-pdf-box</VIcon>
                  <VTooltip activator="parent" location="top">Generate Documents</VTooltip>
                </VBtn>
              </template>
              <VList density="compact">
                <VListItem @click="openDocDialog('payroll_sheet', item)">
                  <template #prepend><VIcon size="16" class="mr-2">mdi-file-table-outline</VIcon></template>
                  <VListItemTitle class="text-body-2">Payroll Sheet</VListItemTitle>
                </VListItem>
                <VListItem @click="openDocDialog('ors', item)">
                  <template #prepend><VIcon size="16" class="mr-2">mdi-file-document-outline</VIcon></template>
                  <VListItemTitle class="text-body-2">Obligation Request & Status</VListItemTitle>
                </VListItem>
                <VListItem @click="openDocDialog('dv', item)">
                  <template #prepend><VIcon size="16" class="mr-2">mdi-receipt-text-outline</VIcon></template>
                  <VListItemTitle class="text-body-2">Disbursement Voucher</VListItemTitle>
                </VListItem>
              </VList>
            </VMenu>
            <VBtn
              v-if="item.status === 'draft'"
              icon size="small" variant="text" color="error"
              @click.stop="openDeleteConfirm(item)"
            >
              <VIcon size="18">mdi-delete-outline</VIcon>
              <VTooltip activator="parent" location="top">Delete</VTooltip>
            </VBtn>
          </div>
        </template>
      </BaseTable>

    </VContainer>

    <!-- ── Create Modal ── -->
    <BaseModal
      v-model="modalOpen"
      title="New Payroll Run"
      width="560"
      :persistent="true"
      :loading="modalLoading"
      confirm-text="Create Payroll Run"
      cancel-text="Cancel"
      @confirm="handleCreate"
      @cancel="modalOpen = false"
    >
      <VRow dense>

        <!-- Info -->
        <VCol cols="12">
          <VAlert type="info" variant="tonal" density="compact" icon="mdi-information-outline" class="mb-2">
            A payroll run covers <strong>one division</strong> for <strong>one month</strong>.
            You can add more details (SAA No., ORS No., etc.) after creation.
          </VAlert>
        </VCol>

        <!-- Period -->
        <VCol cols="12" class="mt-1">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Period Covered</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="6">
          <VSelect
            v-model="form.period_month"
            label="Month"
            :items="MONTH_OPTIONS"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-calendar-month-outline"
            :error-messages="formErrors.period_month"
          />
        </VCol>

        <VCol cols="12" sm="6">
          <VSelect
            v-model="form.period_year"
            label="Year"
            :items="YEAR_OPTIONS"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-calendar-outline"
            :error-messages="formErrors.period_year"
          />
        </VCol>

        <!-- Division -->
        <VCol cols="12" class="mt-2">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Division</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12">
          <VSelect
            v-model="form.division_id"
            label="Division"
            :items="divisionOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-domain"
            :error-messages="formErrors.division_id"
            hint="Employees will be grouped by Division → Section inside the run."
            persistent-hint
          />
        </VCol>

        <VCol cols="12">
          <VSelect
            v-model="form.section_id"
            label="Section"
            :items="sectionOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-account-group-outline"
            :loading="sectionsLoading"
            :disabled="!form.division_id || sectionsLoading"
            :error-messages="formErrors.section_id"
            hint="Select the specific section for this payroll run."
            persistent-hint
            :no-data-text="form.division_id ? 'No sections found for this division.' : 'Select a division first.'"
          />
        </VCol>

        <!-- Fund Cluster -->
        <VCol cols="12" class="mt-3">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Budget Information</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12">
          <VTextField
            v-model="form.fund_cluster"
            label="Fund Cluster"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-bank-outline"
            :error-messages="formErrors.fund_cluster"
            hint="e.g. 01, 02, 03"
            persistent-hint
          />
        </VCol>

        <!-- Optional reference numbers -->
        <VCol cols="12" class="mt-3">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">
            Reference Numbers <span class="text-lowercase font-weight-regular">(optional — can be filled later)</span>
          </p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.saa_no"
            label="SAA No."
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-pound"
            hint="Sub-Allotment Advice number"
            persistent-hint
          />
        </VCol>

        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.ors_no"
            label="ORS/BURS No."
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-pound"
            hint="Obligation Request & Status"
            persistent-hint
          />
        </VCol>

        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.dv_no"
            label="DV No."
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-pound"
            hint="Disbursement Voucher number"
            persistent-hint
          />
        </VCol>

        <VCol cols="12" sm="6">
          <VTextField
            v-model="form.jev_no"
            label="JEV No."
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-pound"
            hint="Journal Entry Voucher number"
            persistent-hint
          />
        </VCol>

      </VRow>
    </BaseModal>

    <!-- ── Delete Confirmation ── -->
    <VDialog v-model="confirmDeleteDialog" max-width="420" persistent>
      <VCard rounded="lg">
        <VCardText class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <VAvatar color="error" variant="tonal" size="44" rounded="lg">
              <VIcon icon="mdi-delete-outline" size="22" />
            </VAvatar>
            <div>
              <div class="text-body-1 font-weight-medium">Delete Payroll Run?</div>
              <div class="text-caption text-medium-emphasis">This action cannot be undone.</div>
            </div>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-0">
            You are about to delete payroll run
            <strong class="text-high-emphasis">{{ deleteTarget?.payroll_no }}</strong>
            for <strong class="text-high-emphasis">{{ deleteTarget?.division_name }}</strong>
            — {{ deleteTarget ? MONTH_NAMES[deleteTarget.period_month - 1] : '' }} {{ deleteTarget?.period_year }}.
            All associated data will be permanently removed.
          </p>
        </VCardText>
        <VDivider />
        <VCardActions class="justify-end pa-4 gap-2">
          <VBtn variant="text" :disabled="deleteLoading" @click="confirmDeleteDialog = false">Cancel</VBtn>
          <VBtn color="error" variant="tonal" :loading="deleteLoading" @click="executeDelete">
            <VIcon start size="16">mdi-delete-outline</VIcon>
            Yes, Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
 <!-- ── Document Generation Dialog ── -->
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
              <div class="text-caption text-medium-emphasis">{{ docTarget?.payroll_no }} — {{ docPeriodLabel }}</div>
            </div>
          </div>

          <VSkeletonLoader v-if="sigsLoading" type="list-item-two-line, list-item-two-line" />

          <template v-else>
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

            <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-2">
              Certified By
              <span class="text-lowercase font-weight-regular">
                ({{ certifiedSlotCount }} {{ certifiedSlotCount > 1 ? 'signatories' : 'signatory' }} required)
              </span>
            </p>

            <div class="d-flex flex-column gap-2">
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
    <BaseAlert
      v-model="alertVisible"
      :message="alertMessage"
      :type="alertType"
      :timeout="3500"
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
          <div class="text-caption text-medium-emphasis">{{ dtrNotSavedPeriod }}</div>
        </div>
      </div>
      <VAlert type="warning" variant="tonal" density="compact" icon="mdi-alert-outline" class="mb-4 text-body-2">
        {{ dtrNotSavedMessage }}
      </VAlert>
      <p class="text-body-2 text-medium-emphasis mb-0">
        Go to the <strong class="text-high-emphasis">DTR module</strong> and click
        <strong class="text-high-emphasis">Save DTR</strong> for
        <strong class="text-high-emphasis">{{ dtrNotSavedPeriod }}</strong> first,
        then come back to create this payroll run.
      </p>
    </VCardText>
    <VDivider />
    <VCardActions class="justify-end pa-4 gap-2">
      <VBtn variant="text" @click="dtrNotSavedDialog = false">Cancel</VBtn>
      <VBtn
        color="warning"
        variant="tonal"
        prepend-icon="mdi-clock-outline"
        @click="dtrNotSavedDialog = false; router.push('/dtr')"

      >
        Go to DTR Module
      </VBtn>
    </VCardActions>
  </VCard>
</VDialog>
  </div>
</template>
