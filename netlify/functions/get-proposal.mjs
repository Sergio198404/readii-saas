import { createClient } from '@supabase/supabase-js'

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return json(400, { error: 'token 必填' })

  const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceKey) return json(500, { error: 'Server missing SUPABASE env' })

  const admin = createClient(supaUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin
    .from('proposals')
    .select('*')
    .eq('token', token)
    .neq('status', 'draft')
    .maybeSingle()

  if (error) return json(500, { error: error.message })
  if (!data) return json(404, { error: '方案书不存在或已失效' })

  // Mark first view (does not change status if already confirmed/converted/expired)
  if (!data.viewed_at && (data.status === 'sent')) {
    await admin.from('proposals')
      .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
      .eq('token', token)
    data.viewed_at = new Date().toISOString()
    data.status = 'viewed'
  }

  // Reflect expiry at read time (does not persist status change)
  const expired = data.expires_at && new Date(data.expires_at) < new Date()
  return json(200, { ...data, is_expired: !!expired })
}
