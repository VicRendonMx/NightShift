import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Deal {
  id: string
  venue_id: string
  title: string
  description: string | null
  discount_type: string | null
  day_of_week: number | null
  start_time: string | null
  end_time: string | null
  is_active: boolean
  venue?: { name: string; neighbourhood?: { name: string } | null }
}

function getTodayDbDay(): number {
  // DB: 0=Sun ... 6=Sat matches JS getDay()
  return new Date().getDay()
}

export function useDeals(venueId?: string) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [venueId])

  async function load() {
    setLoading(true)
    const today = getTodayDbDay()

    let query = supabase
      .from('deal')
      .select(`
        id, venue_id, title, description, discount_type,
        day_of_week, start_time, end_time, is_active,
        venue:venue_id ( name, neighbourhood:neighbourhood_id ( name ) )
      `)
      .eq('is_active', true)
      .or(`day_of_week.is.null,day_of_week.eq.${today}`)
      .order('start_time')

    if (venueId) query = query.eq('venue_id', venueId)

    const { data } = await query.limit(20)
    if (data) setDeals(data as any)
    setLoading(false)
  }

  return { deals, loading, refetch: load }
}

export function useTonightsDeals() {
  return useDeals(undefined)
}
