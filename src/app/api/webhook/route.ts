import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyShopifyWebhook, normalizePhone } from '@/lib/shopify'
import { SHOPIFY_TAG_TO_STATUS } from '@/types'
import type { ShopifyWebhookOrder, OrderStatus } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256') || ''
  const topic = req.headers.get('x-shopify-topic') || ''

  // ── 1. Verify Shopify ─────────────────────────────────────
  const isValid = await verifyShopifyWebhook(rawBody, hmacHeader)
  if (!isValid) {
    console.warn('[webhook] Invalid HMAC — rejected')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse payload ──────────────────────────────────────
  let payload: ShopifyWebhookOrder
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log(`[webhook] ${topic} — Order ${payload.name}`)

  // ── 3. Detect status from tags ────────────────────────────
  const tags = payload.tags?.split(',').map(t => t.trim().toLowerCase()) || []

  let detectedStatus: OrderStatus = 'in_process'
  for (const tag of tags) {
    if (SHOPIFY_TAG_TO_STATUS[tag]) {
      detectedStatus = SHOPIFY_TAG_TO_STATUS[tag]
      break
    }
  }

  // ── 4. Extract tracking ───────────────────────────────────
  let trackingId: string | null =
    payload.fulfillments?.[0]?.tracking_number || null

  const trackingAttr = payload.note_attributes?.find(
    a =>
      a.name.toLowerCase() === 'tracking_id' ||
      a.name.toLowerCase() === 'postex_tracking'
  )

  if (trackingAttr?.value) trackingId = trackingAttr.value

  if (trackingId) detectedStatus = 'shipped'

  // ── 5. Phone extraction (FIXED) ───────────────────────────
  const rawPhone =
    payload.customer?.phone ||
    payload.shipping_address?.phone ||
    payload.billing_address?.phone ||
    payload.phone ||
    null

  const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : null

  // ── 6. Line items ─────────────────────────────────────────
  const lineItems = payload.line_items.map(li => ({
    name: li.name,
    quantity: li.quantity,
    variant_title: li.variant_title,
  }))

  // ── 7. Check existing order ───────────────────────────────
  const { data: existingOrder } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('shopify_order_id', String(payload.id))
    .maybeSingle()

  // ── 8. Prepare data (SAFE MERGE) ──────────────────────────
  const orderData = {
    shopify_order_id: String(payload.id),
    order_number: String(payload.order_number),

    customer_email:
      payload.customer?.email || payload.email || existingOrder?.customer_email || null,

    customer_phone:
      normalizedPhone || existingOrder?.customer_phone || null,

    customer_phone_raw:
      rawPhone || existingOrder?.customer_phone_raw || null,

    customer_name: payload.customer
      ? `${payload.customer.first_name} ${payload.customer.last_name}`.trim()
      : existingOrder?.customer_name || null,

    status: detectedStatus,
    tracking_id: trackingId || existingOrder?.tracking_id || null,

    line_items: lineItems,

    shopify_created_at: payload.created_at,

    last_status_at:
      existingOrder?.status !== detectedStatus
        ? new Date().toISOString()
        : existingOrder?.last_status_at || new Date().toISOString(),
  }

  // ── 9. Upsert ─────────────────────────────────────────────
  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from('orders')
    .upsert(orderData, { onConflict: 'shopify_order_id' })
    .select()
    .single()

  if (upsertError) {
    console.error('[webhook] DB upsert error:', upsertError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // ── 10. Status history (ONLY if changed) ───────────────────
  const statusChanged =
    !existingOrder || existingOrder.status !== detectedStatus

  if (statusChanged && upserted) {
    await supabaseAdmin.from('order_status_history').insert({
      order_id: upserted.id,
      status: detectedStatus,
      note: `Webhook: ${topic}`,
    })
  }

  console.log(
    `[webhook] Order ${payload.name} updated → ${detectedStatus}`
  )

  return NextResponse.json({ ok: true })
}