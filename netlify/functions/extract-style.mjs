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
    const { content } = await req.json()

    if (!content?.trim()) {
      return new Response(JSON.stringify({ error: 'content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `请分析以下文章/文案的写作风格，提炼成一段可以直接用于AI写作的风格指令。
需要包含：1）开头钩子的惯用方式 2）段落长短和节奏 3）常用句式结构 4）语气和口吻 5）结尾方式 6）避免使用的表达
输出格式：直接输出风格指令，用第二人称"你"来描述，100-150字，可以直接作为写作prompt使用。

原文内容：
${content.trim()}`,
      }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    return new Response(JSON.stringify({ style_prompt: text.trim() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Extract style error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
