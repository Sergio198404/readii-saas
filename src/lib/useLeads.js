import { useState, useEffect } from 'react'
import { supabase } from './supabase'

function todayMMDD() {
  const d = new Date()
  return String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
}

/**
 * 从 Supabase 读取 leads + 实时订阅变更
 * 返回 { leads, filteredLeads, counts, loading, error }
 */
export function useLeads(filter = 'all', searchQuery = '') {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 初始加载
  useEffect(() => {
    fetchLeads()
  }, [])

  // 实时订阅
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLeads(prev => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new : l))
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(l => l.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchLeads() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setLeads(data)
    }
    setLoading(false)
  }

  // 计算统计数字
  const today = todayMMDD()
  const counts = {
    p1:    leads.filter(l => l.p === 'P1').length,
    p2:    leads.filter(l => l.p === 'P2').length,
    today: leads.filter(l => l.follow === today).length,
    won:   leads.filter(l => l.s === 'S4').length,
    total: leads.length,
  }

  // 侧栏 badge 计数
  const badgeCounts = {
    all:    leads.length,
    today:  counts.today,
    P1:     counts.p1,
    P2:     leads.filter(l => l.p === 'P2').length,
    S0:     leads.filter(l => l.s === 'S0').length,
    active: leads.filter(l => ['S1','S2','S3'].includes(l.s)).length,
    S4:     counts.won,
    S5:     leads.filter(l => l.s === 'S5').length,
    IFV:    leads.filter(l => l.prod === 'IFV').length,
    SW:     leads.filter(l => l.prod === 'SW').length,
    PlanB:  leads.filter(l => l.prod === 'PlanB').length,
  }

  // 根据筛选条件过滤
  let filteredLeads = leads
  switch (filter) {
    case 'today':  filteredLeads = leads.filter(l => l.follow === today); break
    case 'P1':     filteredLeads = leads.filter(l => l.p === 'P1'); break
    case 'P2':     filteredLeads = leads.filter(l => l.p === 'P2'); break
    case 'S0':     filteredLeads = leads.filter(l => l.s === 'S0'); break
    case 'active': filteredLeads = leads.filter(l => ['S1','S2','S3'].includes(l.s)); break
    case 'S4':     filteredLeads = leads.filter(l => l.s === 'S4'); break
    case 'S5':     filteredLeads = leads.filter(l => l.s === 'S5'); break
    case 'IFV':    filteredLeads = leads.filter(l => l.prod === 'IFV'); break
    case 'SW':     filteredLeads = leads.filter(l => l.prod === 'SW'); break
    case 'PlanB':  filteredLeads = leads.filter(l => l.prod === 'PlanB'); break
    default:       break // 'all'
  }

  // 搜索过滤
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase()
    filteredLeads = filteredLeads.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.channel || '').toLowerCase().includes(q) ||
      (l.prod || '').toLowerCase().includes(q) ||
      (l.note || '').toLowerCase().includes(q)
    )
  }

  return { leads, filteredLeads, counts, badgeCounts, loading, error, refetch: fetchLeads }
}
