// apps/trader-ui/src/components/BottomTabs.jsx
import React, { useState } from 'react';
import { ClipboardList, BarChart2, Terminal } from 'lucide-react';
import ActiveOrdersTable from './ActiveOrdersTable';
import TradeHistory from './TradeHistory';
import AgentTerminal from './AgentTerminal';

export default function BottomTabs({ positions, currentPrice, trades, logs, onClosePosition }) {
  const [active, setActive] = useState(0);

  const tabs = [
    {
      icon: <ClipboardList size={13} />,
      label: 'Active Orders',
      badge: positions?.length || 0,
      tooltip: 'View all concurrent open orders with live mark-to-market PnL and individual Close buttons',
    },
    {
      icon: <BarChart2 size={13} />,
      label: 'Settled History',
      badge: trades?.length || 0,
      tooltip: 'Audited ledger of settled trades with on-chain NEAR receipt proofs',
    },
    {
      icon: <Terminal size={13} />,
      label: 'Node Logs',
      badge: logs?.length || 0,
      tooltip: 'Real-time execution & solver audit trail streaming from the backend trading node',
    },
  ];

  return (
    <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-input)', flexShrink: 0 }}>
        {tabs.map((tab, i) => {
          const isActive = active === i;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              title={tab.tooltip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                background: 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-main)',
                marginBottom: '-1px',
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isActive ? 'var(--accent-blue)' : 'var(--bg-input)',
                  border: isActive ? 'none' : '1px solid var(--border-subtle)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  minWidth: '18px',
                  textAlign: 'center',
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Fixed-Height Viewport (Rock-solid 270px container with internal scrolling) */}
      <div style={{
        height: '270px',
        maxHeight: '270px',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
        {active === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <ActiveOrdersTable
              positions={positions}
              currentPrice={currentPrice}
              onClosePosition={onClosePosition}
            />
          </div>
        )}
        {active === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '10px 12px' }}>
            <TradeHistory trades={trades} />
          </div>
        )}
        {active === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '10px 14px' }}>
            <AgentTerminal logs={logs} />
          </div>
        )}
      </div>
    </div>
  );
}
