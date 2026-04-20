import { supabase } from '../supabase'
import { attachProfile, attachProfiles } from './adminHelpers'

// ═══ Journey Templates ═══

export async function listJourneyTemplates() {
  const { data, error } = await supabase
    .from('journey_templates')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createJourneyTemplate(row) {
  const { data, error } = await supabase
    .from('journey_templates')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getJourneyTemplateWithStages(templateId) {
  const [{ data: template, error: tErr }, { data: stages, error: sErr }] = await Promise.all([
    supabase.from('journey_templates').select('*').eq('id', templateId).single(),
    supabase.from('journey_stages').select('*').eq('template_id', templateId).order('stage_number'),
  ])
  if (tErr) throw tErr
  return { template, stages: stages || [] }
}

export async function updateJourneyStage(stageId, updates) {
  const { data, error } = await supabase
    .from('journey_stages')
    .update({ ...updates })
    .eq('id', stageId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createJourneyStage(templateId, stageData) {
  const { data, error } = await supabase
    .from('journey_stages')
    .insert({ ...stageData, template_id: templateId })
    .select()
    .single()
  if (error) throw error
  // Update template total_stages count
  const { data: stages } = await supabase
    .from('journey_stages')
    .select('id')
    .eq('template_id', templateId)
  if (stages) {
    await supabase.from('journey_templates').update({ total_stages: stages.length }).eq('id', templateId)
  }
  return data
}

export async function deleteJourneyStage(stageId, templateId) {
  const { error } = await supabase.from('journey_stages').delete().eq('id', stageId)
  if (error) throw error
  if (templateId) {
    const { data: stages } = await supabase.from('journey_stages').select('id').eq('template_id', templateId)
    if (stages) {
      await supabase.from('journey_templates').update({ total_stages: stages.length }).eq('id', templateId)
    }
  }
}

// ═══ Customer Progress ═══

export async function listCustomerProfiles() {
  const { data: customers, error } = await supabase
    .from('customer_profiles')
    .select('id, user_id, service_type, signed_date, status, questionnaire_completed, employee_location')
    .order('created_at', { ascending: false })
  if (error) throw error
  return attachProfiles(supabase, customers)
}

export async function getCustomerProgress(customerId) {
  const { data: customerRaw, error: cErr } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('id', customerId)
    .single()
  if (cErr) throw cErr
  const customer = await attachProfile(supabase, customerRaw)

  const { data: template } = await supabase
    .from('journey_templates')
    .select('*')
    .eq('service_type', customer.service_type)
    .eq('is_active', true)
    .maybeSingle()

  let stages = []
  let progress = []
  if (template) {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('journey_stages').select('*').eq('template_id', template.id).order('stage_number'),
      supabase.from('customer_journey_progress').select('*').eq('customer_id', customerId),
    ])
    stages = s || []
    progress = p || []
  }

  return { customer, template, stages, progress }
}

export async function updateStageProgress(customerId, stageId, update) {
  const { data: existing } = await supabase
    .from('customer_journey_progress')
    .select('*')
    .eq('customer_id', customerId)
    .eq('stage_id', stageId)
    .maybeSingle()

  const now = new Date().toISOString()

  if (existing) {
    const patch = { ...update, updated_at: now }
    if (update.status === 'in_progress' && !existing.started_at) patch.started_at = now
    if (update.status === 'completed' && !existing.completed_at) patch.completed_at = now
    const { data, error } = await supabase
      .from('customer_journey_progress')
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const row = { customer_id: customerId, stage_id: stageId, ...update }
    if (update.status === 'in_progress') row.started_at = now
    if (update.status === 'completed') { row.started_at = now; row.completed_at = now }
    const { data, error } = await supabase
      .from('customer_journey_progress')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function syncCurrentStage(customerId, stages, progress) {
  const progressMap = Object.fromEntries((progress || []).map(p => [p.stage_id, p]))
  const inProgressStage = stages.find(s => progressMap[s.id]?.status === 'in_progress')
  const currentStageId = inProgressStage?.id || null
  await supabase.from('customer_profiles').update({ current_stage_id: currentStageId }).eq('id', customerId)
}

// ═══ Stage Variants ═══

export async function listStageVariants(stageId) {
  const { data, error } = await supabase
    .from('stage_variants')
    .select('*')
    .eq('stage_id', stageId)
    .order('variant_code')
  if (error) throw error
  return data || []
}

export async function createStageVariant(stageId, row) {
  const { data, error } = await supabase
    .from('stage_variants')
    .insert({ ...row, stage_id: stageId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStageVariant(variantId, updates) {
  const { data, error } = await supabase
    .from('stage_variants')
    .update(updates)
    .eq('id', variantId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteStageVariant(variantId) {
  const { error } = await supabase.from('stage_variants').delete().eq('id', variantId)
  if (error) throw error
}

// ═══ Customer Questionnaire ═══

export async function getCustomerQuestionnaire(customerId) {
  const { data: raw, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('id', customerId)
    .single()
  if (error) throw error
  return { customer: await attachProfile(supabase, raw) }
}

const QUESTIONNAIRE_FIELDS = [
  'employee_location', 'employee_nationality', 'current_visa_remaining_months',
  'employee_english_status', 'target_soc_code', 'requires_criminal_record',
  'countries_lived', 'startup_capital', 'company_structure', 'ao_candidate',
  'needs_mentoring',
]

export async function saveQuestionnaireDraft(customerId, answers) {
  const patch = {}
  for (const f of QUESTIONNAIRE_FIELDS) {
    if (answers[f] !== undefined) patch[f] = answers[f]
  }
  patch.updated_at = new Date().toISOString()
  const { error } = await supabase
    .from('customer_profiles')
    .update(patch)
    .eq('id', customerId)
  if (error) throw error
}

export async function generateCustomerJourney(customerId) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('未登录')
  const res = await fetch('/.netlify/functions/generate-customer-journey', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ customerId }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}
