import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/layout/Sidebar'
import { listCustomerProfiles } from '../../lib/api/admin'
import './AdminPages.css'

export default function CustomersList() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listCustomerProfiles().then(setCustomers).finally(() => setLoading(false))
  }, [])

  return (
    <div className="app-layout">
      <Sidebar badgeCounts={{}} />
      <main className="main ap-page">
        <header className="ap-header">
          <div><h1 className="ap-title">客户管理</h1><div className="ap-subtitle">查看和管理付费客户的服务进度</div></div>
        </header>
        <div className="ap-body">
          {loading ? <div className="ap-empty">加载中...</div> : customers.length === 0 ? <div className="ap-empty">暂无付费客户</div> : (
            <table className="ap-table">
              <thead><tr><th>客户</th><th>服务类型</th><th>签约日期</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td style={{fontWeight:600}}>{c.profiles?.full_name || c.profiles?.email || '—'}</td>
                    <td>{c.service_type}</td>
                    <td>{c.signed_date}</td>
                    <td><span className={`ap-status ${c.status === 'active' ? 'complete' : 'incomplete'}`}>{c.status}</span></td>
                    <td className="ap-actions"><button onClick={() => navigate(`/admin/customers/${c.id}/progress`)}>管理进度</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
