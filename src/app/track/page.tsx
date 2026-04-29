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
  const [mode, setMode] = useState<'email' | 'phone'>('email')
  const [value, setValue] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TrackingResult | null>(null)

  async function handleTrack() {
    if (!orderNumber.trim()) {
      setError('Please enter your order number.')
      return
    }

    if (!value.trim()) {
      setError(`Please enter your ${mode}.`)
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
          email: mode === 'email' ? value : undefined,
          phone: mode === 'phone' ? value : undefined,
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
        background: 'linear-gradient(to bottom, #f8f7f4, #ffffff)',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: '#1a1a2e',
          padding: '20px 24px',
          color: '#fff',
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        📦 Order Tracker
      </div>

      <div style={{ maxWidth: 650, margin: '0 auto', padding: 24 }}>
        {/* CARD */}
        <div
          style={{
            background: '#fff',
            borderRadius: 18,
            padding: 28,
            boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
          }}
        >
          <h2 style={{ marginBottom: 6 }}>Track Your Order</h2>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 18 }}>
            Enter your order number and email or phone.
          </p>

          <input
            placeholder="Order Number (e.g. 1234)"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            style={input}
          />

          {/* TOGGLE */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              onClick={() => {
                setMode('email')
                setValue('')
              }}
              style={toggle(mode === 'email')}
            >
              Email
            </button>

            <button
              onClick={() => {
                setMode('phone')
                setValue('')
              }}
              style={toggle(mode === 'phone')}
            >
              Phone
            </button>
          </div>

          <input
            placeholder={mode === 'email' ? 'you@example.com' : '03XXXXXXXXX'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={input}
          />

          {error && (
            <div
              style={{
                background: '#ffecec',
                padding: 10,
                borderRadius: 10,
                color: '#d00',
                fontSize: 13,
                marginTop: 10,
              }}
            >
              {error}
            </div>
          )}

          <button onClick={handleTrack} style={btn}>
            {loading ? 'Tracking...' : 'Track Order →'}
          </button>
        </div>

        {/* RESULT */}
        {result && (
          <div style={{ marginTop: 20 }}>
            <div style={card}>
              <h3>Order #{result.order.orderNumber}</h3>
              <p>Status: {STATUS_CONFIG[result.order.status].label}</p>
              <p style={{ fontSize: 12, color: '#777' }}>
                Updated {formatDate(result.order.updatedAt)}
              </p>

              {isShipped && result.order.trackingId && (
                <a
                  href={result.order.postexUrl || '#'}
                  target="_blank"
                  style={trackBtn}
                >
                  Track Shipment
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

/* STYLES */
const input = {
  width: '100%',
  padding: 12,
  marginTop: 12,
  borderRadius: 10,
  border: '1px solid #ddd',
  outline: 'none',
}

const btn = {
  width: '100%',
  padding: 12,
  marginTop: 15,
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontWeight: 600,
}

const card = {
  background: '#fff',
  padding: 20,
  borderRadius: 14,
  boxShadow: '0 5px 20px rgba(0,0,0,0.05)',
}

const trackBtn = {
  display: 'inline-block',
  marginTop: 10,
  padding: '8px 12px',
  background: '#10b981',
  color: '#fff',
  borderRadius: 8,
  textDecoration: 'none',
}

const toggle = (active: boolean) => ({
  flex: 1,
  padding: 10,
  borderRadius: 10,
  border: '1px solid #ddd',
  background: active ? '#6366f1' : '#fff',
  color: active ? '#fff' : '#333',
  cursor: 'pointer',
})
