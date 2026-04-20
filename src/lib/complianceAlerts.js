// Compliance alert engine for Lisa's (project_manager) dashboard.
// Inputs: customers (customer_profiles rows), progressByCustomer (customer_id → progress rows with joined stage),
//         stagesById (stage_id → journey_stage row with estimated_duration_days)

export function daysSince(iso) {
  if (!iso) return 0
  const d = new Date(iso)
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export function computeAlerts({ customers, progressByCustomer, stagesById }) {
  const alerts = []

  for (const c of customers) {
    const progress = progressByCustomer[c.id] || []

    // 1. Stage overdue (>120% of estimated duration, in_progress)
    const overdue = progress.filter(p => {
      if (p.status !== 'in_progress' || !p.started_at) return false
      const stage = stagesById[p.stage_id]
      const est = stage?.estimated_duration_days || 14
      return daysSince(p.started_at) > Math.ceil(est * 1.2)
    })
    if (overdue.length > 0) {
      alerts.push({
        type: 'stage_overdue',
        severity: 'warning',
        customer_id: c.id,
        customer_name: c.profiles?.full_name || c.profiles?.email,
        count: overdue.length,
        message: `${overdue.length} 个阶段已超出预计时间 20%`,
        detail: overdue.map(p => `阶段 ${stagesById[p.stage_id]?.stage_number || '?'}（已用 ${daysSince(p.started_at)} 天）`).join('；'),
      })
    }

    // 2. Customer-level red/blocker warnings (from questionnaire rule engine)
    const warnings = Array.isArray(c.warnings) ? c.warnings : []
    for (const w of warnings) {
      if (w.severity === 'red' || w.severity === 'blocker') {
        alerts.push({
          type: 'customer_warning',
          severity: 'red',
          customer_id: c.id,
          customer_name: c.profiles?.full_name || c.profiles?.email,
          code: w.code,
          message: w.message,
        })
      }
    }

    // 3. Revenue milestone alerts (3-month rolling window)
    const ops = Array.isArray(c.monthly_operations_data) ? c.monthly_operations_data : []
    if (ops.length >= 3) {
      const last3 = ops.slice(-3)
      const sumRevenue = last3.reduce((s, m) => s + (Number(m.revenue) || 0), 0)
      if (sumRevenue < 30000) {
        alerts.push({
          type: 'revenue_below_target',
          severity: 'warning',
          customer_id: c.id,
          customer_name: c.profiles?.full_name || c.profiles?.email,
          message: `近 3 个月营业额 £${sumRevenue.toLocaleString('en-GB')} 低于目标 £30,000`,
        })
      }
    }

    // 4. Bank balance drop
    if (ops.length > 0) {
      const latestBalance = Number(ops[ops.length - 1].bank_balance) || 0
      if (latestBalance > 0 && latestBalance < 10000) {
        alerts.push({
          type: 'bank_balance_low',
          severity: 'red',
          customer_id: c.id,
          customer_name: c.profiles?.full_name || c.profiles?.email,
          message: `最新银行余额 £${latestBalance.toLocaleString('en-GB')} 低于 £10,000 运营保证金`,
        })
      }
    }
  }

  return alerts.sort((a, b) => {
    const order = { red: 0, warning: 1 }
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
  })
}
