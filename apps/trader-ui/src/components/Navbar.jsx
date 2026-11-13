// apps/trader-ui/src/components/Navbar.jsx
import React, { useState } from 'react';
import { Activity, Cpu, Check, Copy, ShieldCheck, ExternalLink, BookOpen, Radio, Sun, Moon } from 'lucide-react';

export default function Navbar({ marketPrice, marketSymbol, agentStatus, targetWallet, feeStats, theme, onToggleTheme }) {
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
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
      }}
    >
      {/* ── LEFT CLUSTER: Brand + Live Market Ticker + Status ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={16} color="var(--accent-blue)" strokeWidth={2} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              ZeroDrain<span style={{ color: 'var(--accent-blue)' }}>.AI</span>
            </span>
            <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '3px', background: 'var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 600 }}>
              TESTNET
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

        {/* Live Market Spot Ticker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
          <Activity size={13} color="var(--accent-blue)" />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{marketSymbol || 'NEAR'}/USD</span>
          <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {fmtPrice(marketPrice)}
          </span>
        </div>

        {/* Operational Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 9px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
          {isActive || isHalted ? (
            <div className={isHalted ? 'pulse-dot-red' : 'pulse-dot'} />
          ) : (
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)' }} />
          )}
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: statusColor, letterSpacing: '0.04em' }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* ── RIGHT CLUSTER: Metrics + Actions + Docs + Theme ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Cumulative Protocol Gas Fees */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }} title="Cumulative Gas + Protocol Execution Fees">
          <span style={{ fontSize: '0.72rem' }}>⛽</span>
          <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontWeight: 600 }}>
            {feeStats?.totalFeesPaidNear?.toFixed(4) || '0.0000'} Ⓝ
          </span>
        </div>

        {/* Active Return Wallet (if present) */}
        {targetWallet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)' }}>
            <Radio size={11} color="var(--accent-green)" />
            <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 600 }}>
              {targetWallet.length > 18 ? targetWallet.slice(0, 16) + '…' : targetWallet}
            </span>
          </div>
        )}

        {/* Divider */}
        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 2px' }} />

        {/* Smart Contract Vault */}
        <a
          href="https://testnet.nearblocks.io/address/zerodrain-relayer-vault.testnet"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s' }}
        >
          <ShieldCheck size={13} />
          Contract
          <ExternalLink size={10} />
        </a>

        {/* Swagger / OpenAPI Docs */}
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s' }}
        >
          <BookOpen size={13} />
          Docs
        </a>

        {/* cURL Copy */}
        <button
          onClick={copyCurl}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${copied ? 'var(--accent-green)' : 'var(--border-subtle)'}`, background: copied ? 'var(--accent-green-dim)' : 'transparent', color: copied ? 'var(--accent-green)' : 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'cURL'}
        </button>

        {/* Dark / Light Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="theme-toggle"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
