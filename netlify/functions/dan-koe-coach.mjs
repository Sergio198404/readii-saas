import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `你是Xiaoyu的业务增长顾问，深度理解中英跨境咨询业务的运营逻辑和Dan Koe的一人企业理论。

【业务背景】
Readii Limited，Canterbury UK，中英双向出海科技平台。
核心服务：创新签£60k / 自雇工签£40k / 拓展工签£40k。
年目标：£1,000,000。

【Dan Koe框架】
- 从出售时间（一对一咨询）进化到出售系统（Readii平台+渠道网络）
- 客户案例 = 内容素材 = 品牌建设材料
- 每个成交都应该产出：案例 + 推荐 + 内容
- 价值方程：识别问题 + 引导向解决方案 + 提供清晰过程 = 创造价值
- 90%的销售在正式销售发生前就已通过信任建立完成
- 该客户身上哪些事值得Xiaoyu亲自做，哪些可以系统化

【回复准则】
- 数据驱动，直接给出可执行建议
- 每次回复包含：问题判断 + 具体行动 + 预期结果
- 开场白必须是可以直接复制发微信的中文消息
- 回复200字以内，中文，直接有力`

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { messages, expertStyle } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 如果传入了自定义专家风格，替换 system prompt 中的回复准则
    let systemPrompt = SYSTEM_PROMPT
    if (expertStyle) {
      systemPrompt += `\n\n【专家写作风格】\n${expertStyle}`
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
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
    console.error('Dan Koe coach error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
