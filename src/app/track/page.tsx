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
  const [identifierType, setIdentifierType] = useState<'email' | 'phone'>('email')
  const [identifier, setIdentifier] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TrackingResult | null>(null)

  async function handleTrack() {
    const hasIdentifier = identifier.trim().length > 0

    if (!orderNumber.trim()) {
      setError('Please enter your order number.')
      return
    }

    if (!hasIdentifier) {
      setError(`Please enter your ${identifierType}.`)
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
          email: identifierType === 'email' ? identifier : undefined,
          phone: identifierType === 'phone' ? identifier : undefined,
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
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h2>Track Order</h2>

      <input
        placeholder="Order Number"
        value={orderNumber}
        onChange={(e) => setOrderNumber(e.target.value)}
        style={{ display: 'block', marginBottom: 10 }}
      />

      {/* TOGGLE */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <button
          onClick={() => {
            setIdentifierType('email')
            setIdentifier('')
          }}
          style={{
            padding: 8,
            background: identifierType === 'email' ? '#000' : '#eee',
            color: identifierType === 'email' ? '#fff' : '#000',
          }}
        >
          Email
        </button>

        <button
          onClick={() => {
            setIdentifierType('phone')
            setIdentifier('')
          }}
          style={{
            padding: 8,
            background: identifierType === 'phone' ? '#000' : '#eee',
            color: identifierType === 'phone' ? '#fff' : '#000',
          }}
        >
          Phone
        </button>
      </div>

      {/* SINGLE INPUT ONLY */}
      <input
        placeholder={identifierType === 'email' ? 'Email' : 'Phone'}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        style={{ display: 'block', marginBottom: 10 }}
      />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={handleTrack} disabled={loading}>
        {loading ? 'Tracking...' : 'Track Order'}
      </button>

      {/* RESULT */}
      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>Order #{result.order.orderNumber}</h3>
          <p>Status: {STATUS_CONFIG[result.order.status].label}</p>
          <p>Updated: {formatDate(result.order.updatedAt)}</p>

          {isShipped && result.order.trackingId && (
            <a href={result.order.postexUrl || '#'} target="_blank">
              Track Shipment
            </a>
          )}
        </div>
      )}
    </main>
  )
}
