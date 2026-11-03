// frontend/src/components/AgentTerminal.jsx
import React, { useRef, useEffect } from 'react';
import { Terminal, ExternalLink, ShieldCheck } from 'lucide-react';

export default function AgentTerminal({ logs = [] }) {
  const terminalEndRef = useRef(null);

  useEffect(() => {
    // Auto scroll to latest if needed
  }, [logs]);

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', height: '320px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Autonomous Agent Reasoning Stream</h3>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Real-Time Testnet Loop</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.35)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic', margin: 'auto' }}>
            Awaiting agent startup signal...
          </div>
        ) : (
          logs.map((log) => {
            const isEmergency = log.level === 'EMERGENCY';
            const isTrade = log.level === 'TRADE';
            const isWarn = log.level === 'WARNING';

            const badgeColor = isEmergency
              ? 'var(--accent-red)'
              : isTrade
              ? 'var(--accent-green)'
              : isWarn
              ? 'var(--accent-amber)'
              : 'var(--accent-cyan)';

            const badgeBg = isEmergency
              ? 'rgba(255,51,102,0.15)'
              : isTrade
              ? 'rgba(0,255,136,0.15)'
              : 'rgba(0,240,255,0.12)';

            return (
              <div
                key={log.id}
                style={{
                  fontSize: '0.75rem',
                  lineHeight: '1.4',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: isEmergency ? 'rgba(255,51,102,0.06)' : 'rgba(255,255,255,0.02)',
                  border: isEmergency ? '1px solid rgba(255,51,102,0.3)' : 'none',
                }}
              >
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: badgeBg,
                    color: badgeColor,
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  {log.level}
                </span>

                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{log.message}</span>
                  {log.details?.explorerUrl && (
                    <div style={{ marginTop: '4px' }}>
                      <a
                        href={log.details.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--accent-cyan)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          textDecoration: 'none',
                        }}
                      >
                        Nearblocks Explorer Proof <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>

                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }} className="mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
