// apps/trader-ui/src/components/Navbar.jsx
import React, { useState } from 'react';
import { Activity, Cpu, Check, Copy, ShieldCheck, ExternalLink, BookOpen, Radio } from 'lucide-react';

export default function Navbar({ marketPrice, marketSymbol, agentStatus, targetWallet, feeStats }) {
  const [copied, setCopied] = useState(false);

  const isActive = agentStatus === 'SCANNING' || agentStatus === 'IN_POSITION';
  const isHalted = agentStatus === 'CIRCUIT_BREAKER_HALTED';

  const statusColor = isHalted ? 'var(--accent-red)' : isActive ? 'var(--accent-green)' : 'var(--text-muted)';
  const statusLabel = isHalted
    ? 'CIRCUIT BREAKER'
    : agentStatus === 'IN_POSITION'
    ? 'IN POSITION'
    : isActive
    ? 'SCANNING'
    : 'READY';

  const copyCurl = () => {
    const curl = `curl -X POST https://zerodrain-agent-trader.onrender.com/api/agent/trade \\
  -H "Content-Type: application/json" \\
  -d '{"sl":5.0,"tp":10.0,"token":"wrap.testnet","amount":3.0,"wallet":"client_agent_vault.testnet"}'`;
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtPrice = (p) => {
    if (!p) return '--';
    return p >= 100
      ? `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${p.toFixed(4)}`;
  };

  return (
    <header
      style={{
        margin: '12px 16px',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'rgba(13,17,23,0.95)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#1e293b', border: '1px solid var(--border-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Cpu size={18} color="var(--accent-blue)" strokeWidth={2} />
        </div>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            ZeroDrain <span style={{ color: 'var(--accent-blue)' }}>AI</span>
          </h1>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
            Programmatic Trading · NEAR Protocol
          </p>
        </div>
      </div>

      {/* Center — price + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Spot price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
          <Activity size={13} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{marketSymbol || 'NEAR'}/USD</span>
          <span className="mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {fmtPrice(marketPrice)}
          </span>
        </div>

        {/* Agent status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
          {isActive || isHalted ? (
            <div className={isHalted ? 'pulse-dot-red' : 'pulse-dot'} />
          ) : (
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--text-muted)' }} />
          )}
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: statusColor, letterSpacing: '0.03em' }}>
            {statusLabel}
          </span>
        </div>

        {/* Fees */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }} title="Total protocol fees paid (gas + 0.15%)">
          <span style={{ fontSize: '0.78rem' }}>⛽</span>
          <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent-amber)', fontWeight: 600 }}>
            {feeStats?.totalFeesPaidNear?.toFixed(4) || '0.0000'} Ⓝ
          </span>
        </div>

        {/* Return wallet (truncated) */}
        {targetWallet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
            <Radio size={12} color="var(--accent-green)" />
            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-green)' }}>
              {targetWallet.length > 20 ? targetWallet.slice(0, 18) + '…' : targetWallet}
            </span>
          </div>
        )}
      </div>

      {/* Right — links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Smart contract */}
        <a
          href="https://testnet.nearblocks.io/address/zerodrain-relayer-vault.testnet"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 11px', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s' }}
        >
          <ShieldCheck size={13} />
          Contract
          <ExternalLink size={10} />
        </a>

        {/* Swagger */}
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 11px', borderRadius: '7px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s' }}
        >
          <BookOpen size={13} />
          API Docs
        </a>

        {/* cURL copy */}
        <button
          onClick={copyCurl}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 11px', borderRadius: '7px', border: `1px solid ${copied ? 'var(--accent-green)' : 'var(--border-subtle)'}`, background: copied ? 'var(--accent-green-dim)' : 'transparent', color: copied ? 'var(--accent-green)' : 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-main)' }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'cURL'}
        </button>
      </div>
    </header>
  );
}
