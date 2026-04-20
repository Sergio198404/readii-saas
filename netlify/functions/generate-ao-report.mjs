import { createDoc, addHeader, sectionTitle, kvLine, bullet, addDisclaimer, addSignature, finalizeToBuffer, fmtDate }
  from './utils/pdfReport.mjs'
import { jsonResponse, getAdminClient, resolveCaller, loadCustomer, saveReport } from './utils/reportStore.mjs'

const DIMENSIONS = [
  { key: 'business', label: 'Business understanding', max: 20 },
  { key: 'role', label: 'Role authenticity', max: 25 },
  { key: 'compliance', label: 'Compliance knowledge', max: 25 },
  { key: 'english', label: 'English clarity', max: 20 },
  { key: 'composure', label: 'Composure & credibility', max: 10 },
]

function sessionTotal(row, i) {
  return DIMENSIONS.reduce((s, d) => s + (row[`session${i}_${d.key}_score`] || 0), 0)
}

export default async (req) => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })
  let admin
  try { admin = getAdminClient() } catch (e) { return jsonResponse(500, { error: e.message }) }

  const caller = await resolveCaller(req, admin)
  if (caller.error) return jsonResponse(caller.status, { error: caller.error })
  if (!caller.isAdmin) return jsonResponse(403, { error: '仅管理员可生成此报告' })

  let body; try { body = await req.json() } catch { return jsonResponse(400, { error: 'Invalid JSON' }) }
  const customerId = String(body?.customerId || '').trim()
  if (!customerId) return jsonResponse(400, { error: 'customerId 必填' })

  const { customer, error: cErr } = await loadCustomer(admin, customerId)
  if (cErr) return jsonResponse(404, { error: cErr })

  const { data: scores, error: sErr } = await admin
    .from('ao_interview_scores').select('*').eq('customer_id', customerId).maybeSingle()
  if (sErr) return jsonResponse(500, { error: sErr.message })
  if (!scores) return jsonResponse(400, { error: 'AO 面试评分尚未录入' })
  if (!scores.session3_date) return jsonResponse(400, { error: '必须完成 3 次模拟面试并录入评分' })

  const totals = [1, 2, 3].map(i => sessionTotal(scores, i))

  const doc = createDoc()
  addHeader(doc, 'AO Interview Readiness Report', `Generated ${fmtDate(new Date())}`)

  sectionTitle(doc, '1. Customer & AO')
  kvLine(doc, 'Customer', customer.profiles?.full_name || customer.profiles?.email || '-')
  kvLine(doc, 'Customer ID', customer.id)
  kvLine(doc, 'AO Name', scores.ao_name || '-')
  kvLine(doc, 'Consultant', scores.consultant_name || '-')

  sectionTitle(doc, '2. Mock Interview Log')
  for (let i = 1; i <= 3; i++) {
    const d = scores[`session${i}_date`]
    const mode = scores[`session${i}_mode`]
    const dur = scores[`session${i}_duration_minutes`]
    bullet(doc, `Session ${i}: ${fmtDate(d)}  ·  ${dur || 45} min  ·  Mode: ${mode || '-'}`)
  }

  sectionTitle(doc, '3. Dimension Scores')
  doc.fontSize(10).fillColor('#333')
  doc.text(padR('Dimension', 32) + padR('S1', 6) + padR('S2', 6) + padR('S3', 6) + padR('Max', 6))
  for (const dim of DIMENSIONS) {
    const s1 = scores[`session1_${dim.key}_score`] ?? '-'
    const s2 = scores[`session2_${dim.key}_score`] ?? '-'
    const s3 = scores[`session3_${dim.key}_score`] ?? '-'
    doc.text(padR(dim.label, 32) + padR(String(s1), 6) + padR(String(s2), 6) + padR(String(s3), 6) + padR(String(dim.max), 6))
  }
  doc.fontSize(11).fillColor('#1B2A4A').moveDown(0.3)
  doc.text(padR('Total (of 100)', 32) + padR(String(totals[0]), 6) + padR(String(totals[1]), 6) + padR(String(totals[2]), 6) + padR('100', 6))

  if (scores.weaknesses_notes) {
    sectionTitle(doc, '4. Weaknesses & Improvements')
    doc.fontSize(10).fillColor('#333').text(scores.weaknesses_notes, { align: 'justify' })
  }

  sectionTitle(doc, '5. Final Verdict')
  const verdict = scores.final_verdict || (totals[2] >= 80 ? 'pass' : 'needs_more')
  const verdictColor = verdict === 'pass' ? '#1e7a3c' : verdict === 'fail' ? '#c33' : '#b8741a'
  doc.fontSize(11).fillColor(verdictColor).text(`Score ${totals[2]}/100  ·  Verdict: ${verdict.toUpperCase()}`)
  if (verdict === 'pass') {
    doc.fontSize(10).fillColor('#333').text('Meets the recommended ≥80 threshold. Proceed with Sponsor Licence submission.')
  }

  addSignature(doc, ['Evaluating Consultant'])
  addDisclaimer(doc)
  const pdfBuffer = await finalizeToBuffer(doc)

  try {
    const { filePath, fileName } = await saveReport(admin, {
      customerId, reportType: 'ao_interview_readiness', pdfBuffer,
      generatedBy: caller.callerId,
      metadata: { final_score: totals[2], verdict },
    })
    return jsonResponse(200, { ok: true, filePath, fileName })
  } catch (e) {
    return jsonResponse(500, { error: e.message })
  }
}

function padR(s, n) {
  const str = String(s)
  return str.length >= n ? str + ' ' : str + ' '.repeat(n - str.length)
}
