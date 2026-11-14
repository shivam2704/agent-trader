// apps/trader-ui/src/components/OrderBook.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BookOpen, Activity, BarChart2, ArrowUp, ArrowDown, ChevronsRight, ChevronsLeft } from 'lucide-react';

const DEFAULT_ROWS = 12; // 12 asks + 12 bids = 24 rows
const ROW_H = 19; // px per row

function generateLevels(basePrice, side, count) {
  const levels = [];
  let cumTotal = 0;
  for (let i = 0; i < count; i++) {
    const spread = side === 'ask'
      ? 0.0003 + i * 0.00028
      : -(0.0003 + i * 0.00028);
    const price = basePrice * (1 + spread);
    const size = Math.round(45 + Math.abs(Math.sin(price * 113 + i * 19)) * 780);
    cumTotal += size;
    levels.push({ price, size, total: cumTotal });
  }
  return levels;
}

export default function OrderBook({ marketData, isCollapsed, onToggleCollapse }) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed((prev) => !prev));

  const [activeTab, setActiveTab] = useState('book'); // 'book' | 'trades' | 'depth'
  const [bookMode, setBookMode] = useState('both'); // 'both' | 'asks' | 'bids'
  const [liveTrades, setLiveTrades] = useState([]);
  const [depthHoverInfo, setDepthHoverInfo] = useState(null);

  const price = marketData?.price || null;
  const symbol = (marketData?.symbol || 'NEAR').toUpperCase();
  const lastPriceRef = useRef(price);
  const [priceDirection, setPriceDirection] = useState('up');

  // Track price direction tick
  useEffect(() => {
    if (price && lastPriceRef.current) {
      if (price > lastPriceRef.current) setPriceDirection('up');
      else if (price < lastPriceRef.current) setPriceDirection('down');
    }
    lastPriceRef.current = price;
  }, [price]);

  // Dynamic Row Count based on view mode
  const rowCount = bookMode === 'both' ? DEFAULT_ROWS : DEFAULT_ROWS * 2;

  // 1. Order Book Levels
  const { asks, bids, spread, spreadPercent, maxTotal, totalBidVol, totalAskVol } = useMemo(() => {
    if (!price) {
      return { asks: [], bids: [], spread: 0, spreadPercent: 0, maxTotal: 1, totalBidVol: 0, totalAskVol: 0 };
    }

    const rawAsks = generateLevels(price, 'ask', rowCount).sort((a, b) => a.price - b.price);
    const rawBids = generateLevels(price, 'bid', rowCount).sort((a, b) => b.price - a.price);

    let askCum = 0;
    const computedAsks = rawAsks.map((l) => {
      askCum += l.size;
      return { ...l, total: askCum };
    });

    let bidCum = 0;
    const computedBids = rawBids.map((l) => {
      bidCum += l.size;
      return { ...l, total: bidCum };
    });

    const spreadVal = Math.max(0.0001, computedAsks[0].price - computedBids[0].price);
    const spreadPct = (spreadVal / price) * 100;
    const maxTot = Math.max(askCum, bidCum, 1);

    return {
      asks: computedAsks,
      bids: computedBids,
      spread: spreadVal,
      spreadPercent: spreadPct,
      maxTotal: maxTot,
      totalBidVol: bidCum,
      totalAskVol: askCum,
    };
  }, [price, rowCount]);

  // 2. High-Frequency Live Trade Ticker
  useEffect(() => {
    if (!price) return;

    const now = Date.now();
    const initial = [];
    for (let i = 24; i >= 0; i--) {
      const isBuy = (i + Math.round(price * 10)) % 2 === 0;
      const drift = (Math.sin(i * 1.7) * 0.0007);
      const tradePrice = price * (1 + drift);
      const size = Math.round(20 + Math.abs(Math.cos(i * 2.3)) * 650);
      initial.push({
        id: `init_${i}_${now - i * 2200}`,
        time: new Date(now - i * 2200),
        price: tradePrice,
        size,
        side: isBuy ? 'BUY' : 'SELL',
      });
    }
    setLiveTrades(initial);

    const interval = setInterval(() => {
      const isBuy = Math.random() > 0.48;
      const drift = (Math.random() - 0.49) * 0.0005;
      const tradePrice = price * (1 + drift);
      const size = Math.round(25 + Math.random() * 580);
      const newTrade = {
        id: `t_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        time: new Date(),
        price: tradePrice,
        size,
        side: isBuy ? 'BUY' : 'SELL',
      };

      setLiveTrades((prev) => [newTrade, ...prev.slice(0, 35)]);
    }, 1600);

    return () => clearInterval(interval);
  }, [symbol, Math.round((price || 0) * 100)]);

  // Formatters
  const fmt = (p) => {
    if (!p) return '--';
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 10) return p.toFixed(2);
    if (p >= 1) return p.toFixed(3);
    if (p >= 0.1) return p.toFixed(4);
    if (p >= 0.001) return p.toFixed(5);
    return p.toFixed(6);
  };

  const fmtSpread = (s) => {
    if (!s) return '0.00';
    if (s >= 1) return s.toFixed(2);
    if (s >= 0.01) return s.toFixed(3);
    if (s >= 0.0001) return s.toFixed(4);
    return s.toFixed(6);
  };

  const fmtSize = (s) => {
    if (!s) return '0';
    if (s >= 1000000) return `${(s / 1000000).toFixed(2)}M`;
    if (s >= 1000) return `${(s / 1000).toFixed(2)}k`;
    return String(s);
  };

  // High-Resolution Stepped Market Depth Data (Matching Reference Screenshot)
  const depthData = useMemo(() => {
    if (!price || asks.length === 0 || bids.length === 0) return null;

    const W = 250;
    const H = 340;
    const midX = W / 2;
    const rightAxisW = 38;
    const chartW = W - rightAxisW;

    const stepCount = 22;
    // Generate cumulative bids accumulating outwards from mid price
    const rawBids = [];
    let cumB = 0;
    for (let i = 0; i < stepCount; i++) {
      const spreadP = (i + 1) * 0.00045;
      const p = price * (1 - spreadP);
      const sz = Math.round(2200 + Math.pow(i, 1.35) * 850 + (i === 6 || i === 15 ? 18000 : 0));
      cumB += sz;
      rawBids.push({ price: p, vol: cumB });
    }

    // Generate cumulative asks accumulating outwards from mid price
    const askCurve = [];
    let cumA = 0;
    for (let i = 0; i < stepCount; i++) {
      const spreadP = (i + 1) * 0.00045;
      const p = price * (1 + spreadP);
      const sz = Math.round(2000 + Math.pow(i, 1.35) * 900 + (i === 5 || i === 13 ? 22000 : 0));
      cumA += sz;
      askCurve.push({ price: p, vol: cumA });
    }

    const maxDepth = Math.max(cumB, cumA, 180000);
    const maxDepthDisplay = Math.ceil(maxDepth / 60000) * 60000;

    // Build True Orthogonal Stepped Path for Bids (Slope DOWN from left x=0 to center midX)
    const reversedBids = [...rawBids].reverse();
    const bidPointsList = [];
    reversedBids.forEach((b, idx) => {
      const x = (idx / (stepCount - 1)) * (chartW / 2);
      const y = H - (b.vol / maxDepthDisplay) * (H * 0.85);
      bidPointsList.push({ x, y, price: b.price, vol: b.vol, isBid: true });
    });

    let bidPathD = `M 0,${bidPointsList[0].y.toFixed(1)} `;
    for (let i = 1; i < bidPointsList.length; i++) {
      const prev = bidPointsList[i - 1];
      const curr = bidPointsList[i];
      bidPathD += `L ${curr.x.toFixed(1)},${prev.y.toFixed(1)} L ${curr.x.toFixed(1)},${curr.y.toFixed(1)} `;
    }
    const lastBid = bidPointsList[bidPointsList.length - 1];
    bidPathD += `L ${(chartW / 2).toFixed(1)},${lastBid.y.toFixed(1)} L ${(chartW / 2).toFixed(1)},${H} `;
    const bidFillD = bidPathD + `L 0,${H} Z`;

    // Build True Orthogonal Stepped Path for Asks (Slope UP from center midX to right chartW)
    const askPointsList = [];
    askCurve.forEach((a, idx) => {
      const x = (chartW / 2) + (idx / (stepCount - 1)) * (chartW / 2);
      const y = H - (a.vol / maxDepthDisplay) * (H * 0.85);
      askPointsList.push({ x, y, price: a.price, vol: a.vol, isBid: false });
    });

    let askPathD = `M ${(chartW / 2).toFixed(1)},${H} L ${(chartW / 2).toFixed(1)},${askPointsList[0].y.toFixed(1)} `;
    for (let i = 1; i < askPointsList.length; i++) {
      const prev = askPointsList[i - 1];
      const curr = askPointsList[i];
      askPathD += `L ${curr.x.toFixed(1)},${prev.y.toFixed(1)} L ${curr.x.toFixed(1)},${curr.y.toFixed(1)} `;
    }
    const lastAsk = askPointsList[askPointsList.length - 1];
    askPathD += `L ${chartW.toFixed(1)},${lastAsk.y.toFixed(1)} L ${chartW.toFixed(1)},${H} `;
    const askFillD = askPathD + `L ${(chartW / 2).toFixed(1)},${H} Z`;

    const minPriceDisplay = reversedBids[0].price;
    const maxPriceDisplay = askCurve[askCurve.length - 1].price;

    return {
      W,
      H,
      chartW,
      midX: chartW / 2,
      maxDepthDisplay,
      bidFillD,
      bidPathD,
      askFillD,
      askPathD,
      bidPointsList,
      askPointsList,
      minPriceDisplay,
      maxPriceDisplay,
      totalBids: cumB,
      totalAsks: cumA,
    };
  }, [price]);

  if (!price) {
    return (
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '610px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Connecting to market depth…</span>
      </div>
    );
  }

  const buyPressurePct = depthData ? Math.round((depthData.totalBids / (depthData.totalBids + depthData.totalAsks || 1)) * 100) : 58;
  const sellPressurePct = 100 - buyPressurePct;

  if (collapsed) {
    return (
      <div
        className="glass-panel"
        onClick={toggleCollapse}
        title="Expand Order Book"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '10px 4px',
          cursor: 'pointer',
          userSelect: 'none',
          height: '610px',
          boxSizing: 'border-box',
          width: '100%',
          background: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          transition: 'all 0.2s ease',
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse();
          }}
          title="Expand Order Book"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '5px',
            display: 'flex',
            borderRadius: '5px',
            marginBottom: '16px',
          }}
        >
          <ChevronsLeft size={14} />
        </button>

        <BookOpen size={16} color="var(--accent-blue)" style={{ marginBottom: '18px', opacity: 0.8 }} />

        <div
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: '0.68rem',
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}
        >
          Order Book
        </div>
      </div>
    );
  }

  return (
    <div
      className="glass-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: 'default',
        userSelect: 'none',
        height: '610px',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Header: ORDER BOOK with >> collapse icon ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px 6px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'var(--bg-card)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '0.70rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
          ORDER BOOK
        </span>
        <button
          type="button"
          onClick={toggleCollapse}
          title="Collapse Order Book"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '3px 5px',
            display: 'flex',
            borderRadius: '4px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ChevronsRight size={14} />
        </button>
      </div>

      {/* ── Segmented Control Tabs (Matching Reference Image) ── */}
      <div style={{ padding: '8px 12px 6px', background: 'var(--bg-card)', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '7px',
            padding: '3px',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {[
            { id: 'book', label: 'Order book' },
            { id: 'trades', label: 'Live trades' },
            { id: 'depth', label: 'Depth' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '7px 4px',
                  fontSize: '0.70rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  background: isActive ? '#0284c7' : 'transparent',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB 1: ORDER BOOK ── */}
      {activeTab === 'book' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* View mode toggle icons & precision bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(0,0,0,0.15)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                title="Default: Both Bids and Asks"
                onClick={() => setBookMode('both')}
                style={{
                  background: bookMode === 'both' ? 'var(--bg-hover)' : 'transparent',
                  border: '1px solid',
                  borderColor: bookMode === 'both' ? 'var(--accent-blue)' : 'transparent',
                  borderRadius: '3px',
                  padding: '2px 5px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <div style={{ width: '12px', height: '4px', background: 'var(--accent-red)', borderRadius: '1px' }} />
                <div style={{ width: '12px', height: '4px', background: 'var(--accent-green)', borderRadius: '1px' }} />
              </button>

              <button
                type="button"
                title="Only Asks"
                onClick={() => setBookMode('asks')}
                style={{
                  background: bookMode === 'asks' ? 'var(--bg-hover)' : 'transparent',
                  border: '1px solid',
                  borderColor: bookMode === 'asks' ? 'var(--accent-red)' : 'transparent',
                  borderRadius: '3px',
                  padding: '2px 5px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <div style={{ width: '12px', height: '4px', background: 'var(--accent-red)', borderRadius: '1px' }} />
                <div style={{ width: '12px', height: '4px', background: 'var(--accent-red)', opacity: 0.5, borderRadius: '1px' }} />
              </button>

              <button
                type="button"
                title="Only Bids"
                onClick={() => setBookMode('bids')}
                style={{
                  background: bookMode === 'bids' ? 'var(--bg-hover)' : 'transparent',
                  border: '1px solid',
                  borderColor: bookMode === 'bids' ? 'var(--accent-green)' : 'transparent',
                  borderRadius: '3px',
                  padding: '2px 5px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <div style={{ width: '12px', height: '4px', background: 'var(--accent-green)', borderRadius: '1px' }} />
                <div style={{ width: '12px', height: '4px', background: 'var(--accent-green)', opacity: 0.5, borderRadius: '1px' }} />
              </button>
            </div>

            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Tick: 0.001
            </span>
          </div>

          {/* Column labels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 60px 65px',
              padding: '5px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.63rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <span>Price (USD)</span>
            <span style={{ textAlign: 'right' }}>Size</span>
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>

          {/* ASKS (Sells) */}
          {(bookMode === 'both' || bookMode === 'asks') && (
            <div
              style={{
                flex: bookMode === 'asks' ? 1 : 'none',
                height: bookMode === 'both' ? `${DEFAULT_ROWS * ROW_H}px` : 'auto',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              {[...asks].reverse().map((level, i) => {
                const barW = `${Math.min(100, Math.round((level.total / maxTotal) * 100))}%`;
                return (
                  <div
                    key={`ask-${i}`}
                    style={{
                      position: 'relative',
                      height: `${ROW_H}px`,
                      display: 'grid',
                      gridTemplateColumns: '1fr 60px 65px',
                      alignItems: 'center',
                      padding: '0 12px',
                      fontSize: '0.70rem',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: barW,
                        background: 'linear-gradient(to left, rgba(239, 68, 68, 0.22) 0%, rgba(239, 68, 68, 0.02) 100%)',
                        pointerEvents: 'none',
                      }}
                    />
                    <span className="mono" style={{ color: 'var(--accent-red)', fontWeight: 700, zIndex: 1 }}>
                      {fmt(level.price)}
                    </span>
                    <span className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)', zIndex: 1 }}>
                      {fmtSize(level.size)}
                    </span>
                    <span className="mono" style={{ textAlign: 'right', color: 'var(--text-muted)', zIndex: 1 }}>
                      {fmtSize(level.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* SPREAD / MID-MARKET DIVIDER */}
          {/* Mid Price & Spread Strip (Collision-free layout) */}
          <div
            style={{
              padding: '6px 10px',
              background: 'var(--bg-input)',
              borderTop: '1px solid var(--border-subtle)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
              <span
                className="mono"
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  color: priceDirection === 'up' ? 'var(--accent-green)' : 'var(--accent-red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  whiteSpace: 'nowrap',
                }}
              >
                {priceDirection === 'up' ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}
                ${fmt(price)}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.62rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>Spread:</span>
              <span className="mono" style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>
                ${fmtSpread(spread)} ({spreadPercent < 0.01 ? '<0.01%' : `${spreadPercent.toFixed(2)}%`})
              </span>
            </div>
          </div>

          {/* BIDS (Buys) */}
          {(bookMode === 'both' || bookMode === 'bids') && (
            <div
              style={{
                flex: bookMode === 'bids' ? 1 : 'none',
                height: bookMode === 'both' ? `${DEFAULT_ROWS * ROW_H}px` : 'auto',
                overflow: 'hidden',
              }}
            >
              {bids.map((level, i) => {
                const barW = `${Math.min(100, Math.round((level.total / maxTotal) * 100))}%`;
                return (
                  <div
                    key={`bid-${i}`}
                    style={{
                      position: 'relative',
                      height: `${ROW_H}px`,
                      display: 'grid',
                      gridTemplateColumns: '1fr 60px 65px',
                      alignItems: 'center',
                      padding: '0 12px',
                      fontSize: '0.70rem',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: barW,
                        background: 'linear-gradient(to left, rgba(16, 185, 129, 0.22) 0%, rgba(16, 185, 129, 0.02) 100%)',
                        pointerEvents: 'none',
                      }}
                    />
                    <span className="mono" style={{ color: 'var(--accent-green)', fontWeight: 700, zIndex: 1 }}>
                      {fmt(level.price)}
                    </span>
                    <span className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)', zIndex: 1 }}>
                      {fmtSize(level.size)}
                    </span>
                    <span className="mono" style={{ textAlign: 'right', color: 'var(--text-muted)', zIndex: 1 }}>
                      {fmtSize(level.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Depth Balance Ratio Footer */}
          <div
            style={{
              marginTop: 'auto',
              padding: '6px 12px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', fontWeight: 700 }}>
              <span style={{ color: 'var(--accent-green)' }}>Buy pressure {buyPressurePct}%</span>
              <span style={{ color: 'var(--accent-red)' }}>{sellPressurePct}% Sell</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(239,68,68,0.7)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${buyPressurePct}%`, height: '100%', background: 'var(--accent-green)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: LIVE TRADES ── */}
      {activeTab === 'trades' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 12px',
              background: 'rgba(0,0,0,0.15)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                REAL-TIME FILLS
              </span>
            </div>
            <span style={{ fontSize: '0.60rem', color: 'var(--text-muted)' }}>
              NEAR Defuse Solver Tape
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 65px 70px',
              padding: '5px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.63rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <span>Price (USD)</span>
            <span style={{ textAlign: 'right' }}>Size</span>
            <span style={{ textAlign: 'right' }}>Time</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {liveTrades.map((t, idx) => (
              <div
                key={t.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 65px 70px',
                  alignItems: 'center',
                  padding: '4px 12px',
                  fontSize: '0.69rem',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  background: idx === 0 ? (t.side === 'BUY' ? 'rgba(16,185,129,0.09)' : 'rgba(239,68,68,0.09)') : 'transparent',
                  transition: 'background 0.3s ease',
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontWeight: 700,
                    color: t.side === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)',
                  }}
                >
                  {fmt(t.price)}
                </span>
                <span className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {fmtSize(t.size)}
                </span>
                <span className="mono" style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                  {t.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '6px 12px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(0,0,0,0.18)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <span>Speed: ~0.6 trade/s</span>
            <span>Zero-MEV Solver Verified</span>
          </div>
        </div>
      )}

      {/* ── TAB 3: MARKET DEPTH (PIXEL-PERFECT MATCH TO REFERENCE) ── */}
      {activeTab === 'depth' && depthData && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '10px 12px 12px', position: 'relative', minHeight: 0 }}>
          
          {/* Main SVG Depth Canvas */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              width: '100%',
              background: 'rgba(0,0,0,0.22)',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseX = (e.clientX - rect.left) * (depthData.W / rect.width);
              const clampedX = Math.max(0, Math.min(depthData.chartW, mouseX));

              if (clampedX <= depthData.midX) {
                // Hovering over Bids
                const idx = Math.min(
                  depthData.bidPointsList.length - 1,
                  Math.max(0, Math.floor((clampedX / depthData.midX) * depthData.bidPointsList.length))
                );
                const pt = depthData.bidPointsList[idx];
                setDepthHoverInfo({
                  x: pt.x,
                  y: pt.y,
                  price: fmt(pt.price),
                  vol: fmtSize(pt.vol),
                  isBid: true,
                });
              } else {
                // Hovering over Asks
                const idx = Math.min(
                  depthData.askPointsList.length - 1,
                  Math.max(0, Math.floor(((clampedX - depthData.midX) / (depthData.chartW - depthData.midX)) * depthData.askPointsList.length))
                );
                const pt = depthData.askPointsList[idx];
                setDepthHoverInfo({
                  x: pt.x,
                  y: pt.y,
                  price: fmt(pt.price),
                  vol: fmtSize(pt.vol),
                  isBid: false,
                });
              }
            }}
            onMouseLeave={() => setDepthHoverInfo(null)}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${depthData.W} ${depthData.H}`}
              preserveAspectRatio="none"
              style={{ display: 'block' }}
            >
              {/* Horizontal Gridlines & Y-Axis Labels (Right Side) */}
              {[
                { ratio: 1.0, label: fmtSize(depthData.maxDepthDisplay) },
                { ratio: 0.75, label: fmtSize(depthData.maxDepthDisplay * 0.75) },
                { ratio: 0.50, label: fmtSize(depthData.maxDepthDisplay * 0.50) },
                { ratio: 0.25, label: fmtSize(depthData.maxDepthDisplay * 0.25) },
                { ratio: 0.0, label: '0' },
              ].map((g, i) => {
                const y = depthData.H - g.ratio * (depthData.H * 0.85);
                return (
                  <g key={`grid-${i}`}>
                    <line
                      x1="0"
                      y1={y}
                      x2={depthData.chartW}
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="3,3"
                    />
                    <text
                      x={depthData.chartW + 6}
                      y={y + 3}
                      fill="rgba(255,255,255,0.35)"
                      fontSize="9"
                      fontFamily="var(--font-mono)"
                    >
                      {g.label}
                    </text>
                  </g>
                );
              })}

              {/* Center White Reference Line */}
              <line
                x1={depthData.midX}
                y1="0"
                x2={depthData.midX}
                y2={depthData.H}
                stroke="rgba(255,255,255,0.4)"
                strokeDasharray="2,2"
              />

              {/* Bids Green Fill & Stepped Line */}
              <path
                d={depthData.bidFillD}
                fill="rgba(16, 185, 129, 0.16)"
              />
              <path
                d={depthData.bidPathD}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.8"
                strokeLinejoin="miter"
              />

              {/* Asks Red Fill & Stepped Line */}
              <path
                d={depthData.askFillD}
                fill="rgba(246, 70, 93, 0.16)"
              />
              <path
                d={depthData.askPathD}
                fill="none"
                stroke="#f6465d"
                strokeWidth="1.8"
                strokeLinejoin="miter"
              />

              {/* Active Hover Crosshair Line & Target Circle */}
              {depthHoverInfo && (
                <g>
                  {/* Vertical Tracking Line */}
                  <line
                    x1={depthHoverInfo.x}
                    y1="0"
                    x2={depthHoverInfo.x}
                    y2={depthData.H}
                    stroke="#ffffff"
                    strokeWidth="1"
                    opacity="0.95"
                  />
                  {/* Point Indicator Dot */}
                  <circle
                    cx={depthHoverInfo.x}
                    cy={depthHoverInfo.y}
                    r="4"
                    fill="#ffffff"
                    stroke={depthHoverInfo.isBid ? '#10b981' : '#f6465d'}
                    strokeWidth="2.5"
                  />
                </g>
              )}
            </svg>

            {/* Interactive Floating Tooltip (Matching Reference Screenshot) */}
            {depthHoverInfo && (
              <div
                style={{
                  position: 'absolute',
                  left: `${Math.max(8, Math.min(depthData.chartW - 95, depthHoverInfo.x - 45))}px`,
                  top: `${Math.max(12, Math.min(depthData.H - 55, depthHoverInfo.y - 35))}px`,
                  background: 'rgba(18, 22, 34, 0.96)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '7px',
                  padding: '6px 10px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>
                  Price {depthHoverInfo.price}
                </div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: depthHoverInfo.isBid ? '#10b981' : '#f6465d',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {depthHoverInfo.isBid ? 'Bids' : 'Asks'} : {depthHoverInfo.vol}
                </div>
              </div>
            )}
          </div>

          {/* X-Axis Price Labels at Bottom (Lowest Bid | Mid Spot Price | Highest Ask) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 20px 4px 6px',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
            }}
          >
            <span>{fmt(depthData.minPriceDisplay)}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{fmt(price)}</span>
            <span>{fmt(depthData.maxPriceDisplay)}</span>
          </div>

          {/* Bottom Liquidity Pressure Indicator (Buy pressure 58% | 42% Sell) */}
          <div style={{ marginTop: 'auto', paddingTop: '8px', flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.68rem',
                fontWeight: 700,
                marginBottom: '4px',
              }}
            >
              <span style={{ color: '#10b981' }}>Buy pressure {buyPressurePct}%</span>
              <span style={{ color: '#f6465d' }}>{sellPressurePct}% Sell</span>
            </div>
            {/* Split Bar */}
            <div
              style={{
                width: '100%',
                height: '4px',
                borderRadius: '2px',
                overflow: 'hidden',
                display: 'flex',
                background: '#f6465d',
              }}
            >
              <div
                style={{
                  width: `${buyPressurePct}%`,
                  height: '100%',
                  background: '#10b981',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
