import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const templateDir = dirname(fileURLToPath(import.meta.url))

function html(status, body) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function expiredPage() {
  return html(410, `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>已过期</title>
    <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#E8E4D8;color:#1A1710}
    .box{text-align:center;padding:40px;background:#FDFBF6;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:400px}
    h1{font-size:20px;margin-bottom:12px}p{font-size:14px;color:#8A8780}</style></head>
    <body><div class="box"><h1>建议书已过期</h1><p>此链接已超过有效期。如需获取新的建议书，请联系您的顾问。</p></div></body></html>`)
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function fmtDateISO(iso) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export default async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return html(400, 'Missing token')

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return html(500, 'Server config error')

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error || !proposal) return expiredPage()

  // Check expiry
  const proposalDate = new Date(proposal.proposal_date)
  const expiryDate = new Date(proposalDate)
  expiryDate.setDate(expiryDate.getDate() + (proposal.validity_days || 60))
  if (new Date() > expiryDate) {
    await supabase.from('proposals').update({ status: 'expired' }).eq('id', proposal.id)
    return expiredPage()
  }

  // Update view count + status
  const updates = { view_count: (proposal.view_count || 0) + 1 }
  if (!proposal.viewed_at) updates.viewed_at = new Date().toISOString()
  if (proposal.status === 'draft' || proposal.status === 'sent') updates.status = 'viewed'
  await supabase.from('proposals').update(updates).eq('id', proposal.id)

  // Log
  await supabase.from('proposal_logs').insert({
    proposal_id: proposal.id,
    event: 'viewed',
    ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    user_agent: req.headers.get('user-agent') || null,
  })

  // Deadline = proposal_date + 7 days (for countdown)
  const deadlineDate = new Date(proposalDate)
  deadlineDate.setDate(deadlineDate.getDate() + 7)

  // Load template and replace
  let tpl = readFileSync(join(templateDir, 'proposal-template.html'), 'utf8')

  // Build dynamic sections
  const goals = Array.isArray(proposal.selected_goals) ? proposal.selected_goals : []
  const metrics = proposal.metrics && typeof proposal.metrics === 'object' ? proposal.metrics : {}
  const values = Array.isArray(proposal.selected_values) ? proposal.selected_values : []
  const coverTags = Array.isArray(proposal.cover_tags) ? proposal.cover_tags : []
  const typicalDisadv = Array.isArray(proposal.typical_disadvantages) ? proposal.typical_disadvantages : []
  const clientAdv = Array.isArray(proposal.client_advantages) ? proposal.client_advantages : []

  const goalsHtml = goals.map((g, i) =>
    `<div class="goal-card"><div class="goal-head"><div class="goal-num">${i + 1}</div><div class="goal-title">${g.title || ''}</div><span class="goal-tag">${g.tag || ''}</span></div><div class="goal-body"><div class="goal-desc">${g.description || ''}</div></div></div>`
  ).join('\n') || '<div style="color:var(--ink-3);font-size:13px">暂未设置目标</div>'

  const metricsHtml = goals.map((g, i) => {
    const items = (metrics[g.title] || []).map(m => `<div class="metric-item">${m}</div>`).join('\n')
    return `<div class="goal-card"><div class="goal-head"><div class="goal-num">${i + 1}</div><div class="goal-title">${g.title || ''}</div></div><div class="goal-body">${items || '<div style="color:var(--ink-3)">—</div>'}</div></div>`
  }).join('\n') || '<div style="color:var(--ink-3);font-size:13px">暂未设置衡量标准</div>'

  const valuesHtml = values.map(v =>
    `<div class="val-card"><div class="val-icon">${v.icon || ''}</div><div class="val-title">${v.title || ''}</div><div class="val-desc">${v.desc || ''}</div><div class="val-loss">${v.loss || ''}</div></div>`
  ).join('\n') || '<div style="color:var(--ink-3);font-size:13px">暂未选择价值主张</div>'

  const coverTagsHtml = coverTags.filter(Boolean).map((t, i) =>
    `<span class="cv-chip ${i === 0 ? 'cv-chip-g' : 'cv-chip-l'}">${t}</span>`
  ).join('\n') || ''

  const typicalHtml = typicalDisadv.map(d => `<div class="adv-item"><span>✗</span>${d}</div>`).join('\n') || ''
  const advHtml = clientAdv.map(a => `<div class="adv-item"><span>✓</span>${a}</div>`).join('\n') || ''

  const goalChecksHtml = goals.map(g =>
    `<div class="accept-check-item"><div class="chk-box"></div><span>${g.title || ''}</span></div>`
  ).join('\n') || ''

  const replacements = {
    '[[CLIENT_NAME]]': proposal.client_name || '',
    '[[CLIENT_TITLE]]': proposal.client_title || '',
    '[[VISA_ROUTE_ZH]]': proposal.visa_route_zh || '',
    '[[VISA_ROUTE_EN]]': proposal.visa_route_en || '',
    '[[PROPOSAL_NO]]': proposal.proposal_no || '',
    '[[DATE]]': fmtDate(proposal.proposal_date),
    '[[VALIDITY_DAYS]]': String(proposal.validity_days || 60),
    '[[ADVISOR_ZH]]': proposal.advisor_zh || '苏晓宇',
    '[[ADVISOR_EN]]': proposal.advisor_en || 'Xiaoyu Su',
    '[[BACKGROUND_SUMMARY]]': proposal.background_summary || '',
    '[[CLIENT_QUOTE]]': proposal.client_quote || '',
    '[[EXCLUSION_REASON]]': proposal.exclusion_reason || '',
    '[[ADVISOR_NOTE]]': proposal.advisor_note || '',
    '[[PROPOSAL_DEADLINE]]': fmtDateISO(deadlineDate.toISOString()),
    '[[PROPOSAL_ID]]': proposal.id,
    '[[ACCESS_TOKEN]]': proposal.token || '',
    '[[CLIENT_EMAIL]]': proposal.client_email || '',
    '[[GOALS_SECTION]]': goalsHtml,
    '[[METRICS_SECTION]]': metricsHtml,
    '[[VALUES_SECTION]]': valuesHtml,
    '[[COVER_TAGS]]': coverTagsHtml,
    '[[TYPICAL_DISADVANTAGES]]': typicalHtml,
    '[[CLIENT_ADVANTAGES]]': advHtml,
    '[[GOAL_CHECKS]]': goalChecksHtml,
  }

  for (const [key, val] of Object.entries(replacements)) {
    tpl = tpl.replaceAll(key, val)
  }

  // Payment status banner
  const payment = url.searchParams.get('payment')
  if (payment === 'success') {
    const banner = `<div style="background:#e6f4ea;color:#1e7a3c;padding:16px 24px;text-align:center;font-size:14px;font-weight:600;border-bottom:1px solid #b7e0c2">✓ 订阅成功！欢迎加入 Readii 自助申请，苏晓宇会在24小时内通过微信与您确认开通详情。</div>`
    tpl = tpl.replace('<div class="recip-bar">', banner + '\n<div class="recip-bar">')
  } else if (payment === 'cancelled') {
    const banner = `<div style="background:#f3f3f3;color:#8A8780;padding:16px 24px;text-align:center;font-size:14px;border-bottom:1px solid #ddd">您已取消付款，建议书仍然有效，随时可以重新订阅。</div>`
    tpl = tpl.replace('<div class="recip-bar">', banner + '\n<div class="recip-bar">')
  }

  return html(200, tpl)
}
