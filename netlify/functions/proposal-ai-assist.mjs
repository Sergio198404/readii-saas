import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const PROMPTS = {
  goals: (ctx) => `根据以下客户情况，生成4-6个建议书目标，每个目标包含：title（简短标题）、description（1-2句说明）、tag（核心目标/合规目标/家庭目标/长期目标 之一）。
客户情况：${ctx.background || '未提供'}
签证路线：${ctx.visa_route_zh || '未指定'}
客户已具备条件：${(ctx.client_advantages || []).join('、') || '未提供'}
以JSON数组格式返回，不要其他内容。`,

  metrics: (ctx) => `根据以下目标列表，为每个目标生成2-3条可量化的衡量标准。
格式：[{ "goal_title": "string", "metrics": ["string", ...] }, ...]
目标列表：${JSON.stringify(ctx.selected_goals || [])}
签证路线：${ctx.visa_route_zh || '未指定'}
以JSON格式返回，不要其他内容。`,

  tags: (ctx) => `根据客户情况生成4个建议书封面标签，每个标签5-15个字，突出客户特点和签证路线。
客户姓名：${ctx.client_name || ''}${ctx.client_title || ''}
签证路线：${ctx.visa_route_zh || ''}
客户已具备条件：${(ctx.client_advantages || []).join('、') || '未提供'}
以JSON字符串数组格式返回4个标签，不要其他内容。例：["主推路线 · SW 自雇工签","客户 · 王女士","旅游/酒店管理 · 10年+","孩子 Year 10"]`,

  exclusion: (ctx) => `根据客户情况，撰写一段"排除路线及原因"的分析，解释为什么某些路线不适合。简洁专业，2-3句话，用HTML strong标签强调关键内容。
签证路线（推荐的）：${ctx.visa_route_zh || ''}
客户背景：${ctx.background || '未提供'}
只返回纯文本内容，不要引号。`,

  advisor_note: (ctx) => `作为签证顾问苏晓宇，根据客户情况撰写一段顾问引言（3-4句），语气专业、有温度、给客户信心。用HTML strong标签强调核心判断。
客户背景：${ctx.background || '未提供'}
签证路线：${ctx.visa_route_zh || ''}
客户已具备条件：${(ctx.client_advantages || []).join('、') || '未提供'}
只返回纯文本内容，不要引号。`,

  risk_note: (ctx) => `根据客户情况和签证路线，撰写一段风险提示（2-3句），语气严肃但不吓人，说明如果不行动可能面临的后果。
签证路线：${ctx.visa_route_zh || ''}
客户背景：${ctx.background || '未提供'}
只返回纯文本内容，不要引号。`,

  timeline_desc: (ctx) => `为以下时间节点撰写简要描述（1-2句），专业简洁。
阶段：${ctx.phase || ''}
节点标题：${ctx.node_title || ''}
签证路线：${ctx.visa_route_zh || ''}
只返回纯文本描述，不要引号。`,
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  let body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }

  const { field_type, context } = body
  if (!field_type || !PROMPTS[field_type]) {
    return json(400, { error: `Invalid field_type: ${field_type}` })
  }

  try {
    const prompt = PROMPTS[field_type](context || {})
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')

    // Try to parse JSON for structured responses
    if (['goals', 'metrics', 'tags'].includes(field_type)) {
      const match = text.match(/[\[{][\s\S]*[\]}]/)
      if (match) {
        return json(200, { result: JSON.parse(match[0]) })
      }
      return json(200, { result: text, raw: true })
    }

    return json(200, { result: text.trim() })
  } catch (err) {
    console.error('AI assist error:', err)
    return json(500, { error: err.message || 'AI generation failed' })
  }
}
