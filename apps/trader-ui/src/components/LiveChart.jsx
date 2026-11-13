// frontend/src/components/LiveChart.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp,
  Radio,
  BarChart2,
  LineChart as LineChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Check,
  Copy,
  ExternalLink,
  Zap,
  Layers,
  ChevronDown,
  X,
  Filter,
  Clock,
} from 'lucide-react';

// Price formatting helper for all magnitudes ($80,000+ down to $0.000004)
export const formatPrice = (p) => {
  if (p === undefined || p === null || isNaN(p)) return '0.00';
  const val = Number(p);
  if (val >= 1000) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (val >= 1) {
    return val.toFixed(4);
  } else if (val >= 0.001) {
    return val.toFixed(6);
  } else {
    return val.toFixed(8);
  }
};

const DEFAULT_POPULAR = ['NEAR', 'BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'USDC', 'USDT', 'AURORA', 'PEPE', 'BLACKDRAGON', 'SHITZU'];

export default function LiveChart({ marketData, onSelectToken }) {
  const [chartType, setChartType] = useState('AREA'); // 'AREA' or 'CANDLES'
  const [timeframe, setTimeframe] = useState('1m'); // 'TICK', '1m', '5m', '15m'
  const [timeframeHistory, setTimeframeHistory] = useState([]);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [chainFilter, setChainFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedContract, setCopiedContract] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const stats = marketData?.stats || {};
  const symbol = (marketData?.symbol || 'NEAR').toUpperCase();
  const rawTokens = marketData?.supportedTokens || [];
  const matchedToken = rawTokens.find(t => t.symbol === symbol);
  const price = marketData?.price || matchedToken?.currentPrice || matchedToken?.defaultPrice || 0;

  const svgRef = useRef(null);
  const pickerRef = useRef(null);

  // Close token picker when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setIsPickerOpen(false);
      }
    };
    if (isPickerOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isPickerOpen]);

  // Fetch or generate timeframe-specific historical curve whenever timeframe or symbol changes
  useEffect(() => {
    let isCancelled = false;

    // 1. Instant local synthesis so the chart switches immediately without a blink
    const now = Date.now();
    const intervalMs = timeframe === 'TICK' ? 3000 : timeframe === '1m' ? 60000 : timeframe === '5m' ? 300000 : 900000;
    const count = 28;
    const vol = timeframe === 'TICK' ? 0.0015 : timeframe === '1m' ? 0.0045 : timeframe === '5m' ? 0.009 : 0.016;
    const seed = (symbol.charCodeAt(0) || 5) * 13;
    const localPts = [];
    for (let i = count; i >= 0; i--) {
      const t = now - i * intervalMs;
      const w1 = Math.sin((count - i) * 0.38 + seed) * vol;
      const w2 = Math.cos((count - i) * 0.22 + seed) * (vol * 0.65);
      const w3 = Math.sin((count - i) * 0.7) * (vol * 0.25);
      const p = parseFloat((price * (1 + w1 + w2 + w3)).toFixed(price >= 100 ? 2 : price >= 1 ? 4 : price >= 0.001 ? 6 : 8));
      localPts.push({ timestamp: t, price: p });
    }
    localPts[localPts.length - 1] = { timestamp: now, price };
    setTimeframeHistory(localPts);

    // 2. Fetch server-side historical curve
    const fetchTfHistory = async () => {
      try {
        const res = await fetch(`/api/market/history?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data.history && data.history.length > 0) {
            setTimeframeHistory(data.history);
          }
        }
      } catch (err) {
        // keep local synthesis
      }
    };

    fetchTfHistory();
    return () => {
      isCancelled = true;
    };
  }, [symbol, timeframe]);

  // Active token metadata
  const activeToken = useMemo(() => {
    const found = rawTokens.find((t) => t.symbol === symbol || (t.displaySymbol && t.displaySymbol.startsWith(symbol)));
    if (found) return found;
    return {
      symbol,
      displaySymbol: symbol,
      name: `${symbol} Protocol`,
      blockchain: 'near',
      category: 'NEAR Native',
      contractId: 'wrap.near',
      testnetContract: 'wrap.testnet',
      icon: symbol === 'BTC' ? '₿' : symbol === 'ETH' ? 'Ξ' : 'Ⓝ',
      currentPrice: price,
      defaultPrice: price,
    };
  }, [rawTokens, symbol, price]);

  // Filter tokens based on chain/category filter & search query
  const filteredTokens = useMemo(() => {
    if (!rawTokens || rawTokens.length === 0) return [];
    return rawTokens.filter((t) => {
      let chainMatch = true;
      if (chainFilter === 'NEAR') {
        chainMatch = t.blockchain === 'near';
      } else if (chainFilter === 'OMNICHAIN') {
        chainMatch = ['btc', 'eth', 'sol', 'doge', 'xrp', 'ton', 'sui', 'aptos'].includes(t.blockchain);
      } else if (chainFilter === 'STABLE') {
        chainMatch = t.category === 'Stablecoin' || ['USDC', 'USDT', 'FRAX', 'DAI'].includes(t.symbol);
      } else if (chainFilter === 'MEME') {
        chainMatch = t.category === 'Ecosystem Meme' || ['BLACKDRAGON', 'SHITZU', 'LONK', 'PEPE'].includes(t.symbol);
      }

      let searchMatch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        searchMatch =
          t.symbol.toLowerCase().includes(q) ||
          (t.displaySymbol && t.displaySymbol.toLowerCase().includes(q)) ||
          (t.name && t.name.toLowerCase().includes(q)) ||
          (t.contractId && t.contractId.toLowerCase().includes(q)) ||
          (t.blockchain && t.blockchain.toLowerCase().includes(q));
      }

      return chainMatch && searchMatch;
    });
  }, [rawTokens, chainFilter, searchQuery]);

  // Top popular quick tokens
  const popularTokens = useMemo(() => {
    if (!rawTokens || rawTokens.length === 0) return [];
    const set = new Set(DEFAULT_POPULAR);
    return rawTokens.filter((t) => set.has(t.symbol)).slice(0, 12);
  }, [rawTokens]);

  // Effective price points based on selected timeframe
  const effectivePrices = useMemo(() => {
    if (timeframe === 'TICK' && marketData?.recentPrices && marketData.recentPrices.length > 5) {
      return marketData.recentPrices;
    }
    if (timeframeHistory && timeframeHistory.length > 0) {
      const updated = [...timeframeHistory];
      updated[updated.length - 1] = { timestamp: Date.now(), price };
      return updated;
    }
    return marketData?.recentPrices || [{ timestamp: Date.now(), price }];
  }, [timeframe, timeframeHistory, marketData?.recentPrices, price]);

  // SVG Chart Dimensions
  const svgWidth = 800;
  const svgHeight = 280;
  const yAxisWidth = 85;
  const xAxisHeight = 28;
  const chartWidth = svgWidth - yAxisWidth;
  const chartHeight = svgHeight - xAxisHeight;
  const paddingY = 18;

  // Min / Max calculation
  const { minP, maxP, rangeP } = useMemo(() => {
    const allPrices = effectivePrices.length > 0 ? effectivePrices.map((p) => p.price) : [price * 0.995, price * 1.005];
    const min = Math.min(...allPrices) * 0.998;
    const max = Math.max(...allPrices) * 1.002;
    return { minP: min, maxP: max, rangeP: max - min || 0.0000001 };
  }, [effectivePrices, price]);

  const priceToY = (p) => {
    return chartHeight - paddingY - ((p - minP) / rangeP) * (chartHeight - paddingY * 2);
  };

  const indexToX = (idx, total) => {
    if (total <= 1) return chartWidth / 2;
    return (idx / (total - 1)) * chartWidth;
  };

  // Polyline Data Points
  const { polylinePoints, dataPoints } = useMemo(() => {
    if (effectivePrices.length < 2) {
      const defaultY = priceToY(price);
      return {
        polylinePoints: `0,${defaultY} ${chartWidth},${defaultY}`,
        dataPoints: [
          { x: 0, y: defaultY, price, time: Date.now() },
          { x: chartWidth, y: defaultY, price, time: Date.now() },
        ],
      };
    }

    const pts = effectivePrices.map((p, idx) => {
      const x = indexToX(idx, effectivePrices.length);
      const y = priceToY(p.price);
      return { x, y, price: p.price, time: p.timestamp };
    });

    const polyString = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return { polylinePoints: polyString, dataPoints: pts };
  }, [effectivePrices, minP, rangeP, chartWidth, chartHeight, price]);

  // Candlesticks calculated for the active timeframe
  const candles = useMemo(() => {
    const candleCount = 14;
    if (effectivePrices.length < 4) {
      const intervalMs = timeframe === 'TICK' ? 10000 : timeframe === '1m' ? 60000 : timeframe === '5m' ? 300000 : 900000;
      return Array.from({ length: candleCount }).map((_, i) => {
        const o = price * (1 + Math.sin(i * 0.4) * 0.0025);
        const c = price * (1 + Math.cos(i * 0.4) * 0.0025);
        const h = Math.max(o, c) * 1.0012;
        const l = Math.min(o, c) * 0.9988;
        return { open: o, close: c, high: h, low: l, time: Date.now() - (candleCount - i) * intervalMs };
      });
    }

    const chunkSize = Math.max(1, Math.floor(effectivePrices.length / candleCount));
    const result = [];
    for (let i = 0; i < effectivePrices.length; i += chunkSize) {
      const slice = effectivePrices.slice(i, i + chunkSize);
      if (slice.length === 0) continue;
      const values = slice.map((p) => p.price);
      const open = values[0];
      const close = values[values.length - 1];
      const high = Math.max(...values, Math.max(open, close) * 1.0006);
      const low = Math.min(...values, Math.min(open, close) * 0.9994);
      result.push({ open, close, high, low, time: slice[0].timestamp });
    }
    return result;
  }, [effectivePrices, price, timeframe]);

  // Y-Axis Ticks
  const yTicks = useMemo(() => {
    const steps = 4;
    const ticks = [];
    for (let i = 0; i <= steps; i++) {
      const p = minP + (rangeP / steps) * i;
      const y = priceToY(p);
      ticks.push({ price: p, y });
    }
    return ticks;
  }, [minP, rangeP, chartHeight]);

  // X-Axis Ticks
  const xTicks = useMemo(() => {
    if (dataPoints.length < 2) return [];
    const count = 4;
    const step = Math.floor((dataPoints.length - 1) / count) || 1;
    const ticks = [];
    for (let i = 0; i < dataPoints.length; i += step) {
      ticks.push(dataPoints[i]);
    }
    return ticks;
  }, [dataPoints]);

  const currentPriceY = priceToY(price);

  // Time formatter based on active timeframe
  const formatTimeTick = (ts) => {
    const d = new Date(ts);
    if (timeframe === 'TICK') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleMouseMove = (e) => {
    if (!svgRef.current || dataPoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (svgWidth / rect.width);
    const clampedX = Math.max(0, Math.min(chartWidth, mouseX));

    let nearestIdx = 0;
    let minDistance = Infinity;
    dataPoints.forEach((pt, idx) => {
      const dist = Math.abs(pt.x - clampedX);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = idx;
      }
    });

    setHoverIndex(nearestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const hoveredPoint = hoverIndex !== null && dataPoints[hoverIndex] ? dataPoints[hoverIndex] : null;

  // Find corresponding candle if in candle mode
  const hoveredCandle = useMemo(() => {
    if (chartType !== 'CANDLES' || !hoveredPoint || candles.length === 0) return null;
    const candleWidth = chartWidth / candles.length;
    const cIdx = Math.min(candles.length - 1, Math.max(0, Math.floor(hoveredPoint.x / candleWidth)));
    return candles[cIdx];
  }, [chartType, hoveredPoint, candles, chartWidth]);

  const copyContractAddress = (contract) => {
    if (!contract) return;
    navigator.clipboard.writeText(contract);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const selectTokenAndClose = (tok) => {
    if (onSelectToken) onSelectToken(tok);
    setIsPickerOpen(false);
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
        position: 'relative',
      }}
    >
      {/* 1. TOP HEADER & MULTI-TOKEN CONTROLLER */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Main Token Selector Button */}
          <div style={{ position: 'relative' }} ref={pickerRef}>
            <button
              type="button"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(0,240,255,0.1)',
                border: '1px solid rgba(0,240,255,0.35)',
                padding: '8px 14px',
                borderRadius: '10px',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: isPickerOpen ? '0 0 15px rgba(0,240,255,0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'rgba(0,240,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  fontWeight: 900,
                  color: '#00f0ff',
                }}
              >
                {activeToken.icon || 'Ⓝ'}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#00f0ff' }}>
                    {activeToken.displaySymbol || activeToken.symbol}
                  </span>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      background: 'rgba(255,255,255,0.08)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {activeToken.blockchain || 'near'}
                  </span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {rawTokens.length > 0 ? `${rawTokens.length} Tokens Supported` : 'Select Coin'}
                </div>
              </div>
              <ChevronDown size={16} color="var(--accent-cyan)" />
            </button>

            {/* FULL POPUP MODAL/DROPDOWN FOR ALL 200+ TOKENS */}
            {isPickerOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: '420px',
                  maxHeight: '440px',
                  background: '#0a0e17',
                  border: '1px solid var(--accent-cyan)',
                  borderRadius: '12px',
                  boxShadow: '0 12px 35px rgba(0,0,0,0.8), 0 0 20px rgba(0,240,255,0.25)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Search Bar */}
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={16} color="var(--accent-cyan)" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search 200+ coins (e.g. BTC, SOL, PEPE, USDC)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.82rem',
                      outline: 'none',
                    }}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter Tabs inside Dropdown */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                >
                  {[
                    { id: 'ALL', label: `All (${rawTokens.length || 207})` },
                    { id: 'NEAR', label: 'NEAR Native' },
                    { id: 'OMNICHAIN', label: 'Omnichain' },
                    { id: 'STABLE', label: 'Stables' },
                    { id: 'MEME', label: 'Memes' },
                  ].map((tab) => {
                    const isTabActive = chainFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setChainFilter(tab.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          lineHeight: 1,
                          padding: '6px 11px',
                          borderRadius: '6px',
                          border: isTabActive ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.06)',
                          background: isTabActive ? 'rgba(0,240,255,0.18)' : 'rgba(255,255,255,0.04)',
                          color: isTabActive ? '#00f0ff' : 'var(--text-muted)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          fontFamily: 'inherit',
                          boxSizing: 'border-box',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tokens List Scroll Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                  {filteredTokens.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      No tokens found matching "{searchQuery}"
                    </div>
                  ) : (
                    filteredTokens.map((t) => {
                      const isSel = t.symbol === symbol;
                      return (
                        <div
                          key={`${t.symbol}_${t.blockchain}_${t.contractId}`}
                          onClick={() => selectTokenAndClose(t)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: isSel ? 'rgba(0,240,255,0.15)' : 'transparent',
                            border: isSel ? '1px solid rgba(0,240,255,0.3)' : '1px solid transparent',
                            marginBottom: '2px',
                            transition: 'background 0.1s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.85rem',
                              }}
                            >
                              {t.icon || 'Ⓝ'}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isSel ? '#00f0ff' : '#fff' }}>
                                {t.displaySymbol || t.symbol}
                              </div>
                              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                {t.name} • {t.blockchain.toUpperCase()}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>
                              ${formatPrice(t.currentPrice || t.defaultPrice)}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                              {t.category}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Top Quick Pick Token Chips */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              maxWidth: '520px',
              paddingBottom: '2px',
              scrollbarWidth: 'none',
            }}
          >
            {popularTokens.map((t) => {
              const isSel = t.symbol === symbol;
              return (
                <button
                  key={t.symbol}
                  type="button"
                  onClick={() => onSelectToken && onSelectToken(t)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: isSel ? '1px solid #00f0ff' : '1px solid rgba(255,255,255,0.08)',
                    background: isSel ? 'rgba(0,240,255,0.18)' : 'rgba(255,255,255,0.03)',
                    color: isSel ? '#00f0ff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{t.icon || 'Ⓝ'}</span>
                  <span>{t.symbol}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. ACTIVE TOKEN OVERVIEW BANNER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          background: 'rgba(255,255,255,0.02)',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(0,240,255,0.2) 0%, rgba(0,128,255,0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(0,240,255,0.4)',
              fontSize: '1.3rem',
            }}
          >
            {activeToken.icon || 'Ⓝ'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 900 }}>{activeToken.displaySymbol || activeToken.symbol}/USD</h2>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{activeToken.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,255,136,0.12)', padding: '2px 7px', borderRadius: '12px', border: '1px solid rgba(0,255,136,0.3)' }}>
                <Radio size={9} color="var(--accent-green)" />
                <span style={{ fontSize: '0.62rem', color: 'var(--accent-green)', fontWeight: 800 }}>LIVE</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,240,255,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(0,240,255,0.2)' }}>
                <Clock size={9} color="var(--accent-cyan)" />
                <span style={{ fontSize: '0.62rem', color: '#00f0ff', fontWeight: 800 }}>{timeframe.toUpperCase()}</span>
              </div>
            </div>

            {/* Contract Chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
              <div
                onClick={() => copyContractAddress(activeToken.contractId || activeToken.testnetContract)}
                title="Click to copy NEAR contract address"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  fontSize: '0.65rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>Contract:</span>
                <span className="mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                  {(activeToken.contractId || activeToken.testnetContract || '').slice(0, 18)}...
                </span>
                {copiedContract ? <Check size={10} color="var(--accent-green)" /> : <Copy size={10} />}
              </div>

              <a
                href={`https://testnet.nearblocks.io/token/${activeToken.testnetContract || activeToken.contractId}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.65rem',
                  color: 'var(--accent-cyan)',
                  textDecoration: 'none',
                }}
              >
                NearBlocks <ExternalLink size={9} />
              </a>
            </div>
          </div>
        </div>

        {/* Live Price Display & View Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#00f0ff', textAlign: 'right' }}>
              ${formatPrice(price)}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              {stats.source || 'Kraken Orderbook & Defuse'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Functional Timeframe Pills: TICK, 1m, 5m, 15m */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              {['TICK', '1m', '5m', '15m'].map((tf) => {
                const isActive = timeframe === tf;
                return (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    title={`Switch chart timeframe to ${tf}`}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: isActive ? 'linear-gradient(135deg, rgba(0,240,255,0.3) 0%, rgba(0,180,255,0.2) 100%)' : 'transparent',
                      color: isActive ? '#00f0ff' : 'var(--text-muted)',
                      boxShadow: isActive ? '0 0 10px rgba(0,240,255,0.3)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tf}
                  </button>
                );
              })}
            </div>

            {/* Chart Type Toggle */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setChartType('AREA')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: '4px',
                  border: 'none',
                  background: chartType === 'AREA' ? 'rgba(0,240,255,0.2)' : 'transparent',
                  color: chartType === 'AREA' ? '#00f0ff' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <LineChartIcon size={11} /> Area
              </button>
              <button
                type="button"
                onClick={() => setChartType('CANDLES')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: '4px',
                  border: 'none',
                  background: chartType === 'CANDLES' ? 'rgba(0,255,136,0.2)' : 'transparent',
                  color: chartType === 'CANDLES' ? '#00ff88' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <BarChart2 size={11} /> Candles
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. RESPONSIVE LOCKED SVG CHART CONTAINER */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '280px',
          background: 'linear-gradient(180deg, rgba(8,12,20,0.98) 0%, rgba(4,7,12,1) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          cursor: 'crosshair',
          boxSizing: 'border-box',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <linearGradient id="areaGlowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Y-Axis Horizontal Gridlines & Price Scale */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1="0"
                y1={tick.y}
                x2={chartWidth}
                y2={tick.y}
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="4 4"
              />
              <text
                x={chartWidth + 6}
                y={tick.y + 4}
                fill="var(--text-muted)"
                fontSize="9.5"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="500"
              >
                ${formatPrice(tick.price)}
              </text>
            </g>
          ))}

          {/* Right Y-Axis Divider Line */}
          <line x1={chartWidth} y1="0" x2={chartWidth} y2={chartHeight} stroke="rgba(255,255,255,0.08)" />

          {/* Bottom X-Axis Divider Line */}
          <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="rgba(255,255,255,0.08)" />

          {/* X-Axis Vertical Time Markers & Labels (Formatted by Timeframe) */}
          {xTicks.map((pt, i) => (
            <g key={i}>
              <line
                x1={pt.x}
                y1="0"
                x2={pt.x}
                y2={chartHeight}
                stroke="rgba(255,255,255,0.03)"
                strokeDasharray="4 4"
              />
              {/* Avoid clipping first/last time labels outside SVG viewport */}
              <text
                x={i === 0 ? 6 : i === xTicks.length - 1 ? chartWidth - 6 : pt.x}
                y={chartHeight + 18}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
                fill="var(--text-muted)"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatTimeTick(pt.time)}
              </text>
            </g>
          ))}

          {/* VIEW 1: AREA FLOW MODE */}
          {chartType === 'AREA' && (
            <>
              <polygon
                points={`0,${chartHeight} ${polylinePoints} ${chartWidth},${chartHeight}`}
                fill="url(#areaGlowGradient)"
              />
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylinePoints}
              />
            </>
          )}

          {/* VIEW 2: CANDLESTICK MODE */}
          {chartType === 'CANDLES' && (
            <g>
              {candles.map((c, i) => {
                const candleWidth = chartWidth / candles.length;
                const xCenter = i * candleWidth + candleWidth / 2;
                const isGreen = c.close >= c.open;
                const color = isGreen ? '#00ff88' : '#ff3366';

                const yHigh = priceToY(c.high);
                const yLow = priceToY(c.low);
                const yOpen = priceToY(c.open);
                const yClose = priceToY(c.close);

                const topBody = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(3, Math.abs(yClose - yOpen));
                const barW = Math.max(4, candleWidth * 0.65);

                return (
                  <g key={i}>
                    <line x1={xCenter} y1={yHigh} x2={xCenter} y2={yLow} stroke={color} strokeWidth="1.5" opacity="0.8" />
                    <rect
                      x={xCenter - barW / 2}
                      y={topBody}
                      width={barW}
                      height={bodyHeight}
                      fill={color}
                      rx="2"
                      opacity="0.9"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Live Horizontal Dotted Laser Line for Current Price */}
          <line
            x1="0"
            y1={currentPriceY}
            x2={chartWidth}
            y2={currentPriceY}
            stroke="#38bdf8"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.6"
          />

          {/* Right Y-Axis Permanent Live Price Badge */}
          <rect
            x={chartWidth + 2}
            y={Math.max(2, Math.min(chartHeight - 18, currentPriceY - 10))}
            width={yAxisWidth - 4}
            height="20"
            rx="3"
            fill="#0284c7"
          />
          <text
            x={chartWidth + yAxisWidth / 2}
            y={Math.max(2, Math.min(chartHeight - 18, currentPriceY - 10)) + 14}
            textAnchor="middle"
            fill="#ffffff"
            fontSize="9.5"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="900"
          >
            ${formatPrice(price)}
          </text>

          {/* INTERACTIVE CROSSHAIR: SNAPPED PRECISELY ONTO THE CURVE! */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1="0"
                x2={hoveredPoint.x}
                y2={chartHeight}
                stroke="rgba(0,240,255,0.4)"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
              <line
                x1="0"
                y1={hoveredPoint.y}
                x2={chartWidth}
                y2={hoveredPoint.y}
                stroke="rgba(0,240,255,0.4)"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="6"
                fill="#00f0ff"
                stroke="#ffffff"
                strokeWidth="2.5"
                filter="url(#neonBloom)"
              />
              <rect
                x={chartWidth + 2}
                y={Math.max(2, Math.min(chartHeight - 18, hoveredPoint.y - 10))}
                width={yAxisWidth - 4}
                height="18"
                rx="4"
                fill="#1e293b"
                stroke="#00f0ff"
                strokeWidth="1"
              />
              <text
                x={chartWidth + yAxisWidth / 2}
                y={Math.max(2, Math.min(chartHeight - 18, hoveredPoint.y - 10)) + 13}
                textAnchor="middle"
                fill="#00f0ff"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
              >
                ${formatPrice(hoveredPoint.price)}
              </text>
              <rect
                x={Math.max(2, Math.min(chartWidth - 62, hoveredPoint.x - 30))}
                y={chartHeight + 4}
                width="60"
                height="18"
                rx="4"
                fill="#1e293b"
                stroke="#00f0ff"
                strokeWidth="1"
              />
              <text
                x={Math.max(2, Math.min(chartWidth - 62, hoveredPoint.x - 30)) + 30}
                y={chartHeight + 16}
                textAnchor="middle"
                fill="#00f0ff"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
              >
                {formatTimeTick(hoveredPoint.time)}
              </text>
            </g>
          )}
        </svg>

        {/* Dynamic Tooltip (Shows timeframe badge and candle/tick details) */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.max(10, Math.min(chartWidth - 160, hoveredPoint.x - 70))}px`,
              top: `${Math.max(10, hoveredPoint.y - 48)}px`,
              background: 'rgba(7,9,14,0.96)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: '8px',
              padding: '6px 12px',
              pointerEvents: 'none',
              boxShadow: '0 4px 20px rgba(0, 240, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 10,
            }}
          >
            <span style={{ fontSize: '0.62rem', background: 'rgba(0,240,255,0.15)', color: '#00f0ff', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>
              {timeframe}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              {formatTimeTick(hoveredPoint.time)}
            </span>
            {hoveredCandle ? (
              <span className="mono" style={{ fontSize: '0.78rem', fontWeight: 800, color: hoveredCandle.close >= hoveredCandle.open ? '#00ff88' : '#ff3366' }}>
                O: ${formatPrice(hoveredCandle.open)} | C: ${formatPrice(hoveredCandle.close)}
              </span>
            ) : (
              <span className="mono" style={{ fontSize: '0.88rem', fontWeight: 900, color: '#00f0ff' }}>
                ${formatPrice(hoveredPoint.price)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. ENHANCED MARKET METRICS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', width: '100%' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>24h High</span>
            <ArrowUpRight size={14} color="var(--accent-green)" />
          </div>
          <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-green)' }}>
            ${formatPrice(stats.high24h || price * 1.035)}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>24h Low</span>
            <ArrowDownRight size={14} color="var(--accent-red)" />
          </div>
          <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-red)' }}>
            ${formatPrice(stats.low24h || price * 0.965)}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Orderbook Spread</span>
          <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatPrice(stats.bid || price * 0.9995)} / {formatPrice(stats.ask || price * 1.0005)}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>24h Volume</span>
          <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {stats.volume24h ? `${(stats.volume24h / 1000).toFixed(1)}k ${symbol}` : `2.4M ${symbol}`}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Defuse Solver Routing</span>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeToken.blockchain === 'near' ? 'NEP-141 Atomic Solver' : `Chain Signature (${activeToken.blockchain.toUpperCase()})`}
          </div>
        </div>
      </div>
    </div>
  );
}
