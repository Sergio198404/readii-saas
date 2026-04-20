import { supabase } from '../supabase'

export const HR_BUCKET = 'hr-compliance-docs'

export async function listHRItems() {
  const { data, error } = await supabase
    .from('hr_compliance_items')
    .select('*')
    .order('phase_number')
    .order('item_number')
  if (error) throw error
  return data || []
}

export async function getCustomerHRProgress(customerId) {
  const { data, error } = await supabase
    .from('customer_hr_compliance')
    .select('*')
    .eq('customer_id', customerId)
  if (error) throw error
  return data || []
}

// Ensure a progress row exists for every HR item for this customer.
// Called on first page load; no-op on subsequent loads.
export async function ensureHRProgressInit(customerId) {
  const [{ data: items }, { data: progress }] = await Promise.all([
    supabase.from('hr_compliance_items').select('id, item_code'),
    supabase.from('customer_hr_compliance').select('item_id').eq('customer_id', customerId),
  ])
  const existingItemIds = new Set((progress || []).map(p => p.item_id))
  const missing = (items || []).filter(i => !existingItemIds.has(i.id))
  if (missing.length === 0) return
  const rows = missing.map(i => ({ customer_id: customerId, item_id: i.id, status: 'pending' }))
  const { error } = await supabase.from('customer_hr_compliance').insert(rows)
  if (error) throw error
}

export async function updateHRProgress(progressId, patch) {
  const next = { ...patch, updated_at: new Date().toISOString() }
  if (patch.status === 'completed' && !patch.completed_at) next.completed_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('customer_hr_compliance')
    .update(next)
    .eq('id', progressId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uploadHREvidence(customerId, itemCode, file) {
  const ts = Date.now()
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${customerId}/${itemCode}/${ts}_${safe}`
  const { error: upErr } = await supabase.storage.from(HR_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (upErr) throw upErr
  return { path, fileName: file.name }
}

export async function getHREvidenceSignedUrl(path, expiresIn = 300) {
  const { data, error } = await supabase.storage.from(HR_BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export async function deleteHREvidence(path) {
  const { error } = await supabase.storage.from(HR_BUCKET).remove([path])
  if (error) throw error
}

export async function getLatestHRReport(customerId) {
  const { data, error } = await supabase
    .from('generated_reports')
    .select('*')
    .eq('customer_id', customerId)
    .eq('report_type', 'hr_compliance_audit')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function generateHRReport(customerId) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('未登录')
  const res = await fetch('/.netlify/functions/generate-hr-report', {
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

export function groupByPhase(items, progress) {
  const progressByItemId = Object.fromEntries((progress || []).map(p => [p.item_id, p]))
  const phases = { 1: [], 2: [], 3: [], 4: [] }
  for (const item of items) {
    const p = progressByItemId[item.id]
    phases[item.phase_number].push({ item, progress: p })
  }
  return phases
}

export function isPhaseUnlocked(phaseNum, phases) {
  if (phaseNum === 1) return true
  const prev = phases[phaseNum - 1] || []
  if (prev.length === 0) return false
  return prev.every(({ progress }) => progress?.status === 'completed' || progress?.status === 'waived')
}

export function isAllCompleted(items, progress) {
  const byItem = Object.fromEntries((progress || []).map(p => [p.item_id, p]))
  return items.length > 0 && items.every(i => {
    const p = byItem[i.id]
    return p?.status === 'completed' || p?.status === 'waived'
  })
}
