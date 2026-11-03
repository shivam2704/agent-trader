// frontend/src/components/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import { Bot, Play, Square, Copy, Check, Terminal, ShieldCheck, ArrowRightLeft, Coins, CheckCircle2, XCircle, Loader2, Zap, ExternalLink, RefreshCw } from 'lucide-react';

export default function AdminPanel({
  config,
  agentStatus,
  onDispatchPayload,
  onCloseAndReturn,
  lastPayload,
  onSelectToken,
}) {
  const [wallet, setWallet] = useState(config?.wallet || config?.accountId || '');
  const [token, setToken] = useState(config.tokenPair || 'wrap.testnet');
  const [amount, setAmount] = useState(config.allocation || 3.0);
  const [sl, setSl] = useState(Math.abs(config.stopLossPercent) || 5.0);
  const [tp, setTp] = useState(config.takeProfitPercent || 10.0);
  const [trailingStop, setTrailingStop] = useState(false);
  const [maxTrades, setMaxTrades] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [responseMsg, setResponseMsg] = useState(null);
  const [intentPreview, setIntentPreview] = useState(null);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const initializedRef = React.useRef(false);

  // Sync initial config from server once on load without overriding active user edits on every tick
  useEffect(() => {
    if (!initializedRef.current && config) {
      if (config.wallet) setWallet(config.wallet);
      if (config.tokenPair) setToken(config.tokenPair);
      if (config.allocation !== undefined) setAmount(config.allocation);
      if (config.stopLossPercent !== undefined) setSl(Math.abs(config.stopLossPercent));
      if (config.takeProfitPercent !== undefined) setTp(config.takeProfitPercent);
      if (config.wallet || config.tokenPair) {
        initializedRef.current = true;
      }
    }
  }, [config]);

  const presets = [
    { label: 'NEAR', id: 'wrap.testnet' },
    { label: 'ETH', id: 'weth.fakes.testnet' },
    { label: 'BTC', id: 'wbtc.fakes.testnet' },
    { label: 'SOL', id: 'sol.fakes.testnet' },
    { label: 'AURORA', id: 'aurora.fakes.testnet' },
    { label: 'USDC', id: 'usdc.fakes.testnet' },
  ];

  // Live JSON Payload Object
  const currentPayload = {
    sl: parseFloat(sl),
    tp: parseFloat(tp),
    token: token.trim(),
    amount: parseFloat(amount),
    wallet: wallet.trim(),
    ...(trailingStop ? { trailingStop: true } : {}),
    ...(maxTrades > 1 ? { maxTrades } : {}),
  };

  const handleDispatch = async (e) => {
    if (e) e.preventDefault();
    if (!wallet.trim()) {
      setResponseMsg({ success: false, text: 'Caller wallet address ("wallet") is required. Funds cannot be routed without return destination.' });
      return;
    }
    setIsSubmitting(true);
    setResponseMsg(null);
    try {
      const res = await onDispatchPayload(currentPayload);
      if (res && res.success) {
        setResponseMsg({ success: true, text: `Payload accepted! Order ID: ${res.orderId}. Circuit breaker armed.` });
      } else {
        setResponseMsg({ success: false, text: res?.error || 'Failed to dispatch payload' });
      }
    } catch (err) {
      setResponseMsg({ success: false, text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExit = async () => {
    setIsSubmitting(true);
    try {
      const res = await onCloseAndReturn(wallet.trim(), 'AGENT_MANUAL_API_CLOSE');
      if (res && res.success) {
        setResponseMsg({ success: true, text: `Position closed. Funds returned to ${res.returnWallet}.` });
      }
    } catch (err) {
      setResponseMsg({ success: false, text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchIntentQuote = async () => {
    setFetchingQuote(true);
    try {
      const res = await fetch('/api/intents/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originToken: 'wrap.near',
          destinationToken: token.trim(),
          amount: parseFloat(amount) || 1.0,
          wallet: wallet.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.quote) {
        setIntentPreview(data.quote);
      }
    } catch (e) {
      console.error('Quote fetch error:', e);
    } finally {
      setFetchingQuote(false);
    }
  };

  const copyCurl = () => {
    const curl = `curl -X POST http://localhost:4000/api/agent/trade \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(currentPayload)}'`;
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isInPosition = agentStatus === 'IN_POSITION';

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bot size={22} color="var(--accent-cyan)" />
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Agent API Gateway</h2>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>POST /api/agent/trade</span>
          </div>
        </div>
        <span style={{ fontSize: '0.65rem', background: 'rgba(0,240,255,0.12)', color: '#00f0ff', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
          HEADLESS SERVICE
        </span>
      </div>

      <form onSubmit={handleDispatch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* FIELD 1: WALLET (Return Destination) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRightLeft size={14} color="var(--accent-green)" />
              Caller Wallet (`wallet`)
            </label>
            <span style={{ fontSize: '0.65rem', color: 'var(--accent-green)', fontWeight: 700 }}>
              AUTO-RETURN DESTINATION
            </span>
          </div>
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="e.g. client_agent_vault.testnet"
            className="mono"
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
          />
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
            When position closes or SL triggers, capital + profit will be sent back to this wallet.
          </span>
        </div>

        {/* FIELD 2: TOKEN */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Coins size={14} color="var(--accent-cyan)" />
              Target Token Contract (`token`)
            </label>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>NEP-141 / Presets</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setToken(p.id);
                  if (onSelectToken) onSelectToken({ symbol: p.label, testnetContract: p.id });
                }}
                style={{
                  fontSize: '0.68rem',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  background: token === p.id ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.05)',
                  border: token === p.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  color: token === p.id ? '#00f0ff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="e.g. wrap.testnet"
            className="mono"
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>

        {/* FIELD 3: AMOUNT */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', display: 'block', marginBottom: '6px' }}>
            Allocation Amount (`amount`)
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mono"
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '10px 96px 10px 12px',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <button
                type="button"
                onClick={() => setAmount((prev) => Math.max(0.1, +(parseFloat(prev || 0) - 0.5).toFixed(2)))}
                title="Decrease (-0.5 NEAR)"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: '#fff',
                  width: '20px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setAmount((prev) => +(parseFloat(prev || 0) + 0.5).toFixed(2))}
                title="Increase (+0.5 NEAR)"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: '#fff',
                  width: '20px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                +
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 800, paddingLeft: '4px' }}>
                NEAR
              </span>
            </div>
          </div>
        </div>

        {/* FIELD 4 & 5: STOP LOSS & TAKE PROFIT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-red)', display: 'block', marginBottom: '6px' }}>
              🛑 Stop-Loss % (`sl`)
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={sl}
                onChange={(e) => setSl(e.target.value)}
                className="mono"
                style={{
                  width: '100%',
                  background: 'rgba(255,51,102,0.06)',
                  border: '1px solid rgba(255,51,102,0.3)',
                  borderRadius: '8px',
                  padding: '10px 78px 10px 12px',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
              <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <button
                  type="button"
                  onClick={() => setSl((prev) => Math.max(0.5, +(parseFloat(prev || 0) - 0.5).toFixed(1)))}
                  title="Decrease Stop-Loss (-0.5%)"
                  style={{
                    background: 'rgba(255,51,102,0.15)',
                    border: '1px solid rgba(255,51,102,0.35)',
                    borderRadius: '4px',
                    color: 'var(--accent-red)',
                    width: '18px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                  }}
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setSl((prev) => Math.min(50, +(parseFloat(prev || 0) + 0.5).toFixed(1)))}
                  title="Increase Stop-Loss (+0.5%)"
                  style={{
                    background: 'rgba(255,51,102,0.15)',
                    border: '1px solid rgba(255,51,102,0.35)',
                    borderRadius: '4px',
                    color: 'var(--accent-red)',
                    width: '18px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                  }}
                >
                  +
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', fontWeight: 800, paddingLeft: '2px' }}>
                  %
                </span>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-green)', display: 'block', marginBottom: '6px' }}>
              🎯 Take-Profit % (`tp`)
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="number"
                step="0.5"
                min="1"
                max="100"
                value={tp}
                onChange={(e) => setTp(e.target.value)}
                className="mono"
                style={{
                  width: '100%',
                  background: 'rgba(0,255,136,0.06)',
                  border: '1px solid rgba(0,255,136,0.3)',
                  borderRadius: '8px',
                  padding: '10px 78px 10px 12px',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
              <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <button
                  type="button"
                  onClick={() => setTp((prev) => Math.max(1, +(parseFloat(prev || 0) - 0.5).toFixed(1)))}
                  title="Decrease Take-Profit (-0.5%)"
                  style={{
                    background: 'rgba(0,255,136,0.15)',
                    border: '1px solid rgba(0,255,136,0.35)',
                    borderRadius: '4px',
                    color: 'var(--accent-green)',
                    width: '18px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                  }}
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setTp((prev) => Math.min(100, +(parseFloat(prev || 0) + 0.5).toFixed(1)))}
                  title="Increase Take-Profit (+0.5%)"
                  style={{
                    background: 'rgba(0,255,136,0.15)',
                    border: '1px solid rgba(0,255,136,0.35)',
                    borderRadius: '4px',
                    color: 'var(--accent-green)',
                    width: '18px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                  }}
                >
                  +
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: 800, paddingLeft: '2px' }}>
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ADVANCED AGENT CONTROLS: TRAILING SL & MAX TRADES CAMPAIGN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 12px' }}>
          {/* Trailing Stop Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.76rem', color: '#fff', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={trailingStop}
              onChange={(e) => setTrailingStop(e.target.checked)}
              style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--accent-cyan)' }}
            />
            <span style={{ color: trailingStop ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
              📈 Trailing SL (Ratchet)
            </span>
          </label>

          {/* Max Trades Campaign Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Trades:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '2px 4px' }}>
              <button
                type="button"
                onClick={() => setMaxTrades((prev) => Math.max(1, prev - 1))}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px', fontWeight: 800 }}
              >
                -
              </button>
              <span className="mono" style={{ fontSize: '0.8rem', minWidth: '16px', textAlign: 'center', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                {maxTrades}
              </span>
              <button
                type="button"
                onClick={() => setMaxTrades((prev) => Math.min(10, prev + 1))}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px', fontWeight: 800 }}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* LIVE JSON PAYLOAD PREVIEW */}
        <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Terminal size={12} color="var(--accent-cyan)" /> Live Agent JSON Payload:
            </span>
            <button
              type="button"
              onClick={copyCurl}
              style={{ background: 'none', border: 'none', color: copied ? 'var(--accent-green)' : 'var(--accent-cyan)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy cURL'}
            </button>
          </div>
          <pre className="mono" style={{ fontSize: '0.72rem', color: '#00f0ff', margin: 0, overflowX: 'auto', lineHeight: '1.4' }}>
            {JSON.stringify(currentPayload, null, 2)}
          </pre>
        </div>

        {/* NEAR INTENTS / 1-CLICK SOLVER PROTOCOL CARD */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(0,240,255,0.06) 0%, rgba(0,255,136,0.03) 100%)',
            border: '1px solid rgba(0,240,255,0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>
                NEAR Intents (1-Click Defuse)
              </span>
            </div>
            <button
              type="button"
              onClick={handleFetchIntentQuote}
              disabled={fetchingQuote}
              style={{
                background: 'rgba(0,240,255,0.15)',
                border: '1px solid rgba(0,240,255,0.3)',
                borderRadius: '5px',
                padding: '2px 8px',
                color: '#00f0ff',
                fontSize: '0.65rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {fetchingQuote ? <RefreshCw size={10} className="spin" /> : <RefreshCw size={10} />}
              {fetchingQuote ? 'Querying Solvers...' : 'Preview Solver Quote'}
            </button>
          </div>

          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Atomic solver auction executes swap off-chain with <strong>Zero-MEV</strong> and guaranteed return to:
            <div className="mono" style={{ color: 'var(--accent-green)', fontWeight: 700, marginTop: '2px', wordBreak: 'break-all' }}>
              refundTo: {wallet}
            </div>
          </div>

          {intentPreview && (
            <div
              style={{
                marginTop: '4px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(0,255,136,0.25)',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '0.68rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Solver Quote ID:</span>
                <span className="mono" style={{ color: '#00f0ff' }}>{intentPreview.quoteId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Estimated Output:</span>
                <span className="mono" style={{ color: '#00ff88', fontWeight: 800 }}>
                  ~{intentPreview.destination.estimatedAmountOut} {intentPreview.destination.symbol}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Settlement Speed:</span>
                <span className="mono" style={{ color: '#fff' }}>{intentPreview.routing.settlementSpeed}</span>
              </div>
            </div>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #00f0ff 0%, #00ff88 100%)',
              color: '#07090e',
              fontWeight: 900,
              fontSize: '0.9rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)',
            }}
          >
            {isSubmitting ? <Loader2 size={16} className="spin" /> : <Play size={16} fill="#07090e" />}
            ⚡ Dispatch Agent Payload (POST /api/agent/trade)
          </button>

          {isInPosition && (
            <button
              type="button"
              onClick={handleExit}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,51,102,0.4)',
                background: 'rgba(255,51,102,0.15)',
                color: 'var(--accent-red)',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Square size={14} fill="var(--accent-red)" />
              🛑 Close Position & Return Funds (POST /api/agent/exit)
            </button>
          )}
        </div>

        {/* Feedback message */}
        {responseMsg && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              background: responseMsg.success ? 'rgba(0,255,136,0.1)' : 'rgba(255,51,102,0.1)',
              border: `1px solid ${responseMsg.success ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)'}`,
              color: responseMsg.success ? 'var(--accent-green)' : 'var(--accent-red)',
            }}
          >
            {responseMsg.text}
          </div>
        )}

        {/* Security / Return Guarantee Note */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <ShieldCheck size={16} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            <strong style={{ color: '#fff' }}>No Wallet Connect:</strong> Designed for autonomous AI callers. When SL or TP triggers, remaining capital & profits are returned directly on-chain to the specified <span className="mono" style={{ color: '#00ff88' }}>wallet</span>.
          </div>
        </div>
      </form>
    </div>
  );
}
