import { createDoc, addHeader, sectionTitle, kvLine, bullet, addDisclaimer, addSignature, finalizeToBuffer, fmtDate }
  from './utils/pdfReport.mjs'
import { jsonResponse, getAdminClient, resolveCaller, loadCustomer, saveReport } from './utils/reportStore.mjs'

const DIMENSIONS = [
  { key: 'consistency', label: 'Information consistency', max: 25 },
  { key: 'job', label: 'Job understanding', max: 25 },
  { key: 'employer', label: 'Employer relationship credibility', max: 20 },
  { key: 'lifestyle', label: 'UK lifestyle readiness', max: 15 },
  { key: 'english', label: 'English expression', max: 15 },
]

function sessionTotal(row, i) {
  return DIMENSIONS.reduce((s, d) => s + (row[`session${i}_${d.key}_score`] || 0), 0)
}

function padR(s, n) {
  const str = String(s)
  return str.length >= n ? str + ' ' : str + ' '.repeat(n - str.length)
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
    .from('applicant_interview_scores').select('*').eq('customer_id', customerId).maybeSingle()
  if (sErr) return jsonResponse(500, { error: sErr.message })
  if (!scores) return jsonResponse(400, { error: '申请人面试评分尚未录入' })
  if (!scores.session2_date) return jsonResponse(400, { error: '必须完成 2 次模拟面试并录入评分' })

  const totals = [1, 2].map(i => sessionTotal(scores, i))

  const doc = createDoc()
  addHeader(doc, 'Applicant Interview Readiness Report', `Generated ${fmtDate(new Date())}`)

  sectionTitle(doc, '1. Customer & Applicant')
  kvLine(doc, 'Customer', customer.profiles?.full_name || customer.profiles?.email || '-')
  kvLine(doc, 'Customer ID', customer.id)
  kvLine(doc, 'Applicant', scores.applicant_name || '-')
  kvLine(doc, 'Consultant', scores.consultant_name || '-')

  sectionTitle(doc, '2. Mock Interview Log')
  for (let i = 1; i <= 2; i++) {
    bullet(doc, `Session ${i}: ${fmtDate(scores[`session${i}_date`])}  ·  ${scores[`session${i}_duration_minutes`] || 45} min  ·  Mode: ${scores[`session${i}_mode`] || '-'}`)
  }

  sectionTitle(doc, '3. Dimension Scores')
  doc.fontSize(10).fillColor('#333')
  doc.text(padR('Dimension', 34) + padR('S1', 6) + padR('S2', 6) + padR('Max', 6))
  for (const dim of DIMENSIONS) {
    const s1 = scores[`session1_${dim.key}_score`] ?? '-'
    const s2 = scores[`session2_${dim.key}_score`] ?? '-'
    doc.text(padR(dim.label, 34) + padR(String(s1), 6) + padR(String(s2), 6) + padR(String(dim.max), 6))
  }
  doc.fontSize(11).fillColor('#1B2A4A').moveDown(0.3)
  doc.text(padR('Total (of 100)', 34) + padR(String(totals[0]), 6) + padR(String(totals[1]), 6) + padR('100', 6))

  if (scores.special_notes) {
    sectionTitle(doc, '4. Special Notes (Self-Employment Scenario)')
    doc.fontSize(10).fillColor('#333').text(scores.special_notes, { align: 'justify' })
  }

  sectionTitle(doc, '5. Final Verdict')
  const verdict = scores.final_verdict || (totals[1] >= 80 ? 'pass' : 'needs_more')
  const verdictColor = verdict === 'pass' ? '#1e7a3c' : verdict === 'fail' ? '#c33' : '#b8741a'
  doc.fontSize(11).fillColor(verdictColor).text(`Score ${totals[1]}/100  ·  Verdict: ${verdict.toUpperCase()}`)
  if (verdict === 'pass') {
    doc.fontSize(10).fillColor('#333').text('Meets the recommended ≥80 threshold. Proceed with Skilled Worker visa submission.')
  }

  addSignature(doc, ['Evaluating Consultant'])
  addDisclaimer(doc)
  const pdfBuffer = await finalizeToBuffer(doc)

  try {
    const { filePath, fileName } = await saveReport(admin, {
      customerId, reportType: 'applicant_interview_readiness', pdfBuffer,
      generatedBy: caller.callerId,
      metadata: { final_score: totals[1], verdict },
    })
    return jsonResponse(200, { ok: true, filePath, fileName })
  } catch (e) {
    return jsonResponse(500, { error: e.message })
  }
}
