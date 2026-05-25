<script setup lang="ts">
import BaseAlert from '@/components/base/BaseAlert.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTable from '@/components/base/BaseTable.vue'
import axios from '@axios'
import * as XLSX from 'xlsx'

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
interface Deductions {
  wage:            number
  premium_percent: number
  premium:         number
  philhealth:      number
  pag_ibig:        number
  sss:             number
  ewt_rate:        number
  updated_at?:     string
}

interface Employee {
  emp_id:          number
  name:            string
  position:        string
  salary_grade:    number
  philhealth_mode: 'fixed' | 'percentage'
  philhealth_min:  number
  has_deductions:  boolean
  hrmis_wage:      number | null
  has_hrmis_wage:  boolean
  deductions:      Deductions | null
}

interface PayrollBatch {
  id:            number
  payroll_month: number
  payroll_year:  number
  status:        'draft' | 'finalized'
  period_label?: string
}

type AlertType = 'success' | 'error' | 'warning' | 'info'

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const PAGIBIG_MIN = 400
const SSS_MIN     = 760
const SG_CUTOFF   = 16

const PREMIUM_OPTIONS = [
  { title: '5%',  value: 0.05 },
  { title: '10%', value: 0.10 },
  { title: '15%', value: 0.15 },
  { title: '20%', value: 0.20 },
]

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const TABLE_HEADERS = [
  { title: 'Name',       key: 'name',          sortable: true                        },
  { title: 'Position',   key: 'position',       sortable: true                        },
  { title: 'SG',         key: 'salary_grade',   sortable: true,  align: 'center' as const },
  { title: 'Wage',       key: 'wageDisp',       sortable: false, align: 'end'    as const },
  { title: 'Premium',    key: 'premiumDisp',    sortable: false, align: 'end'    as const },
  { title: 'PhilHealth', key: 'philhealthDisp', sortable: false, align: 'end'    as const },
  { title: 'Pag-IBIG',   key: 'pagibigDisp',    sortable: false, align: 'end'    as const },
  { title: 'SSS',        key: 'sssDisp',        sortable: false, align: 'end'    as const },
  { title: 'EWT Rate',   key: 'ewtDisp',        sortable: false, align: 'center' as const },
  { title: 'Status',     key: 'status',         sortable: true                        },
  { title: 'Actions',    key: 'actions',        sortable: false, align: 'center' as const },
]

const BLANK_FORM = (): Omit<Deductions, 'premium' | 'updated_at'> => ({
  wage:            0,
  premium_percent: 0.05,
  philhealth:      500,
  pag_ibig:        PAGIBIG_MIN,
  sss:             SSS_MIN,
  ewt_rate:        5,
})

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const employees    = ref<Employee[]>([])
const loading      = ref(false)
const modalOpen    = ref(false)
const modalLoading = ref(false)
const selectedEmp  = ref<Employee | null>(null)
const form         = ref(BLANK_FORM())
const formErrors   = ref<Partial<Record<keyof Deductions, string>>>({})
const filterStatus = ref<'All' | 'Set' | 'Not Set'>('All')
const isEditing    = ref(false)
const sssOptIn     = ref(false)

const alertVisible = ref(false)
const alertMessage = ref('')
const alertType    = ref<AlertType>('success')

const confirmSaveDialog  = ref(false)
const confirmResetDialog = ref(false)
const resetLoading       = ref(false)

// ── Export state ──────────────────────────────────────────────────────────────
const exportDialog    = ref(false)
const exportFormat    = ref<'excel' | 'pdf'>('excel')
const exportLoading   = ref(false)
const payrollBatches  = ref<PayrollBatch[]>([])
const batchesLoading  = ref(false)
const selectedBatchId = ref<number | null>(null)

/* ─────────────────────────────────────────
   COMPUTED
───────────────────────────────────────── */

const philhealthMin = computed(() => {
  if (!selectedEmp.value) return 500
  return selectedEmp.value.salary_grade >= SG_CUTOFF
    ? Math.round(form.value.wage * 0.05 * 100) / 100
    : 500
})

const philhealthHint = computed(() => {
  if (!selectedEmp.value) return 'Min: ₱500.00/month'
  return selectedEmp.value.salary_grade >= SG_CUTOFF
    ? `SG ${selectedEmp.value.salary_grade} — 5% of wage (min: ${fmt(philhealthMin.value)})/month`
    : 'Min: ₱500.00/month (SG 15 and below)'
})

const filteredItems = computed(() =>
  employees.value
    .filter(e => {
      if (filterStatus.value === 'Set')     return e.has_deductions
      if (filterStatus.value === 'Not Set') return !e.has_deductions
      return true
    })
    .map(e => ({
      ...e,
      wageDisp: e.deductions
        ? fmt(e.deductions.wage)
        : e.has_hrmis_wage
          ? `${fmt(e.hrmis_wage!)} *`
          : '—',
      premiumDisp: e.deductions
        ? `${fmt(e.deductions.premium)} (${Math.round(Number(e.deductions.premium_percent) * 100)}%)`
        : '—',
      philhealthDisp: e.deductions ? fmt(e.deductions.philhealth) : '—',
      pagibigDisp:    e.deductions ? fmt(e.deductions.pag_ibig)   : '—',
      sssDisp:        e.deductions
        ? (e.deductions.sss > 0 ? fmt(e.deductions.sss) : 'Opted out')
        : '—',
      ewtDisp: e.deductions ? `${e.deductions.ewt_rate}%` : '—',
      status:  e.has_deductions ? 'Set' : 'Not Set',
    }))
)

