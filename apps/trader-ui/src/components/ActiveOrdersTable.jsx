// apps/trader-ui/src/components/ActiveOrdersTable.jsx
import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, Layers } from 'lucide-react';

function PnlBadge({ entryPrice, currentPrice, size }) {
  if (!entryPrice || !currentPrice) return <span style={{ color: 'var(--text-muted)' }}>--</span>;
  const pct = ((currentPrice - entryPrice) / entryPrice) * 100;
  const nearPnl = size ? ((currentPrice - entryPrice) / entryPrice) * size : null;
  const isPos = pct >= 0;
  return (
    <span style={{ color: isPos ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
      {isPos ? '+' : ''}{pct.toFixed(2)}%
      {nearPnl !== null && (
        <span style={{ fontSize: '0.68rem', marginLeft: '5px', opacity: 0.7 }}>
          ({isPos ? '+' : ''}{nearPnl.toFixed(3)}Ⓝ)
        </span>
      )}
    </span>
  );
}

export default function ActiveOrdersTable({ positions = [], currentPrice, onClosePosition }) {
  const [closingId, setClosingId] = useState(null);

  const handleClose = async (pos) => {
    if (closingId) return;
    setClosingId(pos.orderId);
    try {
      await onClosePosition(pos.returnWallet || pos.wallet, pos.orderId, 'MANUAL_CLOSE_UI');
    } catch (e) {
      console.error('Close failed:', e);
    } finally {
      setClosingId(null);
    }
  };

  if (!positions || positions.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '10px' }}>
        <Layers size={28} color="var(--text-muted)" strokeWidth={1.2} />
        <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No active positions.
        </p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.6 }}>
          Send an agent payload via API to open a trade.
        </p>
      </div>
    );
  }

  const fmt = (p) => {
    if (p == null) return '--';
    if (p >= 100) return `$${p.toFixed(2)}`;
    return `$${p.toFixed(4)}`;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Token</th>
            <th>Size (Ⓝ)</th>
            <th>Entry</th>
            <th>Current</th>
            <th>SL Floor</th>
            <th>TP Ceiling</th>
            <th>Live PnL</th>
            <th>Return Wallet</th>
            <th style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const price = currentPrice || pos.entryPrice;
            const slPrice = pos.entryPrice ? pos.entryPrice * (1 + (pos.stopLossPercent || -5) / 100) : null;
            const tpPrice = pos.entryPrice ? pos.entryPrice * (1 + (pos.takeProfitPercent || 10) / 100) : null;
            const isClosing = closingId === pos.orderId;

            return (
              <tr key={pos.orderId}>
                <td>
                  <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent-blue)' }}>
                    {pos.orderId ? pos.orderId.slice(0, 10) + '…' : '--'}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {pos.token || pos.tokenSymbol || 'NEAR'}
                  </span>
                </td>
                <td>
                  <span className="mono">{pos.allocationNear?.toFixed(3) || pos.amount?.toFixed(3) || '--'}</span>
                </td>
                <td>
                  <span className="mono" style={{ color: 'var(--text-secondary)' }}>{fmt(pos.entryPrice)}</span>
                </td>
                <td>
                  <span className="mono" style={{ color: 'var(--text-primary)' }}>{fmt(price)}</span>
                </td>
                <td>
                  <span className="mono" style={{ color: 'var(--accent-red)', opacity: 0.85 }}>{fmt(slPrice)}</span>
                </td>
                <td>
                  <span className="mono" style={{ color: 'var(--accent-green)', opacity: 0.85 }}>{fmt(tpPrice)}</span>
                </td>
                <td>
                  <PnlBadge
                    entryPrice={pos.entryPrice}
                    currentPrice={price}
                    size={pos.allocationNear || pos.amount}
                  />
                </td>
                <td>
                  <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {pos.returnWallet || pos.wallet
                      ? (pos.returnWallet || pos.wallet).length > 18
                        ? (pos.returnWallet || pos.wallet).slice(0, 16) + '…'
                        : (pos.returnWallet || pos.wallet)
                      : '--'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => handleClose(pos)}
                    disabled={isClosing}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '5px',
                      border: '1px solid rgba(239,68,68,0.35)',
                      background: isClosing ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.1)',
                      color: 'var(--accent-red)',
                      cursor: isClosing ? 'not-allowed' : 'pointer',
                      opacity: isClosing ? 0.6 : 1,
                      transition: 'all 0.15s',
                      fontFamily: 'var(--font-main)',
                    }}
                  >
                    <X size={11} strokeWidth={2.5} />
                    {isClosing ? 'Closing…' : 'Close'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
