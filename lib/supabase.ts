import { createClient } from '@supabase/supabase-js'

// Browser client (uses anon key — safe to expose)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server client (uses service role — never expose to browser)
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type Submission = {
  id: string
  contest_id: string
  contestant_name: string
  team_name: string
  drive_link: string
  notes: string | null
  ai_score: number | null
  ai_breakdown: Record<string, number> | null
  ai_feedback: string | null
  final_score: number | null
  status: 'pending' | 'scoring' | 'scored'
  submitted_at: string
}

export type Score = {
  id: string
  submission_id: string
  judge_id: string
  breakdown: Record<string, number>
  average: number
  submitted_at: string
}

export type Judge = {
  id: string
  contest_id: string
  name: string
  token: string
}
