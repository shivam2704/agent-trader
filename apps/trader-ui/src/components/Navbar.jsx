// apps/trader-ui/src/components/Navbar.jsx
import React, { useState } from 'react';
import { Activity, Cpu, Check, Copy, ShieldCheck, ExternalLink, BookOpen, Radio, Sun, Moon } from 'lucide-react';

export default function Navbar({ marketPrice, marketSymbol, agentStatus, targetWallet, feeStats, theme, onToggleTheme }) {
  const [copied, setCopied] = useState(false);

  const isHalted = agentStatus === 'CIRCUIT_BREAKER_HALTED';
  const isInPosition = agentStatus === 'IN_POSITION';
  const isScanning = agentStatus === 'SCANNING';

  const statusColor = isHalted
    ? 'var(--accent-red)'
    : 'var(--accent-green)';

  const statusLabel = isHalted
    ? 'CIRCUIT BREAKER'
    : isInPosition
    ? 'IN POSITION'
    : isScanning
    ? 'SCANNING'
    : 'ENGINE ONLINE';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'default', userSelect: 'none' }} title="ZeroDrain AI — Autonomous Non-Custodial Trading Terminal on NEAR Protocol">
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={16} color="var(--accent-blue)" strokeWidth={2} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              ZeroDrain<span style={{ color: 'var(--accent-blue)' }}>.AI</span>
            </span>
            <span style={{ fontSize: 'var(--text-xs)', padding: '1px 5px', borderRadius: '3px', background: 'var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 600 }} title="Running on NEAR Testnet RPC">
              TESTNET
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

        {/* Live Market Spot Ticker */}
        <div
          title={`Live Spot Price: ${marketSymbol || 'NEAR'}/USD aggregated in real time from Kraken & NEAR oracles`}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', cursor: 'default', userSelect: 'none' }}
        >
          <Activity size={13} color="var(--accent-blue)" />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>{marketSymbol || 'NEAR'}/USD</span>
          <span className="mono" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {fmtPrice(marketPrice)}
          </span>
        </div>

        {/* Operational Status */}
        <div
          title={`Engine Status: ${statusLabel}. 24/7 autonomous monitoring with smart contract circuit-breaker protection.`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 9px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', cursor: 'default', userSelect: 'none' }}
        >
          <div className={isHalted ? 'pulse-dot-red' : 'pulse-dot'} />
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: statusColor, letterSpacing: '0.04em' }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* ── RIGHT CLUSTER: Metrics + Actions + Docs + Theme ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Cumulative Protocol Gas Fees */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', cursor: 'default', userSelect: 'none' }} title="Cumulative Protocol Fees (0.15% execution fee + NEAR gas burnt on-chain)">
          <span style={{ fontSize: 'var(--text-xs)' }}>⛽</span>
          <span className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-amber)', fontWeight: 600 }}>
            {feeStats?.totalFeesPaidNear?.toFixed(4) || '0.0000'} Ⓝ
          </span>
        </div>

        {/* Active Return Wallet (if present) */}
        {targetWallet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)', cursor: 'default', userSelect: 'none' }} title={`Active Caller Return Wallet: ${targetWallet}. All trade capital and profits are auto-refunded here.`}>
            <Radio size={11} color="var(--accent-green)" />
            <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-green)', fontWeight: 600 }}>
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
          title="View audited ZeroDrain Vault Smart Contract (zerodrain-relayer-vault.testnet) on NearBlocks Explorer"
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
        >
          <ShieldCheck size={13} color="var(--accent-green)" />
          Vault Contract
          <ExternalLink size={10} />
        </a>

        {/* Swagger / OpenAPI Docs */}
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          title="Open Interactive OpenAPI 3.0 / Swagger Documentation & Live REST Endpoints"
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s' }}
        >
          <BookOpen size={13} />
          Docs
        </a>

        {/* cURL Copy */}
        <button
          onClick={copyCurl}
          title="Copy ready-to-run cURL command to send an automated trade intent from any terminal or AI agent"
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${copied ? 'var(--accent-green)' : 'var(--border-subtle)'}`, background: copied ? 'var(--accent-green-dim)' : 'transparent', color: copied ? 'var(--accent-green)' : 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'cURL'}
        </button>

        {/* Dark / Light Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="theme-toggle"
          style={{ fontSize: 'var(--text-sm)' }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
