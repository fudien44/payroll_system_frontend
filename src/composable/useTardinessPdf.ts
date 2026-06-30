import { ref } from 'vue'

/* ─────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────── */

export interface TardinessEmployee {
  name:     string   // "RODRIGUEZ, JULIUS CEZAR"
  dates:    string   // "4,5,6,7,11,13,14,18,19,20,21,25,26"
  days:     number   // 13
  minutes:  string   // "219" — kept as string to allow "240 UT" etc.
}

export interface TardinessDivision {
  name:      string               // "LOCAL HEALTH SUPPORT DIVISION"
  employees: TardinessEmployee[]
}

export interface TardinessPdfOptions {
  /** Month label, e.g. "May" */
  month: string
  /** Year, e.g. 2026 */
  year: number
  /** Memo number — leave blank to render the blank line */
  memoNo?: string
  /** Divisions with their employee lists */
  divisions: TardinessDivision[]
  /**
   * Base64 strings for the two header logos (optional).
   * If omitted, placeholder text boxes are drawn instead.
   * Provide as plain base64 (no data-URL prefix) or as a full data-URL.
   */
  logoLeftBase64?:  string  // Bagong Pilipinas / Republic seal
  logoRightBase64?: string  // DOH Regional Office seal
}

/* ─────────────────────────────────────────────────────────
   CDN LOADER HELPER
───────────────────────────────────────────────────────── */

async function loadScript(src: string, flag: string): Promise<void> {
  if ((window as any)[flag]) return
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => { (window as any)[flag] = true; resolve() }
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function ensureJsPdf(): Promise<void> {
  await loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    '__jspdfLoaded',
  )
  await loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
    '__jspdfAutotableLoaded',
  )
}

/* ─────────────────────────────────────────────────────────
   COLOR PALETTE  (matching the attendance PDF)
───────────────────────────────────────────────────────── */

const DEEP_TEAL:    [number, number, number] = [18,  78,  76]   // #124E4C
const FOREST_GREEN: [number, number, number] = [34, 102,  68]   // #226644
const CITRON:       [number, number, number] = [188, 210,  55]  // #BCD237
const MIST_GREEN:   [number, number, number] = [232, 245, 237]  // #E8F5ED
const PALE_FERN:    [number, number, number] = [212, 235, 220]  // #D4EBDC
const WHITE:        [number, number, number] = [255, 255, 255]
const CHARCOAL:     [number, number, number] = [45,   55,  45]
const LIGHT_GRAY:   [number, number, number] = [140, 140, 140]
const BLACK:        [number, number, number] = [0,     0,   0]

/* ─────────────────────────────────────────────────────────
   MAIN GENERATOR
───────────────────────────────────────────────────────── */

