import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Neighbourhood } from '../types/database'

export function useNeighbourhoods() {
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('neighbourhood')
      .select('*')
      .order('sort_order')
      .then(({ data, error }) => {
        if (!error && data) setNeighbourhoods(data)
        setLoading(false)
      })
  }, [])

  return { neighbourhoods, loading }
}
