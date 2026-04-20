// Rule engine: maps customer questionnaire answers to a tailored Journey.
// Returns { visa_path, stages, warnings, timelineHints, requires_tb_test }.
//
// stage_code convention (as in product manual): 'stage_01' .. 'stage_24'.
// Our journey_stages table uses stage_number (1..24). stageCodeToNumber converts.

const STAGE_ORDER = {
  stage_01: 1, stage_02: 2, stage_03: 3, stage_04: 4, stage_05: 5,
  stage_06: 6, stage_07: 7, stage_08: 8, stage_09: 9, stage_10: 10,
  stage_11: 11, stage_12: 12, stage_13: 13, stage_14: 14, stage_15: 15,
  stage_16: 16, stage_17: 17, stage_18: 18, stage_19: 19, stage_20: 20,
  stage_21: 21, stage_22: 22, stage_23: 23, stage_24: 24,
};

export function stageCodeToNumber(code) {
  return STAGE_ORDER[code] ?? null;
}

function stageOrder(code) { return STAGE_ORDER[code] || 99; }

// Base stages shared across both paths (A inside-UK / B outside-UK).
const BASE_STAGES = [
  'stage_01', 'stage_02', 'stage_04', 'stage_05', 'stage_06',
  'stage_07', 'stage_08', 'stage_09', 'stage_12', 'stage_13',
  'stage_15', 'stage_16', 'stage_17', 'stage_18', 'stage_19',
  'stage_20', 'stage_22', 'stage_23', 'stage_24',
];

function selectVariant(stageCode, q, visa_path) {
  switch (stageCode) {
    case 'stage_02': {
      const m = {
        uk_degree: 'variant_2a',
        english_native: 'variant_2b',
        ecctis: 'variant_2c',
        has_valid_score: 'variant_2d',
        need_exam: 'variant_2e',
      };
      return m[q.employee_english_status] || null;
    }
    case 'stage_04':
      return q.company_structure === 'investor_only' ? 'variant_4a' : 'variant_4b';
    case 'stage_06':
      return visa_path === 'a_inside_uk' ? 'variant_6a' : 'variant_6b';
    case 'stage_09':
      // Single variant for now; kept for future capital-tier variants.
      return 'variant_9a';
    case 'stage_23':
      return visa_path === 'a_inside_uk' ? 'variant_23a' : 'variant_23b';
    default:
      return null;
  }
}

function computeStages(q, visa_path) {
  const stages = BASE_STAGES.map(code => ({
    stage_code: code,
    variant: selectVariant(code, q, visa_path),
  }));

  // Conditional: stage_03 (criminal record) — only when criminal record required AND outside UK
  if (q.requires_criminal_record && visa_path === 'b_outside_uk') {
    stages.push({ stage_code: 'stage_03', variant: null });
  }

  // Path A specific: stage_10 (HR compliance inside UK)
  if (visa_path === 'a_inside_uk') {
    stages.push({ stage_code: 'stage_10', variant: null });
  }

  // Path B specific: stage_11 (overseas coordination), stage_21 (Defined CoS)
  if (visa_path === 'b_outside_uk') {
    stages.push({ stage_code: 'stage_11', variant: null });
    stages.push({ stage_code: 'stage_21', variant: null });

    // TB test required for China mainland / HK / Macau
    if (['cn_mainland', 'cn_hk_mo'].includes(q.employee_nationality)) {
      stages.push({ stage_code: 'stage_14', variant: null });
    }
  }

  return stages.sort((a, b) => stageOrder(a.stage_code) - stageOrder(b.stage_code));
}

