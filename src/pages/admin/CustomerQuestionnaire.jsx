import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { getCustomerQuestionnaire, saveQuestionnaireDraft, generateCustomerJourney } from '../../lib/api/admin'
import { runRuleEngine } from '../../lib/journeyRuleEngine'
import { SOC_CODES, socRequiresCriminalRecord } from '../../lib/socCodes'
import './AdminPages.css'
import './CustomerQuestionnaire.css'

const TOTAL_STEPS = 10

const Q1_OPTIONS = [
  { value: 'uk_psw', label: '英国境内（当前持 PSW 签证）' },
  { value: 'uk_other', label: '英国境内（其他签证类型）' },
  { value: 'overseas', label: '英国境外' },
]
const Q2_OPTIONS = [
  { value: 'cn_mainland', label: '中国大陆' },
  { value: 'cn_hk_mo', label: '中国香港 / 澳门' },
  { value: 'tw', label: '中国台湾' },
  { value: 'english_native', label: '英语母语国家' },
  { value: 'other', label: '其他' },
]
const Q3_OPTIONS = [
  { value: 'lt_6', label: '不足 6 个月', badge: 'red' },
  { value: '6_to_12', label: '6 至 12 个月', badge: 'orange' },
  { value: 'gt_12', label: '超过 12 个月' },
  { value: 'na', label: '不适用（境外申请）' },
]
const Q4_OPTIONS = [
  { value: 'uk_degree', label: '持有英国学位' },
  { value: 'english_native', label: '毕业于英语母语国家' },
  { value: 'ecctis', label: '需要 Ecctis 认证非英语国家学位', badge: 'orange' },
  { value: 'has_valid_score', label: '已有有效的英语成绩（IELTS 等）' },
  { value: 'need_exam', label: '需要重新考取英语成绩', badge: 'orange' },
]
const Q7_OPTIONS = [
  { value: 'lt_50k', label: '不足 £50,000', badge: 'red' },
  { value: '50k_to_100k', label: '£50,000 – £100,000', badge: 'orange' },
  { value: 'gt_100k', label: '£100,000 以上' },
]
const Q8_OPTIONS = [
  { value: 'investor_only', label: '仅投资人持股（投资人 100%）' },
  { value: 'investor_plus_employee', label: '投资人 + 雇员共同持股' },
]
const Q9_OPTIONS = [
  { value: 'investor', label: '投资人本人担任 AO' },
  { value: 'employee', label: '由雇员担任 AO', badge: 'orange' },
  { value: 'third_party', label: '第三方担任 AO' },
  { value: 'undecided', label: '尚未确定', badge: 'red' },
]
const Q10_OPTIONS = [
  { value: true, label: '是，需要运营陪跑' },
  { value: false, label: '否，不需要' },
]

const COMMON_COUNTRIES = [
  '中国', '香港', '澳门', '台湾', '英国', '美国', '加拿大',
  '澳大利亚', '新西兰', '新加坡', '马来西亚', '日本', '韩国',
  '德国', '法国', '西班牙', '意大利', '荷兰',
]

const VISA_PATH_LABELS = { a_inside_uk: '路径 A（英国境内转签）', b_outside_uk: '路径 B（境外申请）' }
const NATIONALITY_LABELS = Object.fromEntries(Q2_OPTIONS.map(o => [o.value, o.label]))
const ENGLISH_LABELS = Object.fromEntries(Q4_OPTIONS.map(o => [o.value, o.label]))
const CAPITAL_LABELS = Object.fromEntries(Q7_OPTIONS.map(o => [o.value, o.label]))
const STRUCTURE_LABELS = Object.fromEntries(Q8_OPTIONS.map(o => [o.value, o.label]))
const AO_LABELS = Object.fromEntries(Q9_OPTIONS.map(o => [o.value, o.label]))

function OptionList({ value, options, onChange }) {
  return (
    <div className="qw-options">
      {options.map(o => {
        const selected = value === o.value
        return (
          <label key={String(o.value)} className={`qw-option ${selected ? 'selected' : ''}`}>
            <input type="radio" checked={selected} onChange={() => onChange(o.value)} />
            <span className="qw-option-label">{o.label}</span>
            {o.badge === 'orange' && <span className="qw-option-badge qw-badge-orange">⚠️ 需注意</span>}
            {o.badge === 'red' && <span className="qw-option-badge qw-badge-red">🔴 关键</span>}
          </label>
        )
      })}
    </div>
  )
}

function stepNeedsQ6(answers) {
  return !!answers.requires_criminal_record
}

function visibleStep(rawStep, answers) {
  // Q6 hidden unless Q5 flagged requires_criminal_record.
  // When hidden, map rawStep through to skip it both directions.
  if (rawStep === 6 && !stepNeedsQ6(answers)) return null
  return rawStep
}

