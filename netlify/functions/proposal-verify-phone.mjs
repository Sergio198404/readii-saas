// TODO: 后续接入 Twilio 后在此处加短信验证码逻辑
// 当前 MVP 版本直接返回验证通过

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ verified: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
