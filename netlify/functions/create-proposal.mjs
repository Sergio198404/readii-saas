import { createClient } from '@supabase/supabase-js'

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return json(500, { error: 'Server missing SUPABASE env' })

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: '缺少 Authorization token' })

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify the caller (using anon client with user token)
  const userClient = createClient(url, anonKey || serviceKey)
  const { data: userData, error: userErr } = await userClient.auth.getUser(token)
  if (userErr || !userData?.user) return json(401, { error: '无效 token' })
  const callerId = userData.user.id

  const { data: callerProfile } = await admin.from('profiles')
    .select('role, role_admin').eq('id', callerId).maybeSingle()
  if (!callerProfile || (callerProfile.role !== 'admin' && !callerProfile.role_admin)) {
    return json(403, { error: '仅管理员可生成方案书' })
  }

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }

  if (!body.service_type) return json(400, { error: 'service_type 必填' })
  if (!body.client_name) return json(400, { error: 'client_name 必填' })

  // Default: pull current third-party defaults for the chosen visa type
  let thirdPartyItems = body.third_party_items
  if (!thirdPartyItems || thirdPartyItems.length === 0) {
    const { data: defaults } = await admin
      .from('proposal_third_party_defaults')
      .select('*')
      .eq('service_type', body.service_type)
      .eq('is_active', true)
      .order('item_order')
    thirdPartyItems = defaults || []
  }

  const toPence = (v) => Math.round((Number(v) || 0) * 100)

  const { data, error } = await admin.from('proposals').insert({
    lead_id: body.lead_id || null,
    service_type: body.service_type,
    client_name: body.client_name,
    client_meta: body.client_meta || null,
    route_label: body.route_label || null,
    route_note: body.route_note || null,
    service_price_pence: toPence(body.service_price),
    anchor_price_pence: toPence(body.anchor_price),
    payment_1_pence: toPence(body.payment_1),
    payment_2_pence: toPence(body.payment_2),
    recommended_plan_name: body.recommended_plan_name || null,
    recommended_plan_desc: body.recommended_plan_desc || null,
    anchor_plan_name: body.anchor_plan_name || null,
    anchor_plan_desc: body.anchor_plan_desc || null,
    payment_1_trigger: body.payment_1_trigger || null,
    payment_2_trigger: body.payment_2_trigger || null,
    timeline_items: body.timeline_items || [],
    third_party_items: thirdPartyItems,
    status: 'sent',
    created_by: callerId,
  }).select('token, expires_at').single()

  if (error) return json(500, { error: error.message })

  const siteUrl = process.env.URL || 'https://readii-sales.netlify.app'
  return json(200, {
    token: data.token,
    url: `${siteUrl}/p/${data.token}`,
    expires_at: data.expires_at,
  })
}
