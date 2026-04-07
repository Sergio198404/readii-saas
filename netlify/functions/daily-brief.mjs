import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORY_PROMPTS = {
  '英国签证动态': 'Search for the latest UK visa and immigration policy updates from the past 7 days. Focus on: Innovator Founder visa, Skilled Worker visa, immigration reforms, Home Office announcements.',
  '国内热点结合点': 'Search for trending topics on Chinese social media (Weibo, Douyin) today related to: immigration, studying abroad, entrepreneurship, UK, Europe, overseas life.',
  '平台爆款参考': 'Search for popular recent content on Xiaohongshu and Douyin about UK immigration, UK visa, or overseas entrepreneurship. Analyze why they went viral.',
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { date, category } = await req.json()

    const prompt = CATEGORY_PROMPTS[category]
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Invalid category' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{
        role: 'user',
        content: `Today is ${date}. ${prompt}

Give 2-3 most relevant items. Return a JSON array where each object has:
- category: "${category}"
- title: (Chinese)
- summary: (Chinese, one sentence)
- url: (link if available, otherwise null)
- angle: (Chinese: how Xiaoyu from Readii Limited, a UK immigration consultancy, can leverage this for social media content)

Only return the JSON array, no other text.`,
      }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    let items = []
    try {
      const jsonMatch = text.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        items = JSON.parse(jsonMatch[0])
      }
    } catch {
      return new Response(JSON.stringify({ items: [], raw: text }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Daily brief error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
