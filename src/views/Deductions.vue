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
  wage:       number
  philhealth: number
  pag_ibig:   number
  sss:        number
  ewt_rate:   number
  updated_at?: string
}

interface Employee {
  emp_id:          number
  name:            string
  position:        string
  salary_grade:    number
  philhealth_mode: 'fixed' | 'percentage'
  philhealth_min:  number
  has_deductions:  boolean
  deductions:      Deductions | null
}

type AlertType = 'success' | 'error' | 'warning' | 'info'

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const PAGIBIG_MIN = 400
const SSS_MIN     = 760
const SG_CUTOFF   = 16

const TABLE_HEADERS = [
  { title: 'Name',       key: 'name',          sortable: true  },
  { title: 'Position',   key: 'position',       sortable: true  },
  { title: 'SG',         key: 'salary_grade',   sortable: true,  align: 'center' as const },
  { title: 'Wage',       key: 'wageDisp',       sortable: false, align: 'end'    as const },
  { title: 'PhilHealth', key: 'philhealthDisp', sortable: false, align: 'end'    as const },
  { title: 'Pag-IBIG',   key: 'pagibigDisp',    sortable: false, align: 'end'    as const },
  { title: 'SSS',        key: 'sssDisp',        sortable: false, align: 'end'    as const },
  { title: 'EWT Rate',   key: 'ewtDisp',        sortable: false, align: 'center' as const },
  { title: 'Status',     key: 'status',         sortable: true  },
  { title: 'Actions',    key: 'actions',        sortable: false, align: 'center' as const },
]

const BLANK_FORM = (): Deductions => ({
  wage:       0,
  philhealth: 500,
  pag_ibig:   PAGIBIG_MIN,
  sss:        SSS_MIN,
  ewt_rate:   5,
})

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const employees    = ref<Employee[]>([])
const loading      = ref(false)
const modalOpen    = ref(false)
const modalLoading = ref(false)
const selectedEmp  = ref<Employee | null>(null)
const form         = ref<Deductions>(BLANK_FORM())
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

// ── Export state ─────────────────────────────────────────────────────────────
const exportDialog   = ref(false)
const exportDateFrom = ref('')
const exportDateTo   = ref('')
const exportLoading  = ref(false)
const exportFormat   = ref<'excel' | 'pdf'>('excel')

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
      wageDisp:       e.deductions ? fmt(e.deductions.wage)       : '—',
      philhealthDisp: e.deductions ? fmt(e.deductions.philhealth) : '—',
      pagibigDisp:    e.deductions ? fmt(e.deductions.pag_ibig)   : '—',
      sssDisp:        e.deductions
        ? (e.deductions.sss > 0 ? fmt(e.deductions.sss) : 'Opted out')
        : '—',
      ewtDisp:        e.deductions ? `${e.deductions.ewt_rate}%`  : '—',
      status:         e.has_deductions ? 'Set' : 'Not Set',
    }))
)

const totalSet    = computed(() => employees.value.filter(e =>  e.has_deductions).length)
const totalNotSet = computed(() => employees.value.filter(e => !e.has_deductions).length)

const preview = computed(() => {
  if (!selectedEmp.value || !form.value.wage) return null
  const wage        = Number(form.value.wage)       || 0
  const philhealth  = Number(form.value.philhealth) || 0
  const pag_ibig    = Number(form.value.pag_ibig)   || 0
  const sss         = Number(form.value.sss)        || 0
  const totalDeduct = philhealth + pag_ibig + sss
  return {
    totalDeductions: fmt(totalDeduct),
    estimatedNet:    fmt(wage - totalDeduct),
  }
})

const exportDateValid = computed(() => {
  if (!exportDateFrom.value || !exportDateTo.value) return false
  return new Date(exportDateFrom.value) <= new Date(exportDateTo.value)
})

