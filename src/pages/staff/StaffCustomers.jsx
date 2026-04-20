import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function StaffCustomers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('customer_profiles')
      .select('id, service_type, signed_date, status, questionnaire_completed, visa_path, expected_completion_date, profiles:user_id(full_name, email)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCustomers(data || []); setLoading(false) })
  }, [])

  if (loading) return <div style={{padding:20,color:'var(--text-muted)',fontSize:13}}>加载中...</div>

  return (
    <div>
      <h1 style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,margin:'0 0 4px'}}>所有客户</h1>
      <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>
        共 {customers.length} 位客户 · 点击进入详情
      </div>

      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead>
          <tr style={{textAlign:'left',borderBottom:'1px solid var(--border-subtle)'}}>
            <th style={{padding:'10px 8px',fontSize:11,textTransform:'uppercase',color:'var(--text-muted)'}}>客户</th>
            <th style={{padding:'10px 8px',fontSize:11,textTransform:'uppercase',color:'var(--text-muted)'}}>服务</th>
            <th style={{padding:'10px 8px',fontSize:11,textTransform:'uppercase',color:'var(--text-muted)'}}>路径</th>
            <th style={{padding:'10px 8px',fontSize:11,textTransform:'uppercase',color:'var(--text-muted)'}}>签约</th>
            <th style={{padding:'10px 8px',fontSize:11,textTransform:'uppercase',color:'var(--text-muted)'}}>问卷</th>
            <th style={{padding:'10px 8px',fontSize:11,textTransform:'uppercase',color:'var(--text-muted)'}}>状态</th>
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
              <td style={{padding:'10px 8px',fontWeight:500}}>
                <Link to={`/staff/customers/${c.id}`} style={{color:'#1B2A4A',textDecoration:'none'}}>
                  {c.profiles?.full_name || c.profiles?.email || '—'}
                </Link>
              </td>
              <td style={{padding:'10px 8px'}}>{c.service_type}</td>
              <td style={{padding:'10px 8px'}}>{c.visa_path === 'a_inside_uk' ? '路径 A' : c.visa_path === 'b_outside_uk' ? '路径 B' : '—'}</td>
              <td style={{padding:'10px 8px'}}>{c.signed_date}</td>
              <td style={{padding:'10px 8px'}}>
                <span style={{
                  fontSize:11,padding:'2px 8px',borderRadius:100,
                  background: c.questionnaire_completed ? '#e6f4ea' : '#fff4e0',
                  color: c.questionnaire_completed ? '#1e7a3c' : '#b8741a',
                }}>
                  {c.questionnaire_completed ? '已完成' : '未完成'}
                </span>
              </td>
              <td style={{padding:'10px 8px'}}>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
