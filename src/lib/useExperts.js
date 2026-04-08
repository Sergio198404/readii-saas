import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useExperts() {
  const [experts, setExperts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('experts').select('*').order('created_at', { ascending: true })
      setExperts(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return { experts, loading }
}
