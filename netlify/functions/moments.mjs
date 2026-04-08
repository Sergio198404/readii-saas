import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `你是Xiaoyu的内容助手。Xiaoyu是Readii Limited创始人，Canterbury UK，中英双向出海咨询，7年经验，服务100+客户家庭。核心服务：创新签£60k / 自雇工签£40k / 拓展工签£40k。

朋友圈写作原则：
- 不超过150字，不用emoji堆砌
- 生活类：真实、有温度，让人感觉认识这个人
- 价值观类：有立场、敢说别人不说的，体现判断力
- 案例类：脱敏处理，突出客户的转变和结果，结尾自然带出Readii
- 三条风格各异，不要都是"干货"腔调
- 用中文，像一个真实的人在写，不像广告

返回格式必须是 JSON 数组，包含3个对象，每个对象字段：
- type: "生活" | "价值观" | "案例"
- content: 朋友圈文案（150字以内）

只返回 JSON，不要其他文字。`

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { date, caseLeadInfo, recentNotes, regenerateType, expertStyle } = await req.json()

    let userMessage = `今天是${date}。\n\n`

    if (expertStyle) {
      userMessage += `请用以下风格进行写作：${expertStyle}\n\n`
    }

    if (recentNotes && recentNotes.length > 0) {
      userMessage += `最近客户备注（灵感素材）：\n${recentNotes.join('\n')}\n\n`
    }

    if (caseLeadInfo) {
      userMessage += `案例素材客户信息（脱敏后使用）：\n${caseLeadInfo}\n\n`
    }

    if (regenerateType) {
      userMessage += `请只重新生成"${regenerateType}"类型的那一条朋友圈，返回只包含1个对象的JSON数组。`
    } else {
      userMessage += `请生成今日三条朋友圈（生活、价值观、案例各一条）。`
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    let moments = []
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        moments = JSON.parse(jsonMatch[0])
      }
    } catch {
      return new Response(JSON.stringify({ error: 'JSON解析失败', raw: text }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ moments }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Moments error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
