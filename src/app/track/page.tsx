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
  status: string;           // raw DB status
  ordered_at: string;       // ISO
  confirmed_at: string;     // ISO — delivery countdown base
  tracking_id?: string | null;
  postex_status?: string | null;
  items: OrderItem[];
  status_history: StatusHistoryItem[];
}

// ─── Delivery helpers ─────────────────────────────────────────────────────────
function calcDelivery(confirmedAt: string) {
  const start = new Date(confirmedAt);
  start.setHours(0, 0, 0, 0);
  const minDay = new Date(start); minDay.setDate(start.getDate() + 6);
  const maxDay = new Date(start); maxDay.setDate(start.getDate() + 9);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysPassed = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  const daysLeft = Math.max(0, 9 - daysPassed);
  const progress = Math.min(100, Math.round((daysPassed / 9) * 100));
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  return { minDate: fmt(minDay), maxDate: fmt(maxDay), daysLeft, progress };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Derived display status ────────────────────────────────────────────────────
// Rule:
//   no tracking_id  → "Making in Progress"
//   tracking_id set + not delivered → "Shipped"
//   delivered       → "Delivered"
function getDisplayStatus(order: TrackResult): {
  label: string;
  isDelivered: boolean;
  isShipped: boolean;
  isMaking: boolean;
} {
  if (order.status === 'delivered') {
    return { label: 'Delivered', isDelivered: true, isShipped: false, isMaking: false };
  }
  if (order.tracking_id) {
    return { label: 'Shipped', isDelivered: false, isShipped: true, isMaking: false };
  }
  return { label: 'Making in Progress', isDelivered: false, isShipped: false, isMaking: true };
}

// ─── Component ────────────────────────────────────────────────────────────────
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
      if (!res.ok) setError(data.error ?? 'Order not found.');
      else setResult(data);
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
              onClick={() => { setTab(t); setQuery(''); setResult(null); setError(''); }}
            >
              {t === 'order' ? 'Order Number' : 'Phone Number'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={styles.searchBar}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="9" cy="9" r="7" stroke="#bbb" strokeWidth="1.8" />
            <path d="M14.5 14.5L18 18" stroke="#bbb" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            style={styles.input}
            type={tab === 'phone' ? 'tel' : 'text'}
            placeholder={tab === 'order' ? 'Enter order number e.g. 2087' : 'Enter phone number e.g. 03001234567'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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

  return (
    <>
      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.orderNum}>Order #{order.order_number}</div>
        <div style={styles.customerName}>{order.customer_name}</div>
        <div style={styles.badges}>
          <span style={isDelivered ? styles.badgeDelivered : styles.badgeStatus}>{label}</span>
          <span style={styles.badgeDate}>{fmtDate(order.ordered_at)}</span>
        </div>
      </div>

      {/* Confirmed + Est Delivery row */}
      <div style={styles.infoRow}>
        <div style={styles.infoCard}>
          <div style={styles.infoLabel}>Order Confirmed</div>
          <div style={styles.infoValue}>{fmtDate(order.confirmed_at)}</div>
        </div>
        {isDelivered ? (
          <div style={styles.infoCard}>
            <div style={styles.infoLabel}>Delivered on</div>
            <div style={{ ...styles.infoValue, color: '#22c55e' }}>
              {order.status_history.find(h => h.status === 'delivered')
                ? fmtDate(order.status_history.find(h => h.status === 'delivered')!.timestamp)
                : '—'}
            </div>
          </div>
        ) : (
          <div style={styles.infoCard}>
            <div style={styles.infoLabel}>Est. Delivery</div>
            <div style={{ ...styles.infoValue, color: '#E50914', fontSize: 13 }}>
              {delivery.minDate} — {delivery.maxDate}
            </div>
          </div>
        )}
      </div>

      {/* Making in Progress note */}
      {isMaking && (
        <div style={styles.noteCard}>
          <div style={styles.noteIcon}>✦</div>
          <div>
            <div style={styles.noteTitle}>Crafting your order</div>
            <div style={styles.noteText}>
              Custom orders take a little extra care. We&apos;re making yours right now —
              thanks for your patience.
            </div>
          </div>
        </div>
      )}

      {/* Shipped — PostEx + delivery countdown */}
      {isShipped && (
        <>
          {order.tracking_id && (
            <div style={styles.postexCard}>
              <div style={styles.postexTop}>
                <span style={styles.sectionLabel}>Live Tracking · PostEx</span>
                {order.postex_status && (
                  <span style={styles.postexStatus}>{order.postex_status}</span>
                )}
              </div>
              <div style={styles.postexCn}>Tracking ID: {order.tracking_id}</div>
            </div>
          )}
          <div style={styles.deliveryCard}>
            <div style={styles.dbHeader}>
              <span style={styles.dbLabel}>Delivery Progress</span>
              <span style={styles.dbBadge}>
                {delivery.daysLeft === 0
                  ? 'Arriving soon'
                  : `${delivery.daysLeft} day${delivery.daysLeft === 1 ? '' : 's'} left`}
              </span>
            </div>
            <div style={styles.pbar}>
              <div style={{ ...styles.pfill, width: `${delivery.progress}%` }} />
            </div>
            <div style={styles.dbDates}>
              <span style={{ fontSize: 12, color: '#888' }}>Confirmed {fmtDate(order.confirmed_at)}</span>
              <span style={{ fontSize: 12, color: '#E50914', fontWeight: 600 }}>By {delivery.maxDate}</span>
            </div>
          </div>
        </>
      )}

      {/* Status History — only 2 entries: Confirmed + current */}
      <div style={styles.sectionLabel}>Status History</div>
      <div style={styles.timelineCard}>
        {/* Current status */}
        <div style={styles.timelineItem}>
          <div style={styles.timelineLine} />
          <div style={{ ...styles.dot, ...styles.dotActive }} />
          <div>
            <div style={styles.tlStatus}>
              {label}
              <span style={styles.tlTag}>current</span>
            </div>
            <div style={styles.tlTime}>
              {isShipped && order.status_history.find(h => h.status === 'shipped')
                ? fmtDateTime(order.status_history.find(h => h.status === 'shipped')!.timestamp)
                : isDelivered && order.status_history.find(h => h.status === 'delivered')
                ? fmtDateTime(order.status_history.find(h => h.status === 'delivered')!.timestamp)
                : 'In progress'}
            </div>
          </div>
        </div>
        {/* Order Confirmed */}
        <div style={{ ...styles.timelineItem, paddingBottom: 0 }}>
          <div style={{ ...styles.dot, ...styles.dotDone }} />
          <div>
            <div style={styles.tlStatus}>Order Confirmed</div>
            <div style={styles.tlTime}>{fmtDateTime(order.confirmed_at)}</div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div style={styles.sectionLabel}>Items</div>
      <div style={styles.itemsCard}>
        <div style={styles.itemsHeader}>Products</div>
        {order.items.map((item, i) => (
          <div
            key={i}
            style={{
              ...styles.itemRow,
              ...(i === order.items.length - 1 ? { borderBottom: 'none' } : {}),
            }}
          >
            <span style={styles.itemName}>
              {item.name}{item.variant ? ` — ${item.variant}` : ''}
            </span>
            <span style={styles.itemQty}>x{item.quantity}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const RED = '#E50914';
const CARD = '#1e1e1e';
const BORDER = '#333';

const styles: Record<string, React.CSSProperties> = {
  main: { background: '#f4f4f4', minHeight: '100vh', padding: '20px', fontFamily: "'DM Sans', sans-serif" },
  tracker: { maxWidth: 540, margin: '0 auto' },

  appHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 },
  logo: { background: RED, color: '#fff', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: '1.5px', padding: '6px 12px', borderRadius: 8 },
  appSub: { fontSize: 12, color: '#999', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500 },

  tabs: { display: 'flex', gap: 6, marginBottom: 10 },
  tab: { flex: 1, textAlign: 'center', padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 10, color: '#666', background: '#e9e9e9', border: 'none', fontFamily: "'DM Sans', sans-serif" },
  tabActive: { background: RED, color: '#fff' },

  searchBar: { background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 12, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  input: { background: 'none', border: 'none', outline: 'none', color: '#111', fontFamily: "'DM Sans', sans-serif", fontSize: 14, flex: 1, fontWeight: 500 },
  searchBtn: { background: RED, color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', fontWeight: 600 },

  errorBox: { background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#b91c1c', fontSize: 14, marginBottom: 12 },

  hero: { background: `linear-gradient(135deg, ${RED} 0%, #a30610 100%)`, borderRadius: 14, padding: 24, marginBottom: 10, position: 'relative', overflow: 'hidden' },
  orderNum: { fontSize: 11, color: 'rgba(255,255,255,0.65)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 5, fontFamily: "'Syne', sans-serif", fontWeight: 600 },
  customerName: { fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 14, lineHeight: 1.1 },
  badges: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  badgeStatus: { fontSize: 12, fontWeight: 600, padding: '5px 13px', borderRadius: 20, background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' },
  badgeDate: { fontSize: 12, fontWeight: 600, padding: '5px 13px', borderRadius: 20, background: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' },
  badgeDelivered: { fontSize: 12, fontWeight: 600, padding: '5px 13px', borderRadius: 20, background: '#22c55e25', color: '#22c55e', border: '1px solid #22c55e50' },

  infoRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 },
  infoCard: { background: CARD, borderRadius: 12, padding: 16 },
  infoLabel: { fontSize: 11, color: '#888', letterSpacing: '0.5px', marginBottom: 5, fontWeight: 500 },
  infoValue: { fontSize: 15, fontWeight: 700, color: '#f0f0f0', fontFamily: "'Syne', sans-serif" },

  // Patience note card
  noteCard: { background: CARD, borderRadius: 12, padding: '14px 16px', marginBottom: 8, display: 'flex', gap: 14, alignItems: 'flex-start', border: `1px solid #2e2e2e` },
  noteIcon: { fontSize: 16, color: RED, marginTop: 2, flexShrink: 0 },
  noteTitle: { fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 4, fontFamily: "'Syne', sans-serif" },
  noteText: { fontSize: 12, color: '#888', lineHeight: 1.6 },

  postexCard: { background: CARD, borderRadius: 12, padding: 16, marginBottom: 8 },
  postexTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  postexStatus: { fontSize: 12, color: RED, fontWeight: 700, background: '#E5091415', padding: '3px 10px', borderRadius: 6, border: '1px solid #E5091440' },
  postexCn: { fontSize: 13, color: '#aaa', fontWeight: 500 },

  deliveryCard: { background: CARD, borderRadius: 12, padding: 16, marginBottom: 8 },
  dbHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dbLabel: { fontSize: 11, color: '#888', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 },
  dbBadge: { fontSize: 11, color: RED, background: '#E5091415', border: '1px solid #E5091445', padding: '3px 9px', borderRadius: 20, fontWeight: 600 },
  pbar: { height: 5, background: '#2e2e2e', borderRadius: 3, marginBottom: 10, overflow: 'hidden' },
  pfill: { height: '100%', background: RED, borderRadius: 3 },
  dbDates: { display: 'flex', justifyContent: 'space-between' },

  sectionLabel: { fontSize: 10, color: '#666', letterSpacing: '2px', textTransform: 'uppercase', margin: '14px 0 8px', paddingLeft: 2, fontWeight: 600 },

  timelineCard: { background: CARD, borderRadius: 14, padding: 18, marginBottom: 8 },
  timelineItem: { display: 'flex', gap: 14, position: 'relative', paddingBottom: 18 },
  timelineLine: { position: 'absolute', left: 6, top: 18, bottom: 0, width: 1.5, background: BORDER },
  dot: { width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 3, position: 'relative', zIndex: 1 },
  dotActive: { background: RED, boxShadow: '0 0 0 4px #E5091425' },
  dotDone: { background: '#22c55e', boxShadow: '0 0 0 4px #22c55e20' },
  tlStatus: { fontSize: 15, fontWeight: 700, color: '#f0f0f0', marginBottom: 3, fontFamily: "'Syne', sans-serif", display: 'flex', alignItems: 'center', gap: 8 },
  tlTime: { fontSize: 12, color: '#888' },
  tlTag: { fontSize: 10, color: RED, background: '#E5091415', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.5px', border: '1px solid #E5091445', fontWeight: 600 },

  itemsCard: { background: CARD, borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  itemsHeader: { padding: '14px 18px 10px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, color: '#888', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 },
  itemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: `1px solid ${BORDER}` },
  itemName: { fontSize: 14, color: '#f0f0f0', fontWeight: 500 },
  itemQty: { fontSize: 12, color: '#888', background: '#2e2e2e', padding: '3px 10px', borderRadius: 6, fontWeight: 600, border: `1px solid ${BORDER}` },
};