function computeWarnings(q) {
  const warnings = [];

  if (q.current_visa_remaining_months === 'lt_6') {
    warnings.push({
      severity: 'red',
      code: 'visa_expiry_critical',
      message: '⛔ 签证剩余不足 6 个月，整个工签流程需要 12-14 个月，须立即评估过桥方案（例如切换签证类型）。',
    });
  }
  if (q.current_visa_remaining_months === '6_to_12') {
    warnings.push({
      severity: 'orange',
      code: 'visa_expiry_tight',
      message: '⚠️ 签证剩余 6-12 个月，时间紧张。所有前置事项（英语、Ecctis 等）必须立即启动。',
    });
  }
  if (q.startup_capital === 'lt_50k') {
    warnings.push({
      severity: 'red',
      code: 'capital_insufficient',
      message: '⛔ 启动资金不足 £50K。申请 Sponsor Licence 时银行余额须达此标准，须讨论追加资金计划。',
    });
  }
  if (q.startup_capital === '50k_to_100k') {
    warnings.push({
      severity: 'orange',
      code: 'capital_tight',
      message: '⚠️ 启动资金处于下限区间，建议维持 £50K+ 余额直至 SL 申请递交。',
    });
  }
  if (q.ao_candidate === 'undecided') {
    warnings.push({
      severity: 'blocker',
      code: 'ao_undecided',
      message: '🚫 AO 人选未确定。此项目确认前，公司注册阶段无法推进。',
    });
  }
  if (q.ao_candidate === 'employee') {
    warnings.push({
      severity: 'orange',
      code: 'ao_is_employee',
      message: '⚠️ 雇员担任 AO：UKVI 会格外审查 genuine employment 关系，须确保公司结构和汇报关系清晰合理。',
    });
  }
  if (q.employee_english_status === 'ecctis') {
    warnings.push({
      severity: 'orange',
      code: 'ecctis_urgent',
      message: '⚠️ Ecctis 认证最长 20 工作日，无加急选项。签约后第一周内必须发出 MOI 申请邮件。',
    });
  }
  if (q.employee_english_status === 'need_exam') {
    warnings.push({
      severity: 'orange',
      code: 'english_exam_urgent',
      message: '⚠️ 需考取英语成绩。建议签约后两周内完成报名，为可能的重考预留时间。',
    });
  }
  if (q.requires_criminal_record && Array.isArray(q.countries_lived) && q.countries_lived.length > 1) {
    warnings.push({
      severity: 'orange',
      code: 'multi_country_crc',
      message: `⚠️ 多国居住记录需分别办理无犯罪证明（共 ${q.countries_lived.length} 国），办理周期可能显著延长。`,
    });
  }

  return warnings;
}

function computeTimeline(q, visa_path, signed_date) {
  const start = signed_date ? new Date(signed_date) : new Date();
  const addMonths = (d, n) => {
    const r = new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
    return r;
  };
  const fmt = d => d.toISOString().split('T')[0];

  const slSubmit = addMonths(start, 10);
  const slApproval = addMonths(start, 12);
  const visaSubmit = addMonths(start, 13);
  const visaApproval = visa_path === 'b_outside_uk' ? addMonths(start, 14) : addMonths(start, 15);

  const hints = {
    sl_expected_submit: fmt(slSubmit),
    sl_expected_approval: fmt(slApproval),
    visa_expected_submit: fmt(visaSubmit),
    visa_expected_approval: fmt(visaApproval),
  };

  if (visa_path === 'b_outside_uk' && ['cn_mainland', 'cn_hk_mo'].includes(q.employee_nationality)) {
    hints.tb_test_window_start = fmt(addMonths(slApproval, -5));
    hints.tb_test_window_end = fmt(addMonths(slApproval, -3));
  }

  return hints;
}

export function runRuleEngine(q) {
  const visa_path = q.employee_location === 'overseas' ? 'b_outside_uk' : 'a_inside_uk';
  const stages = computeStages(q, visa_path);
  const warnings = computeWarnings(q);
  const timelineHints = computeTimeline(q, visa_path, q.signed_date);
  const requires_tb_test = stages.some(s => s.stage_code === 'stage_14');

  return { visa_path, stages, warnings, timelineHints, requires_tb_test };
}
