import { createClient } from '@supabase/supabase-js'
import PDFDocument from 'pdfkit'

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const PHASE_TITLES = {
  1: 'Phase 1: Existing Employee Compliance Audit',
  2: 'Phase 2: Contract & Policy Documents',
  3: 'Phase 3: Payroll, Pension, HMRC, ICO',
  4: 'Phase 4: Recruitment & Onboarding',
}

function buildPDFBuffer({ customer, items, progressByItemId }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Header
    doc.fontSize(22).fillColor('#C9A84C').text('Readii', { continued: false })
    doc.moveDown(0.2)
    doc.fontSize(16).fillColor('#1B2A4A').text('HR Compliance Audit Report')
    doc.moveDown(0.5)

    doc.strokeColor('#cfcfcf').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.8)

    const fullName = customer.profiles?.full_name || customer.profiles?.email || '-'
    doc.fontSize(10).fillColor('#333')
      .text(`Customer: ${fullName}`)
      .text(`Customer ID: ${customer.id}`)
      .text(`Service Type: ${customer.service_type}`)
      .text(`Signed Date: ${customer.signed_date || '-'}`)
      .text(`Report Generated: ${new Date().toISOString().split('T')[0]}`)
    doc.moveDown(0.8)

    // Summary
    const totalItems = items.length
    const completedItems = items.filter(i => {
      const p = progressByItemId[i.id]
      return p?.status === 'completed' || p?.status === 'waived'
    }).length
    doc.fontSize(11).fillColor('#1B2A4A').text(`Overall Completion: ${completedItems} / ${totalItems}`, { underline: false })
    doc.moveDown(0.5)

    // Phase summary
    for (let phase = 1; phase <= 4; phase++) {
      const phaseItems = items.filter(i => i.phase_number === phase)
      const done = phaseItems.filter(i => {
        const p = progressByItemId[i.id]
        return p?.status === 'completed' || p?.status === 'waived'
      }).length
      doc.fontSize(10).fillColor('#333').text(`- ${PHASE_TITLES[phase]}: ${done}/${phaseItems.length}`)
    }
    doc.moveDown(1)

    // Detailed list per phase
    for (let phase = 1; phase <= 4; phase++) {
      doc.addPage()
      doc.fontSize(14).fillColor('#1B2A4A').text(PHASE_TITLES[phase])
      doc.moveDown(0.3)
      doc.strokeColor('#cfcfcf').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown(0.5)

      const phaseItems = items.filter(i => i.phase_number === phase).sort((a, b) => a.item_number.localeCompare(b.item_number))
      for (const item of phaseItems) {
        const p = progressByItemId[item.id]
        const status = p?.status || 'pending'
        const statusLabel = status === 'completed' ? '[DONE]'
          : status === 'waived' ? '[WAIVED]'
          : status === 'in_progress' ? '[IN PROGRESS]'
          : '[PENDING]'
        const completedDate = p?.completed_at ? p.completed_at.split('T')[0] : ''
        const completedBy = p?.completed_by || ''
        const evidenceMark = p?.evidence_file_name ? ' (evidence: ' + p.evidence_file_name + ')' : ''

        doc.fontSize(10).fillColor(status === 'completed' ? '#1e7a3c' : status === 'waived' ? '#556' : '#999')
          .text(`${item.item_number} ${statusLabel}${evidenceMark}`, { continued: false })
        doc.fontSize(9).fillColor('#333').text(`   Evidence type: ${item.evidence_type}`)
        if (item.compliance_basis) {
          doc.fontSize(8).fillColor('#666').text(`   Basis: ${item.compliance_basis}`)
        }
        if (completedDate) {
          doc.fontSize(8).fillColor('#666').text(`   Completed: ${completedDate}${completedBy ? ' by ' + completedBy : ''}`)
        }
        doc.moveDown(0.4)
      }
    }

    // Signature page
    doc.addPage()
    doc.fontSize(14).fillColor('#1B2A4A').text('Sign-Off')
    doc.moveDown(1)
    doc.fontSize(10).fillColor('#333')
      .text('Audit Lead: Readii Compliance Team')
      .text('Date: ' + new Date().toISOString().split('T')[0])
      .moveDown(2)
      .text('Readii Compliance Consultant: ___________________________')
      .moveDown(1.5)
      .text('Customer Acknowledgement: ___________________________')

    doc.moveDown(2)
    doc.fontSize(8).fillColor('#666').text(
      'Disclaimer: This report records the completion status of the 26-item HR compliance checklist ' +
      'as tracked on the Readii platform. It is intended as a supporting document for Sponsor Licence ' +
      'application preparation and does not constitute legal advice.',
      { align: 'justify' }
    )

    doc.end()
  })
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return json(500, { error: 'Server missing Supabase env' })

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: '缺少 Authorization token' })

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json(401, { error: '无效 token' })
  const callerId = userData.user.id

  // Caller must be admin OR the customer themselves (user_id on customer_profiles)
  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
  const customerId = String(body?.customerId || '').trim()
  if (!customerId) return json(400, { error: 'customerId 必填' })

  const { data: caller } = await admin
    .from('profiles').select('role, role_admin').eq('id', callerId).maybeSingle()
  const isAdmin = caller && (caller.role_admin === true || caller.role === 'admin')

  const { data: customer, error: cErr } = await admin
    .from('customer_profiles')
    .select('*, profiles:user_id(full_name, email)')
    .eq('id', customerId)
    .single()
  if (cErr || !customer) return json(404, { error: '未找到客户' })
  if (!isAdmin && customer.user_id !== callerId) return json(403, { error: '无权生成此客户报告' })

  const [{ data: items }, { data: progress }] = await Promise.all([
    admin.from('hr_compliance_items').select('*').order('phase_number').order('item_number'),
    admin.from('customer_hr_compliance').select('*').eq('customer_id', customerId),
  ])

  if (!items || items.length === 0) return json(400, { error: '未找到 HR 合规项目' })
  const progressByItemId = Object.fromEntries((progress || []).map(p => [p.item_id, p]))

  const notDone = items.filter(i => {
    const p = progressByItemId[i.id]
    return !(p?.status === 'completed' || p?.status === 'waived')
  })
  if (notDone.length > 0) {
    return json(400, { error: `尚有 ${notDone.length} 项未完成：${notDone.map(i => i.item_number).join(', ')}` })
  }

  const pdfBuffer = await buildPDFBuffer({ customer, items, progressByItemId })

  const ts = Date.now()
  const path = `${customerId}/hr_compliance_${ts}.pdf`
  const { error: upErr } = await admin.storage.from('reports').upload(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (upErr) return json(500, { error: `上传报告失败：${upErr.message}` })

  // Mark previous reports as not latest
  await admin.from('generated_reports')
    .update({ is_latest: false })
    .eq('customer_id', customerId)
    .eq('report_type', 'hr_compliance_audit')

  const fileName = `HR_Compliance_Report_${new Date().toISOString().split('T')[0]}.pdf`
  const { data: reportRow, error: insErr } = await admin.from('generated_reports').insert({
    customer_id: customerId,
    report_type: 'hr_compliance_audit',
    file_url: path,
    file_name: fileName,
    generated_by: callerId,
    is_latest: true,
    metadata: { total_items: items.length, completed_items: items.length },
  }).select().single()
  if (insErr) return json(500, { error: `写入 generated_reports 失败：${insErr.message}` })

  return json(200, { ok: true, reportId: reportRow.id, filePath: path, fileName })
}
