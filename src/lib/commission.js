// Commission split helpers for v0.4.0+ deal recording.
// Allocation model:
//   platform        = contract × 0.30                (platform cut, fixed)
//   distributable   = contract × 0.70
//   channelAmount   = distributable × partner.commission_rate × partner.multiplier
//   remainingPool   = distributable − channelAmount
//   converter/planner/executor splits apply to remainingPool via commission_model

const ROUND2 = (n) => Math.round(n * 100) / 100
const ROUND4 = (n) => Math.round(n * 10000) / 10000

/**
 * Pure breakdown of a contract amount into the five pools.
 * leadPartner: { user_id, commission_rate, multiplier } | null
 */
export function computeDealAmounts({
  contractAmount,
  platformRate = 0.30,
  leadPartner = null,
}) {
  const contract = Number(contractAmount) || 0
  const platform = ROUND2(contract * platformRate)
  const distributable = ROUND2(contract * (1 - platformRate))

  let channelAmount = 0
  if (leadPartner?.user_id) {
    const rate = Number(leadPartner.commission_rate ?? 0.05)
    const mult = Number(leadPartner.multiplier ?? 1.0)
    channelAmount = ROUND2(distributable * rate * mult)
  }

  const remainingPool = ROUND2(distributable - channelAmount)

  return { contract, platform, distributable, channelAmount, remainingPool }
}

/**
 * Build deal_roles rows for a freshly created deal.
 * Current user (you) holds converter + planner(3) + executor(3) until
 * we formally split roles across multiple users.
 */
export function buildDealRoles({
  commissionModel,
  contractAmount,
  platformRate = 0.30,
  currentUserId,
  leadPartner, // { user_id, commission_rate, multiplier } | null
}) {
  const { contract, channelAmount, remainingPool } = computeDealAmounts({
    contractAmount,
    platformRate,
    leadPartner,
  })

  const rows = []

  if (leadPartner?.user_id && channelAmount > 0) {
    rows.push({
      user_id: leadPartner.user_id,
      role: 'lead_recorder',
      share_rate: contract > 0 ? ROUND4(channelAmount / contract) : null,
      amount: channelAmount,
    })
  }

  const model = commissionModel || {}

  // Fixed commission (e.g. PlanB: £50 flat) — bypasses remainingPool split
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
      amount: ROUND2(remainingPool * model.converter),
    })
  }
  if (model.planner != null) {
    const each = model.planner / 3
    for (const role of ['plan_assessor', 'plan_designer', 'plan_finalizer']) {
      rows.push({
        user_id: currentUserId,
        role,
        share_rate: ROUND4(each),
        amount: ROUND2(remainingPool * each),
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
        amount: ROUND2(remainingPool * each),
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
