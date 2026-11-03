// frontend/src/components/PositionCard.jsx
import React from 'react';
import { ShieldCheck, Crosshair, ArrowUpRight, ArrowDownRight, ExternalLink, AlertTriangle } from 'lucide-react';

export default function PositionCard({ position, config, agentStatus }) {
  const inPosition = position?.inPosition;
  const isHalted = agentStatus === 'CIRCUIT_BREAKER_HALTED';

  if (!inPosition) {
    return (
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center', alignItems: 'center' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: isHalted ? 'rgba(255,51,102,0.1)' : 'rgba(0,240,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isHalted ? (
            <AlertTriangle size={24} color="var(--accent-red)" />
          ) : (
            <Crosshair size={24} color="var(--accent-cyan)" />
          )}
        </div>

        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            {isHalted ? 'Circuit Breaker Active (Capital Safeguarded)' : 'No Open Positions (Ready for Agent API Payload)'}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '380px' }}>
            {isHalted
              ? 'Emergency Stop-Loss executed. Remaining funds returned on-chain to caller wallet.'
              : 'ZeroDrain AI execution node is listening for incoming agent payloads via POST /api/agent/trade.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,255,136,0.05)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.2)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Return Wallet:</span>
            <strong className="mono" style={{ fontSize: '0.8rem', color: config.wallet ? '#00ff88' : 'var(--text-muted)' }}>
              {config.wallet || 'Awaiting Agent Payload...'}
            </strong>
          </div>
          <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', justifyContent: 'space-around' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Pair: <strong style={{ color: '#fff' }}>{config.tokenPair}</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Max Risk: <strong style={{ color: 'var(--accent-red)' }}>{config.stopLossPercent}%</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Target Exit: <strong style={{ color: 'var(--accent-green)' }}>+{config.takeProfitPercent}%</strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isProfit = position.pnlPercent >= 0;
  const pnlColor = isProfit ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div className="glass-panel glass-glow-cyan" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Position Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: position.side === 'LONG' ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,102,0.15)',
              color: position.side === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)',
              border: `1px solid ${position.side === 'LONG' ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)'}`,
            }}
          >
            ACTIVE {position.side} POSITION
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }} className="mono">{position.sizeNear} NEAR</span>
        </div>

        {position.explorerUrl && (
          <a
            href={position.explorerUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}
          >
            Nearblocks Tx <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Dynamic PnL Banner */}
      <div style={{ background: isProfit ? 'rgba(0,255,136,0.06)' : 'rgba(255,51,102,0.06)', border: `1px solid ${isProfit ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,102,0.2)'}`, borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live Mark-To-Market PnL
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="mono" style={{ fontSize: '1.8rem', fontWeight: 900, color: pnlColor }}>
              {isProfit ? `+${position.pnlPercent}%` : `${position.pnlPercent}%`}
            </span>
            <span className="mono" style={{ fontSize: '1rem', fontWeight: 600, color: pnlColor }}>
              ({isProfit ? `+$${position.pnlUsd}` : `-$${Math.abs(position.pnlUsd)}`})
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Entry / Current</span>
          <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            ${position.entryPrice?.toFixed(3)} ➔ <strong style={{ color: '#fff' }}>${position.currentPrice?.toFixed(3)}</strong>
          </div>
        </div>
      </div>

      {/* Protective Guardrails Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: 'rgba(255,51,102,0.04)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,51,102,0.2)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-red)', fontWeight: 700 }}>Hard SL Trigger At</span>
          <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
            {config.stopLossPercent}%
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Auto-liquidates & returns funds</span>
        </div>

        <div style={{ background: 'rgba(0,255,136,0.04)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.2)' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 700 }}>Take-Profit Target</span>
          <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
            +{config.takeProfitPercent}%
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Auto-converts gains & returns</span>
        </div>
      </div>

      {/* Return Wallet Banner */}
      <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>On-Chain Return Wallet:</span>
        <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 800 }}>
          {config.wallet || config.accountId || 'client_agent.testnet'}
        </span>
      </div>
    </div>
  );
}
