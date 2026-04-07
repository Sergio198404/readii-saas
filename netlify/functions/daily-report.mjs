import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { leads } = await req.json()

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ summary: '今日无需跟进的线索。' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const leadsText = leads.map(l => {
      const parts = [`${l.name}（${l.channel || '?'}）`]
      parts.push(`${l.p}/${l.s} 产品:${l.prod || '?'} 预算:${l.b || '?'}`)
      if (l.exp) parts.push(`签证到期:${l.exp}`)
      parts.push(`下一步:${l.next || '?'}`)
      if (l.note) parts.push(`备注:${l.note}`)
      return parts.join(' · ')
    }).join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: '你是 Readii 销售助手。根据今日需要跟进的线索，生成一份简洁的每日跟进报告。每个客户给出1-2句具体行动建议。用中文，格式清晰，适合邮件阅读。不要用 markdown 格式，用纯文本。',
      messages: [
        { role: 'user', content: `以下是今日需要跟进的客户：\n\n${leadsText}\n\n请生成今日跟进报告，包含每个客户的具体行动建议。` },
      ],
    })

    const summary = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Daily report error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