const totalSet    = computed(() => employees.value.filter(e =>  e.has_deductions).length)
const totalNotSet = computed(() => employees.value.filter(e => !e.has_deductions).length)

const hasAnyHrmisOnly = computed(() =>
  employees.value.some(e => e.has_hrmis_wage && !e.has_deductions)
)

const computedPremium = computed(() =>
  Math.round(Number(form.value.wage) * Number(form.value.premium_percent) * 100) / 100
)

const preview = computed(() => {
  if (!selectedEmp.value || !form.value.wage) return null
  const wage        = Number(form.value.wage)       || 0
  const philhealth  = Number(form.value.philhealth) || 0
  const pag_ibig    = Number(form.value.pag_ibig)   || 0
  const sss         = Number(form.value.sss)        || 0
  const premium     = computedPremium.value
  const gross       = wage + premium
  const totalDeduct = philhealth + pag_ibig + sss
  return {
    gross:           fmt(gross),
    premium:         fmt(premium),
    totalDeductions: fmt(totalDeduct),
    estimatedNet:    fmt(gross - totalDeduct),
  }
})

const batchOptions = computed(() =>
  payrollBatches.value.map(b => ({
    title: `${MONTH_NAMES[b.payroll_month - 1]} ${b.payroll_year}${b.status === 'finalized' ? ' ✓' : ''}`,
    value: b.id,
  }))
)

const selectedBatch = computed(() =>
  payrollBatches.value.find(b => b.id === selectedBatchId.value) ?? null
)

const exportPeriodLabel = computed(() => {
  if (!selectedBatch.value) return ''
  const { payroll_month, payroll_year } = selectedBatch.value
  return `${MONTH_NAMES[payroll_month - 1]} ${payroll_year}`
})

/* ─────────────────────────────────────────
   WATCHERS
───────────────────────────────────────── */

watch(() => form.value.wage, newWage => {
  if ((selectedEmp.value?.salary_grade ?? 0) >= SG_CUTOFF) {
    form.value.philhealth = Math.round(newWage * 0.05 * 100) / 100
  }
})

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */

const fmt = (v: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
  }).format(v)

const fmtNum = (v: number) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}

function validate(): boolean {
  const errs: Partial<Record<keyof Deductions, string>> = {}

  if (!form.value.wage || Number(form.value.wage) <= 0)
    errs.wage = 'Monthly wage is required and must be greater than ₱0.'

  if (!form.value.premium_percent)
    errs.premium_percent = 'Premium percent is required.'

  if (Number(form.value.philhealth) < philhealthMin.value)
    errs.philhealth = `PhilHealth must be at least ${fmt(philhealthMin.value)}.`

  if (Number(form.value.pag_ibig) < PAGIBIG_MIN)
    errs.pag_ibig = `Pag-IBIG must be at least ${fmt(PAGIBIG_MIN)}.`

  if (sssOptIn.value && Number(form.value.sss) < SSS_MIN)
    errs.sss = `SSS must be at least ${fmt(SSS_MIN)} if deducting.`

  if (Number(form.value.ewt_rate) < 0 || Number(form.value.ewt_rate) > 100)
    errs.ewt_rate = 'EWT rate must be between 0% and 100%.'

  formErrors.value = errs
  return Object.keys(errs).length === 0
}

/* ─────────────────────────────────────────
   EXPORT HELPERS
───────────────────────────────────────── */

async function fetchExportData(): Promise<Employee[]> {
  const { data } = await axios.get('/api/wage', { params: { export: true } })
  return (data.data ?? []) as Employee[]
}

function buildExportRows(data: Employee[]) {
  return data
    .filter(e => e.has_deductions && e.deductions)
    .map(e => {
      const d           = e.deductions!
      const wage        = Number(d.wage)
      const premium     = Number(d.premium)
      const philhealth  = Number(d.philhealth)
      const pagibig     = Number(d.pag_ibig)
      const sss         = Number(d.sss)
      const gross       = wage + premium
      const totalDeduct = philhealth + pagibig + sss
      const netPay      = gross - totalDeduct

      return {
        name:           e.name,
        position:       e.position,
        sg:             e.salary_grade || '—',
        wage,
        premiumPercent: `${Math.round(Number(d.premium_percent) * 100)}%`,
        premium,
        gross,
        philhealth,
        pagibig,
        sss,
        sssLabel:       sss > 0 ? fmtNum(sss) : 'Opted out',
        ewtRate:        `${d.ewt_rate}%`,
        totalDeduct,
        netPay,
      }
    })
}

