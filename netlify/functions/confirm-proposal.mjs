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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return json(500, { error: 'Server missing SUPABASE env' })

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }

  const token = body?.token
  const clientName    = (body?.client_name    || '').trim()
  const clientPhone   = (body?.client_phone   || '').trim()
  const clientEmail   = (body?.client_email   || '').trim()
  const clientAddress = (body?.client_address || '').trim()

  if (!token) return json(400, { error: 'token 必填' })
  if (!clientName)    return json(400, { error: '姓名必填' })
  if (!clientPhone)   return json(400, { error: '手机号必填' })
  if (!clientEmail)   return json(400, { error: '邮箱必填' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return json(400, { error: '邮箱格式不正确' })
  }
  if (!clientAddress) return json(400, { error: '居住地址必填' })

  const { data, error } = await admin
    .from('proposals')
    .select('id, expires_at, status')
    .eq('token', token)
    .maybeSingle()

  if (error) return json(500, { error: error.message })
  if (!data) return json(404, { error: '方案书不存在' })

  if (data.status === 'confirmed' || data.status === 'converted') {
    return json(200, { already_confirmed: true })
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    await admin.from('proposals').update({ status: 'expired' }).eq('id', data.id)
    return json(410, { error: 'expired' })
  }

  const { error: updateErr } = await admin.from('proposals').update({
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    client_name: clientName,
    confirmed_client_phone: clientPhone,
    confirmed_client_email: clientEmail,
    confirmed_client_address: clientAddress,
  }).eq('id', data.id)

  if (updateErr) return json(500, { error: updateErr.message })

  return json(200, { success: true })
}
