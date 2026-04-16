import Stripe from 'stripe'

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const { proposal_token, client_email, client_name } = await req.json()

  if (!proposal_token || !client_email) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{
      price: process.env.STRIPE_PRICE_ID_SELF_SERVICE,
      quantity: 1,
    }],
    customer_email: client_email,
    metadata: { proposal_token, client_name, tier: 'self_service' },
    success_url: `https://readii-sales.netlify.app/.netlify/functions/proposal-view?token=${proposal_token}&payment=success`,
    cancel_url: `https://readii-sales.netlify.app/.netlify/functions/proposal-view?token=${proposal_token}&payment=cancelled`,
    locale: 'zh',
  })

  return Response.json({ url: session.url })
}
