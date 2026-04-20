import { supabase } from '../supabase'

export async function getCustomerDashboard() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: customer, error: customerError } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (customerError) throw new Error(customerError.message)
  if (!customer) return null

  let template = null
  let stages = []
  let progress = []

  if (customer.service_type) {
    const { data: templateData } = await supabase
      .from('journey_templates')
      .select('*')
      .eq('service_type', customer.service_type)
      .eq('is_active', true)
      .maybeSingle()

    if (templateData) {
      template = templateData

      const [{ data: stagesData }, { data: progressData }] = await Promise.all([
        supabase
          .from('journey_stages')
          .select('*')
          .eq('template_id', template.id)
          .order('stage_number', { ascending: true }),
        supabase
          .from('customer_journey_progress')
          .select('*')
          .eq('customer_id', customer.id),
      ])

      stages = stagesData || []
      progress = progressData || []
    }
  }

  const [{ data: recentDocs }, { data: upcomingMeetings }, { data: recentQa }] = await Promise.all([
    supabase
      .from('customer_documents')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('is_visible_to_customer', true)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('customer_meetings')
      .select('*')
      .eq('customer_id', customer.id)
      .in('status', ['scheduled', 'confirmed'])
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(3),
    supabase
      .from('customer_qa')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    customer,
    template,
    stages,
    progress,
    recentDocs: recentDocs || [],
    upcomingMeetings: upcomingMeetings || [],
    recentQa: recentQa || [],
  }
}

export function getCurrentStageDetails(dashboardData) {
  const { customer, stages } = dashboardData
  if (!customer.current_stage_id) return stages[0] || null
  return stages.find(s => s.id === customer.current_stage_id) || null
}

export function calculateProgress(stages, progress) {
  if (stages.length === 0) return 0
  const completed = progress.filter(p => p.status === 'completed').length
  return Math.round((completed / stages.length) * 100)
}

const SERVICE_LABELS = {
  sw_self_sponsored: '自雇工签全案',
  innovator_founder: '创新签陪跑',
  expansion_worker: '拓展工签',
  general_consulting: '综合咨询',
}

export function getServiceTypeLabel(type) {
  return SERVICE_LABELS[type] || type
}

// ═══ Journey: variants + service_mode ═══

export async function loadVariantsForStages(stageIds) {
  if (!stageIds.length) return []
  const { data, error } = await supabase
    .from('stage_variants')
    .select('*')
    .in('stage_id', stageIds)
  if (error) throw error
  return data || []
}

export async function setServiceMode(progressId, mode) {
  const patch = {
    service_mode: mode,
    service_mode_confirmed: true,
    service_mode_confirmed_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('customer_journey_progress')
    .update(patch)
    .eq('id', progressId)
    .select()
    .single()
  if (error) throw error
  return data
}
