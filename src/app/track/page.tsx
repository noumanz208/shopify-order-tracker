'use client'

import { useState } from 'react'
import type { OrderStatus } from '@/types'
import { STATUS_CONFIG } from '@/types'

interface TrackingResult {
  order: {
    orderNumber: string
    customerName: string | null
    status: OrderStatus
    trackingId: string | null
    postexUrl: string | null
    lineItems: { name: string; quantity: number }[]
    createdAt: string
    updatedAt: string
  }
  history: { status: OrderStatus; note: string | null; changed_at: string }[]
}

const ALL_STATUSES: OrderStatus[] = [
  'in_process', 'printing_done', 'packed', 'ready_to_ship', 'shipped', 'delivered'
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function TrackPage() {
  const [tab, setTab] = useState<'order' | 'phone'>('order')
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TrackingResult | null>(null)

  async function handleTrack() {
    if (tab === 'order' && !orderNumber.trim()) { setError('Please enter your order number.'); return }
    if (tab === 'phone' && !phone.trim()) { setError('Please enter your phone number.'); return }
    setLoading(true); setError(''); setResult(null)

    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          tab === 'order'
            ? { orderNumber }
            : { phone }
        ),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return }
      setResult(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const currentStep = result ? STATUS_CONFIG[result.order.status].step : 0
  const isShipped = result?.order.status === 'shipped' || result?.order.status === 'delivered'

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
    background: active ? '#6366f1' : '#f3f4f6',
    color: active ? '#fff' : '#6b7280',
    fontWeight: '600' as const, fontSize: '14px', cursor: 'pointer',
  })

  return (
    <main style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <div style={{ background: '#1a1a2e', padding: '20px 24px' }}>
        <div style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>📦 Order Tracker</div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 6px' }}>Track Your Order</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>
            Track using your order number or phone number.
          </p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button onClick={() => { setTab('order'); setError(''); setResult(null) }} style={tabStyle(tab === 'order')}>
              Order Number
            </button>
            <button onClick={() => { setTab('phone'); setError(''); setResult(null) }} style={tabStyle(tab === 'phone')}>
              Phone Number
            </button>
          </div>

          {tab === 'order' ? (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Order Number</label>
              <input type="text" placeholder="e.g. 1234 or #1234" value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTrack()}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = '#6366f1')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Phone Number</label>
              <input type="tel" placeholder="03001234567" value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTrack()}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = '#6366f1')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>
          )}

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}

          <button onClick={handleTrack} disabled={loading}
            style={{ width: '100%', padding: '13px', borderRadius: '10px', background: loading ? '#a5b4fc' : '#6366f1', color: '#fff', border: 'none', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Searching...' : 'Track Order →'}
          </button>
        </div>

        {result && (
          <div>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '2px' }}>Order</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a2e' }}>#{result.order.orderNumber}</div>
                  {result.order.customerName && <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>{result.order.customerName}</div>}
                </div>
                <div style={{ background: isShipped ? '#ecfdf5' : '#f0f0ff', color: isShipped ? '#10b981' : '#6366f1', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
                  {STATUS_CONFIG[result.order.status].label}
                </div>
              </div>

              {result.order.lineItems?.length > 0 && (
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '14px', marginBottom: '14px' }}>
                  {result.order.lineItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                      <span style={{ color: '#374151' }}>{item.name}</span>
                      <span style={{ color: '#9ca3af', fontWeight: '600' }}>×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>Ordered {formatDate(result.order.createdAt)} · Last updated {formatDate(result.order.updatedAt)}</div>
            </div>

            {!isShipped && (
              <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 20px' }}>Order Progress</h2>
                {ALL_STATUSES.filter(s => s !== 'shipped' && s !== 'delivered').map((s, i, arr) => {
                  const cfg = STATUS_CONFIG[s]
                  const isDone = cfg.step < currentStep
                  const isCurrent = s === result.order.status
                  const isLast = i === arr.length - 1
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDone ? '#6366f1' : isCurrent ? '#f0f0ff' : '#f3f4f6', border: isCurrent ? '2px solid #6366f1' : 'none', fontSize: '13px', fontWeight: '700', color: isDone ? '#fff' : isCurrent ? '#6366f1' : '#9ca3af' }}>
                          {isDone ? '✓' : cfg.step}
                        </div>
                        {!isLast && <div style={{ width: '2px', height: '28px', background: isDone ? '#6366f1' : '#e5e7eb', margin: '2px 0' }} />}
                      </div>
                      <div style={{ paddingBottom: isLast ? 0 : '20px', paddingTop: '4px' }}>
                        <div style={{ fontSize: '14px', fontWeight: isCurrent ? '700' : '500', color: isCurrent ? '#1a1a2e' : isDone ? '#6366f1' : '#9ca3af' }}>{cfg.label}</div>
                        {isCurrent && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Current status</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {isShipped && (
              <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚚</div>
                <div style={{ fontSize: '17px', fontWeight: '700', color: '#1a1a2e', marginBottom: '6px' }}>Your order is on its way!</div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                  Your parcel has been handed to PostEx.{result.order.trackingId && <><br />Tracking ID: <strong style={{ color: '#374151' }}>{result.order.trackingId}</strong></>}
                </div>
                {result.order.postexUrl && (
                  <a href={result.order.postexUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-block', padding: '13px 32px', background: '#10b981', color: '#fff', borderRadius: '10px', fontSize: '15px', fontWeight: '700', textDecoration: 'none' }}>
                    Track on PostEx →
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
