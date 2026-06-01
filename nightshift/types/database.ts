// TypeScript types generated from the NightShift PostgreSQL schema.
// Re-generate with: npx supabase gen types typescript --project-id <id> > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      neighbourhood: {
        Row: {
          id:           string
          name:         string
          slug:         string
          description:  string | null
          vibe_summary: string | null
          lat:          number | null
          lng:          number | null
          sort_order:   number
        }
        Insert: Omit<Database['public']['Tables']['neighbourhood']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['neighbourhood']['Row']>
      }
      venue: {
        Row: {
          id:                   string
          name:                 string
          slug:                 string | null
          address:              string | null
          neighbourhood_id:     string | null
          lat:                  number | null
          lng:                  number | null
          venue_type:           'nightclub' | 'bar' | 'lounge' | 'rooftop' | 'afterhours' | 'live_music' | 'comedy' | null
          vibe_tags:            string[] | null
          music_genres:         string[] | null
          capacity:             number | null
          min_age:              number
          dress_code:           string | null
          has_cover_charge:     boolean
          cover_notes:          string | null
          google_place_id:      string | null
          google_rating:        number | null
          google_review_count:  number | null
          instagram_handle:     string | null
          website_url:          string | null
          phone:                string | null
          is_verified:          boolean
          is_active:            boolean
          created_at:           string
          updated_at:           string
        }
        Insert: Omit<Database['public']['Tables']['venue']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['venue']['Row']>
      }
      hours: {
        Row: {
          id:             string
          venue_id:       string
          day_of_week:    number   // 0=Monday … 6=Sunday
          open_time:      string | null
          close_time:     string | null
          is_closed:      boolean
          is_after_hours: boolean
        }
        Insert: Omit<Database['public']['Tables']['hours']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['hours']['Row']>
      }
      venue_photo: {
        Row: {
          id:         string
          venue_id:   string
          url:        string
          caption:    string | null
          source:     string | null
          is_primary: boolean
          sort_order: number
          taken_at:   string | null
        }
        Insert: Omit<Database['public']['Tables']['venue_photo']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['venue_photo']['Row']>
      }
      performer: {
        Row: {
          id:               string
          name:             string
          performer_type:   string | null
          genre:            string | null
          instagram_handle: string | null
          spotify_id:       string | null
          songkick_id:      string | null
          bandsintown_id:   string | null
          is_local:         boolean
          created_at:       string
        }
        Insert: Omit<Database['public']['Tables']['performer']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['performer']['Row']>
      }
      event: {
        Row: {
          id:               string
          venue_id:         string
          title:            string
          description:      string | null
          event_type:       string | null
          music_genres:     string[] | null
          start_time:       string
          end_time:         string | null
          is_recurring:     boolean
          recurrence_rule:  string | null
          is_free:          boolean
          ticket_price_min: number | null
          ticket_price_max: number | null
          ticket_url:       string | null
          cover_image_url:  string | null
          external_id:      string | null
          external_source:  string | null
          is_cancelled:     boolean
          created_at:       string
        }
        Insert: Omit<Database['public']['Tables']['event']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['event']['Row']>
      }
      deal: {
        Row: {
          id:             string
          venue_id:       string
          title:          string
          description:    string | null
          deal_type:      string | null
          day_of_week:    number | null
          valid_from:     string | null
          valid_until:    string | null
          original_price: number | null
          deal_price:     number | null
          is_realtime:    boolean
          expires_at:     string | null
          is_active:      boolean
          created_at:     string
        }
        Insert: Omit<Database['public']['Tables']['deal']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['deal']['Row']>
      }
      app_user: {
        Row: {
          id:                 string
          display_name:       string | null
          email:              string | null
          avatar_url:         string | null
          preferred_vibes:    string[] | null
          preferred_genres:   string[] | null
          neighbourhood_pref: string | null
          budget_min:         number | null
          budget_max:         number | null
          min_age_pref:       number | null
          created_at:         string
          last_active_at:     string | null
        }
        Insert: Omit<Database['public']['Tables']['app_user']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['app_user']['Row']>
      }
      checkin: {
        Row: {
          id:            string
          user_id:       string | null
          venue_id:      string
          event_id:      string | null
          crowd_rating:  number | null
          vibe_rating:   number | null
          noise_level:   number | null
          wait_time_min: number | null
          note:          string | null
          is_anonymous:  boolean
          checked_in_at: string
        }
        Insert: Omit<Database['public']['Tables']['checkin']['Row'], 'id' | 'checked_in_at'>
        Update: Partial<Database['public']['Tables']['checkin']['Row']>
      }
      live_crowd_signal: {
        Row: {
          id:          string
          venue_id:    string
          crowd_pct:   number | null
          wait_min:    number | null
          source:      string | null
          captured_at: string
        }
        Insert: Omit<Database['public']['Tables']['live_crowd_signal']['Row'], 'id' | 'captured_at'>
        Update: Partial<Database['public']['Tables']['live_crowd_signal']['Row']>
      }
    }
    Views:    {}
    Functions: {}
    Enums:    {}
  }
}

// ── Convenience aliases ────────────────────────────────────────────────────
export type Neighbourhood  = Database['public']['Tables']['neighbourhood']['Row']
export type Venue          = Database['public']['Tables']['venue']['Row']
export type Hours          = Database['public']['Tables']['hours']['Row']
export type VenuePhoto     = Database['public']['Tables']['venue_photo']['Row']
export type Performer      = Database['public']['Tables']['performer']['Row']
export type Event          = Database['public']['Tables']['event']['Row']
export type Deal           = Database['public']['Tables']['deal']['Row']
export type AppUser        = Database['public']['Tables']['app_user']['Row']
export type Checkin        = Database['public']['Tables']['checkin']['Row']
export type LiveCrowdSignal = Database['public']['Tables']['live_crowd_signal']['Row']

// ── Composite types used across screens ───────────────────────────────────
export type VenueWithPhotos = Venue & {
  venue_photo: VenuePhoto[]
}

export type VenueWithDetails = Venue & {
  venue_photo:  VenuePhoto[]
  hours:        Hours[]
  neighbourhood: Neighbourhood | null
}
