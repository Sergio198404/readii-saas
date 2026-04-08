import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BG = 'Xiaoyu背景：Readii Limited创始人，Canterbury UK，7年中英跨境咨询经验，服务100+客户家庭，核心服务：创新签£60k / 自雇工签£40k / 拓展工签£40k。'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { messages, expertStyle, topic, angle, contentType } = await req.json()

    let systemPrompt = `你是Xiaoyu的内容助手。${BG}\n回复用中文，直接输出内容，不要加标题前缀或格式说明。`

    if (expertStyle) {
      systemPrompt += `\n\n写作风格要求：${expertStyle}`
    }

    // 如果是首次生成（没有 messages），构建初始 prompt
    let msgs = messages
    if (!msgs || msgs.length === 0) {
      let userMsg = `请基于以下选题，生成${contentType || '朋友圈'}。\n选题：${topic}\n`
      if (angle) userMsg += `内容角度：${angle}\n`
      userMsg += `${BG}\n要求：用真实案例和判断力体现专业度，不要信息堆砌，结尾自然引导读者了解Readii。`

      if (contentType === '口播稿（600-900字）') {
        userMsg += '\n字数要求：600-900字，适合短视频口播，口语化，有节奏感。'
      } else if (contentType === '文章（1500字）') {
        userMsg += '\n字数要求：约1500字，适合公众号/小红书长文，有深度有案例。'
      }

      msgs = [{ role: 'user', content: userMsg }]
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: msgs,
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    return new Response(JSON.stringify({ reply: text }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Generate content error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}
