import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface CrowdRow {
  venue_id: string
  crowd_level: number
  reported_at: string
}

export function useCrowdSignal(venueId: string | undefined) {
  const [crowdLevel, setCrowdLevel] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueId) { setLoading(false); return }
    load()
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`crowd:${venueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_crowd_signal', filter: `venue_id=eq.${venueId}` },
        payload => {
          const row = payload.new as CrowdRow
          if (row.crowd_level != null) setCrowdLevel(row.crowd_level)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [venueId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('live_crowd_signal')
      .select('crowd_level, reported_at')
      .eq('venue_id', venueId!)
      .order('reported_at', { ascending: false })
      .limit(1)
      .single()

    if (data) setCrowdLevel((data as any).crowd_level)
    setLoading(false)
  }

  return { crowdLevel, loading }
}

export function useVenueCrowdFromCheckins(venueId: string | undefined) {
  const [avgCrowd, setAvgCrowd] = useState<number | null>(null)
  const [checkInCount, setCheckInCount] = useState(0)

  useEffect(() => {
    if (!venueId) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    supabase
      .from('checkin')
      .select('crowd_rating')
      .eq('venue_id', venueId)
      .gte('checked_in_at', today.toISOString())
      .then(({ data }) => {
        if (!data || data.length === 0) return
        const avg = (data as any[]).reduce((s, r) => s + (r.crowd_rating ?? 0), 0) / data.length
        setAvgCrowd(Math.round(avg))
        setCheckInCount(data.length)
      })
  }, [venueId])

  return { avgCrowd, checkInCount }
}
