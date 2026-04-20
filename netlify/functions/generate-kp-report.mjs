import { createDoc, addHeader, sectionTitle, kvLine, bullet, addDisclaimer, addSignature, finalizeToBuffer, fmtDate }
  from './utils/pdfReport.mjs'
import { jsonResponse, getAdminClient, resolveCaller, loadCustomer, saveReport } from './utils/reportStore.mjs'

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

  const { data: reviews, error: rErr } = await admin
    .from('key_personnel_reviews').select('*').eq('customer_id', customerId)
  if (rErr) return jsonResponse(500, { error: rErr.message })
  if (!reviews || reviews.length === 0) {
    return jsonResponse(400, { error: 'Key Personnel 审核记录为空' })
  }

  const notPassed = reviews.filter(r => r.review_status !== 'passed')
  if (notPassed.length > 0) {
    return jsonResponse(400, {
      error: `尚有 ${notPassed.length} 位 Key Personnel 审核未通过：${notPassed.map(r => r.person_name).join(', ')}`,
    })
  }

  const doc = createDoc()
  addHeader(doc, 'Key Personnel Review Report', `Generated ${fmtDate(new Date())}`)

  sectionTitle(doc, '1. Customer')
  kvLine(doc, 'Company / Customer', customer.profiles?.full_name || customer.profiles?.email || '-')
  kvLine(doc, 'Customer ID', customer.id)

  sectionTitle(doc, '2. Conclusion')
  bullet(doc, `All ${reviews.length} Key Personnel passed the Readii compliance review.`, '#1e7a3c')

  sectionTitle(doc, '3. Personnel Details')
  for (const r of reviews) {
    doc.moveDown(0.4)
    doc.fontSize(11).fillColor('#1B2A4A').text(`${r.person_name}`)
    doc.fontSize(9).fillColor('#666').text(`Roles: ${(r.roles || []).join(', ')}`)
    kvLine(doc, 'UK Settled Status', r.uk_settled_status || '-')
    kvLine(doc, 'DBS Check', `${r.dbs_check_result || 'n/a'}${r.dbs_check_date ? ' on ' + fmtDate(r.dbs_check_date) : ''}`)
    kvLine(doc, 'Bankruptcy Clear', r.bankruptcy_check_clear ? 'Yes' : 'No')
    kvLine(doc, 'Debt Relief Clear', r.debt_relief_check_clear ? 'Yes' : 'No')
    kvLine(doc, 'Director Disqualification Clear', r.director_disqualified_check_clear ? 'Yes' : 'No')
    kvLine(doc, 'Historic Sponsor Check Clear', r.historic_sponsor_check_clear ? 'Yes' : 'No')
    if ((r.roles || []).includes('level1_user')) {
      kvLine(doc, 'Employment Verified (Level 1)', r.employment_verified ? 'Yes' : 'No')
    }
    kvLine(doc, 'Review Status', r.review_status)
    kvLine(doc, 'Reviewed On', fmtDate(r.reviewed_at))
    if (r.notes) doc.fontSize(9).fillColor('#666').text(`Notes: ${r.notes}`)
  }

  addSignature(doc, ['Readii Compliance Consultant'])
  addDisclaimer(doc)
  const pdfBuffer = await finalizeToBuffer(doc)

  try {
    const { filePath, fileName } = await saveReport(admin, {
      customerId, reportType: 'key_personnel_review', pdfBuffer,
      generatedBy: caller.callerId,
      metadata: { personnel_count: reviews.length },
    })
    return jsonResponse(200, { ok: true, filePath, fileName })
  } catch (e) {
    return jsonResponse(500, { error: e.message })
  }
}
