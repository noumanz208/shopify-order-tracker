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
  'in_process',
  'printing_done',
  'packed',
  'ready_to_ship',
  'shipped',
  'delivered',
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [usePhone, setUsePhone] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TrackingResult | null>(null)

  async function handleTrack() {
    const hasEmail = email.trim().length > 0
    const hasPhone = phone.trim().length > 0

    if (!orderNumber.trim()) {
      setError('Please enter your order number.')
      return
    }

    if (!hasEmail && !hasPhone) {
      setError('Please enter email or phone number.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          email: hasEmail ? email : undefined,
          phone: hasPhone ? phone : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setResult(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const currentStep =
    result && STATUS_CONFIG[result.order.status]
      ? STATUS_CONFIG[result.order.status].step
      : 0

  const isShipped =
    result?.order.status === 'shipped' ||
    result?.order.status === 'delivered'

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8f7f4',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#1a1a2e',
          padding: '20px 24px',
          color: '#fff',
          fontSize: '18px',
          fontWeight: '700',
        }}
      >
        📦 Order Tracker
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        {/* Search Box */}
        <div
          style={{
            background: '#fff',
            padding: 24,
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <h2 style={{ marginBottom: 10 }}>Track Your Order</h2>

          <input
            placeholder="Order Number (e.g. 1234)"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            style={inputStyle}
          />

          {/* toggle */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => setUsePhone(false)}
              style={{
                flex: 1,
                ...toggleBtn(usePhone === false),
              }}
            >
              Email
            </button>

            <button
              onClick={() => setUsePhone(true)}
              style={{
                flex: 1,
                ...toggleBtn(usePhone === true),
              }}
            >
              Phone
            </button>
          </div>

          {!usePhone ? (
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          ) : (
            <input
              placeholder="Phone (03001234567)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          )}

          {error && (
            <p style={{ color: 'red', marginTop: 10 }}>{error}</p>
          )}

          <button onClick={handleTrack} style={btnStyle}>
            {loading ? 'Tracking...' : 'Track Order →'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div style={{ marginTop: 20 }}>
            {/* ORDER CARD */}
            <div style={card}>
              <h3>Order #{result.order.orderNumber}</h3>
              <p>
                <b>Status:</b>{' '}
                {STATUS_CONFIG[result.order.status].label}
              </p>

              <p style={{ fontSize: 12, color: '#777' }}>
                Updated: {formatDate(result.order.updatedAt)}
              </p>

              {result.order.trackingId && (
                <a
                  href={result.order.postexUrl || '#'}
                  target="_blank"
                  style={trackBtn}
                >
                  Track Shipment
                </a>
              )}
            </div>

            {/* TIMELINE */}
            {!isShipped && (
              <div style={card}>
                <h4>Progress</h4>

                {ALL_STATUSES.filter(
                  (s) => s !== 'shipped' && s !== 'delivered'
                ).map((s) => {
                  const cfg = STATUS_CONFIG[s]
                  const isDone = cfg.step < currentStep
                  const isCurrent = cfg.step === currentStep

                  return (
                    <div key={s} style={{ marginBottom: 10 }}>
                      <span
                        style={{
                          color: isDone
                            ? 'green'
                            : isCurrent
                            ? 'blue'
                            : '#999',
                          fontWeight: isCurrent ? 'bold' : 'normal',
                        }}
                      >
                        {cfg.step}. {cfg.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* SHIPPED CARD */}
            {isShipped && (
              <div style={card}>
                <h3>🚚 Shipped</h3>
                <p>Your order is on the way.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

/* styles */
const inputStyle = {
  width: '100%',
  padding: 12,
  marginTop: 10,
  borderRadius: 8,
  border: '1px solid #ddd',
}

const btnStyle = {
  width: '100%',
  padding: 12,
  marginTop: 15,
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
}

const card = {
  background: '#fff',
  padding: 20,
  borderRadius: 12,
  marginTop: 15,
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
}

const trackBtn = {
  display: 'inline-block',
  marginTop: 10,
  padding: '8px 12px',
  background: '#10b981',
  color: '#fff',
  borderRadius: 6,
  textDecoration: 'none',
}

function toggleBtn(active: boolean) {
  return {
    padding: 8,
    borderRadius: 8,
    border: '1px solid #ddd',
    background: active ? '#6366f1' : '#fff',
    color: active ? '#fff' : '#333',
    cursor: 'pointer',
  }
}