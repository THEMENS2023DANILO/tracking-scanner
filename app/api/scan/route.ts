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
    .select('numero_ecommerce, codigo_rastreamento, cliente_nome, raw_data')
    .eq('codigo_rastreamento', code)
    .limit(1)
    .single()

  if (tinyRow) {
    // 2a. If linked to ecommerce order, fetch from order_prescription_validation
    if (tinyRow.numero_ecommerce) {
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

    // 2b. No ecommerce link — extract CPF from raw_data and find products by CPF + date
    const rawData = tinyRow.raw_data as Record<string, any>
    const customer_name = tinyRow.cliente_nome || rawData?.nome || rawData?.cliente?.nome
    const cpfRaw: string = rawData?.cliente?.cpf_cnpj ?? ''
    const cpf = cpfRaw.replace(/\D/g, '')
    const dataEmissao: string = rawData?.data_emissao ?? '' // format: DD/MM/YYYY

    if (cpf && dataEmissao) {
      const [dd, mm, yyyy] = dataEmissao.split('/')
      const orderDate = `${yyyy}-${mm}-${dd}`
      const dateFrom = new Date(orderDate)
      dateFrom.setDate(dateFrom.getDate() - 30)
      const dateTo = new Date(orderDate)
      dateTo.setDate(dateTo.getDate() + 5)

      const { data: orderRows } = await supabase
        .from('order_prescription_validation')
        .select('product_name, medication')
        .eq('customer_cpf', cpf)
        .gte('order_date', dateFrom.toISOString().split('T')[0])
        .lte('order_date', dateTo.toISOString().split('T')[0])

      const products = orderRows?.map(r => r.product_name || r.medication).filter(Boolean) ?? []
      await supabase.from('scan_logs').insert({ tracking_code: code, customer_name, found: true })
      return NextResponse.json({ found: true, customer_name, products })
    }

    // 2c. At least return the customer name even if no products found
    if (customer_name) {
      await supabase.from('scan_logs').insert({ tracking_code: code, customer_name, found: true })
      return NextResponse.json({ found: true, customer_name, products: [] })
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
