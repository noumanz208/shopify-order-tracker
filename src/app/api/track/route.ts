import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPostExTrackingUrl } from '@/lib/postex'
import { normalizePhone } from '@/lib/shopify'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { orderNumber, email, phone } = body

  // ── 1. Validation ──────────────────────────────────────────
  if (!orderNumber && !phone) {
    return NextResponse.json(
      { error: 'Please provide order number or phone.' },
      { status: 400 }
    )
  }

  const cleanOrderNumber = orderNumber
    ? String(orderNumber).replace('#', '').trim()
    : null

  const normalizedPhone = phone ? normalizePhone(phone) : null

  // ── 2. Flexible search (order number OR phone) ─────────────
  let query = supabaseAdmin.from('orders').select('*')

  if (cleanOrderNumber && normalizedPhone) {
    query = query.or(
      `order_number.eq.${cleanOrderNumber},customer_phone.eq.${normalizedPhone}`
    )
  } else if (cleanOrderNumber) {
    query = query.eq('order_number', cleanOrderNumber)
  } else if (normalizedPhone) {
    query = query.eq('customer_phone', normalizedPhone)
  }

  const { data: orders, error } = await query.limit(1)

  if (error || !orders || orders.length === 0) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  const order = orders[0]

  // ── 3. Optional verification (email/phone match) ──────────
  let verified = true

  if (email && order.customer_email) {
    verified = order.customer_email.toLowerCase() === email.toLowerCase()
  }

  if (!verified && normalizedPhone && order.customer_phone) {
    verified = order.customer_phone === normalizedPhone
  }

  if (!verified) {
    return NextResponse.json(
      { error: 'Order not found or details do not match.' },
      { status: 404 }
    )
  }

  // ── 4. Fetch status history ────────────────────────────────
  const { data: history } = await supabaseAdmin
    .from('order_status_history')
    .select('status, note, changed_at')
    .eq('order_id', order.id)
    .order('changed_at', { ascending: true })

  // ── 5. Build tracking URL ─────────────────────────────────
  const postexUrl = order.tracking_id
    ? getPostExTrackingUrl(order.tracking_id)
    : null

  // ── 6. Prepare latest status (fallback if no history) ─────
  const latestStatus =
    history && history.length > 0
      ? history[history.length - 1]
      : {
          status: order.status,
          note: order.status,
          changed_at: order.last_status_at || order.created_at,
        }

  // ── 7. Response ───────────────────────────────────────────
  return NextResponse.json({
    order: {
      orderNumber: order.order_number,
      customerName: order.customer_name,
      status: latestStatus.status,
      statusLabel: latestStatus.note,
      statusDate: latestStatus.changed_at,
      trackingId: order.tracking_id,
      postexUrl,
      hasTracking: !!order.tracking_id,
      lineItems: order.line_items,
      createdAt: order.shopify_created_at || order.created_at,
      updatedAt: order.updated_at,
    },
    history: history || [],
  })
}