/* ── Excel export ─────────────────────────────────────────────────────────── */
async function handleExportExcel() {
  exportLoading.value = true
  try {
    const raw  = await fetchExportData()
    const rows = buildExportRows(raw)

    if (!rows.length) {
      showAlert('warning', 'No employees with deductions found.')
      return
    }

    const periodLabel = exportPeriodLabel.value || 'All Periods'

    const headerRows = [
      ['DEPARTMENT OF HEALTH — REGION XII (SOCCSKSARGEN)'],
      ['JO Employee Government Remittances'],
      [`Period Covered: ${periodLabel}`],
      [`Generated: ${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`],
      [],
      [
        'Name', 'Position', 'SG',
        'Monthly Wage', 'Premium Rate', 'Premium Amount', 'Gross Pay',
        'PhilHealth', 'Pag-IBIG', 'SSS',
        'EWT Rate', 'Total Deductions', 'Est. Net Pay',
      ],
    ]

    const dataRows = rows.map(r => [
      r.name, r.position, r.sg,
      r.wage, r.premiumPercent, r.premium, r.gross,
      r.philhealth, r.pagibig, r.sss,
      r.ewtRate, r.totalDeduct, r.netPay,
    ])

    const totalsRow = [
      'TOTAL', '', '',
      rows.reduce((s, r) => s + r.wage,        0),
      '',
      rows.reduce((s, r) => s + r.premium,     0),
      rows.reduce((s, r) => s + r.gross,       0),
      rows.reduce((s, r) => s + r.philhealth,  0),
      rows.reduce((s, r) => s + r.pagibig,     0),
      rows.reduce((s, r) => s + r.sss,         0),
      '',
      rows.reduce((s, r) => s + r.totalDeduct, 0),
      rows.reduce((s, r) => s + r.netPay,      0),
    ]

    const allRows = [...headerRows, ...dataRows, [], totalsRow]
    const ws      = XLSX.utils.aoa_to_sheet(allRows)

    ws['!cols'] = [
      { wch: 36 }, { wch: 28 }, { wch: 6  },
      { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 10 }, { wch: 18 }, { wch: 16 },
    ]

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 12 } },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Remittances')

    const batchSuffix = selectedBatch.value
      ? `${MONTH_NAMES[selectedBatch.value.payroll_month - 1]}_${selectedBatch.value.payroll_year}`
      : 'All'
    XLSX.writeFile(wb, `DOH_R12_Remittances_${batchSuffix}.xlsx`)

    showAlert('success', 'Excel exported successfully.')
    exportDialog.value = false
  } catch (err: any) {
    showAlert('error', err.message ?? 'Export failed.')
  } finally {
    exportLoading.value = false
  }
}

