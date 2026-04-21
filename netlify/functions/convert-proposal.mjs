import { createClient } from '@supabase/supabase-js'

const TEMP_PASSWORD = 'Readii2025!'

// Map proposal service_type → customer_profiles.service_type
// (schemas use different vocabularies; fall back to general_consulting)
const SERVICE_TYPE_MAP = {
  sw_self_sponsored: 'sw_self_sponsored',
  ifv_innovator: 'innovator_founder',
  ew_expansion: 'expansion_worker',
  gt_global_talent: 'general_consulting',
  plan_b: 'general_consulting',
}

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
  if (!url || !serviceKey) return json(500, { error: 'Server missing SUPABASE env' })

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const callerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!callerToken) return json(401, { error: '缺少 Authorization token' })

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(callerToken)
  if (userErr || !userData?.user) return json(401, { error: '无效 token' })
  const callerId = userData.user.id

  const { data: callerProfile } = await admin.from('profiles')
    .select('role, role_admin').eq('id', callerId).maybeSingle()
  if (!callerProfile || (callerProfile.role !== 'admin' && !callerProfile.role_admin)) {
    return json(403, { error: '仅管理员可转为客户' })
  }

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }

  const proposalToken = String(body?.proposal_token || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()
  const fullName = String(body?.full_name || '').trim()

  if (!proposalToken) return json(400, { error: 'proposal_token 必填' })
  if (!email) return json(400, { error: 'email 必填' })
  if (!fullName) return json(400, { error: 'full_name 必填' })

  const { data: proposal, error: propErr } = await admin
    .from('proposals')
    .select('id, status, service_type, service_price_pence, converted_customer_id')
    .eq('token', proposalToken)
    .maybeSingle()
  if (propErr || !proposal) return json(404, { error: '方案书不存在' })
  if (proposal.converted_customer_id) {
    return json(200, { ok: true, customer_id: proposal.converted_customer_id, already_converted: true })
  }

  // Try to find an existing profile by email first
  let userId
  const { data: existingByEmail } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const existingUser = (existingByEmail?.users || []).find(u => u.email?.toLowerCase() === email)

  if (existingUser) {
    userId = existingUser.id
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createErr) return json(400, { error: `创建账号失败：${createErr.message}` })
    userId = created.user?.id
    if (!userId) return json(500, { error: '创建账号后未返回 user id' })
  }

  // Ensure profile row exists with role_customer flag
  await admin.from('profiles').upsert({
    id: userId,
    full_name: fullName,
    role_customer: true,
    password_changed: existingUser ? undefined : false,
  }, { onConflict: 'id' })

  // Create customer_profiles row
  const mappedServiceType = SERVICE_TYPE_MAP[proposal.service_type] || 'general_consulting'
  const { data: customer, error: custErr } = await admin
    .from('customer_profiles')
    .insert({
      user_id: userId,
      service_type: mappedServiceType,
      signed_date: new Date().toISOString().slice(0, 10),
      status: 'active',
      total_contract_value_pence: proposal.service_price_pence || null,
    })
    .select('id')
    .single()
  if (custErr) return json(500, { error: `创建客户档案失败：${custErr.message}` })

  const { error: updErr } = await admin
    .from('proposals')
    .update({ status: 'converted', converted_customer_id: customer.id })
    .eq('id', proposal.id)
  if (updErr) return json(500, { error: `更新方案书失败：${updErr.message}` })

  return json(200, {
    ok: true,
    customer_id: customer.id,
    temp_password: existingUser ? null : TEMP_PASSWORD,
  })
}
