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

  // 1. Search in order_prescription_validation
  const { data: opvRows } = await supabase
    .from('order_prescription_validation')
    .select('customer_name, product_name, medication, order_external_id')
    .eq('tracking_code', code)

  if (opvRows && opvRows.length > 0) {
    const customer_name = opvRows[0].customer_name
    const products = opvRows.map(r => r.product_name || r.medication).filter(Boolean)
    await supabase.from('scan_logs').insert({ tracking_code: code, customer_name, found: true })
    return NextResponse.json({ found: true, customer_name, products })
  }

  // 2. Search in tiny_invoices by codigo_rastreamento
  const { data: tinyRow } = await supabase
    .from('tiny_invoices')
    .select('numero_ecommerce, codigo_rastreamento')
    .eq('codigo_rastreamento', code)
    .limit(1)
    .single()

  if (tinyRow?.numero_ecommerce) {
    const { data: orderRows } = await supabase
      .from('order_prescription_validation')
      .select('customer_name, product_name, medication')
      .eq('order_external_id', tinyRow.numero_ecommerce)

    if (orderRows && orderRows.length > 0) {
      const customer_name = orderRows[0].customer_name
      const products = orderRows.map(r => r.product_name || r.medication).filter(Boolean)
      await supabase.from('scan_logs').insert({ tracking_code: code, customer_name, found: true })
      return NextResponse.json({ found: true, customer_name, products })
    }
  }

  // 3. Search in vw_orders_unified by cod_rastreio
  const { data: unifiedRow } = await supabase
    .from('vw_orders_unified')
    .select('nome, cpf, vita, shampoo, minoxidil, finasterida, tonico, anti_aging, cha, sleep, tadala_spray, chocosono_1, chocosono_2, chocosono_5, chocosono_10, creatina, prolongue_30, prolongue_20')
    .eq('cod_rastreio', code)
    .limit(1)
    .single()

  if (unifiedRow) {
    const customer_name = unifiedRow.nome
    const productMap: Record<string, string> = {
      vita: 'Vita',
      shampoo: 'Shampoo',
      minoxidil: 'Minoxidil',
      finasterida: 'Finasterida',
      tonico: 'Tônico',
      anti_aging: 'Anti Aging',
      cha: 'Chá',
      sleep: 'Sleep',
      tadala_spray: 'Tadala Spray',
      chocosono_1: 'Chocosono 1',
      chocosono_2: 'Chocosono 2',
      chocosono_5: 'Chocosono 5',
      chocosono_10: 'Chocosono 10',
      creatina: 'Creatina',
      prolongue_30: 'Prolongue 30',
      prolongue_20: 'Prolongue 20',
    }
    const products = Object.entries(productMap)
      .filter(([key]) => unifiedRow[key as keyof typeof unifiedRow])
      .map(([, label]) => label)

    await supabase.from('scan_logs').insert({ tracking_code: code, customer_name, found: true })
    return NextResponse.json({ found: true, customer_name, products })
  }

  // Not found
  await supabase.from('scan_logs').insert({ tracking_code: code, found: false })
  return NextResponse.json({ found: false })
}
