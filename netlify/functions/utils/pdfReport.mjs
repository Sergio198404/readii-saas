// Shared pdfkit helpers for Readii reports.
// Uses built-in Helvetica (no CJK). Chinese values are omitted; English labels used.

import PDFDocument from 'pdfkit'

export function createDoc() {
  return new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
}

export function addHeader(doc, title, subtitle) {
  doc.fontSize(22).fillColor('#C9A84C').text('Readii')
  doc.moveDown(0.2)
  doc.fontSize(16).fillColor('#1B2A4A').text(title)
  if (subtitle) {
    doc.fontSize(10).fillColor('#888').text(subtitle)
  }
  doc.moveDown(0.4)
  hr(doc)
  doc.moveDown(0.5)
}

export function hr(doc) {
  const y = doc.y
  doc.strokeColor('#cfcfcf').lineWidth(0.5).moveTo(50, y).lineTo(545, y).stroke()
}

export function sectionTitle(doc, text) {
  doc.moveDown(0.6)
  doc.fontSize(13).fillColor('#1B2A4A').text(text)
  const y = doc.y + 2
  doc.strokeColor('#C9A84C').lineWidth(1.5).moveTo(50, y).lineTo(545, y).stroke()
  doc.moveDown(0.3)
}

export function kvLine(doc, label, value) {
  doc.fontSize(10).fillColor('#333')
  doc.text(`${label}: `, { continued: true }).fillColor('#1B2A4A').text(value || '-')
}

export function bullet(doc, text, color = '#333') {
  doc.fontSize(9).fillColor(color).text(`- ${text}`)
}

export function addFooter(doc, tagline = 'Readii Limited  •  readii.co.uk  •  Canterbury UK') {
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    const bottom = doc.page.height - 40
    doc.fontSize(8).fillColor('#999')
      .text(tagline, 50, bottom, { align: 'center', width: 495 })
    doc.text(`Page ${i + 1} / ${range.count}`, 50, bottom + 12, { align: 'center', width: 495 })
  }
}

export function addDisclaimer(doc, text) {
  doc.moveDown(1.5)
  doc.fontSize(8).fillColor('#777')
    .text(text || 'Disclaimer: This report is based on information tracked in the Readii platform and is provided as a supporting document. It does not constitute legal advice. Consult a qualified solicitor for any legal matters.',
      { align: 'justify' })
}

export function addSignature(doc, roles = ['Readii Compliance Consultant', 'Customer Acknowledgement']) {
  doc.moveDown(2)
  doc.fontSize(10).fillColor('#333')
  for (const role of roles) {
    doc.text(`${role}: ____________________________     Date: __________`)
    doc.moveDown(1.2)
  }
}

export function finalizeToBuffer(doc, addFooterFn = true) {
  return new Promise((resolve, reject) => {
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    if (addFooterFn) addFooter(doc)
    doc.end()
  })
}

export function fmtDate(d) {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return '-'
  return date.toISOString().split('T')[0]
}

export function fmtMoney(pence) {
  if (pence == null) return '-'
  return `£${(pence / 100).toLocaleString('en-GB')}`
}

export function fmtGBP(n) {
  if (n == null) return '-'
  return `£${Number(n).toLocaleString('en-GB')}`
}
