import { createClient } from '@supabase/supabase-js'

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function guessRoute(a) {
  if (a.Q7 === '是，已注册' && a.Q5 === '毕业生工作签证（PSW/Graduate）') return 'SW'
  if (a.Q11 === '是，已有明确商业计划') return 'IFV'
  if (a.Q5 === '工作签证（Skilled Worker）') return 'EW'
  return 'SW'
}

function guessPriority(a) {
  if (a.Q6 === '6个月内到期' || a.Q14 === '尽快（3个月内）') return 'P1'
  if (a.Q6 === '6-12个月内到期') return 'P2'
  return 'P3'
}

function guessBudget(a) {
  const map = {
    '£5,000 以下': 'B1',
    '£5,000 – £20,000': 'B2',
    '£20,000 – £50,000': 'B3',
    '£50,000 以上': 'B4',
  }
  return map[a.Q15] || 'B0'
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return json(500, { error: 'Server config error' })

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }

  const answers = body.answers || {}
  const refCode = body.ref_code || null

  if (!answers.Q1?.trim()) return json(400, { error: '姓名为必填项' })
  if (!answers.Q3?.trim()) return json(400, { error: '联系方式为必填项' })
  if (!answers.Q5) return json(400, { error: '签证类型为必填项' })

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const prod = guessRoute(answers)
  const p = guessPriority(answers)
  const b = guessBudget(answers)

  const row = {
    name: answers.Q1.trim(),
    contact_info: answers.Q3.trim(),
    channel: answers.Q4 || (refCode ? '渠道合作伙伴' : '问卷评估'),
    prod,
    p,
    s: 'S0',
    b,
    note: answers.Q16?.trim() || null,
    assessment_data: answers,
    source_type: refCode ? 'ref_link' : 'content',
  }

  // Channel attribution
  if (refCode) {
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('referral_code', refCode)
      .maybeSingle()
    if (partner) row.partner_id = partner.id
  }

  const { data: lead, error: insertErr } = await supabase
    .from('leads')
    .insert(row)
    .select('id')
    .single()

  if (insertErr) return json(500, { error: `创建线索失败：${insertErr.message}` })

  return json(200, { ok: true, lead_id: lead.id })
}