const exportPeriodLabel = computed(() => {
  if (!exportDateFrom.value || !exportDateTo.value) return ''
  const from = new Date(exportDateFrom.value).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
  const to   = new Date(exportDateTo.value).toLocaleDateString('en-PH',   { month: 'long', day: 'numeric', year: 'numeric' })
  return `${from} – ${to}`
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
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

function showAlert(type: AlertType, message: string) {
  alertType.value    = type
  alertMessage.value = message
  alertVisible.value = true
}

function validate(): boolean {
  const errs: Partial<Record<keyof Deductions, string>> = {}

  if (!form.value.wage || Number(form.value.wage) <= 0)
    errs.wage = 'Monthly wage is required and must be greater than ₱0.'

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

/**
 * Fetch filtered employees from the API using date_from / date_to.
 * The backend filters by wages.updated_at within the range.
 */
async function fetchExportData(): Promise<Employee[]> {
  const params: Record<string, string> = {}
  if (exportDateFrom.value) params.date_from = exportDateFrom.value
  if (exportDateTo.value)   params.date_to   = exportDateTo.value

  const { data } = await axios.get('/api/wage', { params })
  return (data.data ?? []) as Employee[]
}

/**
 * Build the flat row array used by both Excel and PDF exports.
 */
function buildExportRows(data: Employee[]) {
  return data
    .filter(e => e.has_deductions && e.deductions)
    .map(e => {
      const d             = e.deductions!
      const wage          = Number(d.wage)
      const philhealth    = Number(d.philhealth)
      const pagibig       = Number(d.pag_ibig)
      const sss           = Number(d.sss)
      const totalDeduct   = philhealth + pagibig + sss
      const netPay        = wage - totalDeduct

      return {
        name:         e.name,
        position:     e.position,
        sg:           e.salary_grade || '—',
        wage,
        philhealth,
        pagibig,
        sss:          sss > 0 ? sss : 0,
        sssLabel:     sss > 0 ? fmtNum(sss) : 'Opted out',
        ewtRate:      `${d.ewt_rate}%`,
        totalDeduct,
        netPay,
      }
    })
}

/* ── Excel export ────────────────────────────────────────────────────────── */
async function handleExportExcel() {
  exportLoading.value = true
  try {
    const raw  = await fetchExportData()
    const rows = buildExportRows(raw)

    if (!rows.length) {
      showAlert('warning', 'No employees with deductions found for the selected period.')
      return
    }

    const periodLabel = exportPeriodLabel.value

    // ── Header rows ──────────────────────────────────────────────────────────
    const headerRows = [
      ['DEPARTMENT OF HEALTH — REGION XII (SOCCSKSARGEN)'],
      ['JO Employee Government Remittances'],
      [`Period Covered: ${periodLabel}`],
      [`Generated: ${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`],
      [], // blank spacer
      [
        'Name',
        'Position',
        'SG',
        'Monthly Wage',
        'PhilHealth',
        'Pag-IBIG',
        'SSS',
        'EWT Rate',
        'Total Deductions',
        'Est. Net Pay',
      ],
    ]

    const dataRows = rows.map(r => [
      r.name,
      r.position,
      r.sg,
      r.wage,
      r.philhealth,
      r.pagibig,
      r.sss,
      r.ewtRate,
      r.totalDeduct,
      r.netPay,
    ])

    // ── Totals row ───────────────────────────────────────────────────────────
    const totalsRow = [
      'TOTAL',
      '',
      '',
      rows.reduce((s, r) => s + r.wage,        0),
      rows.reduce((s, r) => s + r.philhealth,  0),
      rows.reduce((s, r) => s + r.pagibig,     0),
      rows.reduce((s, r) => s + r.sss,         0),
      '',
      rows.reduce((s, r) => s + r.totalDeduct, 0),
      rows.reduce((s, r) => s + r.netPay,      0),
    ]

    const allRows = [...headerRows, ...dataRows, [], totalsRow]

    const ws = XLSX.utils.aoa_to_sheet(allRows)

    // ── Column widths ────────────────────────────────────────────────────────
    ws['!cols'] = [
      { wch: 36 }, // Name
      { wch: 28 }, // Position
      { wch: 6  }, // SG
      { wch: 16 }, // Wage
      { wch: 14 }, // PhilHealth
      { wch: 12 }, // Pag-IBIG
      { wch: 14 }, // SSS
      { wch: 10 }, // EWT Rate
      { wch: 18 }, // Total Deductions
      { wch: 16 }, // Net Pay
    ]

    // ── Merge title rows across all 10 columns ───────────────────────────────
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Remittances')

    const fileName = `DOH_R12_Remittances_${exportDateFrom.value}_to_${exportDateTo.value}.xlsx`
    XLSX.writeFile(wb, fileName)

    showAlert('success', `Excel exported: ${fileName}`)
    exportDialog.value = false
  } catch (err: any) {
    showAlert('error', err.message ?? 'Export failed.')
  } finally {
    exportLoading.value = false
  }
}

/* ── PDF export (jsPDF + AutoTable → real .pdf blob in a new tab) ────────── */
async function handleExportPdf() {
  exportLoading.value = true
  try {
    const raw  = await fetchExportData()
    const rows = buildExportRows(raw)

    if (!rows.length) {
      showAlert('warning', 'No employees with deductions found for the selected period.')
      return
    }

    // ── Lazy-load jsPDF + AutoTable from CDN ─────────────────────────────────
    // We load once and cache on window to avoid re-fetching on repeated exports.
    if (!(window as any).jspdf) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
        s.onload  = () => resolve()
        s.onerror = () => reject(new Error('Failed to load jsPDF.'))
        document.head.appendChild(s)
      })
    }
    if (!(window as any).jspdfAutotable) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
        s.onload  = () => resolve()
        s.onerror = () => reject(new Error('Failed to load AutoTable.'))
        document.head.appendChild(s)
        ;(window as any).jspdfAutotable = true
      })
    }

    const { jsPDF } = (window as any).jspdf
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const periodLabel = exportPeriodLabel.value
    const generated   = new Date().toLocaleDateString('en-PH', {
      month: 'long', day: 'numeric', year: 'numeric',
    })

    const totals = {
      wage:        rows.reduce((s, r) => s + r.wage,        0),
      philhealth:  rows.reduce((s, r) => s + r.philhealth,  0),
      pagibig:     rows.reduce((s, r) => s + r.pagibig,     0),
      sss:         rows.reduce((s, r) => s + r.sss,         0),
      totalDeduct: rows.reduce((s, r) => s + r.totalDeduct, 0),
      netPay:      rows.reduce((s, r) => s + r.netPay,      0),
    }

    const pageW  = doc.internal.pageSize.getWidth()
    const pageH  = doc.internal.pageSize.getHeight()

    // ── DOH 2025–2028 Official Brand Palette ─────────────────────────────────
    // Primary Institutional (Neutrals)
    const DEEP_NAVY      = [31,  42,  69] as [number,number,number]  // #1F2A45
    const CHARCOAL_GRAY  = [51,  51,  51] as [number,number,number]  // #333333
    const MINT_CREAM     = [238,250, 246] as [number,number,number]  // #EEFAF6
    const HONEYDEW       = [222,240, 233] as [number,number,number]  // #DEF0E9
    const FROSTED_MINT   = [230,246, 216] as [number,number,number]  // #E6F6D8
    // Secondary Support
    const SOFT_NAVY      = [54,  81, 117] as [number,number,number]  // #365175
    const STEEL_BLUE     = [88, 124, 165] as [number,number,number]  // #587CA5
    const BLUE_SLATE     = [76, 107, 117] as [number,number,number]  // #4C6B75
    // Accent
    const HERITAGE_YELLOW = [255,215,  0] as [number,number,number]  // #FFD700
    const HEALTH_BLUE     = [11,  75, 170] as [number,number,number] // #0B4BAA
    const WHITE           = [255,255, 255] as [number,number,number]
    const LIGHT_GRAY      = [140,140, 140] as [number,number,number]

    // ── Header band: Deep Navy (primary institutional) ────────────────────────
    doc.setFillColor(...DEEP_NAVY)
    doc.rect(0, 0, pageW, 32, 'F')

    // Heritage Yellow accent strip below header
    doc.setFillColor(...HERITAGE_YELLOW)
    doc.rect(0, 32, pageW, 2, 'F')

    // Left vertical accent bar (Soft Navy) — subtle brand mark
    doc.setFillColor(...SOFT_NAVY)
    doc.rect(0, 0, 3, 34, 'F')

    // Agency name — upper weight in white
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...WHITE)
    doc.text('DEPARTMENT OF HEALTH — REGION XII (SOCCSKSARGEN)', pageW / 2, 11, { align: 'center' })

    // Report title — larger, still white
    doc.setFontSize(13.5)
    doc.text('JO Employee Government Remittances', pageW / 2, 20, { align: 'center' })

    // Meta line — subdued, light blue-white
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(196, 214, 230)
    doc.text(
      `Period Covered: ${periodLabel}   ·   Generated: ${generated}   ·   Total Employees: ${rows.length}`,
      pageW / 2, 28, { align: 'center' },
    )

    // ── Summary chips row ─────────────────────────────────────────────────────
    const summaryY = 43
    const summaries = [
      { label: 'Total Wage',       value: `PHP ${fmtNum(totals.wage)}`,        accent: false },
      { label: 'PhilHealth',       value: `PHP ${fmtNum(totals.philhealth)}`,  accent: false },
      { label: 'Pag-IBIG',         value: `PHP ${fmtNum(totals.pagibig)}`,     accent: false },
      { label: 'SSS',              value: `PHP ${fmtNum(totals.sss)}`,         accent: false },
      { label: 'Total Deductions', value: `PHP ${fmtNum(totals.totalDeduct)}`, accent: false },
      { label: 'Est. Net Pay',     value: `PHP ${fmtNum(totals.netPay)}`,      accent: true  },
    ]
    const chipW = (pageW - 28) / summaries.length

    summaries.forEach(({ label, value, accent }, i) => {
      const x = 14 + i * chipW

      // Chip: Heritage Yellow for Net Pay, Mint Cream for others
      doc.setFillColor(...(accent ? [255, 248, 200] as [number,number,number] : MINT_CREAM))
      doc.setDrawColor(...(accent ? HERITAGE_YELLOW : HONEYDEW))
      doc.setLineWidth(0.4)
      doc.roundedRect(x, summaryY - 5, chipW - 2, 11, 1.5, 1.5, 'FD')

      // Label
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(...LIGHT_GRAY)
      doc.text(label, x + (chipW - 2) / 2, summaryY - 0.8, { align: 'center' })

      // Value — Deep Navy for accent chip, Soft Navy for rest
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
        'Monthly Wage', 'PhilHealth', 'Pag-IBIG', 'SSS',
        'EWT Rate', 'Total Deductions', 'Est. Net Pay',
      ]],
      body: tableBody,
      foot: [totalsRow],
      showFoot: 'lastPage',
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        valign: 'middle',
        overflow: 'linebreak',
        textColor: CHARCOAL_GRAY,
        lineColor: [210, 220, 230],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: SOFT_NAVY,       // Secondary Soft Navy Blue for table header
        textColor: WHITE,
        fontStyle: 'bold',
        halign:    'center',
        fontSize:  8,
        lineColor: DEEP_NAVY,
        lineWidth: 0.3,
      },
      footStyles: {
        fillColor: HONEYDEW,        // Honeydew (primary neutral) for totals row
        textColor: DEEP_NAVY,
        fontStyle: 'bold',
        lineColor: [180, 210, 195],
        lineWidth: 0.3,
      },
      alternateRowStyles: {
        fillColor: FROSTED_MINT,    // Frosted Mint — very subtle stripe
      },
      columnStyles: {
        0:  { halign: 'center', cellWidth: 8   },
        1:  { cellWidth: 48  },
        2:  { cellWidth: 38  },
        3:  { halign: 'center', cellWidth: 10  },
        4:  { halign: 'right', cellWidth: 24   },
        5:  { halign: 'right', cellWidth: 22   },
        6:  { halign: 'right', cellWidth: 20   },
        7:  { halign: 'right', cellWidth: 22   },
        8:  { halign: 'center', cellWidth: 16  },
        9:  { halign: 'right', cellWidth: 26   },
        10: { halign: 'right', cellWidth: 24   },
      },
      margin: { left: 14, right: 14 },
    })

    // ── Bottom footer bar: Heritage Yellow + Deep Navy ────────────────────────
    doc.setFillColor(...HERITAGE_YELLOW)
    doc.rect(0, pageH - 7,   pageW, 2,   'F')
    doc.setFillColor(...DEEP_NAVY)
    doc.rect(0, pageH - 5,   pageW, 5,   'F')

    // ── Footer note ───────────────────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable.finalY + 5
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(...LIGHT_GRAY)
    doc.text(
      'This report is system-generated. Employee share only. EWT applied after PHP 250,000 annual gross threshold.',
      pageW - 14, finalY, { align: 'right' },
    )

    // ── Open as real PDF blob in a new tab ────────────────────────────────────
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
  if (exportFormat.value === 'excel') {
    await handleExportExcel()
  } else {
    await handleExportPdf()
  }
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

