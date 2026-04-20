import { supabase } from '../supabase'

export const REPORT_TYPES = [
  { key: 'journey_progress', label: 'Journey 进度报告', customerVisible: true },
  { key: 'hr_compliance_audit', label: 'HR 合规审计报告', customerVisible: true },
  { key: 'appendix_a_ready', label: 'Appendix A 就绪报告', customerVisible: false },
  { key: 'key_personnel_review', label: 'Key Personnel 审核报告', customerVisible: false },
  { key: 'ao_interview_readiness', label: 'AO 面试准备度报告', customerVisible: false },
  { key: 'applicant_interview_readiness', label: '工签申请人面试准备度报告', customerVisible: false },
  { key: 'monthly_operations', label: '月度运营合规报告', customerVisible: true },
]

const REPORT_ENDPOINTS = {
  journey_progress: '/.netlify/functions/generate-journey-report',
  hr_compliance_audit: '/.netlify/functions/generate-hr-report',
  appendix_a_ready: '/.netlify/functions/generate-appendix-report',
  key_personnel_review: '/.netlify/functions/generate-kp-report',
  ao_interview_readiness: '/.netlify/functions/generate-ao-report',
  applicant_interview_readiness: '/.netlify/functions/generate-applicant-report',
  monthly_operations: '/.netlify/functions/generate-monthly-report',
}

export async function listReportsForCustomer(customerId, { onlyLatest = false } = {}) {
  let q = supabase.from('generated_reports')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (onlyLatest) q = q.eq('is_latest', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function generateReport(reportType, customerId) {
  const endpoint = REPORT_ENDPOINTS[reportType]
  if (!endpoint) throw new Error(`未知报告类型: ${reportType}`)
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('未登录')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ customerId }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

export async function getReportSignedUrl(path, expiresIn = 600) {
  const { data, error } = await supabase.storage.from('reports').createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

// AO / Applicant interview scores API

export async function getAOScores(customerId) {
  const { data, error } = await supabase.from('ao_interview_scores')
    .select('*').eq('customer_id', customerId).maybeSingle()
  if (error) throw error
  return data
}

export async function upsertAOScores(row) {
  row.updated_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('ao_interview_scores')
    .upsert(row, { onConflict: 'customer_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getApplicantScores(customerId) {
  const { data, error } = await supabase.from('applicant_interview_scores')
    .select('*').eq('customer_id', customerId).maybeSingle()
  if (error) throw error
  return data
}

export async function upsertApplicantScores(row) {
  row.updated_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('applicant_interview_scores')
    .upsert(row, { onConflict: 'customer_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// Monthly operations data

export async function getMonthlyOperations(customerId) {
  const { data, error } = await supabase.from('customer_profiles')
    .select('monthly_operations_data').eq('id', customerId).single()
  if (error) throw error
  return data?.monthly_operations_data || []
}

export async function saveMonthlyOperations(customerId, array) {
  const { error } = await supabase.from('customer_profiles')
    .update({ monthly_operations_data: array }).eq('id', customerId)
  if (error) throw error
}
