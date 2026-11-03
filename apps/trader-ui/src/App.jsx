// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AdminPanel from './components/AdminPanel';
import LiveChart from './components/LiveChart';
import IndicatorGauges from './components/IndicatorGauges';
import PositionCard from './components/PositionCard';
import AgentTerminal from './components/AgentTerminal';
import TradeHistory from './components/TradeHistory';

export default function App() {
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
    position: {
      inPosition: false,
    },
    feeStats: {
      totalFeesPaidNear: 0,
      totalFeesPaidUsd: 0,
    },
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

  // Connect WebSocket to backend stream (Dynamic for localhost & free cloud hosting)
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
          console.log(`✅ Connected to ZeroDrain WebSocket stream (${wsUrl})`);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'STATE_UPDATE' && message.data) {
              setState(message.data);
            }
          } catch (e) {
            console.error('Error parsing WS message:', e);
          }
        };

        ws.onclose = () => {
          if (!isUnmounted) {
            console.log('🔌 WebSocket disconnected. Reconnecting in 3s...');
            reconnectTimeout = setTimeout(connectWS, 3000);
          }
        };

        ws.onerror = (err) => {
          console.warn('WebSocket stream error:', err);
          if (ws) ws.close();
        };
      } catch (err) {
        console.error('Failed to initialize WebSocket:', err);
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectWS, 4000);
        }
      }
    };

    connectWS();

    // Initial fetch via REST
    fetch('/api/agent/state')
      .then((res) => res.json())
      .then((data) => {
        if (data) setState(data);
      })
      .catch((err) => console.log('Waiting for backend...', err));

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Dispatch an incoming Agent trade payload { sl, tp, token, amount, wallet }
  const handleDispatchPayload = async (payload) => {
    try {
      const res = await fetch('/api/agent/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Error dispatching agent payload:', err);
      return { success: false, error: err.message };
    }
  };

  // Close position and trigger on-chain return of funds to wallet
  const handleCloseAndReturn = async (wallet, reason) => {
    try {
      const res = await fetch('/api/agent/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, reason }),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Error closing position:', err);
      return { success: false, error: err.message };
    }
  };

  // Switch active token on NEAR chain
  const handleSwitchToken = async (tokenObj) => {
    try {
      const sym = typeof tokenObj === 'string' ? tokenObj : tokenObj.symbol;
      const contract = tokenObj.testnetContract || tokenObj.contractId || sym;

      const res = await fetch('/api/market/switch-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, token: contract }),
      });
      const data = await res.json();

      setState((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          tokenPair: contract,
        },
        market: data || prev.market,
      }));
    } catch (err) {
      console.error('Failed to switch market token:', err);
    }
  };

  const targetWallet = state.position?.returnWallet || state.activeOrder?.wallet || state.config?.wallet || null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar: Headless Agent API Status & Target Wallet */}
      <Navbar
        marketPrice={state.market?.price}
        marketSymbol={state.market?.symbol}
        agentStatus={state.status}
        targetWallet={targetWallet}
        feeStats={state.feeStats}
      />

      {/* Main Grid Layout */}
      <main style={{ padding: '0 20px 40px 20px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '390px minmax(0, 1fr)', gap: '24px', alignItems: 'start', width: '100%', maxWidth: '100%' }}>
          {/* Left Column: Agent API Gateway & Live Payload Dispatcher */}
          <AdminPanel
            config={state.config}
            agentStatus={state.status}
            lastPayload={state.lastPayload}
            onDispatchPayload={handleDispatchPayload}
            onCloseAndReturn={handleCloseAndReturn}
            onSelectToken={handleSwitchToken}
          />

          {/* Right Column: Live Chart, Indicators, Positions, Terminal & History (minWidth: 0 prevents blowout) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', maxWidth: '100%' }}>
            {/* Live Chart & Oracles with all NEAR tokens */}
            <LiveChart marketData={state.market} onSelectToken={handleSwitchToken} />

            {/* Indicator Gauges & Position Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <IndicatorGauges
                indicators={state.market?.indicators}
                signal={state.market?.signal}
                reasoning={state.market?.reasoning}
              />
              <PositionCard
                position={state.position}
                config={state.config}
                agentStatus={state.status}
              />
            </div>

            {/* Live Agent Reasoning Terminal */}
            <AgentTerminal logs={state.recentLogs} />

            {/* Trade Settlement History with Return Destination Proof */}
            <TradeHistory trades={state.tradeHistory} />
          </div>
        </div>
      </main>
    </div>
  );
}
