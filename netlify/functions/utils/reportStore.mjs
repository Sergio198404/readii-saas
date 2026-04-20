// Shared helpers to authenticate, resolve customer, and persist generated reports.

import { createClient } from '@supabase/supabase-js'

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function resolveCaller(req, admin) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return { error: '缺少 Authorization token', status: 401 }
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return { error: '无效 token', status: 401 }
  const callerId = userData.user.id
  const { data: caller } = await admin
    .from('profiles').select('role, role_admin').eq('id', callerId).maybeSingle()
  const isAdmin = caller && (caller.role_admin === true || caller.role === 'admin')
  return { callerId, isAdmin }
}

export async function loadCustomer(admin, customerId) {
  const { data, error } = await admin
    .from('customer_profiles')
    .select('*, profiles:user_id(full_name, email)')
    .eq('id', customerId)
    .single()
  if (error) return { error: '未找到客户' }
  return { customer: data }
}

export const REPORT_FILE_NAMES = {
  journey_progress: 'Journey_Progress_Report',
  hr_compliance_audit: 'HR_Compliance_Report',
  appendix_a_ready: 'Appendix_A_Readiness_Report',
  key_personnel_review: 'Key_Personnel_Review_Report',
  ao_interview_readiness: 'AO_Interview_Readiness_Report',
  applicant_interview_readiness: 'Applicant_Interview_Readiness_Report',
  monthly_operations: 'Monthly_Operations_Report',
}

export async function saveReport(admin, { customerId, reportType, pdfBuffer, generatedBy, metadata }) {
  const ts = Date.now()
  const path = `${customerId}/${reportType}_${ts}.pdf`
  const { error: upErr } = await admin.storage.from('reports').upload(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (upErr) throw new Error(`上传报告失败：${upErr.message}`)

  await admin.from('generated_reports')
    .update({ is_latest: false })
    .eq('customer_id', customerId)
    .eq('report_type', reportType)

  const datePart = new Date().toISOString().split('T')[0]
  const fileName = `${REPORT_FILE_NAMES[reportType] || reportType}_${datePart}.pdf`

  const { data: row, error: insErr } = await admin.from('generated_reports').insert({
    customer_id: customerId,
    report_type: reportType,
    file_url: path,
    file_name: fileName,
    generated_by: generatedBy || null,
    is_latest: true,
    metadata: metadata || null,
  }).select().single()
  if (insErr) throw new Error(`写入 generated_reports 失败：${insErr.message}`)

  return { reportId: row.id, filePath: path, fileName }
}
