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

  const { data: docs, error: dErr } = await admin
    .from('customer_appendix_a').select('*').eq('customer_id', customerId)
    .order('doc_code')
  if (dErr) return jsonResponse(500, { error: dErr.message })

  if (!docs || docs.length === 0) {
    return jsonResponse(400, { error: 'Appendix A 清单尚未初始化' })
  }

  const mandatory = docs.filter(d => d.is_mandatory !== false)
  const notVerified = mandatory.filter(d => d.status !== 'verified')
  if (notVerified.length > 0) {
    return jsonResponse(400, {
      error: `尚有 ${notVerified.length} 份必须文件未核验：${notVerified.map(d => d.doc_code).join(', ')}`,
    })
  }

  const doc = createDoc()
  addHeader(doc, 'Appendix A Readiness Report', `Generated ${fmtDate(new Date())}`)

  sectionTitle(doc, '1. Customer')
  kvLine(doc, 'Name', customer.profiles?.full_name || customer.profiles?.email || '-')
  kvLine(doc, 'Customer ID', customer.id)
  kvLine(doc, 'Service Type', customer.service_type)

  sectionTitle(doc, '2. Conclusion')
  bullet(doc, 'All mandatory Appendix A documents verified and on file.', '#1e7a3c')
  bullet(doc, 'Satisfies UKVI Appendix A requirements and is ready for solicitor review and submission.', '#1e7a3c')

  // Group by category
  const byCategory = {}
  for (const d of docs) {
    (byCategory[d.category] = byCategory[d.category] || []).push(d)
  }

  sectionTitle(doc, '3. Document Checklist')
  for (const cat of Object.keys(byCategory).sort()) {
    doc.moveDown(0.3)
    doc.fontSize(11).fillColor('#1B2A4A').text(`Category ${cat}`)
    for (const d of byCategory[cat]) {
      const tag = d.status === 'verified' ? '[VERIFIED]'
        : d.status === 'uploaded' ? '[UPLOADED]'
        : d.status === 'rejected' ? '[REJECTED]'
        : '[PENDING]'
      const exp = d.expiry_date ? ` · Expires ${fmtDate(d.expiry_date)}` : ''
      bullet(doc, `${d.doc_code}  ${d.doc_name}  ${tag}${exp}`,
        d.status === 'verified' ? '#1e7a3c' : '#c33')
    }
  }

  sectionTitle(doc, '4. Critical Document Expiry Check')
  for (const d of docs.filter(x => x.expiry_date)) {
    kvLine(doc, `${d.doc_code} ${d.doc_name}`, `Expires ${fmtDate(d.expiry_date)}`)
  }

  addSignature(doc, ['Readii Compliance Consultant'])
  addDisclaimer(doc)

  const pdfBuffer = await finalizeToBuffer(doc)
  try {
    const { filePath, fileName } = await saveReport(admin, {
      customerId, reportType: 'appendix_a_ready', pdfBuffer,
      generatedBy: caller.callerId,
      metadata: { total_docs: docs.length, verified: docs.filter(d => d.status === 'verified').length },
    })
    return jsonResponse(200, { ok: true, filePath, fileName })
  } catch (e) {
    return jsonResponse(500, { error: e.message })
  }
}
