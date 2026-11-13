// apps/trader-ui/src/components/OrderBook.jsx
import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';

function generateLevels(basePrice, side, count = 9) {
  const levels = [];
  const seed = basePrice || 100;

  for (let i = 0; i < count; i++) {
    const spreadFactor = side === 'ask'
      ? 0.0008 + i * 0.00045
      : -(0.0008 + i * 0.00045);

    const price = seed * (1 + spreadFactor);
    // Pseudo-random but deterministic per price level
    const hash = Math.abs(Math.sin(price * 1000 + i * 7)) * 10000;
    const size = 50 + (hash % 950);
    levels.push({ price, size: parseFloat(size.toFixed(0)) });
  }
  return levels;
}

export default function OrderBook({ marketData }) {
  const price = marketData?.price || null;
  const symbol = marketData?.symbol || 'NEAR';

  const { asks, bids, spread, maxSize } = useMemo(() => {
    if (!price) return { asks: [], bids: [], spread: 0, maxSize: 1 };

    const rawAsks = generateLevels(price, 'ask').sort((a, b) => a.price - b.price);
    const rawBids = generateLevels(price, 'bid').sort((a, b) => b.price - a.price);

    const spread = rawAsks[0].price - rawBids[0].price;
    const allSizes = [...rawAsks, ...rawBids].map((l) => l.size);
    const maxSize = Math.max(...allSizes);

    return { asks: rawAsks, bids: rawBids, spread, maxSize };
  }, [price]);

  const fmt = (p) => {
    if (!p) return '--';
    if (p >= 100) return p.toFixed(2);
    if (p >= 10) return p.toFixed(3);
    return p.toFixed(4);
  };

  const pct = (size) => `${((size / maxSize) * 100).toFixed(0)}%`;

  if (!price) {
    return (
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Waiting for market data…</span>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <BookOpen size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>ORDER BOOK</span>
        </div>
        <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{symbol}/USD</span>
      </div>

      {/* Column labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '5px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Price (USD)</span>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'right' }}>Size</span>
      </div>

      {/* Asks (sell orders) — ascending, red */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
        {asks.map((level, i) => (
          <div key={`ask-${i}`} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '3px 12px', cursor: 'default' }}>
            {/* depth bar */}
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: pct(level.size), background: 'rgba(239,68,68,0.07)', pointerEvents: 'none' }} />
            <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--accent-red)', position: 'relative', zIndex: 1 }}>{fmt(level.price)}</span>
            <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textAlign: 'right', position: 'relative', zIndex: 1 }}>{level.size.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Spread row */}
      <div style={{ padding: '7px 12px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span className="mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>${fmt(price)}</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Spread: <span className="mono" style={{ color: 'var(--accent-amber)' }}>${spread.toFixed(4)}</span></span>
      </div>

      {/* Bids (buy orders) — descending, green */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {bids.map((level, i) => (
          <div key={`bid-${i}`} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '3px 12px', cursor: 'default' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: pct(level.size), background: 'rgba(16,185,129,0.07)', pointerEvents: 'none' }} />
            <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--accent-green)', position: 'relative', zIndex: 1 }}>{fmt(level.price)}</span>
            <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textAlign: 'right', position: 'relative', zIndex: 1 }}>{level.size.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
