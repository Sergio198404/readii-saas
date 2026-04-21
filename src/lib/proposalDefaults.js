// Per-service-type price presets for the proposal create modal.
// Values are in GBP (not pence). Admin can override per-proposal.

export const PROPOSAL_PRICE_DEFAULTS = {
  ifv_innovator: {
    service_price: 4800,
    anchor_price: 60000,
    payment_1: 1500,
    payment_2: 3300,
    route_label: 'Innovator Founder Visa（创新签证）· 自助执行方案',
  },
  sw_self_sponsored: {
    service_price: 30000,
    anchor_price: 50000,
    payment_1: 12000,
    payment_2: 12000,
    route_label: '自雇工签全案（Sponsor Licence + Skilled Worker）',
  },
  ew_expansion: {
    service_price: 8800,
    anchor_price: 40000,
    payment_1: 3000,
    payment_2: 5800,
    route_label: 'EW 拓展工签 · 全案服务',
  },
  gt_global_talent: {
    service_price: 6800,
    anchor_price: 40000,
    payment_1: 2500,
    payment_2: 4300,
    route_label: 'Global Talent Visa · 全案服务',
  },
  plan_b: {
    service_price: 1200,
    anchor_price: 10000,
    payment_1: 1200,
    payment_2: 0,
    route_label: 'Plan B 综合评估',
  },
}

export const SERVICE_TYPE_LABELS = {
  ifv_innovator: '创新签证（IFV）',
  sw_self_sponsored: '自雇工签（SW）',
  ew_expansion: '拓展工签（EW）',
  gt_global_talent: '全球人才（GT）',
  plan_b: 'Plan B 评估',
}

export const SERVICE_TYPE_ORDER = [
  'ifv_innovator',
  'sw_self_sponsored',
  'ew_expansion',
  'gt_global_talent',
  'plan_b',
]

// Maps the old single-letter lead.prod code to the new service_type string
export function leadProdToServiceType(prod) {
  switch (prod) {
    case 'IFV': return 'ifv_innovator'
    case 'SW':  return 'sw_self_sponsored'
    case 'EW':  return 'ew_expansion'
    case 'GT':  return 'gt_global_talent'
    case 'PlanB': return 'plan_b'
    default: return 'sw_self_sponsored'
  }
}
