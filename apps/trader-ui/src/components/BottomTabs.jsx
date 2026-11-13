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
    },
    {
      icon: <BarChart2 size={13} />,
      label: 'Settled History',
    },
    {
      icon: <Terminal size={13} />,
      label: 'Node Logs',
    },
  ];

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
        {tabs.map((tab, i) => {
          const isActive = active === i;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
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
                  background: 'var(--accent-blue)',
                  color: '#fff',
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

      {/* Tab content */}
      <div style={{ minHeight: '240px' }}>
        {active === 0 && (
          <ActiveOrdersTable
            positions={positions}
            currentPrice={currentPrice}
            onClosePosition={onClosePosition}
          />
        )}
        {active === 1 && (
          <div style={{ padding: '12px' }}>
            <TradeHistory trades={trades} />
          </div>
        )}
        {active === 2 && (
          <div style={{ padding: '12px' }}>
            <AgentTerminal logs={logs} />
          </div>
        )}
      </div>
    </div>
  );
}
