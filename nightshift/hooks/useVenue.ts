import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Venue, VenuePhoto, Hours, Neighbourhood } from '../types/database'

export type VenueDetail = Venue & {
  neighbourhood: Pick<Neighbourhood, 'id' | 'name' | 'slug' | 'vibe_summary'> | null
}

export function useVenue(id: string) {
  const [venue, setVenue] = useState<VenueDetail | null>(null)
  const [photos, setPhotos] = useState<VenuePhoto[]>([])
  const [hours, setHours] = useState<Hours[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  async function load() {
    setLoading(true)
    try {
      const [venueRes, photosRes, hoursRes] = await Promise.all([
        supabase
          .from('venue')
          .select(`*, neighbourhood:neighbourhood_id(id, name, slug, vibe_summary)`)
          .eq('id', id)
          .single(),
        supabase
          .from('venue_photo')
          .select('*')
          .eq('venue_id', id)
          .order('is_primary', { ascending: false })
          .order('sort_order')
          .limit(10),
        supabase
          .from('hours')
          .select('*')
          .eq('venue_id', id)
          .order('day_of_week'),
      ])

      if (venueRes.error) throw venueRes.error
      setVenue(venueRes.data as VenueDetail)
      setPhotos(photosRes.data ?? [])
      setHours(hoursRes.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load venue')
    } finally {
      setLoading(false)
    }
  }

  return { venue, photos, hours, loading, error }
}

// Day labels matching DB convention: 0=Monday … 6=Sunday
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function getTodayDbDay(): number {
  // JS getDay(): 0=Sun, 1=Mon … 6=Sat → DB: 0=Mon … 6=Sun
  return (new Date().getDay() + 6) % 7
}

export function formatHourTime(t: string | null): string {
  if (!t) return '—'
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return mStr === '00' ? `${h12}${suffix}` : `${h12}:${mStr}${suffix}`
}

export function getDayLabel(dbDay: number): string {
  return DAY_LABELS[dbDay] ?? ''
}

export function isTodayOpen(hours: Hours[]): { open: boolean; openTime: string | null; closeTime: string | null } {
  const today = getTodayDbDay()
  const h = hours.find(r => r.day_of_week === today)
  if (!h || h.is_closed) return { open: false, openTime: null, closeTime: null }

  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const cur = `${hh}:${mm}:00`

  const open = h.open_time
  const close = h.close_time
  if (!open || !close) return { open: false, openTime: null, closeTime: null }

  const isOpen = close < open
    ? cur >= open || cur <= close
    : cur >= open && cur <= close

  return { open: isOpen, openTime: open, closeTime: close }
}
