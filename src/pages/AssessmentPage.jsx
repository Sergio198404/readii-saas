import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import './AssessmentPage.css'

const SECTIONS = [
  { title: '基本信息', count: 4 },
  { title: '当前身份状态', count: 4 },
  { title: '职业与商业背景', count: 4 },
  { title: '目标与预期', count: 3 },
  { title: '补充说明', count: 1 },
]
const TOTAL_Q = 16

function Radio({ name, options, value, onChange }) {
  return (
    <div className="as-options">
      {options.map(o => (
        <label key={o} className={`as-option ${value === o ? 'selected' : ''}`}>
          <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  )
}

function MultiCheck({ options, value = [], onChange, max }) {
  function toggle(o) {
    if (value.includes(o)) onChange(value.filter(v => v !== o))
    else if (!max || value.length < max) onChange([...value, o])
  }
  return (
    <div className="as-options">
      {options.map(o => (
        <label key={o} className={`as-option ${value.includes(o) ? 'selected' : ''}`}>
          <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  )
}

export default function AssessmentPage() {
  const [params] = useSearchParams()
  const refCode = params.get('ref') || ''
  const [a, setA] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const topRef = useRef(null)

  useEffect(() => {
    if (refCode) setA(prev => ({ ...prev, Q4: '渠道合作伙伴' }))
  }, [refCode])

  function set(q, val) { setA(prev => ({ ...prev, [q]: val })) }

  const answered = Object.keys(a).filter(k => {
    const v = a[k]
    return v && (typeof v === 'string' ? v.trim() : v.length > 0)
  }).length
  const pct = Math.round((answered / TOTAL_Q) * 100)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!a.Q1?.trim()) return setError('请填写姓名')
    if (!a.Q3?.trim()) return setError('请填写联系方式')
    if (!a.Q5) return setError('请选择您目前持有的签证类型')

    setSubmitting(true)
    try {
      const res = await fetch('/.netlify/functions/submit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: a, ref_code: refCode || null }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || '提交失败')
      setDone(true)
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="as-page">
        <div className="as-doc">
          <div className="as-success">
            <div className="as-success-icon">✓</div>
            <h2>提交成功</h2>
            <p>感谢您填写可行性评估问卷。苏晓宇会在1个工作日内通过您提供的联系方式与您沟通。</p>
            <p style={{fontSize:13,color:'var(--as-ink3)',marginTop:16}}>在此期间，您可以添加苏晓宇的微信：<strong>xiaoyusu_readii</strong></p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="as-page">
      <div className="as-doc" ref={topRef}>
        <header className="as-header">
          <div className="as-brand">Readii</div>
          <h1 className="as-title">英国签证可行性评估</h1>
          <p className="as-subtitle">请花5分钟完成以下问题，帮助我们在通话前充分了解您的情况，为您提供精准的路线建议。</p>
        </header>

        <div className="as-progress">
          <div className="as-progress-bar" style={{ width: `${pct}%` }} />
          <span className="as-progress-label">{pct}% 已完成</span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Section 1 */}
          <div className="as-section">
            <div className="as-section-head"><span className="as-section-n">01</span>基本信息</div>

            <div className="as-q">
              <label className="as-q-label">Q1 · 您的姓名 <span className="as-required">*</span></label>
              <input className="as-input" value={a.Q1 || ''} onChange={e => set('Q1', e.target.value)} placeholder="请输入姓名" />
            </div>

            <div className="as-q">
              <label className="as-q-label">Q2 · 您目前所在地</label>
              <Radio name="Q2" value={a.Q2} onChange={v => set('Q2', v)} options={['英国境内', '中国大陆', '香港/澳门', '其他']} />
            </div>

            <div className="as-q">
              <label className="as-q-label">Q3 · 您的联系方式 <span className="as-required">*</span></label>
              <input className="as-input" value={a.Q3 || ''} onChange={e => set('Q3', e.target.value)} placeholder="微信号或手机号均可" />
            </div>

            {!refCode && (
              <div className="as-q">
                <label className="as-q-label">Q4 · 您是如何了解到 Readii 的？</label>
                <Radio name="Q4" value={a.Q4} onChange={v => set('Q4', v)} options={['朋友推荐', '微信/视频号', '小红书', '抖音', '搜索引擎', '渠道合作伙伴', '其他']} />
              </div>
            )}
          </div>

          {/* Section 2 */}
          <div className="as-section">
            <div className="as-section-head"><span className="as-section-n">02</span>当前身份状态</div>

            <div className="as-q">
              <label className="as-q-label">Q5 · 您目前持有的签证类型 <span className="as-required">*</span></label>
              <Radio name="Q5" value={a.Q5} onChange={v => set('Q5', v)} options={[
                '毕业生工作签证（PSW/Graduate）', '学生签证（Student Visa）',
                '工作签证（Skilled Worker）', '创新签证（Innovator Founder）',
                '访客签证（Visitor）', '暂无英国签证（在国内）', '其他',
              ]} />
            </div>

            <div className="as-q">
              <label className="as-q-label">Q6 · 您当前签证的到期时间</label>
              <Radio name="Q6" value={a.Q6} onChange={v => set('Q6', v)} options={[
                '6个月内到期', '6-12个月内到期', '1年以上', '暂无英国签证',
              ]} />
            </div>

            <div className="as-q">
              <label className="as-q-label">Q7 · 您是否已在英国注册公司？</label>
              <Radio name="Q7" value={a.Q7} onChange={v => set('Q7', v)} options={[
                '是，已注册', '正在办理', '尚未注册', '不确定是否需要',
              ]} />
            </div>

            <div className="as-q">
              <label className="as-q-label">Q8 · 您的家庭情况（可多选）</label>
              <MultiCheck options={[
                '配偶/伴侣需要一同办理签证', '子女需要一同办理签证',
                '子女目前在英国就读', '仅本人，无家庭成员需求',
              ]} value={a.Q8 || []} onChange={v => set('Q8', v)} />
            </div>
          </div>

          {/* Section 3 */}
          <div className="as-section">
            <div className="as-section-head"><span className="as-section-n">03</span>职业与商业背景</div>

            <div className="as-q">
              <label className="as-q-label">Q9 · 您的主要职业领域</label>
              <Radio name="Q9" value={a.Q9} onChange={v => set('Q9', v)} options={[
                '科技/互联网', '金融/投资', '教育/培训', '餐饮/零售/消费品',
                '旅游/酒店/文旅', '医疗/健康', '制造业/工业', '创意/设计/媒体',
                '咨询/专业服务', '其他',
              ]} />
            </div>

            <div className="as-q">
              <label className="as-q-label">Q10 · 您的从业年限</label>
              <Radio name="Q10" value={a.Q10} onChange={v => set('Q10', v)} options={['3年以下', '3-5年', '5-10年', '10年以上']} />
            </div>

            <div className="as-q">
              <label className="as-q-label">Q11 · 您是否有意在英国开展商业活动或创业？</label>
              <Radio name="Q11" value={a.Q11} onChange={v => set('Q11', v)} options={[
                '是，已有明确商业计划', '是，初步有想法但尚未成型',
                '主要目的是居留，商业是附带', '暂不确定',
              ]} />
            </div>

            <div className="as-q">
              <label className="as-q-label">Q12 · 您是否有合伙人或业务联系人在英国？</label>
              <Radio name="Q12" value={a.Q12} onChange={v => set('Q12', v)} options={[
                '有，且对方持有英国永居或公民身份', '有，但对方也是临时签证', '暂时没有',
              ]} />
            </div>
          </div>

          {/* Section 4 */}
          <div className="as-section">
            <div className="as-section-head"><span className="as-section-n">04</span>目标与预期</div>

            <div className="as-q">
              <label className="as-q-label">Q13 · 您希望达到的主要目标（最多选3项）</label>
              <MultiCheck max={3} options={[
                '在英国长期合法居留', '让子女在英国接受教育', '在英国开展或扩展业务',
                '获得永久居留权（ILR）', '为将来入籍做准备', '家庭团聚', '资产配置与财务规划',
              ]} value={a.Q13 || []} onChange={v => set('Q13', v)} />
            </div>

            <div className="as-q">
              <label className="as-q-label">Q14 · 您希望在多久内完成签证申请？</label>
              <Radio name="Q14" value={a.Q14} onChange={v => set('Q14', v)} options={[
                '尽快（3个月内）', '3-6个月内', '6-12个月内', '还在了解阶段，暂无时间表',
              ]} />
            </div>

            <div className="as-q">
              <label className="as-q-label">Q15 · 您对签证服务的预算范围</label>
              <Radio name="Q15" value={a.Q15} onChange={v => set('Q15', v)} options={[
                '£5,000 以下', '£5,000 – £20,000', '£20,000 – £50,000', '£50,000 以上', '预算取决于方案和结果',
              ]} />
            </div>
          </div>

          {/* Section 5 */}
          <div className="as-section">
            <div className="as-section-head"><span className="as-section-n">05</span>补充说明</div>

            <div className="as-q">
              <label className="as-q-label">Q16 · 还有什么您认为重要的情况，希望顾问在通话前了解的？</label>
              <textarea className="as-textarea" value={a.Q16 || ''} onChange={e => set('Q16', e.target.value.slice(0, 300))} maxLength={300} placeholder="例如：特殊家庭情况、过往签证记录、时间紧迫原因等" rows={4} />
              <div className="as-char-count">{(a.Q16 || '').length}/300</div>
            </div>
          </div>

          {error && <div className="as-error">{error}</div>}

          <div className="as-submit-area">
            <button type="submit" className="as-submit" disabled={submitting}>
              {submitting ? '提交中...' : '提交评估问卷'}
            </button>
            <p className="as-privacy">提交即表示您同意 Readii 依据英国 GDPR 处理您的个人信息。我们仅将这些信息用于签证咨询服务，不会向第三方分享。</p>
          </div>
        </form>

        <footer className="as-footer">
          <div className="as-footer-brand">Readii Limited</div>
          <div className="as-footer-info">Company No. 15002332 · ICO: ZB712826 · Canterbury, UK</div>
        </footer>
      </div>
    </div>
  )
}
