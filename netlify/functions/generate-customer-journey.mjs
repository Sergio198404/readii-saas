import { createClient } from '@supabase/supabase-js'
import { runRuleEngine, stageCodeToNumber } from '../../src/lib/journeyRuleEngine.js'

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return json(500, { error: 'Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: '缺少 Authorization token' })

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json(401, { error: '无效 token' })
  const callerId = userData.user.id

  const { data: callerProfile, error: profErr } = await admin
    .from('profiles')
    .select('role, role_admin')
    .eq('id', callerId)
    .maybeSingle()
  if (profErr) return json(500, { error: `读取调用方 profile 失败：${profErr.message}` })
  if (!callerProfile || (callerProfile.role !== 'admin' && !callerProfile.role_admin)) {
    return json(403, { error: '仅管理员可生成 Journey' })
  }

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
  const customerId = String(body?.customerId || '').trim()
  if (!customerId) return json(400, { error: 'customerId 必填' })

  // 1. Load customer_profile with questionnaire answers
  const { data: customer, error: cErr } = await admin
    .from('customer_profiles')
    .select('*')
    .eq('id', customerId)
    .single()
  if (cErr) return json(404, { error: `未找到客户：${cErr.message}` })

  const required = ['employee_location', 'employee_nationality', 'current_visa_remaining_months',
    'employee_english_status', 'target_soc_code', 'startup_capital',
    'company_structure', 'ao_candidate']
  const missing = required.filter(k => customer[k] === null || customer[k] === undefined || customer[k] === '')
  if (missing.length > 0) {
    return json(400, { error: `问卷未填写完整，缺少字段：${missing.join(', ')}` })
  }

  // 2. Run rule engine
  const { visa_path, stages, warnings, timelineHints, requires_tb_test } = runRuleEngine({
    ...customer,
    signed_date: customer.signed_date,
  })

  // 3. Find journey_template for this service_type
  const { data: template, error: tErr } = await admin
    .from('journey_templates')
    .select('*')
    .eq('service_type', customer.service_type)
    .eq('is_active', true)
    .maybeSingle()
  if (tErr) return json(500, { error: `读取 journey_templates 失败：${tErr.message}` })
  if (!template) return json(400, { error: `未找到 ${customer.service_type} 的激活模板` })

  // 4. Load journey_stages for the template (with stage_code), keyed by stage_number/code
  const { data: templateStages, error: sErr } = await admin
    .from('journey_stages')
    .select('id, stage_number, stage_code')
    .eq('template_id', template.id)
    .order('stage_number')
  if (sErr) return json(500, { error: `读取 journey_stages 失败：${sErr.message}` })

  const stagesByNumber = Object.fromEntries((templateStages || []).map(s => [s.stage_number, s]))
  const stagesByCode = Object.fromEntries((templateStages || []).filter(s => s.stage_code).map(s => [s.stage_code, s]))

  // Load all variants for this template's stages so we can resolve variant_code → variant.id
  const stageIds = (templateStages || []).map(s => s.id)
  const { data: variantRows, error: vErr } = stageIds.length
    ? await admin.from('stage_variants').select('id, stage_id, variant_code').in('stage_id', stageIds)
    : { data: [], error: null }
  if (vErr) return json(500, { error: `读取 stage_variants 失败：${vErr.message}` })
  const variantLookup = {}
  for (const v of (variantRows || [])) {
    variantLookup[`${v.stage_id}::${v.variant_code}`] = v.id
  }

  // 5. Build rows for customer_journey_progress
  const progressRows = []
  const skippedCodes = []
  for (const s of stages) {
    const templateStage = stagesByCode[s.stage_code] || stagesByNumber[stageCodeToNumber(s.stage_code)]
    if (!templateStage) { skippedCodes.push(s.stage_code); continue }
    const variantId = s.variant ? variantLookup[`${templateStage.id}::${s.variant}`] || null : null
    progressRows.push({
      customer_id: customerId,
      stage_id: templateStage.id,
      status: 'pending',
      selected_variant: s.variant,
      selected_variant_id: variantId,
    })
  }

  // 6. Reset existing progress for this customer (re-generation scenario)
  const { error: delErr } = await admin
    .from('customer_journey_progress')
    .delete()
    .eq('customer_id', customerId)
  if (delErr) return json(500, { error: `清空旧进度失败：${delErr.message}` })

  if (progressRows.length > 0) {
    const { error: insErr } = await admin
      .from('customer_journey_progress')
      .insert(progressRows)
    if (insErr) return json(500, { error: `写入进度失败：${insErr.message}` })
  }

  // 7. Update customer_profile computed fields
  const { error: updErr } = await admin
    .from('customer_profiles')
    .update({
      questionnaire_completed: true,
      questionnaire_completed_at: new Date().toISOString(),
      questionnaire_completed_by: callerId,
      visa_path,
      requires_tb_test,
      warnings,
      timeline_hints: timelineHints,
      expected_completion_date: timelineHints.visa_expected_approval || null,
      current_stage_id: null,
    })
    .eq('id', customerId)
  if (updErr) return json(500, { error: `更新 customer_profile 失败：${updErr.message}` })

  return json(200, {
    ok: true,
    stageCount: progressRows.length,
    plannedCount: stages.length,
    skippedCodes,
    warnings,
    visa_path,
  })
}
