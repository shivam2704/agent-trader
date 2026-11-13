// apps/trader-ui/src/components/OrderBook.jsx
import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';

const ROW_COUNT = 10;
const ROW_H = 24; // px per row

function generateLevels(basePrice, side, count) {
  const levels = [];
  for (let i = 0; i < count; i++) {
    const spread = side === 'ask'
      ? 0.0005 + i * 0.0004
      : -(0.0005 + i * 0.0004);
    const price = basePrice * (1 + spread);
    const size = Math.round(50 + Math.abs(Math.sin(price * 97 + i * 13)) * 950);
    levels.push({ price, size });
  }
  return levels;
}

export default function OrderBook({ marketData }) {
  const price = marketData?.price || null;
  const symbol = marketData?.symbol || 'NEAR';

  const { asks, bids, spread, maxSize } = useMemo(() => {
    if (!price) return { asks: [], bids: [], spread: 0, maxSize: 1 };
    // asks: sorted low→high (closest to spread first → show bottom-up)
    const rawAsks = generateLevels(price, 'ask', ROW_COUNT).sort((a, b) => a.price - b.price);
    // bids: sorted high→low (closest to spread first)
    const rawBids = generateLevels(price, 'bid', ROW_COUNT).sort((a, b) => b.price - a.price);
    const spread = rawAsks[0].price - rawBids[0].price;
    const maxSize = Math.max(...[...rawAsks, ...rawBids].map(l => l.size));
    return { asks: rawAsks, bids: rawBids, spread, maxSize };
  }, [price]);

  const fmt = (p) => {
    if (!p) return '--';
    if (p >= 1000) return p.toFixed(1);
    if (p >= 100) return p.toFixed(2);
    if (p >= 10) return p.toFixed(3);
    return p.toFixed(4);
  };

  if (!price) {
    return (
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Waiting for market data…</span>
      </div>
    );
  }

  const totalAskH = ROW_COUNT * ROW_H;
  const totalBidH = ROW_COUNT * ROW_H;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <BookOpen size={13} color="var(--text-muted)" />
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>ORDER BOOK</span>
        </div>
        <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{symbol}/USD</span>
      </div>

      {/* Column labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '4px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Price (USD)</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Size</span>
      </div>

      {/* ASKS — highest price at top, lowest (closest to mid) at bottom */}
      <div style={{ height: totalAskH, flexShrink: 0, overflow: 'hidden' }}>
        {[...asks].reverse().map((level, i) => {
          const barW = `${((level.size / maxSize) * 100).toFixed(0)}%`;
          return (
            <div key={`ask-${i}`} style={{ position: 'relative', height: ROW_H, display: 'flex', alignItems: 'center', padding: '0 14px' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: barW, background: 'rgba(239,68,68,0.09)', pointerEvents: 'none' }} />
              <span className="mono" style={{ flex: 1, fontSize: '0.73rem', color: 'var(--accent-red)', position: 'relative', zIndex: 1 }}>{fmt(level.price)}</span>
              <span className="mono" style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', position: 'relative', zIndex: 1 }}>{level.size.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      {/* Spread / Mid price row */}
      <div style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span className="mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>${fmt(price)}</span>
        <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)' }}>
          Spread: <span className="mono" style={{ color: 'var(--accent-amber)' }}>${spread.toFixed(4)}</span>
        </span>
      </div>

      {/* BIDS — highest (closest to mid) at top */}
      <div style={{ height: totalBidH, flexShrink: 0, overflow: 'hidden' }}>
        {bids.map((level, i) => {
          const barW = `${((level.size / maxSize) * 100).toFixed(0)}%`;
          return (
            <div key={`bid-${i}`} style={{ position: 'relative', height: ROW_H, display: 'flex', alignItems: 'center', padding: '0 14px' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: barW, background: 'rgba(16,185,129,0.09)', pointerEvents: 'none' }} />
              <span className="mono" style={{ flex: 1, fontSize: '0.73rem', color: 'var(--accent-green)', position: 'relative', zIndex: 1 }}>{fmt(level.price)}</span>
              <span className="mono" style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', position: 'relative', zIndex: 1 }}>{level.size.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