function nextStep(step, answers) {
  let s = step + 1
  while (s <= TOTAL_STEPS + 1 && visibleStep(s, answers) === null) s++
  return s
}

function prevStep(step, answers) {
  let s = step - 1
  while (s > 0 && visibleStep(s, answers) === null) s--
  return Math.max(s, 1)
}

export default function CustomerQuestionnaire() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [customer, setCustomer] = useState(null)
  const [answers, setAnswers] = useState({
    employee_location: null,
    employee_nationality: null,
    current_visa_remaining_months: null,
    employee_english_status: null,
    target_soc_code: '',
    requires_criminal_record: false,
    countries_lived: [],
    startup_capital: null,
    company_structure: null,
    ao_candidate: null,
    needs_mentoring: false,
  })

  useEffect(() => {
    (async () => {
      try {
        const data = await getCustomerQuestionnaire(customerId)
        setCustomer(data.customer)
        if (data.customer) {
          setAnswers(a => ({
            ...a,
            employee_location: data.customer.employee_location,
            employee_nationality: data.customer.employee_nationality,
            current_visa_remaining_months: data.customer.current_visa_remaining_months,
            employee_english_status: data.customer.employee_english_status,
            target_soc_code: data.customer.target_soc_code || '',
            requires_criminal_record: !!data.customer.requires_criminal_record,
            countries_lived: data.customer.countries_lived || [],
            startup_capital: data.customer.startup_capital,
            company_structure: data.customer.company_structure,
            ao_candidate: data.customer.ao_candidate,
            needs_mentoring: !!data.customer.needs_mentoring,
          }))
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [customerId])

  const rulePreview = useMemo(() => {
    if (!customer) return null
    return runRuleEngine({ ...answers, signed_date: customer.signed_date })
  }, [answers, customer])

  function patch(update) { setAnswers(a => ({ ...a, ...update })) }

  function selectSoc(code) {
    const requires = socRequiresCriminalRecord(code)
    patch({
      target_soc_code: code,
      requires_criminal_record: requires,
      countries_lived: requires ? answers.countries_lived : [],
    })
  }

  function toggleCountry(c) {
    const next = answers.countries_lived.includes(c)
      ? answers.countries_lived.filter(x => x !== c)
      : [...answers.countries_lived, c]
    patch({ countries_lived: next })
  }

  async function saveAndGo(direction) {
    setSaving(true)
    try {
      await saveQuestionnaireDraft(customerId, answers)
      if (direction === 'next') setStep(s => nextStep(s, answers))
      else setStep(s => prevStep(s, answers))
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm() {
    setGenerating(true)
    try {
      const result = await generateCustomerJourney(customerId)
      alert(`已生成 Journey：共 ${result.stageCount} 个阶段`)
      navigate(`/admin/customers/${customerId}/progress`)
    } catch (e) {
      alert('生成失败：' + (e.message || e))
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="app-layout"><Sidebar badgeCounts={{}} />
        <main className="main ap-page"><div className="ap-empty">加载中...</div></main>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="app-layout"><Sidebar badgeCounts={{}} />
        <main className="main ap-page"><div className="ap-empty">未找到客户记录</div></main>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div>
            <button className="ap-back" onClick={() => navigate('/admin/customers')}>← 返回客户列表</button>
            <h1 className="ap-title">{customer.profiles?.full_name || customer.profiles?.email || '客户'} · 画像问卷</h1>
            <div className="ap-subtitle">
              {customer.questionnaire_completed ? '已完成（可修改后重新生成 Journey）' : '内部用：10 问调研客户背景，自动生成定制 Journey'}
            </div>
          </div>
        </header>

        <div className="qw-container">
          {customer.questionnaire_completed && step <= TOTAL_STEPS && (
            <div className="qw-completed-badge">
              ✓ 此客户问卷已提交过。如修改答案，需重新进入预览并确认生成，Journey 将被重置。
            </div>
          )}

          {step <= TOTAL_STEPS && (
            <div className="qw-step-indicator">步骤 {step} / {TOTAL_STEPS}</div>
          )}

          {step === 1 && (
            <StepFrame
              title="雇员当前所在地？"
              help="境外申请走路径 B（SL → CoS → 境外工签），境内走路径 A（SL → 境内转签）。"
            >
              <OptionList value={answers.employee_location} options={Q1_OPTIONS} onChange={v => patch({ employee_location: v })} />
            </StepFrame>
          )}

          {step === 2 && (
            <StepFrame
              title="雇员国籍？"
              help="中国大陆/港澳籍在境外路径需要额外 TB 体检；英语母语国家影响英语要求。"
            >
              <OptionList value={answers.employee_nationality} options={Q2_OPTIONS} onChange={v => patch({ employee_nationality: v })} />
            </StepFrame>
          )}

          {step === 3 && (
            <StepFrame
              title="当前签证剩余有效期？"
              help="整个流程需 12-14 个月，若签证剩余不足 6 个月须评估过桥方案。"
            >
              <OptionList value={answers.current_visa_remaining_months} options={Q3_OPTIONS} onChange={v => patch({ current_visa_remaining_months: v })} />
            </StepFrame>
          )}

          {step === 4 && (
            <StepFrame
              title="雇员英语背景？"
              help="Ecctis 认证无加急选项（最长 20 工作日），需尽早启动。"
            >
              <OptionList value={answers.employee_english_status} options={Q4_OPTIONS} onChange={v => patch({ employee_english_status: v })} />
            </StepFrame>
          )}

          {step === 5 && (
            <StepFrame
              title="目标 SOC Code？"
              help="岗位类别影响薪资门槛及是否需要无犯罪证明。教育、医疗、社工类岗位需提供 CRC。"
            >
              <select
                className="qw-select"
                value={answers.target_soc_code}
                onChange={e => selectSoc(e.target.value)}
              >
                <option value="">-- 请选择 SOC Code --</option>
                {SOC_CODES.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.label}{s.requires_crc ? '（需 CRC）' : ''}
                  </option>
                ))}
              </select>
              {answers.target_soc_code && !SOC_CODES.find(s => s.code === answers.target_soc_code) && (
                <input
                  className="qw-text-input"
                  value={answers.target_soc_code}
                  onChange={e => patch({ target_soc_code: e.target.value })}
                  placeholder="自定义 SOC Code"
                />
              )}
              <label className="qw-option" style={{marginTop: 8}}>
                <input
                  type="checkbox"
                  checked={answers.requires_criminal_record}
                  onChange={e => patch({ requires_criminal_record: e.target.checked, countries_lived: e.target.checked ? answers.countries_lived : [] })}
                />
                <span className="qw-option-label">此岗位需要无犯罪证明（CRC）</span>
              </label>
            </StepFrame>
          )}

          {step === 6 && stepNeedsQ6(answers) && (
            <StepFrame
              title="过去 10 年曾居住满 12 个月的国家？"
              help="每个国家都需分别办理无犯罪证明，多国记录会显著拉长时间线。"
            >
              <div className="qw-countries">
                {COMMON_COUNTRIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`qw-country-chip ${answers.countries_lived.includes(c) ? 'selected' : ''}`}
                    onClick={() => toggleCountry(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <input
                className="qw-text-input"
                placeholder="其他国家（逗号分隔），补充后按回车"
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    patch({ countries_lived: [...new Set([...answers.countries_lived, ...parts])] })
                    e.target.value = ''
                  }
                }}
              />
              {answers.countries_lived.length > 0 && (
                <div style={{fontSize: 12, color: 'var(--text-muted)', marginBottom: 12}}>
                  已选：{answers.countries_lived.join('、')}
                </div>
              )}
            </StepFrame>
          )}

          {step === 7 && (
            <StepFrame
              title="可动用启动资金？"
              help="SL 申请银行余额须达 £50K 以上；低于此值会被视为 genuine vacancy 风险。"
            >
              <OptionList value={answers.startup_capital} options={Q7_OPTIONS} onChange={v => patch({ startup_capital: v })} />
            </StepFrame>
          )}

          {step === 8 && (
            <StepFrame
              title="计划的公司股权结构？"
              help="雇员持股会影响 genuine employment 审查逻辑，UKVI 将加强审核。"
            >
              <OptionList value={answers.company_structure} options={Q8_OPTIONS} onChange={v => patch({ company_structure: v })} />
            </StepFrame>
          )}

          {step === 9 && (
            <StepFrame
              title="Authorising Officer (AO) 人选？"
              help="AO 代表公司与 UKVI 沟通，须是公司主要负责人。未确定会阻断公司注册阶段。"
            >
              <OptionList value={answers.ao_candidate} options={Q9_OPTIONS} onChange={v => patch({ ao_candidate: v })} />
            </StepFrame>
          )}

          {step === 10 && (
            <StepFrame
              title="是否需要 Readii 提供运营陪跑？"
              help="运营陪跑包含 Sponsor Licence 获批后的日常合规咨询、人事管理指导等。"
            >
              <OptionList
                value={answers.needs_mentoring}
                options={Q10_OPTIONS}
                onChange={v => patch({ needs_mentoring: v })}
              />
            </StepFrame>
          )}

          {step === 11 && rulePreview && (
            <PreviewStep
              customer={customer}
              answers={answers}
              rulePreview={rulePreview}
            />
          )}

          <div className="qw-nav">
            {step > 1 && step <= TOTAL_STEPS && (
              <button className="ap-ghost-btn" onClick={() => saveAndGo('prev')} disabled={saving}>← 上一步</button>
            )}
            {step === 11 && (
              <button className="ap-ghost-btn" onClick={() => setStep(TOTAL_STEPS)}>← 返回修改</button>
            )}
            <div style={{flex: 1}} />
            {step < TOTAL_STEPS && (
              <button
                className="ap-add-btn"
                onClick={() => saveAndGo('next')}
                disabled={saving || !isStepValid(step, answers)}
              >
                {saving ? '保存中...' : '下一步 →'}
              </button>
            )}
            {step === TOTAL_STEPS && (
              <button
                className="ap-add-btn"
                onClick={() => saveAndGo('next')}
                disabled={saving || !isStepValid(step, answers)}
              >
                {saving ? '保存中...' : '预览画像 →'}
              </button>
            )}
            {step === 11 && (
              <button
                className="ap-add-btn"
                onClick={handleConfirm}
                disabled={generating || !canGenerate(answers)}
              >
                {generating ? '生成中...' : '确认，生成 Journey'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function StepFrame({ title, help, children }) {
  return (
    <>
      <h2 className="qw-question-title">{title}</h2>
      <p className="qw-question-help">{help}</p>
      {children}
    </>
  )
}

function isStepValid(step, a) {
  switch (step) {
    case 1: return !!a.employee_location
    case 2: return !!a.employee_nationality
    case 3: return !!a.current_visa_remaining_months
    case 4: return !!a.employee_english_status
    case 5: return !!a.target_soc_code
    case 6: return !a.requires_criminal_record || a.countries_lived.length > 0
    case 7: return !!a.startup_capital
    case 8: return !!a.company_structure
    case 9: return !!a.ao_candidate
    case 10: return a.needs_mentoring === true || a.needs_mentoring === false
    default: return true
  }
}

function canGenerate(a) {
  return a.employee_location && a.employee_nationality && a.current_visa_remaining_months
    && a.employee_english_status && a.target_soc_code && a.startup_capital
    && a.company_structure && a.ao_candidate
}

function PreviewStep({ customer, answers, rulePreview }) {
  const { visa_path, stages, warnings, timelineHints, requires_tb_test } = rulePreview
  return (
    <div className="qw-preview">
      <h2>客户画像预览</h2>
      <dl>
        <dt>签证路径</dt>
        <dd>{VISA_PATH_LABELS[visa_path]}</dd>
        <dt>国籍</dt>
        <dd>{NATIONALITY_LABELS[answers.employee_nationality]}</dd>
        <dt>英语方案</dt>
        <dd>{ENGLISH_LABELS[answers.employee_english_status]}</dd>
        <dt>TB 体检</dt>
        <dd>{requires_tb_test ? '需要（中国大陆 / 港澳籍路径 B）' : '不需要'}</dd>
        <dt>无犯罪证明</dt>
        <dd>{answers.requires_criminal_record ? `需要（${answers.countries_lived.join('、') || '未填'}）` : '不需要'}</dd>
        <dt>SOC Code</dt>
        <dd>{answers.target_soc_code}</dd>
        <dt>公司结构</dt>
        <dd>{STRUCTURE_LABELS[answers.company_structure]}</dd>
        <dt>AO 人选</dt>
        <dd>{AO_LABELS[answers.ao_candidate]}</dd>
        <dt>启动资金</dt>
        <dd>{CAPITAL_LABELS[answers.startup_capital]}</dd>
        <dt>运营陪跑</dt>
        <dd>{answers.needs_mentoring ? '是' : '否'}</dd>
      </dl>

      <h3>定制 Journey（{stages.length} 个阶段）</h3>
      <div className="qw-stage-list">
        {stages.map(s => {
          const n = s.stage_code.replace('stage_', '')
          return <span key={s.stage_code}>阶段 {parseInt(n, 10)}{s.variant ? `（${s.variant}）` : ''}{' · '}</span>
        })}
      </div>

      {warnings.length > 0 && (
        <>
          <h3>前置风险预警</h3>
          <div className="qw-warning-list">
            {warnings.map(w => (
              <div key={w.code} className={`qw-warning ${w.severity}`}>{w.message}</div>
            ))}
          </div>
        </>
      )}

      <h3>预估关键时间节点</h3>
      <div className="qw-timeline">
        <div>签约起算日：<strong>{customer.signed_date}</strong></div>
        <div>预计 SL 递交：<strong>{timelineHints.sl_expected_submit}</strong></div>
        <div>预计 SL 获批：<strong>{timelineHints.sl_expected_approval}</strong></div>
        <div>预计工签递交：<strong>{timelineHints.visa_expected_submit}</strong></div>
        <div>预计工签获批：<strong>{timelineHints.visa_expected_approval}</strong></div>
        {timelineHints.tb_test_window_start && (
          <div>TB 体检窗口：<strong>{timelineHints.tb_test_window_start} 至 {timelineHints.tb_test_window_end}</strong></div>
        )}
      </div>
    </div>
  )
}
