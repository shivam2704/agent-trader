// apps/trader-ui/src/components/AgentTerminal.jsx
import React, { useRef, useEffect } from 'react';
import { Terminal, ExternalLink } from 'lucide-react';

export default function AgentTerminal({ logs = [] }) {
  const terminalEndRef = useRef(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const levelMeta = (level) => {
    switch (level) {
      case 'EMERGENCY': return { color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.12)' };
      case 'TRADE':     return { color: 'var(--accent-green)', bg: 'rgba(16,185,129,0.12)' };
      case 'WARNING':   return { color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.12)' };
      default:          return { color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.1)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Terminal size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>EXECUTION & SOLVER AUDIT TRAIL</span>
        </div>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{logs.length} events</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', minHeight: 0 }}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 'auto', textAlign: 'center' }}>
            No activity. Awaiting engine startup signal.
          </div>
        ) : (
          logs.map((log) => {
            const { color, bg } = levelMeta(log.level);
            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '5px 8px',
                  borderRadius: '5px',
                  background: log.level === 'EMERGENCY' ? 'rgba(239,68,68,0.05)' : 'transparent',
                  border: log.level === 'EMERGENCY' ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent',
                }}
              >
                <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: bg, color, flexShrink: 0, marginTop: '1px', letterSpacing: '0.04em' }}>
                  {log.level}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{log.message}</span>
                  {log.details?.explorerUrl && (
                    <div style={{ marginTop: '3px' }}>
                      <a href={log.details.explorerUrl} target="_blank" rel="noreferrer"
                        style={{ fontSize: '0.68rem', color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                        On-chain proof <ExternalLink size={9} />
                      </a>
                    </div>
                  )}
                </div>
                <span
                  className="mono"
                  style={{ fontSize: '0.63rem', color: 'var(--text-muted)', flexShrink: 0 }}
                  title={log.timestamp ? new Date(log.timestamp).toLocaleString() : '--'}
                >
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--'}
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
