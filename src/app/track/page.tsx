'use client';

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatusHistoryItem {
  status: string;
  label: string;
  timestamp: string;
}

interface OrderItem {
  name: string;
  quantity: number;
  variant?: string;
}

interface TrackResult {
  order_number: string;
  customer_name: string;
  status: string;
  ordered_at: string;
  confirmed_at: string;
  tracking_id?: string | null;
  postex_status?: string | null;
  items: OrderItem[];
  status_history: StatusHistoryItem[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function calcDelivery(confirmedAt?: string) {
  if (!confirmedAt) {
    return { minDate: '-', maxDate: '-', daysLeft: 0, progress: 0 };
  }

  const start = new Date(confirmedAt);
  if (isNaN(start.getTime())) {
    return { minDate: '-', maxDate: '-', daysLeft: 0, progress: 0 };
  }

  start.setHours(0, 0, 0, 0);

  const minDay = new Date(start);
  minDay.setDate(start.getDate() + 6);

  const maxDay = new Date(start);
  maxDay.setDate(start.getDate() + 9);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysPassed = Math.floor((today.getTime() - start.getTime()) / 86400000);
  const daysLeft = Math.max(0, 9 - daysPassed);
  const progress = Math.min(100, Math.round((daysPassed / 9) * 100));

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

  return {
    minDate: fmt(minDay),
    maxDate: fmt(maxDay),
    daysLeft,
    progress,
  };
}

function fmtDate(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

function fmtDateTime(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '-'
    : d.toLocaleString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

// ─── Status logic ─────────────────────────────────────────────────────────────
function getDisplayStatus(order: TrackResult) {
  if (order.status === 'delivered') {
    return { label: 'Delivered', isDelivered: true, isShipped: false, isMaking: false };
  }
  if (order.tracking_id) {
    return { label: 'Shipped', isDelivered: false, isShipped: true, isMaking: false };
  }
  return { label: 'Making in Progress', isDelivered: false, isShipped: false, isMaking: true };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TrackPage() {
  const [tab, setTab] = useState<'order' | 'phone'>('order');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState('');

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const body = tab === 'order' ? { order_number: q } : { phone: q };

      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data?.order_number) {
        setError(data?.error ?? 'Order not found.');
        return;
      }

      setResult({
        ...data,
        items: data.items ?? [],
        status_history: data.status_history ?? [],
      });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 20 }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['order', 'phone'] as const).map(t => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setQuery('');
                setResult(null);
                setError('');
              }}
              style={{ flex: 1 }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, padding: 10 }}
            placeholder="Enter order or phone"
          />
          <button onClick={handleSearch} disabled={loading}>
            {loading ? '...' : 'Track'}
          </button>
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        {result && (
          <OrderCard order={result} />
        )}
      </div>
    </main>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function OrderCard({ order }: { order: TrackResult }) {
  const { label, isDelivered, isShipped, isMaking } = getDisplayStatus(order);
  const delivery = calcDelivery(order.confirmed_at);

  const delivered = order.status_history?.find(h => h.status === 'delivered');
  const shipped = order.status_history?.find(h => h.status === 'shipped');

  return (
    <div style={{ marginTop: 20 }}>

      <h3>Order #{order.order_number}</h3>
      <p>{order.customer_name}</p>

      <p>Status: {label}</p>

      <p>
        Confirmed: {fmtDate(order.confirmed_at)}
      </p>

      {!isDelivered ? (
        <p>
          Delivery: {delivery.minDate} - {delivery.maxDate}
        </p>
      ) : (
        <p>
          Delivered: {fmtDate(delivered?.timestamp)}
        </p>
      )}

      {/* Timeline */}
      <div>
        <h4>Status History</h4>

        <div>
          <b>{label}</b>
          <p>
            {isShipped
              ? fmtDateTime(shipped?.timestamp)
              : isDelivered
              ? fmtDateTime(delivered?.timestamp)
              : 'In progress'}
          </p>
        </div>

        <div>
          <b>Order Confirmed</b>
          <p>{fmtDateTime(order.confirmed_at)}</p>
        </div>
      </div>

      {/* Items SAFE */}
      <div>
        <h4>Items</h4>

        {(order.items ?? []).map((item, i) => (
          <div key={i}>
            {item.name} {item.variant ? `(${item.variant})` : ''} × {item.quantity}
          </div>
        ))}
      </div>

    </div>
  );
}
