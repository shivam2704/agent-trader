// frontend/src/components/TradeHistory.jsx
import React from 'react';
import { History, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';

export default function TradeHistory({ trades = [] }) {
  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Settled Trade History & Performance</h3>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{trades.length} Trades Executed</span>
      </div>

      {trades.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          No settled trades yet. Agent will record closed positions here once take-profit or stop-loss triggers.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '8px 10px' }}>Side</th>
                <th style={{ padding: '8px 10px' }}>Size</th>
                <th style={{ padding: '8px 10px' }}>Entry ➔ Exit</th>
                <th style={{ padding: '8px 10px' }}>Realized PnL</th>
                <th style={{ padding: '8px 10px' }}>Returned To Wallet</th>
                <th style={{ padding: '8px 10px' }}>Fee (NEAR)</th>
                <th style={{ padding: '8px 10px' }}>Reason</th>
                <th style={{ padding: '8px 10px' }}>On-Chain Proof</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const isProfit = t.pnlPercent >= 0;
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: t.side === 'LONG' ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,102,0.15)',
                          color: t.side === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)',
                        }}
                      >
                        {t.side}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }} className="mono">{t.sizeNear} NEAR</td>
                    <td style={{ padding: '10px' }} className="mono">
                      ${t.entryPrice?.toFixed(3)} ➔ ${t.exitPrice?.toFixed(3)}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <strong
                        className="mono"
                        style={{ color: isProfit ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 800 }}
                      >
                        {isProfit ? `+${t.pnlPercent}%` : `${t.pnlPercent}%`}
                      </strong>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div className="mono" style={{ fontSize: '0.72rem', color: '#00ff88', fontWeight: 700 }}>
                        {t.returnedNear !== undefined ? `${t.returnedNear} NEAR` : `${t.sizeNear} NEAR`}
                      </div>
                      <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        ➔ {t.returnWallet || '--'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }} className="mono">
                      <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>
                        {t.feePaidNear !== undefined ? `${t.feePaidNear} NEAR` : '0.0000 NEAR'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontSize: '0.7rem', color: t.reason === 'EMERGENCY_SL' ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                        {t.reason === 'EMERGENCY_SL' ? '🛑 SL Breached' : t.reason === 'AGENT_REQUESTED_CLOSE' ? '🤖 Agent API Close' : '🎯 Take Profit'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {t.explorerUrl && (
                        <a
                          href={t.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                        >
                          Tx Hash <ExternalLink size={10} />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
