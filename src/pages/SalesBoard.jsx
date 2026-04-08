import { useState } from 'react'
import Sidebar from '../components/layout/Sidebar'
import TopBar from '../components/layout/TopBar'
import MetricStrip from '../components/layout/MetricStrip'
import LeadList from '../components/leads/LeadList'
import EmailPanel from '../components/email/EmailPanel'
import AddLeadModal from '../components/modals/AddLeadModal'
import UpdateLeadModal from '../components/modals/UpdateLeadModal'
import CoachDrawer from '../components/coach/CoachDrawer'
import { useLeads } from '../lib/useLeads'
import { supabase } from '../lib/supabase'
import './SalesBoard.css'

export default function SalesBoard() {
  const [currentFilter, setCurrentFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updatingLead, setUpdatingLead] = useState(null)
  const [showCoach, setShowCoach] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { leads, filteredLeads, counts, badgeCounts, loading, error } = useLeads(currentFilter, searchQuery)

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
              onEdit={(lead) => { setEditingLead(lead); setShowAddModal(true) }}
              onUpdate={(lead) => { setUpdatingLead(lead); setShowUpdateModal(true) }}
              onAskCoach={(lead) => setShowCoach(true)}
              onDelete={async (lead) => { await supabase.from('leads').delete().eq('id', lead.id) }}
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

      <CoachDrawer
        open={showCoach}
        onClose={() => setShowCoach(false)}
        leads={leads}
      />
    </div>
  )
}
