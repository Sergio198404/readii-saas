// Commission split helpers for v0.4.0 deal recording.
// Single source of truth for how commission_model → per-role amounts.

const ROUND2 = (n) => Math.round(n * 100) / 100
const ROUND4 = (n) => Math.round(n * 10000) / 10000

/**
 * Build deal_roles rows for a freshly created deal.
 * Current user (you) hold converter + planner(3) + executor(3) until
 * we formally split roles across multiple users.
 *
 * If lead has a partner_id, that partner's user is added as `lead_recorder`
 * and paid partner.commission_rate × contract_amount on top of the
 * commission_model pool (this is a marketing cost, not a share of
 * distributable_amount).
 */
export function buildDealRoles({
  commissionModel,
  contractAmount,
  distributable,
  currentUserId,
  leadPartner, // { user_id, commission_rate } | null
}) {
  const rows = []

  if (leadPartner?.user_id) {
    const rate = Number(leadPartner.commission_rate ?? 0.05)
    rows.push({
      user_id: leadPartner.user_id,
      role: 'lead_recorder',
      share_rate: ROUND4(rate),
      amount: ROUND2(Number(contractAmount) * rate),
    })
  }

  const model = commissionModel || {}

  // Fixed commission (e.g. PlanB: £50 flat)
  if (model.fixed_commission != null) {
    rows.push({
      user_id: currentUserId,
      role: 'converter',
      share_rate: null,
      amount: ROUND2(Number(model.fixed_commission)),
    })
    return rows
  }

  if (model.converter != null) {
    rows.push({
      user_id: currentUserId,
      role: 'converter',
      share_rate: ROUND4(model.converter),
      amount: ROUND2(distributable * model.converter),
    })
  }
  if (model.planner != null) {
    const each = model.planner / 3
    for (const role of ['plan_assessor', 'plan_designer', 'plan_finalizer']) {
      rows.push({
        user_id: currentUserId,
        role,
        share_rate: ROUND4(each),
        amount: ROUND2(distributable * each),
      })
    }
  }
  if (model.executor != null) {
    const each = model.executor / 3
    for (const role of ['exec_material', 'exec_submitter', 'exec_follower']) {
      rows.push({
        user_id: currentUserId,
        role,
        share_rate: ROUND4(each),
        amount: ROUND2(distributable * each),
      })
    }
  }

  return rows
}

/**
 * Given a deal + its roles, summarize how the contract amount splits.
 */
export function summarizeDeal({ contractAmount, platformAmount, roles, currentUserId }) {
  const contract = Number(contractAmount) || 0
  const platform = Number(platformAmount) || 0
  let channel = 0
  let you = 0
  for (const r of roles || []) {
    const amt = Number(r.amount) || 0
    if (r.role === 'lead_recorder') channel += amt
    if (r.user_id === currentUserId) you += amt
  }
  return {
    contract,
    platform: ROUND2(platform),
    channel: ROUND2(channel),
    you: ROUND2(you),
  }
}
