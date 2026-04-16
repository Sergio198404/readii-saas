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
  if (!url || !serviceKey) return json(500, { error: 'Server config error' })

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const proposalId = body?.proposal_id
  const tier = body?.tier || 'full_case'
  if (!proposalId) return json(400, { error: 'Missing proposal_id' })

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: updateErr } = await supabase
    .from('proposals')
    .update({ selected_tier: tier, status: 'signed', signed_at: new Date().toISOString() })
    .eq('id', proposalId)

  if (updateErr) return json(500, { error: updateErr.message })

  await supabase.from('proposal_logs').insert({
    proposal_id: proposalId,
    event: 'contract_requested',
    ip_address: req.headers.get('x-forwarded-for') || null,
    user_agent: req.headers.get('user-agent') || null,
  })

  return json(200, { success: true })
}
