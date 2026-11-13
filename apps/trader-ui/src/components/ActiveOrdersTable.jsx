// apps/trader-ui/src/components/ActiveOrdersTable.jsx
import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, Layers } from 'lucide-react';

function PnlBadge({ entryPrice, currentPrice, size, pnlPercent }) {
  const pct = pnlPercent !== undefined && !isNaN(pnlPercent)
    ? pnlPercent
    : (entryPrice && currentPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0);
  const isPos = pct >= 0;
  const nearPnl = size ? (pct / 100) * size : null;
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

  const fmtTime = (ts) => {
    if (!ts) return '--';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const fmtDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ overflowX: 'auto', cursor: 'default', userSelect: 'none' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th title="Unique session identifier for this programmatic order">Order ID</th>
            <th title="Exact time when the order entered the position">Opened</th>
            <th title="Traded asset symbol or NEP-141 contract">Token</th>
            <th title="Principal capital allocated in NEAR">Size (Ⓝ)</th>
            <th title="Execution fill price at time of entry">Entry</th>
            <th title="Live mark-to-market oracle spot price">Current</th>
            <th title="Stop-loss trigger price threshold">SL Floor</th>
            <th title="Take-profit target price threshold">TP Ceiling</th>
            <th title="Real-time unrealized return percentage and net profit/loss">Live PnL</th>
            <th title="On-chain destination address where capital & profits are returned">Return Wallet</th>
            <th style={{ textAlign: 'right' }} title="Manual close action">Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const price = pos.currentPrice || pos.entryPrice;
            const slPct = pos.sl !== undefined ? pos.sl : (pos.stopLossPercent || -5);
            const tpPct = pos.tp !== undefined ? pos.tp : (pos.takeProfitPercent || 10);
            const slPrice = pos.entryPrice ? pos.entryPrice * (1 + slPct / 100) : null;
            const tpPrice = pos.entryPrice ? pos.entryPrice * (1 + tpPct / 100) : null;
            const isClosing = closingId === pos.orderId;
            const displaySize = pos.sizeNear ?? pos.amount ?? pos.allocationNear;
            const openTime = pos.entryTime || pos.createdAt;

            return (
              <tr key={pos.orderId}>
                <td>
                  <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent-blue)' }}>
                    {pos.orderId ? pos.orderId.slice(0, 10) + '…' : '--'}
                  </span>
                </td>
                <td>
                  <div className="mono" style={{ fontSize: '0.69rem', color: 'var(--text-secondary)' }} title={openTime ? new Date(openTime).toLocaleString() : '--'}>
                    {fmtTime(openTime)}
                  </div>
                  <div className="mono" style={{ fontSize: '0.61rem', color: 'var(--text-muted)' }}>
                    {fmtDate(openTime)}
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {pos.token || pos.tokenSymbol || 'NEAR'}
                  </span>
                </td>
                <td>
                  <span className="mono">{displaySize != null ? Number(displaySize).toFixed(3) : '--'}</span>
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
                    pnlPercent={pos.pnlPercent}
                    size={displaySize}
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
                    title={`Immediately close order ${pos.orderId} and refund principal + profits to ${pos.returnWallet || pos.wallet}`}
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

