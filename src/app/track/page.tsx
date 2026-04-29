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
function calcDelivery(confirmedAt: string) {
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
    d.toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

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

// ─── Status Logic ─────────────────────────────────────────────────────────────
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
        items: data?.items ?? [],
        status_history: data?.status_history ?? [],
      });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.tracker}>
        {/* Header */}
        <div style={styles.appHeader}>
          <span style={styles.logo}>KOVRR</span>
          <span style={styles.appSub}>Order Tracker</span>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {(['order', 'phone'] as const).map((t) => (
            <button
              key={t}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              onClick={() => {
                setTab(t);
                setQuery('');
                setResult(null);
                setError('');
              }}
            >
              {t === 'order' ? 'Order Number' : 'Phone Number'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={styles.searchBar}>
          <input
            style={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter order or phone number"
          />
          <button style={styles.searchBtn} onClick={handleSearch} disabled={loading}>
            {loading ? '...' : 'Track'}
          </button>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {result && <OrderCard order={result} />}
      </div>
    </main>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order }: { order: TrackResult }) {
  const { label, isDelivered, isShipped, isMaking } = getDisplayStatus(order);
  const delivery = calcDelivery(order.confirmed_at);

  const delivered = order.status_history?.find(h => h.status === 'delivered');
  const shipped = order.status_history?.find(h => h.status === 'shipped');

  return (
    <>
      <div style={styles.hero}>
        <div style={styles.orderNum}>Order #{order.order_number}</div>
        <div style={styles.customerName}>{order.customer_name}</div>
        <div style={styles.badges}>
          <span style={styles.badgeStatus}>{label}</span>
        </div>
      </div>

      <div style={styles.infoRow}>
        <div style={styles.infoCard}>
          <div style={styles.infoLabel}>Order Confirmed</div>
          <div style={styles.infoValue}>{fmtDate(order.confirmed_at)}</div>
        </div>

        {!isDelivered ? (
          <div style={styles.infoCard}>
            <div style={styles.infoLabel}>Est. Delivery</div>
            <div style={styles.infoValue}>{delivery.minDate} - {delivery.maxDate}</div>
          </div>
        ) : (
          <div style={styles.infoCard}>
            <div style={styles.infoLabel}>Delivered</div>
            <div style={styles.infoValue}>{fmtDate(delivered?.timestamp)}</div>
          </div>
        )}
      </div>

      {/* ITEMS (FIXED) */}
      <div style={styles.itemsCard}>
        <div style={styles.itemsHeader}>Items</div>

        {(order.items ?? []).map((item, i) => (
          <div key={i} style={styles.itemRow}>
            <span>{item.name} {item.variant ? `(${item.variant})` : ''}</span>
            <span>x{item.quantity}</span>
          </div>
        ))}
      </div>

      {/* TIMELINE */}
      <div style={styles.timelineCard}>
        <div>
          <b>{label}</b>
          <div>
            {isShipped
              ? fmtDateTime(shipped?.timestamp)
              : isDelivered
              ? fmtDateTime(delivered?.timestamp)
              : 'In progress'}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Styles (UNCHANGED) ───────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  main: { background: '#f4f4f4', minHeight: '100vh', padding: 20 },
  tracker: { maxWidth: 540, margin: '0 auto' },

  appHeader: { display: 'flex', gap: 10, marginBottom: 20 },
  logo: { background: '#E50914', color: '#fff', padding: '6px 12px', borderRadius: 8 },
  appSub: { fontSize: 12, color: '#777' },

  tabs: { display: 'flex', gap: 6, marginBottom: 10 },
  tab: { flex: 1, padding: 10, background: '#ddd', border: 'none', borderRadius: 8 },
  tabActive: { background: '#E50914', color: '#fff' },

  searchBar: { display: 'flex', gap: 10, marginBottom: 15 },
  input: { flex: 1, padding: 10 },
  searchBtn: { padding: '10px 16px', background: '#E50914', color: '#fff', border: 'none' },

  errorBox: { color: 'red', marginBottom: 10 },

  hero: { background: '#E50914', color: '#fff', padding: 20, borderRadius: 12 },
  orderNum: { fontSize: 12 },
  customerName: { fontSize: 22, fontWeight: 700 },

  badges: { marginTop: 10 },
  badgeStatus: { background: '#fff3', padding: '4px 10px', borderRadius: 20 },

  infoRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 },
  infoCard: { background: '#fff', padding: 15, borderRadius: 10 },
  infoLabel: { fontSize: 11, color: '#777' },
  infoValue: { fontWeight: 600 },

  itemsCard: { background: '#fff', marginTop: 10, padding: 15, borderRadius: 10 },
  itemsHeader: { fontWeight: 700, marginBottom: 10 },
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0' },

  timelineCard: { background: '#fff', marginTop: 10, padding: 15, borderRadius: 10 },
};
