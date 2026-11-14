// apps/trader-ui/src/App.jsx
import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AdminPanel from './components/AdminPanel';
import LiveChart from './components/LiveChart';
import IndicatorGauges from './components/IndicatorGauges';
import OrderBook from './components/OrderBook';
import BottomTabs from './components/BottomTabs';

const CANONICAL_TESTNET_CONTRACTS = {
  NEAR: 'wrap.testnet',
  WNEAR: 'wrap.testnet',
  WRAP: 'wrap.testnet',
  ETH: 'weth.fakes.testnet',
  WETH: 'weth.fakes.testnet',
  BTC: 'wbtc.fakes.testnet',
  WBTC: 'wbtc.fakes.testnet',
  SOL: 'sol.fakes.testnet',
  USDC: 'usdc.fakes.testnet',
  USDT: 'usdt.fakes.testnet',
  DOGE: 'doge.omft.near',
  AURORA: 'aurora.fakes.testnet',
};

const CANONICAL_MAINNET_CONTRACTS = {
  NEAR: 'wrap.near',
  WNEAR: 'wrap.near',
  WRAP: 'wrap.near',
  ETH: 'c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near',
  WETH: 'c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near',
  BTC: '2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near',
  WBTC: '2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near',
  SOL: '22.contract.portalbridge.near',
  USDC: '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  USDT: 'dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near',
  DOGE: 'doge.omft.near',
  AURORA: 'aurora',
};

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('zd_theme') || 'dark');
  const [network, setNetwork] = useState(() => localStorage.getItem('zd_network') || 'testnet');
  const [isOrderBookCollapsed, setIsOrderBookCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('zd_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('zd_network', network);
  }, [network]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleNetwork = () => {
    setNetwork((prev) => (prev === 'testnet' ? 'mainnet' : 'testnet'));
  };

  const [state, setState] = useState({
    status: 'IDLE',
    config: {
      accountId: '',
      wallet: '',
      tokenPair: 'wrap.testnet',
      allocation: 1.0,
      stopLossPercent: -5.0,
      takeProfitPercent: 10.0,
      tradingMode: 'TWO_WAY',
    },
    position: { inPosition: false },
    activePositions: [],
    activePositionsCount: 0,
    feeStats: { totalFeesPaidNear: 0, totalFeesPaidUsd: 0 },
    market: {
      price: null,
      symbol: 'NEAR',
      stats: {},
      indicators: {},
      signal: 'NEUTRAL',
      reasoning: 'Connecting to live market oracles...',
    },
    lastPayload: null,
    activeOrder: null,
    tradeHistory: [],
    recentLogs: [],
  });

  // WebSocket connection with auto-reconnect
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let isUnmounted = false;

    const connectWS = () => {
      if (isUnmounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const customWsUrl = import.meta.env.VITE_WS_URL;

      let wsUrl;
      if (customWsUrl) {
        wsUrl = customWsUrl;
      } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        wsUrl = `${protocol}//${window.location.hostname}:4000`;
      } else {
        wsUrl = `${protocol}//${window.location.host}`;
      }

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log(`✅ ZeroDrain WS connected (${wsUrl})`);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'STATE_UPDATE' && message.data) {
              setState(message.data);
            }
          } catch (e) {
            console.error('WS parse error:', e);
          }
        };

        ws.onclose = () => {
          if (!isUnmounted) {
            console.log('🔌 WS disconnected. Reconnecting in 3s...');
            reconnectTimeout = setTimeout(connectWS, 3000);
          }
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch (err) {
        console.error('WS init failed:', err);
        if (!isUnmounted) reconnectTimeout = setTimeout(connectWS, 4000);
      }
    };

    connectWS();

    // Initial REST fetch
    fetch('/api/agent/state')
      .then((r) => r.json())
      .then((data) => { if (data) setState(data); })
      .catch(() => {});

    return () => {
      isUnmounted = true;
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  // ── API handlers ──────────────────────────────────────────────

  const handleDispatchPayload = async (payload) => {
    try {
      const res = await fetch('/api/agent/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const handleCloseAndReturn = async (wallet, orderId, reason) => {
    try {
      const body = { wallet, reason: reason || 'MANUAL_CLOSE_UI' };
      if (orderId) body.orderId = orderId;
      const res = await fetch('/api/agent/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const handleSwitchToken = async (tokenObj) => {
    try {
      const sym = typeof tokenObj === 'string' ? tokenObj : tokenObj.symbol;
      const upperSym = (sym || 'NEAR').toUpperCase();
      const contractMap = network === 'mainnet' ? CANONICAL_MAINNET_CONTRACTS : CANONICAL_TESTNET_CONTRACTS;
      const canonicalContract = contractMap[upperSym] || tokenObj.mainnetContract || tokenObj.testnetContract || tokenObj.contractId || sym;
      const res = await fetch('/api/market/switch-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, token: canonicalContract }),
      });
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        config: { ...prev.config, tokenPair: canonicalContract },
        market: data || prev.market,
      }));
    } catch (err) {
      console.error('Token switch failed:', err);
    }
  };

  const activePositions = state.activePositions || [];
  const hasActivePositions = activePositions.length > 0 || Boolean(state.position?.inPosition);

  const targetWallet = hasActivePositions
    ? (state.position?.returnWallet || activePositions[0]?.returnWallet || null)
    : null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>

      {/* ── Navbar ── */}
      <Navbar
        marketPrice={state.market?.price}
        marketSymbol={state.market?.symbol}
        agentStatus={state.status}
        targetWallet={targetWallet}
        feeStats={state.feeStats}
        theme={theme}
        onToggleTheme={toggleTheme}
        network={network}
        onToggleNetwork={toggleNetwork}
      />

      {/* ── Main grid ── */}
      <main style={{ flex: 1, padding: '0 16px 32px', maxWidth: '1600px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* Top row: Left sidebar + Chart + Order Book */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isOrderBookCollapsed
              ? '360px minmax(0, 1fr) 42px'
              : '360px minmax(0, 1fr) 260px',
            gap: '16px',
            alignItems: 'start',
            transition: 'grid-template-columns 0.2s ease',
          }}
        >

          {/* Left — Agent API panel */}
          <div>
            <AdminPanel
              config={state.config}
              network={network}
              marketSymbol={state.market?.symbol}
              agentStatus={state.status}
              lastPayload={state.lastPayload}
              onDispatchPayload={handleDispatchPayload}
              onCloseAndReturn={handleCloseAndReturn}
              onSelectToken={handleSwitchToken}
              onConfigChange={(newCfg) => {
                setState((prev) => ({
                  ...prev,
                  config: { ...prev.config, ...newCfg },
                }));
              }}
            />
          </div>

          {/* Center — Chart + Indicators + Sentinel Telemetry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
            <LiveChart
              marketData={state.market}
              onSelectToken={handleSwitchToken}
              activePositions={activePositions}
              pendingConfig={state.config}
              onToggleOrderBook={() => setIsOrderBookCollapsed((prev) => !prev)}
              isOrderBookCollapsed={isOrderBookCollapsed}
            />
            <IndicatorGauges
              indicators={state.market?.indicators}
              signal={state.market?.signal}
              reasoning={state.market?.reasoning}
            />
          </div>

          {/* Right — Order Book */}
          <div style={{ height: '100%', minHeight: '480px' }}>
            <OrderBook
              marketData={state.market}
              isCollapsed={isOrderBookCollapsed}
              onToggleCollapse={() => setIsOrderBookCollapsed((prev) => !prev)}
            />
          </div>
        </div>

        {/* Bottom — Unified tabs: Active Orders / History / Logs */}
        <div style={{ marginTop: '16px' }}>
          <BottomTabs
            positions={activePositions}
            currentPrice={state.market?.price}
            trades={state.tradeHistory}
            logs={state.recentLogs}
            onClosePosition={handleCloseAndReturn}
          />
        </div>
      </main>
    </div>
  );
}
