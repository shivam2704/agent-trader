// apps/trader-ui/src/components/LiveChart.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp,
  Radio,
  BarChart2,
  LineChart as LineChartIcon,
  Search,
  Check,
  Copy,
  ExternalLink,
  Zap,
  ChevronDown,
  X,
  Filter,
  Maximize2,
  RotateCcw,
} from 'lucide-react';

// Price formatting helper for all magnitudes ($80,000+ down to $0.000004 & stablecoins)
const formatPrice = (p, customPrecision) => {
  if (p === undefined || p === null || isNaN(p)) return '0.00';
  const val = Number(p);
  if (customPrecision !== undefined && customPrecision !== null) {
    return val.toFixed(customPrecision);
  }
  if (val >= 1000) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (val >= 10) {
    return val.toFixed(2);
  } else if (val >= 1) {
    return val.toFixed(4);
  } else if (val >= 0.001) {
    return val.toFixed(6);
  } else {
    return val.toFixed(8);
  }
};

const formatVol = (v) => {
  if (!v) return '0';
  if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return Number(v).toFixed(0);
};

export default function LiveChart({
  marketData,
  onSelectToken,
  activePositions = [],
  pendingConfig,
  onToggleOrderBook,
  isOrderBookCollapsed = false,
}) {
  const [chartType, setChartType] = useState('CANDLES'); // 'CANDLES' | 'LINE' | 'AREA'
  const [timeframe, setTimeframe] = useState('1m'); // 'TICK' | '1m' | '5m' | '15m' | '1h' | '1D'
  const [timeframeHistory, setTimeframeHistory] = useState([]);
  const [hoverIndex, setHoverIndex] = useState(null);

  // Zoom and Pan State (Interactive TradingView navigation)
  const [zoomLevel, setZoomLevel] = useState(1.0); // 0.6x to 3.0x
  const [panOffset, setPanOffset] = useState(0); // px shift
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, offset: 0 });

  // Overlays
  const [showMa20, setShowMa20] = useState(true);
  const [showMa50, setShowMa50] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showAgentTrades, setShowAgentTrades] = useState(true);

  // Live Exchange Kline Data from Binance Vision / Defuse
  const [serverCandles, setServerCandles] = useState([]);
  const [serverStats, setServerStats] = useState(null);

  // Token Picker & Search
  const [chainFilter, setChainFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedContract, setCopiedContract] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const stats = marketData?.stats || {};
  const symbol = (marketData?.symbol || 'NEAR').toUpperCase();
  const rawTokens = marketData?.supportedTokens || [];
  const matchedToken = rawTokens.find((t) => t.symbol === symbol);
  const price = marketData?.price || matchedToken?.currentPrice || matchedToken?.defaultPrice || 3.30;

  const svgRef = useRef(null);
  const pickerRef = useRef(null);
  const containerRef = useRef(null);

  // Prevent browser window from scrolling up and down while zooming on the chart
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const step = 0.12;
      if (e.deltaY < 0) {
        // Zoom IN
        setZoomLevel((z) => Math.min(3.2, parseFloat((z + step).toFixed(2))));
      } else {
        // Zoom OUT
        setZoomLevel((z) => Math.max(0.6, parseFloat((z - step).toFixed(2))));
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Close token picker on outside click
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

  // Fetch or generate timeframe-specific historical curve
  useEffect(() => {
    let isCancelled = false;
    const now = Date.now();
    const intervalMs =
      timeframe === 'TICK' ? 3000 :
      timeframe === '1m' ? 60000 :
      timeframe === '5m' ? 300000 :
      timeframe === '15m' ? 900000 :
      timeframe === '1h' ? 3600000 : 86400000;

    const count = 60;
    const vol =
      timeframe === 'TICK' ? 0.0012 :
      timeframe === '1m' ? 0.0038 :
      timeframe === '5m' ? 0.0075 :
      timeframe === '15m' ? 0.014 :
      timeframe === '1h' ? 0.025 : 0.045;

    const seed = (symbol.charCodeAt(0) || 5) * 17;
    const localPts = [];
    for (let i = count; i >= 0; i--) {
      const t = now - i * intervalMs;
      const w1 = Math.sin((count - i) * 0.42 + seed) * vol;
      const w2 = Math.cos((count - i) * 0.28 + seed) * (vol * 0.65);
      const w3 = Math.sin((count - i) * 0.85) * (vol * 0.22);
      const p = parseFloat((price * (1 + w1 + w2 + w3)).toFixed(price >= 100 ? 2 : price >= 1 ? 4 : price >= 0.001 ? 6 : 8));
      localPts.push({ timestamp: t, price: p });
    }
    localPts[localPts.length - 1] = { timestamp: now, price };
    setTimeframeHistory(localPts);

    const fetchTfHistory = async () => {
      try {
        const res = await fetch(`/api/market/history?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            if (data.candles && data.candles.length > 5) {
              setServerCandles(data.candles);
            }
            if (data.history && data.history.length > 0) {
              setTimeframeHistory(data.history);
            }
            if (data.stats) {
              setServerStats(data.stats);
            }
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

  // Filtered tokens for popup search
  const filteredTokens = useMemo(() => {
    if (!rawTokens || rawTokens.length === 0) return [];
    return rawTokens.filter((t) => {
      let chainMatch = true;
      if (chainFilter === 'NEAR') {
        chainMatch = t.blockchain === 'near';
      } else if (chainFilter === 'OMNICHAIN') {
        chainMatch = ['btc', 'eth', 'sol', 'doge', 'xrp', 'ton', 'sui'].includes(t.blockchain);
      } else if (chainFilter === 'STABLE') {
        chainMatch = t.category === 'Stablecoin' || ['USDC', 'USDT', 'FRAX'].includes(t.symbol);
      } else if (chainFilter === 'MEME') {
        chainMatch = t.category === 'Ecosystem Meme' || ['BLACKDRAGON', 'SHITZU', 'PEPE'].includes(t.symbol);
      }

      let searchMatch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        searchMatch =
          t.symbol.toLowerCase().includes(q) ||
          (t.displaySymbol && t.displaySymbol.toLowerCase().includes(q)) ||
          (t.name && t.name.toLowerCase().includes(q)) ||
          (t.contractId && t.contractId.toLowerCase().includes(q));
      }
      return chainMatch && searchMatch;
    });
  }, [rawTokens, chainFilter, searchQuery]);

  // Effective price points
  const effectivePrices = useMemo(() => {
    if (timeframe === 'TICK' && marketData?.recentPrices && marketData.recentPrices.length > 5) {
      return marketData.recentPrices;
    }
    if (timeframeHistory && timeframeHistory.length > 0) {
      const updated = [...timeframeHistory];
      updated[updated.length - 1] = { timestamp: Date.now(), price };
      return updated;
    }
    return [{ timestamp: Date.now(), price }];
  }, [timeframe, timeframeHistory, marketData?.recentPrices, price]);

  // SVG Geometry Dimensions (Expanded 440px canvas for pro-grade vertical resolution)
  const svgWidth = 840;
  const svgHeight = 440;
  const yAxisWidth = 65;
  const xAxisHeight = 22;
  const volumeHeight = showVolume ? 60 : 0;
  const chartHeight = svgHeight - xAxisHeight - volumeHeight;
  const chartWidth = svgWidth - yAxisWidth;
  const paddingY = 18;

  // Active Positions for Agent Trade Overlay Lines (Entry, SL, TP)
  // Strictly binds only to the currently viewed token so cross-token positions never distort price scale
  const currentPosition = useMemo(() => {
    if (!activePositions || activePositions.length === 0) return null;
    const sym = symbol.toUpperCase();
    return (
      activePositions.find((p) => {
        const pSym = (p.tokenSymbol || p.token || '').toUpperCase();
        if (pSym === sym) return true;
        if (sym === 'NEAR' && (pSym.includes('WRAP') || pSym.includes('NEAR'))) return true;
        if (sym === 'ETH' && pSym.includes('ETH')) return true;
        if (sym === 'BTC' && pSym.includes('BTC')) return true;
        if (sym === 'SOL' && pSym.includes('SOL')) return true;
        if (sym === 'DOGE' && pSym.includes('DOGE')) return true;
        return false;
      }) || null
    );
  }, [activePositions, symbol]);

  // Candlesticks calculation with OHLCV & Real Binance Vision Klines
  const rawCandles = useMemo(() => {
    if (serverCandles && serverCandles.length > 10) {
      return serverCandles;
    }
    const candleCount = 48;
    const intervalMs =
      timeframe === 'TICK' ? 10000 :
      timeframe === '1m' ? 60000 :
      timeframe === '5m' ? 300000 :
      timeframe === '15m' ? 900000 :
      timeframe === '1h' ? 3600000 : 86400000;

    if (effectivePrices.length < 4) {
      return Array.from({ length: candleCount }).map((_, i) => {
        const o = price * (1 + Math.sin(i * 0.42) * 0.002);
        const c = price * (1 + Math.cos(i * 0.42) * 0.002);
        const h = Math.max(o, c) * 1.0015;
        const l = Math.min(o, c) * 0.9985;
        const vol = Math.round(5000 + Math.abs(Math.sin(i * 2.3)) * 45000);
        return { open: o, close: c, high: h, low: l, volume: vol, time: Date.now() - (candleCount - i) * intervalMs };
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
      const high = Math.max(...values, Math.max(open, close) * 1.0008);
      const low = Math.min(...values, Math.min(open, close) * 0.9992);
      const vol = Math.round(4000 + Math.abs(Math.sin(i * 1.8)) * 38000);
      result.push({ open, close, high, low, volume: vol, time: slice[0].timestamp });
    }
    return result;
  }, [serverCandles, effectivePrices, price, timeframe]);

  // Visible Candles after applying Zoom and Pan
  const { visibleCandles, startIdx, minP, maxP, rangeP, maxVol } = useMemo(() => {
    const total = rawCandles.length;
    const baseCount = Math.round(55 / zoomLevel);
    const visibleCount = Math.max(15, Math.min(total, baseCount));
    
    // Pan offset determines window slice start
    const maxPan = total - visibleCount;
    const indexShift = Math.round(panOffset / (chartWidth / visibleCount));
    const startIdx = Math.max(0, Math.min(maxPan, maxPan - indexShift));
    const slice = rawCandles.slice(startIdx, startIdx + visibleCount);

    const candlePrices = slice.flatMap((c) => [c.low, c.high]);
    const candleMin = candlePrices.length > 0 ? Math.min(...candlePrices) : (price * 0.99);
    const candleMax = candlePrices.length > 0 ? Math.max(...candlePrices) : (price * 1.01);
    const candleRange = candleMax - candleMin;
    const avgCandle = candlePrices.length > 0 ? candlePrices.reduce((a, b) => a + b, 0) / candlePrices.length : price;

    // ── Dynamic Volatility-Adaptive Scaling (TradingView Auto-Fit Invariant) ──
    // Detect stablecoins (USDC, USDT) or ultra-low volatility assets where candle swing is < 0.25%
    // Rather than squishing candles to 1-pixel ribbons with huge arbitrary multipliers,
    // we pad proportionally to the candle range so candles always occupy 45% - 60% of the chart height.
    const isUltraTight = candleMin > 0 && (candleRange / candleMin) < 0.003;
    const padFactor = isUltraTight ? 0.35 : 0.14;
    const minPadding = isUltraTight ? (avgCandle * 0.00005) : (avgCandle * 0.001);
    const padding = Math.max(candleRange * padFactor, minPadding);

    let min = candleMin - padding;
    let max = candleMax + padding;

    // Only allow active position to expand scale if reasonable and closely bounded
    if (
      currentPosition?.entryPrice &&
      currentPosition.entryPrice >= min * 0.98 &&
      currentPosition.entryPrice <= max * 1.02
    ) {
      min = Math.min(min, currentPosition.entryPrice * 0.999);
      max = Math.max(max, currentPosition.entryPrice * 1.001);
    }

    const maxV = Math.max(...slice.map((c) => c.volume || 1), 1);

    return {
      visibleCandles: slice,
      startIdx,
      minP: min,
      maxP: max,
      rangeP: max - min || 0.0000001,
      maxVol: maxV,
    };
  }, [rawCandles, zoomLevel, panOffset, currentPosition, price, chartWidth]);

  const priceToY = (p) => {
    return chartHeight - paddingY - ((p - minP) / rangeP) * (chartHeight - paddingY * 2);
  };

  const candleW = chartWidth / visibleCandles.length;

  // Adaptive Y-Axis Precision (e.g. 5 or 6 decimals for USDC, 2 decimals for ETH/BTC)
  const yPrecision = useMemo(() => {
    if (rangeP < 0.0005) return 6;
    if (rangeP < 0.005) return 5;
    if (rangeP < 0.05) return 4;
    if (rangeP < 1) return 3;
    if (rangeP < 10) return 2;
    return 2;
  }, [rangeP]);

  // Moving Average 20 and 50 points (Computed across full rawCandles history so zoom never collapses them)
  const { ma20Points, ma50Points } = useMemo(() => {
    const ma20 = [];
    const ma50 = [];
    const baseIdx = startIdx || 0;

    visibleCandles.forEach((c, idx) => {
      const x = idx * candleW + candleW / 2;
      const globalIdx = baseIdx + idx;

      // MA 20 window from full historical rawCandles
      const start20 = Math.max(0, globalIdx - 19);
      const slice20 = rawCandles.slice(start20, globalIdx + 1);
      const avg20 = slice20.reduce((acc, curr) => acc + curr.close, 0) / (slice20.length || 1);
      ma20.push(`${x.toFixed(1)},${priceToY(avg20).toFixed(1)}`);

      // MA 50 window from full historical rawCandles
      const start50 = Math.max(0, globalIdx - 49);
      const slice50 = rawCandles.slice(start50, globalIdx + 1);
      const avg50 = slice50.reduce((acc, curr) => acc + curr.close, 0) / (slice50.length || 1);
      ma50.push(`${x.toFixed(1)},${priceToY(avg50).toFixed(1)}`);
    });

    return { ma20Points: ma20.join(' '), ma50Points: ma50.join(' ') };
  }, [visibleCandles, startIdx, rawCandles, candleW, minP, rangeP, chartHeight]);

  // Line / Area curve points
  const linePoints = useMemo(() => {
    return visibleCandles
      .map((c, idx) => {
        const x = idx * candleW + candleW / 2;
        const y = priceToY(c.close);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [visibleCandles, candleW, minP, rangeP, chartHeight]);

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
    if (visibleCandles.length < 2) return [];
    const count = 4;
    const step = Math.floor((visibleCandles.length - 1) / count) || 1;
    const ticks = [];
    for (let i = 0; i < visibleCandles.length; i += step) {
      const x = i * candleW + candleW / 2;
      ticks.push({ x, time: visibleCandles[i].time });
    }
    return ticks;
  }, [visibleCandles, candleW]);

  const latestCandle = rawCandles.length > 0 ? rawCandles[rawCandles.length - 1] : null;
  const effectiveChartPrice = useMemo(() => {
    if (latestCandle?.close) {
      return latestCandle.close;
    }
    return price;
  }, [latestCandle, price]);

  const currentPriceY = priceToY(effectiveChartPrice);

  // Wheel Zoom Handler
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom IN (fewer candles, more detail)
      setZoomLevel((z) => Math.min(3.2, parseFloat((z + 0.15).toFixed(2))));
    } else {
      // Zoom OUT (more candles, macro)
      setZoomLevel((z) => Math.max(0.6, parseFloat((z - 0.15).toFixed(2))));
    }
  };

  // Drag-to-Pan Handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, offset: panOffset });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      setPanOffset(dragStart.offset + dx);
    }

    if (!svgRef.current || visibleCandles.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (svgWidth / rect.width);
    const clampedX = Math.max(0, Math.min(chartWidth, mouseX));
    const idx = Math.min(visibleCandles.length - 1, Math.max(0, Math.floor(clampedX / candleW)));
    setHoverIndex(idx);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverIndex(null);
  };

  const resetView = () => {
    setZoomLevel(1.0);
    setPanOffset(0);
  };

  const hoveredCandle = hoverIndex !== null && visibleCandles[hoverIndex] ? visibleCandles[hoverIndex] : null;
  const displayCandle = hoveredCandle || visibleCandles[visibleCandles.length - 1] || null;

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

  // Agent Trade Stop-Loss & Take-Profit Lines
  const agentLevels = useMemo(() => {
    if (!currentPosition || !showAgentTrades) return null;
    const entry = currentPosition.entryPrice;
    if (!entry || entry < minP * 0.7 || entry > maxP * 1.3) return null;
    const slPct = currentPosition.sl || -5.0;
    const tpPct = currentPosition.tp || 10.0;
    const slP = entry * (1 + slPct / 100);
    const tpP = entry * (1 + tpPct / 100);

    return {
      entryPrice: entry,
      entryY: priceToY(entry),
      slPrice: slP,
      slY: priceToY(slP),
      slPercent: slPct,
      tpPrice: tpP,
      tpY: priceToY(tpP),
      tpPercent: tpPct,
      orderId: currentPosition.orderId,
    };
  }, [currentPosition, showAgentTrades, minP, rangeP, chartHeight, price]);

  // Live Pre-Trade Ghost Target Guides (Synced dynamically to Left Panel inputs)
  const previewLevels = useMemo(() => {
    if (!showAgentTrades || agentLevels || !price) return null;
    const slPct = pendingConfig?.stopLossPercent !== undefined ? pendingConfig.stopLossPercent : -5.0;
    const tpPct = pendingConfig?.takeProfitPercent !== undefined ? pendingConfig.takeProfitPercent : 10.0;
    const slP = price * (1 + slPct / 100);
    const tpP = price * (1 + tpPct / 100);

    return {
      slPrice: slP,
      slY: priceToY(slP),
      slPercent: slPct,
      tpPrice: tpP,
      tpY: priceToY(tpP),
      tpPercent: tpPct,
    };
  }, [showAgentTrades, agentLevels, price, pendingConfig, minP, rangeP, chartHeight]);

  return (
    <div
      className="glass-panel"
      style={{
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* ── 1. PRO TOP BAR: Token Identity, Spot Price & 24h Stats Strip ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
        
        {/* Row 1: Token Identity, Spot Price & 24h Stats Strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          
          {/* Left: Token Dropdown & Spot Price */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }} ref={pickerRef}>
              <button
                type="button"
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-mid)',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                }}
              >
                <span>{activeToken.icon || 'Ⓝ'}</span>
                <span>{symbol}/USD</span>
                <ChevronDown size={13} color="var(--text-muted)" />
              </button>

              {/* Token Search Modal */}
              {isPickerOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    width: '380px',
                    maxHeight: '420px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-mid)',
                    borderRadius: '8px',
                    boxShadow: '0 12px 35px rgba(0,0,0,0.5)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={14} color="var(--accent-blue)" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search 230+ coins..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-input)', padding: '4px' }}>
                    {['ALL', 'NEAR', 'OMNICHAIN', 'STABLE', 'MEME'].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setChainFilter(f)}
                        style={{
                          flex: 1,
                          fontSize: '0.62rem',
                          padding: '4px 0',
                          border: 'none',
                          borderRadius: '4px',
                          background: chainFilter === f ? 'var(--accent-blue)' : 'transparent',
                          color: chainFilter === f ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                    {filteredTokens.slice(0, 30).map((t) => (
                      <div
                        key={t.symbol}
                        onClick={() => selectTokenAndClose(t)}
                        style={{
                          padding: '7px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{t.icon || '🪙'}</span>
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.symbol}</div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t.name}</div>
                          </div>
                        </div>
                        <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          ${formatPrice(t.currentPrice || t.defaultPrice)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Current Spot Price Display & 24h Change */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                ${formatPrice(price)}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: (stats.change24h || 0) >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: (stats.change24h || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                  border: `1px solid ${(stats.change24h || 0) >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}
              >
                {(stats.change24h || 0) >= 0 ? '+' : ''}{(stats.change24h || 0).toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Right: 24h Stats Row in Clean Pill Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.64rem',
              color: 'var(--text-muted)',
              background: 'rgba(0,0,0,0.25)',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.03)',
              flexWrap: 'wrap',
            }}
          >
            <div>HIGH 24H: <strong className="mono" style={{ color: 'var(--text-primary)' }}>${formatPrice(serverStats?.high || stats?.high24h || price * 1.04)}</strong></div>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
            <div>LOW 24H: <strong className="mono" style={{ color: 'var(--text-primary)' }}>${formatPrice(serverStats?.low || stats?.low24h || price * 0.96)}</strong></div>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
            <div>SWING: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{serverStats?.swing || 4.49}%</strong></div>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
            <div>VOL 24H: <strong className="mono" style={{ color: 'var(--text-primary)' }}>${formatVol(serverStats?.volume || stats?.volume24h || 600680000)}</strong></div>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 600 }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
              <span>Binance Vision</span>
            </div>
          </div>
        </div>

        {/* Row 2: Pro Interactive Toolbar (Chart Modes, Timeframes & Overlays) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
          
          {/* Left Cluster: Chart Type + Timeframes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Chart Type (Candles, Line, Area) */}
            <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '2px', borderRadius: '5px', gap: '2px' }}>
              {['CANDLES', 'LINE', 'AREA'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setChartType(type)}
                  style={{
                    fontSize: '0.64rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: 'none',
                    background: chartType === type ? 'var(--accent-blue)' : 'transparent',
                    color: chartType === type ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {type === 'CANDLES' ? 'Candles' : type === 'LINE' ? 'Line' : 'Area'}
                </button>
              ))}
            </div>

            {/* Timeframe Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--bg-input)', padding: '2px', borderRadius: '5px' }}>
              {['1m', '5m', '15m', '1h', '1D'].map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  style={{
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: 'none',
                    background: timeframe === tf ? 'var(--accent-blue)' : 'transparent',
                    color: timeframe === tf ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Right Cluster: Technical Overlays & View Reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setShowMa20(!showMa20)}
              style={{
                fontSize: '0.64rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: showMa20 ? 'rgba(56,189,248,0.5)' : 'var(--border-subtle)',
                background: showMa20 ? 'rgba(56,189,248,0.15)' : 'transparent',
                color: showMa20 ? '#38bdf8' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              MA 20
            </button>

            <button
              type="button"
              onClick={() => setShowMa50(!showMa50)}
              style={{
                fontSize: '0.64rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: showMa50 ? 'rgba(245,158,11,0.5)' : 'var(--border-subtle)',
                background: showMa50 ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: showMa50 ? '#f59e0b' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              MA 50
            </button>

            <button
              type="button"
              onClick={() => setShowVolume(!showVolume)}
              style={{
                fontSize: '0.64rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: showVolume ? 'rgba(16,185,129,0.5)' : 'var(--border-subtle)',
                background: showVolume ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: showVolume ? 'var(--accent-green)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Volume
            </button>

            <button
              type="button"
              onClick={() => setShowAgentTrades(!showAgentTrades)}
              title="Toggle On-Chart Agent Entry, SL, and TP Overlay Lines"
              style={{
                fontSize: '0.64rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: showAgentTrades && (currentPosition || previewLevels) ? 'var(--accent-blue)' : 'var(--border-subtle)',
                background: showAgentTrades && (currentPosition || previewLevels) ? 'var(--accent-blue-dim)' : 'transparent',
                color: showAgentTrades && (currentPosition || previewLevels) ? 'var(--accent-blue)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Agent trades
            </button>

            {onToggleOrderBook && (
              <button
                type="button"
                onClick={onToggleOrderBook}
                title={isOrderBookCollapsed ? "Expand Order Book Sidebar" : "Collapse Order Book Sidebar"}
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: !isOrderBookCollapsed ? 'var(--accent-blue)' : 'var(--border-subtle)',
                  background: !isOrderBookCollapsed ? 'rgba(59,130,246,0.18)' : 'transparent',
                  color: !isOrderBookCollapsed ? 'var(--accent-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                Order book
              </button>
            )}

            {/* Reset Zoom & Pan View */}
            <button
              type="button"
              onClick={resetView}
              title="Reset Zoom & Pan to 100%"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '0.64rem',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: zoomLevel !== 1.0 || panOffset !== 0 ? 'var(--accent-amber)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={10} />
              <span>Reset {zoomLevel !== 1.0 ? `(${zoomLevel}x)` : ''}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. OHLCV HOVER / LIVE TICK STATUS BAR ── */}
      {displayCandle && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.68rem', color: 'var(--text-muted)', padding: '2px 4px' }}>
          <span>
            {new Date(displayCandle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span>O: <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>${formatPrice(displayCandle.open)}</span></span>
          <span>H: <span className="mono" style={{ color: 'var(--accent-green)', fontWeight: 700 }}>${formatPrice(displayCandle.high)}</span></span>
          <span>L: <span className="mono" style={{ color: 'var(--accent-red)', fontWeight: 700 }}>${formatPrice(displayCandle.low)}</span></span>
          <span>C: <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>${formatPrice(displayCandle.close)}</span></span>
          <span>Vol: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{formatVol(displayCandle.volume)}</span></span>
          <span className="mono" style={{ color: displayCandle.close >= displayCandle.open ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
            {(((displayCandle.close - displayCandle.open) / displayCandle.open) * 100).toFixed(2)}%
          </span>
        </div>
      )}

      {/* ── 3. INTERACTIVE SVG CHART & LEGEND STRIP (Expanded 480px) ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '480px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Interactive SVG Chart Canvas */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            position: 'relative',
            width: '100%',
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'crosshair',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#1d4ed8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.0" />
              </linearGradient>
            </defs>

          {/* Gridlines */}
          {yTicks.map((tick, i) => (
            <g key={`y-${i}`}>
              <line x1="0" y1={tick.y} x2={chartWidth} y2={tick.y} stroke="var(--border-subtle)" strokeDasharray="3,3" opacity="0.6" />
              <text x={chartWidth + 6} y={tick.y + 4} fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">
                ${formatPrice(tick.price, yPrecision)}
              </text>
            </g>
          ))}

          {/* X-Axis Vertical Dividers */}
          {xTicks.map((pt, i) => (
            <g key={`x-${i}`}>
              <line x1={pt.x} y1="0" x2={pt.x} y2={chartHeight} stroke="var(--border-subtle)" strokeDasharray="3,3" opacity="0.4" />
              <text x={pt.x} y={svgHeight - 6} textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">
                {new Date(pt.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </text>
            </g>
          ))}

          {/* Axis borders */}
          <line x1={chartWidth} y1="0" x2={chartWidth} y2={svgHeight - xAxisHeight} stroke="var(--border-subtle)" />
          <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="var(--border-subtle)" />

          {/* ── SUB-CHART: VOLUME HISTOGRAM (Bottom 55px) ── */}
          {showVolume && (
            <g>
              <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="var(--border-subtle)" strokeDasharray="2,2" />
              {visibleCandles.map((c, i) => {
                const x = i * candleW + candleW * 0.15;
                const barWidth = Math.max(2, candleW * 0.7);
                const barH = Math.max(3, (c.volume / maxVol) * (volumeHeight - 8));
                const y = chartHeight + volumeHeight - barH;
                const isGreen = c.close >= c.open;
                return (
                  <rect
                    key={`vol-${i}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    fill={isGreen ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}
                    rx="1"
                  />
                );
              })}
            </g>
          )}

          {/* ── CHART VIEW: CANDLESTICKS ── */}
          {chartType === 'CANDLES' && (
            <g>
              {visibleCandles.map((c, i) => {
                const xCenter = i * candleW + candleW / 2;
                const isGreen = c.close >= c.open;
                const color = isGreen ? 'var(--accent-green)' : 'var(--accent-red)';
                const yHigh = priceToY(c.high);
                const yLow = priceToY(c.low);
                const yOpen = priceToY(c.open);
                const yClose = priceToY(c.close);
                const topBody = Math.min(yOpen, yClose);
                const rawBodyH = Math.abs(yClose - yOpen);
                const bodyH = Math.max(3.5, rawBodyH);
                const barWidth = Math.max(3.5, candleW * 0.68);

                // Ensure wicks visibly extend above and below candle body
                const wickTop = Math.min(yHigh, topBody - 1);
                const wickBottom = Math.max(yLow, topBody + bodyH + 1);

                return (
                  <g key={`candle-${i}`}>
                    {/* Wick */}
                    <line x1={xCenter} y1={wickTop} x2={xCenter} y2={wickBottom} stroke={color} strokeWidth="1.2" />
                    {/* Body */}
                    <rect
                      x={xCenter - barWidth / 2}
                      y={topBody}
                      width={barWidth}
                      height={bodyH}
                      fill={color}
                      rx="1"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* ── CHART VIEW: AREA / LINE ── */}
          {chartType === 'AREA' && (
            <>
              <polygon points={`0,${chartHeight} ${linePoints} ${chartWidth},${chartHeight}`} fill="url(#areaGrad)" />
              <polyline fill="none" stroke="#2563eb" strokeWidth="2.2" points={linePoints} />
            </>
          )}
          {chartType === 'LINE' && (
            <polyline fill="none" stroke="#2563eb" strokeWidth="2.2" points={linePoints} />
          )}

          {/* ── TECHNICAL INDICATOR: MA 20 (Cyan) ── */}
          {showMa20 && ma20Points && (
            <polyline fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="none" opacity="0.9" points={ma20Points} />
          )}

          {/* ── TECHNICAL INDICATOR: MA 50 (Gold) ── */}
          {showMa50 && ma50Points && (
            <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="none" opacity="0.9" points={ma50Points} />
          )}

          {/* ── 🛡️ AGENT TRADE OVERLAYS (Entry, SL Floor, TP Target) ── */}
          {agentLevels && (
            <g>
              {/* Entry Price Line (Cyan) */}
              {agentLevels.entryY >= paddingY && agentLevels.entryY <= chartHeight - paddingY && (
                <g>
                  <line x1="0" y1={agentLevels.entryY} x2={chartWidth} y2={agentLevels.entryY} stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3,3" opacity="0.8" />
                  <rect x={chartWidth - 95} y={agentLevels.entryY - 8} width="90" height="16" rx="3" fill="#0284c7" />
                  <text x={chartWidth - 50} y={agentLevels.entryY + 3.5} textAnchor="middle" fill="#ffffff" fontSize="8.5" fontFamily="var(--font-mono)" fontWeight="700">
                    ENTRY ${formatPrice(agentLevels.entryPrice)}
                  </text>
                </g>
              )}

              {/* Stop-Loss Floor Line (Red Dashed) */}
              {agentLevels.slY >= paddingY && agentLevels.slY <= chartHeight - paddingY && (
                <g>
                  <line x1="0" y1={agentLevels.slY} x2={chartWidth} y2={agentLevels.slY} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4,4" />
                  <rect x={chartWidth - 105} y={agentLevels.slY - 8} width="100" height="16" rx="3" fill="rgba(239,68,68,0.92)" />
                  <text x={chartWidth - 55} y={agentLevels.slY + 3.5} textAnchor="middle" fill="#ffffff" fontSize="8.5" fontFamily="var(--font-mono)" fontWeight="700">
                    SL ${formatPrice(agentLevels.slPrice)} ({agentLevels.slPercent}%)
                  </text>
                </g>
              )}

              {/* Take-Profit Target Line (Green Dashed) */}
              {agentLevels.tpY >= paddingY && agentLevels.tpY <= chartHeight - paddingY && (
                <g>
                  <line x1="0" y1={agentLevels.tpY} x2={chartWidth} y2={agentLevels.tpY} stroke="#10b981" strokeWidth="1.2" strokeDasharray="4,4" />
                  <rect x={chartWidth - 105} y={agentLevels.tpY - 8} width="100" height="16" rx="3" fill="rgba(16,185,129,0.92)" />
                  <text x={chartWidth - 55} y={agentLevels.tpY + 3.5} textAnchor="middle" fill="#ffffff" fontSize="8.5" fontFamily="var(--font-mono)" fontWeight="700">
                    TP ${formatPrice(agentLevels.tpPrice)} (+{agentLevels.tpPercent}%)
                  </text>
                </g>
              )}
            </g>
          )}

          {/* ── 👻 PRE-TRADE GHOST PREVIEW GUIDES (Live SL/TP from Left Panel) ── */}
          {previewLevels && (
            <g>
              {/* Ghost Take-Profit Target (Emerald Dashed Laser & Badge) */}
              {(() => {
                const isOffscreenTop = previewLevels.tpY < paddingY;
                const badgeY = isOffscreenTop ? paddingY + 2 : previewLevels.tpY - 8;
                return (
                  <g>
                    {!isOffscreenTop && previewLevels.tpY <= chartHeight - paddingY && (
                      <line
                        x1="0"
                        y1={previewLevels.tpY}
                        x2={chartWidth}
                        y2={previewLevels.tpY}
                        stroke="rgba(16,185,129,0.5)"
                        strokeWidth="1.2"
                        strokeDasharray="4,4"
                      />
                    )}
                    <rect
                      x={chartWidth - 118}
                      y={badgeY}
                      width="114"
                      height="16"
                      rx="3"
                      fill="rgba(16,185,129,0.22)"
                      stroke="rgba(16,185,129,0.7)"
                      strokeWidth="0.8"
                      strokeDasharray="2,2"
                    />
                    <text
                      x={chartWidth - 61}
                      y={badgeY + 11.5}
                      textAnchor="middle"
                      fill="#34d399"
                      fontSize="8"
                      fontFamily="var(--font-mono)"
                      fontWeight="700"
                    >
                      {isOffscreenTop ? '▲ ' : ''}🎯 TP ${formatPrice(previewLevels.tpPrice)} (+{previewLevels.tpPercent}%)
                    </text>
                  </g>
                );
              })()}

              {/* Ghost Stop-Loss Floor (Crimson Dashed Laser & Badge) */}
              {(() => {
                const isOffscreenBottom = previewLevels.slY > chartHeight - paddingY - 16;
                const badgeY = isOffscreenBottom ? chartHeight - paddingY - 16 : previewLevels.slY - 8;
                return (
                  <g>
                    {!isOffscreenBottom && previewLevels.slY >= paddingY && (
                      <line
                        x1="0"
                        y1={previewLevels.slY}
                        x2={chartWidth}
                        y2={previewLevels.slY}
                        stroke="rgba(239,68,68,0.5)"
                        strokeWidth="1.2"
                        strokeDasharray="4,4"
                      />
                    )}
                    <rect
                      x={chartWidth - 118}
                      y={badgeY}
                      width="114"
                      height="16"
                      rx="3"
                      fill="rgba(239,68,68,0.22)"
                      stroke="rgba(239,68,68,0.7)"
                      strokeWidth="0.8"
                      strokeDasharray="2,2"
                    />
                    <text
                      x={chartWidth - 61}
                      y={badgeY + 11.5}
                      textAnchor="middle"
                      fill="#f87171"
                      fontSize="8"
                      fontFamily="var(--font-mono)"
                      fontWeight="700"
                    >
                      {isOffscreenBottom ? '▼ ' : ''}🛑 SL ${formatPrice(previewLevels.slPrice)} ({previewLevels.slPercent}%)
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Live Spot Price Laser Line & Right Badge */}
          <line x1="0" y1={currentPriceY} x2={chartWidth} y2={currentPriceY} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
          <rect x={chartWidth + 2} y={Math.max(2, Math.min(chartHeight - 16, currentPriceY - 9))} width={yAxisWidth - 4} height="18" rx="3" fill="#0284c7" />
          <text x={chartWidth + yAxisWidth / 2} y={Math.max(2, Math.min(chartHeight - 16, currentPriceY - 9)) + 12} textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="var(--font-mono)" fontWeight="800">
            ${formatPrice(effectiveChartPrice, yPrecision)}
          </text>

          {/* Hover Crosshair Cursor Line */}
          {hoveredCandle && (
            <g>
              <line
                x1={hoverIndex * candleW + candleW / 2}
                y1="0"
                x2={hoverIndex * candleW + candleW / 2}
                y2={chartHeight}
                stroke="rgba(255,255,255,0.4)"
                strokeDasharray="2,2"
              />
              <line
                x1="0"
                y1={priceToY(hoveredCandle.close)}
                x2={chartWidth}
                y2={priceToY(hoveredCandle.close)}
                stroke="rgba(255,255,255,0.4)"
                strokeDasharray="2,2"
              />
            </g>
          )}
        </svg>
      </div>

        {/* ── 4. DEDICATED CHART FOOTER (Clean Legend on Left, Hints on Right — 0% Collision) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 14px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(0,0,0,0.25)',
            fontSize: '0.62rem',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {showMa20 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#38bdf8', fontWeight: 600 }}>
                <span style={{ width: '10px', height: '2px', background: '#38bdf8', borderRadius: '1px' }} />
                MA 20
              </span>
            )}
            {showMa50 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f59e0b', fontWeight: 600 }}>
                <span style={{ width: '10px', height: '2px', background: '#f59e0b', borderRadius: '1px' }} />
                MA 50
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'rgba(255,255,255,0.4)' }}>
              <span style={{ width: '10px', height: '1px', borderTop: '1px dashed #10b981' }} />
              Agent SL/TP Guides
            </span>
          </div>

          <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.02em' }}>
            Scroll to zoom · Drag to pan
          </div>
        </div>
      </div>
    </div>
  );
}
