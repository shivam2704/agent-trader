// apps/trader-ui/src/components/TradeHistory.jsx
import React from 'react';
import { History, ExternalLink } from 'lucide-react';

export default function TradeHistory({ trades = [] }) {
  if (trades.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        No settled positions. Closed trades with on-chain receipts appear here.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <History size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>SETTLED POSITION LEDGER</span>
        </div>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{trades.length} records</span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Side</th>
            <th>Size</th>
            <th>Entry → Exit</th>
            <th>Realized PnL</th>
            <th>Returned To</th>
            <th>Protocol Fee</th>
            <th>Trigger</th>
            <th>On-Chain Proof</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const isProfit = t.pnlPercent >= 0;
            const triggerLabel = t.reason === 'EMERGENCY_SL'
              ? 'Stop-Loss'
              : t.reason === 'TAKE_PROFIT'
              ? 'Take-Profit'
              : t.reason === 'AGENT_REQUESTED_CLOSE'
              ? 'API Close'
              : t.reason || 'Closed';

            return (
              <tr key={t.id}>
                <td>
                  <span style={{
                    padding: '2px 7px', borderRadius: '3px', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.03em',
                    background: t.side === 'LONG' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
                    color: t.side === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)',
                  }}>
                    {t.side}
                  </span>
                </td>
                <td><span className="mono">{t.sizeNear} Ⓝ</span></td>
                <td><span className="mono" style={{ color: 'var(--text-secondary)' }}>${t.entryPrice?.toFixed(3)} → ${t.exitPrice?.toFixed(3)}</span></td>
                <td>
                  <span className="mono" style={{ fontWeight: 700, color: isProfit ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {isProfit ? '+' : ''}{t.pnlPercent}%
                  </span>
                </td>
                <td>
                  <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                    {t.returnedNear !== undefined ? `${t.returnedNear} Ⓝ` : `${t.sizeNear} Ⓝ`}
                  </div>
                  <div className="mono" style={{ fontSize: '0.63rem', color: 'var(--text-muted)' }}>
                    {t.returnWallet ? (t.returnWallet.length > 20 ? t.returnWallet.slice(0, 18) + '…' : t.returnWallet) : '--'}
                  </div>
                </td>
                <td>
                  <span className="mono" style={{ color: 'var(--accent-amber)' }}>
                    {t.feePaidNear !== undefined ? `${t.feePaidNear} Ⓝ` : '—'}
                  </span>
                </td>
                <td>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 600, padding: '2px 6px', borderRadius: '3px',
                    background: t.reason === 'EMERGENCY_SL' ? 'var(--accent-red-dim)' : 'rgba(255,255,255,0.05)',
                    color: t.reason === 'EMERGENCY_SL' ? 'var(--accent-red)' : 'var(--text-secondary)',
                  }}>
                    {triggerLabel}
                  </span>
                </td>
                <td>
                  {t.explorerUrl ? (
                    <a href={t.explorerUrl} target="_blank" rel="noreferrer"
                      style={{ color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontSize: '0.72rem' }}>
                      Tx Hash <ExternalLink size={9} />
                    </a>
                  ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
