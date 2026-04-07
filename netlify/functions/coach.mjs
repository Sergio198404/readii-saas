import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `你是 Readii 销售教练，一个专门为中英跨境签证咨询业务设计的 AI 销售助手。

你的角色：
- 分析销售线索库，给出具体、可执行的跟进建议
- 识别高优先级客户和风险客户
- 针对不同签证产品（IFV创新签、SW工签、GT全球人才、Student学签、PlanB评估）给出专业销售策略
- 用中文回复，语气专业但亲切

线索字段说明：
- P: 优先级（P1=7天内决策, P2=30天跟进, P3=观望）
- S: 阶段（S0=新线索, S1=信息齐, S2=已约电话, S3=已报价, S4=已成交, S5=冷/失联）
- B: 预算（B0=未知, B1≤£5k, B2=£5-20k, B3=£20-60k, B4≥£60k）
- next: 下一步动作（Call/Docs/Pay/Intro/Wait）
- follow: 跟进日期（MMDD格式）
- exp: 签证到期（YYYYMM）
- goal: 目标月份（YYYYMM）

回复要求：
- 简洁有力，不要空泛建议
- 给出具体话术示例时用引号标注
- 涉及时间紧迫性时要明确指出`

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { messages, leads } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 把 leads 数据注入 system prompt
    let systemPrompt = SYSTEM_PROMPT
    if (leads && leads.length > 0) {
      const leadsContext = leads.map(l => {
        const parts = [`${l.name}（${l.channel || '未知渠道'}）`]
        parts.push(`${l.p}/${l.s} 产品:${l.prod || '?'} 预算:${l.b || '?'}`)
        if (l.exp) parts.push(`签证到期:${l.exp}`)
        if (l.goal) parts.push(`目标:${l.goal}`)
        parts.push(`下一步:${l.next || '?'} 跟进:${l.follow || '?'}`)
        if (l.note) parts.push(`备注:${l.note}`)
        if (l.updates?.length) {
          parts.push(`历史: ${l.updates.map(u => `${u.date} ${u.note}`).join(' | ')}`)
        }
        return parts.join(' · ')
      }).join('\n')

      systemPrompt += `\n\n===== 当前线索库（${leads.length}条） =====\n${leadsContext}`
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    return new Response(JSON.stringify({ reply: text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Coach API error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
