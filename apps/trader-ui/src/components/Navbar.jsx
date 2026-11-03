// frontend/src/components/Navbar.jsx
import React, { useState } from 'react';
import { Activity, Cpu, Bot, Check, Copy, ArrowRightLeft, Radio, ShieldCheck, ExternalLink } from 'lucide-react';

export default function Navbar({
  marketPrice,
  marketSymbol,
  agentStatus,
  targetWallet,
  feeStats,
}) {
  const [copied, setCopied] = useState(false);

  const isAgentActive = agentStatus === 'SCANNING' || agentStatus === 'IN_POSITION';
  const isHalted = agentStatus === 'CIRCUIT_BREAKER_HALTED';

  const copyCurl = () => {
    const curl = `curl -X POST http://localhost:4000/api/agent/trade \\
  -H "Content-Type: application/json" \\
  -d '{"sl": 5.0, "tp": 10.0, "token": "wrap.testnet", "amount": 3.0, "wallet": "client_agent_vault.testnet"}'`;
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="glass-panel" style={{ margin: '16px 20px', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
      {/* Brand & Headless Agent API Tagline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #00f0ff 0%, #7928ca 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(0,240,255,0.4)' }}>
          <Cpu size={24} color="#000" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff 0%, #00f0ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ZeroDrain AI
            </h1>
            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '20px', background: 'rgba(0, 240, 255, 0.12)', color: '#00f0ff', border: '1px solid rgba(0, 240, 255, 0.3)', fontWeight: 800, letterSpacing: '0.05em' }}>
              HEADLESS AGENT API
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Programmatic Trading Execution Service for AI Agents • Return Settled Directly to Caller Wallet
          </p>
        </div>
      </div>

      {/* Live Market & Agent Status Center */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {/* Live Asset Spot Price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '6px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <Activity size={16} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{marketSymbol || 'NEAR'}/USD Spot:</span>
          <span className="mono" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {marketPrice ? `$${marketPrice >= 100 ? marketPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : marketPrice.toFixed(4)}` : '--'}
          </span>
        </div>

        {/* Fees Paid Tracking Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,170,0,0.06)', padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(255,170,0,0.3)' }} title="Cumulative Gas Burnt + 0.15% Protocol Execution Fee">
          <span style={{ fontSize: '1rem' }}>⛽</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontWeight: 600 }}>Fees Paid:</span>
              <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
                {feeStats?.totalFeesPaidNear !== undefined ? `${feeStats.totalFeesPaidNear.toFixed(4)} NEAR` : '0.0000 NEAR'}
              </span>
            </div>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block' }}>
              (0.15% Protocol + Gas)
            </span>
          </div>
        </div>

        {/* Agent Operational Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isHalted ? 'rgba(255,51,102,0.12)' : isAgentActive ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)', padding: '6px 14px', borderRadius: '10px', border: `1px solid ${isHalted ? 'rgba(255,51,102,0.4)' : isAgentActive ? 'rgba(0,255,136,0.3)' : 'var(--border-subtle)'}` }}>
          <div className={isHalted ? 'pulse-dot-red' : isAgentActive ? 'pulse-dot' : ''} style={!isAgentActive && !isHalted ? { width: '8px', height: '8px', borderRadius: '50%', background: '#64748b' } : {}} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isHalted ? 'var(--accent-red)' : isAgentActive ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
            {isHalted ? 'CIRCUIT BREAKER HALTED' : isAgentActive ? (agentStatus === 'IN_POSITION' ? 'IN POSITION (PROTECTED)' : 'AGENT SCANNING 24/7') : 'API SERVICE READY'}
          </span>
        </div>

        {/* Target Caller Wallet / Return Destination */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'linear-gradient(135deg, rgba(13,18,28,0.95) 0%, rgba(20,29,48,0.95) 100%)',
            padding: '6px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(0,240,255,0.3)',
          }}
        >
          <Bot size={18} color="var(--accent-cyan)" />
          <div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowRightLeft size={10} color="var(--accent-green)" /> Return Target Wallet
            </span>
            <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 800, color: targetWallet ? '#00ff88' : 'var(--text-muted)' }}>
              {targetWallet || 'Awaiting Agent Session...'}
            </div>
          </div>
        </div>

        {/* On-Chain Smart Contract Vault Pill */}
        <a
          href="https://testnet.nearblocks.io/address/zerodrain-relayer-vault.testnet"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(121, 40, 202, 0.12)',
            padding: '6px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(121, 40, 202, 0.35)',
            textDecoration: 'none',
            color: '#c084fc',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="Audited NEAR Protocol Smart Contract: Non-Custodial Vault & Circuit Breaker"
        >
          <ShieldCheck size={16} color="#c084fc" />
          <div>
            <span style={{ fontSize: '0.62rem', color: '#e9d5ff', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Smart Contract Vault <ExternalLink size={9} />
            </span>
            <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
              zerodrain-relayer-vault.testnet
            </span>
          </div>
        </a>

        {/* Copy cURL Quick Action */}
        <button
          type="button"
          onClick={copyCurl}
          title="Copy Agent API cURL Payload"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: copied ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${copied ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
            color: copied ? 'var(--accent-green)' : '#fff',
            borderRadius: '8px',
            padding: '7px 12px',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied cURL!' : 'API cURL'}
        </button>
      </div>
    </header>
  );
}
