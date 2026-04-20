import { createDoc, addHeader, sectionTitle, kvLine, bullet, addDisclaimer, finalizeToBuffer, fmtDate, fmtGBP }
  from './utils/pdfReport.mjs'
import { jsonResponse, getAdminClient, resolveCaller, loadCustomer, saveReport } from './utils/reportStore.mjs'

function isLastDayOfMonth(d = new Date()) {
  const tomorrow = new Date(d)
  tomorrow.setDate(d.getDate() + 1)
  return tomorrow.getMonth() !== d.getMonth()
}

function monthKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

async function generateForCustomer(admin, customer, triggeredBy) {
  const monthlyData = Array.isArray(customer.monthly_operations_data) ? customer.monthly_operations_data : []
  if (monthlyData.length === 0) {
    return { skipped: true, reason: `${customer.id}: monthly_operations_data 为空` }
  }
  const latest = monthlyData[monthlyData.length - 1]
  const cumRevenue = monthlyData.reduce((s, m) => s + (Number(m.revenue) || 0), 0)
  const cumPaye = monthlyData.reduce((s, m) => s + (Number(m.paye_amount) || 0), 0)

  const doc = createDoc()
  addHeader(doc, 'Monthly Operations Report', `Period: ${latest.month}`)

  sectionTitle(doc, '1. Company')
  kvLine(doc, 'Customer', customer.profiles?.full_name || customer.profiles?.email || '-')
  kvLine(doc, 'Customer ID', customer.id)
  kvLine(doc, 'Report Period', latest.month)
  kvLine(doc, 'Generated', fmtDate(new Date()))

  sectionTitle(doc, '2. Core Financial Metrics')
  doc.fontSize(10).fillColor('#333')
  kvLine(doc, 'Revenue (month)', fmtGBP(latest.revenue))
  kvLine(doc, 'Revenue (cumulative)', fmtGBP(cumRevenue))
  kvLine(doc, 'Bank balance (month-end)', fmtGBP(latest.bank_balance))
  kvLine(doc, 'PAYE declared (month)', fmtGBP(latest.paye_amount))
  kvLine(doc, 'PAYE declared (cumulative)', fmtGBP(cumPaye))
  kvLine(doc, 'Employees', String(latest.employees ?? '-'))

  sectionTitle(doc, '3. Sponsor Licence Compliance Snapshot')
  bullet(doc, `Sponsor Licence status: ${latest.sl_status || 'In progress'}`)
  bullet(doc, `SMS reporting this month: ${latest.sms_required ? 'REQUIRED' : 'No new reports required'}`)
  bullet(doc, 'Right to Work: all employees verified (manual attestation)')
  bullet(doc, 'Work records archived: attendance + monthly reports')
  bullet(doc, 'Payroll: paid on time and meets going rate (manual attestation)')

  sectionTitle(doc, '4. Compliance Actions Completed This Month')
  const actions = latest.actions_completed || ['PAYE RTI monthly filing', 'Bank statement uploaded', 'Employee monthly report collected']
  for (const a of actions) bullet(doc, a)

  sectionTitle(doc, '5. Revenue Milestones')
  const ms = latest.milestones || [
    { label: 'Month 3', target: 30000, current: cumRevenue },
    { label: 'Month 6', target: 100000, current: cumRevenue },
    { label: 'Month 9', target: 150000, current: cumRevenue },
  ]
  for (const m of ms) {
    const pct = m.target ? Math.round((m.current || 0) / m.target * 100) : 0
    const hit = (m.current || 0) >= m.target
    bullet(doc, `${m.label}: target ${fmtGBP(m.target)}, current ${fmtGBP(m.current || 0)} (${pct}%) ${hit ? '[ACHIEVED]' : ''}`,
      hit ? '#1e7a3c' : '#333')
  }

  if (latest.risks && latest.risks.length > 0) {
    sectionTitle(doc, '6. Risk Alerts')
    for (const r of latest.risks) bullet(doc, r, '#c33')
  } else {
    sectionTitle(doc, '6. Risk Alerts')
    bullet(doc, 'No risks flagged this month.', '#1e7a3c')
  }

  if (latest.next_month_todos && latest.next_month_todos.length > 0) {
    sectionTitle(doc, '7. Priorities for Next Month')
    for (const t of latest.next_month_todos) bullet(doc, t)
  }

  if (latest.readii_summary) {
    sectionTitle(doc, '8. Readii Consultant Summary')
    doc.fontSize(10).fillColor('#333').text(latest.readii_summary, { align: 'justify' })
  }

  addDisclaimer(doc,
    'Disclaimer: Financial figures are based on information provided by the customer and do not replace professional accounting advice. Readii Limited, readii.co.uk, Canterbury UK.')

  const pdfBuffer = await finalizeToBuffer(doc)
  const { filePath, fileName } = await saveReport(admin, {
    customerId: customer.id,
    reportType: 'monthly_operations',
    pdfBuffer,
    generatedBy: triggeredBy,
    metadata: { month: latest.month, revenue: latest.revenue },
  })
  return { filePath, fileName, month: latest.month }
}

export default async (req) => {
  let admin
  try { admin = getAdminClient() } catch (e) { return jsonResponse(500, { error: e.message }) }

  // Scheduled call: no auth header; run for all eligible customers on last day of month
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  if (!authHeader) {
    if (!isLastDayOfMonth()) {
      return jsonResponse(200, { ok: true, skipped: 'not last day of month' })
    }
    const { data: customers } = await admin
      .from('customer_profiles')
      .select('*, profiles:user_id(full_name, email)')
      .eq('needs_mentoring', true)
      .eq('status', 'active')
    const results = []
    for (const c of customers || []) {
      try {
        results.push(await generateForCustomer(admin, c, null))
      } catch (e) {
        results.push({ customerId: c.id, error: e.message })
      }
    }
    return jsonResponse(200, { ok: true, month: monthKey(), processed: results.length, results })
  }

  // Manual call: require admin + customerId
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })
  const caller = await resolveCaller(req, admin)
  if (caller.error) return jsonResponse(caller.status, { error: caller.error })
  if (!caller.isAdmin) return jsonResponse(403, { error: '仅管理员可手动触发' })

  let body; try { body = await req.json() } catch { return jsonResponse(400, { error: 'Invalid JSON' }) }
  const customerId = String(body?.customerId || '').trim()
  if (!customerId) return jsonResponse(400, { error: 'customerId 必填' })

  const { customer, error: cErr } = await loadCustomer(admin, customerId)
  if (cErr) return jsonResponse(404, { error: cErr })

  try {
    const result = await generateForCustomer(admin, customer, caller.callerId)
    if (result.skipped) return jsonResponse(400, { error: result.reason })
    return jsonResponse(200, { ok: true, ...result })
  } catch (e) {
    return jsonResponse(500, { error: e.message })
  }
}

export const config = {
  schedule: '0 18 28-31 * *',
}