/* ── PDF export ───────────────────────────────────────────────────────────── */
async function handleExportPdf() {
  exportLoading.value = true
  try {
    const raw  = await fetchExportData()
    const rows = buildExportRows(raw)

    if (!rows.length) {
      showAlert('warning', 'No employees with deductions found.')
      return
    }

    if (!(window as any).jspdf) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
        s.onload  = () => resolve()
        s.onerror = () => reject(new Error('Failed to load jsPDF.'))
        document.head.appendChild(s)
      })
    }
    if (!(window as any).jspdfAutotable) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
        s.onload  = () => resolve()
        s.onerror = () => reject(new Error('Failed to load AutoTable.'))
        document.head.appendChild(s)
        ;(window as any).jspdfAutotable = true
      })
    }

    const { jsPDF } = (window as any).jspdf
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const periodLabel = exportPeriodLabel.value || 'All Periods'
    const generated   = new Date().toLocaleDateString('en-PH', {
      month: 'long', day: 'numeric', year: 'numeric',
    })

    const totals = {
      wage:        rows.reduce((s, r) => s + r.wage,        0),
      premium:     rows.reduce((s, r) => s + r.premium,     0),
      gross:       rows.reduce((s, r) => s + r.gross,       0),
      philhealth:  rows.reduce((s, r) => s + r.philhealth,  0),
      pagibig:     rows.reduce((s, r) => s + r.pagibig,     0),
      sss:         rows.reduce((s, r) => s + r.sss,         0),
      totalDeduct: rows.reduce((s, r) => s + r.totalDeduct, 0),
      netPay:      rows.reduce((s, r) => s + r.netPay,      0),
    }

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    const DEEP_NAVY       = [31,  42,  69] as [number, number, number]
    const CHARCOAL_GRAY   = [51,  51,  51] as [number, number, number]
    const MINT_CREAM      = [238,250, 246] as [number, number, number]
    const HONEYDEW        = [222,240, 233] as [number, number, number]
    const FROSTED_MINT    = [230,246, 216] as [number, number, number]
    const SOFT_NAVY       = [54,  81, 117] as [number, number, number]
    const HERITAGE_YELLOW = [255,215,   0] as [number, number, number]
    const WHITE           = [255,255, 255] as [number, number, number]
    const LIGHT_GRAY      = [140,140, 140] as [number, number, number]

    // ── Header band ───────────────────────────────────────────────────────────
    doc.setFillColor(...DEEP_NAVY)
    doc.rect(0, 0, pageW, 32, 'F')
    doc.setFillColor(...HERITAGE_YELLOW)
    doc.rect(0, 32, pageW, 2, 'F')
    doc.setFillColor(...SOFT_NAVY)
    doc.rect(0, 0, 3, 34, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...WHITE)
    doc.text('DEPARTMENT OF HEALTH — REGION XII (SOCCSKSARGEN)', pageW / 2, 11, { align: 'center' })
    doc.setFontSize(13.5)
    doc.text('JO Employee Government Remittances', pageW / 2, 20, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(196, 214, 230)
    doc.text(
      `Period Covered: ${periodLabel}   ·   Generated: ${generated}   ·   Total Employees: ${rows.length}`,
      pageW / 2, 28, { align: 'center' },
    )

    // ── Summary chips ─────────────────────────────────────────────────────────
    const summaryY = 43
    const summaries = [
      { label: 'Total Wage',       value: `PHP ${fmtNum(totals.wage)}`,        accent: false },
      { label: 'Premium',          value: `PHP ${fmtNum(totals.premium)}`,     accent: false },
      { label: 'Gross Pay',        value: `PHP ${fmtNum(totals.gross)}`,       accent: false },
      { label: 'PhilHealth',       value: `PHP ${fmtNum(totals.philhealth)}`,  accent: false },
      { label: 'Pag-IBIG',         value: `PHP ${fmtNum(totals.pagibig)}`,     accent: false },
      { label: 'SSS',              value: `PHP ${fmtNum(totals.sss)}`,         accent: false },
      { label: 'Total Deductions', value: `PHP ${fmtNum(totals.totalDeduct)}`, accent: false },
      { label: 'Est. Net Pay',     value: `PHP ${fmtNum(totals.netPay)}`,      accent: true  },
    ]
    const chipW = (pageW - 28) / summaries.length

    summaries.forEach(({ label, value, accent }, i) => {
      const x = 14 + i * chipW
      doc.setFillColor(...(accent ? [255, 248, 200] as [number, number, number] : MINT_CREAM))
      doc.setDrawColor(...(accent ? HERITAGE_YELLOW : HONEYDEW))
      doc.setLineWidth(0.4)
      doc.roundedRect(x, summaryY - 5, chipW - 2, 11, 1.5, 1.5, 'FD')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(...LIGHT_GRAY)
      doc.text(label, x + (chipW - 2) / 2, summaryY - 0.8, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...(accent ? DEEP_NAVY : SOFT_NAVY))
      doc.text(value, x + (chipW - 2) / 2, summaryY + 3.8, { align: 'center' })
    })

    // ── Table ─────────────────────────────────────────────────────────────────
    const tableBody = rows.map((r, i) => [
      i + 1,
      r.name,
      r.position,
      r.sg,
      `PHP ${fmtNum(r.wage)}`,
      r.premiumPercent,
      `PHP ${fmtNum(r.premium)}`,
      `PHP ${fmtNum(r.gross)}`,
      `PHP ${fmtNum(r.philhealth)}`,
      `PHP ${fmtNum(r.pagibig)}`,
      r.sssLabel === 'Opted out' ? 'Opted out' : `PHP ${r.sssLabel}`,
      r.ewtRate,
      `PHP ${fmtNum(r.totalDeduct)}`,
      `PHP ${fmtNum(r.netPay)}`,
    ])

    const totalsRow = [
      { content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold' as const, halign: 'left' as const } },
      `PHP ${fmtNum(totals.wage)}`,
      '',
      `PHP ${fmtNum(totals.premium)}`,
      `PHP ${fmtNum(totals.gross)}`,
      `PHP ${fmtNum(totals.philhealth)}`,
      `PHP ${fmtNum(totals.pagibig)}`,
      `PHP ${fmtNum(totals.sss)}`,
      '',
      `PHP ${fmtNum(totals.totalDeduct)}`,
      `PHP ${fmtNum(totals.netPay)}`,
    ]

    ;(doc as any).autoTable({
      startY: summaryY + 9,
      head: [[
        '#', 'Name', 'Position', 'SG',
        'Monthly Wage', 'Premium %', 'Premium Amt', 'Gross Pay',
        'PhilHealth', 'Pag-IBIG', 'SSS',
        'EWT Rate', 'Total Deductions', 'Est. Net Pay',
      ]],
      body: tableBody,
      foot: [totalsRow],
      showFoot: 'lastPage',
      theme: 'grid',
      styles: {
        fontSize:    7.5,
        cellPadding: 2.5,
        valign:      'middle',
        overflow:    'linebreak',
        textColor:   CHARCOAL_GRAY,
        lineColor:   [210, 220, 230],
        lineWidth:   0.2,
      },
      headStyles: {
        fillColor: SOFT_NAVY,
        textColor: WHITE,
        fontStyle: 'bold',
        halign:    'center',
        fontSize:  7.5,
        lineColor: DEEP_NAVY,
        lineWidth: 0.3,
      },
      footStyles: {
        fillColor: HONEYDEW,
        textColor: DEEP_NAVY,
        fontStyle: 'bold',
        lineColor: [180, 210, 195],
        lineWidth: 0.3,
      },
      alternateRowStyles: { fillColor: FROSTED_MINT },
      columnStyles: {
        0:  { halign: 'center', cellWidth: 7  },
        1:  { cellWidth: 38 },
        2:  { cellWidth: 30 },
        3:  { halign: 'center', cellWidth: 9  },
        4:  { halign: 'right',  cellWidth: 20 },
        5:  { halign: 'center', cellWidth: 13 },
        6:  { halign: 'right',  cellWidth: 18 },
        7:  { halign: 'right',  cellWidth: 18 },
        8:  { halign: 'right',  cellWidth: 18 },
        9:  { halign: 'right',  cellWidth: 16 },
        10: { halign: 'right',  cellWidth: 18 },
        11: { halign: 'center', cellWidth: 13 },
        12: { halign: 'right',  cellWidth: 22 },
        13: { halign: 'right',  cellWidth: 20 },
      },
      margin: { left: 14, right: 14 },
    })

    // ── Footer bar ────────────────────────────────────────────────────────────
    doc.setFillColor(...HERITAGE_YELLOW)
    doc.rect(0, pageH - 7, pageW, 2, 'F')
    doc.setFillColor(...DEEP_NAVY)
    doc.rect(0, pageH - 5, pageW, 5, 'F')

    const finalY = (doc as any).lastAutoTable.finalY + 5
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(...LIGHT_GRAY)
    doc.text(
      'This report is system-generated. Employee share only. EWT applied after PHP 250,000 annual gross threshold.',
      pageW - 14, finalY, { align: 'right' },
    )

    const pdfBlob = doc.output('blob')
    const url     = URL.createObjectURL(pdfBlob)
    const tab     = window.open(url, '_blank')

    if (!tab) {
      showAlert('error', 'Popup blocked. Please allow popups for this site.')
      URL.revokeObjectURL(url)
      return
    }

    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    showAlert('success', 'PDF opened in a new tab.')
    exportDialog.value = false
  } catch (err: any) {
    showAlert('error', err.message ?? 'PDF export failed.')
  } finally {
    exportLoading.value = false
  }
}

