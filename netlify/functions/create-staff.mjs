import { createClient } from '@supabase/supabase-js'

const TEMP_PASSWORD = 'Readii2025!'

const VALID_STAFF_ROLES = ['copywriter', 'project_manager', 'customer_manager', 'bdm']

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
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: '缺少 Authorization token' })

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json(401, { error: '无效 token' })
  const callerId = userData.user.id

  const { data: callerProfile } = await admin.from('profiles')
    .select('role, role_admin').eq('id', callerId).maybeSingle()
  if (!callerProfile || (callerProfile.role !== 'admin' && !callerProfile.role_admin)) {
    return json(403, { error: '仅管理员可开通内部账号' })
  }

  let body; try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
  const fullName = String(body?.full_name || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()
  const staffRole = String(body?.staff_role || '').trim()

  if (!fullName || !email) return json(400, { error: '姓名和邮箱必填' })
  if (!VALID_STAFF_ROLES.includes(staffRole)) return json(400, { error: `staff_role 必须是 ${VALID_STAFF_ROLES.join('/')}` })

  // Create auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (createErr) return json(400, { error: `创建账号失败：${createErr.message}` })
  const userId = created.user?.id
  if (!userId) return json(500, { error: '创建账号后未返回 user id' })

  // Upsert profile with staff flags
  const { error: profErr } = await admin.from('profiles').upsert({
    id: userId,
    full_name: fullName,
    role_staff: true,
    staff_role: staffRole,
    password_changed: false,
  }, { onConflict: 'id' })
  if (profErr) return json(500, { error: `写入 profile 失败：${profErr.message}` })

  return json(200, {
    ok: true,
    user_id: userId,
    email,
    staff_role: staffRole,
    temp_password: TEMP_PASSWORD,
  })
}
