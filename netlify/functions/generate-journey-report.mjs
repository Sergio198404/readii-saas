import { createDoc, addHeader, sectionTitle, kvLine, bullet, addDisclaimer, finalizeToBuffer, fmtDate }
  from './utils/pdfReport.mjs'
import { jsonResponse, getAdminClient, resolveCaller, loadCustomer, saveReport } from './utils/reportStore.mjs'

const STATUS_LABEL = {
  pending: 'Pending',
  in_progress: 'In Progress',
  blocked_on_customer: 'Waiting on Customer',
  blocked_on_readii: 'Waiting on Readii',
  completed: 'Completed',
  skipped: 'Skipped',
}

export default async (req) => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })
  let admin
  try { admin = getAdminClient() } catch (e) { return jsonResponse(500, { error: e.message }) }

  const caller = await resolveCaller(req, admin)
  if (caller.error) return jsonResponse(caller.status, { error: caller.error })

  let body; try { body = await req.json() } catch { return jsonResponse(400, { error: 'Invalid JSON' }) }
  const customerId = String(body?.customerId || '').trim()
  if (!customerId) return jsonResponse(400, { error: 'customerId 必填' })

  const { customer, error: cErr } = await loadCustomer(admin, customerId)
  if (cErr) return jsonResponse(404, { error: cErr })
  if (!caller.isAdmin && customer.user_id !== caller.callerId) return jsonResponse(403, { error: '无权生成此客户报告' })

  const { data: template } = await admin.from('journey_templates')
    .select('*').eq('service_type', customer.service_type).eq('is_active', true).maybeSingle()
  if (!template) return jsonResponse(400, { error: 'Journey 模板未找到' })

  const [{ data: stages }, { data: progress }] = await Promise.all([
    admin.from('journey_stages').select('*').eq('template_id', template.id).order('stage_number'),
    admin.from('customer_journey_progress').select('*').eq('customer_id', customerId),
  ])

  const progressByStageId = Object.fromEntries((progress || []).map(p => [p.stage_id, p]))
  const customerStages = (stages || []).filter(s => progressByStageId[s.id])
  const completed = customerStages.filter(s => progressByStageId[s.id]?.status === 'completed')
  const inProgress = customerStages.filter(s => progressByStageId[s.id]?.status === 'in_progress')
  const pending = customerStages.filter(s => !progressByStageId[s.id]?.status || progressByStageId[s.id]?.status === 'pending')
  const blocked = customerStages.filter(s => ['blocked_on_customer','blocked_on_readii'].includes(progressByStageId[s.id]?.status))

  const pct = customerStages.length > 0
    ? Math.round((completed.length / customerStages.length) * 100)
    : 0

  const doc = createDoc()
  addHeader(doc, 'Journey Progress Report', `Generated ${fmtDate(new Date())}`)

  sectionTitle(doc, '1. Customer')
  kvLine(doc, 'Name', customer.profiles?.full_name || customer.profiles?.email || '-')
  kvLine(doc, 'Customer ID', customer.id)
  kvLine(doc, 'Service Type', customer.service_type)
  kvLine(doc, 'Visa Path', customer.visa_path || '-')
  kvLine(doc, 'Signed Date', fmtDate(customer.signed_date))

  sectionTitle(doc, '2. Progress Overview')
  kvLine(doc, 'Total Stages', String(customerStages.length))
  kvLine(doc, 'Completed', `${completed.length} (${pct}%)`)
  kvLine(doc, 'In Progress', String(inProgress.length))
  kvLine(doc, 'Blocked', String(blocked.length))
  kvLine(doc, 'Pending', String(pending.length))
  kvLine(doc, 'Expected Visa Approval', fmtDate(customer.expected_completion_date))

  if (inProgress.length > 0) {
    sectionTitle(doc, '3. Current Stage')
    for (const s of inProgress) {
      const p = progressByStageId[s.id]
      bullet(doc, `Stage ${s.stage_number} - ${s.stage_code || ''}`)
      if (p?.started_at) bullet(doc, `  Started: ${fmtDate(p.started_at)}`, '#666')
      if (p?.blocker_reason) bullet(doc, `  Blocker: ${p.blocker_reason}`, '#c33')
    }
  }

  if (completed.length > 0) {
    sectionTitle(doc, '4. Completed Stages')
    for (const s of completed) {
      const p = progressByStageId[s.id]
      bullet(doc, `Stage ${s.stage_number} [${s.stage_code || '-'}]  Completed ${fmtDate(p?.completed_at)}`, '#1e7a3c')
    }
  }

  if (blocked.length > 0) {
    sectionTitle(doc, '5. Blocked Stages')
    for (const s of blocked) {
      const p = progressByStageId[s.id]
      bullet(doc, `Stage ${s.stage_number} [${STATUS_LABEL[p?.status]}]  ${p?.blocker_reason || ''}`, '#c33')
    }
  }

  if (pending.length > 0) {
    sectionTitle(doc, '6. Upcoming Stages')
    for (const s of pending.slice(0, 12)) {
      bullet(doc, `Stage ${s.stage_number} - ${s.stage_code || ''}`, '#666')
    }
    if (pending.length > 12) bullet(doc, `... and ${pending.length - 12} more`, '#999')
  }

  sectionTitle(doc, '7. Key Time Windows')
  const hints = customer.timeline_hints || {}
  kvLine(doc, 'SL Expected Submit', hints.sl_expected_submit || '-')
  kvLine(doc, 'SL Expected Approval', hints.sl_expected_approval || '-')
  kvLine(doc, 'Visa Expected Submit', hints.visa_expected_submit || '-')
  kvLine(doc, 'Visa Expected Approval', hints.visa_expected_approval || '-')
  if (hints.tb_test_window_start) kvLine(doc, 'TB Test Window', `${hints.tb_test_window_start} to ${hints.tb_test_window_end}`)

  if (customer.warnings && Array.isArray(customer.warnings) && customer.warnings.length > 0) {
    sectionTitle(doc, '8. Risk Warnings')
    for (const w of customer.warnings) {
      bullet(doc, `[${w.severity}] ${w.code}`, w.severity === 'red' || w.severity === 'blocker' ? '#c33' : '#b8741a')
    }
  }

  addDisclaimer(doc)
  const pdfBuffer = await finalizeToBuffer(doc)

  try {
    const { filePath, fileName } = await saveReport(admin, {
      customerId, reportType: 'journey_progress', pdfBuffer,
      generatedBy: caller.callerId,
      metadata: { completed: completed.length, total: customerStages.length },
    })
    return jsonResponse(200, { ok: true, filePath, fileName })
  } catch (e) {
    return jsonResponse(500, { error: e.message })
  }
}
