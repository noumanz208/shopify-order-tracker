'use client'

import { useState } from 'react'

type OrderStatus = 'in_process' | 'shipped' | 'delivered'

const STATUS_LABEL: Record<OrderStatus, string> = {
  in_process: 'Making in Progress',
  shipped: 'Shipped',
  delivered: 'Delivered',
}

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
    shippedAt: string | null
  }
  history: { status: OrderStatus; note: string | null; changed_at: string }[]
}

function workingDaysBetween(a: string, b: string) {
  const start = new Date(a); start.setHours(0, 0, 0, 0)
  const end = new Date(b); end.setHours(0, 0, 0, 0)
  let count = 0
  const cur = new Date(start)
  while (cur < end) {
    cur.setDate(cur.getDate() + 1)
    if (cur.getDay() !== 0) count++
  }
  return count
}

function todayStr() {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return t.toISOString().slice(0, 10)
}

function fmtShort(d: Date) {
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })
}
function fmtFull(d: Date) {
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function fmtCCDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function calcCountdown(order: TrackingResult['order']) {
  const today = todayStr()

  // IN PROCESS: 10 working days from confirm date
  if (order.status === 'in_process') {
    const confirmed = new Date(order.createdAt); confirmed.setHours(0, 0, 0, 0)
    const maxD = new Date(confirmed); maxD.setDate(confirmed.getDate() + 10)
    const passed = workingDaysBetween(order.createdAt, today)
    const daysLeft = Math.max(1, 10 - passed)
    const prog = Math.min(95, Math.round((passed / 10) * 100))
    return {
      daysLeft, prog,
      startFmt: fmtFull(confirmed),
      maxDate: fmtFull(maxD),
      estRange: `7 – 10 working days`,
      shippedMode: false,
    }
  }

  // SHIPPED: 5 working days from shipped date
  if (order.status === 'shipped' && order.shippedAt) {
    const shipped = new Date(order.shippedAt); shipped.setHours(0, 0, 0, 0)
    const deadlineD = new Date(shipped); deadlineD.setDate(shipped.getDate() + 5)
    const passed = workingDaysBetween(order.shippedAt, today)
    const daysLeft = Math.max(1, 5 - passed)
    const prog = Math.min(95, Math.round((passed / 5) * 100))
    return {
      daysLeft, prog,
      startFmt: fmtFull(shipped),
      maxDate: fmtFull(deadlineD),
      estRange: '',
      shippedMode: true,
    }
  }

  return null
}

async function fetchCallCourier(trackingId: string): Promise<{ ok: boolean; data?: any }> {
  try {
    const res = await fetch(
      `http://cod.callcourier.com.pk/api/CallCourier/GetTackingHistory?cn=${trackingId}`
    )
    if (!res.ok) return { ok: false }
    const json = await res.json()
    if (!Array.isArray(json) || json.length === 0) return { ok: false }

    const sorted = [...json].sort(
      (a, b) => new Date(b.TransactionDate).getTime() - new Date(a.TransactionDate).getTime()
    )

    const events = sorted.map((ev: any, i: number) => ({
      label: ev.ProcessDescForPortal || ev.OperationDesc || 'Update',
      time: fmtCCDate(ev.TransactionDate),
      state: i === 0 ? 'active' : 'done',
    }))

    return { ok: true, data: { events } }
  } catch {
    return { ok: false }
  }
}

function buildTimeline(order: TrackingResult['order'], history: TrackingResult['history']) {
  const isDelivered = order.status === 'delivered'
  const isShipped = order.status === 'shipped'
  const historyTime = (s: string) => {
    const entry = history.find(h => h.status === s)
    return entry ? fmtDateTime(entry.changed_at) : 'Completed'
  }
  if (isDelivered) {
    return [
      { dot: 'green', label: 'Delivered', sub: historyTime('delivered'), tag: null },
      { dot: 'green', label: 'Shipped', sub: `Tracking ID: ${order.trackingId}`, tag: null },
      { dot: 'green', label: 'Making in Progress', sub: 'Completed', tag: null },
      { dot: 'green', label: 'Order Confirmed', sub: fmtDate(order.createdAt), tag: null },
    ]
  }
  if (isShipped) {
    return [
      { dot: 'red', label: 'Shipped', sub: `Tracking ID: ${order.trackingId}`, tag: 'current' },
      { dot: 'green', label: 'Making in Progress', sub: 'Completed', tag: null },
      { dot: 'green', label: 'Order Confirmed', sub: fmtDate(order.createdAt), tag: null },
    ]
  }
  return [
    { dot: 'red', label: 'Making in Progress', sub: 'In progress', tag: 'current' },
    { dot: 'green', label: 'Order Confirmed', sub: fmtDate(order.createdAt), tag: null },
  ]
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow-y:auto}
:root{
  --red:#E8192C;
  --red-dk:#c0111f;
  --red-lt:#2a0608;
  --red-glow:rgba(232,25,44,0.15);
  --red-border:rgba(232,25,44,0.3);
  --green:#22c55e;
  --green-lt:#052010;
  --green-border:rgba(34,197,94,0.3);
  --amber:#f59e0b;
  --amber-lt:#1a0f00;
  --amber-border:rgba(245,158,11,0.3);
  --bg:#0a0a0a;
  --surface:#111111;
  --surface2:#1a1a1a;
  --border:#2a2a2a;
  --border-bright:#3a3a3a;
  --text:#f5f5f5;
  --text2:#a0a0a0;
  --text3:#555555;
  --white:#ffffff;
  --font-display:'Bebas Neue',sans-serif;
  --font:'DM Sans',sans-serif;
}
.page{background:var(--bg);min-height:100vh;font-family:var(--font);padding-bottom:80px;-webkit-overflow-scrolling:touch;background-image:radial-gradient(ellipse at 20% 0%,rgba(232,25,44,0.06) 0%,transparent 60%)}

.topbar{background:rgba(10,10,10,0.95);border-bottom:1px solid var(--border);padding:0 20px;height:56px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:10;backdrop-filter:blur(10px)}
.logo{background:var(--red);color:#fff;font-family:var(--font-display);font-size:14px;letter-spacing:3px;padding:6px 12px;border-radius:4px;line-height:1}
.topbar-sub{font-size:11px;color:var(--text3);font-weight:600;letter-spacing:2px;text-transform:uppercase}

.container{max-width:580px;margin:0 auto;padding:28px 16px 0}

.search-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:20px}
.search-title{font-family:var(--font-display);font-size:32px;color:var(--text);margin-bottom:2px;letter-spacing:2px;line-height:1}
.search-sub{font-size:12px;color:var(--text3);font-weight:500;margin-bottom:20px;letter-spacing:.5px}
.tabs{display:flex;background:var(--bg);border-radius:8px;padding:3px;margin-bottom:14px;border:1px solid var(--border)}
.tab{flex:1;padding:9px 12px;font-size:12px;font-weight:700;cursor:pointer;border-radius:6px;color:var(--text3);background:transparent;border:none;font-family:var(--font);transition:all .2s;letter-spacing:.5px;text-transform:uppercase}
.tab.active{background:var(--red);color:#fff;box-shadow:0 2px 12px rgba(232,25,44,.4)}
.input-row{display:flex;gap:10px}
.input-row input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 16px;color:var(--text);font-family:var(--font);font-size:14px;font-weight:500;outline:none;transition:border .2s,box-shadow .2s}
.input-row input::placeholder{color:var(--text3);font-weight:400}
.input-row input:focus{border-color:var(--red);box-shadow:0 0 0 3px var(--red-glow)}
.track-btn{background:var(--red);color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:13px;font-family:var(--font);cursor:pointer;font-weight:700;white-space:nowrap;letter-spacing:1px;text-transform:uppercase;box-shadow:0 4px 16px rgba(232,25,44,.35);transition:all .2s}
.track-btn:hover{background:var(--red-dk);box-shadow:0 4px 20px rgba(232,25,44,.5)}
.track-btn:active{transform:scale(.97)}
.track-btn:disabled{background:#3a1a1c;color:#6b3338;cursor:not-allowed;box-shadow:none}
.err{background:#1a0608;border:1px solid var(--red-border);border-radius:8px;padding:12px 16px;color:var(--red);font-size:13px;margin-top:14px;font-weight:600}

.hero{background:linear-gradient(135deg,#1a0608 0%,#0f0f0f 50%,#1a0a06 100%);border:1px solid var(--red-border);border-radius:16px;padding:28px 24px;margin-bottom:12px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--red),transparent)}
.hero::after{content:'';position:absolute;top:-80px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(232,25,44,0.12) 0%,transparent 70%);border-radius:50%}
.hero-no{font-size:10px;color:var(--text3);letter-spacing:3px;text-transform:uppercase;font-weight:600;margin-bottom:10px;position:relative;z-index:1}
.hero-name{font-family:var(--font-display);font-size:36px;color:var(--text);margin-bottom:18px;position:relative;z-index:1;line-height:1;letter-spacing:2px}
.hero-badges{display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:1}
.hb{font-size:11px;font-weight:700;padding:5px 14px;border-radius:4px;letter-spacing:1px;text-transform:uppercase}
.hb-status{background:rgba(255,255,255,0.06);color:var(--text2);border:1px solid var(--border-bright)}
.hb-delivered{background:var(--green-lt);color:var(--green);border:1px solid var(--green-border)}
.hb-shipped{background:rgba(232,25,44,0.1);color:var(--red);border:1px solid var(--red-border)}
.hb-date{background:rgba(255,255,255,0.04);color:var(--text3);border:1px solid var(--border)}

.info-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px}
.tile-lbl{font-size:10px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-bottom:8px}
.tile-val{font-size:15px;font-weight:700;color:var(--text)}
.tile-val.sm{font-size:13px;font-weight:600;color:var(--text2)}
.tile-val.green{color:var(--green)}

.note{background:var(--surface);border:1px solid var(--red-border);border-radius:12px;padding:16px 18px;margin-bottom:12px;display:flex;gap:14px;align-items:flex-start;position:relative;overflow:hidden}
.note::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--red)}
.note-icon{width:36px;height:36px;background:var(--red-lt);border:1px solid var(--red-border);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.note-title{font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px;letter-spacing:.3px}
.note-body{font-size:12px;color:var(--text2);line-height:1.6;font-weight:400}

.promise-banner{border:1px solid var(--red-border);border-radius:16px;padding:6px 8px;margin-bottom:12px;display:grid;grid-template-columns:1fr 1fr 1fr;position:relative;overflow:hidden;background:#0c0c0c}
.promise-banner::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(232,25,44,0.6),transparent)}
.promise-banner::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(232,25,44,0.2),transparent)}
.pb-item{display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 10px}
.pb-item+.pb-item{border-left:1px solid var(--border)}
.pb-icon-wrap{width:40px;height:40px;background:var(--red-lt);border:1px solid var(--red-border);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pb-icon-svg{width:18px;height:18px;stroke:var(--red);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.pb-val{font-family:var(--font-display);font-size:30px;color:var(--red);letter-spacing:2px;line-height:1}
.pb-desc{font-size:9px;color:var(--text3);font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;line-height:1.5}

.cd-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:12px}
.cd-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
.cd-lbl{font-size:10px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-bottom:6px}
.cd-num{font-family:var(--font-display);font-size:52px;color:var(--red);line-height:1;letter-spacing:2px}
.cd-unit{font-size:11px;color:var(--text3);font-weight:600;margin-top:2px;letter-spacing:1px;text-transform:uppercase}
.cd-pill{background:rgba(232,25,44,0.1);color:var(--red);border:1px solid var(--red-border);font-size:11px;font-weight:700;padding:6px 14px;border-radius:4px;white-space:nowrap;max-width:160px;text-align:right;letter-spacing:.5px;text-transform:uppercase}
.cd-pill.amber{background:var(--amber-lt);color:var(--amber);border-color:var(--amber-border)}
.pbar{background:var(--surface2);border-radius:2px;height:3px;overflow:hidden;margin-bottom:12px}
.pfill{height:100%;background:linear-gradient(90deg,var(--red-dk),var(--red));border-radius:2px;transition:width .8s ease}
.cd-dates{display:flex;justify-content:space-between}
.cd-dates span{font-size:11px;color:var(--text3);font-weight:500}
.cd-dates .cd-end{color:var(--text2);font-weight:700}

.sec-lbl{font-size:10px;color:var(--text3);letter-spacing:3px;text-transform:uppercase;font-weight:700;margin:22px 0 10px 2px}

.px-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:12px}
.px-head{padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--surface2)}
.px-head-lbl{font-size:10px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;font-weight:700}
.px-tid{background:var(--red-lt);color:var(--red);border:1px solid var(--red-border);font-size:11px;font-weight:700;padding:4px 12px;border-radius:4px;letter-spacing:.5px}
.px-body{padding:16px 20px}
.px-loading{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text3);font-weight:500}
.px-dot{width:6px;height:6px;border-radius:50%;background:var(--red);animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
.px-item{display:flex;gap:14px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border)}
.px-item:last-child{border-bottom:none}
.px-ico{width:34px;height:34px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.px-ico.active{background:var(--red-lt);border:1px solid var(--red-border)}
.px-ico.done{background:var(--green-lt);border:1px solid var(--green-border)}
.px-ico.pending{background:var(--surface2);border:1px solid var(--border)}
.px-label{font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap}
.px-now{font-size:9px;color:var(--red);background:var(--red-lt);padding:2px 8px;border-radius:3px;border:1px solid var(--red-border);font-weight:700;letter-spacing:1px;text-transform:uppercase}
.px-time{font-size:11px;color:var(--text3);font-weight:500}
.px-link{display:block;padding:13px 20px;border-top:1px solid var(--border);font-size:12px;color:var(--red);text-decoration:none;text-align:center;font-weight:700;transition:background .2s;cursor:pointer;background:transparent;width:100%;border-left:none;border-right:none;border-bottom:none;font-family:var(--font);letter-spacing:1px;text-transform:uppercase}
.px-link:hover{background:var(--red-lt)}

.tl-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:12px}
.tl-item{display:flex;gap:16px;position:relative;padding-bottom:22px}
.tl-item:last-child{padding-bottom:0}
.tl-line{position:absolute;left:7px;top:20px;bottom:0;width:1px;background:linear-gradient(to bottom,var(--border-bright),transparent)}
.tl-dot{width:16px;height:16px;border-radius:50%;flex-shrink:0;margin-top:3px;position:relative;z-index:1}
.tl-dot.red{background:var(--red);box-shadow:0 0 0 3px var(--surface),0 0 0 5px var(--red-border),0 0 12px rgba(232,25,44,.4)}
.tl-dot.amber{background:var(--amber);box-shadow:0 0 0 3px var(--surface),0 0 0 5px var(--amber-border)}
.tl-dot.green{background:var(--green);box-shadow:0 0 0 3px var(--surface),0 0 0 5px var(--green-border)}
.tl-label{font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap}
.tl-tag{font-size:9px;color:var(--red);background:var(--red-lt);padding:2px 8px;border-radius:3px;border:1px solid var(--red-border);font-weight:700;letter-spacing:1px;text-transform:uppercase}
.tl-tag-amber{font-size:9px;color:var(--amber);background:var(--amber-lt);padding:2px 8px;border-radius:3px;border:1px solid var(--amber-border);font-weight:700;letter-spacing:1px;text-transform:uppercase}
.tl-sub{font-size:12px;color:var(--text3);font-weight:400}
`

function CourierEvents({ events }: { events: any[] | null }) {
  const icons = ['🚚', '📦', '🏢', '➡️', '✅', '📍', '🔄', '↩️', '📋', '🏠', '🎯']
  if (!events) {
    return <div className="px-loading"><div className="px-dot" />Fetching live courier status…</div>
  }
  if (events.length === 0) {
    return <div style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Tracking info not available yet.</div>
  }
  return (
    <>
      {events.map((ev, i) => (
        <div key={i} className="px-item">
          <div className={`px-ico ${ev.state}`}>{icons[i] || '📍'}</div>
          <div>
            <div className="px-label">
              {ev.label}
              {ev.state === 'active' && <span className="px-now">LATEST</span>}
            </div>
            <div className="px-time">{ev.time}</div>
          </div>
        </div>
      ))}
    </>
  )
}

function PromiseBanner() {
  return (
    <div className="promise-banner">
      <div className="pb-item">
        <div className="pb-icon-wrap">
          <svg className="pb-icon-svg" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div className="pb-val">10</div>
        <div className="pb-desc">Estimated Days To Make Your Order</div>
      </div>
      <div className="pb-item">
        <div className="pb-icon-wrap">
          <svg className="pb-icon-svg" viewBox="0 0 24 24">
            <rect x="1" y="3" width="15" height="13" rx="1"/>
            <path d="M16 8h4l3 5v3h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <div className="pb-val">5</div>
        <div className="pb-desc">Days delivery</div>
      </div>
      <div className="pb-item">
        <div className="pb-icon-wrap">
          <svg className="pb-icon-svg" viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <div className="pb-val">100%</div>
        <div className="pb-desc">Customised</div>
      </div>
    </div>
  )
}

export default function TrackPage() {
  const [tab, setTab] = useState<'order' | 'phone'>('order')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TrackingResult | null>(null)
  const [courierEvents, setCourierEvents] = useState<any[] | null | undefined>(undefined)

  async function handleTrack() {
    if (!query.trim()) {
      setError('Please enter your ' + (tab === 'order' ? 'order number.' : 'phone number.'))
      return
    }
    setLoading(true); setError(''); setResult(null); setCourierEvents(undefined)
    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tab === 'order' ? { orderNumber: query.trim() } : { phone: query.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Order not found.'); return }
      setResult(data)
      if ((data.order.status === 'shipped' || data.order.status === 'delivered') && data.order.trackingId) {
        setCourierEvents(null)
        const cc = await fetchCallCourier(data.order.trackingId)
        setCourierEvents(cc.ok ? cc.data.events : [])
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function switchTab(t: 'order' | 'phone') {
    setTab(t); setQuery(''); setError(''); setResult(null); setCourierEvents(undefined)
  }

  function renderResult() {
    if (!result) return null
    const o = result.order
    const isDelivered = o.status === 'delivered'
    const isShipped = o.status === 'shipped'
    const isInProcess = o.status === 'in_process'
    const label = STATUS_LABEL[o.status] ?? o.status
    const cd = calcCountdown(o)
    const timeline = buildTimeline(o, result.history)
    const heroBadge = isDelivered ? 'hb hb-delivered' : isShipped ? 'hb hb-shipped' : 'hb hb-status'

    return (
      <>
        <div className="hero">
          <div className="hero-no">Order #{o.orderNumber}</div>
          <div className="hero-name">{o.customerName || 'Your Order'}</div>
          <div className="hero-badges">
            <span className={heroBadge}>{label}</span>
            <span className="hb hb-date">{fmtDate(o.createdAt)}</span>
          </div>
        </div>

        <div className="info-row">
          <div className="tile">
            <div className="tile-lbl">Ordered On</div>
            <div className="tile-val">{fmtDate(o.createdAt)}</div>
          </div>
          {isDelivered ? (
            <div className="tile">
              <div className="tile-lbl">Delivered On</div>
              <div className="tile-val green">{fmtDate(o.updatedAt)}</div>
            </div>
          ) : (
            <div className="tile">
              <div className="tile-lbl">Est. Delivery</div>
              <div className={`tile-val${cd ? ' sm' : ''}`}>
                {cd ? (cd.shippedMode ? `By ${cd.maxDate}` : cd.estRange) : '7 – 10 working days'}
              </div>
            </div>
          )}
        </div>

        {isInProcess && (
          <div className="note">
            <div className="note-icon">🎨</div>
            <div>
              <div className="note-title">Crafting your order</div>
              <div className="note-body">We're carefully making your custom order. You'll be notified as soon as it ships.</div>
            </div>
          </div>
        )}

        {!isDelivered && <PromiseBanner />}

        {cd && !isDelivered && (
          <div className="cd-card">
            <div className="cd-top">
              <div>
                <div className="cd-lbl">{isShipped ? 'Delivery Window' : 'Delivery Countdown'}</div>
                <div className="cd-num">{cd.daysLeft}</div>
                <div className="cd-unit">day{cd.daysLeft === 1 ? '' : 's'} remaining</div>
              </div>
              <div className={`cd-pill${isShipped ? ' amber' : ''}`}>
                {isShipped
                  ? cd.daysLeft === 1 ? 'Arriving soon' : `Est. ${cd.daysLeft} days`
                  : cd.estRange || `By ${cd.maxDate}`}
              </div>
            </div>
            <div className="pbar"><div className="pfill" style={{ width: `${cd.prog}%` }} /></div>
            <div className="cd-dates">
              <span>{isShipped ? `Shipped ${cd.startFmt}` : `Confirmed ${cd.startFmt}`}</span>
              <span className="cd-end">By {cd.maxDate}</span>
            </div>
          </div>
        )}

        {(isShipped || isDelivered) && o.trackingId && (
          <>
            <div className="sec-lbl">Live Courier Tracking</div>
            <div className="px-card">
              <div className="px-head">
                <span className="px-head-lbl">Call Courier Status</span>
                <span className="px-tid">{o.trackingId}</span>
              </div>
              <div className="px-body">
                <CourierEvents events={courierEvents === undefined ? null : courierEvents} />
              </div>
              <button
                className="px-link"
                onClick={() => {
                  if (o.trackingId) {
                    navigator.clipboard.writeText(o.trackingId).catch(() => {})
                  }
                  window.open(`https://callcourier.com.pk/tracking/?tc=${o.trackingId}`, '_blank')
                }}
              >
                Track on Call Courier website → (CN copied ✓)
              </button>
            </div>
          </>
        )}

        <div className="sec-lbl">Status History</div>
        <div className="tl-card">
          {timeline.map((item, i) => (
            <div key={i} className="tl-item" style={i === timeline.length - 1 ? { paddingBottom: 0 } : {}}>
              {i < timeline.length - 1 && <div className="tl-line" />}
              <div className={`tl-dot ${item.dot}`} />
              <div>
                <div className="tl-label">
                  {item.label}
                  {item.tag === 'current' && !isShipped && <span className="tl-tag">current</span>}
                  {item.tag === 'current' && isShipped && <span className="tl-tag-amber">current</span>}
                </div>
                <div className="tl-sub">{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <div className="topbar">
          <div className="logo">KOVR</div>
          <span className="topbar-sub">Order Tracker</span>
        </div>
        <div className="container">
          <div className="search-card">
            <div className="search-title">Track Your Order</div>
            <div className="search-sub">Enter your order number or phone to get live updates</div>
            <div className="tabs">
              <button className={`tab${tab === 'order' ? ' active' : ''}`} onClick={() => switchTab('order')}>Order Number</button>
              <button className={`tab${tab === 'phone' ? ' active' : ''}`} onClick={() => switchTab('phone')}>Phone Number</button>
            </div>
            <div className="input-row">
              <input
                type={tab === 'phone' ? 'tel' : 'text'}
                placeholder={tab === 'order' ? 'e.g. 2087' : 'e.g. 03001234567'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTrack()}
              />
              <button className="track-btn" onClick={handleTrack} disabled={loading}>
                {loading ? 'Searching…' : 'Track →'}
              </button>
            </div>
            {error && <div className="err">{error}</div>}
          </div>
          {renderResult()}
        </div>
      </div>
    </>
  )
}