async function handleExport() {
  if (exportFormat.value === 'excel') await handleExportExcel()
  else await handleExportPdf()
}

/* ─────────────────────────────────────────
   API
───────────────────────────────────────── */

async function fetchEmployees() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/wage')
    employees.value = data.data ?? []
  } catch {
    showAlert('error', 'Failed to load employees.')
  } finally {
    loading.value = false
  }
}

async function fetchBatches() {
  batchesLoading.value = true
  try {
    const { data } = await axios.get('/api/payroll-batch')
    payrollBatches.value = data ?? []
  } catch {
    showAlert('error', 'Failed to load payroll batches.')
  } finally {
    batchesLoading.value = false
  }
}

async function handleSave() {
  if (!validate() || !selectedEmp.value) return
  confirmSaveDialog.value = true
}

async function executeSave() {
  if (!selectedEmp.value) return
  confirmSaveDialog.value = false
  modalLoading.value      = true

  const payload = {
    ...form.value,
    sss: sssOptIn.value ? form.value.sss : 0,
  }

  try {
    const { data } = await axios.post(
      `/api/wage/upsert/${selectedEmp.value.emp_id}`,
      payload,
    )

    if (!data.success) throw new Error(data.message ?? 'Save failed.')

    const idx = employees.value.findIndex(e => e.emp_id === selectedEmp.value!.emp_id)
    if (idx !== -1) {
      employees.value[idx].deductions = {
        ...payload,
        premium: Math.round(payload.wage * payload.premium_percent * 100) / 100,
      }
      employees.value[idx].has_deductions = true
      employees.value[idx].hrmis_wage     = payload.wage
      employees.value[idx].has_hrmis_wage = true
    }

    showAlert('success', `Deductions saved for ${selectedEmp.value.name}.`)
    modalOpen.value = false
  } catch (err: any) {
    if (err.response?.data?.errors) {
      formErrors.value = Object.fromEntries(
        Object.entries(err.response.data.errors).map(([k, v]) => [k, (v as string[])[0]])
      )
    }
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to save.')
  } finally {
    modalLoading.value = false
  }
}

async function executeReset() {
  if (!selectedEmp.value) return
  confirmResetDialog.value = false
  resetLoading.value       = true

  try {
    const { data } = await axios.post(`/api/wage/delete/${selectedEmp.value.emp_id}`)

    if (!data.success) throw new Error(data.message ?? 'Reset failed.')

    const idx = employees.value.findIndex(e => e.emp_id === selectedEmp.value!.emp_id)
    if (idx !== -1) {
      employees.value[idx].deductions    = null
      employees.value[idx].has_deductions = false
    }

    showAlert('success', `Deductions cleared for ${selectedEmp.value.name}.`)
    modalOpen.value = false
  } catch (err: any) {
    showAlert('error', err.response?.data?.message ?? err.message ?? 'Failed to clear deductions.')
  } finally {
    resetLoading.value = false
  }
}

/* ─────────────────────────────────────────
   HANDLERS
───────────────────────────────────────── */

function openEdit(item: Record<string, any>) {
  const emp = employees.value.find(e => e.emp_id === item.emp_id)
  if (!emp) return

  selectedEmp.value = emp
  isEditing.value   = emp.has_deductions
  sssOptIn.value    = emp.has_deductions && (emp.deductions?.sss ?? 0) > 0

  form.value = emp.deductions
    ? {
        wage:            Number(emp.deductions.wage),
        premium_percent: Number(emp.deductions.premium_percent),
        philhealth:      Number(emp.deductions.philhealth),
        pag_ibig:        Number(emp.deductions.pag_ibig),
        sss:             Number(emp.deductions.sss),
        ewt_rate:        Number(emp.deductions.ewt_rate),
      }
    : {
        ...BLANK_FORM(),
        ...(emp.has_hrmis_wage && emp.hrmis_wage
          ? { wage: emp.hrmis_wage }
          : {}),
      }

  formErrors.value = {}
  modalOpen.value  = true
}

function openDeleteConfirm(item: Record<string, any>) {
  const emp = employees.value.find(e => e.emp_id === item.emp_id)
  if (!emp || !emp.has_deductions) return
  selectedEmp.value        = emp
  confirmResetDialog.value = true
}

