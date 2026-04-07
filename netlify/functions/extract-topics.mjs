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
      return new Response(JSON.stringify({ topics: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 拼接所有客户备注和沟通记录
    const context = leads.map(l => {
      const parts = [`客户: ${l.name}（${l.prod || '?'}）`]
      if (l.note) parts.push(`备注: ${l.note}`)
      if (l.updates?.length) {
        parts.push(`沟通记录: ${l.updates.map(u => `${u.date} ${u.note}`).join(' | ')}`)
      }
      return parts.join('\n')
    }).join('\n\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: '你是内容营销专家，帮助 Readii 创始人 Xiaoyu 从客户沟通中提炼内容选题。只返回 JSON，不要其他文字。',
      messages: [
        {
          role: 'user',
          content: `以下是Xiaoyu的客户备注和沟通记录，请分析出：1）客户最常问的3-5个问题 2）每个问题转化成适合抖音/视频号的选题标题 3）建议的内容角度（从Xiaoyu的创始人视角出发，不是信息科普，是真实经历和判断）。返回JSON数组，字段：topic, source_count, platform, angle

${context}`
        },
      ],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    // 从回复中提取 JSON 数组
    let topics = []
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0])
      }
    } catch {
      return new Response(JSON.stringify({ error: '解析 AI 返回的 JSON 失败', raw: text }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ topics }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Extract topics error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
