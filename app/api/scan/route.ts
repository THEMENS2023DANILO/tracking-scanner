import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { tracking_code } = await req.json()

  if (!tracking_code?.trim()) {
    return NextResponse.json({ found: false, error: 'No tracking code provided' })
  }

  const code = tracking_code.trim().toUpperCase()

  const { data, error } = await supabase.rpc('lookup_tracking', { p_code: code })

  if (error) {
    return NextResponse.json({ found: false, error: `RPC error: ${error.message} | code: ${error.code}` })
  }

  if (data === null || data === undefined) {
    return NextResponse.json({ found: false, error: 'RPC returned null — check env vars or function name' })
  }

  const result = data as { found: boolean; customer_name?: string; products?: string[] }

  await supabase.from('scan_logs').insert({
    tracking_code: code,
    customer_name: result.customer_name ?? null,
    found: result.found,
  })

  return NextResponse.json(result)
}
