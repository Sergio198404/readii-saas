import { createClient } from '@supabase/supabase-js'

const TEMP_PASSWORD = 'Readii2025!'

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sanitizeEnglishName(s) {
  return String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return json(500, { error: 'Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  // --- Admin-only gate: validate caller JWT and role ---
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: '缺少 Authorization token' })

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return json(401, { error: '无效 token' })
  }
  const callerId = userData.user.id

  const { data: callerProfile, error: profErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .maybeSingle()
  if (profErr) return json(500, { error: `读取调用方 profile 失败：${profErr.message}` })
  if (!callerProfile || callerProfile.role !== 'admin') {
    return json(403, { error: '仅管理员可创建伙伴' })
  }

  // --- Parse body ---
  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const fullName = String(body?.full_name || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()
  const englishNameRaw = String(body?.english_name || '').trim()
  const englishName = sanitizeEnglishName(englishNameRaw)

  if (!fullName || !email || !englishName) {
    return json(400, { error: '姓名、邮箱、英文名均为必填' })
  }

  // 1. Create auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, english_name: englishNameRaw },
  })
  if (createErr) {
    return json(400, { error: `创建账号失败：${createErr.message}` })
  }

  const userId = created.user?.id
  if (!userId) return json(500, { error: '创建账号后未返回 user id' })

  // 2. Upsert profile (role=partner, force password change on first login)
  const { error: profileInsertErr } = await admin
    .from('profiles')
    .upsert(
      { id: userId, full_name: fullName, role: 'partner', password_changed: false },
      { onConflict: 'id' }
    )
  if (profileInsertErr) {
    return json(500, { error: `写入 profile 失败：${profileInsertErr.message}` })
  }

  // 3. Generate referral code + URL
  const referralCode = `READII-${englishName}-2025`
  const referralUrl = `https://readii.co.uk/?ref=${referralCode}`

  // 4. Insert partner row
  const { data: partnerRow, error: partnerErr } = await admin
    .from('partners')
    .insert({
      user_id: userId,
      level: 1,
      commission_rate: 0.05,
      referral_code: referralCode,
      referral_url: referralUrl,
      status: 'active',
    })
    .select()
    .single()
  if (partnerErr) {
    return json(500, { error: `写入 partner 失败：${partnerErr.message}` })
  }

  return json(200, {
    ok: true,
    partner: partnerRow,
    temp_password: TEMP_PASSWORD,
  })
}
