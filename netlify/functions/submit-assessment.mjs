import { createClient } from '@supabase/supabase-js'

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// v0.13.1: Q numbering after section reorder
// Q1=name, Q2=location, Q3=contact, Q4=source
// Q5=goals(multi), Q6=timeline, Q7=readiness
// Q8=visa_type, Q9=expiry, Q10=company, Q11=family(multi)
// Q12=career, Q13=years, Q14=business_intent, Q15=uk_partner
// Q16=notes

function guessRoute(a) {
  const scores = { IFV: 0, SW: 0, EW: 0 }

  if (a.Q14 === '是，已有明确商业计划') scores.IFV += 3
  if (a.Q14 === '是，初步有想法但尚未成型') scores.IFV += 1
  if (a.Q8 === '毕业生工作签证（PSW/Graduate）') { scores.IFV += 1; scores.SW += 1 }

  if (a.Q10 === '是，已注册') scores.SW += 2
  if (a.Q15 === '有，且对方持有英国永居或公民身份') scores.SW += 2
  if (a.Q14 === '主要目的是居留，商业是附带') scores.SW += 2

  if (a.Q8 === '工作签证（Skilled Worker）') scores.EW += 2
  if (a.Q14 === '是，已有明确商业计划' && a.Q2 !== '英国境内') scores.EW += 1

  if (scores.IFV >= scores.SW && scores.IFV >= scores.EW) return { route: 'IFV', scores }
  if (scores.SW >= scores.EW) return { route: 'SW', scores }
  return { route: 'EW', scores }
}

function guessPriority(a) {
  if (a.Q7 === '有时间压力，需要尽快启动') return 'P1'
  if (a.Q7 === '已基本确定方向，想推进了') return 'P1'
  if (a.Q9 === '6个月内到期' || a.Q6 === '尽快（3个月内）') return 'P1'
  if (a.Q7 === '已经在认真考虑，想听专业意见') return 'P2'
  if (a.Q9 === '6-12个月内到期') return 'P2'
  return 'P3'
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
  if (!answers.Q8) return json(400, { error: '签证类型为必填项' })

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { route, scores } = guessRoute(answers)
  const p = guessPriority(answers)

  const familyAnswers = answers.Q11 || []
  const family_flag =
    familyAnswers.includes('子女需要一同办理签证') ||
    familyAnswers.includes('子女目前在英国就读') ||
    familyAnswers.includes('配偶/伴侣需要一同办理签证')

  const row = {
    name: answers.Q1.trim(),
    contact_info: answers.Q3.trim(),
    channel: answers.Q4 || (refCode ? '渠道合作伙伴' : '问卷评估'),
    prod: route,
    p,
    s: 'S0',
    b: 'B0',
    note: answers.Q16?.trim() || null,
    assessment_data: { ...answers, route_scores: scores },
    source_type: refCode ? 'ref_link' : 'content',
    family_flag,
    readiness: answers.Q7 || null,
  }

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
