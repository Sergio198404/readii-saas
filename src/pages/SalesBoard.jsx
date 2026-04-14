import { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from '../components/layout/Sidebar'
import TopBar from '../components/layout/TopBar'
import MetricStrip from '../components/layout/MetricStrip'
import LeadList from '../components/leads/LeadList'
import EmailPanel from '../components/email/EmailPanel'
import AddLeadModal from '../components/modals/AddLeadModal'
import UpdateLeadModal from '../components/modals/UpdateLeadModal'
import MarkDealModal from '../components/modals/MarkDealModal'
import CoachDrawer from '../components/coach/CoachDrawer'
import { useLeads } from '../lib/useLeads'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import { summarizeDeal } from '../lib/commission'
import './SalesBoard.css'

export default function SalesBoard() {
  const { user } = useAuth()
  const [currentFilter, setCurrentFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updatingLead, setUpdatingLead] = useState(null)
  const [showCoach, setShowCoach] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dealingLead, setDealingLead] = useState(null)
  const [deals, setDeals] = useState([])

  const { leads, filteredLeads, counts, badgeCounts, loading, error, refetch } = useLeads(currentFilter, searchQuery)

  const fetchDeals = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('deals')
      .select('id, lead_id, contract_amount, platform_amount, status, deal_roles(user_id, role, amount)')
    if (!err) setDeals(data || [])
  }, [])

  useEffect(() => { fetchDeals() }, [fetchDeals])

  const dealSummaries = useMemo(() => {
    const map = {}
    for (const d of deals) {
      if (!d.lead_id) continue
      map[d.lead_id] = summarizeDeal({
        contractAmount: d.contract_amount,
        platformAmount: d.platform_amount,
        roles: d.deal_roles || [],
        currentUserId: user?.id,
      })
    }
    return map
  }, [deals, user?.id])

  return (
    <div className="app-layout">
      <Sidebar
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        badgeCounts={badgeCounts}
      />

      <main className="main">
        <TopBar
          onOpenAdd={() => { setEditingLead(null); setShowAddModal(true) }}
          onOpenCoach={() => setShowCoach(true)}
          onToggleEmail={() => setShowEmail(v => !v)}
          onSearch={setSearchQuery}
        />

        <MetricStrip counts={counts} />

        <div className="board-area">
          <EmailPanel open={showEmail} onClose={() => setShowEmail(false)} leads={leads} />

          {error && (
            <div style={{ color: 'var(--danger-text)', padding: '12px 0', fontSize: 13 }}>
              数据加载失败：{error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              加载中...
            </div>
          ) : (
            <LeadList
              leads={filteredLeads}
              dealSummaries={dealSummaries}
              onEdit={(lead) => { setEditingLead(lead); setShowAddModal(true) }}
              onUpdate={(lead) => { setUpdatingLead(lead); setShowUpdateModal(true) }}
              onAskCoach={(lead) => setShowCoach(true)}
              onDelete={async (lead) => { await supabase.from('leads').delete().eq('id', lead.id) }}
              onMarkDeal={(lead) => setDealingLead(lead)}
            />
          )}
        </div>
      </main>

      <AddLeadModal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingLead(null) }}
        editingLead={editingLead}
      />

      <UpdateLeadModal
        open={showUpdateModal}
        onClose={() => { setShowUpdateModal(false); setUpdatingLead(null) }}
        lead={updatingLead}
      />

      {dealingLead && (
        <MarkDealModal
          lead={dealingLead}
          onClose={() => setDealingLead(null)}
          onDone={async () => {
            setDealingLead(null)
            await Promise.all([refetch(), fetchDeals()])
          }}
        />
      )}

      <CoachDrawer
        open={showCoach}
        onClose={() => setShowCoach(false)}
        leads={leads}
      />
    </div>
  )
}