function openExportDialog(format: 'excel' | 'pdf') {
  exportFormat.value    = format
  selectedBatchId.value = null
  exportDialog.value    = true
  fetchBatches()
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
          <h4 class="text-h5 font-weight-bold mb-1">Employee Deductions</h4>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Set monthly wage and deduction amounts per JO employee.
          </p>
        </div>
        <div class="d-flex gap-2">
          <VBtn variant="outlined" color="success" prepend-icon="mdi-microsoft-excel" size="small" @click="openExportDialog('excel')">
            Export Excel
          </VBtn>
          <VBtn variant="outlined" color="error" prepend-icon="mdi-file-pdf-box" size="small" @click="openExportDialog('pdf')">
            Export PDF
          </VBtn>
        </div>
      </div>

      <!-- ── Info Banner ── -->
      <VAlert type="info" variant="tonal" density="compact" icon="mdi-information-outline" class="mb-4 mt-4" closable>
        <strong>PhilHealth:</strong> SG 15 and below = ₱500/month fixed &nbsp;·&nbsp;
        SG 16 and above = 5% of monthly wage &nbsp;·&nbsp;
        <strong>Pag-IBIG</strong> min ₱400 (mandatory) &nbsp;·&nbsp;
        <strong>SSS</strong> voluntary — min ₱760 if deducting &nbsp;·&nbsp;
        <strong>Premium</strong> 5/10/15/20% of wage &nbsp;·&nbsp;
        <strong>EWT</strong> 5% after ₱250,000 annual gross
      </VAlert>

      <!-- ── Summary Cards ── -->
      <VRow class="mb-6">
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="primary" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-account-group-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ employees.length }}</div>
                <div class="text-body-2">Total JO Employees</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="success" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-check-circle-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalSet }}</div>
                <div class="text-body-2">Deductions Set</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="4">
          <VCard variant="tonal" color="warning" rounded="lg">
            <VCardText class="d-flex align-center gap-4">
              <VIcon icon="mdi-alert-circle-outline" size="36" />
              <div>
                <div class="text-h5 font-weight-bold">{{ totalNotSet }}</div>
                <div class="text-body-2">Deductions Not Set</div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- ── Filter ── -->
      <VRow class="mb-2" dense>
        <VCol cols="12" sm="6" md="4">
          <VSelect
            v-model="filterStatus"
            label="Filter by Status"
            :items="['All', 'Set', 'Not Set']"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-filter-outline"
            hide-details
          />
        </VCol>
      </VRow>

      <!-- ── HRMIS legend note ── -->
      <p v-if="hasAnyHrmisOnly" class="text-caption text-medium-emphasis mb-3">
        <VIcon icon="mdi-information-outline" size="13" class="mr-1" />
        * Wage sourced from HRMIS — deductions not yet set locally.
      </p>

      <!-- ── Table ── -->
      <BaseTable
        title="JO Employee Deductions"
        :headers="TABLE_HEADERS"
        :items="filteredItems"
        :loading="loading"
        :items-per-page="10"
        searchable
        @edit="openEdit"
        @delete="openDeleteConfirm"
      >
        <template #item.salary_grade="{ item }">
          <VChip
            :color="item.salary_grade >= SG_CUTOFF ? 'purple' : 'default'"
            size="small" variant="tonal" label
          >
            SG {{ item.salary_grade || '—' }}
          </VChip>
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="item.status === 'Set' ? 'success' : 'warning'"
            size="small" variant="tonal" label
          >
            <VIcon
              start
              :icon="item.status === 'Set' ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'"
              size="14"
            />
            {{ item.status }}
          </VChip>
        </template>

        <template #item.ewtDisp="{ item }">
          <VChip v-if="item.deductions" color="secondary" size="small" variant="tonal" label>
            {{ item.ewtDisp }}
          </VChip>
          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-1">
            <VBtn icon size="small" variant="text" color="primary" @click.stop="openEdit(item)">
              <VIcon size="18">mdi-pencil-outline</VIcon>
            </VBtn>
            <VBtn
              v-if="item.status === 'Set'"
              icon size="small" variant="text" color="error"
              @click.stop="openDeleteConfirm(item)"
            >
              <VIcon size="18">mdi-delete-outline</VIcon>
            </VBtn>
          </div>
        </template>
      </BaseTable>

    </VContainer>

    <!-- ── Edit Modal ── -->
    <BaseModal
      v-model="modalOpen"
      :title="`${isEditing ? 'Edit' : 'Set'} Deductions — ${selectedEmp?.name ?? ''}`"
      width="620"
      :persistent="true"
      :loading="modalLoading || resetLoading"
      confirm-text="Save Deductions"
      cancel-text="Cancel"
      @confirm="handleSave"
      @cancel="modalOpen = false"
    >
      <VRow dense>

        <!-- Employee Info -->
        <VCol cols="12">
          <VCard variant="tonal" color="default" rounded="lg" class="mb-2">
            <VCardText class="d-flex flex-wrap gap-6 py-3">
              <div>
                <div class="text-caption text-medium-emphasis">Position</div>
                <div class="text-body-2 font-weight-medium">{{ selectedEmp?.position ?? '—' }}</div>
              </div>
              <div>
                <div class="text-caption text-medium-emphasis">Salary Grade</div>
                <VChip
                  :color="(selectedEmp?.salary_grade ?? 0) >= SG_CUTOFF ? 'purple' : 'default'"
                  size="small" variant="tonal" label class="mt-1"
                >
                  SG {{ selectedEmp?.salary_grade ?? '—' }}
                </VChip>
              </div>
              <div>
                <div class="text-caption text-medium-emphasis">PhilHealth Mode</div>
                <div class="text-body-2 font-weight-medium">
                  {{ (selectedEmp?.salary_grade ?? 0) >= SG_CUTOFF ? '5% of monthly wage' : '₱500 fixed/month' }}
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <!-- HRMIS wage pre-fill notice -->
        <VCol v-if="selectedEmp?.has_hrmis_wage && !isEditing" cols="12">
          <VAlert
            type="info"
            variant="tonal"
            density="compact"
            icon="mdi-database-sync-outline"
            class="mb-1"
          >
            <span class="text-body-2">
              Wage pre-filled from HRMIS
              (<strong>{{ fmt(selectedEmp.hrmis_wage!) }}</strong>).
              Saving will also update the HRMIS record.
            </span>
          </VAlert>
        </VCol>

        <!-- Reset warning -->
        <VCol v-if="isEditing" cols="12">
          <VAlert type="warning" variant="tonal" density="compact" icon="mdi-alert-outline">
            <div class="d-flex align-center justify-space-between flex-wrap gap-2">
              <span class="text-body-2">Existing deductions are set for this employee.</span>
              <VBtn
                size="small" color="error" variant="outlined"
                prepend-icon="mdi-delete-outline"
                :loading="resetLoading"
                @click="confirmResetDialog = true"
              >
                Clear Deductions
              </VBtn>
            </div>
          </VAlert>
        </VCol>

        <!-- Wage & Premium -->
        <VCol cols="12" class="mt-1">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Monthly Wage & Premium</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="5">
          <VTextField
            v-model.number="form.wage"
            label="Monthly Wage"
            type="number"
            prefix="₱"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-cash-outline"
            :error-messages="formErrors.wage"
            hint="Employee's monthly wage."
            persistent-hint
            min="0.01"
          />
        </VCol>

        <VCol cols="12" sm="4">
          <VSelect
            v-model="form.premium_percent"
            label="Premium Rate"
            :items="PREMIUM_OPTIONS"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-percent-outline"
            :error-messages="formErrors.premium_percent"
            hint="Per employee contract."
            persistent-hint
          />
        </VCol>

        <VCol cols="12" sm="3">
          <VTextField
            :model-value="fmt(computedPremium)"
            label="Premium Amount"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-calculator-variant-outline"
            hint="Auto-computed."
            persistent-hint
            readonly
          />
        </VCol>

        <!-- Government Contributions -->
        <VCol cols="12" class="mt-2">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Government Contributions</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="4">
          <VTextField
            v-model.number="form.philhealth"
            label="PhilHealth"
            type="number"
            prefix="₱"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-hospital-box-outline"
            :error-messages="formErrors.philhealth"
            :hint="philhealthHint"
            persistent-hint
            :min="philhealthMin"
            :readonly="(selectedEmp?.salary_grade ?? 0) >= SG_CUTOFF"
          />
        </VCol>

        <VCol cols="12" sm="4">
          <VTextField
            v-model.number="form.pag_ibig"
            label="Pag-IBIG"
            type="number"
            prefix="₱"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-home-outline"
            :error-messages="formErrors.pag_ibig"
            :hint="`Min: ${fmt(PAGIBIG_MIN)}/month (mandatory)`"
            persistent-hint
            :min="PAGIBIG_MIN"
          />
        </VCol>

        <VCol cols="12" sm="4">
          <div class="d-flex flex-column gap-2">
            <VSwitch
              v-model="sssOptIn"
              color="primary"
              density="compact"
              hide-details
              :label="sssOptIn ? 'SSS: Deducting' : 'SSS: Not deducting'"
              @update:model-value="val => { if (!val) form.sss = 0; else if (form.sss === 0) form.sss = SSS_MIN }"
            />
            <VTextField
              v-if="sssOptIn"
              v-model.number="form.sss"
              label="SSS Amount"
              type="number"
              prefix="₱"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-shield-check-outline"
              :error-messages="formErrors.sss"
              :hint="`Min: ${fmt(SSS_MIN)}/month`"
              persistent-hint
              :min="SSS_MIN"
            />
            <p v-else class="text-caption text-medium-emphasis mb-0">
              Employee opted out — SSS will be recorded as ₱0.
            </p>
          </div>
        </VCol>

        <!-- EWT -->
        <VCol cols="12" class="mt-2">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Expanded Withholding Tax (EWT)</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="5">
          <VTextField
            v-model.number="form.ewt_rate"
            label="EWT Rate"
            type="number"
            suffix="%"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-percent-outline"
            :error-messages="formErrors.ewt_rate"
            hint="Default 5%. Applied after ₱250,000 annual gross."
            persistent-hint
            min="0"
            max="100"
            step="0.01"
          />
        </VCol>

        <VCol cols="12" sm="7" class="d-flex align-center">
          <VAlert
            type="info" variant="tonal" density="compact"
            icon="mdi-information-outline" class="text-body-2 w-100"
          >
            EWT applies only after cumulative annual gross exceeds <strong>₱250,000</strong>.
            Only the excess is taxed in the crossing month.
          </VAlert>
        </VCol>

        <!-- Preview -->
        <VCol v-if="preview" cols="12" class="mt-2">
          <VCard variant="tonal" color="success" rounded="lg">
            <VCardText class="py-3">
              <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-2">
                Estimated Monthly Deduction Summary
              </p>
              <VRow dense>
                <VCol cols="3">
                  <div class="text-caption text-medium-emphasis">Wage</div>
                  <div class="text-body-1 font-weight-bold">{{ fmt(form.wage) }}</div>
                </VCol>
                <VCol cols="3">
                  <div class="text-caption text-medium-emphasis">Premium</div>
                  <div class="text-body-1 font-weight-bold">{{ preview.premium }}</div>
                </VCol>
                <VCol cols="3">
                  <div class="text-caption text-medium-emphasis">Gross Pay</div>
                  <div class="text-body-1 font-weight-bold text-primary">{{ preview.gross }}</div>
                </VCol>
                <VCol cols="3">
                  <div class="text-caption text-medium-emphasis">Total Deductions</div>
                  <div class="text-body-1 font-weight-bold text-error">{{ preview.totalDeductions }}</div>
                </VCol>
              </VRow>
              <VDivider class="my-2" />
              <VRow dense>
                <VCol cols="12">
                  <div class="text-caption text-medium-emphasis">Est. Net Pay (excl. EWT)</div>
                  <div class="text-h6 font-weight-bold text-success">{{ preview.estimatedNet }}</div>
                </VCol>
              </VRow>
              <p class="text-caption text-medium-emphasis mt-2 mb-0">
                <VIcon icon="mdi-information-outline" size="12" class="mr-1" />
                EWT computed per payroll period, not included here.
              </p>
              <p class="text-caption text-medium-emphasis mt-1 mb-0">
                <VIcon icon="mdi-alert-circle-outline" size="12" class="mr-1" />
                Lates and absences are not reflected in this estimate.
              </p>
            </VCardText>
          </VCard>
        </VCol>

      </VRow>
    </BaseModal>

    <!-- ── Save Confirmation Dialog ── -->
    <VDialog v-model="confirmSaveDialog" max-width="420" persistent>
      <VCard>
        <VCardTitle class="pt-5 px-5">
          {{ isEditing ? 'Overwrite Deductions?' : 'Save Deductions?' }}
        </VCardTitle>
        <VCardText class="px-5">
          <span v-if="isEditing">
            You are about to <strong>overwrite</strong> the existing deductions for
            <strong>{{ selectedEmp?.name }}</strong>. This will replace all current values. Are you sure?
          </span>
          <span v-else>
            Save deductions for <strong>{{ selectedEmp?.name }}</strong>?
            You can edit or clear them later.
          </span>
        </VCardText>
        <VCardActions class="justify-end px-5 pb-4">
          <VBtn variant="text" @click="confirmSaveDialog = false">Cancel</VBtn>
          <VBtn color="primary" :loading="modalLoading" @click="executeSave">
            {{ isEditing ? 'Yes, Overwrite' : 'Yes, Save' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Reset Confirmation Dialog ── -->
    <VDialog v-model="confirmResetDialog" max-width="420" persistent>
      <VCard>
        <VCardTitle class="pt-5 px-5">Clear Deductions?</VCardTitle>
        <VCardText class="px-5">
          This will <strong>permanently delete</strong> all deduction records for
          <strong>{{ selectedEmp?.name }}</strong>, including wage, premium, PhilHealth,
          Pag-IBIG, SSS, and EWT rate. This cannot be undone.
        </VCardText>
        <VCardActions class="justify-end px-5 pb-4">
          <VBtn variant="text" @click="confirmResetDialog = false">Cancel</VBtn>
          <VBtn color="error" :loading="resetLoading" @click="executeReset">
            Yes, Clear Deductions
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ── Export Dialog ── -->
    <VDialog v-model="exportDialog" max-width="460" persistent>
      <VCard>
        <VCardTitle class="pt-5 px-5 d-flex align-center gap-2">
          <VIcon
            :icon="exportFormat === 'excel' ? 'mdi-microsoft-excel' : 'mdi-file-pdf-box'"
            :color="exportFormat === 'excel' ? 'success' : 'error'"
          />
          Export {{ exportFormat === 'excel' ? 'Excel' : 'PDF' }} Report
        </VCardTitle>

        <VCardText class="px-5 pb-2">
          <VAlert type="info" variant="tonal" density="compact" icon="mdi-information-outline" class="mb-4">
            All employees with deductions set will be included. The selected payroll batch
            is used as the <strong>period label</strong> on the report.
          </VAlert>

          <VSelect
            v-model="selectedBatchId"
            label="Payroll Batch (Period Label)"
            :items="batchOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-calendar-month-outline"
            :loading="batchesLoading"
            clearable
            hide-details
            :no-data-text="batchesLoading ? 'Loading...' : 'No payroll batches found'"
          />

          <p v-if="exportPeriodLabel" class="text-caption text-medium-emphasis mt-3 mb-0">
            <VIcon icon="mdi-tag-outline" size="13" class="mr-1" />
            Period label: <strong>{{ exportPeriodLabel }}</strong>
          </p>
          <p v-else class="text-caption text-medium-emphasis mt-3 mb-0">
            <VIcon icon="mdi-information-outline" size="13" class="mr-1" />
            No batch selected — report will show "All Periods".
          </p>
        </VCardText>

        <VCardActions class="justify-end px-5 pb-4">
          <VBtn variant="text" :disabled="exportLoading" @click="exportDialog = false">Cancel</VBtn>
          <VBtn
            :color="exportFormat === 'excel' ? 'success' : 'error'"
            :prepend-icon="exportFormat === 'excel' ? 'mdi-download' : 'mdi-file-pdf-box'"
            :loading="exportLoading"
            @click="handleExport"
          >
            {{ exportFormat === 'excel' ? 'Download Excel' : 'Open PDF' }}
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
  </div>
</template>
