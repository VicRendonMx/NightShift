import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Neighbourhood, VenuePhoto } from '../types/database'

export type VenueRow = {
  id: string
  name: string
  slug: string | null
  address: string | null
  lat: number | null
  lng: number | null
  venue_type: 'nightclub' | 'bar' | 'lounge' | 'rooftop' | 'afterhours' | 'live_music' | 'comedy' | null
  vibe_tags: string[] | null
  music_genres: string[] | null
  google_rating: number | null
  google_review_count: number | null
  has_cover_charge: boolean
  cover_notes: string | null
  neighbourhood: Pick<Neighbourhood, 'id' | 'name' | 'slug'> | null
  primary_photo_url: string | null
  is_open_now: boolean
  opens_at: string | null
  closes_at: string | null
  is_late_night: boolean
}

export function useVenues() {
  const [venues, setVenues] = useState<VenueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const now = new Date()
      // DB day_of_week: 0=Monday … 6=Sunday. JS getDay(): 0=Sun, 1=Mon … 6=Sat
      const dbDay = (now.getDay() + 6) % 7
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const currentTime = `${hh}:${mm}:00`

      const [venueRes, hoursRes] = await Promise.all([
        supabase
          .from('venue')
          .select(`
            id, name, slug, address, lat, lng, venue_type, vibe_tags, music_genres,
            google_rating, google_review_count, has_cover_charge, cover_notes,
            neighbourhood:neighbourhood_id(id, name, slug),
            venue_photo(url, is_primary, sort_order)
          `)
          .eq('is_active', true)
          .order('google_rating', { ascending: false })
          .limit(150),
        supabase
          .from('hours')
          .select('venue_id, open_time, close_time, is_closed, is_after_hours')
          .eq('day_of_week', dbDay)
          .eq('is_closed', false),
      ])

      if (venueRes.error) throw venueRes.error
      if (hoursRes.error) throw hoursRes.error

      const hoursMap = new Map(
        (hoursRes.data ?? []).map(h => [h.venue_id, h])
      )

      const rows: VenueRow[] = (venueRes.data ?? []).map(v => {
        const photos = ((v.venue_photo ?? []) as VenuePhoto[])
          .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order)
        const primaryUrl = photos[0]?.url ?? null

        const h = hoursMap.get(v.id)
        const isOpenNow = h ? checkOpen(h.open_time, h.close_time, currentTime) : false
        const isLateNight = h ? checkLateNight(h.close_time) : false

        return {
          id: v.id,
          name: v.name,
          slug: v.slug,
          address: v.address,
          lat: (v as any).lat ?? null,
          lng: (v as any).lng ?? null,
          venue_type: v.venue_type,
          vibe_tags: v.vibe_tags,
          music_genres: v.music_genres,
          google_rating: v.google_rating,
          google_review_count: v.google_review_count,
          has_cover_charge: v.has_cover_charge,
          cover_notes: v.cover_notes,
          neighbourhood: v.neighbourhood as Pick<Neighbourhood, 'id' | 'name' | 'slug'> | null,
          primary_photo_url: primaryUrl,
          is_open_now: isOpenNow,
          opens_at: h?.open_time ?? null,
          closes_at: h?.close_time ?? null,
          is_late_night: isLateNight,
        }
      })

      setVenues(rows)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load venues')
    } finally {
      setLoading(false)
    }
  }

  return { venues, loading, error }
}

function checkOpen(open: string | null, close: string | null, now: string): boolean {
  if (!open || !close) return false
  if (close < open) return now >= open || now <= close
  return now >= open && now <= close
}

function checkLateNight(close: string | null): boolean {
  if (!close) return false
  return close >= '02:00:00' || close < '12:00:00'
}
