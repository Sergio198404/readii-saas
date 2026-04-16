import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async (req) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const sig = req.headers.get('stripe-signature')
  const body = await req.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { proposal_token } = session.metadata

    const { data: proposal } = await supabase
      .from('proposals')
      .select('id')
      .eq('token', proposal_token)
      .single()

    if (proposal) {
      await supabase.from('proposals').update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        selected_tier: 'self_service',
        stripe_session_id: session.id,
        stripe_subscription_id: session.subscription,
      }).eq('token', proposal_token)

      await supabase.from('proposal_logs').insert({
        proposal_id: proposal.id,
        event: 'payment_completed',
      })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    await supabase.from('proposals')
      .update({ status: 'expired' })
      .eq('stripe_subscription_id', sub.id)
  }

  return new Response('ok', { status: 200 })
}