async function handleSave() {
  if (!validate() || !selectedEmp.value) return
  confirmSaveDialog.value = true
}

async function executeSave() {
  if (!selectedEmp.value) return
  confirmSaveDialog.value = false
  modalLoading.value      = true

  const payload = { ...form.value, sss: sssOptIn.value ? form.value.sss : 0 }

  try {
    const { data } = await axios.post(
      `/api/wage/upsert/${selectedEmp.value.emp_id}`,
      payload,
    )

    if (!data.success) throw new Error(data.message ?? 'Save failed.')

    const idx = employees.value.findIndex(e => e.emp_id === selectedEmp.value!.emp_id)
    if (idx !== -1) {
      employees.value[idx].deductions    = { ...payload }
      employees.value[idx].has_deductions = true
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
        wage:       Number(emp.deductions.wage),
        philhealth: Number(emp.deductions.philhealth),
        pag_ibig:   Number(emp.deductions.pag_ibig),
        sss:        Number(emp.deductions.sss),
        ewt_rate:   Number(emp.deductions.ewt_rate),
      }
    : BLANK_FORM()

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
  exportFormat.value   = format
  exportDateFrom.value = ''
  exportDateTo.value   = ''
  exportDialog.value   = true
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

        <!-- ── Export Buttons ── -->
        <div class="d-flex gap-2">
          <VBtn
            variant="outlined"
            color="success"
            prepend-icon="mdi-microsoft-excel"
            size="small"
            @click="openExportDialog('excel')"
          >
            Export Excel
          </VBtn>
          <VBtn
            variant="outlined"
            color="error"
            prepend-icon="mdi-file-pdf-box"
            size="small"
            @click="openExportDialog('pdf')"
          >
            Export PDF
          </VBtn>
        </div>
      </div>

      <!-- ── Info Banner ── -->
      <VAlert
        type="info"
        variant="tonal"
        density="compact"
        icon="mdi-information-outline"
        class="mb-6 mt-4"
        closable
      >
        <strong>PhilHealth:</strong>
        SG 15 and below = ₱500/month fixed &nbsp;·&nbsp;
        SG 16 and above = 5% of monthly wage &nbsp;·&nbsp;
        <strong>Pag-IBIG</strong> min ₱400 (mandatory) &nbsp;·&nbsp;
        <strong>SSS</strong> voluntary — min ₱760 if deducting, ₱0 if opted out &nbsp;·&nbsp;
        <strong>EWT</strong> 5% after ₱250,000 annual gross, editable per employee
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
      <VRow class="mb-4" dense>
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
            size="small"
            variant="tonal"
            label
          >
            SG {{ item.salary_grade || '—' }}
          </VChip>
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="item.status === 'Set' ? 'success' : 'warning'"
            size="small"
            variant="tonal"
            label
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

        <!-- ── Actions: hide delete for employees with no deductions ── -->
        <template #item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-1">
            <VBtn
              icon
              size="small"
              variant="text"
              color="primary"
              @click.stop="openEdit(item)"
            >
              <VIcon size="18">mdi-pencil-outline</VIcon>
            </VBtn>
            <VBtn
              v-if="item.status === 'Set'"
              icon
              size="small"
              variant="text"
              color="error"
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
      width="600"
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
                  size="small"
                  variant="tonal"
                  label
                  class="mt-1"
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

        <!-- Reset warning -->
        <VCol v-if="isEditing" cols="12">
          <VAlert type="warning" variant="tonal" density="compact" icon="mdi-alert-outline">
            <div class="d-flex align-center justify-space-between flex-wrap gap-2">
              <span class="text-body-2">Existing deductions are set for this employee.</span>
              <VBtn
                size="small"
                color="error"
                variant="outlined"
                prepend-icon="mdi-delete-outline"
                :loading="resetLoading"
                @click="confirmResetDialog = true"
              >
                Clear Deductions
              </VBtn>
            </div>
          </VAlert>
        </VCol>

        <!-- Wage -->
        <VCol cols="12" class="mt-1">
          <p class="text-caption text-medium-emphasis font-weight-medium text-uppercase mb-0">Monthly Wage</p>
          <VDivider class="mt-1 mb-3" />
        </VCol>

        <VCol cols="12" sm="6">
          <VTextField
            v-model.number="form.wage"
            label="Monthly Wage"
            type="number"
            prefix="₱"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-cash-outline"
            :error-messages="formErrors.wage"
            hint="Enter the employee's monthly wage."
            persistent-hint
            min="0.01"
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
            hint="Default 5%. Applied after ₱250,000 annual gross threshold."
            persistent-hint
            min="0"
            max="100"
            step="0.01"
          />
        </VCol>

        <VCol cols="12" sm="7" class="d-flex align-center">
          <VAlert type="info" variant="tonal" density="compact" icon="mdi-information-outline" class="text-body-2 w-100">
            EWT applies only after cumulative annual gross exceeds
            <strong>₱250,000</strong>. Only the excess is taxed in the crossing month.
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
                <VCol cols="6">
                  <div class="text-caption text-medium-emphasis">Total Deductions (excl. EWT)</div>
                  <div class="text-body-1 font-weight-bold">{{ preview.totalDeductions }}</div>
                </VCol>
                <VCol cols="6">
                  <div class="text-caption text-medium-emphasis">Est. Net Pay (excl. EWT)</div>
                  <div class="text-body-1 font-weight-bold text-success">{{ preview.estimatedNet }}</div>
                </VCol>
              </VRow>
              <p class="text-caption text-medium-emphasis mt-2 mb-0">
                <VIcon icon="mdi-information-outline" size="12" class="mr-1" />
                EWT and premium are excluded — computed per payroll period.
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
            <strong>{{ selectedEmp?.name }}</strong>. This will replace all current values.
            Are you sure?
          </span>
          <span v-else>
            Save deductions for <strong>{{ selectedEmp?.name }}</strong>? You can edit or
            clear them later from this page.
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
          <strong>{{ selectedEmp?.name }}</strong>, including wage, PhilHealth, Pag-IBIG,
          SSS, and EWT rate. This cannot be undone.
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
            Only employees whose deduction record was <strong>last updated</strong> within the
            selected date range will be included in the export.
          </VAlert>

          <VRow dense>
            <VCol cols="12" sm="6">
              <VTextField
                v-model="exportDateFrom"
                label="Date From"
                type="date"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-calendar-start"
                hide-details
              />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField
                v-model="exportDateTo"
                label="Date To"
                type="date"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-calendar-end"
                hide-details
              />
            </VCol>
          </VRow>

          <!-- Period preview label -->
          <p v-if="exportPeriodLabel" class="text-caption text-medium-emphasis mt-3 mb-0">
            <VIcon icon="mdi-tag-outline" size="13" class="mr-1" />
            Period label: <strong>{{ exportPeriodLabel }}</strong>
          </p>
          <p v-if="exportDateFrom && exportDateTo && !exportDateValid" class="text-caption text-error mt-2 mb-0">
            <VIcon icon="mdi-alert-circle-outline" size="13" class="mr-1" />
            "Date From" must be on or before "Date To".
          </p>
        </VCardText>

        <VCardActions class="justify-end px-5 pb-4">
          <VBtn variant="text" :disabled="exportLoading" @click="exportDialog = false">Cancel</VBtn>
          <VBtn
            :color="exportFormat === 'excel' ? 'success' : 'error'"
            :prepend-icon="exportFormat === 'excel' ? 'mdi-download' : 'mdi-file-pdf-box'"
            :loading="exportLoading"
            :disabled="!exportDateValid"
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