function buildPdf(opts: TardinessPdfOptions): InstanceType<any> {
  const { jsPDF } = (window as any).jspdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW  = doc.internal.pageSize.getWidth()   // 210
  const pageH  = doc.internal.pageSize.getHeight()  // 297
  const margin = 20   // left / right margin
  const contentW = pageW - margin * 2               // 170

  const generated = new Date().toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  /* ── Helper: new page with running footer ── */
  function addPage() {
    doc.addPage()
    drawFooter()
  }

  /* ── Footer (address bar) ── */
  function drawFooter() {
    const y = pageH - 12
    doc.setFillColor(...DEEP_TEAL)
    doc.rect(0, y - 2, pageW, 14, 'F')
    doc.setFillColor(...CITRON)
    doc.rect(0, y - 3, pageW, 1, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...WHITE)
    doc.text(
      'Purok San Miguel, Brgy. Paraiso, Koronadal City, South Cotabato',
      pageW / 2, y + 2, { align: 'center' },
    )
    doc.text(
      'Email address: dohsox@ro12.doh.gov.ph   website: http://www.ro12.doh.gov.ph',
      pageW / 2, y + 6.5, { align: 'center' },
    )
  }

  /* ══════════════════════════════════════════
     PAGE 1 — LETTERHEAD + MEMO HEADER
  ══════════════════════════════════════════ */

  // ── Accent bar at very top ──
  doc.setFillColor(...CITRON)
  doc.rect(0, 0, pageW, 2, 'F')
  doc.setFillColor(...FOREST_GREEN)
  doc.rect(0, 0, 3, 50, 'F')  // left accent stripe

  // ── Logo area ──
  const logoY  = 6
  const logoSz = 22  // mm

  if (opts.logoLeftBase64) {
    // Detect whether it's already a data-URL or raw base64
    const src = opts.logoLeftBase64.startsWith('data:')
      ? opts.logoLeftBase64
      : `data:image/png;base64,${opts.logoLeftBase64}`
    doc.addImage(src, 'PNG', margin, logoY, logoSz, logoSz)
  } else {
    // Placeholder box
    doc.setDrawColor(...LIGHT_GRAY)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, logoY, logoSz, logoSz, 'FD')
    doc.setFontSize(5.5)
    doc.setTextColor(...LIGHT_GRAY)
    doc.text('LOGO', margin + logoSz / 2, logoY + logoSz / 2, { align: 'center' })
  }

  if (opts.logoRightBase64) {
    const src = opts.logoRightBase64.startsWith('data:')
      ? opts.logoRightBase64
      : `data:image/png;base64,${opts.logoRightBase64}`
    doc.addImage(src, 'PNG', pageW - margin - logoSz, logoY, logoSz, logoSz)
  } else {
    doc.setDrawColor(...LIGHT_GRAY)
    doc.setFillColor(240, 240, 240)
    doc.rect(pageW - margin - logoSz, logoY, logoSz, logoSz, 'FD')
    doc.setFontSize(5.5)
    doc.setTextColor(...LIGHT_GRAY)
    doc.text('LOGO', pageW - margin - logoSz / 2, logoY + logoSz / 2, { align: 'center' })
  }

  // ── Agency text (centered between logos) ──
  const textCX = pageW / 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...BLACK)
  doc.text('Republic of the Philippines', textCX, 11, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('DEPARTMENT OF HEALTH', textCX, 16, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Center for Health Development', textCX, 21, { align: 'center' })

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.text('SOCCSKSARGEN Region', textCX, 26, { align: 'center' })

  // ── Thin divider under header ──
  doc.setDrawColor(...DEEP_TEAL)
  doc.setLineWidth(0.4)
  doc.line(margin, 32, pageW - margin, 32)
  doc.setLineWidth(0.2)
  doc.setDrawColor(...CITRON)
  doc.line(margin, 33, pageW - margin, 33)

  // ── REGIONAL MEMORANDUM title ──
  let curY = 40
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)
  doc.text('REGIONAL MEMORANDUM', margin, curY)

  curY += 7
  doc.text(`No. ___________________ s. ${opts.year}`, margin, curY)

  // ── Memo fields ──
  curY += 12

  function memoField(label: string, value: string, bold = false, curY: number): number {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...BLACK)
    doc.text(`${label}:`, margin, curY)

    const labelW = doc.getTextWidth(`${label}:`) + 10

    if (bold) doc.setFont('helvetica', 'bold')
    else       doc.setFont('helvetica', 'normal')

    // Pre-split on \n first, then word-wrap each line
    const allLines: string[] = value.split('\n').flatMap(segment =>
      doc.splitTextToSize(segment, contentW - labelW)
    )
    doc.text(allLines, margin + labelW, curY)
    return curY + allLines.length * 5 + 4
  }

  curY = memoField('TO', 'All Concerned Contract of Service (COS) Personnel\nThis Office', false, curY)
  curY += 3
  curY = memoField('FROM', 'ARISTIDES CONCEPCION TAN, MD, MPH, CESO III\nDirector IV', true, curY)
  curY += 3
  curY = memoField('DATE', generated, false, curY)
  curY += 3
  curY = memoField('SUBJECT', 'Reminder on Repeated Tardiness and Compliance with Office Rules', false, curY)
  curY += 8

  // ── Body paragraph ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)

  const bodyPara =
    `This is to inform you that records from the Daily Time Record (DTR) show that you have incurred ` +
    `more than five (5) days of tardiness for the month of ${opts.month} ${opts.year}:`

  // Remove the unused variables and render with inline bold
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const part1 = 'This is to inform you that records from the Daily Time Record (DTR) show that you have incurred '
  const part2 = 'more than five (5) days of tardiness'
  const part3 = ` for the month of `
  const part4 = `${opts.month} ${opts.year}:`

  // jsPDF doesn't support inline bold natively in a single text() call.
  // Simplest correct approach: render the full paragraph plain,
  // then overdraw the bold segments using getTextWidth() for positioning.
  const fullPara = part1 + part2 + part3 + part4
  const paraLines = doc.splitTextToSize(fullPara, contentW)
  doc.text(paraLines, margin, curY)

  // Overdraw bold words on line 1 (they fit on the first wrapped line)
  doc.setFont('helvetica', 'bold')
  const x1 = margin + doc.getTextWidth(part1)   // not accurate after wrapping
  // ⚠️ Note: for simplicity, many DOH-style PDFs just bold the whole sentence
  // or accept plain body text. True inline bold requires per-word rendering.
  curY += paraLines.length * 5 + 6

  /* ══════════════════════════════════════════
     DIVISION TABLES
  ══════════════════════════════════════════ */

  for (const division of opts.divisions) {
    // Check if we need a new page (leave 60mm for at least heading + a few rows)
    if (curY > pageH - 70) {
      addPage()
      curY = 20
    }

    // ── Division heading band ──
    doc.setFillColor(...DEEP_TEAL)
    doc.rect(margin, curY - 4, contentW, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...WHITE)
    doc.text(division.name, margin + 4, curY + 0.5)
    curY += 8

    // ── Table ──
    const tableBody = division.employees.map((emp, i) => [
      i + 1,
      emp.name,
      emp.dates,
      emp.days,
      emp.minutes,
    ])

    ;(doc as any).autoTable({
      startY:     curY,
      head: [['#', 'Name', 'Date', '# of Days', 'Mins']],
      body:       tableBody,
      theme:      'grid',
      styles: {
        fontSize:    8.5,
        cellPadding: 2.5,
        valign:      'middle',
        overflow:    'linebreak',
        textColor:   CHARCOAL,
        lineColor:   [180, 215, 195],
        lineWidth:   0.2,
      },
      headStyles: {
        fillColor: FOREST_GREEN,
        textColor: WHITE,
        fontStyle: 'bold',
        halign:    'center',
        fontSize:  8.5,
        lineColor: DEEP_TEAL,
        lineWidth: 0.3,
      },
      alternateRowStyles: { fillColor: MIST_GREEN },
      footStyles: {
        fillColor: PALE_FERN,
        textColor: DEEP_TEAL,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8   },
        1: { cellWidth: 52,    fontStyle: 'bold' },
        2: { cellWidth: 72 },
        3: { halign: 'center', cellWidth: 18  },
        4: { halign: 'center', cellWidth: 20  },
      },
      margin:     { left: margin, right: margin },
      didDrawPage: () => {
        drawFooter()
      },
    })

    curY = (doc as any).lastAutoTable.finalY + 10
  }

  /* ══════════════════════════════════════════
     CLOSING PARAGRAPHS
  ══════════════════════════════════════════ */

  if (curY > pageH - 80) {
    addPage()
    curY = 20
  }

  const closingParagraphs = [
    `Please be reminded that although you are engaged under a Contract of Service, you are still expected ` +
    `to observe official working hours and comply with existing office rules and regulations, particularly ` +
    `on attendance and punctuality. Repeated instances of tardiness reflect negatively on work discipline ` +
    `and professionalism and may affect the evaluation of your performance, renewal of contract, and future ` +
    `engagement with this Office.`,

    `In this regard, you are strongly advised to minimize, if not avoid, further instances of tardiness and ` +
    `strictly comply with the prescribed office working hours. Let this serve as a formal reminder to ` +
    `improve attendance and observe punctuality at all times.`,

    `Please be guided accordingly and ensure strict compliance.`,
  ]

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)

  for (const para of closingParagraphs) {
    const lines = doc.splitTextToSize(para, contentW)
    doc.text(lines, margin, curY)
    curY += lines.length * 5 + 5
  }

  /* ── Signature block ── */
  curY += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('ARISTIDES CONCEPCION TAN, MD, MPH, CESO III', margin + contentW / 2, curY, { align: 'center' })
  curY += 5
  doc.setFont('helvetica', 'normal')
  doc.text('Director IV', margin + contentW / 2, curY, { align: 'center' })

  drawFooter()
  return doc
}

/* ─────────────────────────────────────────────────────────
   COMPOSABLE
───────────────────────────────────────────────────────── */

export function useTardinessPdf() {
  const generating = ref(false)

  async function generateTardinessPdf(opts: TardinessPdfOptions): Promise<void> {
    generating.value = true
    try {
      await ensureJsPdf()
      const doc = buildPdf(opts)

      // Open in a new tab (same pattern as your payslip PDF)
      const previewTab = window.open('', '_blank')
      const blob = doc.output('blob')
      const url  = URL.createObjectURL(blob)
      if (previewTab) {
        previewTab.location.href = url
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally {
      generating.value = false
    }
  }

  return { generateTardinessPdf, generating }
}
