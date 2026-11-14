// frontend/src/components/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import { Bot, Cpu, Play, Square, Copy, Check, Terminal, ShieldCheck, ArrowRightLeft, Coins, CheckCircle2, XCircle, Loader2, Zap, ExternalLink, RefreshCw } from 'lucide-react';

export default function AdminPanel({
  config,
  marketSymbol,
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
  const [copiedToken, setCopiedToken] = useState(false);
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

  // Auto-sync token when user switches active market coin on chart
  useEffect(() => {
    if (config?.tokenPair) {
      setToken(config.tokenPair);
    }
  }, [config?.tokenPair]);

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
    if (!wallet || !wallet.trim()) {
      setResponseMsg({ success: false, text: 'Please enter a Caller Wallet address first to preview Intent quote.' });
      return;
    }
    setFetchingQuote(true);
    try {
      const res = await fetch('/api/intents/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originToken: 'wrap.testnet',
          destinationToken: token.trim() || 'wrap.testnet',
          amount: parseFloat(amount) || 1.0,
          wallet: wallet.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.quote) {
        setIntentPreview(data.quote);
      } else if (data.error) {
        setResponseMsg({ success: false, text: data.error });
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

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token.trim());
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const isInPosition = agentStatus === 'IN_POSITION';

  return (
    <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <Cpu size={18} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>Intent Gateway</h2>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }} className="mono">POST /api/agent/trade</span>
          </div>
        </div>
        <span
          title="NEAR Intents Protocol v1.2 with Scoped Session Execution"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            fontSize: '0.65rem',
            background: 'var(--accent-blue-dim)',
            color: 'var(--accent-blue)',
            padding: '3px 7px',
            borderRadius: '4px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          INTENTS v1.2
        </span>
      </div>

      <form onSubmit={handleDispatch} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
        {/* FIELD 1: WALLET (Return Destination) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRightLeft size={13} color="var(--accent-green)" />
              Caller Wallet (`wallet`)
            </label>
            <span
              title="Autonomous Return: Capital & profit are guaranteed to return to this address on SL/TP"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontSize: '0.63rem',
                color: 'var(--accent-green)',
                fontWeight: 700,
                background: 'var(--accent-green-dim)',
                padding: '2px 6px',
                borderRadius: '4px',
                lineHeight: 1,
                letterSpacing: '0.03em',
              }}
            >
              AUTO-RETURN
            </span>
          </div>
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="e.g. client_agent_vault.testnet"
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: 'var(--text-base)', outline: 'none' }}
          />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '3px', display: 'block', lineHeight: 1.35 }}>
            When position closes or SL triggers, capital + profit will be sent back to this wallet.
          </span>
        </div>

        {/* FIELD 2: TARGET TOKEN */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Coins size={13} color="var(--accent-blue)" />
              Target Asset (`token`)
            </label>
            <span
              title="Automatically synced with active chart market"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontSize: '0.63rem',
                color: 'var(--accent-blue)',
                fontWeight: 700,
                background: 'var(--accent-blue-dim)',
                padding: '2px 6px',
                borderRadius: '4px',
                lineHeight: 1,
                letterSpacing: '0.03em',
              }}
            >
              SYNCED TO CHART
            </span>
          </div>
          <div
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-primary)' }}>
                {marketSymbol || (token.includes('.') ? token.split('.')[0].toUpperCase() : token)}
              </span>
              <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={token}>
                ({token.length > 18 ? `${token.slice(0, 8)}…${token.slice(-6)}` : token})
              </span>
            </div>
            <button
              type="button"
              onClick={copyToken}
              title={`Copy NEP-141 contract: ${token}`}
              style={{
                background: 'none',
                border: 'none',
                color: copiedToken ? 'var(--accent-green)' : 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              {copiedToken ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '3px', display: 'block', lineHeight: 1.35 }}>
            Auto-synced with active chart coin. Payload automatically uses NEP-141 contract.
          </span>
        </div>

        {/* FIELD 3: AMOUNT */}
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '5px' }}>
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
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '8px 88px 8px 12px',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-base)',
                outline: 'none',
              }}
            />
            <div style={{ position: 'absolute', right: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <button
                type="button"
                onClick={() => setAmount((prev) => Math.max(0.1, +(parseFloat(prev || 0) - 0.5).toFixed(2)))}
                title="Decrease (-0.5 NEAR)"
                style={{
                  background: 'var(--border-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  width: '20px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
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
                  background: 'var(--border-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  width: '20px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                +
              </button>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-blue)', fontWeight: 800, paddingLeft: '4px', userSelect: 'none' }}>
                NEAR
              </span>
            </div>
          </div>
        </div>

        {/* FIELD 4 & 5: STOP LOSS & TAKE PROFIT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--accent-red)', display: 'block', marginBottom: '5px' }}>
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
                  background: 'var(--accent-red-dim)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: '6px',
                  padding: '8px 74px 8px 10px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-base)',
                  outline: 'none',
                }}
              />
              <div style={{ position: 'absolute', right: '6px', display: 'flex', alignItems: 'center', gap: '2px' }}>
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
                    fontSize: 'var(--text-sm)',
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
                    fontSize: 'var(--text-sm)',
                    fontWeight: 800,
                  }}
                >
                  +
                </button>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-red)', fontWeight: 800, paddingLeft: '2px' }}>
                  %
                </span>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--accent-green)', display: 'block', marginBottom: '5px' }}>
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
                  background: 'var(--accent-green-dim)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: '6px',
                  padding: '8px 74px 8px 10px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-base)',
                  outline: 'none',
                }}
              />
              <div style={{ position: 'absolute', right: '6px', display: 'flex', alignItems: 'center', gap: '2px' }}>
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
                    fontSize: 'var(--text-sm)',
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
                    fontSize: 'var(--text-sm)',
                    fontWeight: 800,
                  }}
                >
                  +
                </button>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-green)', fontWeight: 800, paddingLeft: '2px' }}>
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ADVANCED AGENT CONTROLS: TRAILING SL & MAX TRADES CAMPAIGN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px' }}>
          {/* Trailing Stop Toggle */}
          <label
            title="Trailing Stop-Loss: Automatically ratchets stop-loss floor upward as asset reaches new highs"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600, userSelect: 'none' }}
          >
            <input
              type="checkbox"
              checked={trailingStop}
              onChange={(e) => setTrailingStop(e.target.checked)}
              style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--accent-blue)' }}
            />
            <span style={{ color: trailingStop ? 'var(--accent-blue)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              📈 Trailing SL (Ratchet)
            </span>
          </label>

          {/* Max Trades Campaign Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', userSelect: 'none' }} title="Maximum sequential trade iterations before engine pauses">
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Trades:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '2px 4px' }}>
              <button
                type="button"
                onClick={() => setMaxTrades((prev) => Math.max(1, prev - 1))}
                title="Decrease trade count limit"
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--text-sm)', padding: '0 3px', fontWeight: 800 }}
              >
                -
              </button>
              <span className="mono" style={{ fontSize: 'var(--text-sm)', minWidth: '16px', textAlign: 'center', color: 'var(--accent-blue)', fontWeight: 700 }}>
                {maxTrades}
              </span>
              <button
                type="button"
                onClick={() => setMaxTrades((prev) => Math.min(10, prev + 1))}
                title="Increase trade count limit"
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--text-sm)', padding: '0 3px', fontWeight: 800 }}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* LIVE JSON PAYLOAD PREVIEW */}
        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Terminal size={12} color="var(--accent-blue)" /> Live Agent JSON Payload:
            </span>
            <button
              type="button"
              onClick={copyCurl}
              style={{ background: 'none', border: 'none', color: copied ? 'var(--accent-green)' : 'var(--accent-blue)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy cURL'}
            </button>
          </div>
          <pre className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-blue)', margin: 0, overflowX: 'auto', lineHeight: '1.45' }}>
            {JSON.stringify(currentPayload, null, 2)}
          </pre>
        </div>

        {/* NEAR INTENTS / 1-CLICK SOLVER PROTOCOL CARD */}
        <div
          title="Query live Defuse solvers for gasless 1-click atomic swap routing"
          style={{
            background: 'var(--accent-blue-dim)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color="var(--accent-blue)" />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                NEAR Intents (1-Click Defuse)
              </span>
            </div>
            <button
              type="button"
              onClick={handleFetchIntentQuote}
              disabled={fetchingQuote}
              title="Request simulated solver quote for this trade"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '5px',
                padding: '3px 8px',
                color: 'var(--accent-blue)',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RefreshCw size={10} className={fetchingQuote ? 'spin' : ''} />
              {fetchingQuote ? 'Querying Solvers...' : 'Preview Solver Quote'}
            </button>
          </div>

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Atomic solver auction executes swap off-chain with <strong>Zero-MEV</strong> and guaranteed return to:
            <div className="mono" style={{ color: 'var(--accent-green)', fontWeight: 700, marginTop: '2px', wordBreak: 'break-all' }}>
              refundTo: {wallet || 'your_agent_wallet.testnet'}
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
                fontSize: 'var(--text-xs)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Solver Quote ID:</span>
                <span className="mono" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{intentPreview.quoteId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Estimated Output:</span>
                <span className="mono" style={{ color: 'var(--accent-green)', fontWeight: 800 }}>
                  ~{intentPreview.destination.estimatedAmountOut} {intentPreview.destination.symbol}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Settlement Speed:</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{intentPreview.routing.settlementSpeed}</span>
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
              padding: '11px',
              borderRadius: '7px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'var(--accent-blue)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 'var(--text-base)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity 0.15s',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? <Loader2 size={15} className="spin" /> : <Play size={14} fill="#ffffff" />}
            Dispatch Execution Intent (POST /api/agent/trade)
          </button>

          {isInPosition && (
            <button
              type="button"
              onClick={handleExit}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '9px',
                borderRadius: '7px',
                border: '1px solid var(--accent-red)',
                background: 'var(--accent-red-dim)',
                color: 'var(--accent-red)',
                fontWeight: 700,
                fontSize: 'var(--text-sm)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Square size={13} fill="var(--accent-red)" />
              Close Position & Return Funds (POST /api/agent/exit)
            </button>
          )}
        </div>

        {/* Feedback message */}
        {responseMsg && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: 'var(--text-sm)',
              background: responseMsg.success ? 'rgba(0,255,136,0.1)' : 'rgba(255,51,102,0.1)',
              border: `1px solid ${responseMsg.success ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)'}`,
              color: responseMsg.success ? 'var(--accent-green)' : 'var(--accent-red)',
            }}
          >
            {responseMsg.text}
          </div>
        )}

        {/* Security / Return Guarantee Note */}
        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <ShieldCheck size={15} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>No Wallet Connect:</strong> Designed for autonomous AI callers. When SL or TP triggers, remaining capital & profits are returned directly on-chain to the specified <span className="mono" style={{ color: 'var(--accent-green)', fontWeight: 700 }}>wallet</span>.
          </div>
        </div>
      </form>
    </div>
  );
}
